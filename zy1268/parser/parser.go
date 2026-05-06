package parser

import (
	"bufio"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"go-runtime-analyzer/storage"
)

// StackFrame 表示一个栈帧
type StackFrame struct {
	Function string `json:"function"`
	File     string `json:"file"`
	Line     int    `json:"line"`
	PC       string `json:"pc,omitempty"`
}

// ParseStacktrace 解析 goroutine stacktrace
func ParseStacktrace(content string, sourceFile string) ([]storage.Stacktrace, error) {
	var traces []storage.Stacktrace
	lines := strings.Split(content, "\n")

	var currentTrace *storage.Stacktrace
	var frames []StackFrame

	goroutineRegex := regexp.MustCompile(`^goroutine (\d+) \[([^\]]+)\](?:, (\d+) minutes?)?:`)
	frameRegex := regexp.MustCompile(`^(\S+)\(([^)]*)\)$`)
	fileLineRegex := regexp.MustCompile(`^\s+(\S+):(\d+)(?:\s+\+0x([0-9a-fA-F]+))?$`)
	createdByRegex := regexp.MustCompile(`^created by (\S+) in goroutine (\d+)$`)

	for i := 0; i < len(lines); i++ {
		line := lines[i]

		// 匹配 goroutine 头
		if matches := goroutineRegex.FindStringSubmatch(line); matches != nil {
			// 保存之前的 trace
			if currentTrace != nil {
				framesJSON, _ := json.Marshal(frames)
				currentTrace.Frames = string(framesJSON)
				traces = append(traces, *currentTrace)
			}

			goroutineID, _ := strconv.Atoi(matches[1])
			status := matches[2]

			currentTrace = &storage.Stacktrace{
				Timestamp:   time.Now(),
				GoroutineID: goroutineID,
				Status:      status,
				Raw:         line,
				SourceFile:  sourceFile,
			}
			frames = nil
			continue
		}

		// 匹配 "created by" 行
		if currentTrace != nil && createdByRegex.MatchString(line) {
			currentTrace.Raw += "\n" + line
			continue
		}

		// 匹配函数行
		if currentTrace != nil && frameRegex.MatchString(line) {
			frameMatches := frameRegex.FindStringSubmatch(line)
			function := frameMatches[1]

			var file string
			var lineNum int
			var pc string

			// 下一行应该是文件:行号
			if i+1 < len(lines) {
				fileLine := lines[i+1]
				if fileMatches := fileLineRegex.FindStringSubmatch(fileLine); fileMatches != nil {
					file = fileMatches[1]
					lineNum, _ = strconv.Atoi(fileMatches[2])
					if len(fileMatches) > 3 {
						pc = fileMatches[3]
					}
					i++ // 跳过下一行
				}
			}

			frames = append(frames, StackFrame{
				Function: function,
				File:     file,
				Line:     lineNum,
				PC:       pc,
			})
			currentTrace.Raw += "\n" + line
			continue
		}

		// 追加到 raw 内容
		if currentTrace != nil && strings.TrimSpace(line) != "" {
			currentTrace.Raw += "\n" + line
		}
	}

	// 保存最后一个 trace
	if currentTrace != nil {
		framesJSON, _ := json.Marshal(frames)
		currentTrace.Frames = string(framesJSON)
		traces = append(traces, *currentTrace)
	}

	if len(traces) == 0 {
		return nil, fmt.Errorf("未解析到有效的 goroutine stacktrace")
	}

	return traces, nil
}

