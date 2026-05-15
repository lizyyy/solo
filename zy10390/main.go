package main

import (
	"db-pool-protect-api/internal/handler"
	"db-pool-protect-api/internal/service"
	"db-pool-protect-api/internal/store"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/gin-gonic/gin"
)

func main() {
	dataStore := store.NewMemoryStore()
	dataStore.LoadFromFile("data.json")

	protectService := service.NewProtectService(dataStore)
	apiHandler := handler.NewAPIHandler(protectService)

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		rules := api.Group("/rules")
		{
			rules.POST("", apiHandler.CreateRule)
			rules.GET("", apiHandler.ListRules)
			rules.GET("/:id", apiHandler.GetRule)
			rules.PUT("/:id/status", apiHandler.UpdateRuleStatus)
			rules.DELETE("/:id", apiHandler.DeleteRule)
		}

		stats := api.Group("/stats")
		{
			stats.POST("/connection", apiHandler.RecordConnection)
			stats.POST("/slow-query", apiHandler.RecordSlowQuery)
			stats.GET("/overview", apiHandler.GetOverview)
		}

		protection := api.Group("/protection")
		{
			protection.POST("/trigger", apiHandler.TriggerProtection)
			protection.POST("/restore", apiHandler.ConfirmRestore)
		}

		api.GET("/history", apiHandler.ListHistory)
		api.GET("/export", apiHandler.ExportReport)
	}

	go func() {
		if err := r.Run(":8080"); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	log.Println("Server started on :8080")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down...")
	dataStore.SaveToFile("data.json")
	log.Println("Data saved. Bye!")
}
