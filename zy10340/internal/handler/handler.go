package handler

import (
	"api-replay-throttler/internal/model"
	"api-replay-throttler/internal/service"
	"encoding/json"
	"errors"
	"github.com/gin-gonic/gin"
	"net/http"
	"strconv"
)

type Handler struct {
	service *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) idempotencyMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		key := c.GetHeader("X-Idempotency-Key")
		if key == "" {
			c.Next()
			return
		}

		result, exists, err := h.service.CheckIdempotency(key)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			c.Abort()
			return
		}

		if exists {
			var data map[string]interface{}
			json.Unmarshal([]byte(result), &data)
			c.Header("X-Idempotency-Hit", "true")
			c.JSON(http.StatusOK, data)
			c.Abort()
			return
		}

		c.Set("idempotency_key", key)
		c.Next()
	}
}

func (h *Handler) saveIdempotencyResult(c *gin.Context, data interface{}) {
	key, exists := c.Get("idempotency_key")
	if !exists {
		return
	}

	jsonData, _ := json.Marshal(data)
	h.service.SaveIdempotency(key.(string), c.Request.URL.Path, string(jsonData))
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	api.Use(h.idempotencyMiddleware())

	api.POST("/tenants", h.CreateTenant)

	samples := api.Group("/tenants/:tenant_id/samples")
	{
		samples.POST("", h.ImportSamples)
		samples.GET("", h.GetSamples)
	}

	rules := api.Group("/tenants/:tenant_id/rules")
	{
		rules.POST("", h.CreateRule)
		rules.GET("", h.GetRules)
	}

	plans := api.Group("/tenants/:tenant_id/plans")
	{
		plans.POST("", h.CreatePlan)
		plans.GET("", h.GetPlans)
		plans.GET("/:plan_id", h.GetPlan)
		plans.POST("/:plan_id/start", h.StartPlan)
		plans.POST("/:plan_id/pause", h.PausePlan)
		plans.POST("/:plan_id/resume", h.ResumePlan)
		plans.GET("/:plan_id/results", h.GetResults)
		plans.GET("/:plan_id/statistics", h.GetPlanStatistics)
		plans.GET("/:plan_id/export", h.ExportResults)
	}
}

func (h *Handler) CreateTenant(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenant, err := h.service.CreateTenant(req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, tenant)
	c.JSON(http.StatusCreated, tenant)
}

func (h *Handler) ImportSamples(c *gin.Context) {
	tenantID := c.Param("tenant_id")

	var samples []model.TrafficSample
	if err := c.ShouldBindJSON(&samples); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.service.ImportSamples(tenantID, samples)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	response := gin.H{
		"message": "success",
		"count":   len(result),
		"samples": result,
	}
	h.saveIdempotencyResult(c, response)
	c.JSON(http.StatusCreated, response)
}

func (h *Handler) GetSamples(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	samples, total, err := h.service.GetSamples(tenantID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       samples,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

func (h *Handler) CreateRule(c *gin.Context) {
	tenantID := c.Param("tenant_id")

	var req struct {
		Name              string  `json:"name" binding:"required"`
		MaxRequests       int     `json:"max_requests" binding:"required,min=1"`
		WindowSeconds     int     `json:"window_seconds" binding:"required,min=1"`
		MaxConcurrency    int     `json:"max_concurrency" binding:"required,min=1"`
		ErrorThreshold    float64 `json:"error_threshold" binding:"required,min=0,max=1"`
		BackoffMultiplier float64 `json:"backoff_multiplier" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule, err := h.service.CreateRule(
		tenantID,
		req.Name,
		req.MaxRequests,
		req.WindowSeconds,
		req.MaxConcurrency,
		req.ErrorThreshold,
		req.BackoffMultiplier,
	)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, rule)
	c.JSON(http.StatusCreated, rule)
}

func (h *Handler) GetRules(c *gin.Context) {
	tenantID := c.Param("tenant_id")

	rules, err := h.service.GetRules(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": rules})
}

func (h *Handler) CreatePlan(c *gin.Context) {
	tenantID := c.Param("tenant_id")

	var req struct {
		RuleID string `json:"rule_id" binding:"required"`
		Name   string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	plan, err := h.service.CreatePlan(tenantID, req.RuleID, req.Name)
	if err != nil {
		if errors.Is(err, service.ErrInvalidInput) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		if errors.Is(err, service.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, plan)
	c.JSON(http.StatusCreated, plan)
}

func (h *Handler) GetPlans(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	plans, total, err := h.service.GetPlans(tenantID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       plans,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

func (h *Handler) GetPlan(c *gin.Context) {
	planID := c.Param("plan_id")

	plan, err := h.service.GetPlan(planID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
		return
	}

	c.JSON(http.StatusOK, plan)
}

func (h *Handler) StartPlan(c *gin.Context) {
	planID := c.Param("plan_id")

	var req struct {
		SampleIDs []string `json:"sample_ids"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		req.SampleIDs = nil
	}

	plan, err := h.service.StartPlan(planID, req.SampleIDs)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
			return
		}
		if errors.Is(err, service.ErrPlanAlreadyDone) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, plan)
	c.JSON(http.StatusOK, plan)
}

func (h *Handler) PausePlan(c *gin.Context) {
	planID := c.Param("plan_id")

	var req struct {
		Reason   string `json:"reason"`
		PausedBy string `json:"paused_by"`
	}

	c.ShouldBindJSON(&req)

	pause, err := h.service.PausePlan(planID, req.Reason, req.PausedBy)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
			return
		}
		if errors.Is(err, service.ErrPlanNotRunning) {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, pause)
	c.JSON(http.StatusOK, pause)
}

func (h *Handler) ResumePlan(c *gin.Context) {
	planID := c.Param("plan_id")

	plan, err := h.service.ResumePlan(planID)
	if err != nil {
		if errors.Is(err, service.ErrNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "plan not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.saveIdempotencyResult(c, plan)
	c.JSON(http.StatusOK, plan)
}

func (h *Handler) GetResults(c *gin.Context) {
	planID := c.Param("plan_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	results, total, err := h.service.GetResults(planID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       results,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

func (h *Handler) GetPlanStatistics(c *gin.Context) {
	planID := c.Param("plan_id")

	stats, err := h.service.GetPlanStatistics(planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *Handler) ExportResults(c *gin.Context) {
	planID := c.Param("plan_id")

	csvData, err := h.service.ExportResultsCSV(planID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", "attachment; filename=results_"+planID+".csv")
	c.String(http.StatusOK, string(csvData))
}
