package main

import (
	"grayscale-pause-recovery/api"
	"grayscale-pause-recovery/storage"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	store := storage.NewMemoryStorage()
	handler := api.NewHandler(store)

	r := gin.Default()

	api.RegisterRoutes(r, handler)

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
