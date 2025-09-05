package main

import (
	"net/http"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/iterator"
)

type Organization struct {
	ID             string                 `json:"id" firestore:"-"`
	Name           string                 `json:"name" firestore:"name"`
	Logo           string                 `json:"logo,omitempty" firestore:"logo,omitempty"`
	PrimaryColor   string                 `json:"primaryColor" firestore:"primaryColor"`
	SecondaryColor string                 `json:"secondaryColor" firestore:"secondaryColor"`
	AdminID        string                 `json:"adminId" firestore:"adminId"`
	Settings       OrganizationSettings   `json:"settings" firestore:"settings"`
	CreatedAt      time.Time             `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time             `json:"updatedAt" firestore:"updatedAt"`
}

type OrganizationSettings struct {
	AllowSelfRegistration bool   `json:"allowSelfRegistration" firestore:"allowSelfRegistration"`
	RequireApproval       bool   `json:"requireApproval" firestore:"requireApproval"`
	Timezone              string `json:"timezone" firestore:"timezone"`
}

type CreateOrganizationRequest struct {
	Name           string               `json:"name" binding:"required"`
	Logo           string               `json:"logo,omitempty"`
	PrimaryColor   string               `json:"primaryColor" binding:"required"`
	SecondaryColor string               `json:"secondaryColor" binding:"required"`
	Settings       OrganizationSettings `json:"settings"`
}

type UpdateOrganizationRequest struct {
	Name           string               `json:"name,omitempty"`
	Logo           string               `json:"logo,omitempty"`
	PrimaryColor   string               `json:"primaryColor,omitempty"`
	SecondaryColor string               `json:"secondaryColor,omitempty"`
	Settings       OrganizationSettings `json:"settings,omitempty"`
}

// Create organization
func createOrganization(c *gin.Context) {
	var req CreateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is admin
	userDoc, err := firestoreClient.Collection("users").Doc(uid.(string)).Get(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user"})
		return
	}

	var user User
	if err := userDoc.DataTo(&user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
		return
	}

	if user.Role != "admin" {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can create organizations"})
		return
	}

	// Create organization
	now := time.Now()
	org := Organization{
		Name:           req.Name,
		Logo:           req.Logo,
		PrimaryColor:   req.PrimaryColor,
		SecondaryColor: req.SecondaryColor,
		AdminID:        uid.(string),
		Settings:       req.Settings,
		CreatedAt:      now,
		UpdatedAt:      now,
	}

	// Add organization to Firestore
	orgRef, _, err := firestoreClient.Collection("organizations").Add(ctx, org)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create organization"})
		return
	}

	// Update user with organization ID
	_, err = firestoreClient.Collection("users").Doc(uid.(string)).Update(ctx, []firestore.Update{
		{Path: "organizationId", Value: orgRef.ID},
		{Path: "updatedAt", Value: now},
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update user with organization"})
		return
	}

	org.ID = orgRef.ID
	c.JSON(http.StatusCreated, gin.H{
		"success":      true,
		"organization": org,
	})
}

// Get organization by ID
func getOrganization(c *gin.Context) {
	orgID := c.Param("id")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get organization
	orgDoc, err := firestoreClient.Collection("organizations").Doc(orgID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var org Organization
	if err := orgDoc.DataTo(&org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse organization data"})
		return
	}

	org.ID = orgDoc.Ref.ID

	// Check if user has access to this organization
	userDoc, err := firestoreClient.Collection("users").Doc(uid.(string)).Get(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user"})
		return
	}

	var user User
	if err := userDoc.DataTo(&user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
		return
	}

	// Allow access if user is admin of this org or employee in this org
	if org.AdminID != uid.(string) && user.OrganizationID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, org)
}

// Update organization
func updateOrganization(c *gin.Context) {
	orgID := c.Param("id")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID is required"})
		return
	}

	var req UpdateOrganizationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is admin of this organization
	orgDoc, err := firestoreClient.Collection("organizations").Doc(orgID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var org Organization
	if err := orgDoc.DataTo(&org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse organization data"})
		return
	}

	if org.AdminID != uid.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only organization admin can update"})
		return
	}

	// Prepare update data
	updates := []firestore.Update{
		{Path: "updatedAt", Value: time.Now()},
	}

	if req.Name != "" {
		updates = append(updates, firestore.Update{Path: "name", Value: req.Name})
	}
	if req.Logo != "" {
		updates = append(updates, firestore.Update{Path: "logo", Value: req.Logo})
	}
	if req.PrimaryColor != "" {
		updates = append(updates, firestore.Update{Path: "primaryColor", Value: req.PrimaryColor})
	}
	if req.SecondaryColor != "" {
		updates = append(updates, firestore.Update{Path: "secondaryColor", Value: req.SecondaryColor})
	}

	// Update organization
	_, err = firestoreClient.Collection("organizations").Doc(orgID).Update(ctx, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update organization"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Get organization employees
func getOrganizationEmployees(c *gin.Context) {
	orgID := c.Param("id")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user has access to this organization
	orgDoc, err := firestoreClient.Collection("organizations").Doc(orgID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Organization not found"})
		return
	}

	var org Organization
	if err := orgDoc.DataTo(&org); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse organization data"})
		return
	}

	userDoc, err := firestoreClient.Collection("users").Doc(uid.(string)).Get(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user"})
		return
	}

	var user User
	if err := userDoc.DataTo(&user); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
		return
	}

	// Allow access if user is admin of this org or employee in this org
	if org.AdminID != uid.(string) && user.OrganizationID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get employees
	iter := firestoreClient.Collection("users").
		Where("organizationId", "==", orgID).
		Documents(ctx)
	defer iter.Stop()

	var employees []User
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch employees"})
			return
		}

		var employee User
		if err := doc.DataTo(&employee); err != nil {
			continue
		}
		employees = append(employees, employee)
	}

	c.JSON(http.StatusOK, gin.H{
		"employees": employees,
		"count":     len(employees),
	})
}