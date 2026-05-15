package main

import (
	"callback-whitelist-api/internal/handler"
	"callback-whitelist-api/internal/service"
	"callback-whitelist-api/internal/storage"

	"github.com/gin-gonic/gin"
)

func main() {
	store := storage.NewStorage()
	svc := service.NewService(store)
	h := handler.NewHandler(svc)

	r := gin.Default()

	r.StaticFile("/", "./web/index.html")
	r.Static("/web", "./web")

	api := r.Group("/api/v1")
	{
		parties := api.Group("/parties")
		{
			parties.POST("", h.CreateParty)
			parties.GET("/:id", h.GetParty)
			parties.POST("/sources", h.AddSourceAddress)
		}

		rules := api.Group("/rules")
		{
			rules.POST("", h.CreateRule)
			rules.GET("/:id", h.GetRule)
			rules.GET("", h.GetRulesByParty)
			rules.PUT("/:id/status", h.UpdateRuleStatus)
			rules.GET("/:id/versions", h.GetRuleVersions)
		}

		verify := api.Group("/verify")
		{
			verify.POST("", h.VerifyCallback)
		}

		rejections := api.Group("/rejections")
		{
			rejections.GET("", h.GetRejections)
		}
	}

	r.Run(":8080")
}
