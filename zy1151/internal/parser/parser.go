package parser

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"memreplay/internal/models"
	"os"
	"strconv"
	"strings"
	"time"

	"gopkg.in/yaml.v3"
)

type ParseError struct {
	Line     int
	Column   int
	Message  string
	FilePath string
}

func (e *ParseError) Error() string {
	if e.Line > 0 {
		return fmt.Sprintf("%s:%d: %s", e.FilePath, e.Line, e.Message)
	}
	return fmt.Sprintf("%s: %s", e.FilePath, e.Message)
}

func NewParseError(filePath string, line int, msg string) *ParseError {
	return &ParseError{
		Line:     line,
		FilePath: filePath,
		Message:  msg,
	}
}

func ParseMemStatsCSV(filePath string) ([]models.MemStatsRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, NewParseError(filePath, 1, fmt.Sprintf("无法读取表头: %v", err))
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.ToLower(h)] = i
	}

	var records []models.MemStatsRecord
	lineNum := 2

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, NewParseError(filePath, lineNum, fmt.Sprintf("读取行失败: %v", err))
		}

		record, err := parseMemStatsRow(headerMap, row, lineNum, filePath)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
		lineNum++
	}

	if len(records) == 0 {
		return nil, NewParseError(filePath, 0, "文件中没有有效数据")
	}

	for i := 1; i < len(records); i++ {
		if records[i].Timestamp.Before(records[i-1].Timestamp) {
			return nil, NewParseError(filePath, i+1, fmt.Sprintf("时间戳乱序: %s 在 %s 之前",
				records[i].Timestamp.Format(time.RFC3339),
				records[i-1].Timestamp.Format(time.RFC3339)))
		}
	}

	return records, nil
}

func parseMemStatsRow(headerMap map[string]int, row []string, lineNum int, filePath string) (*models.MemStatsRecord, error) {
	record := &models.MemStatsRecord{}

	getField := func(name string) string {
		if idx, ok := headerMap[strings.ToLower(name)]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	parseUint64 := func(name string) (uint64, error) {
		val := getField(name)
		if val == "" {
			return 0, nil
		}
		result, err := strconv.ParseUint(val, 10, 64)
		if err != nil {
			return 0, NewParseError(filePath, lineNum, fmt.Sprintf("%s 不是有效的 uint64: %s", name, val))
		}
		return result, nil
	}

	parseUint32 := func(name string) (uint32, error) {
		val := getField(name)
		if val == "" {
			return 0, nil
		}
		result, err := strconv.ParseUint(val, 10, 32)
		if err != nil {
			return 0, NewParseError(filePath, lineNum, fmt.Sprintf("%s 不是有效的 uint32: %s", name, val))
		}
		return uint32(result), nil
	}

	parseFloat64 := func(name string) (float64, error) {
		val := getField(name)
		if val == "" {
			return 0, nil
		}
		result, err := strconv.ParseFloat(val, 64)
		if err != nil {
			return 0, NewParseError(filePath, lineNum, fmt.Sprintf("%s 不是有效的 float64: %s", name, val))
		}
		return result, nil
	}

	tsStr := getField("timestamp")
	if tsStr == "" {
		return nil, NewParseError(filePath, lineNum, "缺少必填字段: timestamp")
	}
	ts, err := parseTimestamp(tsStr)
	if err != nil {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("无效的时间戳: %s", tsStr))
	}
	record.Timestamp = ts

	record.Alloc, _ = parseUint64("alloc")
	record.TotalAlloc, _ = parseUint64("total_alloc")
	record.Sys, _ = parseUint64("sys")
	record.Lookups, _ = parseUint64("lookups")
	record.Mallocs, _ = parseUint64("mallocs")
	record.Frees, _ = parseUint64("frees")
	record.HeapAlloc, _ = parseUint64("heap_alloc")
	record.HeapSys, _ = parseUint64("heap_sys")
	record.HeapIdle, _ = parseUint64("heap_idle")
	record.HeapInuse, _ = parseUint64("heap_inuse")
	record.HeapReleased, _ = parseUint64("heap_released")
	record.HeapObjects, _ = parseUint64("heap_objects")
	record.StackInuse, _ = parseUint64("stack_inuse")
	record.StackSys, _ = parseUint64("stack_sys")
	record.MSpanInuse, _ = parseUint64("mspan_inuse")
	record.MSpanSys, _ = parseUint64("mspan_sys")
	record.MCacheInuse, _ = parseUint64("mcache_inuse")
	record.MCacheSys, _ = parseUint64("mcache_sys")
	record.BuckHashSys, _ = parseUint64("buck_hash_sys")
	record.GCSys, _ = parseUint64("gc_sys")
	record.OtherSys, _ = parseUint64("other_sys")
	record.NextGC, _ = parseUint64("next_gc")
	record.LastGC, _ = parseUint64("last_gc")
	record.PauseTotalNs, _ = parseUint64("pause_total_ns")
	record.NumGC, _ = parseUint32("num_gc")
	record.NumForcedGC, _ = parseUint32("num_forced_gc")
	record.GCCPUFraction, _ = parseFloat64("gc_cpu_fraction")
	record.RSS, _ = parseUint64("rss")

	return record, nil
}

