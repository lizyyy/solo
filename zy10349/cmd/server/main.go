package main

import (
	"flag"
	"log"
	"read-write-split-api/internal/handler"
	"read-write-split-api/internal/middleware"
	"read-write-split-api/internal/service"
	"read-write-split-api/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	dbPath := flag.String("db", "split_api.db", "SQLite database file path")
	port := flag.String("port", "8080", "Server port")
	flag.Parse()

	store, err := storage.NewSQLiteStorage(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	svc := service.NewSplitService(store)
	h := handler.NewHandler(svc)

	gin.SetMode(gin.ReleaseMode)
	r := gin.New()

	r.Use(middleware.Logger())
	r.Use(middleware.CORS())
	r.Use(middleware.Recovery())

	h.SetupRoutes(r)

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "read-write-split-api",
		})
	})

	log.Printf("Server starting on port %s...", *port)
	if err := r.Run(":" + *port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
