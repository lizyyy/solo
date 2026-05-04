package service

import (
	"bufio"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"strconv"
	"strings"
	"time"

	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/model"

	"gopkg.in/yaml.v3"
)

type ImportResult struct {
	Total     int64       `json:"total"`
	Success   int64       `json:"success"`
	Failed    int64       `json:"failed"`
	Errors    []ImportError `json:"errors,omitempty"`
	DurationMS int64      `json:"duration_ms"`
}

type ImportError struct {
	Line    int    `json:"line"`
	Record  string `json:"record,omitempty"`
	Message string `json:"message"`
}

func ImportCacheEventsFromJSONL(reader io.Reader) (*ImportResult, error) {
	start := time.Now()
	result := &ImportResult{}
	database := db.GetDB()

	scanner := bufio.NewScanner(reader)
	lineNum := 0

	tx, err := database.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO cache_events (
			timestamp, business_domain, cache_key, ttl_seconds, is_hit,
			backend_latency_ms, request_source, user_agent, ip_address, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for scanner.Scan() {
		lineNum++
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}

		var event model.CacheEvent
		var raw map[string]interface{}

		if err := json.Unmarshal([]byte(line), &raw); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Record:  line[:min(200, len(line))],
				Message: fmt.Sprintf("JSON parse error: %v", err),
			})
			continue
		}

		if err := validateAndParseCacheEvent(raw, &event); err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Record:  line[:min(200, len(line))],
				Message: err.Error(),
			})
			continue
		}

		_, err = stmt.Exec(
			event.Timestamp,
			event.BusinessDomain,
			event.CacheKey,
			event.TTL,
			event.IsHit,
			event.BackendLatency,
			event.RequestSource,
			event.UserAgent,
			event.IPAddress,
			time.Now(),
		)

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: fmt.Sprintf("Database error: %v", err),
			})
			continue
		}

		result.Success++
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	result.Total = result.Success + result.Failed
	result.DurationMS = time.Since(start).Milliseconds()

	return result, nil
}

func ImportKeysFromCSV(reader io.Reader) (*ImportResult, error) {
	start := time.Now()
	result := &ImportResult{}
	database := db.GetDB()

	csvReader := csv.NewReader(reader)
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV must have at least header and one data row")
	}

	headers := records[0]
	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.TrimSpace(strings.ToLower(h))] = i
	}

	tx, err := database.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT OR REPLACE INTO cache_keys (
			business_domain, cache_key, ttl_seconds, expire_at, is_hot,
			access_count, last_access_at, data_type, value_hash, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for i := 1; i < len(records); i++ {
		row := records[i]
		lineNum := i + 1

		key, err := parseCacheKeyFromCSV(row, headerMap)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: err.Error(),
			})
			continue
		}

		_, err = stmt.Exec(
			key.BusinessDomain,
			key.CacheKey,
			key.TTL,
			key.ExpireAt,
			key.IsHot,
			key.AccessCount,
			key.LastAccessAt,
			key.DataType,
			key.ValueHash,
		)

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: fmt.Sprintf("Database error: %v", err),
			})
			continue
		}

		result.Success++
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	result.Total = result.Success + result.Failed
	result.DurationMS = time.Since(start).Milliseconds()

	return result, nil
}

func ImportBackendMetricsFromCSV(reader io.Reader) (*ImportResult, error) {
	start := time.Now()
	result := &ImportResult{}
	database := db.GetDB()

	csvReader := csv.NewReader(reader)
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, fmt.Errorf("CSV must have at least header and one data row")
	}

	headers := records[0]
	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.TrimSpace(strings.ToLower(h))] = i
	}

	tx, err := database.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO backend_metrics (
			business_domain, timestamp, max_connections, current_connections,
			qps, max_qps, avg_latency_ms, p95_latency_ms, p99_latency_ms,
			error_rate, cpu_usage, memory_usage, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for i := 1; i < len(records); i++ {
		row := records[i]
		lineNum := i + 1

		metric, err := parseBackendMetricFromCSV(row, headerMap)
		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: err.Error(),
			})
			continue
		}

		_, err = stmt.Exec(
			metric.BusinessDomain,
			metric.Timestamp,
			metric.MaxConnections,
			metric.CurrentConnections,
			metric.QueryPerSecond,
			metric.MaxQPS,
			metric.AvgLatencyMS,
			metric.P95LatencyMS,
			metric.P99LatencyMS,
			metric.ErrorRate,
			metric.CPUUsage,
			metric.MemoryUsage,
			time.Now(),
		)

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: fmt.Sprintf("Database error: %v", err),
			})
			continue
		}

		result.Success++
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	result.Total = result.Success + result.Failed
	result.DurationMS = time.Since(start).Milliseconds()

	return result, nil
}

