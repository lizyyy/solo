package handlers

import (
	"multi-region-health-api/db"
	"multi-region-health-api/models"
	"multi-region-health-api/services"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	healthService *services.HealthService
}

func NewHandler() *Handler {
	return &Handler{
		healthService: services.NewHealthService(),
	}
}

type CreateRegionRequest struct {
	RequestID   string `json:"request_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Code        string `json:"code" binding:"required"`
	Description string `json:"description"`
}

func (h *Handler) CreateRegion(c *gin.Context) {
	var req CreateRegionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var existingByCode models.Region
	if err := db.GetDB().Where("code = ?", req.Code).First(&existingByCode).Error; err == nil {
		c.JSON(http.StatusOK, existingByCode)
		return
	}

	var existingByName models.Region
	if err := db.GetDB().Where("name = ?", req.Name).First(&existingByName).Error; err == nil {
		c.JSON(http.StatusOK, existingByName)
		return
	}

	region := &models.Region{
		Name:        req.Name,
		Code:        req.Code,
		Description: req.Description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := db.GetDB().Create(region).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create region"})
		return
	}

	c.JSON(http.StatusCreated, region)
}

type CreateServiceRequest struct {
	RequestID   string `json:"request_id" binding:"required"`
	RegionID    string `json:"region_id" binding:"required"`
	Name        string `json:"name" binding:"required"`
	Code        string `json:"code" binding:"required"`
	Description string `json:"description"`
}

func (h *Handler) CreateService(c *gin.Context) {
	var req CreateServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var region models.Region
	if err := db.GetDB().First(&region, "id = ?", req.RegionID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "region not found"})
		return
	}

	var existingByCode models.Service
	if err := db.GetDB().Where("region_id = ? AND code = ?", req.RegionID, req.Code).First(&existingByCode).Error; err == nil {
		c.JSON(http.StatusOK, existingByCode)
		return
	}

	var existingByName models.Service
	if err := db.GetDB().Where("region_id = ? AND name = ?", req.RegionID, req.Name).First(&existingByName).Error; err == nil {
		c.JSON(http.StatusOK, existingByName)
		return
	}

	service := &models.Service{
		RegionID:      req.RegionID,
		Name:          req.Name,
		Code:          req.Code,
		Description:   req.Description,
		HealthStatus:  models.HealthStatusUnknown,
		DegradeStatus: models.DegradeStatusNormal,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := db.GetDB().Create(service).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create service"})
		return
	}

	c.JSON(http.StatusCreated, service)
}

type SubmitProbeRequest struct {
	RequestID string `json:"request_id" binding:"required"`
	ProbeType string `json:"probe_type" binding:"required"`
	RawStatus string `json:"raw_status" binding:"required"`
	Metrics   string `json:"metrics"`
	ErrorMsg  string `json:"error_msg"`
}

func (h *Handler) SubmitProbe(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	var req SubmitProbeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.healthService.SubmitProbeResult(
		serviceID,
		req.RequestID,
		req.ProbeType,
		req.RawStatus,
		req.Metrics,
		req.ErrorMsg,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

type TransitionDegradeRequest struct {
	RequestID   string `json:"request_id" binding:"required"`
	Reason      string `json:"reason" binding:"required"`
	TriggeredBy string `json:"triggered_by" binding:"required"`
}

func (h *Handler) TransitionDegrade(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	var req TransitionDegradeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	action, err := h.healthService.TransitionDegradeStatus(
		serviceID,
		req.RequestID,
		req.Reason,
		req.TriggeredBy,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, action)
}

type ConfirmRecoveryRequest struct {
	RequestID       string `json:"request_id" binding:"required"`
	DegradeActionID string `json:"degrade_action_id"`
	ConfirmedBy     string `json:"confirmed_by" binding:"required"`
	ConfirmType     string `json:"confirm_type" binding:"required"`
	Description     string `json:"description"`
	IsSuccess       bool   `json:"is_success" binding:"required"`
}

func (h *Handler) ConfirmRecovery(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	var req ConfirmRecoveryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.healthService.ConfirmRecovery(
		serviceID,
		req.RequestID,
		req.DegradeActionID,
		req.ConfirmedBy,
		req.ConfirmType,
		req.Description,
		req.IsSuccess,
	)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, record)
}

func (h *Handler) GetRegionSummary(c *gin.Context) {
	regionID := c.Param("region_id")
	if regionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "region_id is required"})
		return
	}

	summary, err := h.healthService.GetRegionHealthSummary(regionID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "region not found"})
		return
	}

	c.JSON(http.StatusOK, summary)
}

func (h *Handler) GetService(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	c.JSON(http.StatusOK, service)
}

func (h *Handler) GetProbeHistory(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	results, err := h.healthService.GetProbeHistory(serviceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, results)
}

func (h *Handler) GetDegradeHistory(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	actions, err := h.healthService.GetDegradeHistory(serviceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, actions)
}

func (h *Handler) ListRegions(c *gin.Context) {
	var regions []models.Region
	if err := db.GetDB().Find(&regions).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, regions)
}

func (h *Handler) ListServices(c *gin.Context) {
	regionID := c.Query("region_id")
	var services []models.Service

	query := db.GetDB()
	if regionID != "" {
		query = query.Where("region_id = ?", regionID)
	}

	if err := query.Find(&services).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, services)
}

type CreateDependencyRequest struct {
	RequestID          string `json:"request_id" binding:"required"`
	DependentServiceID string `json:"dependent_service_id" binding:"required"`
	DependencyType     string `json:"dependency_type"`
	IsCritical         bool   `json:"is_critical"`
}

func (h *Handler) CreateDependency(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	var req CreateDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if serviceID == req.DependentServiceID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cannot depend on self"})
		return
	}

	var service models.Service
	if err := db.GetDB().First(&service, "id = ?", serviceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "service not found"})
		return
	}

	var dependentService models.Service
	if err := db.GetDB().First(&dependentService, "id = ?", req.DependentServiceID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "dependent service not found"})
		return
	}

	var existing models.Dependency
	if err := db.GetDB().Where("service_id = ? AND dependent_service_id = ?", serviceID, req.DependentServiceID).First(&existing).Error; err == nil {
		c.JSON(http.StatusOK, existing)
		return
	}

	dependency := &models.Dependency{
		ServiceID:          serviceID,
		DependentServiceID: req.DependentServiceID,
		DependencyType:     req.DependencyType,
		IsCritical:         req.IsCritical,
		CreatedAt:          time.Now(),
	}

	if err := db.GetDB().Create(dependency).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create dependency"})
		return
	}

	c.JSON(http.StatusCreated, dependency)
}

func (h *Handler) GetDependencies(c *gin.Context) {
	serviceID := c.Param("service_id")
	if serviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "service_id is required"})
		return
	}

	deps, err := h.healthService.GetDependentServices(serviceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, deps)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now(),
	})
}
