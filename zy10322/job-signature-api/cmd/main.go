package main

import (
	"job-signature-api/internal/dal"
	"job-signature-api/internal/handler"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := dal.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	api := r.Group("/api/v1")
	{
		api.GET("/health", handler.Health)

		batches := api.Group("/batches")
		{
			batches.POST("", handler.CreateBatch)
			batches.GET("", handler.ListBatches)
			batches.GET("/:batchId", handler.GetBatchStatus)
			batches.POST("/:batchId/sign", handler.SignBatch)
			batches.POST("/:batchId/verify", handler.VerifyBatch)
			batches.POST("/:batchId/revoke", handler.RevokeBatch)
			batches.GET("/:batchId/history", handler.GetVerifyHistory)
		}

		consumers := api.Group("/consumers")
		{
			consumers.POST("", handler.CreateConsumer)
		}
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
