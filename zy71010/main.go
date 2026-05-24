package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"vet-vaccine-cold-chain/config"
	"vet-vaccine-cold-chain/database"
	"vet-vaccine-cold-chain/handler"
)

func main() {
	cfg := config.Load()

	if err := database.Init(cfg.DatabasePath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

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
		api.GET("/health", handler.HealthCheck)
		api.GET("/consistency", handler.ConsistencyCheck)

		api.POST("/submissions", handler.SubmitMaterial)
		api.GET("/evaluations", handler.AutoEvaluate)
		api.POST("/manual-process", handler.ManualProcess)
		api.POST("/return-correction", handler.ReturnForCorrection)
		api.POST("/recalculate", handler.Recalculate)
		api.GET("/verify", handler.VerifyResult)

		api.POST("/cold-chain/validate", handler.ValidateColdChainWindow)
		api.GET("/open-vial/:id/status", handler.GetOpenVialStatus)
		api.GET("/transfers/:batch/trail", handler.GetTransferTrail)
		api.POST("/discards/confirm", handler.ConfirmDiscard)

		api.POST("/reports/generate", handler.GenerateReport)
		api.GET("/reports/:id/export", handler.ExportReportCSV)

		api.POST("/refrigerators", handler.CreateRefrigerator)
		api.POST("/vaccines", handler.CreateVaccine)
		api.POST("/inventory", handler.CreateInventory)
		api.POST("/temperature-records", handler.CreateTemperatureRecord)
		api.POST("/open-records", handler.CreateOpenRecord)
		api.POST("/discards", handler.CreateDiscardRecord)
		api.POST("/transfers", handler.CreateTransfer)
		api.POST("/vaccinations", handler.CreateVaccination)
	}

	log.Printf("Server starting on port %s", cfg.ServerPort)
	if err := r.Run(cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
