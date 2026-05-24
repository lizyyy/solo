package handler

import (
	"compliance-exemption-api/internal/model"
	"compliance-exemption-api/internal/service"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

type ExemptionHandler struct {
	exemptionService service.ExemptionService
	reportService    service.ReportService
}

func NewExemptionHandler(exemptionService service.ExemptionService, reportService service.ReportService) *ExemptionHandler {
	return &ExemptionHandler{
		exemptionService: exemptionService,
		reportService:    reportService,
	}
}

func (h *ExemptionHandler) CreateExemption(c *gin.Context) {
	var req model.ExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exemption, idempotent, err := h.exemptionService.CreateExemption(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if idempotent != nil && idempotent.IsDuplicate {
		c.JSON(http.StatusOK, gin.H{
			"message":       "重复提交，返回原处理结论",
			"is_duplicate":  true,
			"processed_by":  idempotent.ProcessedBy,
			"processed_at":  idempotent.ProcessedAt,
			"original_data": idempotent.OriginalData,
		})
		return
	}

	c.JSON(http.StatusCreated, exemption)
}

func (h *ExemptionHandler) GetExemption(c *gin.Context) {
	id := c.Param("id")
	exemption, err := h.exemptionService.GetExemption(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "记录不存在"})
		return
	}
	c.JSON(http.StatusOK, exemption)
}

func (h *ExemptionHandler) ApproveExemption(c *gin.Context) {
	id := c.Param("id")
	var req model.ApprovalRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exemption, err := h.exemptionService.ApproveExemption(id, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exemption)
}

func (h *ExemptionHandler) QueryExemptions(c *gin.Context) {
	var req model.QueryRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.exemptionService.QueryExemptions(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *ExemptionHandler) UploadSample(c *gin.Context) {
	exemptionID := c.Param("id")
	uploadedBy := c.PostForm("uploaded_by")
	sampleType := c.PostForm("sample_type")

	if uploadedBy == "" || sampleType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "uploaded_by and sample_type are required"})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "No file uploaded"})
		return
	}

	sample, err := h.exemptionService.UploadSample(exemptionID, file, uploadedBy, sampleType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, sample)
}

func (h *ExemptionHandler) CheckExpired(c *gin.Context) {
	expired, err := h.exemptionService.CheckExpiredExemptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"expired_count": len(expired),
		"expired_items": expired,
	})
}

func (h *ExemptionHandler) GetStatistics(c *gin.Context) {
	stats, err := h.exemptionService.GetStatistics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *ExemptionHandler) CheckRuleMatch(c *gin.Context) {
	scriptVersion := c.Query("script_version")
	callID := c.Query("call_id")

	if scriptVersion == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "script_version is required"})
		return
	}

	exemption, matched, err := h.exemptionService.CheckRuleMatch(scriptVersion, callID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"matched":   matched,
		"exemption": exemption,
	})
}

func (h *ExemptionHandler) ExportReport(c *gin.Context) {
	filePath, err := h.reportService.ExportExcel()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.FileAttachment(filePath, "豁免报告.xlsx")
}

func (h *ExemptionHandler) DownloadSample(c *gin.Context) {
	filePath := c.Query("path")
	if filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "path is required"})
		return
	}

	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		c.JSON(http.StatusNotFound, gin.H{"error": "File not found"})
		return
	}

	c.File(filePath)
}

func (h *ExemptionHandler) HealthCheck(c *gin.Context) {
	stats, err := h.exemptionService.GetStatistics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"status": "unhealthy", "error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"stats":  stats,
	})
}

func (h *ExemptionHandler) CreateQualityReport(c *gin.Context) {
	var req model.QualityReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.exemptionService.CreateQualityReport(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, report)
}

func (h *ExemptionHandler) GetQualityReports(c *gin.Context) {
	exemptionID := c.Param("id")
	reports, err := h.exemptionService.GetQualityReportsByExemption(exemptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, reports)
}

func (h *ExemptionHandler) UpdateQualityReport(c *gin.Context) {
	reportID := c.Param("reportId")
	var req struct {
		Result   string `json:"result" binding:"required"`
		Reviewer string `json:"reviewer" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.exemptionService.UpdateQualityReportResult(reportID, req.Result, req.Reviewer)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}
