package main

import (
	"log"
	"os"

	"client-capability-negotiation/internal/handler"
	"client-capability-negotiation/internal/service"
	"client-capability-negotiation/internal/storage"
	"github.com/gin-gonic/gin"
)

func main() {
	dbPath := "./negotiation.db"
	if envDB := os.Getenv("DB_PATH"); envDB != "" {
		dbPath = envDB
	}

	storage, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	log.Println("Storage initialized successfully")

	svc := service.NewNegotiationService(storage)
	log.Println("Service initialized successfully")

	h := handler.NewHandler(svc)

	r := gin.Default()

	r.Static("/static", "./static")
	r.LoadHTMLFiles("./static/index.html")
	r.GET("/", func(c *gin.Context) {
		c.HTML(200, "index.html", nil)
	})

	h.RegisterRoutes(r)

	port := ":8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = ":" + envPort
	}

	log.Printf("Server starting on port %s...", port)
	log.Printf("Management UI available at: http://localhost%s/", port)
	log.Printf("API documentation available at: http://localhost%s/api/v1/health", port)

	if err := r.Run(port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