// ParseSchedtrace 解析 schedtrace 输出
func ParseSchedtrace(content string, sourceFile string) (*storage.Schedtrace, []storage.SchedGoroutine, error) {
	lines := strings.Split(content, "\n")
	var trace *storage.Schedtrace
	var goroutines []storage.SchedGoroutine

	// SCHED 行正则
	schedHeader := regexp.MustCompile(`^SCHED (\d+)ms: gomaxprocs=(\d+) idleprocs=(\d+) threads=(\d+) spinningthreads=(\d+) idlethreads=(\d+) runqueue=(\d+) \[([^\]]+)\]$`)
	// 单个 P 状态行
	procLine := regexp.MustCompile(`^\[(\d+)\]: (\w+) goroutine (\d+): (\S+) \((\d+)/(\d+)/(\d+)\)$`)
	// 表格格式行 (可能有表头)
	tableRow := regexp.MustCompile(`^\s*(\d+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\w+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)us$`)

	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}

		// 匹配 SCHED 头
		if matches := schedHeader.FindStringSubmatch(line); matches != nil {
			_ /* tickMs */, _ = strconv.Atoi(matches[1])
			gomaxprocs, _ := strconv.Atoi(matches[2])
			idleProcs, _ := strconv.Atoi(matches[3])
			threads, _ := strconv.Atoi(matches[4])
			spinningThreads, _ := strconv.Atoi(matches[5])
			idleThreads, _ := strconv.Atoi(matches[6])
			runQueue, _ := strconv.Atoi(matches[7])
			perProcRunQ := matches[8]

			trace = &storage.Schedtrace{
				Timestamp:       time.Now(),
				GOMAXPROCS:      gomaxprocs,
				IdleProcs:       idleProcs,
				Threads:         threads,
				SpinningThreads: spinningThreads,
				IdleThreads:     idleThreads,
				RunQueue:        runQueue,
				PerProcRunQ:     perProcRunQ,
				Raw:             content,
				SourceFile:      sourceFile,
			}

			// 解析 per-proc runqueue 并创建 goroutine 条目
			procQueues := strings.Fields(perProcRunQ)
			for procID, qLen := range procQueues {
				_ = procID
				qLenInt, _ := strconv.Atoi(strings.Trim(qLen, "[]"))
				_ = qLenInt
			}
			continue
		}

		// 匹配 [N]: 格式的 P 状态行
		if matches := procLine.FindStringSubmatch(line); matches != nil && trace != nil {
			procID, _ := strconv.Atoi(matches[1])
			status := matches[2]
			goroutineID, _ := strconv.Atoi(matches[3])
			function := matches[4]
			_ = procID

			goroutines = append(goroutines, storage.SchedGoroutine{
				GoroutineID: goroutineID,
				Status:      status,
				Function:    function,
				Latency:     0,
			})
			continue
		}

		// 匹配表格格式行
		if matches := tableRow.FindStringSubmatch(line); matches != nil && trace != nil {
			mID, _ := strconv.Atoi(matches[1])
			pIDStr := matches[2]
			goroutineID, _ := strconv.Atoi(matches[3])
			tick, _ := strconv.Atoi(matches[4])
			status := matches[5]
			// gomaxprocs, _ := strconv.Atoi(matches[6])
			// threads, _ := strconv.Atoi(matches[7])
			// idleProcs, _ := strconv.Atoi(matches[8])
			// runQ, _ := strconv.Atoi(matches[9])
			latency, _ := strconv.Atoi(matches[10])

			_ = mID
			_ = pIDStr

			goroutines = append(goroutines, storage.SchedGoroutine{
				GoroutineID: goroutineID,
				Status:      status,
				Latency:     int64(latency),
				Tick:        int64(tick),
			})
			continue
		}
	}

	if trace == nil {
		return nil, nil, fmt.Errorf("未解析到有效的 schedtrace 格式")
	}

	return trace, goroutines, nil
}

