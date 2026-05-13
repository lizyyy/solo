package main

import (
	"fmt"
	"log"

	"third-party-api-circuit-breaker/config"
	"third-party-api-circuit-breaker/handlers"
	"third-party-api-circuit-breaker/utils"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := config.LoadConfig(); err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if err := utils.InitDatabase(); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}

	gin.SetMode(config.AppConfig.Server.Mode)
	r := gin.Default()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	h := handlers.NewHandler()

	r.GET("/health", h.HealthCheck)

	api := r.Group("/api/v1")
	{
		api.POST("/external-apis", h.CreateExternalAPI)
		api.GET("/external-apis", h.ListExternalAPIs)

		api.POST("/business-callers", h.CreateBusinessCaller)
		api.GET("/business-callers", h.ListBusinessCallers)

		api.POST("/circuit/check", h.CheckCircuit)
		api.POST("/circuit/record", h.RecordCall)
		api.POST("/circuit/reset", h.ManualReset)
		api.POST("/circuit/force-open", h.ForceOpen)

		api.GET("/circuit-breakers", h.ListCircuitBreakers)
		api.GET("/circuit-breakers/:id", h.GetCircuitBreaker)
		api.GET("/circuit-breakers/:id/history", h.GetHistory)
	}

	addr := fmt.Sprintf(":%d", config.AppConfig.Server.Port)
	log.Printf("Server starting on %s", addr)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
