package api

import (
	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
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

	handler := NewHandler()

	api := r.Group("/api/v1")
	{
		arbitration := api.Group("/arbitration")
		{
			arbitration.POST("", handler.CreateArbitration)
			arbitration.POST("/block", handler.BlockArbitration)
			arbitration.POST("/release", handler.ReleaseArbitration)
			arbitration.POST("/supplement", handler.SupplementArbitration)
			arbitration.POST("/close", handler.CloseArbitration)
			arbitration.GET("/:id", handler.GetArbitrationDetail)
			arbitration.GET("", handler.ListArbitrations)
		}

		appeal := api.Group("/appeal")
		{
			appeal.POST("/submit", handler.SubmitAppeal)
			appeal.POST("/handle", handler.HandleAppeal)
		}

		export := api.Group("/export")
		{
			export.GET("/json", handler.ExportJSON)
			export.GET("/csv", handler.ExportCSV)
			export.GET("/damage/:id/csv", handler.ExportDamageCSV)
			export.GET("/logs/:id/csv", handler.ExportLogsCSV)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	return r
}
