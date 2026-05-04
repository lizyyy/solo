package api

import (
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/zy1153/pool-diagnostic/internal/diagnostics"
	"github.com/zy1153/pool-diagnostic/internal/exporter"
	"github.com/zy1153/pool-diagnostic/internal/importer"
	"github.com/zy1153/pool-diagnostic/internal/models"
	"github.com/zy1153/pool-diagnostic/internal/storage"
)

type APIHandler struct {
	store    *storage.BoltStore
	importer *importer.Importer
	engine   *diagnostics.DiagnosticEngine
	exporter *exporter.Exporter
}

func NewAPIHandler(store *storage.BoltStore) *APIHandler {
	engine := diagnostics.NewDiagnosticEngine(store)
	return &APIHandler{
		store:    store,
		importer: importer.NewImporter(store),
		engine:   engine,
		exporter: exporter.NewExporter(store, engine),
	}
}

func RegisterRoutes(r *gin.Engine, store *storage.BoltStore) {
	handler := NewAPIHandler(store)

	api := r.Group("/api/v1")
	{
		// 导入数据
		api.POST("/import/pool-events", handler.ImportPoolEvents)
		api.POST("/import/queries", handler.ImportQueries)
		api.POST("/import/transactions", handler.ImportTransactions)
		api.POST("/import/tenants", handler.ImportTenants)
		api.POST("/import/config", handler.ImportConfig)

		// 查询状态
		api.GET("/pool/status", handler.GetPoolStatus)
		api.GET("/pool/leases/active", handler.GetActiveLeases)
		api.GET("/pool/queue/waiting", handler.GetWaitingQueue)
		api.GET("/pool/tenants", handler.GetTenants)

		// 时间线
		api.GET("/timeline/connection/:connection_id", handler.GetConnectionTimeline)
		api.GET("/timeline/request/:request_id", handler.GetRequestTimeline)

		// 诊断分析
		api.POST("/diagnostics/run", handler.RunDiagnostics)
		api.GET("/diagnostics/alerts", handler.GetAlerts)
		api.PUT("/diagnostics/alerts/:alert_id/status", handler.UpdateAlertStatus)
		api.POST("/diagnostics/alerts/:alert_id/false-positive", handler.MarkFalsePositive)

		// 配置模拟
		api.POST("/simulate/config", handler.SimulateConfigChange)

		// 报告导出
		api.GET("/export/report", handler.ExportReport)

		// 数据清理
		api.DELETE("/data/clear", handler.ClearAllData)
	}
}

// ========== 导入相关 ==========

type ImportFromFileRequest struct {
	FilePath string `json:"file_path" binding:"required"`
}

func (h *APIHandler) ImportPoolEvents(c *gin.Context) {
	var req ImportFromFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	result, err := h.importer.ImportPoolEventsJSONL(req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "import failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "import completed",
		"result":  result,
	})
}

func (h *APIHandler) ImportQueries(c *gin.Context) {
	var req ImportFromFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	result, err := h.importer.ImportQueriesCSV(req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "import failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "import completed",
		"result":  result,
	})
}

func (h *APIHandler) ImportTransactions(c *gin.Context) {
	var req ImportFromFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	result, err := h.importer.ImportTransactionsJSON(req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "import failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "import completed",
		"result":  result,
	})
}

func (h *APIHandler) ImportTenants(c *gin.Context) {
	var req ImportFromFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	result, err := h.importer.ImportTenantsCSV(req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "import failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "import completed",
		"result":  result,
	})
}

func (h *APIHandler) ImportConfig(c *gin.Context) {
	var req ImportFromFileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	result, err := h.importer.ImportPoolConfigYAML(req.FilePath)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "import failed",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "import completed",
		"result":  result,
	})
}

// ========== 状态查询 ==========

func (h *APIHandler) GetPoolStatus(c *gin.Context) {
	pool, err := h.store.GetDefaultPool()
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "pool not found",
			"detail": err.Error(),
		})
		return
	}

	activeLeases, _ := h.store.GetActiveLeases()
	waitingItems, _ := h.store.GetActiveQueueItems()
	alerts, _ := h.store.GetOpenAlerts()

	status := gin.H{
		"pool":               pool,
		"active_connections": len(activeLeases),
		"waiting_requests":   len(waitingItems),
		"open_alerts":        len(alerts),
		"generated_at":       time.Now(),
	}

	c.JSON(http.StatusOK, status)
}

func (h *APIHandler) GetActiveLeases(c *gin.Context) {
	leases, err := h.store.GetActiveLeases()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get active leases",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":  len(leases),
		"leases": leases,
	})
}

func (h *APIHandler) GetWaitingQueue(c *gin.Context) {
	items, err := h.store.GetActiveQueueItems()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get waiting queue",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count": len(items),
		"items": items,
	})
}

func (h *APIHandler) GetTenants(c *gin.Context) {
	tenants, err := h.store.GetAllTenants()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get tenants",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":   len(tenants),
		"tenants": tenants,
	})
}

// ========== 时间线 ==========

func (h *APIHandler) GetConnectionTimeline(c *gin.Context) {
	connectionID := c.Param("connection_id")
	if connectionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "connection_id is required",
		})
		return
	}

	events, err := h.engine.GetConnectionTimeline(connectionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get connection timeline",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"connection_id": connectionID,
		"event_count":   len(events),
		"events":        events,
	})
}

