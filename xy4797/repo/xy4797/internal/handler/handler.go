package handler

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"go-quality-scanner/internal/config"
	"go-quality-scanner/internal/exporter"
	"go-quality-scanner/internal/models"
	"go-quality-scanner/internal/scanner"

	"github.com/gin-gonic/gin"
)

// Handler API 处理器
type Handler struct {
	scanService *scanner.ScanService
}

// NewHandler 创建新的处理器
func NewHandler(rules *config.RulesConfig) *Handler {
	return &Handler{
		scanService: scanner.NewScanService(rules),
	}
}

// SubmitScan 提交扫描任务
func (h *Handler) SubmitScan(c *gin.Context) {
	var project models.Project
	if err := c.ShouldBindJSON(&project); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request body",
			"message": err.Error(),
		})
		return
	}

	// 验证项目路径是否存在
	if _, err := os.Stat(project.Path); os.IsNotExist(err) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "project path not found",
			"message": "The specified project path does not exist",
		})
		return
	}

	// 验证是否有 go.mod 文件
	goModPath := filepath.Join(project.Path, "go.mod")
	if _, err := os.Stat(goModPath); os.IsNotExist(err) {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "not a Go project",
			"message": "go.mod file not found in project directory",
		})
		return
	}

	// 提交扫描任务
	record, err := h.scanService.ScanProject(project.Name, project.Path)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to submit scan",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusAccepted, gin.H{
		"message":     "scan submitted successfully",
		"scan_id":     record.ID,
		"status":      record.Status,
		"project_name": record.ProjectName,
	})
}

// GetScanStatus 获取扫描状态
func (h *Handler) GetScanStatus(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid scan ID",
			"message": "Scan ID must be a valid integer",
		})
		return
	}

	record, err := h.scanService.GetScanRecord(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "scan not found",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"scan_id":      record.ID,
		"project_name": record.ProjectName,
		"project_path": record.ProjectPath,
		"status":       record.Status,
		"error_msg":    record.ErrorMsg,
		"created_at":   record.CreatedAt,
		"updated_at":   record.UpdatedAt,
	})
}

// GetScanResult 获取扫描结果
func (h *Handler) GetScanResult(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid scan ID",
			"message": "Scan ID must be a valid integer",
		})
		return
	}

	record, err := h.scanService.GetScanRecord(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "scan not found",
			"message": err.Error(),
		})
		return
	}

	if record.Status != "completed" {
		c.JSON(http.StatusAccepted, gin.H{
			"message": "scan still in progress",
			"status":  record.Status,
		})
		return
	}

	c.JSON(http.StatusOK, record)
}

// GetAllScans 获取所有扫描记录
func (h *Handler) GetAllScans(c *gin.Context) {
	records, err := h.scanService.GetAllScanRecords()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to get scan records",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"total":  len(records),
		"scans":  records,
	})
}

// MarkFalsePositive 标记误报
func (h *Handler) MarkFalsePositive(c *gin.Context) {
	issueIDStr := c.Param("issue_id")
	issueID, err := strconv.ParseUint(issueIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid issue ID",
			"message": "Issue ID must be a valid integer",
		})
		return
	}

	var req models.FalsePositiveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request body",
			"message": "Reason is required",
		})
		return
	}

	issue, err := h.scanService.MarkFalsePositive(uint(issueID), req.Reason)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "issue not found",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":              "marked as false positive",
		"issue_id":             issue.ID,
		"is_false_positive":    issue.IsFalsePositive,
		"false_positive_reason": issue.FalsePositiveReason,
	})
}

// ResolveIssue 解决问题
func (h *Handler) ResolveIssue(c *gin.Context) {
	issueIDStr := c.Param("issue_id")
	issueID, err := strconv.ParseUint(issueIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid issue ID",
			"message": "Issue ID must be a valid integer",
		})
		return
	}

	issue, err := h.scanService.ResolveIssue(uint(issueID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "issue not found",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "issue resolved",
		"issue_id":  issue.ID,
		"resolved":  issue.Resolved,
		"resolved_at": issue.ResolvedAt,
	})
}

// ExportReport 导出报告
func (h *Handler) ExportReport(c *gin.Context) {
	scanIDStr := c.Param("id")
	scanID, err := strconv.ParseUint(scanIDStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid scan ID",
			"message": "Scan ID must be a valid integer",
		})
		return
	}

	// 获取导出格式
	format := strings.ToLower(c.DefaultQuery("format", "json"))
	if format != "json" && format != "markdown" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid format",
			"message": "Format must be 'json' or 'markdown'",
		})
		return
	}

	// 获取扫描记录
	record, err := h.scanService.GetScanRecord(uint(scanID))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error":   "scan not found",
			"message": err.Error(),
		})
		return
	}

	if record.Status != "completed" {
		c.JSON(http.StatusAccepted, gin.H{
			"message": "scan still in progress",
			"status":  record.Status,
		})
		return
	}

	// 构建报告配置
	config := &models.ReportConfig{
		Format:              format,
		IncludeSummary:      true,
		IncludeDetails:      true,
		ExcludeFalsePositive: c.DefaultQuery("exclude_false_positive", "false") == "true",
	}

	// 按严重程度过滤
	if severityStr := c.Query("severity"); severityStr != "" {
		config.FilterSeverity = strings.Split(severityStr, ",")
	}

	// 导出报告
	var content string
	var contentType string
	var fileName string

	if format == "json" {
		content, err = exporter.ExportToJSON(record, config)
		contentType = "application/json"
		fileName = "quality-report.json"
	} else {
		content, err = exporter.ExportToMarkdown(record, config)
		contentType = "text/markdown"
		fileName = "quality-report.md"
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "failed to export report",
			"message": err.Error(),
		})
		return
	}

	// 设置响应头
	c.Header("Content-Disposition", "attachment; filename="+fileName)
	c.Header("Content-Type", contentType)
	c.String(http.StatusOK, content)
}

// HealthCheck 健康检查
func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "healthy",
		"service": "go-quality-scanner",
	})
}
