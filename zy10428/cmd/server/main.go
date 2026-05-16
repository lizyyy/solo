package main

import (
	"log"
	"shadow-test-api/internal/api"
	"shadow-test-api/internal/service"
	"shadow-test-api/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	store, err := storage.NewStorage("shadow_test.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}

	svc := service.NewShadowTestService(store)
	handler := api.NewHandler(svc)

	r := gin.Default()
	handler.SetupRoutes(r)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
