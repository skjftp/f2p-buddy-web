package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type User struct {
	UID            string    `json:"uid" firestore:"uid"`
	PhoneNumber    string    `json:"phoneNumber" firestore:"phoneNumber"`
	Role           string    `json:"role" firestore:"role"`
	OrganizationID string    `json:"organizationId,omitempty" firestore:"organizationId,omitempty"`
	DisplayName    string    `json:"displayName,omitempty" firestore:"displayName,omitempty"`
	CreatedAt      time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt" firestore:"updatedAt"`
}

type VerifyTokenRequest struct {
	IDToken string `json:"idToken" binding:"required"`
}

type CreateUserRequest struct {
	PhoneNumber    string `json:"phoneNumber" binding:"required"`
	Role           string `json:"role" binding:"required"`
	OrganizationID string `json:"organizationId,omitempty"`
	DisplayName    string `json:"displayName,omitempty"`
}

// Verify Firebase ID token
func verifyToken(c *gin.Context) {
	var req VerifyTokenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Verify token with Firebase Auth
	token, err := authClient.VerifyIDToken(ctx, req.IDToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
		return
	}

	// Check if user exists in Firestore
	userDoc, err := firestoreClient.Collection("users").Doc(token.UID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to check user"})
		return
	}

	var user User
	if userDoc.Exists() {
		if err := userDoc.DataTo(&user); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse user data"})
			return
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"valid":  true,
		"uid":    token.UID,
		"user":   user,
		"exists": userDoc.Exists(),
	})
}

// Create or update user in Firestore
func createOrUpdateUser(c *gin.Context) {
	var req CreateUserRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	// Get UID from authenticated context
	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Validate role
	if req.Role != "admin" && req.Role != "employee" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid role. Must be 'admin' or 'employee'"})
		return
	}

	now := time.Now()
	user := User{
		UID:         uid.(string),
		PhoneNumber: req.PhoneNumber,
		Role:        req.Role,
		DisplayName: req.DisplayName,
		UpdatedAt:   now,
	}

	// Set organization ID if provided
	if req.OrganizationID != "" {
		user.OrganizationID = req.OrganizationID
	}

	// Check if user already exists
	userRef := firestoreClient.Collection("users").Doc(uid.(string))
	userDoc, err := userRef.Get(ctx)
	
	if err != nil && !userDoc.Exists() {
		// Create new user
		user.CreatedAt = now
		_, err = userRef.Set(ctx, user)
	} else {
		// Update existing user (preserve CreatedAt)
		var existingUser User
		if err := userDoc.DataTo(&existingUser); err == nil {
			user.CreatedAt = existingUser.CreatedAt
		} else {
			user.CreatedAt = now
		}
		_, err = userRef.Set(ctx, user)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to save user"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"user":    user,
	})
}