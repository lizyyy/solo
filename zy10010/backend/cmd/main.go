package main

import (
	"log"

	"system-chaos-visualizer/backend/pkg/server"
)

func main() {
	srv := server.NewServer()
	srv.SetupRoutes()

	log.Println("Starting System Chaos Visualizer server on :8080")
	if err := srv.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
