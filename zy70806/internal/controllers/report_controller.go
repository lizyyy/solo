package controllers

import (
	"net/http"
	"os"

	"customs-reconciliation/internal/services"

	"github.com/gin-gonic/gin"
)

type ReportController struct {
	reportService *services.ReportService
}

func NewReportController() *ReportController {
	return &ReportController{
		reportService: services.NewReportService(),
	}
}

func (c *ReportController) GenerateReport(ctx *gin.Context) {
	var req services.ReportGenerationRequest
	if err := ctx.ShouldBindJSON(&req); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := c.reportService.GenerateReport(&req)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, report)
}

func (c *ReportController) GetBatchReports(ctx *gin.Context) {
	batchID := ctx.Param("id")

	reports, err := c.reportService.GetBatchReports(batchID)
	if err != nil {
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, reports)
}

func (c *ReportController) DownloadReport(ctx *gin.Context) {
	reportID := ctx.Param("id")

	filePath, err := c.reportService.GetReportFilePath(reportID)
	if err != nil {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Report not found"})
		return
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		ctx.JSON(http.StatusNotFound, gin.H{"error": "Report file not found"})
		return
	}

	ctx.File(filePath)
}
