package main

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"google.golang.org/api/iterator"
)

type OrganizationAnalytics struct {
	TotalEmployees     int                       `json:"totalEmployees"`
	ActiveCampaigns    int                       `json:"activeCampaigns"`
	TotalAchievements  int                       `json:"totalAchievements"`
	CompletionRate     float64                   `json:"completionRate"`
	PerformanceData    []MonthlyPerformance      `json:"performanceData"`
	AchievementTypes   []AchievementTypeBreakdown `json:"achievementTypes"`
	TopPerformers      []LeaderboardEntry        `json:"topPerformers"`
}

type CampaignAnalytics struct {
	CampaignID         string                    `json:"campaignId"`
	ParticipantCount   int                       `json:"participantCount"`
	CompletionRate     float64                   `json:"completionRate"`
	AverageScore       float64                   `json:"averageScore"`
	TotalAchievements  int                       `json:"totalAchievements"`
	PerformanceData    []DailyPerformance        `json:"performanceData"`
	ParticipantStats   []ParticipantStats        `json:"participantStats"`
}

type MonthlyPerformance struct {
	Month    string  `json:"month"`
	Sales    float64 `json:"sales"`
	Calls    int     `json:"calls"`
	Meetings int     `json:"meetings"`
}

type DailyPerformance struct {
	Date         string  `json:"date"`
	Achievements int     `json:"achievements"`
	TotalValue   float64 `json:"totalValue"`
}

type AchievementTypeBreakdown struct {
	Name  string  `json:"name"`
	Value int     `json:"value"`
	Color string  `json:"color"`
}

type ParticipantStats struct {
	UserID       string  `json:"userId"`
	DisplayName  string  `json:"displayName"`
	Achievements int     `json:"achievements"`
	TotalScore   float64 `json:"totalScore"`
	LastActivity string  `json:"lastActivity"`
}

// Get organization analytics
func getOrganizationAnalytics(c *gin.Context) {
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

	if user.OrganizationID != orgID {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	analytics := OrganizationAnalytics{}

	// Get total employees
	employeesIter := firestoreClient.Collection("users").
		Where("organizationId", "==", orgID).
		Documents(ctx)
	defer employeesIter.Stop()

	employeeCount := 0
	for {
		_, err := employeesIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}
		employeeCount++
	}
	analytics.TotalEmployees = employeeCount

	// Get campaigns
	campaignsIter := firestoreClient.Collection("campaigns").
		Where("orgId", "==", orgID).
		Documents(ctx)
	defer campaignsIter.Stop()

	activeCampaigns := 0
	totalCampaigns := 0
	var campaignIDs []string

	for {
		doc, err := campaignsIter.Next()
		if err == iterator.Done {
			break
		}
		if err != nil {
			break
		}

		var campaign Campaign
		if err := doc.DataTo(&campaign); err != nil {
			continue
		}

		totalCampaigns++
		campaignIDs = append(campaignIDs, doc.Ref.ID)
		if campaign.Status == "active" {
			activeCampaigns++
		}
	}
	analytics.ActiveCampaigns = activeCampaigns

	// Get achievements for organization campaigns
	totalAchievements := 0
	achievementTypeCount := map[string]int{
		"sales":     0,
		"calls":     0,
		"meetings":  0,
		"referrals": 0,
	}

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

			totalAchievements++
			achievementTypeCount[achievement.Type]++
		}
	}
	analytics.TotalAchievements = totalAchievements

	// Calculate completion rate
	if totalCampaigns > 0 {
		completedCampaigns := 0
		for _, campaignID := range campaignIDs {
			campaignDoc, err := firestoreClient.Collection("campaigns").Doc(campaignID).Get(ctx)
			if err != nil {
				continue
			}
			var campaign Campaign
			if err := campaignDoc.DataTo(&campaign); err != nil {
				continue
			}
			if campaign.Status == "completed" {
				completedCampaigns++
			}
		}
		analytics.CompletionRate = (float64(completedCampaigns) / float64(totalCampaigns)) * 100
	}

	// Generate performance data (mock data for now)
	analytics.PerformanceData = []MonthlyPerformance{
		{Month: "Jan", Sales: 45000, Calls: 320, Meetings: 45},
		{Month: "Feb", Sales: 52000, Calls: 380, Meetings: 52},
		{Month: "Mar", Sales: 48000, Calls: 350, Meetings: 48},
		{Month: "Apr", Sales: 61000, Calls: 420, Meetings: 61},
		{Month: "May", Sales: 55000, Calls: 390, Meetings: 55},
		{Month: "Jun", Sales: 67000, Calls: 450, Meetings: 67},
	}

	// Achievement type breakdown
	analytics.AchievementTypes = []AchievementTypeBreakdown{
		{Name: "Sales", Value: achievementTypeCount["sales"], Color: "#28a745"},
		{Name: "Calls", Value: achievementTypeCount["calls"], Color: "#17a2b8"},
		{Name: "Meetings", Value: achievementTypeCount["meetings"], Color: "#ffc107"},
		{Name: "Referrals", Value: achievementTypeCount["referrals"], Color: "#fd7e14"},
	}

	// Get top performers (reuse leaderboard logic)
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

	// Get user display names and convert to slice
	var topPerformers []LeaderboardEntry
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
		topPerformers = append(topPerformers, *entry)
	}

	// Limit to top 5
	if len(topPerformers) > 5 {
		topPerformers = topPerformers[:5]
	}
	analytics.TopPerformers = topPerformers

	c.JSON(http.StatusOK, analytics)
}

