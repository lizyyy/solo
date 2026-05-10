package api

import (
	"context"
	"encoding/json"
	"net/http"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"

	"migration-chaos-simulator/internal/chaos"
	"migration-chaos-simulator/internal/logger"
	"migration-chaos-simulator/internal/migration"
	"migration-chaos-simulator/internal/reporter"
	"migration-chaos-simulator/internal/tracer"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type APIServer struct {
	chaosEngine  *chaos.ChaosEngine
	migExecutor  *migration.MigrationExecutor
	tracer       *tracer.Tracer
	reporter     *reporter.Reporter
	wsClients    map[*websocket.Conn]bool
	wsMutex      sync.RWMutex
	migrations   map[string]*migration.Migration
	migResults   map[string]*migration.MigrationResult
	migrationsMu sync.RWMutex
}

func NewAPIServer(
	chaosEngine *chaos.ChaosEngine,
	migExecutor *migration.MigrationExecutor,
	tr *tracer.Tracer,
	rep *reporter.Reporter,
) *APIServer {
	return &APIServer{
		chaosEngine: chaosEngine,
		migExecutor: migExecutor,
		tracer:      tr,
		reporter:    rep,
		wsClients:   make(map[*websocket.Conn]bool),
		migrations:  make(map[string]*migration.Migration),
		migResults:  make(map[string]*migration.MigrationResult),
	}
}

func (s *APIServer) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		api.GET("/health", s.healthCheck)
		api.GET("/stats", s.getStats)

		chaos := api.Group("/chaos")
		{
			chaos.GET("/types", s.getChaosTypes)
			chaos.GET("/experiments", s.listExperiments)
			chaos.POST("/experiments", s.startExperiment)
			chaos.GET("/experiments/:id", s.getExperiment)
			chaos.POST("/experiments/:id/stop", s.stopExperiment)
			chaos.GET("/experiments/:id/report", s.getChaosReport)
		}

		mig := api.Group("/migrations")
		{
			mig.GET("/templates", s.getMigrationTemplates)
			mig.POST("/plan", s.planMigration)
			mig.POST("/execute", s.executeMigration)
			mig.POST("/dry-run", s.dryRunMigration)
			mig.GET("/:id", s.getMigration)
			mig.GET("/:id/report", s.getMigrationReport)
		}

		reports := api.Group("/reports")
		{
			reports.GET("/export", s.exportReport)
			reports.GET("/:id", s.getReport)
		}

		ws := api.Group("/ws")
		{
			ws.GET("/events", s.handleWebSocket)
		}
	}
}

func (s *APIServer) healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "ok",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (s *APIServer) getStats(c *gin.Context) {
	exps := s.chaosEngine.ListExperiments()

	running := 0
	var totalRequests int64
	var totalErrors int64

	for _, exp := range exps {
		if exp.Status == chaos.ChaosStatusRunning {
			running++
		}
		totalRequests += exp.TotalRequests
		totalErrors += exp.ErrorCount
	}

	s.migrationsMu.RLock()
	migCount := len(s.migrations)
	s.migrationsMu.RUnlock()

	c.JSON(http.StatusOK, gin.H{
		"active_experiments": running,
		"total_experiments":  len(exps),
		"total_requests":     totalRequests,
		"total_errors":       totalErrors,
		"total_migrations":   migCount,
		"active_traces":      len(s.tracer.ListActiveTraces()),
	})
}

func (s *APIServer) getChaosTypes(c *gin.Context) {
	types := []map[string]interface{}{
		{"type": "high_concurrency", "name": "高并发", "description": "模拟大量并发请求", "risk": "high"},
		{"type": "timeout", "name": "服务超时", "description": "注入请求超时", "risk": "medium"},
		{"type": "network_drop", "name": "网络中断", "description": "模拟网络连接中断和重试", "risk": "high"},
		{"type": "duplicate_request", "name": "重复请求", "description": "模拟请求被重复发送", "risk": "high"},
		{"type": "duplicate_message", "name": "消息重复消费", "description": "模拟消息队列重复投递", "risk": "high"},
		{"type": "slow_query", "name": "慢查询", "description": "模拟数据库慢查询", "risk": "medium"},
		{"type": "connection_drop", "name": "连接断开", "description": "模拟数据库连接断开", "risk": "critical"},
		{"type": "lock_contention", "name": "锁竞争", "description": "模拟数据库锁竞争", "risk": "high"},
	}
	c.JSON(http.StatusOK, types)
}

