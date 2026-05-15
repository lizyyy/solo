package main

import (
	"auth-simulator-api/internal/handler"
	"auth-simulator-api/internal/service"
	"auth-simulator-api/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	storage := storage.NewMemoryStorage()
	service := service.NewSimulationService(storage)
	handler := handler.NewSimulationHandler(service)

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		sim := api.Group("/simulations")
		{
			sim.POST("", handler.CreateSimulation)
			sim.POST("/validate", handler.ValidateSimulation)
			sim.POST("/activate", handler.ActivateSimulation)
			sim.GET("/history", handler.QueryHistory)
			sim.GET("/:id", handler.GetSimulation)
			sim.GET("/:id/export", handler.ExportSimulation)
		}
	}

	r.Run(":8080")
}
