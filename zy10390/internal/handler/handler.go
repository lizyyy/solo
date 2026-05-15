package handler

import (
	"bytes"
	"db-pool-protect-api/internal/model"
	"db-pool-protect-api/internal/service"
	"encoding/csv"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type APIHandler struct {
	service *service.ProtectService
}

func NewAPIHandler(s *service.ProtectService) *APIHandler {
	return &APIHandler{service: s}
}

func (h *APIHandler) getOperator(c *gin.Context) string {
	operator := c.GetHeader("X-Operator")
	if operator == "" {
		operator = "system"
	}
	return operator
}

func (h *APIHandler) CreateRule(c *gin.Context) {
	var req service.CreateRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule, err := h.service.CreateRule(&req, h.getOperator(c))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": rule,
	})
}

func (h *APIHandler) GetRule(c *gin.Context) {
	id := c.Param("id")
	rule, err := h.service.GetRule(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rule == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "rule not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": rule,
	})
}

func (h *APIHandler) ListRules(c *gin.Context) {
	rules, err := h.service.ListRules()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": rules,
	})
}

func (h *APIHandler) UpdateRuleStatus(c *gin.Context) {
	id := c.Param("id")
	var req struct {
		Status model.RuleStatus `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rule, err := h.service.UpdateRuleStatus(id, req.Status, h.getOperator(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": rule,
	})
}

func (h *APIHandler) DeleteRule(c *gin.Context) {
	id := c.Param("id")
	if err := h.service.DeleteRule(id, h.getOperator(c)); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "deleted",
	})
}

func (h *APIHandler) RecordConnection(c *gin.Context) {
	var stats model.ConnectionStats
	if err := c.ShouldBindJSON(&stats); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RecordConnectionStats(&stats); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "recorded",
	})
}

func (h *APIHandler) RecordSlowQuery(c *gin.Context) {
	var record model.SlowQueryRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.service.RecordSlowQuery(&record); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":    0,
		"message": "recorded",
	})
}

func (h *APIHandler) GetOverview(c *gin.Context) {
	stats, err := h.service.GetOverview()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": stats,
	})
}

func (h *APIHandler) TriggerProtection(c *gin.Context) {
	var req struct {
		RuleID string `json:"rule_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	event, err := h.service.CheckAndTriggerProtection(req.RuleID, h.getOperator(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": event,
	})
}

func (h *APIHandler) ConfirmRestore(c *gin.Context) {
	var req struct {
		RuleID   string         `json:"rule_id"`
		EventID  string         `json:"event_id"`
		Reason   string         `json:"reason"`
		CheckData map[string]any `json:"check_data"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	record, err := h.service.ConfirmRestore(req.RuleID, req.EventID, req.Reason, req.CheckData, h.getOperator(c))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": record,
	})
}

func (h *APIHandler) ListHistory(c *gin.Context) {
	resourceID := c.Query("resource_id")
	limitStr := c.Query("limit")
	limit := 0
	if limitStr != "" {
		limit, _ = strconv.Atoi(limitStr)
	}

	records, err := h.service.ListHistory(resourceID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"data": records,
	})
}

func (h *APIHandler) ExportReport(c *gin.Context) {
	records, err := h.service.ExportReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)
	if err := h.service.WriteCSV(records, writer); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := "pool-protection-report-" + time.Now().Format("20060102-150405") + ".csv"

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename="+filename)
	c.String(http.StatusOK, buf.String())
}