func (s *APIServer) listExperiments(c *gin.Context) {
	exps := s.chaosEngine.ListExperiments()
	c.JSON(http.StatusOK, exps)
}

type StartExperimentRequest struct {
	Name   string                 `json:"name" binding:"required"`
	Type   string                 `json:"type" binding:"required"`
	Config chaos.ExperimentConfig `json:"config"`
}

func (s *APIServer) startExperiment(c *gin.Context) {
	var req StartExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	exp, err := s.chaosEngine.StartExperiment(
		c.Request.Context(),
		req.Name,
		chaos.ChaosType(req.Type),
		req.Config,
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	s.broadcastEvent("experiment_started", exp)

	c.JSON(http.StatusOK, exp)
}

func (s *APIServer) getExperiment(c *gin.Context) {
	id := c.Param("id")
	exp, ok := s.chaosEngine.GetExperiment(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "experiment not found"})
		return
	}
	c.JSON(http.StatusOK, exp)
}

func (s *APIServer) stopExperiment(c *gin.Context) {
	id := c.Param("id")
	if err := s.chaosEngine.StopExperiment(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	s.broadcastEvent("experiment_stopped", gin.H{"id": id})
	c.JSON(http.StatusOK, gin.H{"message": "experiment stopped"})
}

func (s *APIServer) getChaosReport(c *gin.Context) {
	id := c.Param("id")
	exp, ok := s.chaosEngine.GetExperiment(id)
	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "experiment not found"})
		return
	}

	trace, _ := s.tracer.GetTrace(exp.TraceID)
	report := s.reporter.GenerateChaosReport(exp, trace)
	c.JSON(http.StatusOK, report)
}

func (s *APIServer) getMigrationTemplates(c *gin.Context) {
	templates := []map[string]interface{}{
		{
			"id":          "add_column",
			"name":        "添加列",
			"description": "安全地添加新列（可为空）",
			"steps":       []string{"创建新列（可为空）", "回填数据", "添加索引"},
		},
		{
			"id":          "rename_column",
			"name":        "重命名列",
			"description": "安全地重命名列（双写策略）",
			"steps":       []string{"添加新列", "双写新旧列", "迁移旧数据", "切换读取到新列", "清理旧列"},
		},
		{
			"id":          "change_column_type",
			"name":        "修改列类型",
			"description": "修改列数据类型",
			"steps":       []string{"创建新类型列", "数据转换", "创建索引", "切换", "清理"},
		},
		{
			"id":          "add_unique_constraint",
			"name":        "添加唯一约束",
			"description": "添加唯一索引/约束",
			"risk":        "critical",
			"steps":       []string{"检查重复数据", "创建唯一索引 CONCURRENTLY", "添加约束"},
		},
	}
	c.JSON(http.StatusOK, templates)
}

type CreateMigrationRequest struct {
	Name        string                     `json:"name" binding:"required"`
	Version     string                     `json:"version" binding:"required"`
	Description string                     `json:"description"`
	Steps       []*migration.MigrationStep `json:"steps" binding:"required"`
}

func (s *APIServer) planMigration(c *gin.Context) {
	var req CreateMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	m := s.migExecutor.CreateMigration(req.Name, req.Version, req.Description, req.Steps)
	plan := s.migExecutor.Plan(m)

	s.migrationsMu.Lock()
	s.migrations[m.ID] = m
	s.migrationsMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"migration_id": m.ID,
		"migration":    m,
		"plan":         plan,
	})
}

func (s *APIServer) executeMigration(c *gin.Context) {
	var req CreateMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	m := s.migExecutor.CreateMigration(req.Name, req.Version, req.Description, req.Steps)

	s.broadcastEvent("migration_started", gin.H{
		"id":   m.ID,
		"name": m.Name,
	})

	result, err := s.migExecutor.Execute(context.Background(), m)

	s.migrationsMu.Lock()
	s.migrations[m.ID] = m
	s.migResults[m.ID] = result
	s.migrationsMu.Unlock()

	s.broadcastEvent("migration_completed", gin.H{
		"id":     m.ID,
		"status": result.Status,
		"error":  err,
	})

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"migration": m,
			"result":    result,
			"error":     err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"migration": m,
		"result":    result,
	})
}

