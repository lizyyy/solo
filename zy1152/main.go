package main

import (
	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/handler"
	"cache-risk-analyzer/internal/middleware"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./cache_risk.db"
	}

	if err := db.InitDB(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.CloseDB()

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := gin.Default()
	r.Use(middleware.AuditMiddleware())

	api := r.Group("/api/v1")
	{
		importGroup := api.Group("/import")
		{
			importGroup.POST("/cache-events", handler.ImportCacheEvents)
			importGroup.POST("/keys", handler.ImportKeys)
			importGroup.POST("/backend-metrics", handler.ImportBackendMetrics)
			importGroup.POST("/traffic-plan", handler.ImportTrafficPlan)
			importGroup.POST("/strategy", handler.ImportStrategy)
		}

		analysisGroup := api.Group("/analysis")
		{
			analysisGroup.GET("/risks", handler.AnalyzeRisks)
			analysisGroup.GET("/risks/:id", handler.GetRiskDetails)
		}

		simulationGroup := api.Group("/simulation")
		{
			simulationGroup.POST("/run", handler.RunSimulation)
			simulationGroup.GET("/results/:id", handler.GetSimulationResult)
			simulationGroup.POST("/compare", handler.CompareStrategies)
		}

		reportGroup := api.Group("/report")
		{
			reportGroup.GET("/json", handler.ExportReportJSON)
			reportGroup.GET("/csv", handler.ExportReportCSV)
			reportGroup.GET("/markdown", handler.ExportReportMarkdown)
		}

		queryGroup := api.Group("/query")
		{
			queryGroup.GET("/events", handler.QueryEvents)
			queryGroup.GET("/keys", handler.QueryKeys)
			queryGroup.GET("/backend-metrics", handler.QueryBackendMetrics)
			queryGroup.GET("/audits", handler.QueryAudits)
		}

		configGroup := api.Group("/config")
		{
			configGroup.GET("/thresholds", handler.GetThresholds)
			configGroup.PUT("/thresholds", handler.UpdateThresholds)
			configGroup.POST("/reload", handler.ReloadConfig)
		}
	}

	log.Printf("Server starting on port %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
