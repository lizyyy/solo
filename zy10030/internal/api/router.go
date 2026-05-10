package api

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

func SetupRouter(handler *Handler) *gin.Engine {
	router := gin.New()
	router.Use(gin.Recovery())
	router.Use(gin.Logger())
	router.Use(corsMiddleware())
	router.Use(requestIDMiddleware())

	api := router.Group("/api/v1")

	api.GET("/health", handler.HealthCheck)

	releases := api.Group("/releases")
	{
		releases.POST("", handler.CreateRelease)
		releases.GET("", handler.ListReleases)
		releases.GET("/:id", handler.GetRelease)
		releases.POST("/:id/start", handler.StartRelease)
		releases.POST("/:id/pause", handler.PauseRelease)
		releases.POST("/:id/complete", handler.CompleteRelease)
		releases.POST("/:id/instances", handler.AddInstance)
		releases.POST("/:id/rollback", handler.TriggerRollback)
	}

	rollbacks := api.Group("/rollbacks")
	{
		rollbacks.GET("", handler.ListRollbacks)
		rollbacks.GET("/:id", handler.GetRollback)
		rollbacks.GET("/:id/steps", handler.GetRollbackSteps)
	}

	faults := api.Group("/faults")
	{
		faults.POST("", handler.CreateFaultConfig)
		faults.GET("", handler.ListFaultConfigs)
		faults.PUT("/:id", handler.UpdateFaultConfig)
		faults.GET("/simulate", handler.SimulateFaultRequest)
	}

	api.POST("/duplicate-consumption/simulate", handler.SimulateDuplicateConsumption)

	traces := api.Group("/traces")
	{
		traces.GET("", handler.SearchTraces)
		traces.GET("/errors", handler.GetErrorTraces)
		traces.GET("/:id", handler.GetTrace)
		traces.GET("/:id/analyze", handler.AnalyzeTrace)
	}

	reports := api.Group("/reports")
	{
		reports.POST("", handler.CreateReport)
		reports.GET("", handler.ListReports)
		reports.GET("/:id", handler.GetReport)
		reports.POST("/:id/export", handler.ExportReport)
		reports.POST("/:id/resolve", handler.ResolveReport)
	}

	api.GET("/dedup-records", handler.GetDedupRecords)

	return router
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")
		c.Writer.Header().Set("Access-Control-Expose-Headers", "X-Request-ID")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusOK)
			return
		}

		c.Next()
	}
}

func requestIDMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}

		c.Set("request_id", requestID)
		c.Writer.Header().Set("X-Request-ID", requestID)

		c.Next()
	}
}

func generateRequestID() string {
	return "req-" + time.Now().Format("20060102150405")
}