func (s *APIServer) dryRunMigration(c *gin.Context) {
	var req CreateMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dryRunConfig := migration.MigrationConfig{
		EnableDryRun: true,
	}
	dryRunExecutor := migration.NewExecutor(nil, s.tracer, dryRunConfig)
	m := dryRunExecutor.CreateMigration(req.Name, req.Version, req.Description, req.Steps)

	plan := s.migExecutor.Plan(m)

	c.JSON(http.StatusOK, gin.H{
		"migration_id": m.ID,
		"migration":    m,
		"plan":         plan,
		"dry_run":      true,
		"message":      "Dry run completed - no actual changes made",
	})
}

func (s *APIServer) getMigration(c *gin.Context) {
	id := c.Param("id")
	s.migrationsMu.RLock()
	m, ok := s.migrations[id]
	result := s.migResults[id]
	s.migrationsMu.RUnlock()

	if !ok {
		c.JSON(http.StatusNotFound, gin.H{"error": "migration not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"migration": m,
		"result":    result,
	})
}

func (s *APIServer) getMigrationReport(c *gin.Context) {
	id := c.Param("id")
	s.migrationsMu.RLock()
	m, ok := s.migrations[id]
	result := s.migResults[id]
	s.migrationsMu.RUnlock()

	if !ok || result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "migration or result not found"})
		return
	}

	report := s.reporter.GenerateMigrationReport(m, result)
	c.JSON(http.StatusOK, report)
}

func (s *APIServer) getReport(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"message": "report endpoint"})
}

func (s *APIServer) exportReport(c *gin.Context) {
	format := c.DefaultQuery("format", "json")

	migID := c.Query("migration_id")
	expID := c.Query("experiment_id")

	var report *reporter.FullReport

	if migID != "" && expID != "" {
		s.migrationsMu.RLock()
		m := s.migrations[migID]
		migResult := s.migResults[migID]
		s.migrationsMu.RUnlock()

		exp, _ := s.chaosEngine.GetExperiment(expID)
		trace, _ := s.tracer.GetTrace(exp.TraceID)

		report = s.reporter.GenerateCombinedReport(m, migResult,
			[]*chaos.ChaosExperiment{exp},
			[]*tracer.Trace{trace},
		)
	} else if migID != "" {
		s.migrationsMu.RLock()
		m := s.migrations[migID]
		migResult := s.migResults[migID]
		s.migrationsMu.RUnlock()

		if m == nil || migResult == nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "migration not found"})
			return
		}
		report = s.reporter.GenerateMigrationReport(m, migResult)
	} else if expID != "" {
		exp, ok := s.chaosEngine.GetExperiment(expID)
		if !ok {
			c.JSON(http.StatusNotFound, gin.H{"error": "experiment not found"})
			return
		}
		trace, _ := s.tracer.GetTrace(exp.TraceID)
		report = s.reporter.GenerateChaosReport(exp, trace)
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "migration_id or experiment_id required"})
		return
	}

	var filepath string
	var err error

	switch format {
	case "json":
		filepath, err = s.reporter.Export(report, reporter.FormatJSON)
		c.Header("Content-Type", "application/json")
	case "markdown", "md":
		filepath, err = s.reporter.Export(report, reporter.FormatMarkdown)
		c.Header("Content-Type", "text/markdown")
	case "html":
		filepath, err = s.reporter.Export(report, reporter.FormatHTML)
		c.Header("Content-Type", "text/html")
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported format: " + format})
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.File(filepath)
}

func (s *APIServer) handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		logger.Error("WebSocket upgrade failed", zap.Error(err))
		return
	}

	s.wsMutex.Lock()
	s.wsClients[conn] = true
	s.wsMutex.Unlock()

	logger.Info("WebSocket client connected")

	defer func() {
		s.wsMutex.Lock()
		delete(s.wsClients, conn)
		s.wsMutex.Unlock()
		conn.Close()
		logger.Info("WebSocket client disconnected")
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}

func (s *APIServer) broadcastEvent(eventType string, data interface{}) {
	message := map[string]interface{}{
		"type":      eventType,
		"data":      data,
		"timestamp": time.Now().Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(message)
	if err != nil {
		logger.Error("Failed to marshal WS message", zap.Error(err))
		return
	}

	s.wsMutex.RLock()
	defer s.wsMutex.RUnlock()

	for client := range s.wsClients {
		if err := client.WriteMessage(websocket.TextMessage, jsonData); err != nil {
			logger.Warn("Failed to send WS message", zap.Error(err))
		}
	}
}
