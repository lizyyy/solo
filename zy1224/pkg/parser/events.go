package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
)

type Event struct {
	Timestamp string                 `json:"timestamp"`
	EventType string                 `json:"event_type"`
	CaseName  string                 `json:"case_name"`
	Details   map[string]interface{} `json:"details"`
}

func ParseEvents(path string) ([]*Event, error) {
	file, err := os.Open(path)
	if err != nil {
		// 文件不存在时返回空列表，不报错
		if os.IsNotExist(err) {
			return []*Event{}, nil
		}
		return nil, fmt.Errorf("打开文件失败: %w", err)
	}
	defer file.Close()

	var events []*Event
	scanner := bufio.NewScanner(file)
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		line := scanner.Text()
		if line == "" {
			continue
		}

		var event Event
		if err := json.Unmarshal([]byte(line), &event); err != nil {
			return nil, fmt.Errorf("第 %d 行 JSON 解析失败: %w\n内容: %s", lineNum, err, line)
		}

		if event.EventType == "" {
			return nil, fmt.Errorf("第 %d 行缺少 event_type 字段", lineNum)
		}

		events = append(events, &event)
	}

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("读取文件失败: %w", err)
	}

	return events, nil
}
