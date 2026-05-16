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

	log.Println("Server starting on :8081")
	if err := r.Run(":8081"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
