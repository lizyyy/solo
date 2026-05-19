package main

import (
	"customs-reconciliation/config"
	"customs-reconciliation/internal/controllers"

	"github.com/gin-gonic/gin"
)

func main() {
	config.InitDB()

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

	batchController := controllers.NewBatchController()
	importController := controllers.NewImportController()
	reviewController := controllers.NewReviewController()
	reportController := controllers.NewReportController()

	api := r.Group("/api")
	{
		batches := api.Group("/batches")
		{
			batches.POST("", batchController.CreateBatch)
			batches.GET("", batchController.ListBatches)
			batches.GET("/:id", batchController.GetBatch)
			batches.POST("/:id/process", batchController.ProcessBatch)
			batches.GET("/:id/items", batchController.GetBatchItems)
			batches.GET("/:id/discrepancies", batchController.GetBatchDiscrepancies)
			batches.GET("/:id/summary/category", batchController.GetCategorySummary)
			batches.GET("/:id/summary/currency", batchController.GetCurrencySummary)
			batches.POST("/:id/complete", reviewController.CompleteBatchReview)
			batches.POST("/:id/import/declarations", importController.ImportDeclarationCSV)
			batches.POST("/:id/import/tariffs", importController.ImportTariffJSON)
			batches.POST("/:id/import/return-receipts", importController.ImportReturnReceiptJSON)
		}

		items := api.Group("/items")
		{
			items.POST("/review", reviewController.ReviewItem)
			items.GET("/:id/review-history", reviewController.GetItemReviewHistory)
			items.GET("/:id/trace", reviewController.GetItemFullTrace)
		}

		reports := api.Group("/reports")
		{
			reports.POST("", reportController.GenerateReport)
			reports.GET("/batch/:id", reportController.GetBatchReports)
			reports.GET("/:id/download", reportController.DownloadReport)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	r.Run(":8080")
}