func (h *APIHandler) GetRequestTimeline(c *gin.Context) {
	requestID := c.Param("request_id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "request_id is required",
		})
		return
	}

	events, err := h.engine.GetRequestTimeline(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get request timeline",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"request_id":  requestID,
		"event_count": len(events),
		"events":      events,
	})
}

// ========== 诊断分析 ==========

func (h *APIHandler) RunDiagnostics(c *gin.Context) {
	result, err := h.engine.RunFullDiagnostics()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to run diagnostics",
			"detail": err.Error(),
		})
		return
	}

	// 保存告警到数据库
	for i := range result.Alerts {
		if err := h.store.CreateAlert(&result.Alerts[i]); err != nil {
			// 记录错误但继续
			continue
		}
	}

	c.JSON(http.StatusOK, result)
}

func (h *APIHandler) GetAlerts(c *gin.Context) {
	status := c.DefaultQuery("status", "open")

	var alerts []models.Alert
	var err error

	if strings.ToLower(status) == "all" {
		alerts, err = h.store.GetAllAlerts()
	} else {
		alerts, err = h.store.GetOpenAlerts()
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to get alerts",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"count":  len(alerts),
		"alerts": alerts,
	})
}

type UpdateAlertStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *APIHandler) UpdateAlertStatus(c *gin.Context) {
	alertID := c.Param("alert_id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "alert_id is required",
		})
		return
	}

	var req UpdateAlertStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	alert, err := h.store.GetAlert(alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "alert not found",
			"detail": err.Error(),
		})
		return
	}

	// 验证状态值
	validStatuses := map[models.AlertStatus]bool{
		models.AlertStatusOpen:         true,
		models.AlertStatusAcknowledged: true,
		models.AlertStatusResolved:     true,
	}

	newStatus := models.AlertStatus(req.Status)
	if !validStatuses[newStatus] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid status",
			"valid_statuses": []string{
				string(models.AlertStatusOpen),
				string(models.AlertStatusAcknowledged),
				string(models.AlertStatusResolved),
			},
		})
		return
	}

	alert.Status = newStatus
	now := time.Now()
	alert.LastSeenAt = &now

	if err := h.store.UpdateAlert(alert); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update alert",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "alert status updated",
		"alert_id": alertID,
		"status":   newStatus,
	})
}

func (h *APIHandler) MarkFalsePositive(c *gin.Context) {
	alertID := c.Param("alert_id")
	if alertID == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "alert_id is required",
		})
		return
	}

	alert, err := h.store.GetAlert(alertID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "alert not found",
			"detail": err.Error(),
		})
		return
	}

	alert.Status = models.AlertStatusFalsePositive
	alert.IsFalsePositive = true
	now := time.Now()
	alert.ConfirmedAt = &now

	if err := h.store.UpdateAlert(alert); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to update alert",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":          "alert marked as false positive",
		"alert_id":         alertID,
		"is_false_positive": true,
	})
}

// ========== 配置模拟 ==========

func (h *APIHandler) SimulateConfigChange(c *gin.Context) {
	var req models.PoolConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "invalid request body",
			"detail": err.Error(),
		})
		return
	}

	// 验证配置值
	if req.MaxOpen <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "max_open must be positive",
			"field": "max_open",
		})
		return
	}

	if req.MaxIdle < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "max_idle must be non-negative",
			"field": "max_idle",
		})
		return
	}

	if req.MaxIdle > req.MaxOpen {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "max_idle cannot be greater than max_open",
			"max_idle":  req.MaxIdle,
			"max_open":  req.MaxOpen,
		})
		return
	}

	if req.IdleTimeout <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "idle_timeout must be positive",
			"field": "idle_timeout",
		})
		return
	}

	if req.TenantQuota < 0 {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "tenant_quota must be non-negative",
			"field": "tenant_quota",
		})
		return
	}

	simulation, err := h.engine.SimulateConfigChange(req)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "failed to simulate config change",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, simulation)
}

// ========== 报告导出 ==========

func (h *APIHandler) ExportReport(c *gin.Context) {
	format := c.DefaultQuery("format", "markdown")
	format = strings.ToLower(format)

	// 验证格式
	validFormats := map[string]bool{
		"json":     true,
		"csv":      true,
		"markdown": true,
		"md":       true,
	}

	if !validFormats[format] {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":         "unsupported format",
			"valid_formats": []string{"json", "csv", "markdown", "md"},
		})
		return
	}

	report, err := h.exporter.ExportReport(format)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to export report",
			"detail": err.Error(),
		})
		return
	}

	// 根据格式设置 Content-Type
	switch format {
	case "json":
		c.Data(http.StatusOK, "application/json", []byte(report.Content))
	case "csv":
		c.Data(http.StatusOK, "text/csv", []byte(report.Content))
	case "markdown", "md":
		// 尝试返回结构化数据，这样更易于查看
		var jsonData map[string]interface{}
		if err := json.Unmarshal([]byte(report.Content), &jsonData); err == nil {
			c.JSON(http.StatusOK, gin.H{
				"format":     "markdown",
				"content":    report.Content,
				"generated_at": report.GeneratedAt,
			})
			return
		}
		c.Data(http.StatusOK, "text/markdown", []byte(report.Content))
	}
}

// ========== 数据清理 ==========

func (h *APIHandler) ClearAllData(c *gin.Context) {
	if err := h.store.ClearAllData(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "failed to clear data",
			"detail": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "all data cleared",
		"timestamp": time.Now(),
	})
}
