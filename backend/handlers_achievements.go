package main

import (
	"net/http"
	"sort"
	"time"

	"cloud.google.com/go/firestore"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/iterator"
)

type Achievement struct {
	ID           string    `json:"id" firestore:"-"`
	UserID       string    `json:"userId" firestore:"userId"`
	CampaignID   string    `json:"campaignId" firestore:"campaignId"`
	Type         string    `json:"type" firestore:"type"`
	Value        float64   `json:"value" firestore:"value"`
	Description  string    `json:"description" firestore:"description"`
	DateAchieved string    `json:"dateAchieved" firestore:"dateAchieved"`
	Verified     bool      `json:"verified" firestore:"verified"`
	VerifiedBy   string    `json:"verifiedBy,omitempty" firestore:"verifiedBy,omitempty"`
	Evidence     Evidence  `json:"evidence,omitempty" firestore:"evidence,omitempty"`
	CreatedAt    time.Time `json:"createdAt" firestore:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt" firestore:"updatedAt"`
}

type Evidence struct {
	Type string `json:"type" firestore:"type"`
	URL  string `json:"url" firestore:"url"`
}

type CreateAchievementRequest struct {
	CampaignID   string   `json:"campaignId" binding:"required"`
	Type         string   `json:"type" binding:"required"`
	Value        float64  `json:"value" binding:"required"`
	Description  string   `json:"description" binding:"required"`
	DateAchieved string   `json:"dateAchieved" binding:"required"`
	Evidence     Evidence `json:"evidence,omitempty"`
}

type LeaderboardEntry struct {
	UserID       string  `json:"userId"`
	DisplayName  string  `json:"displayName"`
	TotalScore   float64 `json:"totalScore"`
	Achievements int     `json:"achievements"`
	Position     int     `json:"position"`
}

// Create achievement
func createAchievement(c *gin.Context) {
	var req CreateAchievementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Validate achievement type
	validTypes := []string{"sales", "calls", "meetings", "referrals"}
	isValidType := false
	for _, validType := range validTypes {
		if req.Type == validType {
			isValidType = true
			break
		}
	}

	if !isValidType {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid achievement type"})
		return
	}

	// Check if campaign exists and user has access
	campaignDoc, err := firestoreClient.Collection("campaigns").Doc(req.CampaignID).Get(ctx)
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Can only create achievements for organization campaigns"})
		return
	}

	// Create achievement
	now := time.Now()
	achievement := Achievement{
		UserID:       uid.(string),
		CampaignID:   req.CampaignID,
		Type:         req.Type,
		Value:        req.Value,
		Description:  req.Description,
		DateAchieved: req.DateAchieved,
		Verified:     false,
		Evidence:     req.Evidence,
		CreatedAt:    now,
		UpdatedAt:    now,
	}

	// Add achievement to Firestore
	achievementRef, _, err := firestoreClient.Collection("achievements").Add(ctx, achievement)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create achievement"})
		return
	}

	achievement.ID = achievementRef.ID
	c.JSON(http.StatusCreated, gin.H{
		"success":     true,
		"achievement": achievement,
	})
}

// Get achievements for user
func getAchievements(c *gin.Context) {
	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Query parameters
	userID := c.Query("userId")
	campaignID := c.Query("campaignId")
	achievementType := c.Query("type")
	verified := c.Query("verified")

	// Build query properly
	var query firestore.Query
	baseQuery := firestoreClient.Collection("achievements")

	if userID != "" {
		query = baseQuery.Where("userId", "==", userID)
	} else {
		// Default to current user's achievements
		query = baseQuery.Where("userId", "==", uid.(string))
	}

	if campaignID != "" {
		query = query.Where("campaignId", "==", campaignID)
	}

	if achievementType != "" {
		query = query.Where("type", "==", achievementType)
	}

	if verified != "" {
		verifiedBool := verified == "true"
		query = query.Where("verified", "==", verifiedBool)
	}

	// Order by date achieved (newest first)
	query = query.OrderBy("dateAchieved", firestore.Desc)

	iter := query.Documents(ctx)
	defer iter.Stop()

	var achievements []Achievement
	for {
		doc, err := iter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch achievements"})
			return
		}

		var achievement Achievement
		if err := doc.DataTo(&achievement); err != nil {
			continue
		}
		achievement.ID = doc.Ref.ID
		achievements = append(achievements, achievement)
	}

	c.JSON(http.StatusOK, gin.H{
		"achievements": achievements,
		"count":        len(achievements),
	})
}

