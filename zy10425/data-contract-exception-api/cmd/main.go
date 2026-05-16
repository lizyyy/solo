package main

import (
	"github.com/data-contract-exception-api/handler"
	"github.com/data-contract-exception-api/service"
	"github.com/data-contract-exception-api/store"
	"github.com/gin-gonic/gin"
	"log"
)

func main() {
	s, err := store.NewStore("data-contract-exception.db")
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}

	svc := service.NewService(s)
	h := handler.NewHandler(svc)

	r := gin.Default()

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	h.SetupRoutes(r)

	log.Println("Starting server on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
