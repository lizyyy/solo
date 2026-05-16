package main

import (
	"grayscale-backfill/internal/config"
	"grayscale-backfill/internal/handler"
	"grayscale-backfill/internal/repository"
	"grayscale-backfill/internal/service"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.DefaultConfig()

	db, err := config.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	repo := repository.NewRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

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
		api.GET("/health", h.HealthCheck)

		batches := api.Group("/batches")
		{
			batches.POST("", h.CreateBatch)
		}

		windows := api.Group("/windows")
		{
			windows.POST("", h.CreateWindow)
		}

		backfills := api.Group("/backfills")
		{
			backfills.POST("", h.CreateBackfillTask)
			backfills.GET("", h.ListBackfillTasks)
			backfills.GET("/:id", h.GetBackfillTask)

			backfills.POST("/:id/submit", h.SubmitForReview)
			backfills.POST("/:id/approve", h.ApproveTask)
			backfills.POST("/:id/reject", h.RejectTask)
			backfills.POST("/:id/start", h.StartProcessing)
			backfills.POST("/:id/complete", h.CompleteTask)
			backfills.POST("/:id/fail", h.FailTask)
			backfills.POST("/:id/cancel", h.CancelTask)
			backfills.POST("/:id/correct", h.ManualCorrect)

			backfills.GET("/:id/export", h.ExportTask)
			backfills.POST("/:id/snapshots", h.CreateSnapshot)
		}

		api.GET("/status-transitions", h.GetStatusTransitions)
	}

	log.Printf("Server starting on port %s", cfg.ServerPort)
	log.Printf("Database path: %s", cfg.DBPath)

	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