func ParseGoroutinesFile(filePath string) ([]models.GoroutineRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	var records []models.GoroutineRecord
	scanner := bufio.NewScanner(file)
	lineNum := 0

	var currentGoroutine *models.GoroutineRecord
	var stackLines []string

	for scanner.Scan() {
		line := scanner.Text()
		lineNum++

		if strings.HasPrefix(line, "goroutine ") {
			if currentGoroutine != nil {
				currentGoroutine.Stack = strings.Join(stackLines, "\n")
				records = append(records, *currentGoroutine)
			}

			currentGoroutine, err = parseGoroutineHeader(line, lineNum, filePath)
			if err != nil {
				return nil, err
			}
			stackLines = []string{line}
		} else if currentGoroutine != nil {
			stackLines = append(stackLines, line)

			if strings.Contains(line, ".go:") {
				parseGoroutineStackLine(line, currentGoroutine)
			}
		}
	}

	if currentGoroutine != nil {
		currentGoroutine.Stack = strings.Join(stackLines, "\n")
		records = append(records, *currentGoroutine)
	}

	if err := scanner.Err(); err != nil {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("读取文件失败: %v", err))
	}

	if len(records) == 0 {
		return nil, NewParseError(filePath, 0, "文件中没有有效的 goroutine 数据")
	}

	return records, nil
}

func parseGoroutineHeader(line string, lineNum int, filePath string) (*models.GoroutineRecord, error) {
	parts := strings.Fields(line)
	if len(parts) < 2 {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("无效的 goroutine 头部格式: %s", line))
	}

	idStr := strings.TrimSuffix(parts[1], ":")
	goroutineID, err := strconv.ParseUint(idStr, 10, 64)
	if err != nil {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("无效的 goroutine ID: %s", idStr))
	}

	status := "running"
	if strings.Contains(line, "[") && strings.Contains(line, "]") {
		start := strings.Index(line, "[")
		end := strings.Index(line, "]")
		if start >= 0 && end > start {
			status = line[start+1 : end]
		}
	}

	return &models.GoroutineRecord{
		GoroutineID: goroutineID,
		Status:      status,
		Timestamp:   time.Now(),
	}, nil
}

func parseGoroutineStackLine(line string, record *models.GoroutineRecord) {
	line = strings.TrimSpace(line)

	parts := strings.SplitN(line, ":", 2)
	if len(parts) < 2 {
		return
	}

	filePart := parts[0]
	rest := parts[1]

	lineNumStr := rest
	if strings.Contains(rest, " ") {
		lineNumStr = strings.SplitN(rest, " ", 2)[0]
	}

	lineNum, err := strconv.Atoi(strings.TrimSpace(lineNumStr))
	if err == nil {
		record.File = filePart
		record.Line = lineNum
	}
}

