package api

import (
	"cert-rotation/model"
	"cert-rotation/service"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type RotationHandler struct {
	service *service.RotationService
}

func NewRotationHandler() *RotationHandler {
	return &RotationHandler{
		service: service.NewRotationService(),
	}
}

func (h *RotationHandler) CreateRotation(c *gin.Context) {
	var req service.CreateRotationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rotation, err := h.service.CreateRotation(&req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, rotation)
}

func (h *RotationHandler) GetRotation(c *gin.Context) {
	id := c.Param("id")
	rotation, err := h.service.GetRotation(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rotation not found"})
		return
	}
	c.JSON(http.StatusOK, rotation)
}

func (h *RotationHandler) ListRotations(c *gin.Context) {
	tenantID := c.Query("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	rotations, total, err := h.service.ListRotations(tenantID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  rotations,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (h *RotationHandler) StartParallelValidation(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.StartParallelValidation(id); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "parallel validation started"})
}

type RecordSampleRequest struct {
	CertUsed   string `json:"cert_used" binding:"required,oneof=OLD NEW"`
	Endpoint   string `json:"endpoint" binding:"required"`
	SourceIP   string `json:"source_ip"`
	UserAgent  string `json:"user_agent"`
	RawRequest string `json:"raw_request"`
	Success    bool   `json:"success"`
	ErrorMsg   string `json:"error_msg"`
}

func (h *RotationHandler) RecordValidationSample(c *gin.Context) {
	id := c.Param("id")
	var req RecordSampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.service.RecordValidationSample(
		id, req.CertUsed, req.Endpoint, req.SourceIP,
		req.UserAgent, req.RawRequest, req.Success, req.ErrorMsg,
	)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sample recorded"})
}

type AdvanceStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *RotationHandler) AdvanceStatus(c *gin.Context) {
	id := c.Param("id")
	var req AdvanceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.AdvanceStatus(id, model.RotationStatus(req.Status)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "status updated"})
}

type ExceptionRequest struct {
	ErrorMsg      string `json:"error_msg" binding:"required"`
	OriginalInput string `json:"original_input"`
}

func (h *RotationHandler) HandleException(c *gin.Context) {
	id := c.Param("id")
	var req ExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.HandleException(id, req.ErrorMsg, req.OriginalInput); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "exception recorded"})
}

func (h *RotationHandler) ApplyManualFix(c *gin.Context) {
	var req service.ManualFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.ApplyManualFix(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "manual fix applied"})
}

type GenerateReportRequest struct {
	CreatedBy string `json:"created_by" binding:"required"`
}

func (h *RotationHandler) GenerateReport(c *gin.Context) {
	id := c.Param("id")
	var req GenerateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.service.GenerateReport(id, req.CreatedBy)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

func (h *RotationHandler) ExportReport(c *gin.Context) {
	id := c.Param("id")
	content, err := h.service.ExportReport(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=rotation-report-"+id+".json")
	c.String(http.StatusOK, content)
}

func (h *RotationHandler) CompleteSwitch(c *gin.Context) {
	id := c.Param("id")
	receipt, err := h.service.CompleteSwitch(id)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, receipt)
}

func (h *RotationHandler) GetValidationSamples(c *gin.Context) {
	id := c.Param("id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	samples, total, err := h.service.GetValidationSamples(id, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  samples,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (h *RotationHandler) GetReports(c *gin.Context) {
	id := c.Param("id")
	reports, err := h.service.GetReports(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, reports)
}

func SetupRoutes(r *gin.Engine) {
	handler := NewRotationHandler()

	v1 := r.Group("/api/v1")
	{
		rotations := v1.Group("/rotations")
		{
			rotations.POST("", handler.CreateRotation)
			rotations.GET("", handler.ListRotations)
			rotations.GET("/:id", handler.GetRotation)
			rotations.POST("/:id/start-parallel", handler.StartParallelValidation)
			rotations.POST("/:id/samples", handler.RecordValidationSample)
			rotations.GET("/:id/samples", handler.GetValidationSamples)
			rotations.POST("/:id/advance-status", handler.AdvanceStatus)
			rotations.POST("/:id/exception", handler.HandleException)
			rotations.POST("/:id/manual-fix", handler.ApplyManualFix)
			rotations.POST("/:id/generate-report", handler.GenerateReport)
			rotations.GET("/:id/export-report", handler.ExportReport)
			rotations.GET("/:id/reports", handler.GetReports)
			rotations.POST("/:id/complete-switch", handler.CompleteSwitch)
		}
	}
}
