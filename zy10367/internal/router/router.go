package router

import (
	"cert-renewal/internal/handler"

	"github.com/gin-gonic/gin"
)

func SetupRouter(h *handler.Handler) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		partners := api.Group("/partners")
		{
			partners.POST("", h.CreatePartner)
			partners.GET("", h.ListPartners)
			partners.GET("/:id", h.GetPartner)
		}

		certs := api.Group("/certs")
		{
			certs.POST("", h.CreateCert)
			certs.GET("", h.ListCerts)
			certs.GET("/:id", h.GetCert)
			certs.POST("/gray-enable", h.GrayEnable)
			certs.POST("/full-enable", h.FullEnable)
		}

		verifications := api.Group("/verifications")
		{
			verifications.POST("", h.CreateVerification)
			verifications.POST("/verify", h.VerifyCert)
		}

		renewal := api.Group("/renewal")
		{
			renewal.POST("/window", h.CreateRenewalWindow)
			renewal.POST("/rollback", h.Rollback)
			renewal.GET("/history", h.GetEnablementHistory)
			renewal.POST("/reminders/trigger", h.TriggerReminders)
			renewal.GET("/reminders", h.ListReminders)
			renewal.POST("/reminders/mark-sent", h.MarkReminderSent)
		}

		export := api.Group("/export")
		{
			export.GET("/certs", h.ExportCerts)
			export.GET("/history", h.ExportEnablementHistory)
			export.GET("/verifications", h.ExportVerifications)
		}
	}

	return r
}
