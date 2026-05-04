package handlers

import (
	"btc-recharge-service/models"
	"btc-recharge-service/services"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type AuditHandler struct {
	auditSvc *services.AuditService
}

func NewAuditHandler(auditSvc *services.AuditService) *AuditHandler {
	return &AuditHandler{
		auditSvc: auditSvc,
	}
}

func (h *AuditHandler) GenerateReport(c *gin.Context) {
	var startTime *time.Time
	var endTime *time.Time

	startStr := c.Query("start_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = &t
		}
	}

	endStr := c.Query("end_time")
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = &t
		}
	}

	report, err := h.auditSvc.GenerateAuditReport(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "生成审计报告失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    report,
	})
}

func (h *AuditHandler) ExportReportCSV(c *gin.Context) {
	var startTime *time.Time
	var endTime *time.Time

	startStr := c.Query("start_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = &t
		}
	}

	endStr := c.Query("end_time")
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = &t
		}
	}

	report, err := h.auditSvc.GenerateAuditReport(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "生成审计报告失败: " + err.Error(),
		})
		return
	}

	csvData, err := h.auditSvc.ExportAuditReportAsCSV(report)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.InternalError.Code,
			Message: "导出 CSV 失败: " + err.Error(),
		})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=audit_report_%s.csv", report.ReportID))
	c.String(http.StatusOK, csvData)
}

func (h *AuditHandler) GetAuditLogs(c *gin.Context) {
	var startTime *time.Time
	var endTime *time.Time
	limit := 100

	startStr := c.Query("start_time")
	if startStr != "" {
		if t, err := time.Parse(time.RFC3339, startStr); err == nil {
			startTime = &t
		}
	}

	endStr := c.Query("end_time")
	if endStr != "" {
		if t, err := time.Parse(time.RFC3339, endStr); err == nil {
			endTime = &t
		}
	}

	limitStr := c.Query("limit")
	if limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	logs, err := h.auditSvc.GetAuditLogs(startTime, endTime, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询审计日志失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    logs,
	})
}
