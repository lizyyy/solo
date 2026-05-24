package main

import (
	"log"

	"irrigation-water-rights/internal/config"
	"irrigation-water-rights/internal/handler"
	"irrigation-water-rights/internal/repository"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.LoadConfig()

	db, err := config.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	repo := repository.NewRepository(db)
	if err := repo.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	h := handler.NewHandler(repo)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Content-Type", "application/json")
		c.Next()
	})

	api := r.Group("/api/v1")
	{
		farmers := api.Group("/farmers")
		{
			farmers.POST("", h.CreateFarmer)
			farmers.GET("", h.ListFarmers)
			farmers.GET("/:id", h.GetFarmer)
			farmers.GET("/:id/balance", h.GetFarmerBalance)
		}

		plots := api.Group("/plots")
		{
			plots.POST("", h.CreatePlot)
		}

		waterRights := api.Group("/water-rights")
		{
			waterRights.POST("", h.CreateWaterRight)
			waterRights.GET("", h.GetWaterRight)
		}

		transfers := api.Group("/transfers")
		{
			transfers.POST("", h.CreateTransfer)
			transfers.GET("", h.ListTransfers)
			transfers.GET("/:id", h.GetTransfer)
			transfers.POST("/:id/approve", h.ApproveTransfer)
			transfers.POST("/:id/revoke", h.RevokeTransfer)
		}

		irrigation := api.Group("/irrigation")
		{
			irrigation.POST("", h.RecordIrrigation)
			irrigation.GET("", h.ListIrrigations)
			irrigation.GET("/:record_no", h.GetIrrigation)
			irrigation.POST("/:record_no/evidence", h.UpdateIrrigationEvidence)
		}

		reports := api.Group("/reports")
		{
			reports.POST("/generate", h.GenerateReport)
		}

		api.GET("/self-check", h.SelfCheck)
		api.GET("/change-history", h.GetChangeHistory)
	}

	log.Printf("Server starting on port %s...", cfg.ServerPort)
	log.Printf("Database: %s", cfg.DBPath)
	if err := r.Run(":" + cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
