package main

import (
	"log"

	"strategy-hotload-api/internal/api"
)

func main() {
	r := api.SetupRouter()
	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
