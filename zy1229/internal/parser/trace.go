package parser

import (
	"bufio"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"

	"go-perf-helper/internal/analyzer"
)

// TraceParser 解析 runtime/trace 格式的追踪数据
type TraceParser struct{}

// ParseTraceFile 解析追踪文件（支持文本格式和通过 go tool trace 导出的格式）
func (p *TraceParser) ParseTraceFile(path string) ([]analyzer.TraceEvent, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, fmt.Errorf("failed to open trace file: %w", err)
	}
	defer file.Close()

	// 尝试检测文件格式
	// 先读取前几行来判断格式
	scanner := bufio.NewScanner(file)
	var firstLines []string
	for i := 0; i < 10 && scanner.Scan(); i++ {
		firstLines = append(firstLines, scanner.Text())
	}

	// 重置文件指针
	file.Seek(0, io.SeekStart)

	// 判断格式
	if p.isGoToolTraceFormat(firstLines) {
		return p.parseGoToolTraceFormat(file)
	}

	// 默认使用简单文本格式解析
	return p.parseSimpleTextFormat(file)
}

// isGoToolTraceFormat 检测是否为 go tool trace 导出的格式
func (p *TraceParser) isGoToolTraceFormat(lines []string) bool {
	for _, line := range lines {
		// go tool trace 导出的格式通常包含时间戳、Goroutine ID 等
		if strings.Contains(line, "goroutine") || strings.Contains(line, "G=") ||
			strings.Contains(line, "GC") || strings.Contains(line, "STW") {
			return true
		}
	}
	return false
}

