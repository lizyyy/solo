package router

import (
	"github.com/gin-gonic/gin"
	"print-proof-api/internal/handler"
)

func SetupRouter() *gin.Engine {
	r := gin.Default()

	h := handler.NewHandler()

	api := r.Group("/api/v1")
	{
		orders := api.Group("/orders")
		{
			orders.POST("", h.CreateOrder)
			orders.GET("", h.ListOrders)
			orders.GET("/:id", h.GetOrder)
			orders.GET("/:id/versions", h.GetOrderVersions)
			orders.GET("/:id/summary", h.GetOrderSummary)
		}

		papers := api.Group("/papers")
		{
			papers.POST("", h.CreatePaper)
			papers.GET("", h.ListPapers)
		}

		versions := api.Group("/versions")
		{
			versions.POST("/material", h.SubmitMaterial)
			versions.POST("/:id/submit", h.SubmitVersion)
			versions.GET("/:id/autocheck", h.AutoCheck)
			versions.POST("/:id/autocheck", h.ProcessAutoCheck)
			versions.POST("/:id/review", h.StartReview)
			versions.POST("/:id/approve", h.Approve)
			versions.POST("/:id/reject", h.Reject)
			versions.POST("/:id/supplement/request", h.RequestSupplement)
			versions.POST("/:id/supplement", h.Supplement)
			versions.POST("/:id/finalize", h.Finalize)
			versions.GET("/:id", h.GetVersionDetail)
			versions.GET("/:id/changes", h.GetVersionChanges)
			versions.GET("/:id/can-produce", h.CheckCanProduce)
			versions.POST("/:id/report", h.CreateProductionReport)
			versions.GET("/:id/export", h.ExportVersionDetail)
		}

		handlers := api.Group("/handlers")
		{
			handlers.POST("", h.CreateHandler)
			handlers.GET("", h.ListHandlers)
		}

		api.GET("/actions", h.GetValidActions)
	}

	return r
}
