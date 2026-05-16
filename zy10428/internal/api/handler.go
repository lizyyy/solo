package api

import (
	"fmt"
	"net/http"
	"shadow-test-api/internal/model"
	"shadow-test-api/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.ShadowTestService
}

func NewHandler(svc *service.ShadowTestService) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		rules := api.Group("/rules")
		{
			rules.POST("", h.CreateRule)
			rules.GET("/:id", h.GetRule)
			rules.GET("", h.ListRules)
		}

		samples := api.Group("/samples")
		{
			samples.POST("", h.CreateSampleRequest)
			samples.GET("/:id", h.GetSampleRequest)
			samples.GET("", h.ListSampleRequests)
		}

		batches := api.Group("/batches")
		{
			batches.POST("", h.CreateBatch)
			batches.GET("/:id", h.GetBatch)
			batches.GET("", h.ListBatches)
			batches.POST("/execute", h.ExecuteBatch)
			batches.POST("/status", h.UpdateBatchStatus)
			batches.POST("/recalculate", h.ReCalculateBatch)
			batches.GET("/:id/results", h.ListHitResults)
		}

		results := api.Group("/results")
		{
			results.POST("/correct", h.CorrectResult)
		}

		reports := api.Group("/reports")
		{
			reports.POST("/export", h.ExportReport)
			reports.GET("", h.ListReports)
		}
	}
}

func (h *Handler) CreateRule(c *gin.Context) {
	var req model.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	if req.Name == "" || req.PathPattern == "" {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, "name and path_pattern are required"))
		return
	}

	rule, err := h.svc.CreateRule(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(rule))
}

func (h *Handler) GetRule(c *gin.Context) {
	id := c.Param("id")
	rule, err := h.svc.GetRule(id)
	if err != nil {
		c.JSON(http.StatusNotFound, service.RespondError(http.StatusNotFound, "rule not found"))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(rule))
}

func (h *Handler) ListRules(c *gin.Context) {
	page := getIntQuery(c, "page", 1)
	pageSize := getIntQuery(c, "page_size", 20)

	result, err := h.svc.ListRules(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func (h *Handler) CreateSampleRequest(c *gin.Context) {
	var req model.CreateSampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	if req.Path == "" || req.Method == "" {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, "path and method are required"))
		return
	}

	sample, err := h.svc.CreateSampleRequest(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(sample))
}

func (h *Handler) GetSampleRequest(c *gin.Context) {
	id := c.Param("id")
	sample, err := h.svc.GetSampleRequest(id)
	if err != nil {
		c.JSON(http.StatusNotFound, service.RespondError(http.StatusNotFound, "sample not found"))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(sample))
}

func (h *Handler) ListSampleRequests(c *gin.Context) {
	page := getIntQuery(c, "page", 1)
	pageSize := getIntQuery(c, "page_size", 20)

	result, err := h.svc.ListSampleRequests(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func (h *Handler) CreateBatch(c *gin.Context) {
	var req model.CreateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	if req.Name == "" || len(req.RuleIDs) == 0 {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, "name and rule_ids are required"))
		return
	}

	batch, err := h.svc.CreateBatch(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(batch))
}

func (h *Handler) GetBatch(c *gin.Context) {
	id := c.Param("id")
	batch, err := h.svc.GetBatch(id)
	if err != nil {
		c.JSON(http.StatusNotFound, service.RespondError(http.StatusNotFound, "batch not found"))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(batch))
}

func (h *Handler) ListBatches(c *gin.Context) {
	page := getIntQuery(c, "page", 1)
	pageSize := getIntQuery(c, "page_size", 20)

	result, err := h.svc.ListBatches(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func (h *Handler) ExecuteBatch(c *gin.Context) {
	var req model.ExecuteBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	if req.BatchID == "" {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, "batch_id is required"))
		return
	}

	err := h.svc.ExecuteBatch(req.BatchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(gin.H{"status": "executed"}))
}

func (h *Handler) UpdateBatchStatus(c *gin.Context) {
	var req model.BatchStatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	batch, err := h.svc.UpdateBatchStatus(req.BatchID, req.Status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(batch))
}

func (h *Handler) ReCalculateBatch(c *gin.Context) {
	var req model.ExecuteBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	err := h.svc.ReCalculateBatch(req.BatchID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(gin.H{"status": "recalculated"}))
}

func (h *Handler) ListHitResults(c *gin.Context) {
	batchID := c.Param("id")
	page := getIntQuery(c, "page", 1)
	pageSize := getIntQuery(c, "page_size", 20)

	result, err := h.svc.ListHitResults(batchID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func (h *Handler) CorrectResult(c *gin.Context) {
	var req model.CorrectResultRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	result, err := h.svc.CorrectResult(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func (h *Handler) ExportReport(c *gin.Context) {
	var req model.ExportReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, service.RespondError(http.StatusBadRequest, err.Error()))
		return
	}

	report, err := h.svc.ExportReport(req.BatchID, req.Format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}

	c.JSON(http.StatusOK, service.RespondSuccess(report))
}

func (h *Handler) ListReports(c *gin.Context) {
	page := getIntQuery(c, "page", 1)
	pageSize := getIntQuery(c, "page_size", 20)

	result, err := h.svc.ListReports(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, service.RespondError(http.StatusInternalServerError, err.Error()))
		return
	}
	c.JSON(http.StatusOK, service.RespondSuccess(result))
}

func getIntQuery(c *gin.Context, key string, defaultValue int) int {
	val := c.Query(key)
	if val == "" {
		return defaultValue
	}
	result := 0
	if _, err := fmt.Sscanf(val, "%d", &result); err != nil {
		return defaultValue
	}
	return result
}