// parseGoToolTraceFormat 解析 go tool trace 导出的文本格式
func (p *TraceParser) parseGoToolTraceFormat(r io.Reader) ([]analyzer.TraceEvent, error) {
	scanner := bufio.NewScanner(r)
	var events []analyzer.TraceEvent

	for scanner.Scan() {
		line := scanner.Text()
		event := p.parseTraceLine(line)
		if event != nil {
			events = append(events, *event)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

// parseSimpleTextFormat 解析简单文本格式的追踪数据
func (p *TraceParser) parseSimpleTextFormat(r io.Reader) ([]analyzer.TraceEvent, error) {
	scanner := bufio.NewScanner(r)
	var events []analyzer.TraceEvent

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 尝试解析简单的事件格式
		parts := strings.Fields(line)
		if len(parts) < 2 {
			continue
		}

		event := &analyzer.TraceEvent{
			Type: parts[0],
		}

		// 尝试解析 Goroutine ID
		for _, part := range parts {
			if strings.HasPrefix(part, "G=") {
				gidStr := strings.TrimPrefix(part, "G=")
				gid, err := strconv.ParseUint(gidStr, 10, 64)
				if err == nil {
					event.GoroutineID = gid
				}
			}
		}

		events = append(events, *event)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	return events, nil
}

// parseTraceLine 解析单个追踪事件行
func (p *TraceParser) parseTraceLine(line string) *analyzer.TraceEvent {
	line = strings.TrimSpace(line)
	if line == "" {
		return nil
	}

	event := &analyzer.TraceEvent{}

	// 解析事件类型
	if strings.Contains(line, "GC") {
		event.Type = "GC"
	} else if strings.Contains(line, "STW") {
		event.Type = "STW"
	} else if strings.Contains(line, "goroutine") || strings.Contains(line, "G=") {
		// 检测 Goroutine 相关事件
		if strings.Contains(line, "created") {
			event.Type = "GoroutineCreate"
		} else if strings.Contains(line, "running") {
			event.Type = "GoroutineRunning"
		} else if strings.Contains(line, "blocked") || strings.Contains(line, "waiting") {
			event.Type = "GoroutineBlocked"
		} else if strings.Contains(line, "syscall") {
			event.Type = "GoroutineSyscall"
		} else {
			event.Type = "Goroutine"
		}
	} else {
		// 默认类型
		event.Type = "Unknown"
	}

	// 解析 Goroutine ID
	if idx := strings.Index(line, "G="); idx != -1 {
		rest := line[idx+2:]
		// 找到数字结束的位置
		endIdx := len(rest)
		for i, c := range rest {
			if c < '0' || c > '9' {
				endIdx = i
				break
			}
		}
		if endIdx > 0 {
			gidStr := rest[:endIdx]
			gid, err := strconv.ParseUint(gidStr, 10, 64)
			if err == nil {
				event.GoroutineID = gid
			}
		}
	}

	// 尝试解析时间戳
	if idx := strings.Index(line, "time="); idx != -1 {
		rest := line[idx+5:]
		// 查找时间值
		parts := strings.Fields(rest)
		if len(parts) > 0 {
			timeStr := strings.TrimSuffix(parts[0], "s")
			timeStr = strings.TrimSuffix(timeStr, "ms")
			timeStr = strings.TrimSuffix(timeStr, "µs")
			timeStr = strings.TrimSuffix(timeStr, "ns")
			
			duration, err := strconv.ParseFloat(timeStr, 64)
			if err == nil {
				event.Timestamp = time.Duration(duration)
			}
		}
	}

	// 尝试解析持续时间
	if idx := strings.Index(line, "duration="); idx != -1 {
		rest := line[idx+9:]
		parts := strings.Fields(rest)
		if len(parts) > 0 {
			duration, err := time.ParseDuration(parts[0])
			if err == nil {
				event.Duration = duration
			}
		}
	}

	// 构建调用栈（如果有）
	if strings.Contains(line, "stack:") || strings.Contains(line, "at") {
		// 简单的调用栈解析
		// 实际的追踪文件格式可能更复杂
		// 这里我们只做简单处理
		event.Stack = analyzer.CallStack{
			Frames: []analyzer.StackFrame{},
		}
	}

	return event
}

// ExtractGoroutineBlockingEvents 从追踪事件中提取 Goroutine 阻塞事件
func (p *TraceParser) ExtractGoroutineBlockingEvents(events []analyzer.TraceEvent) []analyzer.TraceEvent {
	var blockingEvents []analyzer.TraceEvent

	for _, event := range events {
		if event.Type == "GoroutineBlocked" || 
		   strings.Contains(event.Type, "Blocked") ||
		   strings.Contains(event.Type, "Waiting") {
			blockingEvents = append(blockingEvents, event)
		}
	}

	return blockingEvents
}

// ExtractGCEvents 从追踪事件中提取 GC 事件
func (p *TraceParser) ExtractGCEvents(events []analyzer.TraceEvent) []analyzer.TraceEvent {
	var gcEvents []analyzer.TraceEvent

	for _, event := range events {
		if event.Type == "GC" || event.Type == "STW" ||
		   strings.Contains(event.Type, "GC") {
			gcEvents = append(gcEvents, event)
		}
	}

	return gcEvents
}

// CalculateGoroutineStats 计算 Goroutine 统计信息
func (p *TraceParser) CalculateGoroutineStats(events []analyzer.TraceEvent) map[uint64]GoroutineStats {
	stats := make(map[uint64]GoroutineStats)

	for _, event := range events {
		gid := event.GoroutineID
		if gid == 0 {
			continue
		}

		s := stats[gid]
		s.GoroutineID = gid
		s.EventCount++

		switch event.Type {
		case "GoroutineRunning":
			s.RunningCount++
			s.TotalRunningTime += event.Duration
		case "GoroutineBlocked":
			s.BlockedCount++
			s.TotalBlockedTime += event.Duration
		case "GoroutineSyscall":
			s.SyscallCount++
			s.TotalSyscallTime += event.Duration
		}

		stats[gid] = s
	}

	return stats
}

// GoroutineStats Goroutine 统计信息
type GoroutineStats struct {
	GoroutineID        uint64
	EventCount         int
	RunningCount       int
	BlockedCount       int
	SyscallCount       int
	TotalRunningTime   time.Duration
	TotalBlockedTime   time.Duration
	TotalSyscallTime   time.Duration
}
