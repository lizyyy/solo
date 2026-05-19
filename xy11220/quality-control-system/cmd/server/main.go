package main

import (
	"fmt"
	"log"

	"github.com/gin-gonic/gin"

	"quality-control-system/internal/config"
	"quality-control-system/internal/handler"
	"quality-control-system/internal/middleware"
	"quality-control-system/internal/repository"
)

func main() {
	cfg, err := config.Load("config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := repository.InitDB(&cfg.Database); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}
	defer repository.CloseDB()

	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	r := gin.Default()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	maskingMiddleware := middleware.NewMaskingMiddleware()
	r.Use(maskingMiddleware.MaskResponse())

	h := handler.NewHandler(cfg)

	api := r.Group("/api/v1")
	{
		samples := api.Group("/samples")
		{
			samples.POST("", h.CreateSample)
			samples.GET("/:sample_no", h.GetSample)
			samples.GET("", h.ListSamples)
			samples.POST("/destroy", h.DestroySample)
		}

		temperature := api.Group("/temperature")
		{
			temperature.POST("", h.CreateTemperature)
			temperature.GET("/:record_no", h.GetTemperature)
			temperature.GET("", h.ListTemperatures)
			temperature.GET("/check-gap", h.CheckTemperatureGap)
		}

		waste := api.Group("/waste")
		{
			waste.POST("", h.CreateWaste)
			waste.GET("/:waste_no", h.GetWaste)
			waste.GET("", h.ListWastes)
		}

		reports := api.Group("/reports")
		{
			reports.GET("/daily", h.GetDailyReport)
			reports.GET("/daily/export", h.ExportDailyReport)
			reports.GET("/batch/:dish_batch", h.GetBatchSummary)
		}

		reminders := api.Group("/reminders")
		{
			reminders.GET("", h.GetReminders)
			reminders.POST("/acknowledge", h.AcknowledgeReminder)
		}

		rules := api.Group("/rules")
		{
			rules.POST("/check-expired", h.CheckExpiredSamples)
			rules.GET("/logs", h.GetRuleExecutionLogs)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
		})
	})

	log.Printf("Server starting on port %d...", cfg.Server.Port)
	if err := r.Run(fmt.Sprintf(":%d", cfg.Server.Port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
