package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"traffic-mirror-controller/internal/model"
	"traffic-mirror-controller/internal/service"

	"github.com/gin-gonic/gin"
)

type HTTPHandler struct {
	service *service.MirrorService
}

func NewHTTPHandler(service *service.MirrorService) *HTTPHandler {
	return &HTTPHandler{service: service}
}

func (h *HTTPHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		targets := api.Group("/targets")
		{
			targets.POST("", h.CreateTargetEnv)
			targets.GET("", h.ListTargetEnvs)
			targets.GET("/:id", h.GetTargetEnv)
		}

		rules := api.Group("/rules")
		{
			rules.POST("", h.CreateMirrorRule)
			rules.GET("", h.ListMirrorRules)
			rules.GET("/:id", h.GetMirrorRule)
			rules.PATCH("/:id/status", h.UpdateRuleStatus)
		}

		copies := api.Group("/copies")
		{
			copies.GET("", h.ListRequestCopies)
			copies.POST("/submit", h.SubmitRequest)
		}

		results := api.Group("/results")
		{
			results.GET("", h.ListCompareResults)
		}
	}

	r.GET("/health", h.HealthCheck)
}

func (h *HTTPHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"service": "traffic-mirror-controller",
	})
}

func (h *HTTPHandler) CreateTargetEnv(c *gin.Context) {
	var req model.TargetEnvRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	env, err := h.service.CreateTargetEnv(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to create target: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, model.ApiResponse{
		Code:    201,
		Message: "Success",
		Data:    env,
	})
}

func (h *HTTPHandler) GetTargetEnv(c *gin.Context) {
	id := c.Param("id")

	env, err := h.service.GetTargetEnv(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to get target: %v", err),
		})
		return
	}

	if env == nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code:    404,
			Message: "Target environment not found",
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    env,
	})
}

func (h *HTTPHandler) ListTargetEnvs(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	envs, total, err := h.service.ListTargetEnvs(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to list targets: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": envs,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *HTTPHandler) CreateMirrorRule(c *gin.Context) {
	var req model.CreateMirrorRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	if req.IdempotencyKey == "" {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: "idempotency_key is required",
		})
		return
	}

	if req.SampleRate < 0 || req.SampleRate > 1 {
		req.SampleRate = 1.0
	}

	rule, err := h.service.CreateMirrorRule(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to create rule: %v", err),
		})
		return
	}

	c.JSON(http.StatusCreated, model.ApiResponse{
		Code:    201,
		Message: "Success",
		Data:    rule,
	})
}

func (h *HTTPHandler) GetMirrorRule(c *gin.Context) {
	id := c.Param("id")

	rule, err := h.service.GetMirrorRule(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to get rule: %v", err),
		})
		return
	}

	if rule == nil {
		c.JSON(http.StatusNotFound, model.ApiResponse{
			Code:    404,
			Message: "Mirror rule not found",
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    rule,
	})
}

func (h *HTTPHandler) ListMirrorRules(c *gin.Context) {
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	rules, total, err := h.service.ListMirrorRules(status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to list rules: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": rules,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *HTTPHandler) UpdateRuleStatus(c *gin.Context) {
	id := c.Param("id")

	var req struct {
		Status string `json:"status" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	err := h.service.UpdateMirrorRuleStatus(id, model.MirrorRuleStatus(req.Status))
	if err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: fmt.Sprintf("Failed to update status: %v", err),
		})
		return
	}

	rule, _ := h.service.GetMirrorRule(id)

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Status updated successfully",
		Data:    rule,
	})
}

type SubmitRequest struct {
	RuleID  string            `json:"rule_id" binding:"required"`
	TraceID string            `json:"trace_id" binding:"required"`
	Method  string            `json:"method" binding:"required"`
	URL     string            `json:"url" binding:"required"`
	Headers map[string]string `json:"headers"`
	Body    string            `json:"body"`
}

func (h *HTTPHandler) SubmitRequest(c *gin.Context) {
	var req SubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ApiResponse{
			Code:    400,
			Message: fmt.Sprintf("Invalid request: %v", err),
		})
		return
	}

	headersJSON, _ := json.Marshal(req.Headers)

	err := h.service.SubmitRequestForMirroring(req.RuleID, req.TraceID, req.Method, req.URL, string(headersJSON), req.Body)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to submit request: %v", err),
		})
		return
	}

	c.JSON(http.StatusAccepted, model.ApiResponse{
		Code:    202,
		Message: "Request submitted for mirroring",
	})
}

func (h *HTTPHandler) ListRequestCopies(c *gin.Context) {
	ruleID := c.Query("rule_id")
	traceID := c.Query("trace_id")
	status := c.Query("status")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	copies, total, err := h.service.ListRequestCopies(ruleID, traceID, status, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to list copies: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": copies,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *HTTPHandler) ListCompareResults(c *gin.Context) {
	ruleID := c.Query("rule_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	results, total, err := h.service.ListCompareResults(ruleID, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to list results: %v", err),
		})
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": results,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}
