package utils

import (
	"encoding/json"
	"fmt"
	"io"
	"math"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"performance-tracker/internal/models"

	"gopkg.in/yaml.v2"
)

func CalculatePercentiles(latencies []float64) (p50, p95, p99 float64) {
	if len(latencies) == 0 {
		return 0, 0, 0
	}

	sort.Float64s(latencies)
	n := len(latencies)

	p50 = latencies[int(math.Ceil(float64(n)*0.5))-1]
	p95 = latencies[int(math.Ceil(float64(n)*0.95))-1]
	p99 = latencies[int(math.Ceil(float64(n)*0.99))-1]

	return p50, p95, p99
}

func ParseRoutesYAML(filePath string) ([]models.Route, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var routesData struct {
		Routes []struct {
			Method          string  `yaml:"method"`
			Path            string  `yaml:"path"`
			Description     string  `yaml:"description"`
			P95MaxMs        float64 `yaml:"p95_max_ms"`
			P99MaxMs        float64 `yaml:"p99_max_ms"`
			ErrorRateMax    float64 `yaml:"error_rate_max"`
			TimeoutRateMax  float64 `yaml:"timeout_rate_max"`
			ThroughputMin   float64 `yaml:"throughput_min"`
		} `yaml:"routes"`
	}

	if err := yaml.Unmarshal(data, &routesData); err != nil {
		return nil, fmt.Errorf("failed to parse YAML: %w", err)
	}

	var routes []models.Route
	for _, r := range routesData.Routes {
		// 验证必要字段
		if r.Method == "" {
			return nil, fmt.Errorf("missing required field: method")
		}
		if r.Path == "" {
			return nil, fmt.Errorf("missing required field: path")
		}

		routes = append(routes, models.Route{
			Method:      strings.ToUpper(r.Method),
			Path:        r.Path,
			Description: r.Description,
			PerformanceBudget: models.PerformanceBudget{
				P95MaxMs:       r.P95MaxMs,
				P99MaxMs:       r.P99MaxMs,
				ErrorRateMax:   r.ErrorRateMax,
				TimeoutRateMax: r.TimeoutRateMax,
				ThroughputMin:  r.ThroughputMin,
			},
		})
	}

	return routes, nil
}

