package main

import (
	"dialysis-recall/database"
	"dialysis-recall/handlers"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	os.MkdirAll("./reports", 0755)

	database.InitDB()
	database.SeedTestData()

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

	h := handlers.NewHandler()

	api := r.Group("/api/v1")
	{
		materials := api.Group("/materials")
		{
			materials.POST("", h.CreateMaterial)
			materials.GET("", h.GetMaterials)
		}

		patients := api.Group("/patients")
		{
			patients.GET("", h.GetPatients)
		}

		shifts := api.Group("/shifts")
		{
			shifts.GET("", h.GetShifts)
		}

		consumptions := api.Group("/consumptions")
		{
			consumptions.POST("", h.CreateConsumption)
			consumptions.GET("", h.GetConsumptions)
		}

		recalls := api.Group("/recalls")
		{
			recalls.POST("", h.CreateRecallNotice)
			recalls.GET("", h.GetRecalls)
			recalls.POST("/:id/trace", h.ExecuteTrace)
			recalls.GET("/:id/results", h.GetTraceResults)
			recalls.GET("/:id/history", h.GetTraceHistory)
			recalls.POST("/:id/withdraw", h.WithdrawRecall)
			recalls.GET("/:id/report", h.DownloadReport)
		}

		trace := api.Group("/trace")
		{
			trace.POST("/:id/override", h.ManualOverride)
			trace.GET("/:id/reviews", h.GetReviewRecords)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "透析耗材召回 API",
			"version": "1.0.0",
		})
	})

	r.Run(":8080")
}
