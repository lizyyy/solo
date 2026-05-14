package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

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
			rules.GET("/export", h.ExportMirrorRules)
		}

		copies := api.Group("/copies")
		{
			copies.GET("", h.ListRequestCopies)
			copies.POST("/submit", h.SubmitRequest)
			copies.GET("/export", h.ExportRequestCopies)
		}

		results := api.Group("/results")
		{
			results.GET("", h.ListCompareResults)
			results.GET("/export", h.ExportCompareResults)
		}
	}

	r.GET("/health", h.HealthCheck)
}

func (h *HTTPHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
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
		statusCode := http.StatusBadRequest
		if strings.Contains(err.Error(), "not found") {
			statusCode = http.StatusNotFound
		}
		c.JSON(statusCode, model.ApiResponse{
			Code:    statusCode,
			Message: err.Error(),
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

func (h *HTTPHandler) ExportMirrorRules(c *gin.Context) {
	status := c.Query("status")
	rules, err := h.service.ExportMirrorRules(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to export rules: %v", err),
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	if format == "csv" {
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=mirror_rules.csv")
		csvContent := "ID,Name,Status,SampleRate,SourcePath,SourceMethod,CreatedAt\n"
		for _, rule := range rules {
			csvContent += fmt.Sprintf("%s,%s,%s,%.2f,%s,%s,%s\n",
				rule.ID, rule.Name, rule.Status, rule.SampleRate,
				rule.SourcePath, rule.SourceMethod, rule.CreatedAt.Format(time.RFC3339))
		}
		c.String(http.StatusOK, csvContent)
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": rules,
			"total": len(rules),
		},
	})
}

func (h *HTTPHandler) ExportRequestCopies(c *gin.Context) {
	ruleID := c.Query("rule_id")
	traceID := c.Query("trace_id")
	status := c.Query("status")

	copies, err := h.service.ExportRequestCopies(ruleID, traceID, status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to export copies: %v", err),
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	if format == "csv" {
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=request_copies.csv")
		csvContent := "ID,RuleID,TraceID,Method,URL,StatusCode,Status,DurationMs,CreatedAt\n"
		for _, copy := range copies {
			statusCode := ""
			if copy.StatusCode != nil {
				statusCode = fmt.Sprintf("%d", *copy.StatusCode)
			}
			duration := ""
			if copy.DurationMs != nil {
				duration = fmt.Sprintf("%d", *copy.DurationMs)
			}
			csvContent += fmt.Sprintf("%s,%s,%s,%s,%s,%s,%s,%s,%s\n",
				copy.ID, copy.RuleID, copy.TraceID, copy.Method, copy.OriginalURL,
				statusCode, copy.Status, duration, copy.CreatedAt.Format(time.RFC3339))
		}
		c.String(http.StatusOK, csvContent)
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": copies,
			"total": len(copies),
		},
	})
}

func (h *HTTPHandler) ExportCompareResults(c *gin.Context) {
	ruleID := c.Query("rule_id")

	results, err := h.service.ExportCompareResults(ruleID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ApiResponse{
			Code:    500,
			Message: fmt.Sprintf("Failed to export results: %v", err),
		})
		return
	}

	format := c.DefaultQuery("format", "json")
	if format == "csv" {
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename=compare_results.csv")
		csvContent := "ID,RuleID,StatusCodeMatch,BodyMatch,HeadersMatch,SimilarityScore,CreatedAt\n"
		for _, result := range results {
			scMatch := ""
			if result.StatusCodeMatch != nil {
				scMatch = fmt.Sprintf("%t", *result.StatusCodeMatch)
			}
			bMatch := ""
			if result.BodyMatch != nil {
				bMatch = fmt.Sprintf("%t", *result.BodyMatch)
			}
			hMatch := ""
			if result.HeadersMatch != nil {
				hMatch = fmt.Sprintf("%t", *result.HeadersMatch)
			}
			csvContent += fmt.Sprintf("%s,%s,%s,%s,%s,%.2f,%s\n",
				result.ID, result.RuleID, scMatch, bMatch, hMatch,
				result.SimilarityScore, result.CreatedAt.Format(time.RFC3339))
		}
		c.String(http.StatusOK, csvContent)
		return
	}

	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"items": results,
			"total": len(results),
		},
	})
}
