package api

import (
	"audit-log-retention/model"
	"audit-log-retention/service"
	"net/http"

	"github.com/gin-gonic/gin"
)

func SetupRouter(retentionService *service.RetentionService) *gin.Engine {
	router := gin.Default()

	handler := NewRetentionHandler(retentionService)

	api := router.Group("/api/v1")
	{
		applications := api.Group("/applications")
		{
			applications.POST("", handler.CreateApplication)
			applications.GET("", handler.ListApplications)
			applications.GET("/:id", handler.GetApplication)
			applications.GET("/log-source/:logSource", handler.GetApplicationByLogSource)
			applications.POST("/:id/approve", handler.ApproveApplication)
			applications.POST("/:id/check-expiration", handler.CheckExpiration)
			applications.POST("/check-all-expirations", handler.CheckAllExpirations)
			applications.POST("/:id/archive", handler.ArchiveApplication)
			applications.POST("/:id/renew", handler.RenewApplication)
			applications.GET("/expired", handler.GetExpiredApplications)
			applications.GET("/long-retention-risk", handler.GetLongRetentionRiskApplications)
			applications.GET("/:id/approval-records", handler.ExportApprovalRecords)
			applications.GET("/:id/archive-records", handler.ExportArchiveRecords)
		}
	}

	return router
}

type RetentionHandler struct {
	service *service.RetentionService
}

func NewRetentionHandler(service *service.RetentionService) *RetentionHandler {
	return &RetentionHandler{service: service}
}

func (h *RetentionHandler) CreateApplication(c *gin.Context) {
	var req model.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.service.CreateApplication(req)
	if err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, app)
}

func (h *RetentionHandler) GetApplication(c *gin.Context) {
	id := c.Param("id")

	app, err := h.service.GetApplication(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

func (h *RetentionHandler) GetApplicationByLogSource(c *gin.Context) {
	logSource := c.Param("logSource")

	app, err := h.service.GetApplicationByLogSource(logSource)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

func (h *RetentionHandler) ListApplications(c *gin.Context) {
	status := model.RetentionStatus(c.Query("status"))
	apps := h.service.ListApplications(status)
	c.JSON(http.StatusOK, apps)
}

func (h *RetentionHandler) ApproveApplication(c *gin.Context) {
	id := c.Param("id")

	var req model.ApproveApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.service.ApproveApplication(id, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

func (h *RetentionHandler) CheckExpiration(c *gin.Context) {
	id := c.Param("id")

	result, err := h.service.CheckExpiration(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *RetentionHandler) CheckAllExpirations(c *gin.Context) {
	results := h.service.CheckAllExpirations()
	c.JSON(http.StatusOK, results)
}

func (h *RetentionHandler) ArchiveApplication(c *gin.Context) {
	id := c.Param("id")

	var req model.ArchiveApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.service.ArchiveApplication(id, req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, record)
}

type RenewRequest struct {
	AdditionalDays int    `json:"additional_days" binding:"required,min=1"`
	Approver       string `json:"approver" binding:"required"`
}

func (h *RetentionHandler) RenewApplication(c *gin.Context) {
	id := c.Param("id")

	var req RenewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	app, err := h.service.RenewApplication(id, req.AdditionalDays, req.Approver)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, app)
}

func (h *RetentionHandler) GetExpiredApplications(c *gin.Context) {
	apps := h.service.GetExpiredApplications()
	c.JSON(http.StatusOK, apps)
}

func (h *RetentionHandler) GetLongRetentionRiskApplications(c *gin.Context) {
	apps := h.service.GetLongRetentionRiskApplications()
	c.JSON(http.StatusOK, apps)
}

func (h *RetentionHandler) ExportApprovalRecords(c *gin.Context) {
	id := c.Param("id")

	records, err := h.service.ExportApprovalRecords(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}

func (h *RetentionHandler) ExportArchiveRecords(c *gin.Context) {
	id := c.Param("id")

	records, err := h.service.ExportArchiveRecords(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, records)
}
