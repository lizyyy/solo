package handler

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/model"
	"cache-risk-analyzer/internal/service"

	"github.com/gin-gonic/gin"
)

func ImportCacheEvents(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to read request body: %v", err)})
		return
	}

	result, err := service.ImportCacheEventsFromJSONL(bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ImportKeys(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")
	var body []byte
	var err error

	if strings.Contains(contentType, "multipart/form-data") {
		file, _, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to get file: %v", err)})
			return
		}
		defer file.Close()
		body, err = io.ReadAll(file)
	} else {
		body, err = io.ReadAll(c.Request.Body)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to read input: %v", err)})
		return
	}

	result, err := service.ImportKeysFromCSV(bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ImportBackendMetrics(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")
	var body []byte
	var err error

	if strings.Contains(contentType, "multipart/form-data") {
		file, _, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to get file: %v", err)})
			return
		}
		defer file.Close()
		body, err = io.ReadAll(file)
	} else {
		body, err = io.ReadAll(c.Request.Body)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to read input: %v", err)})
		return
	}

	result, err := service.ImportBackendMetricsFromCSV(bytes.NewReader(body))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ImportTrafficPlan(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to read request body: %v", err)})
		return
	}

	result, err := service.ImportTrafficPlanFromJSON(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func ImportStrategy(c *gin.Context) {
	contentType := c.GetHeader("Content-Type")
	var body []byte
	var err error

	if strings.Contains(contentType, "multipart/form-data") {
		file, _, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to get file: %v", err)})
			return
		}
		defer file.Close()
		body, err = io.ReadAll(file)
	} else if strings.Contains(contentType, "application/yaml") || strings.Contains(contentType, "text/yaml") {
		body, err = io.ReadAll(c.Request.Body)
	} else {
		var req struct {
			YAML string `json:"yaml"`
		}
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request: %v", err)})
			return
		}
		body = []byte(req.YAML)
	}

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Failed to read input: %v", err)})
		return
	}

	result, err := service.ImportStrategyFromYAML(body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func AnalyzeRisks(c *gin.Context) {
	result, err := service.AnalyzeAllRisks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Analysis failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetRiskDetails(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid risk ID"})
		return
	}

	database := db.GetDB()
	var risk model.RiskEvent
	var evidenceJSON string

	err = database.QueryRow(`
		SELECT id, risk_type, severity, business_domain, cache_key, evidence_json,
		       impact_score, recommended_action, detected_at, is_resolved, resolved_at, created_at
		FROM risk_events
		WHERE id = ?
	`, id).Scan(
		&risk.ID, &risk.RiskType, &risk.Severity, &risk.BusinessDomain,
		&risk.CacheKey, &evidenceJSON, &risk.ImpactScore,
		&risk.RecommendedAction, &risk.DetectedAt, &risk.IsResolved,
		&risk.ResolvedAt, &risk.CreatedAt,
	)

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Risk not found"})
		return
	}

	var evidence map[string]interface{}
	json.Unmarshal([]byte(evidenceJSON), &evidence)

	c.JSON(http.StatusOK, gin.H{
		"risk":              risk,
		"evidence_detailed": evidence,
	})
}

func RunSimulation(c *gin.Context) {
	var req struct {
		Strategies     []service.StrategyConfig `json:"strategies"`
		BusinessDomain string                   `json:"business_domain,omitempty"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request: %v", err)})
		return
	}

	result, err := service.RunSimulation(req.Strategies, req.BusinessDomain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Simulation failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, result)
}

func GetSimulationResult(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid simulation ID"})
		return
	}

	result, err := service.GetSimulationResultByID(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Simulation result not found"})
		return
	}

	c.JSON(http.StatusOK, result)
}

func CompareStrategies(c *gin.Context) {
	businessDomain := c.Query("business_domain")

	result, err := service.CompareAllStrategies(businessDomain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": fmt.Sprintf("Comparison failed: %v", err)})
		return
	}

	c.JSON(http.StatusOK, result)
}

func QueryEvents(c *gin.Context) {
	database := db.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	domain := c.Query("business_domain")
	key := c.Query("cache_key")
	isHit := c.Query("is_hit")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if domain != "" {
		whereClauses = append(whereClauses, "business_domain = ?")
		args = append(args, domain)
	}
	if key != "" {
		whereClauses = append(whereClauses, "cache_key LIKE ?")
		args = append(args, "%"+key+"%")
	}
	if isHit != "" {
		whereClauses = append(whereClauses, "is_hit = ?")
		hitVal := strings.ToLower(isHit) == "true" || isHit == "1"
		args = append(args, hitVal)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int64
	database.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM cache_events WHERE %s", whereSQL), args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT id, timestamp, business_domain, cache_key, ttl_seconds, is_hit,
		       backend_latency_ms, request_source, created_at
		FROM cache_events
		WHERE %s
		ORDER BY timestamp DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, pageSize, offset)
	rows, err := database.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var events []model.CacheEvent
	for rows.Next() {
		var e model.CacheEvent
		rows.Scan(&e.ID, &e.Timestamp, &e.BusinessDomain, &e.CacheKey,
			&e.TTL, &e.IsHit, &e.BackendLatency, &e.RequestSource, &e.CreatedAt)
		events = append(events, e)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"events":    events,
	})
}

func QueryKeys(c *gin.Context) {
	database := db.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	domain := c.Query("business_domain")
	key := c.Query("cache_key")
	isHot := c.Query("is_hot")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if domain != "" {
		whereClauses = append(whereClauses, "business_domain = ?")
		args = append(args, domain)
	}
	if key != "" {
		whereClauses = append(whereClauses, "cache_key LIKE ?")
		args = append(args, "%"+key+"%")
	}
	if isHot != "" {
		whereClauses = append(whereClauses, "is_hot = ?")
		hotVal := strings.ToLower(isHot) == "true" || isHot == "1"
		args = append(args, hotVal)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int64
	database.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM cache_keys WHERE %s", whereSQL), args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT id, business_domain, cache_key, ttl_seconds, expire_at, is_hot,
		       access_count, last_access_at, data_type, created_at, updated_at
		FROM cache_keys
		WHERE %s
		ORDER BY access_count DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, pageSize, offset)
	rows, err := database.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var keys []model.CacheKey
	for rows.Next() {
		var k model.CacheKey
		rows.Scan(&k.ID, &k.BusinessDomain, &k.CacheKey, &k.TTL,
			&k.ExpireAt, &k.IsHot, &k.AccessCount, &k.LastAccessAt,
			&k.DataType, &k.CreatedAt, &k.UpdatedAt)
		keys = append(keys, k)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"keys":      keys,
	})
}

func QueryBackendMetrics(c *gin.Context) {
	database := db.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	domain := c.Query("business_domain")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if domain != "" {
		whereClauses = append(whereClauses, "business_domain = ?")
		args = append(args, domain)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int64
	database.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM backend_metrics WHERE %s", whereSQL), args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT id, business_domain, timestamp, max_connections, current_connections,
		       qps, max_qps, avg_latency_ms, p95_latency_ms, p99_latency_ms,
		       error_rate, cpu_usage, memory_usage, created_at
		FROM backend_metrics
		WHERE %s
		ORDER BY timestamp DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, pageSize, offset)
	rows, err := database.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var metrics []model.BackendMetric
	for rows.Next() {
		var m model.BackendMetric
		rows.Scan(&m.ID, &m.BusinessDomain, &m.Timestamp, &m.MaxConnections,
			&m.CurrentConnections, &m.QueryPerSecond, &m.MaxQPS, &m.AvgLatencyMS,
			&m.P95LatencyMS, &m.P99LatencyMS, &m.ErrorRate, &m.CPUUsage, &m.MemoryUsage, &m.CreatedAt)
		metrics = append(metrics, m)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"metrics":   metrics,
	})
}

func QueryAudits(c *gin.Context) {
	database := db.GetDB()

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "100"))
	operation := c.Query("operation")
	resource := c.Query("resource")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 1000 {
		pageSize = 100
	}

	offset := (page - 1) * pageSize

	whereClauses := []string{"1=1"}
	args := []interface{}{}

	if operation != "" {
		whereClauses = append(whereClauses, "operation = ?")
		args = append(args, operation)
	}
	if resource != "" {
		whereClauses = append(whereClauses, "resource = ?")
		args = append(args, resource)
	}

	whereSQL := strings.Join(whereClauses, " AND ")

	var total int64
	database.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM audit_logs WHERE %s", whereSQL), args...).Scan(&total)

	query := fmt.Sprintf(`
		SELECT id, operation, resource, method, path, user_agent, ip_address,
		       status_code, request_id, duration_ms, detail_json, created_at
		FROM audit_logs
		WHERE %s
		ORDER BY created_at DESC
		LIMIT ? OFFSET ?
	`, whereSQL)

	args = append(args, pageSize, offset)
	rows, err := database.Query(query, args...)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	defer rows.Close()

	var audits []model.AuditLog
	for rows.Next() {
		var a model.AuditLog
		var detailJSON string
		rows.Scan(&a.ID, &a.Operation, &a.Resource, &a.Method, &a.Path,
			&a.UserAgent, &a.IPAddress, &a.StatusCode, &a.RequestID,
			&a.DurationMS, &detailJSON, &a.CreatedAt)
		a.Detail = detailJSON
		audits = append(audits, a)
	}

	c.JSON(http.StatusOK, gin.H{
		"total":     total,
		"page":      page,
		"page_size": pageSize,
		"audits":    audits,
	})
}

func GetThresholds(c *gin.Context) {
	config, err := service.GetThresholdConfig()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, config)
}

func UpdateThresholds(c *gin.Context) {
	var req model.ThresholdConfig
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": fmt.Sprintf("Invalid request: %v", err)})
		return
	}

	database := db.GetDB()

	_, err := database.Exec(`
		UPDATE threshold_configs
		SET penetration_miss_rate_threshold = ?,
		    hot_key_access_threshold = ?,
		    ttl_cluster_threshold = ?,
		    backend_capacity_threshold = ?,
		    bloom_filter_false_positive_rate = ?,
		    mutex_wait_threshold_ms = ?,
		    stale_revalidate_ratio = ?,
		    updated_at = CURRENT_TIMESTAMP
	`,
		req.PenetrationMissRateThreshold,
		req.HotKeyAccessThreshold,
		req.TTLClusterThreshold,
		req.BackendCapacityThreshold,
		req.BloomFilterFalsePositiveRate,
		req.MutexWaitThresholdMS,
		req.StaleRevalidateRatio,
	)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Thresholds updated successfully"})
}

func ReloadConfig(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message":     "Configuration reloaded (in SQLite mode, thresholds are already persisted)",
		"reloaded_at": time.Now().Format(time.RFC3339),
	})
}

func ExportReportJSON(c *gin.Context) {
	report, err := service.GenerateFullReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=cache-risk-report-%s.json", time.Now().Format("20060102-150405")))
	c.JSON(http.StatusOK, report)
}

func ExportReportCSV(c *gin.Context) {
	report, err := service.GenerateFullReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	writer.Write([]string{"风险类型", "严重级别", "业务域", "影响分数", "建议动作"})
	for _, r := range report.Risks {
		writer.Write([]string{
			r.RiskType,
			r.Severity,
			r.BusinessDomain,
			fmt.Sprintf("%.2f", r.ImpactScore),
			r.RecommendedAction,
		})
	}

	writer.Write([]string{""})
	writer.Write([]string{"策略对比排名", "策略类型", "分数", "排名"})
	for i, s := range report.StrategyRankings {
		writer.Write([]string{
			fmt.Sprintf("%d", i+1),
			s.StrategyType,
			fmt.Sprintf("%.2f", s.Score),
			fmt.Sprintf("%d", s.Rank),
		})
	}

	writer.Flush()

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=cache-risk-report-%s.csv", time.Now().Format("20060102-150405")))
	c.String(http.StatusOK, buf.String())
}

func ExportReportMarkdown(c *gin.Context) {
	report, err := service.GenerateFullReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	md := service.GenerateMarkdownReport(report)

	c.Header("Content-Type", "text/markdown; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=cache-risk-report-%s.md", time.Now().Format("20060102-150405")))
	c.String(http.StatusOK, md)
}
