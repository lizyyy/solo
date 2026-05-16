package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"device-evidence-api/database"
	"device-evidence-api/handler"
)

func main() {
	if err := database.InitDB("./device-evidence.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Idempotent-Key")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handler := handler.NewEvidenceHandler()

	api := r.Group("/api/v1")
	{
		api.POST("/evidences", handler.CreateEvidence)
		api.GET("/evidences/:id", handler.GetEvidence)
		api.POST("/evidences/query", handler.QueryEvidences)
		api.PUT("/evidences/:id/status", handler.UpdateStatus)
		api.PUT("/evidences/:id/correct", handler.ManualCorrection)
		api.GET("/evidences/export", handler.ExportEvidences)
		api.GET("/evidences/:id/report", handler.GenerateReport)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"service": "device-evidence-api",
		})
	})

	log.Println("Server starting on :8099...")
	if err := r.Run(":8099"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