func ImportTrafficPlanFromJSON(data []byte) (*ImportResult, error) {
	start := time.Now()
	result := &ImportResult{}
	database := db.GetDB()

	var plan model.TrafficPlan
	if err := json.Unmarshal(data, &plan); err != nil {
		return nil, fmt.Errorf("JSON parse error: %v", err)
	}

	if plan.PlanName == "" {
		return nil, fmt.Errorf("plan_name is required")
	}
	if plan.BusinessDomain == "" {
		return nil, fmt.Errorf("business_domain is required")
	}
	if plan.StartTime.IsZero() {
		return nil, fmt.Errorf("start_time is required")
	}
	if plan.EndTime.IsZero() {
		return nil, fmt.Errorf("end_time is required")
	}
	if plan.EndTime.Before(plan.StartTime) {
		return nil, fmt.Errorf("end_time must be after start_time")
	}

	_, err := database.Exec(`
		INSERT INTO traffic_plans (
			plan_name, business_domain, start_time, end_time,
			expected_qps, peak_qps, hot_key_ratio, cold_start_ratio,
			invalid_key_ratio, description, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`,
		plan.PlanName,
		plan.BusinessDomain,
		plan.StartTime,
		plan.EndTime,
		plan.ExpectedQPS,
		plan.PeakQPS,
		plan.HotKeyRatio,
		plan.ColdStartRatio,
		plan.InvalidKeyRatio,
		plan.Description,
		time.Now(),
	)

	if err != nil {
		return nil, err
	}

	result.Success = 1
	result.Total = 1
	result.DurationMS = time.Since(start).Milliseconds()

	return result, nil
}

func ImportStrategyFromYAML(data []byte) (*ImportResult, error) {
	start := time.Now()
	result := &ImportResult{}
	database := db.GetDB()

	var strategies []model.Strategy
	if err := yaml.Unmarshal(data, &strategies); err != nil {
		var single model.Strategy
		if err2 := yaml.Unmarshal(data, &single); err2 != nil {
			return nil, fmt.Errorf("YAML parse error: %v", err)
		}
		strategies = []model.Strategy{single}
	}

	tx, err := database.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(`
		INSERT INTO strategies (
			strategy_name, strategy_type, business_domain, is_enabled,
			priority, config_json, description, created_at, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
	`)
	if err != nil {
		return nil, err
	}
	defer stmt.Close()

	for i, s := range strategies {
		lineNum := i + 1

		if s.StrategyName == "" {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: "strategy_name is required",
			})
			continue
		}

		validTypes := map[string]bool{
			"negative_cache":       true,
			"bloom_filter":         true,
			"ttl_jitter":           true,
			"hot_key_prewarm":      true,
			"mutex_lock":           true,
			"stale_while_revalidate": true,
		}

		if !validTypes[s.StrategyType] {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: fmt.Sprintf("invalid strategy_type: %s, must be one of: negative_cache, bloom_filter, ttl_jitter, hot_key_prewarm, mutex_lock, stale_while_revalidate", s.StrategyType),
			})
			continue
		}

		if s.Config == "" {
			s.Config = "{}"
		}

		_, err = stmt.Exec(
			s.StrategyName,
			s.StrategyType,
			s.BusinessDomain,
			s.IsEnabled,
			s.Priority,
			s.Config,
			s.Description,
		)

		if err != nil {
			result.Failed++
			result.Errors = append(result.Errors, ImportError{
				Line:    lineNum,
				Message: fmt.Sprintf("Database error: %v", err),
			})
			continue
		}

		result.Success++
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	result.Total = result.Success + result.Failed
	result.DurationMS = time.Since(start).Milliseconds()

	return result, nil
}

