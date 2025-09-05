package main

import (
	"net/http"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/iterator"
)

type Campaign struct {
	ID          string                 `json:"id" firestore:"-"`
	Name        string                 `json:"name" firestore:"name"`
	Description string                 `json:"description" firestore:"description"`
	StartDate   string                 `json:"startDate" firestore:"startDate"`
	EndDate     string                 `json:"endDate" firestore:"endDate"`
	Banner      string                 `json:"banner,omitempty" firestore:"banner,omitempty"`
	Type        []string               `json:"type" firestore:"type"`
	Metrics     map[string]interface{} `json:"metrics" firestore:"metrics"`
	Prizes      []Prize               `json:"prizes" firestore:"prizes"`
	Participants []string              `json:"participants" firestore:"participants"`
	OrgID       string                `json:"orgId" firestore:"orgId"`
	CreatedBy   string                `json:"createdBy" firestore:"createdBy"`
	Status      string                `json:"status" firestore:"status"`
	CreatedAt   time.Time             `json:"createdAt" firestore:"createdAt"`
	UpdatedAt   time.Time             `json:"updatedAt" firestore:"updatedAt"`
}

type Prize struct {
	Position    int    `json:"position" firestore:"position"`
	Title       string `json:"title" firestore:"title"`
	Description string `json:"description" firestore:"description"`
	Image       string `json:"image,omitempty" firestore:"image,omitempty"`
}

type CreateCampaignRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description" binding:"required"`
	StartDate   string                 `json:"startDate" binding:"required"`
	EndDate     string                 `json:"endDate" binding:"required"`
	Banner      string                 `json:"banner,omitempty"`
	Type        []string               `json:"type" binding:"required"`
	Metrics     map[string]interface{} `json:"metrics" binding:"required"`
	Prizes      []Prize               `json:"prizes"`
}

type UpdateCampaignRequest struct {
	Name        string                 `json:"name,omitempty"`
	Description string                 `json:"description,omitempty"`
	StartDate   string                 `json:"startDate,omitempty"`
	EndDate     string                 `json:"endDate,omitempty"`
	Banner      string                 `json:"banner,omitempty"`
	Type        []string               `json:"type,omitempty"`
	Metrics     map[string]interface{} `json:"metrics,omitempty"`
	Prizes      []Prize               `json:"prizes,omitempty"`
	Status      string                 `json:"status,omitempty"`
}

// Create campaign
func createCampaign(c *gin.Context) {
	var req CreateCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get user and check if admin
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can create campaigns"})
		return
	}

	if user.OrganizationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User must belong to an organization"})
		return
	}

	// Create campaign
	now := time.Now()
	campaign := Campaign{
		Name:         req.Name,
		Description:  req.Description,
		StartDate:    req.StartDate,
		EndDate:      req.EndDate,
		Banner:       req.Banner,
		Type:         req.Type,
		Metrics:      req.Metrics,
		Prizes:       req.Prizes,
		Participants: []string{},
		OrgID:        user.OrganizationID,
		CreatedBy:    uid.(string),
		Status:       "draft",
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Add campaign to Firestore
	campaignRef, _, err := firestoreClient.Collection("campaigns").Add(ctx, campaign)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create campaign"})
		return
	}

	campaign.ID = campaignRef.ID
	c.JSON(http.StatusCreated, gin.H{
		"success":  true,
		"campaign": campaign,
	})
}

// Get campaigns for user's organization
func getCampaigns(c *gin.Context) {
	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get user's organization
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

	if user.OrganizationID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User must belong to an organization"})
		return
	}

	// Query campaigns for organization
	query := firestoreClient.Collection("campaigns").Where("orgId", "==", user.OrganizationID)
	
	// Add status filter if provided
	if status := c.Query("status"); status != "" {
		query = query.Where("status", "==", status)
	}

	// Order by creation date (newest first)
	query = query.OrderBy("createdAt", firestore.Desc)

	iter := query.Documents(ctx)
	defer iter.Stop()

	var campaigns []Campaign
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch campaigns"})
			return
		}

		var campaign Campaign
		if err := doc.DataTo(&campaign); err != nil {
			continue
		}
		campaign.ID = doc.Ref.ID
		campaigns = append(campaigns, campaign)
	}

	c.JSON(http.StatusOK, gin.H{
		"campaigns": campaigns,
		"count":     len(campaigns),
	})
}