func ParseSamplesJSONL(filePath string) ([]models.Sample, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	file, err := os.Open(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	var samples []models.Sample
	decoder := json.NewDecoder(file)
	lineNumber := 0

	for {
		lineNumber++
		var sampleData struct {
			Method      string  `json:"method"`
			Path        string  `json:"path"`
			QueryParams string  `json:"query_params"`
			RequestBody string  `json:"request_body"`
			Weight      float64 `json:"weight"`
			Tags        string  `json:"tags"`
		}

		if err := decoder.Decode(&sampleData); err == io.EOF {
			break
		} else if err != nil {
			return nil, fmt.Errorf("failed to parse line %d: %w", lineNumber, err)
		}

		// 验证必要字段
		if sampleData.Method == "" {
			return nil, fmt.Errorf("missing required field 'method' at line %d", lineNumber)
		}
		if sampleData.Path == "" {
			return nil, fmt.Errorf("missing required field 'path' at line %d", lineNumber)
		}

		samples = append(samples, models.Sample{
			Method:      strings.ToUpper(sampleData.Method),
			Path:        sampleData.Path,
			QueryParams: sampleData.QueryParams,
			RequestBody: sampleData.RequestBody,
			Weight:      sampleData.Weight,
			Tags:        sampleData.Tags,
		})
	}

	return samples, nil
}

func ParseBaselineJSON(filePath string) (*models.Baseline, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var baselineData struct {
		Name        string  `json:"name"`
		Description string  `json:"description"`
		IsActive    bool    `json:"is_active"`
		P50Ms       float64 `json:"p50_ms"`
		P95Ms       float64 `json:"p95_ms"`
		P99Ms       float64 `json:"p99_ms"`
		Throughput  float64 `json:"throughput"`
		ErrorRate   float64 `json:"error_rate"`
		TimeoutRate float64 `json:"timeout_rate"`
		AvgResponseSize int64 `json:"avg_response_size"`
	}

	if err := json.Unmarshal(data, &baselineData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	// 验证必要字段
	if baselineData.Name == "" {
		return nil, fmt.Errorf("missing required field: name")
	}

	return &models.Baseline{
		Name:        baselineData.Name,
		Description: baselineData.Description,
		IsActive:    baselineData.IsActive,
		Metrics: models.BaselineMetrics{
			P50Ms:           baselineData.P50Ms,
			P95Ms:           baselineData.P95Ms,
			P99Ms:           baselineData.P99Ms,
			Throughput:      baselineData.Throughput,
			ErrorRate:       baselineData.ErrorRate,
			TimeoutRate:     baselineData.TimeoutRate,
			AvgResponseSize: baselineData.AvgResponseSize,
		},
	}, nil
}

func ParseProfileEventsJSON(filePath string) ([]models.ProfileEvent, error) {
	absPath, err := filepath.Abs(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute path: %w", err)
	}

	data, err := os.ReadFile(absPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read file: %w", err)
	}

	var eventsData struct {
		Events []struct {
			EventType      string    `json:"event_type"`
			Category       string    `json:"category"`
			Description    string    `json:"description"`
			DurationMs     float64   `json:"duration_ms"`
			StartTimestamp time.Time `json:"start_timestamp"`
			Tags           string    `json:"tags"`
			Metadata       string    `json:"metadata"`
		} `json:"events"`
	}

	if err := json.Unmarshal(data, &eventsData); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w", err)
	}

	var events []models.ProfileEvent
	for i, e := range eventsData.Events {
		// 验证必要字段
		if e.EventType == "" {
			return nil, fmt.Errorf("missing required field 'event_type' at index %d", i)
		}
		if e.Category == "" {
			return nil, fmt.Errorf("missing required field 'category' at index %d", i)
		}

		events = append(events, models.ProfileEvent{
			EventType:      e.EventType,
			Category:       e.Category,
			Description:    e.Description,
			DurationMs:     e.DurationMs,
			StartTimestamp: e.StartTimestamp,
			Tags:           e.Tags,
			Metadata:       e.Metadata,
		})
	}

	return events, nil
}

func FormatDuration(d time.Duration) string {
	if d < time.Millisecond {
		return fmt.Sprintf("%.2fμs", float64(d)/float64(time.Microsecond))
	} else if d < time.Second {
		return fmt.Sprintf("%.2fms", float64(d)/float64(time.Millisecond))
	}
	return fmt.Sprintf("%.2fs", float64(d)/float64(time.Second))
}

func ValidateRunConfig(config models.RunConfig) error {
	if config.Concurrency <= 0 {
		return fmt.Errorf("concurrency must be greater than 0, got %d", config.Concurrency)
	}

	if config.TargetRPS < 0 {
		return fmt.Errorf("target RPS cannot be negative, got %.2f", config.TargetRPS)
	}

	if config.TimeoutMs <= 0 {
		return fmt.Errorf("timeout must be greater than 0ms, got %dms", config.TimeoutMs)
	}

	if config.DurationSeconds <= 0 && config.TotalRequests <= 0 {
		return fmt.Errorf("either duration_seconds or total_requests must be greater than 0")
	}

	if config.DurationSeconds < 0 {
		return fmt.Errorf("duration_seconds cannot be negative, got %d", config.DurationSeconds)
	}

	if config.TotalRequests < 0 {
		return fmt.Errorf("total_requests cannot be negative, got %d", config.TotalRequests)
	}

	return nil
}

func GenerateRunName() string {
	return fmt.Sprintf("run-%s", time.Now().Format("20060102-150405"))
}

func ContainsString(slice []string, s string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}
