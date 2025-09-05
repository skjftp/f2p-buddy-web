package main

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type FirebaseConfig struct {
	APIKey            string `json:"apiKey"`
	AuthDomain        string `json:"authDomain"`
	ProjectID         string `json:"projectId"`
	StorageBucket     string `json:"storageBucket"`
	MessagingSenderID string `json:"messagingSenderId"`
	AppID             string `json:"appId"`
}

type AppConfig struct {
	Firebase    FirebaseConfig `json:"firebase"`
	Environment string         `json:"environment"`
	Version     string         `json:"version"`
}

// Get Firebase configuration for frontend
func getConfig(c *gin.Context) {
	// Get Firebase config from environment variables (set in Cloud Run)
	config := AppConfig{
		Firebase: FirebaseConfig{
			APIKey:            getEnvOrDefault("FIREBASE_API_KEY", ""),
			AuthDomain:        getEnvOrDefault("FIREBASE_AUTH_DOMAIN", "f2p-buddy-1756234727.firebaseapp.com"),
			ProjectID:         getEnvOrDefault("FIREBASE_PROJECT_ID", "f2p-buddy-1756234727"),
			StorageBucket:     getEnvOrDefault("FIREBASE_STORAGE_BUCKET", "f2p-buddy-1756234727.appspot.com"),
			MessagingSenderID: getEnvOrDefault("FIREBASE_MESSAGING_SENDER_ID", ""),
			AppID:             getEnvOrDefault("FIREBASE_APP_ID", ""),
		},
		Environment: getEnvOrDefault("ENVIRONMENT", "production"),
		Version:     getEnvOrDefault("APP_VERSION", "1.0.0"),
	}

	// Validate that required config is present
	if config.Firebase.APIKey == "" || config.Firebase.MessagingSenderID == "" || config.Firebase.AppID == "" {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "Firebase configuration not properly set up",
		})
		return
	}

	// Add CORS headers specifically for config endpoint
	c.Header("Access-Control-Allow-Origin", "*")
	c.Header("Access-Control-Allow-Methods", "GET, OPTIONS")
	c.Header("Access-Control-Allow-Headers", "Content-Type")

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"config":  config,
	})
}

// Helper function to get environment variable with default
func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}