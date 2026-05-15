package main

import (
	"experiment-guard/internal/handler"
	"experiment-guard/internal/service"
	"experiment-guard/internal/store"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	s, err := store.NewStore("experiment-guard.db")
	if err != nil {
		log.Fatalf("Failed to create store: %v", err)
	}

	svc := service.NewExperimentService(s)
	h := handler.NewHandler(svc)

	r := gin.Default()
	handler.SetupRoutes(r, h)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
