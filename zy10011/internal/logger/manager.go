package logger

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/deadlock-detector/internal/model"
)

type Manager struct {
	mu           sync.RWMutex
	filePath     string
	file         *os.File
	entries      []*model.LogEntry
	maxEntries   int
	startTime    time.Time
	endTime      time.Time
	errorCount   int64
	warningCount int64
	infoCount    int64
	debugCount   int64
}

func NewManager(filePath string) *Manager {
	dir := filepath.Dir(filePath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		fmt.Printf("创建日志目录失败: %v\n", err)
	}

	m := &Manager{
		filePath:   filePath,
		entries:    make([]*model.LogEntry, 0, 1000),
		maxEntries: 10000,
		startTime:  time.Now(),
	}

	m.openFile()
	return m
}

func (m *Manager) openFile() {
	f, err := os.OpenFile(m.filePath, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
	if err != nil {
		fmt.Printf("打开日志文件失败: %v\n", err)
		return
	}
	m.file = f
}

func (m *Manager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.endTime = time.Now()

	if m.file != nil {
		m.file.Sync()
		m.file.Close()
		m.file = nil
	}
}

func (m *Manager) Log(level, component, message string, data map[string]interface{}) {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry := &model.LogEntry{
		ID:        generateLogID(),
		Timestamp: time.Now(),
		Level:     level,
		Component: component,
		Message:   message,
		Data:      data,
	}

	m.entries = append(m.entries, entry)

	if len(m.entries) > m.maxEntries {
		m.entries = m.entries[len(m.entries)-m.maxEntries:]
	}

	m.updateCounters(level)
	m.writeToFile(entry)
}

func (m *Manager) Debug(component, message string, data map[string]interface{}) {
	m.Log("debug", component, message, data)
}

func (m *Manager) Info(component, message string, data map[string]interface{}) {
	m.Log("info", component, message, data)
}

func (m *Manager) Warn(component, message string, data map[string]interface{}) {
	m.Log("warn", component, message, data)
}

func (m *Manager) Error(component, message string, data map[string]interface{}) {
	m.Log("error", component, message, data)
}

func (m *Manager) Fatal(component, message string, data map[string]interface{}) {
	m.Log("fatal", component, message, data)
}

func (m *Manager) updateCounters(level string) {
	switch level {
	case "error", "fatal":
		m.errorCount++
	case "warn", "warning":
		m.warningCount++
	case "info":
		m.infoCount++
	case "debug":
		m.debugCount++
	}
}

func (m *Manager) writeToFile(entry *model.LogEntry) {
	if m.file == nil {
		return
	}

	line := fmt.Sprintf("[%s] [%s] [%s] %s",
		entry.Timestamp.Format(time.RFC3339),
		entry.Level,
		entry.Component,
		entry.Message)

	if len(entry.Data) > 0 {
		dataJSON, _ := json.Marshal(entry.Data)
		line += " " + string(dataJSON)
	}

	line += "\n"
	m.file.WriteString(line)
}

func (m *Manager) GetSummary() *model.LogSummary {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return &model.LogSummary{
		TotalEntries: int64(len(m.entries)),
		ErrorCount:   m.errorCount,
		WarningCount: m.warningCount,
		InfoCount:    m.infoCount,
		DebugCount:   m.debugCount,
		StartTime:    m.startTime,
		EndTime:      m.endTime,
	}
}

func (m *Manager) GetEntries(limit int) []*model.LogEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if limit <= 0 || limit > len(m.entries) {
		limit = len(m.entries)
	}

	result := make([]*model.LogEntry, limit)
	copy(result, m.entries[len(m.entries)-limit:])
	return result
}

func (m *Manager) GetErrors(limit int) []*model.LogEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	errors := make([]*model.LogEntry, 0)
	for i := len(m.entries) - 1; i >= 0 && len(errors) < limit; i-- {
		if m.entries[i].IsError() {
			errors = append(errors, m.entries[i])
		}
	}
	return errors
}

func (m *Manager) GetByComponent(component string, limit int) []*model.LogEntry {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]*model.LogEntry, 0, limit)
	for i := len(m.entries) - 1; i >= 0 && len(result) < limit; i-- {
		if m.entries[i].Component == component {
			result = append(result, m.entries[i])
		}
	}
	return result
}

func generateLogID() string {
	return fmt.Sprintf("log-%d", time.Now().UnixNano())
}
