package replay

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
)

type ReplayEvent struct {
	Timestamp   time.Time
	Type        string
	ChannelID   string
	GoroutineID string
	Data        map[string]interface{}
}

type Manager struct {
	mu              sync.RWMutex
	logger          *logger.Manager
	events          []ReplayEvent
	captureEnabled  bool
	maxEvents       int
	replayDir       string
}

func NewManager(logMgr *logger.Manager) *Manager {
	return &Manager{
		logger:         logMgr,
		events:         make([]ReplayEvent, 0, 1000),
		captureEnabled: true,
		maxEvents:      10000,
		replayDir:      "replays",
	}
}

func (m *Manager) StartCapture() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.captureEnabled = true
	m.logger.Info("replay", "开始事件捕获", nil)
}

func (m *Manager) StopCapture() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.captureEnabled = false
	m.logger.Info("replay", "停止事件捕获", map[string]interface{}{
		"captured_events": len(m.events),
	})
}

func (m *Manager) RecordEvent(eventType, channelID, goroutineID string, data map[string]interface{}) {
	if !m.captureEnabled {
		return
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	event := ReplayEvent{
		Timestamp:   time.Now(),
		Type:        eventType,
		ChannelID:   channelID,
		GoroutineID: goroutineID,
		Data:        data,
	}

	m.events = append(m.events, event)

	if len(m.events) > m.maxEvents {
		m.events = m.events[len(m.events)-m.maxEvents:]
	}

	m.logger.Debug("replay", "记录回放事件", map[string]interface{}{
		"event_type":   eventType,
		"channel_id":   channelID,
		"goroutine_id": goroutineID,
		"total_events": len(m.events),
	})
}

func (m *Manager) GetEvents(fromTime, toTime time.Time) []ReplayEvent {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var filtered []ReplayEvent
	for _, e := range m.events {
		if (fromTime.IsZero() || !e.Timestamp.Before(fromTime)) &&
			(toTime.IsZero() || !e.Timestamp.After(toTime)) {
			filtered = append(filtered, e)
		}
	}
	return filtered
}

func (m *Manager) SaveReplay(filename string) error {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if err := os.MkdirAll(m.replayDir, 0755); err != nil {
		return fmt.Errorf("创建回放目录失败: %w", err)
	}

	filePath := filepath.Join(m.replayDir, filename)
	data, err := json.MarshalIndent(m.events, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化事件失败: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("写入回放文件失败: %w", err)
	}

	m.logger.Info("replay", "回放数据已保存", map[string]interface{}{
		"file_path":     filePath,
		"event_count":   len(m.events),
	})

	return nil
}

func (m *Manager) LoadReplay(filename string) ([]ReplayEvent, error) {
	filePath := filepath.Join(m.replayDir, filename)
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("读取回放文件失败: %w", err)
	}

	var events []ReplayEvent
	if err := json.Unmarshal(data, &events); err != nil {
		return nil, fmt.Errorf("反序列化事件失败: %w", err)
	}

	m.logger.Info("replay", "回放数据已加载", map[string]interface{}{
		"file_path":   filePath,
		"event_count": len(events),
	})

	return events, nil
}

func (m *Manager) CanReplay() bool {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.events) > 0
}

func (m *Manager) GenerateTimeline() []map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	timeline := make([]map[string]interface{}, 0, len(m.events))
	for i, e := range m.events {
		timeline = append(timeline, map[string]interface{}{
			"index":        i,
			"timestamp":    e.Timestamp.Format(time.RFC3339),
			"type":         e.Type,
			"channel_id":   e.ChannelID,
			"goroutine_id": e.GoroutineID,
			"data":         e.Data,
		})
	}
	return timeline
}

func (m *Manager) AnalyzeDeadlock(deadlock *model.DeadlockInfo) map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	analysis := map[string]interface{}{
		"deadlock_id":      deadlock.ID,
		"detected_at":      deadlock.DetectedAt.Format(time.RFC3339),
		"events_before":    0,
		"goroutine_events": make(map[string]int),
		"channel_events":   make(map[string]int),
	}

	for _, e := range m.events {
		if !e.Timestamp.After(deadlock.DetectedAt) {
			analysis["events_before"] = analysis["events_before"].(int) + 1

			if gEvents, ok := analysis["goroutine_events"].(map[string]int); ok {
				gEvents[e.GoroutineID]++
			}
			if cEvents, ok := analysis["channel_events"].(map[string]int); ok {
				cEvents[e.ChannelID]++
			}
		}
	}

	return analysis
}

