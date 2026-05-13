package api

import (
	"strategy-hotload-api/internal/handler"
	"strategy-hotload-api/internal/service"
	"strategy-hotload-api/internal/store"

	"github.com/gin-gonic/gin"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()
	r.Use(gin.Recovery())
	s := store.NewMemoryStore()
	svc := service.NewStrategyService(s)
	h := handler.NewHandler(svc)
	api := r.Group("/api/v1")
	{
		api.GET("/health", h.Health)
		packages := api.Group("/packages")
		{
			packages.POST("", h.CreatePackage)
			packages.GET("", h.ListPackages)
			packages.GET("/:id", h.GetPackage)
		}
		versions := api.Group("/versions")
		{
			versions.POST("", h.CreateRuleVersion)
			versions.GET("", h.ListRuleVersions)
			versions.GET("/:id", h.GetRuleVersion)
			versions.POST("/:id/status", h.UpdateStatus)
			versions.POST("/:id/rollback", h.Rollback)
			versions.POST("/:id/revoke", h.Revoke)
		}
		hit := api.Group("/hit")
		{
			hit.POST("", h.HitCheck)
			hit.GET("/requests", h.ListHitRequests)
		}
		audit := api.Group("/audit")
		{
			audit.GET("/logs", h.ListAuditLogs)
		}
		api.GET("/export", h.Export)
	}
	return r
}
