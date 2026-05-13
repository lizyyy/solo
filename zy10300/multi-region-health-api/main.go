package main

import (
	"log"
	"multi-region-health-api/db"
	"multi-region-health-api/handlers"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := db.Init(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	r := gin.Default()

	handler := handlers.NewHandler()

	r.GET("/health", handler.HealthCheck)

	api := r.Group("/api/v1")
	{
		api.POST("/regions", handler.CreateRegion)
		api.GET("/regions", handler.ListRegions)
		api.GET("/regions/:region_id/summary", handler.GetRegionSummary)

		api.POST("/services", handler.CreateService)
		api.GET("/services", handler.ListServices)
		api.GET("/services/:service_id", handler.GetService)

		api.POST("/services/:service_id/probes", handler.SubmitProbe)
		api.GET("/services/:service_id/probes/history", handler.GetProbeHistory)

		api.POST("/services/:service_id/degrade/transition", handler.TransitionDegrade)
		api.GET("/services/:service_id/degrade/history", handler.GetDegradeHistory)

		api.POST("/services/:service_id/recovery/confirm", handler.ConfirmRecovery)

		api.POST("/services/:service_id/dependencies", handler.CreateDependency)
		api.GET("/services/:service_id/dependencies", handler.GetDependencies)
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
