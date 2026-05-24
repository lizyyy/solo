package main

import (
	"log"

	"fireworks-humidity-api/internal/database"
	"fireworks-humidity-api/internal/handlers"
	"fireworks-humidity-api/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	db, err := database.NewDB("fireworks.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.InitSchema(); err != nil {
		log.Fatalf("Failed to init schema: %v", err)
	}

	if err := database.SeedInitialData(db); err != nil {
		log.Fatalf("Failed to seed data: %v", err)
	}

	repo := database.NewRepository(db)
	svc := service.NewService(repo)
	h := handlers.NewHandler(svc)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Content-Type", "application/json; charset=utf-8")
		c.Next()
	})

	r.GET("/health", h.HealthCheck)

	api := r.Group("/api/v1")
	{
		api.GET("/areas", h.GetAreas)
		api.GET("/areas/:area_code/batches", h.GetAreaBatches)

		api.POST("/samples", h.CreateSample)
		api.GET("/samples/:id", h.GetSample)

		api.POST("/ventilations/start", h.StartVentilation)
		api.POST("/ventilations/complete", h.CompleteVentilation)

		api.POST("/transfers", h.CreateTransfer)
		api.POST("/transfers/undo", h.UndoTransfer)
		api.GET("/transfers/:id", h.GetTransfer)

		api.POST("/inspections", h.CreateInspection)

		api.POST("/reviews", h.Review)
		api.GET("/reviews/pending", h.GetPendingReviews)

		api.GET("/batches/:batch_no", h.GetBatch)
		api.GET("/batches/:batch_no/trace", h.GetBatchTrace)

		api.POST("/reports", h.GenerateReport)
		api.GET("/reports/:report_no/export", h.ExportReport)
	}

	log.Println("Server starting on :8080...")
	log.Println("API Documentation:")
	log.Println("  GET  /health - Health check")
	log.Println("  GET  /api/v1/areas - List warehouse areas")
	log.Println("  POST /api/v1/samples - Create humidity sample")
	log.Println("  POST /api/v1/ventilations/start - Start ventilation")
	log.Println("  POST /api/v1/ventilations/complete - Complete ventilation")
	log.Println("  POST /api/v1/transfers - Create transfer record")
	log.Println("  POST /api/v1/transfers/undo - Undo transfer record")
	log.Println("  POST /api/v1/inspections - Create inspection record")
	log.Println("  POST /api/v1/reviews - Review record")
	log.Println("  GET  /api/v1/reviews/pending - List pending reviews")
	log.Println("  GET  /api/v1/batches/:batch_no/trace - Get batch trace")
	log.Println("  POST /api/v1/reports - Generate risk report")
	log.Println("  GET  /api/v1/reports/:report_no/export - Export report")

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
