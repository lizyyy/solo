package main

import (
	"log"
	"runtime-guardrail/database"
	"runtime-guardrail/handlers"
	"runtime-guardrail/services"
	"time"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
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
		api.GET("/health", handlers.HealthCheck)

		changeRequests := api.Group("/change-requests")
		{
			changeRequests.POST("", handlers.CreateChangeRequest)
			changeRequests.POST("/validate", handlers.ValidateChangeRequest)
			changeRequests.POST("/approve", handlers.ApproveChangeRequest)
			changeRequests.POST("/activate", handlers.ActivateChangeRequest)
			changeRequests.POST("/rollback", handlers.RollbackChangeRequest)
			changeRequests.POST("/reject", handlers.RejectChangeRequest)
			changeRequests.GET("", handlers.ListChangeRequests)
			changeRequests.GET("/:id", handlers.GetChangeRequest)
			changeRequests.GET("/:id/audit-logs", handlers.GetAuditLogs)
			changeRequests.GET("/:id/rollback-records", handlers.GetRollbackRecords)
		}

		api.POST("/auto-rollback/trigger", handlers.TriggerAutoRollback)
		api.POST("/validate", handlers.ValidateValue)

		services := api.Group("/services")
		{
			services.POST("", handlers.CreateCallingService)
		}

		parameters := api.Group("/parameters")
		{
			parameters.POST("", handlers.CreateParameterItem)
			parameters.POST("/allowed-ranges", handlers.CreateAllowedRange)
		}

		api.GET("/effective-results", handlers.GetEffectiveResults)
	}

	go func() {
		ticker := time.NewTicker(1 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := database.DB.Exec("SELECT 1").Error; err != nil {
				log.Printf("Database health check failed: %v", err)
			}
		}
	}()

	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()

		for range ticker.C {
			if err := services.CheckAndExecuteAutoRollback(); err != nil {
				log.Printf("Auto rollback check failed: %v", err)
			}
		}
	}()

	log.Println("Starting Runtime Guardrail API server on :8083...")
	if err := r.Run(":8083"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
