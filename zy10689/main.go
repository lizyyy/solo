package main

import (
	"audit-log-retention/api"
	"audit-log-retention/service"
	"log"
)

func main() {
	retentionService := service.NewRetentionService()
	router := api.SetupRouter(retentionService)

	log.Println("Server starting on :8080")
	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