// Get single campaign
func getCampaign(c *gin.Context) {
	campaignID := c.Param("id")
	if campaignID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campaign ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get campaign
	campaignDoc, err := firestoreClient.Collection("campaigns").Doc(campaignID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var campaign Campaign
	if err := campaignDoc.DataTo(&campaign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse campaign data"})
		return
	}

	campaign.ID = campaignDoc.Ref.ID

	// Check if user has access to this campaign
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

	if user.OrganizationID != campaign.OrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	c.JSON(http.StatusOK, campaign)
}

// Update campaign
func updateCampaign(c *gin.Context) {
	campaignID := c.Param("id")
	if campaignID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campaign ID is required"})
		return
	}

	var req UpdateCampaignRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is admin and campaign belongs to their org
	campaignDoc, err := firestoreClient.Collection("campaigns").Doc(campaignID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var campaign Campaign
	if err := campaignDoc.DataTo(&campaign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse campaign data"})
		return
	}

	if campaign.CreatedBy != uid.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only campaign creator can update"})
		return
	}

	// Prepare update data
	updates := []firestore.Update{
		{Path: "updatedAt", Value: time.Now()},
	}

	if req.Name != "" {
		updates = append(updates, firestore.Update{Path: "name", Value: req.Name})
	}
	if req.Description != "" {
		updates = append(updates, firestore.Update{Path: "description", Value: req.Description})
	}
	if req.StartDate != "" {
		updates = append(updates, firestore.Update{Path: "startDate", Value: req.StartDate})
	}
	if req.EndDate != "" {
		updates = append(updates, firestore.Update{Path: "endDate", Value: req.EndDate})
	}
	if req.Banner != "" {
		updates = append(updates, firestore.Update{Path: "banner", Value: req.Banner})
	}
	if len(req.Type) > 0 {
		updates = append(updates, firestore.Update{Path: "type", Value: req.Type})
	}
	if req.Metrics != nil {
		updates = append(updates, firestore.Update{Path: "metrics", Value: req.Metrics})
	}
	if len(req.Prizes) > 0 {
		updates = append(updates, firestore.Update{Path: "prizes", Value: req.Prizes})
	}
	if req.Status != "" {
		updates = append(updates, firestore.Update{Path: "status", Value: req.Status})
	}

	// Update campaign
	_, err = firestoreClient.Collection("campaigns").Doc(campaignID).Update(ctx, updates)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update campaign"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Delete campaign
func deleteCampaign(c *gin.Context) {
	campaignID := c.Param("id")
	if campaignID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campaign ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user is admin and campaign belongs to their org
	campaignDoc, err := firestoreClient.Collection("campaigns").Doc(campaignID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var campaign Campaign
	if err := campaignDoc.DataTo(&campaign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse campaign data"})
		return
	}

	if campaign.CreatedBy != uid.(string) {
		c.JSON(http.StatusForbidden, gin.H{"error": "Only campaign creator can delete"})
		return
	}

	// Delete campaign
	_, err = firestoreClient.Collection("campaigns").Doc(campaignID).Delete(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete campaign"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Participate in campaign
func participateInCampaign(c *gin.Context) {
	campaignID := c.Param("id")
	if campaignID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campaign ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get campaign
	campaignRef := firestoreClient.Collection("campaigns").Doc(campaignID)
	campaignDoc, err := campaignRef.Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var campaign Campaign
	if err := campaignDoc.DataTo(&campaign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse campaign data"})
		return
	}

	// Check if user belongs to same organization
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

	if user.OrganizationID != campaign.OrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Can only participate in organization campaigns"})
		return
	}

	// Check if already participating
	for _, participant := range campaign.Participants {
		if participant == uid.(string) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Already participating in campaign"})
			return
		}
	}

	// Add user to participants
	_, err = campaignRef.Update(ctx, []firestore.Update{
		{Path: "participants", Value: firestore.ArrayUnion(uid.(string))},
		{Path: "updatedAt", Value: time.Now()},
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to join campaign"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}