package main

import (
	"api-replay-throttler/internal/handler"
	"api-replay-throttler/internal/model"
	"api-replay-throttler/internal/repository"
	"api-replay-throttler/internal/service"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := model.InitDB("replay_throttler.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	repo := repository.NewRepository(model.DB)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	r := gin.Default()
	h.SetupRoutes(r)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