func validateAndParseCacheEvent(raw map[string]interface{}, event *model.CacheEvent) error {
	if ts, ok := raw["timestamp"].(string); ok {
		t, err := parseTime(ts)
		if err != nil {
			return fmt.Errorf("invalid timestamp: %v", err)
		}
		event.Timestamp = t
	} else {
		return fmt.Errorf("timestamp is required and must be string")
	}

	if domain, ok := raw["business_domain"].(string); ok && domain != "" {
		event.BusinessDomain = domain
	} else {
		return fmt.Errorf("business_domain is required")
	}

	if key, ok := raw["cache_key"].(string); ok && key != "" {
		event.CacheKey = key
	} else {
		return fmt.Errorf("cache_key is required")
	}

	if ttl, ok := raw["ttl_seconds"]; ok {
		switch v := ttl.(type) {
		case float64:
			if v < 0 {
				return fmt.Errorf("ttl_seconds cannot be negative")
			}
			event.TTL = int64(v)
		case int64:
			if v < 0 {
				return fmt.Errorf("ttl_seconds cannot be negative")
			}
			event.TTL = v
		default:
			return fmt.Errorf("ttl_seconds must be a number")
		}
	}

	if isHit, ok := raw["is_hit"].(bool); ok {
		event.IsHit = isHit
	} else {
		return fmt.Errorf("is_hit is required and must be boolean")
	}

	if latency, ok := raw["backend_latency_ms"]; ok {
		switch v := latency.(type) {
		case float64:
			if v < 0 {
				return fmt.Errorf("backend_latency_ms cannot be negative")
			}
			event.BackendLatency = v
		case int64:
			if v < 0 {
				return fmt.Errorf("backend_latency_ms cannot be negative")
			}
			event.BackendLatency = float64(v)
		}
	}

	if source, ok := raw["request_source"].(string); ok {
		event.RequestSource = source
	}

	if ua, ok := raw["user_agent"].(string); ok {
		event.UserAgent = ua
	}

	if ip, ok := raw["ip_address"].(string); ok {
		event.IPAddress = ip
	}

	return nil
}

func parseCacheKeyFromCSV(row []string, headerMap map[string]int) (*model.CacheKey, error) {
	key := &model.CacheKey{}

	if idx, ok := headerMap["business_domain"]; ok && idx < len(row) {
		key.BusinessDomain = strings.TrimSpace(row[idx])
	}
	if key.BusinessDomain == "" {
		return nil, fmt.Errorf("business_domain is required")
	}

	if idx, ok := headerMap["cache_key"]; ok && idx < len(row) {
		key.CacheKey = strings.TrimSpace(row[idx])
	}
	if key.CacheKey == "" {
		return nil, fmt.Errorf("cache_key is required")
	}

	if idx, ok := headerMap["ttl_seconds"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			ttl, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid ttl_seconds: %v", err)
			}
			if ttl < 0 {
				return nil, fmt.Errorf("ttl_seconds cannot be negative")
			}
			key.TTL = ttl
		} else {
			key.TTL = 3600
		}
	} else {
		key.TTL = 3600
	}

	if idx, ok := headerMap["expire_at"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			t, err := parseTime(val)
			if err != nil {
				return nil, fmt.Errorf("invalid expire_at: %v", err)
			}
			key.ExpireAt = t
		} else {
			key.ExpireAt = time.Now().Add(time.Duration(key.TTL) * time.Second)
		}
	} else {
		key.ExpireAt = time.Now().Add(time.Duration(key.TTL) * time.Second)
	}

	if idx, ok := headerMap["is_hot"]; ok && idx < len(row) {
		val := strings.TrimSpace(strings.ToLower(row[idx]))
		key.IsHot = val == "true" || val == "1" || val == "yes"
	}

	if idx, ok := headerMap["access_count"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			count, err := strconv.ParseInt(val, 10, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid access_count: %v", err)
			}
			key.AccessCount = count
		}
	}

	if idx, ok := headerMap["last_access_at"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			t, err := parseTime(val)
			if err != nil {
				return nil, fmt.Errorf("invalid last_access_at: %v", err)
			}
			key.LastAccessAt = t
		}
	}

	if idx, ok := headerMap["data_type"]; ok && idx < len(row) {
		key.DataType = strings.TrimSpace(row[idx])
	}
	if key.DataType == "" {
		key.DataType = "string"
	}

	if idx, ok := headerMap["value_hash"]; ok && idx < len(row) {
		key.ValueHash = strings.TrimSpace(row[idx])
	}

	return key, nil
}