// Verify achievement (admin only)
func verifyAchievement(c *gin.Context) {
	achievementID := c.Param("id")
	if achievementID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Achievement ID is required"})
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
		c.JSON(http.StatusForbidden, gin.H{"error": "Only admins can verify achievements"})
		return
	}

	// Get achievement
	achievementDoc, err := firestoreClient.Collection("achievements").Doc(achievementID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Achievement not found"})
		return
	}

	var achievement Achievement
	if err := achievementDoc.DataTo(&achievement); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse achievement data"})
		return
	}

	// Check if achievement belongs to admin's organization
	campaignDoc, err := firestoreClient.Collection("campaigns").Doc(achievement.CampaignID).Get(ctx)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Campaign not found"})
		return
	}

	var campaign Campaign
	if err := campaignDoc.DataTo(&campaign); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to parse campaign data"})
		return
	}

	if user.OrganizationID != campaign.OrgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Can only verify achievements in your organization"})
		return
	}

	// Update achievement as verified
	_, err = firestoreClient.Collection("achievements").Doc(achievementID).Update(ctx, []firestore.Update{
		{Path: "verified", Value: true},
		{Path: "verifiedBy", Value: uid.(string)},
		{Path: "updatedAt", Value: time.Now()},
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to verify achievement"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"success": true})
}

// Get leaderboard for organization
func getLeaderboard(c *gin.Context) {
	orgID := c.Param("orgId")
	if orgID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Organization ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Check if user belongs to this organization
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

	if user.OrganizationID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get all verified achievements for campaigns in this organization
	campaignsIter := firestoreClient.Collection("campaigns").
		Where("orgId", "==", orgID).
		Documents(ctx)
	defer campaignsIter.Stop()

	var campaignIDs []string
	for {
		doc, err := campaignsIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch campaigns"})
			return
		}
		campaignIDs = append(campaignIDs, doc.Ref.ID)
	}

	if len(campaignIDs) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"leaderboard": []LeaderboardEntry{},
			"count":       0,
		})
		return
	}

	// Get all verified achievements for these campaigns
	userScores := make(map[string]*LeaderboardEntry)
	
	for _, campaignID := range campaignIDs {
		achievementsIter := firestoreClient.Collection("achievements").
			Where("campaignId", "==", campaignID).
			Where("verified", "==", true).
			Documents(ctx)
		defer achievementsIter.Stop()

		for {
			doc, err := achievementsIter.Next()
			if err == iterator.Done {
				break
			}
			if err != nil {
				continue
			}

			var achievement Achievement
			if err := doc.DataTo(&achievement); err != nil {
				continue
			}

			if entry, exists := userScores[achievement.UserID]; exists {
				entry.TotalScore += achievement.Value
				entry.Achievements++
			} else {
				userScores[achievement.UserID] = &LeaderboardEntry{
					UserID:       achievement.UserID,
					TotalScore:   achievement.Value,
					Achievements: 1,
				}
			}
		}
	}

	// Get user display names
	for userID, entry := range userScores {
		userDoc, err := firestoreClient.Collection("users").Doc(userID).Get(ctx)
		if err != nil {
			continue
		}
		var userData User
		if err := userDoc.DataTo(&userData); err != nil {
			continue
		}
		entry.DisplayName = userData.DisplayName
		if entry.DisplayName == "" {
			entry.DisplayName = "Unknown User"
		}
	}

	// Convert to slice and sort by total score
	var leaderboard []LeaderboardEntry
	for _, entry := range userScores {
		leaderboard = append(leaderboard, *entry)
	}

	sort.Slice(leaderboard, func(i, j int) bool {
		return leaderboard[i].TotalScore > leaderboard[j].TotalScore
	})

	// Add positions
	for i := range leaderboard {
		leaderboard[i].Position = i + 1
	}

	// Limit to top 50
	if len(leaderboard) > 50 {
		leaderboard = leaderboard[:50]
	}

	c.JSON(http.StatusOK, gin.H{
		"leaderboard": leaderboard,
		"count":       len(leaderboard),
	})
}