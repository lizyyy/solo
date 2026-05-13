package main

import (
	"sampling-rule-api/internal/handler"
	"sampling-rule-api/internal/repository"
	"sampling-rule-api/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	err := repository.InitDatabase()
	if err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	service.StartBackgroundJobs()

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		api.POST("/rules", handler.CreateRule)
		api.GET("/rules", handler.GetAllRules)
		api.GET("/rules/:id", handler.GetRule)
		api.POST("/rules/:id/activate", handler.ActivateRule)
		api.POST("/rules/status", handler.UpdateRuleStatus)
		api.POST("/rules/validate", handler.ValidateRule)
		api.GET("/rules/:id/hits", handler.GetHitRecords)
		api.GET("/rules/:id/history", handler.GetHistoryRecords)
	}

	r.Run(":8080")
}
