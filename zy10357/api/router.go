package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func SetupRouter(db *gorm.DB) *gin.Engine {
	r := gin.Default()

	handler := NewHandler(db)

	api := r.Group("/api/v1")
	{
		revocations := api.Group("/revocations")
		{
			revocations.POST("", handler.RegisterRevocation)
			revocations.GET("", handler.GetAllRevocations)
			revocations.GET("/:serial_number/check", handler.CheckRevocation)
			revocations.POST("/:serial_number/confirm-cache", handler.ConfirmCache)
			revocations.POST("/:serial_number/activate", handler.ActivateRevocation)
			revocations.GET("/:serial_number/history", handler.GetRevocationHistory)
		}

		versions := api.Group("/versions")
		{
			versions.POST("", handler.CreateDistributionVersion)
			versions.GET("", handler.GetDistributionVersions)
		}

		api.GET("/report", handler.GetRefreshReport)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"status": "ok",
		})
	})

	r.GET("/", func(c *gin.Context) {
		c.HTML(http.StatusOK, "index.html", nil)
	})

	r.LoadHTMLGlob("templates/*")

	return r
}
