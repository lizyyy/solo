package main

import (
	"log"
	"presigned-link-governance/api"
	"presigned-link-governance/config"
	"presigned-link-governance/service"
)

func main() {
	config.InitDB()
	service.StartCleanupJob()
	
	r := api.SetupRouter()
	
	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