func (m *Manager) GenerateMarkdownReport(report *model.Report, filePath string) error {
	if err := os.MkdirAll(filepath.Dir(filePath), 0755); err != nil {
		return fmt.Errorf("创建报告目录失败: %w", err)
	}

	content := m.buildReportContent(report)

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("写入报告失败: %w", err)
	}

	return nil
}

func (m *Manager) buildReportContent(report *model.Report) string {
	content := "# Go Channel 死锁诊断系统报告\n\n"
	content += fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05"))

	content += "## 系统信息\n\n"
	content += fmt.Sprintf("- Go 版本: %s\n", report.SystemInfo.GoVersion)
	content += fmt.Sprintf("- 平台: %s\n", report.SystemInfo.Platform)
	content += fmt.Sprintf("- CPU 核心数: %d\n", report.SystemInfo.NumCPU)
	content += fmt.Sprintf("- 当前 Goroutine 数: %d\n\n", report.SystemInfo.NumGoroutine)

	if report.LogSummary != nil {
		content += "## 日志统计\n\n"
		content += fmt.Sprintf("- 总日志数: %d\n", report.LogSummary.TotalEntries)
		content += fmt.Sprintf("- 错误数: %d\n", report.LogSummary.ErrorCount)
		content += fmt.Sprintf("- 警告数: %d\n", report.LogSummary.WarningCount)
		content += fmt.Sprintf("- 信息数: %d\n", report.LogSummary.InfoCount)
		content += fmt.Sprintf("- 调试数: %d\n", report.LogSummary.DebugCount)
		if !report.LogSummary.StartTime.IsZero() {
			content += fmt.Sprintf("- 记录时间: %s - %s\n\n",
				report.LogSummary.StartTime.Format("2006-01-02 15:04:05"),
				report.LogSummary.EndTime.Format("2006-01-02 15:04:05"))
		}
	}

	content += "## 死锁检测\n\n"
	if len(report.DeadlockDetections) == 0 {
		content += "未检测到死锁事件。\n\n"
	} else {
		for i, dl := range report.DeadlockDetections {
			content += fmt.Sprintf("### 死锁 #%d\n\n", i+1)
			content += fmt.Sprintf("- **ID**: %s\n", dl.ID)
			content += fmt.Sprintf("- **检测时间**: %s\n", dl.DetectedAt.Format("2006-01-02 15:04:05"))
			content += fmt.Sprintf("- **严重程度**: %s\n", dl.Severity)
			content += fmt.Sprintf("- **原因**: %s\n", dl.Reason)
			content += fmt.Sprintf("- **涉及 Goroutine**: %d\n", len(dl.Goroutines))
			content += fmt.Sprintf("- **涉及 Channel**: %d\n", len(dl.Channels))

			if dl.Resolved {
				content += fmt.Sprintf("- **状态**: 已解决\n")
				content += fmt.Sprintf("- **解决方式**: %s\n", dl.ResolutionType)
				content += fmt.Sprintf("- **持续时间**: %s\n", dl.Duration())
			} else {
				content += "- **状态**: 未解决\n"
			}
			content += "\n"
		}
	}

	content += "## 错误回放\n\n"
	if report.ReplayCapable {
		content += "系统支持错误回放，可通过回放文件重现问题场景。\n\n"
	} else {
		content += "当前暂无回放数据。\n\n"
	}

	content += "## 建议\n\n"
	if len(report.DeadlockDetections) > 0 {
		content += "1. **检查循环等待**: 分析 Goroutine 等待链，确保没有形成循环\n"
		content += "2. **使用带超时的操作**: 在 channel 操作中使用 `select` + `time.After`\n"
		content += "3. **统一锁顺序**: 确保所有 Goroutine 以相同顺序获取资源\n"
		content += "4. **设置合理的超时**: 避免无限期等待\n"
		content += "5. **使用 context**: 通过 context 控制生命周期\n\n"
	} else {
		content += "系统运行正常，继续保持良好的并发实践。\n\n"
	}

	content += "---\n"
	content += "*此报告由 Go Channel 死锁诊断系统自动生成*\n"

	return content
}

func (m *Manager) GetStatistics() map[string]interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	return map[string]interface{}{
		"captured_events":  len(m.events),
		"capture_enabled":  m.captureEnabled,
		"max_events":       m.maxEvents,
		"can_replay":       len(m.events) > 0,
	}
}
