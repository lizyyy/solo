package main

import (
	"fuel-subsidy-api/internal/config"
	"fuel-subsidy-api/internal/dao"
	"fuel-subsidy-api/internal/handler"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if err := dao.InitDB(cfg); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Operator")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	appHandler := handler.NewApplicationHandler(cfg)

	api := r.Group("/api/v1")
	{
		api.POST("/applications", appHandler.CreateApplication)
		api.GET("/applications", appHandler.QueryApplications)
		api.GET("/applications/:id", appHandler.GetApplication)
		api.GET("/applications/:id/logs", appHandler.GetAuditLogs)
		api.POST("/applications/:id/recalculate", appHandler.RecalculateSubsidy)

		api.POST("/applications/verify", appHandler.VerifyApplication)
		api.POST("/applications/process", appHandler.ProcessApplication)
		api.POST("/applications/review", appHandler.ReviewApplication)
		api.POST("/applications/close", appHandler.CloseApplication)

		api.GET("/statistics", appHandler.GetStatistics)
		api.GET("/reports/export", appHandler.ExportReport)

		api.POST("/fuel-receipts", appHandler.AddFuelReceipt)
		api.GET("/fuel-receipts", appHandler.ListFuelReceipts)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "fuel-subsidy-api",
		})
	})

	log.Printf("Server starting on port %s...", cfg.ServerPort)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
