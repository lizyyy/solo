package main

import (
	"fmt"
	"log"
	"time"

	"gpu-queue-api/handler"
	"gpu-queue-api/service"
	"gpu-queue-api/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	store, err := storage.NewSQLiteStore("./gpu_queue.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	queueService := service.NewQueueService(store)
	h := handler.NewHandler(queueService)

	go startTimeoutChecker(queueService)

	r := gin.Default()

	r.Use(CORS())

	api := r.Group("/api/v1")
	{
		api.GET("/health", h.HealthCheck)

		jobs := api.Group("/jobs")
		{
			jobs.POST("", h.CreateJob)
			jobs.GET("", h.ListJobs)
			jobs.GET("/:id", h.GetJob)
			jobs.PUT("/:id/status", h.UpdateJobStatus)
		}

		api.GET("/gpu-resources", h.GetGPUResources)
		api.PUT("/gpu-resources/correction", h.ManualCorrection)

		api.GET("/queue-summary", h.GetQueueSummary)
		api.GET("/release-events", h.GetReleaseEvents)
		api.GET("/exception-logs", h.GetExceptionLogs)

		api.GET("/report/export", h.ExportReport)
	}

	fmt.Println("GPU Queue API Server starting on :8080")
	fmt.Println("API Base URL: http://localhost:8080/api/v1")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func startTimeoutChecker(svc *service.QueueService) {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for range ticker.C {
		if err := svc.CheckTimeoutJobs(); err != nil {
			log.Printf("Error checking timeout jobs: %v", err)
		}
	}
}

func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	}
}