func ParseTrafficCSV(filePath string) ([]models.TrafficRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, NewParseError(filePath, 1, fmt.Sprintf("无法读取表头: %v", err))
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.ToLower(h)] = i
	}

	var records []models.TrafficRecord
	lineNum := 2

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, NewParseError(filePath, lineNum, fmt.Sprintf("读取行失败: %v", err))
		}

		record, err := parseTrafficRow(headerMap, row, lineNum, filePath)
		if err != nil {
			return nil, err
		}
		records = append(records, *record)
		lineNum++
	}

	if len(records) == 0 {
		return nil, NewParseError(filePath, 0, "文件中没有有效数据")
	}

	return records, nil
}

func parseTrafficRow(headerMap map[string]int, row []string, lineNum int, filePath string) (*models.TrafficRecord, error) {
	record := &models.TrafficRecord{}

	getField := func(name string) string {
		if idx, ok := headerMap[strings.ToLower(name)]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	tsStr := getField("timestamp")
	if tsStr == "" {
		return nil, NewParseError(filePath, lineNum, "缺少必填字段: timestamp")
	}
	ts, err := parseTimestamp(tsStr)
	if err != nil {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("无效的时间戳: %s", tsStr))
	}
	record.Timestamp = ts

	record.Endpoint = getField("endpoint")
	if record.Endpoint == "" {
		return nil, NewParseError(filePath, lineNum, "缺少必填字段: endpoint")
	}

	record.Method = getField("method")

	requestsStr := getField("requests")
	if requestsStr == "" {
		requestsStr = "0"
	}
	requests, err := strconv.ParseUint(requestsStr, 10, 64)
	if err != nil {
		return nil, NewParseError(filePath, lineNum, fmt.Sprintf("无效的 requests 值: %s", requestsStr))
	}
	record.Requests = requests

	errorsStr := getField("errors")
	if errorsStr != "" {
		errors, err := strconv.ParseUint(errorsStr, 10, 64)
		if err == nil {
			record.Errors = errors
		}
	}

	qpsStr := getField("qps")
	if qpsStr != "" {
		qps, err := strconv.ParseFloat(qpsStr, 64)
		if err == nil {
			record.QPS = qps
		}
	}

	latencyP50Str := getField("latency_p50")
	if latencyP50Str != "" {
		latency, err := strconv.ParseFloat(latencyP50Str, 64)
		if err == nil {
			record.LatencyP50 = latency
		}
	}

	latencyP99Str := getField("latency_p99")
	if latencyP99Str != "" {
		latency, err := strconv.ParseFloat(latencyP99Str, 64)
		if err == nil {
			record.LatencyP99 = latency
		}
	}

	return record, nil
}

func ParseAllocSitesCSV(filePath string) ([]models.AllocSite, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.TrimLeadingSpace = true

	headers, err := reader.Read()
	if err != nil {
		return nil, NewParseError(filePath, 1, fmt.Sprintf("无法读取表头: %v", err))
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.ToLower(h)] = i
	}

	var sites []models.AllocSite
	lineNum := 2

	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, NewParseError(filePath, lineNum, fmt.Sprintf("读取行失败: %v", err))
		}

		site, err := parseAllocSiteRow(headerMap, row, lineNum, filePath)
		if err != nil {
			return nil, err
		}
		sites = append(sites, *site)
		lineNum++
	}

	return sites, nil
}