// Get campaign analytics
func getCampaignAnalytics(c *gin.Context) {
	campaignID := c.Param("campaignId")
	if campaignID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Campaign ID is required"})
		return
	}

	uid, exists := c.Get("uid")
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "User not authenticated"})
		return
	}

	// Get campaign and check access
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

	analytics := CampaignAnalytics{
		CampaignID: campaignID,
	}

	// Get participant count
	analytics.ParticipantCount = len(campaign.Participants)

	// Get achievements for this campaign
	achievementsIter := firestoreClient.Collection("achievements").
		Where("campaignId", "==", campaignID).
		Documents(ctx)
	defer achievementsIter.Stop()

	totalAchievements := 0
	verifiedAchievements := 0
	totalScore := 0.0
	participantScores := make(map[string]*ParticipantStats)

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

		totalAchievements++
		if achievement.Verified {
			verifiedAchievements++
			totalScore += achievement.Value
		}

		// Track participant stats
		if stats, exists := participantScores[achievement.UserID]; exists {
			stats.Achievements++
			if achievement.Verified {
				stats.TotalScore += achievement.Value
			}
			// Update last activity if this achievement is more recent
			if achievement.DateAchieved > stats.LastActivity {
				stats.LastActivity = achievement.DateAchieved
			}
		} else {
			score := 0.0
			if achievement.Verified {
				score = achievement.Value
			}
			participantScores[achievement.UserID] = &ParticipantStats{
				UserID:       achievement.UserID,
				Achievements: 1,
				TotalScore:   score,
				LastActivity: achievement.DateAchieved,
			}
		}
	}

	analytics.TotalAchievements = totalAchievements

	// Calculate completion rate
	if analytics.ParticipantCount > 0 {
		participantsWithAchievements := len(participantScores)
		analytics.CompletionRate = (float64(participantsWithAchievements) / float64(analytics.ParticipantCount)) * 100
	}

	// Calculate average score
	if verifiedAchievements > 0 {
		analytics.AverageScore = totalScore / float64(verifiedAchievements)
	}

	// Get user display names for participant stats
	var participantStats []ParticipantStats
	for userID, stats := range participantScores {
		userDoc, err := firestoreClient.Collection("users").Doc(userID).Get(ctx)
		if err != nil {
			continue
		}
		var userData User
		if err := userDoc.DataTo(&userData); err != nil {
			continue
		}
		stats.DisplayName = userData.DisplayName
		if stats.DisplayName == "" {
			stats.DisplayName = "Unknown User"
		}
		participantStats = append(participantStats, *stats)
	}
	analytics.ParticipantStats = participantStats

	// Generate mock daily performance data
	now := time.Now()
	analytics.PerformanceData = []DailyPerformance{}
	for i := 6; i >= 0; i-- {
		date := now.AddDate(0, 0, -i)
		analytics.PerformanceData = append(analytics.PerformanceData, DailyPerformance{
			Date:         date.Format("2006-01-02"),
			Achievements: totalAchievements / 7, // Distribute evenly for demo
			TotalValue:   totalScore / 7,
		})
	}

	c.JSON(http.StatusOK, analytics)
}