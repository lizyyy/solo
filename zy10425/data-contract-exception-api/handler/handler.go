package handler

import (
	"github.com/data-contract-exception-api/models"
	"github.com/data-contract-exception-api/service"
	"github.com/gin-gonic/gin"
	"net/http"
	"os"
	"path/filepath"
)

type Handler struct {
	service *service.Service
}

func NewHandler(s *service.Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		exceptions := api.Group("/exceptions")
		{
			exceptions.POST("", h.CreateException)
			exceptions.GET("", h.GetAllExceptions)
			exceptions.GET("/:id", h.GetException)
			exceptions.POST("/:id/approve", h.ApproveException)
			exceptions.POST("/:id/reject", h.RejectException)
			exceptions.POST("/:id/hit", h.RecordHit)
			exceptions.POST("/:id/request-recovery", h.RequestRecovery)
			exceptions.POST("/:id/approve-recovery", h.ApproveRecovery)
			exceptions.POST("/:id/complete-recovery", h.CompleteRecovery)
			exceptions.POST("/:id/manual-correction", h.ManualCorrection)
			exceptions.GET("/:id/hits", h.GetHitRecords)
			exceptions.GET("/:id/export-report", h.ExportRecoveryReport)
		}

		anomalies := api.Group("/anomalies")
		{
			anomalies.GET("", h.GetAllAnomalies)
			anomalies.POST("/:id/resolve", h.ResolveAnomaly)
		}

		reports := api.Group("/reports")
		{
			reports.GET("/export-all", h.ExportAllReports)
		}

		api.POST("/sample-data", h.CreateSampleData)
		api.POST("/check-expired", h.CheckAndExpireExceptions)
	}
}

func (h *Handler) CreateException(c *gin.Context) {
	var req models.CreateExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.CreateException(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, exception)
}

func (h *Handler) GetAllExceptions(c *gin.Context) {
	exceptions, err := h.service.GetAllExceptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exceptions)
}

func (h *Handler) GetException(c *gin.Context) {
	id := c.Param("id")
	exception, err := h.service.GetException(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "exception not found"})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) ApproveException(c *gin.Context) {
	id := c.Param("id")
	var req models.ApproveExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.ApproveException(id, req.ApprovedBy)
	if err != nil {
		if err == service.ErrInvalidStateTransition {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) RejectException(c *gin.Context) {
	id := c.Param("id")
	var req models.ApproveExceptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.RejectException(id, req.ApprovedBy)
	if err != nil {
		if err == service.ErrInvalidStateTransition {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) RecordHit(c *gin.Context) {
	_ = c.Param("id")
	var req models.RecordHitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hit, err := h.service.RecordHit(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, hit)
}

func (h *Handler) RequestRecovery(c *gin.Context) {
	id := c.Param("id")
	var req models.RequestRecoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.RequestRecovery(id, req.RequestedBy, req.RecoveryNotes)
	if err != nil {
		if err == service.ErrInvalidStateTransition {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) ApproveRecovery(c *gin.Context) {
	id := c.Param("id")
	var req models.ApproveRecoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.ApproveRecovery(id, req.ApprovedBy)
	if err != nil {
		if err == service.ErrInvalidStateTransition {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) CompleteRecovery(c *gin.Context) {
	id := c.Param("id")

	exception, err := h.service.CompleteRecovery(id)
	if err != nil {
		if err == service.ErrInvalidStateTransition {
			c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) ManualCorrection(c *gin.Context) {
	id := c.Param("id")
	var req models.ManualCorrectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exception, err := h.service.ManualCorrection(id, req.NewStatus, req.CorrectedBy, req.CorrectionNote)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, exception)
}

func (h *Handler) GetHitRecords(c *gin.Context) {
	id := c.Param("id")
	hits, err := h.service.GetHitRecords(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, hits)
}

func (h *Handler) GetAllAnomalies(c *gin.Context) {
	anomalies, err := h.service.GetAllAnomalies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, anomalies)
}

func (h *Handler) ResolveAnomaly(c *gin.Context) {
	id := c.Param("id")
	var req models.ResolveAnomalyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	anomaly, err := h.service.ResolveAnomaly(id, req.HandledBy, req.ResolutionNotes)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, anomaly)
}

func (h *Handler) ExportRecoveryReport(c *gin.Context) {
	id := c.Param("id")

	tempDir := "./temp"
	os.MkdirAll(tempDir, 0755)
	filePath := filepath.Join(tempDir, "recovery-report-"+id+".csv")

	err := h.service.ExportRecoveryReport(id, filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.FileAttachment(filePath, filepath.Base(filePath))
}

func (h *Handler) ExportAllReports(c *gin.Context) {
	tempDir := "./temp"
	os.MkdirAll(tempDir, 0755)
	filePath := filepath.Join(tempDir, "all-recovery-reports.csv")

	err := h.service.ExportAllReports(filePath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.FileAttachment(filePath, filepath.Base(filePath))
}

func (h *Handler) CreateSampleData(c *gin.Context) {
	err := h.service.CreateSampleData()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "sample data created successfully"})
}

func (h *Handler) CheckAndExpireExceptions(c *gin.Context) {
	err := h.service.CheckAndExpireExceptions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "expired exceptions checked and updated"})
}