func parseAllocSiteRow(headerMap map[string]int, row []string, lineNum int, filePath string) (*models.AllocSite, error) {
	site := &models.AllocSite{}

	getField := func(name string) string {
		if idx, ok := headerMap[strings.ToLower(name)]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	site.Function = getField("function")
	site.File = getField("file")

	lineStr := getField("line")
	if lineStr != "" {
		lineNumVal, err := strconv.Atoi(lineStr)
		if err == nil {
			site.Line = lineNumVal
		}
	}

	parseUint64 := func(name string) uint64 {
		val := getField(name)
		if val == "" {
			return 0
		}
		result, err := strconv.ParseUint(val, 10, 64)
		if err != nil {
			return 0
		}
		return result
	}

	site.AllocBytes = parseUint64("alloc_bytes")
	site.AllocObjects = parseUint64("alloc_objects")
	site.InuseBytes = parseUint64("inuse_bytes")
	site.InuseObjects = parseUint64("inuse_objects")
	site.StackID = getField("stack_id")
	site.Timestamp = time.Now()

	return site, nil
}

func ParseConfigYAML(filePath string) ([]models.ConfigRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法读取文件: %v", err))
	}

	var configMap map[string]interface{}
	if err := yaml.Unmarshal(data, &configMap); err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("YAML 解析失败: %v", err))
	}

	var records []models.ConfigRecord
	ts := time.Now()

	for key, value := range configMap {
		record := models.ConfigRecord{
			Key:       key,
			Value:     fmt.Sprintf("%v", value),
			Source:    filePath,
			Timestamp: ts,
		}
		records = append(records, record)
	}

	flattenNestedConfig("", configMap, &records, filePath, ts)

	return records, nil
}

func flattenNestedConfig(prefix string, configMap map[string]interface{}, records *[]models.ConfigRecord, source string, ts time.Time) {
	for key, value := range configMap {
		fullKey := key
		if prefix != "" {
			fullKey = prefix + "." + key
		}

		if nestedMap, ok := value.(map[string]interface{}); ok {
			flattenNestedConfig(fullKey, nestedMap, records, source, ts)
		}

		*records = append(*records, models.ConfigRecord{
			Key:       fullKey,
			Value:     fmt.Sprintf("%v", value),
			Source:    source,
			Timestamp: ts,
		})
	}
}

func ParseHeapProfileJSON(filePath string) ([]models.HeapProfileRecord, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法打开文件: %v", err))
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("无法读取文件: %v", err))
	}

	var profileData struct {
		Records []struct {
			Type         string `json:"type"`
			Function     string `json:"function"`
			File         string `json:"file"`
			Line         int    `json:"line"`
			InuseBytes   uint64 `json:"inuse_bytes"`
			InuseObjects uint64 `json:"inuse_objects"`
			AllocBytes   uint64 `json:"alloc_bytes"`
			AllocObjects uint64 `json:"alloc_objects"`
		} `json:"records"`
	}

	if err := json.Unmarshal(data, &profileData); err != nil {
		return nil, NewParseError(filePath, 0, fmt.Sprintf("JSON 解析失败: %v", err))
	}

	var records []models.HeapProfileRecord
	ts := time.Now()

	for _, r := range profileData.Records {
		record := models.HeapProfileRecord{
			Type:         r.Type,
			Function:     r.Function,
			File:         r.File,
			Line:         r.Line,
			InuseBytes:   r.InuseBytes,
			InuseObjects: r.InuseObjects,
			AllocBytes:   r.AllocBytes,
			AllocObjects: r.AllocObjects,
			Timestamp:    ts,
		}
		records = append(records, record)
	}

	return records, nil
}

func parseTimestamp(tsStr string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		time.RFC3339Nano,
		"2006-01-02 15:04:05",
		"2006-01-02T15:04:05",
		"2006/01/02 15:04:05",
		time.UnixDate,
		time.RubyDate,
		time.RFC1123,
		time.RFC1123Z,
	}

	for _, format := range formats {
		if ts, err := time.Parse(format, tsStr); err == nil {
			return ts, nil
		}
	}

	if ts, err := strconv.ParseInt(tsStr, 10, 64); err == nil {
		if ts > 1e12 {
			return time.UnixMilli(ts), nil
		}
		return time.Unix(ts, 0), nil
	}

	if ts, err := strconv.ParseFloat(tsStr, 64); err == nil {
		secs := int64(ts)
		nanos := int64((ts - float64(secs)) * 1e9)
		return time.Unix(secs, nanos), nil
	}

	return time.Time{}, fmt.Errorf("无法解析时间戳: %s", tsStr)
}
