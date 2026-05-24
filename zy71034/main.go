package main

import (
	"prescription-timeline/config"
	"prescription-timeline/database"
	"prescription-timeline/handlers"
	"prescription-timeline/services/closer"
	"prescription-timeline/services/processor"
	"prescription-timeline/services/validator"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	if err := database.Init(cfg); err != nil {
		panic("failed to initialize database: " + err.Error())
	}

	validatorSvc := validator.New(cfg)
	processorSvc := processor.New(validatorSvc)
	closerSvc := closer.New(validatorSvc)

	handler := handlers.New(validatorSvc, processorSvc, closerSvc)

	r := gin.Default()

	api := r.Group("/api/v1")
	{
		prescriptions := api.Group("/prescriptions")
		{
			prescriptions.POST("", handler.CreatePrescription)
			prescriptions.GET("", handler.ListPrescriptions)
			prescriptions.GET("/:id", handler.GetPrescription)
			prescriptions.GET("/:id/validate", handler.ValidatePrescription)
			prescriptions.POST("/:id/review", handler.ReviewPrescription)
			prescriptions.POST("/:id/confirm", handler.PatientConfirm)
			prescriptions.POST("/:id/dispense", handler.DispenseDrug)
			prescriptions.POST("/:id/supplement", handler.SupplementRecord)
			prescriptions.POST("/:id/close", handler.ClosePrescription)
			prescriptions.GET("/:id/timeline", handler.GetTimeline)
			prescriptions.GET("/:id/suggestion", handler.GetSuggestion)
			prescriptions.GET("/:id/export/json", handler.ExportReportJSON)
		}

		reports := api.Group("/reports")
		{
			reports.GET("", handler.ListReports)
			reports.GET("/export/csv", handler.ExportReportCSV)
		}
	}

	r.Run(":" + cfg.ServerPort)
}
