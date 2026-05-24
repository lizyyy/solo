package main

import (
	"log"
	"os"

	"damage-arbitration/internal/api"
	"damage-arbitration/internal/database"
)

func main() {
	dbPath := "./data/arbitration.db"
	if envPath := os.Getenv("DB_PATH"); envPath != "" {
		dbPath = envPath
	}

	if err := database.InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	port := ":8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = ":" + envPort
	}

	r := api.SetupRouter()

	log.Printf("Server starting on port %s...", port)
	log.Printf("API base path: /api/v1")
	log.Printf("Health check: /health")

	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
