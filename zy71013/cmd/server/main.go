package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"lab-reagent-api/config"
	"lab-reagent-api/internal/database"
	"lab-reagent-api/internal/handler"
	"lab-reagent-api/internal/service"
)

func main() {
	cfg := config.Load()

	db, err := database.New(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	reagentRepo := database.NewReagentRepo(db.DB())
	usageRepo := database.NewUsageRepo(db.DB())
	orderRepo := database.NewOrderRepo(db.DB())
	judgmentRepo := database.NewJudgmentRepo(db.DB())

	reagentService := service.NewReagentService(cfg, reagentRepo, usageRepo, orderRepo)
	orderService := service.NewOrderService(orderRepo, judgmentRepo, reagentRepo)
	reportService := service.NewReportService(reagentRepo, usageRepo, orderRepo, judgmentRepo)

	h := handler.NewHandler(reagentService, orderService, reportService)

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		reagents := api.Group("/reagents")
		{
			reagents.POST("/thaw", h.ThawReagent)
			reagents.POST("/use", h.UseReagent)
			reagents.POST("/discard", h.DiscardReagent)
			reagents.GET("", h.ListReagents)
			reagents.GET("/:batchNo", h.GetReagent)
			reagents.GET("/:batchNo/projects", h.GetSharedProjects)
		}

		orders := api.Group("/orders")
		{
			orders.POST("", h.CreateOrder)
			orders.POST("/judgment", h.ProcessJudgment)
			orders.POST("/supplement", h.ProcessSupplement)
			orders.GET("", h.ListOrders)
			orders.GET("/:orderNo", h.GetOrder)
		}

		reports := api.Group("/reports")
		{
			reports.GET("/export/json", h.ExportReportJSON)
			reports.GET("/export/csv", h.ExportReportCSV)
		}
	}

	log.Printf("Server starting on port %s", cfg.ServerPort)
	log.Printf("Thaw window: %d hours", cfg.ThawWindowHours)
	if err := r.Run(cfg.ServerPort); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
