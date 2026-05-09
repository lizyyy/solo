package api

import (
	"context"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"grayscale-simulator/internal/service"
	"grayscale-simulator/pkg/logger"
)

type Handler struct {
	grayReleaseService   *service.GrayReleaseService
	rollbackEngine       *service.RollbackEngine
	faultInjectionService *service.FaultInjectionService
	messageConsumer      *service.MessageConsumerService
	traceService         *service.TraceService
	reportService        *service.ReportService
}

func NewHandler(
	grayRelease *service.GrayReleaseService,
	rollback *service.RollbackEngine,
	faultInjection *service.FaultInjectionService,
	consumer *service.MessageConsumerService,
	trace *service.TraceService,
	report *service.ReportService,
) *Handler {
	return &Handler{
		grayReleaseService:   grayRelease,
		rollbackEngine:       rollback,
		faultInjectionService: faultInjection,
		messageConsumer:      consumer,
		traceService:         trace,
		reportService:        report,
	}
}

type Response struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

func respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, Response{
		Success: true,
		Data:    data,
	})
}

func respondError(c *gin.Context, code int, message string) {
	c.JSON(code, Response{
		Success: false,
		Error:   message,
	})
}

func (h *Handler) CreateRelease(c *gin.Context) {
	ctx := context.Background()

	var req struct {
		ServiceName    string                 `json:"service_name" binding:"required"`
		Version        string                 `json:"version" binding:"required"`
		Description    string                 `json:"description"`
		Strategy       string                 `json:"strategy"`
		StrategyConfig map[string]interface{} `json:"strategy_config"`
		CreatedBy      string                 `json:"created_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	release, err := h.grayReleaseService.CreateRelease(ctx,
		req.ServiceName, req.Version, req.Description,
		req.Strategy, req.StrategyConfig, req.CreatedBy)

	if err != nil {
		logger.Errorf("Failed to create release: %v", err)
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, release)
}

func (h *Handler) StartRelease(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	if err := h.grayReleaseService.StartRelease(ctx, releaseID); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "started"})
}

func (h *Handler) PauseRelease(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	if err := h.grayReleaseService.PauseRelease(ctx, releaseID); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "paused"})
}

func (h *Handler) CompleteRelease(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	if err := h.grayReleaseService.CompleteRelease(ctx, releaseID); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "completed"})
}

func (h *Handler) GetRelease(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	release, err := h.grayReleaseService.GetReleaseByID(ctx, releaseID)
	if err != nil {
		respondError(c, http.StatusNotFound, "Release not found")
		return
	}

	respondSuccess(c, release)
}

func (h *Handler) ListReleases(c *gin.Context) {
	ctx := context.Background()
	serviceName := c.Query("service_name")
	status := c.Query("status")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	releases, err := h.grayReleaseService.ListReleases(ctx, serviceName, status, limit, offset)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, releases)
}

func (h *Handler) AddInstance(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	var req struct {
		InstanceID string `json:"instance_id" binding:"required"`
		Host       string `json:"host"`
		Port       int    `json:"port"`
		Version    string `json:"version"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.grayReleaseService.AddInstance(ctx, releaseID, req.InstanceID, req.Host, req.Port, req.Version); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "added"})
}

func (h *Handler) TriggerRollback(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Param("id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)

	var req struct {
		TriggerType string `json:"trigger_type" binding:"required"`
		TriggerBy   string `json:"trigger_by"`
		Reason      string `json:"reason" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	record, err := h.rollbackEngine.TriggerRollback(ctx, releaseID, req.TriggerType, req.TriggerBy, req.Reason)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, record)
}

func (h *Handler) GetRollback(c *gin.Context) {
	ctx := context.Background()
	rollbackIDStr := c.Param("id")
	rollbackID, _ := strconv.ParseInt(rollbackIDStr, 10, 64)

	record, err := h.rollbackEngine.GetRollbackByID(ctx, rollbackID)
	if err != nil {
		respondError(c, http.StatusNotFound, "Rollback not found")
		return
	}

	respondSuccess(c, record)
}

func (h *Handler) GetRollbackSteps(c *gin.Context) {
	ctx := context.Background()
	rollbackIDStr := c.Param("id")
	rollbackID, _ := strconv.ParseInt(rollbackIDStr, 10, 64)

	steps, err := h.rollbackEngine.GetRollbackSteps(ctx, rollbackID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, steps)
}

func (h *Handler) ListRollbacks(c *gin.Context) {
	ctx := context.Background()
	releaseIDStr := c.Query("release_id")
	releaseID, _ := strconv.ParseInt(releaseIDStr, 10, 64)
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	records, err := h.rollbackEngine.ListRollbacks(ctx, releaseID, limit, offset)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, records)
}

func (h *Handler) CreateFaultConfig(c *gin.Context) {
	ctx := context.Background()

	var req struct {
		Name            string                 `json:"name" binding:"required"`
		FaultType       string                 `json:"fault_type" binding:"required"`
		TargetService   string                 `json:"target_service"`
		Enabled         bool                   `json:"enabled"`
		Config          map[string]interface{} `json:"config"`
		Probability     float64                `json:"probability"`
		DurationSeconds int                    `json:"duration_seconds"`
		CreatedBy       string                 `json:"created_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	cfg, err := h.faultInjectionService.CreateFaultConfig(ctx,
		req.Name, req.FaultType, req.TargetService,
		req.Enabled, req.Config, req.Probability, req.DurationSeconds, req.CreatedBy)

	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, cfg)
}

