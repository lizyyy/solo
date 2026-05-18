package parser

import (
	"bufio"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync-failure-replay/internal/replay"
)

type LogParser struct {
	partialSuccessPattern *regexp.Regexp
	primaryKeyPattern     *regexp.Regexp
	orderDependencyPattern *regexp.Regexp
}

func NewLogParser() *LogParser {
	return &LogParser{
		partialSuccessPattern: regexp.MustCompile(`(?i)(partial.*success|部分成功|semi.*batch|半批)`),
		primaryKeyPattern:     regexp.MustCompile(`(?i)(duplicate.*key|主键冲突|primary.*key|unique.*constraint)`),
		orderDependencyPattern: regexp.MustCompile(`(?i)(order.*dependency|顺序依赖|dependency.*violation|外键)`),
	}
}

func (lp *LogParser) ParseFile(filePath string) ([]replay.LogEntry, error) {
	ext := strings.ToLower(filepath.Ext(filePath))
	switch ext {
	case ".log":
		return lp.ParseLogFile(filePath)
	case ".csv":
		return lp.ParseCSVFile(filePath)
	case ".json":
		return lp.ParseJSONFile(filePath)
	case ".txt":
		return lp.ParseTextFile(filePath)
	default:
		return lp.ParseTextFile(filePath)
	}
}

func (lp *LogParser) ParseLogFile(filePath string) ([]replay.LogEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	var entries []replay.LogEntry
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if strings.TrimSpace(line) == "" {
			continue
		}

		entry := lp.classifyLine(filePath, lineNum, line)
		entries = append(entries, entry)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	return entries, nil
}

func (lp *LogParser) ParseCSVFile(filePath string) ([]replay.LogEntry, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	records, err := reader.ReadAll()
	if err != nil {
		return nil, fmt.Errorf("读取CSV失败: %w", err)
	}

	var entries []replay.LogEntry
	for i, record := range records {
		lineNum := i + 1
		line := strings.Join(record, ",")
		entry := lp.classifyLine(filePath, lineNum, line)
		entries = append(entries, entry)
	}

	return entries, nil
}

func (lp *LogParser) ParseJSONFile(filePath string) ([]replay.LogEntry, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}

	var rawEntries []map[string]interface{}
	if err := json.Unmarshal(data, &rawEntries); err != nil {
		var singleEntry map[string]interface{}
		if err := json.Unmarshal(data, &singleEntry); err == nil {
			rawEntries = []map[string]interface{}{singleEntry}
		} else {
			return nil, fmt.Errorf("解析JSON失败: %w", err)
		}
	}

	var entries []replay.LogEntry
	for i, raw := range rawEntries {
		lineNum := i + 1
		content, _ := json.Marshal(raw)
		entry := lp.classifyLine(filePath, lineNum, string(content))
		if pk, ok := raw["primary_key"].(string); ok {
			entry.PrimaryKey = pk
		}
		if et, ok := raw["error_type"].(string); ok {
			entry.ErrorType = replay.ErrorType(et)
		}
		entries = append(entries, entry)
	}

	return entries, nil
}

func (lp *LogParser) ParseTextFile(filePath string) ([]replay.LogEntry, error) {
	return lp.ParseLogFile(filePath)
}

func (lp *LogParser) classifyLine(fileName string, lineNum int, content string) replay.LogEntry {
	errorType := replay.ErrorTypeUnknown
	primaryKey := extractPrimaryKey(content)

	if lp.partialSuccessPattern.MatchString(content) {
		errorType = replay.ErrorTypePartialSuccess
	} else if lp.orderDependencyPattern.MatchString(content) {
		errorType = replay.ErrorTypeOrderDependency
	} else if lp.primaryKeyPattern.MatchString(content) {
		errorType = replay.ErrorTypePrimaryKey
	}

	id := fmt.Sprintf("%s:%d", filepath.Base(fileName), lineNum)

	return replay.LogEntry{
		ID:         id,
		FileName:   fileName,
		LineNumber: lineNum,
		Content:    content,
		ErrorType:  errorType,
		PrimaryKey: primaryKey,
		RetryCount: 0,
		Processed:  false,
		Success:    false,
	}
}

func extractPrimaryKey(content string) string {
	pkPattern := regexp.MustCompile(`(?i)(?:primary_key|主键|id)\s*[:=]\s*['"]?([^'"\s,]+)`)
	matches := pkPattern.FindStringSubmatch(content)
	if len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func (lp *LogParser) ParseFiles(filePaths []string) ([]replay.LogEntry, error) {
	var allEntries []replay.LogEntry
	for _, path := range filePaths {
		entries, err := lp.ParseFile(path)
		if err != nil {
			return nil, fmt.Errorf("解析文件 %s 失败: %w", path, err)
		}
		allEntries = append(allEntries, entries...)
	}
	return allEntries, nil
}
