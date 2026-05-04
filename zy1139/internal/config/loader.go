package config

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"capgate/internal/models"

	"gopkg.in/yaml.v3"
)

type ConfigError struct {
	File    string
	Field   string
	Message string
	Cause   error
}

func (e *ConfigError) Error() string {
	if e.Field != "" {
		return fmt.Sprintf("%s: %s (field: %s)", e.File, e.Message, e.Field)
	}
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.File, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.File, e.Message)
}

func LoadRoutes(filePath string) ([]models.Route, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法读取文件", Cause: err}
	}

	var routes struct {
		Routes []models.Route `yaml:"routes"`
	}
	if err := yaml.Unmarshal(data, &routes); err != nil {
		return nil, &ConfigError{File: filePath, Message: "YAML 解析失败", Cause: err}
	}

	return routes.Routes, nil
}

func LoadTrafficPlan(filePath string) (*models.TrafficPlan, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法读取文件", Cause: err}
	}

	var plan models.TrafficPlan
	if err := json.Unmarshal(data, &plan); err != nil {
		return nil, &ConfigError{File: filePath, Message: "JSON 解析失败", Cause: err}
	}

	return &plan, nil
}

func LoadBaseline(filePath string) ([]models.BaselineRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法打开文件", Cause: err}
	}
	defer file.Close()

	reader := csv.NewReader(bufio.NewReader(file))
	records, err := reader.ReadAll()
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "CSV 解析失败", Cause: err}
	}

	if len(records) < 2 {
		return nil, &ConfigError{File: filePath, Message: "CSV 文件至少需要包含表头和一行数据"}
	}

	headers := records[0]
	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[strings.ToLower(h)] = i
	}

	var baseline []models.BaselineRecord
	for i := 1; i < len(records); i++ {
		row := records[i]
		record, err := parseBaselineRow(row, headerIndex, filePath, i+1)
		if err != nil {
			return nil, err
		}
		baseline = append(baseline, record)
	}

	return baseline, nil
}

func parseBaselineRow(row []string, headerIndex map[string]int, filePath string, lineNum int) (models.BaselineRecord, error) {
	var record models.BaselineRecord
	var err error

	record.RouteName = getStringField(row, headerIndex, "route_name", "")

	record.P50LatencyMs, err = getFloatField(row, headerIndex, "p50_latency_ms", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, p50_latency_ms", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.P95LatencyMs, err = getFloatField(row, headerIndex, "p95_latency_ms", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, p95_latency_ms", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.P99LatencyMs, err = getFloatField(row, headerIndex, "p99_latency_ms", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, p99_latency_ms", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.AvgLatencyMs, err = getFloatField(row, headerIndex, "avg_latency_ms", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, avg_latency_ms", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.ThroughputRPS, err = getFloatField(row, headerIndex, "throughput_rps", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, throughput_rps", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.ErrorRate, err = getFloatField(row, headerIndex, "error_rate", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, error_rate", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.MaxConcurrent, err = getIntField(row, headerIndex, "max_concurrent", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, max_concurrent", lineNum),
			Message: "整数解析失败",
			Cause:   err,
		}
	}

	record.CPUPeakPercent, err = getFloatField(row, headerIndex, "cpu_peak_percent", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, cpu_peak_percent", lineNum),
			Message: "数值解析失败",
			Cause:   err,
		}
	}

	record.MemoryPeakMB, err = getIntField(row, headerIndex, "memory_peak_mb", 0)
	if err != nil {
		return record, &ConfigError{
			File:    filePath,
			Field:   fmt.Sprintf("line %d, memory_peak_mb", lineNum),
			Message: "整数解析失败",
			Cause:   err,
		}
	}

	return record, nil
}

func LoadDependencyLimits(filePath string) ([]models.DependencyLimit, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法读取文件", Cause: err}
	}

	var deps struct {
		Dependencies []models.DependencyLimit `yaml:"dependencies"`
	}
	if err := yaml.Unmarshal(data, &deps); err != nil {
		return nil, &ConfigError{File: filePath, Message: "YAML 解析失败", Cause: err}
	}

	return deps.Dependencies, nil
}

func LoadRunResult(filePath string) (*models.RunResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法读取文件", Cause: err}
	}

	var result models.RunResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, &ConfigError{File: filePath, Message: "JSON 解析失败", Cause: err}
	}

	return &result, nil
}

func LoadComparisonResult(filePath string) (*models.ComparisonResult, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, &ConfigError{File: filePath, Message: "无法读取文件", Cause: err}
	}

	var result models.ComparisonResult
	if err := json.Unmarshal(data, &result); err != nil {
		return nil, &ConfigError{File: filePath, Message: "JSON 解析失败", Cause: err}
	}

	return &result, nil
}

func SaveRunResult(result *models.RunResult, filePath string) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return &ConfigError{File: filePath, Message: "JSON 序列化失败", Cause: err}
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return &ConfigError{File: filePath, Message: "写入文件失败", Cause: err}
	}

	return nil
}

func SaveComparisonResult(result *models.ComparisonResult, filePath string) error {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return &ConfigError{File: filePath, Message: "JSON 序列化失败", Cause: err}
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return &ConfigError{File: filePath, Message: "写入文件失败", Cause: err}
	}

	return nil
}

func getStringField(row []string, headerIndex map[string]int, field string, defaultValue string) string {
	if idx, ok := headerIndex[field]; ok && idx < len(row) {
		return row[idx]
	}
	return defaultValue
}

func getFloatField(row []string, headerIndex map[string]int, field string, defaultValue float64) (float64, error) {
	if idx, ok := headerIndex[field]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val == "" {
			return defaultValue, nil
		}
		return strconv.ParseFloat(val, 64)
	}
	return defaultValue, nil
}

func getIntField(row []string, headerIndex map[string]int, field string, defaultValue int) (int, error) {
	if idx, ok := headerIndex[field]; ok && idx < len(row) {
		val := strings.TrimSpace(row[idx])
		if val == "" {
			return defaultValue, nil
		}
		parsed, err := strconv.ParseInt(val, 10, 32)
		return int(parsed), err
	}
	return defaultValue, nil
}

func EnsureDir(dirPath string) error {
	if _, err := os.Stat(dirPath); os.IsNotExist(err) {
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return fmt.Errorf("创建目录失败: %s: %w", dirPath, err)
		}
	}
	return nil
}

func WriteFile(filePath string, content string) error {
	return os.WriteFile(filePath, []byte(content), 0644)
}

func WriteCSV(filePath string, records [][]string) error {
	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	return writer.WriteAll(records)
}

func FileExists(filePath string) bool {
	_, err := os.Stat(filePath)
	return !os.IsNotExist(err)
}

func CopyFile(src, dst string) error {
	sourceFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer sourceFile.Close()

	destFile, err := os.Create(dst)
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, sourceFile)
	if err != nil {
		return err
	}

	return destFile.Sync()
}
