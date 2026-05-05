package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"time"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// JSONLParser 用于解析 events.jsonl 文件
type JSONLParser struct{}

// NewJSONLParser 创建一个新的 JSONL 解析器
func NewJSONLParser() *JSONLParser {
	return &JSONLParser{}
}

// EventJSON 表示 JSONL 文件中的单个事件
type EventJSON struct {
	PrimitiveName string                 `json:"primitive_name"`
	PrimitiveType models.SyncPrimitiveType `json:"primitive_type"`
	EventType     string                 `json:"event_type"`
	GoroutineID   int64                  `json:"goroutine_id"`
	Timestamp     string                 `json:"timestamp"`
	Location      string                 `json:"location"`
	File          string                 `json:"file"`
	Line          int                    `json:"line"`
	Details       string                 `json:"details"`
	Metadata      map[string]interface{} `json:"metadata,omitempty"`
}

// ParseEvents 解析 events.jsonl 文件
func (p *JSONLParser) ParseEvents(filePath string) ([]models.SyncEvent, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var events []models.SyncEvent
	scanner := bufio.NewScanner(file)

	lineNum := 0
	for scanner.Scan() {
		lineNum++
		line := scanner.Text()

		if len(line) == 0 || line[0] == '#' {
			continue
		}

		var eventJSON EventJSON
		if err := json.Unmarshal([]byte(line), &eventJSON); err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNum, err)
		}

		event, err := p.convertEventJSON(&eventJSON)
		if err != nil {
			return nil, fmt.Errorf("line %d: %w", lineNum, err)
		}

		events = append(events, *event)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

// convertEventJSON 将 EventJSON 转换为 SyncEvent
func (p *JSONLParser) convertEventJSON(eventJSON *EventJSON) (*models.SyncEvent, error) {
	var timestamp time.Time
	var err error

	if eventJSON.Timestamp != "" {
		timestamp, err = time.Parse(time.RFC3339, eventJSON.Timestamp)
		if err != nil {
			// 尝试其他时间格式
			timestamp, err = time.Parse("2006-01-02 15:04:05", eventJSON.Timestamp)
			if err != nil {
				return nil, fmt.Errorf("invalid timestamp format: %s", eventJSON.Timestamp)
			}
		}
	} else {
		timestamp = time.Now()
	}

	event := &models.SyncEvent{
		PrimitiveName: eventJSON.PrimitiveName,
		PrimitiveType: eventJSON.PrimitiveType,
		EventType:     eventJSON.EventType,
		GoroutineID:   eventJSON.GoroutineID,
		Timestamp:     timestamp,
		Location:      eventJSON.Location,
		File:          eventJSON.File,
		Line:          eventJSON.Line,
		Details:       eventJSON.Details,
	}

	return event, nil
}

// ParseEventJSON 解析单个 JSON 事件
func (p *JSONLParser) ParseEventJSON(data []byte) (*models.SyncEvent, error) {
	var eventJSON EventJSON
	if err := json.Unmarshal(data, &eventJSON); err != nil {
		return nil, err
	}

	return p.convertEventJSON(&eventJSON)
}
