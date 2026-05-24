package main

import (
	"compliance-exemption-api/internal/config"
	"compliance-exemption-api/internal/handler"
	"compliance-exemption-api/internal/repository"
	"compliance-exemption-api/internal/service"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := repository.NewDatabase(cfg.Database.Path)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}

	exemptionRepo := repository.NewExemptionRepository(db.DB)
	sampleRepo := repository.NewSampleRepository(db.DB)
	approvalLogRepo := repository.NewApprovalLogRepository(db.DB)
	operationLogRepo := repository.NewOperationLogRepository(db.DB)

	exemptionService := service.NewExemptionService(
		exemptionRepo,
		sampleRepo,
		approvalLogRepo,
		operationLogRepo,
		cfg.Storage.UploadPath,
	)

	reportService := service.NewReportService(exemptionRepo, cfg.Storage.ReportPath)

	exemptionHandler := handler.NewExemptionHandler(exemptionService, reportService)

	gin.SetMode(cfg.Server.Mode)
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

	api := r.Group("/api")
	{
		api.GET("/health", exemptionHandler.HealthCheck)

		exemptions := api.Group("/exemptions")
		{
			exemptions.POST("", exemptionHandler.CreateExemption)
			exemptions.GET("", exemptionHandler.QueryExemptions)
			exemptions.GET("/:id", exemptionHandler.GetExemption)
			exemptions.PUT("/:id/approve", exemptionHandler.ApproveExemption)
			exemptions.POST("/:id/samples", exemptionHandler.UploadSample)
		}

		api.GET("/rules/match", exemptionHandler.CheckRuleMatch)

		api.POST("/expired/check", exemptionHandler.CheckExpired)

		api.GET("/statistics", exemptionHandler.GetStatistics)

		api.GET("/reports/export", exemptionHandler.ExportReport)

		api.GET("/samples/download", exemptionHandler.DownloadSample)
	}

	log.Printf("Server starting on port %s...", cfg.Server.Port)
	log.Printf("Database path: %s", cfg.Database.Path)
	log.Printf("Upload path: %s", cfg.Storage.UploadPath)
	log.Printf("Report path: %s", cfg.Storage.ReportPath)

	if err := r.Run(":" + cfg.Server.Port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
