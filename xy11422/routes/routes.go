package routes

import (
	"used-car-retry-queue/handlers"

	"github.com/gin-gonic/gin"
)

func SetupRouter(handler *handlers.ReceiptHandler) *gin.Engine {
	r := gin.Default()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	api := r.Group("/api/v1")
	{
		api.GET("/health", handler.HealthCheck)

		receipts := api.Group("/receipts")
		{
			receipts.POST("", handler.SubmitReceipt)
			receipts.GET("", handler.ListReceipts)
			receipts.GET("/:id", handler.GetReceipt)
			receipts.GET("/no/:receiptNo", handler.GetReceiptByNo)
			receipts.POST("/:id/manual", handler.ManualProcess)
			receipts.POST("/:id/compensate", handler.Compensate)
			receipts.POST("/:id/close", handler.CloseReceipt)
			receipts.GET("/:id/evidence", handler.GetEvidence)
			receipts.PUT("/:id/standard-data", handler.UpdateStandardData)
		}

		stats := api.Group("/stats")
		{
			stats.GET("/retry-categories", handler.GetRetryStats)
			stats.GET("/dead-letters", handler.GetDeadLetterStats)
		}

		imports := api.Group("/imports")
		{
			imports.POST("/csv", handler.ImportCSV)
			imports.GET("", handler.GetImportHistory)
		}

		queue := api.Group("/queue")
		{
			queue.POST("/trigger", handler.TriggerProcessing)
			queue.POST("/recover", handler.RecoverTasks)
		}
	}

	return r
}
