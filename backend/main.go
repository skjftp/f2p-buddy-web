package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"cloud.google.com/go/firestore"
	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/auth"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"google.golang.org/api/option"
)

var (
	app           *firebase.App
	firestoreClient *firestore.Client
	authClient    *auth.Client
	ctx           = context.Background()
)

func initFirebase() {
	var err error
	var opt option.ClientOption

	// Use service account key in development, Application Default Credentials in production
	if keyPath := os.Getenv("FIREBASE_SERVICE_ACCOUNT_KEY"); keyPath != "" {
		opt = option.WithCredentialsFile(keyPath)
	}

	if opt != nil {
		app, err = firebase.NewApp(ctx, &firebase.Config{
			ProjectID: "f2p-buddy-1756234727",
		}, opt)
	} else {
		// Use Application Default Credentials in Cloud Run
		app, err = firebase.NewApp(ctx, &firebase.Config{
			ProjectID: "f2p-buddy-1756234727",
		})
	}

	if err != nil {
		log.Fatalf("error initializing Firebase app: %v\n", err)
	}

	// Initialize Firestore client
	firestoreClient, err = app.Firestore(ctx)
	if err != nil {
		log.Fatalf("error initializing Firestore client: %v\n", err)
	}

	// Initialize Auth client
	authClient, err = app.Auth(ctx)
	if err != nil {
		log.Fatalf("error initializing Auth client: %v\n", err)
	}

	log.Println("Firebase initialized successfully")
}

func setupRoutes(r *gin.Engine) {
	// API group
	api := r.Group("/api")
	
	// Health check
	api.GET("/health", healthCheck)
	
	// Auth routes
	auth := api.Group("/auth")
	{
		auth.POST("/verify", verifyToken)
		auth.POST("/user", createOrUpdateUser)
	}
	
	// Organization routes
	org := api.Group("/organizations")
	org.Use(authMiddleware())
	{
		org.POST("/", createOrganization)
		org.GET("/:id", getOrganization)
		org.PUT("/:id", updateOrganization)
		org.GET("/:id/employees", getOrganizationEmployees)
	}
	
	// Campaign routes
	campaigns := api.Group("/campaigns")
	campaigns.Use(authMiddleware())
	{
		campaigns.POST("/", createCampaign)
		campaigns.GET("/", getCampaigns)
		campaigns.GET("/:id", getCampaign)
		campaigns.PUT("/:id", updateCampaign)
		campaigns.DELETE("/:id", deleteCampaign)
		campaigns.POST("/:id/participate", participateInCampaign)
	}
	
	// Achievement routes
	achievements := api.Group("/achievements")
	achievements.Use(authMiddleware())
	{
		achievements.POST("/", createAchievement)
		achievements.GET("/", getAchievements)
		achievements.PUT("/:id/verify", verifyAchievement)
		achievements.GET("/leaderboard/:orgId", getLeaderboard)
	}
	
	// Analytics routes
	analytics := api.Group("/analytics")
	analytics.Use(authMiddleware())
	{
		analytics.GET("/organization/:orgId", getOrganizationAnalytics)
		analytics.GET("/campaign/:campaignId", getCampaignAnalytics)
	}
}

func main() {
	// Initialize Firebase
	initFirebase()
	defer firestoreClient.Close()

	// Initialize Gin router
	r := gin.Default()

	// CORS configuration
	config := cors.DefaultConfig()
	config.AllowOrigins = []string{
		"https://f2p-buddy.netlify.app",
		"https://*.netlify.app",
		"http://localhost:3000",
		"http://localhost:3001",
	}
	config.AllowCredentials = true
	config.AddAllowHeaders("Authorization")
	config.AddAllowMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")

	r.Use(cors.New(config))

	// Setup routes
	setupRoutes(r)

	// Get port from environment variable or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

// Health check endpoint
func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"message": "F2P Buddy API is running",
		"version": "1.0.0",
	})
}

// Auth middleware to verify Firebase tokens
func authMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Authorization header is required"})
			c.Abort()
			return
		}

		// Extract token from "Bearer <token>"
		if len(authHeader) < 7 || authHeader[:7] != "Bearer " {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid authorization header format"})
			c.Abort()
			return
		}

		token := authHeader[7:]
		
		// Verify token with Firebase Auth
		decodedToken, err := authClient.VerifyIDToken(ctx, token)
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "Invalid token"})
			c.Abort()
			return
		}

		// Store user info in context
		c.Set("uid", decodedToken.UID)
		c.Set("token", decodedToken)
		c.Next()
	}
}