func (h *Handler) UpdateFaultConfig(c *gin.Context) {
	ctx := context.Background()
	idStr := c.Param("id")
	id, _ := strconv.ParseInt(idStr, 10, 64)

	var req struct {
		Enabled     bool    `json:"enabled"`
		Probability float64 `json:"probability"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.faultInjectionService.UpdateFaultConfig(ctx, id, req.Enabled, req.Probability); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "updated"})
}

func (h *Handler) ListFaultConfigs(c *gin.Context) {
	ctx := context.Background()
	targetService := c.Query("target_service")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	configs, err := h.faultInjectionService.ListFaultConfigs(ctx, targetService, limit, 0)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, configs)
}

func (h *Handler) SimulateFaultRequest(c *gin.Context) {
	targetService := c.Query("target_service")
	if targetService == "" {
		targetService = "test-service"
	}

	statusCode, err := h.faultInjectionService.SimulateRequest(targetService)

	result := map[string]interface{}{
		"target_service": targetService,
		"status_code":    statusCode,
	}

	if err != nil {
		result["error"] = err.Error()
	}

	respondSuccess(c, result)
}

func (h *Handler) GetTrace(c *gin.Context) {
	ctx := context.Background()
	traceID := c.Param("id")

	spans, err := h.traceService.GetTraceByID(ctx, traceID)
	if err != nil {
		respondError(c, http.StatusNotFound, "Trace not found")
		return
	}

	respondSuccess(c, spans)
}

func (h *Handler) AnalyzeTrace(c *gin.Context) {
	ctx := context.Background()
	traceID := c.Param("id")

	analysis, err := h.traceService.AnalyzeTrace(ctx, traceID)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, analysis)
}

func (h *Handler) SearchTraces(c *gin.Context) {
	ctx := context.Background()
	serviceName := c.Query("service_name")
	operationName := c.Query("operation_name")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	var startTime, endTime time.Time
	if start := c.Query("start_time"); start != "" {
		startTime, _ = time.Parse(time.RFC3339, start)
	}
	if end := c.Query("end_time"); end != "" {
		endTime, _ = time.Parse(time.RFC3339, end)
	}

	spans, err := h.traceService.SearchTraces(ctx, serviceName, operationName, startTime, endTime, limit, 0)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, spans)
}

func (h *Handler) GetErrorTraces(c *gin.Context) {
	ctx := context.Background()
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	spans, err := h.traceService.GetErrorTraces(ctx, limit)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, spans)
}

func (h *Handler) CreateReport(c *gin.Context) {
	ctx := context.Background()

	var req struct {
		Title             string   `json:"title" binding:"required"`
		Severity          string   `json:"severity" binding:"required"`
		Category          string   `json:"category"`
		TriggerReleaseID  *int64   `json:"trigger_release_id"`
		TriggerRollbackID *int64   `json:"trigger_rollback_id"`
		AffectedServices  []string `json:"affected_services"`
		RootCause         string   `json:"root_cause"`
		ImpactAnalysis    string   `json:"impact_analysis"`
		ResolutionSteps   string   `json:"resolution_steps"`
		ReportedBy        string   `json:"reported_by"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	report, err := h.reportService.CreateIncidentReport(ctx,
		req.Title, req.Severity, req.Category,
		req.TriggerReleaseID, req.TriggerRollbackID,
		req.AffectedServices, req.RootCause, req.ImpactAnalysis,
		req.ResolutionSteps, req.ReportedBy)

	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, report)
}

func (h *Handler) GetReport(c *gin.Context) {
	ctx := context.Background()
	reportIDStr := c.Param("id")
	reportID, _ := strconv.ParseInt(reportIDStr, 10, 64)

	report, err := h.reportService.GetReportByID(ctx, reportID)
	if err != nil {
		respondError(c, http.StatusNotFound, "Report not found")
		return
	}

	respondSuccess(c, report)
}

func (h *Handler) ListReports(c *gin.Context) {
	ctx := context.Background()
	status := c.Query("status")
	severity := c.Query("severity")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	reports, err := h.reportService.ListReports(ctx, status, severity, limit, 0)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, reports)
}

func (h *Handler) ExportReport(c *gin.Context) {
	ctx := context.Background()
	reportIDStr := c.Param("id")
	reportID, _ := strconv.ParseInt(reportIDStr, 10, 64)
	format := c.DefaultQuery("format", "json")

	filePath, err := h.reportService.ExportReport(ctx, reportID, format)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]interface{}{
		"file_path": filePath,
		"format":    format,
	})
}

func (h *Handler) ResolveReport(c *gin.Context) {
	ctx := context.Background()
	reportIDStr := c.Param("id")
	reportID, _ := strconv.ParseInt(reportIDStr, 10, 64)

	var req struct {
		Resolution string `json:"resolution" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		respondError(c, http.StatusBadRequest, err.Error())
		return
	}

	if err := h.reportService.ResolveReport(ctx, reportID, req.Resolution); err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, map[string]string{"status": "resolved"})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (h *Handler) GetDedupRecords(c *gin.Context) {
	ctx := context.Background()
	messageID := c.Query("message_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	records, err := h.messageConsumer.GetDedupRecords(ctx, messageID, limit)
	if err != nil {
		respondError(c, http.StatusInternalServerError, err.Error())
		return
	}

	respondSuccess(c, records)
}