// ParsePreemptEvent 解析抢占事件日志
func ParsePreemptEvent(content string, sourceFile string) ([]storage.PreemptEvent, error) {
	var events []storage.PreemptEvent
	scanner := bufio.NewScanner(strings.NewReader(content))

	// 支持多种格式
	// 格式1: timestamp=..., goroutine=..., type=..., reason=..., duration=...
	// 格式2: 更简单的键值对或空格分隔

	kvRegex := regexp.MustCompile(`(\w+)=([^,\s]+)`)

	for scanner.Scan() {
		line := scanner.Text()
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// 解析键值对
		kvPairs := make(map[string]string)
		if matches := kvRegex.FindAllStringSubmatch(line, -1); matches != nil {
			for _, match := range matches {
				kvPairs[match[1]] = match[2]
			}
		}

		if len(kvPairs) == 0 {
			continue
		}

		// 提取字段
		var timestamp time.Time
		if ts, ok := kvPairs["timestamp"]; ok {
			if f, err := strconv.ParseFloat(ts, 64); err == nil {
				sec := int64(f)
				nsec := int64((f - float64(sec)) * 1e9)
				timestamp = time.Unix(sec, nsec)
			} else {
				timestamp = time.Now()
			}
		} else {
			timestamp = time.Now()
		}

		goroutineID := 0
		if g, ok := kvPairs["goroutine"]; ok {
			goroutineID, _ = strconv.Atoi(g)
		}

		eventType := ""
		if t, ok := kvPairs["type"]; ok {
			eventType = t
		} else if t, ok := kvPairs["event_type"]; ok {
			eventType = t
		}

		reason := kvPairs["reason"]

		duration := int64(0)
		if d, ok := kvPairs["duration"]; ok {
			// 去掉单位后缀
			d = strings.TrimSuffix(d, "us")
			d = strings.TrimSuffix(d, "µs")
			d = strings.TrimSuffix(d, "ms")
			duration, _ = strconv.ParseInt(d, 10, 64)
		}

		// 构建详情 JSON
		details := make(map[string]interface{})
		for k, v := range kvPairs {
			switch k {
			case "timestamp", "goroutine", "type", "event_type", "reason", "duration":
				continue
			default:
				details[k] = v
			}
		}

		detailsJSON, _ := json.Marshal(details)

		event := storage.PreemptEvent{
			Timestamp:   timestamp,
			GoroutineID: goroutineID,
			EventType:   eventType,
			Reason:      reason,
			Duration:    duration,
			Details:     string(detailsJSON),
			Raw:         line,
			SourceFile:  sourceFile,
		}

		events = append(events, event)
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	if len(events) == 0 {
		return nil, fmt.Errorf("未解析到有效的抢占事件")
	}

	return events, nil
}

// ParseBenchmark 解析 Go benchmark 输出
func ParseBenchmark(content string, sourceFile string) ([]storage.BenchmarkResult, error) {
	var results []storage.BenchmarkResult
	scanner := bufio.NewScanner(strings.NewReader(content))

	var goos, goarch, pkg, cpu string
	var rawContent strings.Builder

	// Benchmark 行正则
	benchRegex := regexp.MustCompile(`^Benchmark(\S+)-(\d+)\s+(\d+)\s+(\d+)\s+ns/op(?:\s+(\d+)\s+B/op)?(?:\s+(\d+)\s+allocs/op)?$`)

	for scanner.Scan() {
		line := scanner.Text()
		rawContent.WriteString(line)
		rawContent.WriteString("\n")

		// 提取元信息
		if strings.HasPrefix(line, "goos:") {
			goos = strings.TrimSpace(strings.TrimPrefix(line, "goos:"))
			continue
		}
		if strings.HasPrefix(line, "goarch:") {
			goarch = strings.TrimSpace(strings.TrimPrefix(line, "goarch:"))
			continue
		}
		if strings.HasPrefix(line, "pkg:") {
			pkg = strings.TrimSpace(strings.TrimPrefix(line, "pkg:"))
			continue
		}
		if strings.HasPrefix(line, "cpu:") {
			cpu = strings.TrimSpace(strings.TrimPrefix(line, "cpu:"))
			continue
		}

		// 匹配 benchmark 结果行
		if matches := benchRegex.FindStringSubmatch(line); matches != nil {
			testName := matches[1]
			// procs, _ := strconv.Atoi(matches[2])
			iterations, _ := strconv.ParseInt(matches[3], 10, 64)
			nsPerOp, _ := strconv.ParseInt(matches[4], 10, 64)

			bytesPerOp := int64(0)
			if matches[5] != "" {
				bytesPerOp, _ = strconv.ParseInt(matches[5], 10, 64)
			}

			allocsPerOp := int64(0)
			if matches[6] != "" {
				allocsPerOp, _ = strconv.ParseInt(matches[6], 10, 64)
			}

			if pkg != "" {
				testName = pkg + "." + testName
			}

			result := storage.BenchmarkResult{
				Timestamp:   time.Now(),
				TestName:    testName,
				Iterations:  iterations,
				NsPerOp:     nsPerOp,
				BytesPerOp:  bytesPerOp,
				AllocsPerOp: allocsPerOp,
				GoOS:        goos,
				GoArch:      goarch,
				CPU:         cpu,
				Raw:         line,
				SourceFile:  sourceFile,
			}

			results = append(results, result)
		}
	}

	if err := scanner.Err(); err != nil {
		return nil, err
	}

	// 更新 raw 字段为完整内容
	for i := range results {
		results[i].Raw = rawContent.String()
	}

	if len(results) == 0 {
		return nil, fmt.Errorf("未解析到有效的 benchmark 结果")
	}

	return results, nil
}

// ParseCodeSnippet 解析代码片段并检测潜在问题
func ParseCodeSnippet(content string, filePath string) (*storage.CodeSnippet, error) {
	issues := detectCodeIssues(content)
	issuesJSON, _ := json.Marshal(issues)

	return &storage.CodeSnippet{
		FilePath:   filePath,
		Content:    content,
		Issues:     string(issuesJSON),
		ImportedAt: time.Now(),
	}, nil
}

// CodeIssue 表示检测到的代码问题
type CodeIssue struct {
	Type        string `json:"type"`
	Severity    string `json:"severity"`
	Description string `json:"description"`
	Line        int    `json:"line,omitempty"`
	Snippet     string `json:"snippet,omitempty"`
}

// detectCodeIssues 检测代码中的潜在问题
func detectCodeIssues(content string) []CodeIssue {
	var issues []CodeIssue
	lines := strings.Split(content, "\n")

	// 检测 //go:nosplit
	nosplitRegex := regexp.MustCompile(`//go:nosplit`)
	for i, line := range lines {
		if nosplitRegex.MatchString(line) {
			// 查看后续几行找函数定义
			snippet := line
			if i+1 < len(lines) {
				snippet += "\n" + lines[i+1]
			}
			if i+2 < len(lines) {
				snippet += "\n" + lines[i+2]
			}

			issues = append(issues, CodeIssue{
				Type:        "nosplit",
				Severity:    "warning",
				Description: "检测到 //go:nosplit 标记。nosplit 函数在调用时不会检查栈溢出，可能导致栈增长延迟或栈溢出。",
				Line:        i + 1,
				Snippet:     snippet,
			})
		}
	}

	// 检测潜在的长循环（没有函数调用的 for 循环）
	// 简单检测：for 循环体中只有简单操作
	forLoopRegex := regexp.MustCompile(`^\s*for\s+`)
	inLoop := false
	loopStart := 0
	loopLines := 0
	hasFuncCall := false

	for i, line := range lines {
		trimmed := strings.TrimSpace(line)

		if forLoopRegex.MatchString(line) {
			inLoop = true
			loopStart = i
			loopLines = 0
			hasFuncCall = false
			continue
		}

		if inLoop {
			// 检测是否有函数调用（包含 ( 的行）
			if strings.Contains(line, "(") && !strings.Contains(line, "for") {
				hasFuncCall = true
			}

			// 检测循环结束（{ } 匹配比较复杂，简化处理）
			if strings.Contains(trimmed, "}") && loopLines > 3 && !hasFuncCall {
				// 可能是长循环结束
				snippet := strings.Join(lines[loopStart:i+1], "\n")

				issues = append(issues, CodeIssue{
					Type:        "long_loop",
					Severity:    "warning",
					Description: "检测到可能缺少抢占点的长循环。Go 1.14+ 支持异步抢占，但纯计算密集型循环仍可能导致调度延迟。考虑添加 runtime.Gosched() 或拆分为较小的块。",
					Line:        loopStart + 1,
					Snippet:     snippet,
				})
				inLoop = false
			}

			loopLines++
		}
	}

	// 检测 syscall 调用
	syscallRegex := regexp.MustCompile(`syscall\.\w+|os\.(File|Open|Create|Read|Write)`)
	for i, line := range lines {
		if syscallRegex.MatchString(line) {
			// 提取上下文
			start := max(0, i-2)
			end := min(len(lines), i+3)
			snippet := strings.Join(lines[start:end], "\n")

			issues = append(issues, CodeIssue{
				Type:        "syscall_block",
				Severity:    "info",
				Description: "检测到系统调用。系统调用可能阻塞调度器，特别是在慢速 I/O 或网络操作中。考虑使用非阻塞 I/O 或在单独的 goroutine 中执行。",
				Line:        i + 1,
				Snippet:     snippet,
			})
		}
	}

	// 检测 cgo 调用
	cgoRegex := regexp.MustCompile(`C\.\w+|import "C"`)
	for i, line := range lines {
		if cgoRegex.MatchString(line) {
			snippet := line
			if i+1 < len(lines) {
				snippet += "\n" + lines[i+1]
			}

			issues = append(issues, CodeIssue{
				Type:        "cgo_call",
				Severity:    "warning",
				Description: "检测到 cgo 调用。cgo 调用会阻塞调度器，因为 Go 运行时无法抢占 C 代码。频繁的 cgo 调用可能导致严重的调度延迟。",
				Line:        i + 1,
				Snippet:     snippet,
			})
		}
	}

	return issues
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// ValidateStacktraceFormat 验证 stacktrace 格式
func ValidateStacktraceFormat(content string) error {
	// 检查是否包含 "goroutine" 关键字
	if !strings.Contains(content, "goroutine") {
		return fmt.Errorf("缺少 'goroutine' 关键字，可能不是有效的 stacktrace")
	}

	// 检查是否有函数调用栈格式（包含 .go: 行号）
	if !strings.Contains(content, ".go:") {
		return fmt.Errorf("缺少文件:行号格式的栈帧信息")
	}

	return nil
}

// ValidateSchedtraceFormat 验证 schedtrace 格式
func ValidateSchedtraceFormat(content string) error {
	if !strings.Contains(content, "SCHED") {
		return fmt.Errorf("缺少 'SCHED' 关键字，可能不是有效的 schedtrace")
	}

	if !strings.Contains(content, "gomaxprocs") {
		return fmt.Errorf("缺少 'gomaxprocs' 信息")
	}

	return nil
}

// ValidatePreemptEventFormat 验证抢占事件格式
func ValidatePreemptEventFormat(content string) error {
	// 检查是否有键值对格式
	if !strings.Contains(content, "=") {
		return fmt.Errorf("缺少键值对格式 (key=value)")
	}

	// 检查关键字段
	requiredFields := []string{"goroutine", "type", "duration"}
	for _, field := range requiredFields {
		if !strings.Contains(content, field+"=") {
			return fmt.Errorf("缺少必需字段: %s=", field)
		}
	}

	return nil
}

// ValidateBenchmarkFormat 验证 benchmark 格式
func ValidateBenchmarkFormat(content string) error {
	if !strings.Contains(content, "Benchmark") {
		return fmt.Errorf("缺少 'Benchmark' 关键字，可能不是有效的 benchmark 输出")
	}

	if !strings.Contains(content, "ns/op") {
		return fmt.Errorf("缺少 'ns/op' 时间单位")
	}

	return nil
}
