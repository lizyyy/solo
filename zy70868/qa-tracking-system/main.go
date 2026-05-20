package main

import (
	"qa-tracking-system/config"
	"qa-tracking-system/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.InitDB(); err != nil {
		panic("failed to connect database: " + err.Error())
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
		batches := api.Group("/batches")
		{
			batches.POST("", handlers.CreateBatch)
			batches.GET("", handlers.ListBatches)
			batches.GET("/:id", handlers.GetBatch)
			batches.PUT("/:id/process", handlers.ProcessBatch)
			batches.PUT("/:id/return", handlers.ReturnBatch)
			batches.PUT("/:id/approve", handlers.ApproveBatch)
			batches.PUT("/:id/reject", handlers.RejectBatch)
			batches.GET("/:id/export", handlers.ExportBatch)
		}

		samples := api.Group("/samples")
		{
			samples.POST("/import", handlers.ImportSamplesCSV)
			samples.GET("", handlers.ListSamples)
			samples.GET("/trace/:sample_id", handlers.TraceSample)
		}

		protocols := api.Group("/protocols")
		{
			protocols.POST("/import", handlers.ImportProtocolJSON)
			protocols.GET("", handlers.ListProtocols)
		}

		chambers := api.Group("/chambers")
		{
			chambers.POST("/import", handlers.ImportChamberRecords)
			chambers.GET("", handlers.ListChamberRecords)
			chambers.GET("/:chamber_id/history", handlers.GetChamberHistory)
		}

		nodes := api.Group("/nodes")
		{
			nodes.GET("", handlers.ListSampleNodes)
			nodes.GET("/:node_id/trace", handlers.TraceSampleNode)
		}

		exceptions := api.Group("/exceptions")
		{
			exceptions.POST("", handlers.CreateException)
			exceptions.GET("", handlers.ListExceptions)
		}

		query := api.Group("/query")
		{
			query.GET("/batch/:batch_no", handlers.QueryByBatchNo)
			query.GET("/chamber/:chamber_id", handlers.QueryByChamber)
			query.GET("/node/:node_id", handlers.QueryBySampleNode)
		}

		export := api.Group("/export")
		{
			export.GET("/query", handlers.ExportQueryResults)
		}
	}

	r.Run(":8080")
}
