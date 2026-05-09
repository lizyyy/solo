package main

import (
	"log"

	"fundservice/internal/api"
	"fundservice/internal/db"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := db.Init("./data/funds.db"); err != nil {
		log.Fatalf("failed to initialize database: %v", err)
	}
	defer db.Close()

	r := gin.Default()

	handler := api.NewHandler()

	apiGroup := r.Group("/api/v1")

	accounts := apiGroup.Group("/accounts")
	{
		accounts.POST("", handler.CreateAccount)
		accounts.GET("/tree", handler.GetAccountTree)
		accounts.GET("/balance", handler.GetAccountBalance)
		accounts.GET("/transactions", handler.GetAccountTransactions)
		accounts.POST("/balance", handler.SetInitialBalance)
	}

	tasks := apiGroup.Group("/tasks")
	{
		tasks.POST("", handler.CreateAggregationTask)
		tasks.POST("/:id/execute", handler.ExecuteTask)
		tasks.GET("", handler.GetTasks)
		tasks.POST("/retry", handler.RetryFailedTasks)
	}

	reconciliation := apiGroup.Group("/reconciliation")
	{
		reconciliation.POST("/run", handler.PerformReconciliation)
	}

	reports := apiGroup.Group("/reports")
	{
		reports.GET("/daily", handler.GetDailyReport)
		reports.GET("/range", handler.GetDailyReportRange)
	}

	discrepancies := apiGroup.Group("/discrepancies")
	{
		discrepancies.GET("/pending", handler.GetPendingDiscrepancies)
		discrepancies.POST("/resolve", handler.ResolveDiscrepancy)
	}

	apiGroup.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok", "service": "funds-collection-reconciliation"})
	})

	log.Println("Funds Collection Reconciliation Service starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("failed to start server: %v", err)
	}
}