func parseBackendMetricFromCSV(row []string, headerMap map[string]int) (*model.BackendMetric, error) {
	metric := &model.BackendMetric{}

	if idx, ok := headerMap["business_domain"]; ok && idx < len(row) {
		metric.BusinessDomain = strings.TrimSpace(row[idx])
	}
	if metric.BusinessDomain == "" {
		return nil, fmt.Errorf("business_domain is required")
	}

	if idx, ok := headerMap["timestamp"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			t, err := parseTime(val)
			if err != nil {
				return nil, fmt.Errorf("invalid timestamp: %v", err)
			}
			metric.Timestamp = t
		} else {
			metric.Timestamp = time.Now()
		}
	} else {
		metric.Timestamp = time.Now()
	}

	if idx, ok := headerMap["max_connections"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.Atoi(val)
			if err != nil {
				return nil, fmt.Errorf("invalid max_connections: %v", err)
			}
			metric.MaxConnections = v
		}
	}

	if idx, ok := headerMap["current_connections"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.Atoi(val)
			if err != nil {
				return nil, fmt.Errorf("invalid current_connections: %v", err)
			}
			metric.CurrentConnections = v
		}
	}

	if idx, ok := headerMap["qps"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid qps: %v", err)
			}
			metric.QueryPerSecond = v
		}
	}

	if idx, ok := headerMap["max_qps"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid max_qps: %v", err)
			}
			metric.MaxQPS = v
		}
	}

	if idx, ok := headerMap["avg_latency_ms"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid avg_latency_ms: %v", err)
			}
			metric.AvgLatencyMS = v
		}
	}

	if idx, ok := headerMap["p95_latency_ms"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid p95_latency_ms: %v", err)
			}
			metric.P95LatencyMS = v
		}
	}

	if idx, ok := headerMap["p99_latency_ms"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid p99_latency_ms: %v", err)
			}
			metric.P99LatencyMS = v
		}
	}

	if idx, ok := headerMap["error_rate"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid error_rate: %v", err)
			}
			metric.ErrorRate = v
		}
	}

	if idx, ok := headerMap["cpu_usage"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid cpu_usage: %v", err)
			}
			metric.CPUUsage = v
		}
	}

	if idx, ok := headerMap["memory_usage"]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val != "" {
			v, err := strconv.ParseFloat(val, 64)
			if err != nil {
				return nil, fmt.Errorf("invalid memory_usage: %v", err)
			}
			metric.MemoryUsage = v
		}
	}

	return metric, nil
}

func parseTime(s string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006-01-02",
		time.RFC1123,
		time.RFC1123Z,
	}

	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}

	return time.Time{}, fmt.Errorf("unrecognized time format: %s", s)
}

func GetThresholdConfig() (*model.ThresholdConfig, error) {
	database := db.GetDB()
	config := &model.ThresholdConfig{}

	err := database.QueryRow(`
		SELECT id, penetration_miss_rate_threshold, hot_key_access_threshold,
		       ttl_cluster_threshold, backend_capacity_threshold,
		       bloom_filter_false_positive_rate, mutex_wait_threshold_ms,
		       stale_revalidate_ratio, updated_at
		FROM threshold_configs
		ORDER BY id DESC LIMIT 1
	`).Scan(
		&config.ID,
		&config.PenetrationMissRateThreshold,
		&config.HotKeyAccessThreshold,
		&config.TTLClusterThreshold,
		&config.BackendCapacityThreshold,
		&config.BloomFilterFalsePositiveRate,
		&config.MutexWaitThresholdMS,
		&config.StaleRevalidateRatio,
		&config.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return &model.ThresholdConfig{
			PenetrationMissRateThreshold:   0.3,
			HotKeyAccessThreshold:          1000,
			TTLClusterThreshold:            0.5,
			BackendCapacityThreshold:       0.8,
			BloomFilterFalsePositiveRate:   0.01,
			MutexWaitThresholdMS:           500,
			StaleRevalidateRatio:           0.1,
		}, nil
	}

	return config, err
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
