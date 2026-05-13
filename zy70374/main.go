package main

import (
	"github.com/gin-gonic/gin"

	"strategy-explainer/handlers"
)

func main() {
	r := gin.Default()

	r.GET("/health", handlers.Health)

	strategy := r.Group("/strategies")
	{
		strategy.GET("", handlers.ListStrategies)
		strategy.POST("", handlers.CreateStrategy)
		strategy.GET("/:id", handlers.GetStrategy)
		strategy.PUT("/:id", handlers.UpdateStrategy)
		strategy.POST("/:id/publish", handlers.PublishStrategy)
		strategy.POST("/:id/freeze", handlers.FreezeStrategy)
		strategy.POST("/:id/rollback", handlers.RollbackStrategy)
	}

	r.POST("/decide", handlers.Decide)
	r.GET("/decisions", handlers.QueryDecision)

	r.Run(":8080")
}
