package analyzer

import (
	"encoding/json"
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"regexp"
	"sort"
	"strings"

	"concurrency-inspector/internal/models"
)

type Analyzer struct {
	config   *models.DesignConfig
	events   []models.Event
	snippets []models.CodeSnippet
}

func NewAnalyzer(config *models.DesignConfig, events []models.Event, snippets []models.CodeSnippet) *Analyzer {
	return &Analyzer{
		config:   config,
		events:   events,
		snippets: snippets,
	}
}

func (a *Analyzer) Analyze() (*models.AnalysisResult, error) {
	result := &models.AnalysisResult{
		Issues:          []models.Issue{},
		Recommendations: []models.Recommendation{},
	}

	var err error

	result.GoroutineTopology, err = a.analyzeTopology()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze topology: %w", err)
	}

	result.QueueAnalysis, err = a.analyzeQueues()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze queues: %w", err)
	}

	result.BackpressureAnalysis, err = a.analyzeBackpressure()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze backpressure: %w", err)
	}

	result.PriorityAnalysis, err = a.analyzePriority()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze priority: %w", err)
	}

	result.TimeoutAnalysis, err = a.analyzeTimeout()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze timeout: %w", err)
	}

	result.ErrorAnalysis, err = a.analyzeErrors()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze errors: %w", err)
	}

	result.ShutdownAnalysis, err = a.analyzeShutdown()
	if err != nil {
		return nil, fmt.Errorf("failed to analyze shutdown: %w", err)
	}

	a.collectIssues(result)
	result.OverallScore = a.calculateScore(result)
	a.generateRecommendations(result)

	return result, nil
}

func (a *Analyzer) analyzeTopology() (*models.TopologyResult, error) {
	topology := &models.TopologyResult{
		Nodes:    []models.TopologyNode{},
		Edges:    []models.TopologyEdge{},
		Cycles:   []string{},
		Orphaned: []string{},
		Patterns: []models.DetectedPattern{},
	}

	queueMap := make(map[string]models.QueueSpec)
	for _, q := range a.config.Queues {
		queueMap[q.Name] = q
		topology.Nodes = append(topology.Nodes, models.TopologyNode{
			Name:     q.Name,
			Type:     "queue",
			Workers:  0,
			Capacity: q.Capacity,
		})
	}

	for _, g := range a.config.Goroutines {
		topology.Nodes = append(topology.Nodes, models.TopologyNode{
			Name:     g.Name,
			Type:     g.Type,
			Workers:  g.Workers,
			Capacity: 0,
		})

		for _, input := range g.InputQueues {
			if _, exists := queueMap[input]; exists {
				topology.Edges = append(topology.Edges, models.TopologyEdge{
					From: input,
					To:   g.Name,
					Type: "data",
				})
			}
		}

		for _, output := range g.OutputQueues {
			if _, exists := queueMap[output]; exists {
				topology.Edges = append(topology.Edges, models.TopologyEdge{
					From: g.Name,
					To:   output,
					Type: "data",
				})
			}
		}
	}

	if cycles := a.detectCycles(topology); len(cycles) > 0 {
		topology.Cycles = cycles
	}

	topology.Orphaned = a.detectOrphaned(topology)
	topology.Patterns = a.detectPatterns(topology)

	return topology, nil
}

func (a *Analyzer) detectCycles(topology *models.TopologyResult) []string {
	adjList := make(map[string][]string)
	for _, edge := range topology.Edges {
		adjList[edge.From] = append(adjList[edge.From], edge.To)
	}

	visited := make(map[string]bool)
	recStack := make(map[string]bool)
	cycles := []string{}

	var dfs func(node string, path []string)
	dfs = func(node string, path []string) {
		if recStack[node] {
			for i, n := range path {
				if n == node {
					cycle := append(path[i:], node)
					cycles = append(cycles, strings.Join(cycle, " -> "))
					return
				}
			}
			return
		}

		if visited[node] {
			return
		}

		visited[node] = true
		recStack[node] = true
		newPath := append(path, node)

		for _, neighbor := range adjList[node] {
			dfs(neighbor, newPath)
		}

		recStack[node] = false
	}

	for _, node := range topology.Nodes {
		if !visited[node.Name] {
			dfs(node.Name, []string{})
		}
	}

	return cycles
}

func (a *Analyzer) detectOrphaned(topology *models.TopologyResult) []string {
	hasInputs := make(map[string]bool)
	hasOutputs := make(map[string]bool)

	for _, edge := range topology.Edges {
		hasOutputs[edge.From] = true
		hasInputs[edge.To] = true
	}

	orphaned := []string{}
	for _, node := range topology.Nodes {
		if node.Type != "queue" {
			if !hasInputs[node.Name] && !hasOutputs[node.Name] {
				orphaned = append(orphaned, node.Name)
			}
		}
	}

	return orphaned
}

func (a *Analyzer) detectPatterns(topology *models.TopologyResult) []models.DetectedPattern {
	patterns := []models.DetectedPattern{}

	configPatterns := a.config.Concurrency.Patterns
	for _, p := range configPatterns {
		pattern := models.DetectedPattern{
			Name:       p,
			Confidence: 1.0,
		}

		switch p {
		case "worker-pool":
			pattern.Description = "Worker Pool 模式: 多个 worker 从同一队列消费任务"
			if a.hasWorkerPoolPattern() {
				pattern.Confidence = 1.0
			}
		case "fan-in":
			pattern.Description = "Fan-In 模式: 多个 goroutine 输出到同一队列"
			if a.hasFanInPattern() {
				pattern.Confidence = 1.0
			}
		case "fan-out":
			pattern.Description = "Fan-Out 模式: 单个 goroutine 输出到多个队列"
			if a.hasFanOutPattern() {
				pattern.Confidence = 1.0
			}
		case "pipeline":
			pattern.Description = "Pipeline 模式: 串行处理链路"
			if a.hasPipelinePattern() {
				pattern.Confidence = 0.8
			}
		}

		patterns = append(patterns, pattern)
	}

	return patterns
}

func (a *Analyzer) hasWorkerPoolPattern() bool {
	for _, g := range a.config.Goroutines {
		if g.Workers > 1 && len(g.InputQueues) > 0 {
			return true
		}
	}
	return false
}

func (a *Analyzer) hasFanInPattern() bool {
	queueConsumers := make(map[string]int)
	for _, g := range a.config.Goroutines {
		for _, q := range g.InputQueues {
			queueConsumers[q] += g.Workers
		}
	}
	for _, count := range queueConsumers {
		if count > 1 {
			return true
		}
	}
	return false
}

func (a *Analyzer) hasFanOutPattern() bool {
	for _, g := range a.config.Goroutines {
		if len(g.OutputQueues) > 1 {
			return true
		}
	}
	return false
}

func (a *Analyzer) hasPipelinePattern() bool {
	if len(a.config.Goroutines) >= 3 {
		return true
	}
	return false
}

func (a *Analyzer) analyzeQueues() (*models.QueueAnalysis, error) {
	analysis := &models.QueueAnalysis{
		Queues: []models.QueueStatus{},
		Issues: []models.QueueIssue{},
	}

	for _, q := range a.config.Queues {
		status := models.QueueStatus{
			Name:     q.Name,
			Type:     q.Type,
			Capacity: q.Capacity,
			Status:   "ok",
		}

		if q.Capacity <= 0 {
			status.Status = "critical"
			analysis.Issues = append(analysis.Issues, models.QueueIssue{
				Name:      q.Name,
				IssueType: "unbounded",
				Severity:  "critical",
				Description: fmt.Sprintf("队列 %s 是无界的(容量=%d)，可能导致内存无限增长", q.Name, q.Capacity),
			})
		} else if q.Capacity < 10 {
			status.Status = "warning"
			analysis.Issues = append(analysis.Issues, models.QueueIssue{
				Name:      q.Name,
				IssueType: "too_small",
				Severity:  "warning",
				Description: fmt.Sprintf("队列 %s 容量过小(%d)，可能导致频繁阻塞", q.Name, q.Capacity),
			})
		}

		consumers := a.countQueueConsumers(q.Name)
		producers := a.countQueueProducers(q.Name)

		if consumers == 0 {
			status.Status = "critical"
			analysis.Issues = append(analysis.Issues, models.QueueIssue{
				Name:      q.Name,
				IssueType: "no_consumers",
				Severity:  "critical",
				Description: fmt.Sprintf("队列 %s 没有消费者，会导致 goroutine 泄漏", q.Name),
			})
		}

		if producers == 0 {
			analysis.Issues = append(analysis.Issues, models.QueueIssue{
				Name:      q.Name,
				IssueType: "no_producers",
				Severity:  "warning",
				Description: fmt.Sprintf("队列 %s 没有生产者", q.Name),
			})
		}

		analysis.Queues = append(analysis.Queues, status)
	}

	return analysis, nil
}

func (a *Analyzer) countQueueConsumers(queueName string) int {
	count := 0
	for _, g := range a.config.Goroutines {
		for _, q := range g.InputQueues {
			if q == queueName {
				count += g.Workers
			}
		}
	}
	return count
}

func (a *Analyzer) countQueueProducers(queueName string) int {
	count := 0
	for _, g := range a.config.Goroutines {
		for _, q := range g.OutputQueues {
			if q == queueName {
				count += g.Workers
			}
		}
	}
	return count
}

func (a *Analyzer) analyzeBackpressure() (*models.BackpressureAnalysis, error) {
	analysis := &models.BackpressureAnalysis{
		HasBackpressure: false,
		Bottlenecks:     []string{},
		Strategies:      []string{},
	}

	for _, q := range a.config.Queues {
		consumers := a.countQueueConsumers(q.Name)
		producers := a.countQueueProducers(q.Name)

		if consumers > 0 && producers > consumers*2 {
			analysis.HasBackpressure = true
			analysis.Bottlenecks = append(analysis.Bottlenecks, q.Name)
		}
	}

	for _, g := range a.config.Goroutines {
		if g.Type == "worker" && g.Workers > 0 {
			analysis.Strategies = append(analysis.Strategies, fmt.Sprintf("Worker Pool (%d workers)", g.Workers))
		}
	}

	if a.config.Concurrency.RateLimit != nil {
		analysis.Strategies = append(analysis.Strategies,
			fmt.Sprintf("Rate Limiting (%d req/s, burst: %d)",
				a.config.Concurrency.RateLimit.Requests,
				a.config.Concurrency.RateLimit.Burst))
	}

	return analysis, nil
}

func (a *Analyzer) analyzePriority() (*models.PriorityAnalysis, error) {
	analysis := &models.PriorityAnalysis{
		HasPriorityQueues: false,
		PriorityQueues:     []string{},
		Issues:             []models.PriorityIssue{},
	}

	for _, q := range a.config.Queues {
		if q.Priority {
			analysis.HasPriorityQueues = true
			analysis.PriorityQueues = append(analysis.PriorityQueues, q.Name)

			if q.Type != "priority-queue" && q.Type != "custom" {
				analysis.Issues = append(analysis.Issues, models.PriorityIssue{
					QueueName:   q.Name,
					IssueType:   "incompatible_type",
					Description: fmt.Sprintf("队列 %s 标记为优先级队列但类型是 %s，可能不支持优先级排序", q.Name, q.Type),
				})
			}
		}
	}

	return analysis, nil
}

func (a *Analyzer) analyzeTimeout() (*models.TimeoutAnalysis, error) {
	analysis := &models.TimeoutAnalysis{
		DefaultTimeout:      a.config.Timeout.Default,
		HasCancelPropagate:  a.config.Timeout.CancelPropagate,
		UncoveredOperations: []string{},
	}

	totalTimeout := "0s"
	if a.config.Timeout.Operation != "" {
		totalTimeout = a.config.Timeout.Operation
	}
	if a.config.Timeout.Startup != "" {
		totalTimeout = a.config.Timeout.Startup + " + " + totalTimeout
	}
	if a.config.Timeout.Shutdown != "" {
		totalTimeout = totalTimeout + " + " + a.config.Timeout.Shutdown
	}
	analysis.TimeoutBudget = totalTimeout

	if !a.config.Timeout.CancelPropagate {
		analysis.UncoveredOperations = append(analysis.UncoveredOperations,
			"取消传播未启用，可能导致 goroutine 泄漏")
	}

	hasContextUsage := a.checkContextUsageInSnippets()
	if !hasContextUsage {
		analysis.UncoveredOperations = append(analysis.UncoveredOperations,
			"代码片段中未检测到 context 使用，超时和取消可能无法正确传播")
	}

	return analysis, nil
}

func (a *Analyzer) checkContextUsageInSnippets() bool {
	for _, snippet := range a.snippets {
		if strings.Contains(snippet.Content, "context.Context") ||
			strings.Contains(snippet.Content, "context.WithTimeout") ||
			strings.Contains(snippet.Content, "context.WithCancel") ||
			strings.Contains(snippet.Content, "ctx.Done()") {
			return true
		}
	}
	return false
}

func (a *Analyzer) analyzeErrors() (*models.ErrorAnalysis, error) {
	analysis := &models.ErrorAnalysis{
		Strategy:       a.config.Error.Strategy,
		HasErrorQueue:  a.config.Error.ErrorQueue != "",
		HasPanicHandler: a.config.Error.PanicHandler,
		UnhandledPaths: []string{},
	}

	if a.config.Error.MaxRetries > 0 {
		analysis.RetryConfig = &models.RetryConfig{
			MaxRetries: a.config.Error.MaxRetries,
			Backoff:    a.config.Error.RetryBackoff,
		}
	}

	switch a.config.Error.Strategy {
	case "fail-fast":
		if !a.config.Error.PanicHandler {
			analysis.UnhandledPaths = append(analysis.UnhandledPaths,
				"fail-fast 策略下没有 panic handler，可能导致程序崩溃")
		}
	case "continue-on-error":
		if a.config.Error.ErrorQueue == "" {
			analysis.UnhandledPaths = append(analysis.UnhandledPaths,
				"continue-on-error 策略下没有错误队列，错误可能丢失")
		}
	}

	if a.config.Error.MaxRetries > 0 && a.config.Error.RetryBackoff == "" {
		analysis.UnhandledPaths = append(analysis.UnhandledPaths,
			"配置了重试但没有退避策略，可能导致重试风暴")
	}

	return analysis, nil
}

func (a *Analyzer) analyzeShutdown() (*models.ShutdownAnalysis, error) {
	analysis := &models.ShutdownAnalysis{
		Graceful:      a.config.Shutdown.Graceful,
		ShutdownOrder: a.config.Shutdown.Order,
		WaitTimeout:   a.config.Shutdown.WaitTimeout,
		HasForceKill:  a.config.Shutdown.ForceKill,
		Issues:        []models.ShutdownIssue{},
	}

	if !a.config.Shutdown.Graceful {
		analysis.Issues = append(analysis.Issues, models.ShutdownIssue{
			IssueType:   "no_graceful_shutdown",
			Description: "未启用优雅关闭，可能导致正在处理的任务丢失",
			Severity:    "critical",
		})
	}

	definedGoroutines := make(map[string]bool)
	for _, g := range a.config.Goroutines {
		definedGoroutines[g.Name] = true
	}

	for _, name := range a.config.Shutdown.Order {
		if !definedGoroutines[name] {
			analysis.Issues = append(analysis.Issues, models.ShutdownIssue{
				IssueType:   "unknown_goroutine",
				Description: fmt.Sprintf("关闭顺序中包含未定义的 goroutine: %s", name),
				Severity:    "warning",
			})
		}
		delete(definedGoroutines, name)
	}

	for name := range definedGoroutines {
		analysis.Issues = append(analysis.Issues, models.ShutdownIssue{
			IssueType:   "missing_shutdown_order",
			Description: fmt.Sprintf("goroutine %s 未在关闭顺序中定义", name),
			Severity:    "warning",
		})
	}

	if a.config.Shutdown.WaitTimeout == "" || a.config.Shutdown.WaitTimeout == "0s" {
		analysis.Issues = append(analysis.Issues, models.ShutdownIssue{
			IssueType:   "no_wait_timeout",
			Description: "未配置关闭等待超时，可能导致无限等待",
			Severity:    "critical",
		})
	}

	return analysis, nil
}

func (a *Analyzer) collectIssues(result *models.AnalysisResult) {
	if len(result.GoroutineTopology.Cycles) > 0 {
		for _, cycle := range result.GoroutineTopology.Cycles {
			result.Issues = append(result.Issues, models.Issue{
				Severity:    "critical",
				Category:    "topology",
				Description: fmt.Sprintf("检测到循环依赖: %s", cycle),
				Suggestion:  "重新设计数据流，避免循环依赖",
			})
		}
	}

	if len(result.GoroutineTopology.Orphaned) > 0 {
		for _, orphan := range result.GoroutineTopology.Orphaned {
			result.Issues = append(result.Issues, models.Issue{
				Severity:    "warning",
				Category:    "topology",
				Description: fmt.Sprintf("孤立的 goroutine: %s (没有输入和输出)", orphan),
				Suggestion:  "检查是否需要这个 goroutine，或者连接到数据流中",
			})
		}
	}

	for _, qIssue := range result.QueueAnalysis.Issues {
		result.Issues = append(result.Issues, models.Issue{
			Severity:    qIssue.Severity,
			Category:    "queue",
			Description: qIssue.Description,
			Location:    qIssue.Name,
		})
	}

	if result.BackpressureAnalysis.HasBackpressure {
		for _, bottleneck := range result.BackpressureAnalysis.Bottlenecks {
			result.Issues = append(result.Issues, models.Issue{
				Severity:    "high",
				Category:    "backpressure",
				Description: fmt.Sprintf("队列 %s 可能成为瓶颈", bottleneck),
				Suggestion:  "增加消费者数量或扩大队列容量",
			})
		}
	}

	for _, pIssue := range result.PriorityAnalysis.Issues {
		result.Issues = append(result.Issues, models.Issue{
			Severity:    "warning",
			Category:    "priority",
			Description: pIssue.Description,
			Location:    pIssue.QueueName,
		})
	}

	for _, uncovered := range result.TimeoutAnalysis.UncoveredOperations {
		result.Issues = append(result.Issues, models.Issue{
			Severity:    "high",
			Category:    "timeout",
			Description: uncovered,
			Suggestion:  "启用 context 取消传播，确保超时能正确传递",
		})
	}

	for _, unhandled := range result.ErrorAnalysis.UnhandledPaths {
		result.Issues = append(result.Issues, models.Issue{
			Severity:    "high",
			Category:    "error",
			Description: unhandled,
		})
	}

	for _, sIssue := range result.ShutdownAnalysis.Issues {
		result.Issues = append(result.Issues, models.Issue{
			Severity:    sIssue.Severity,
			Category:    "shutdown",
			Description: sIssue.Description,
		})
	}

	a.analyzeCodeSnippets(result)
}

func (a *Analyzer) analyzeCodeSnippets(result *models.AnalysisResult) {
	for _, snippet := range a.snippets {
		issues := a.analyzeGoCode(snippet)
		for _, issue := range issues {
			issue.Location = filepath.Base(snippet.Filename)
			result.Issues = append(result.Issues, issue)
		}
	}
}

func (a *Analyzer) analyzeGoCode(snippet models.CodeSnippet) []models.Issue {
	issues := []models.Issue{}

	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, snippet.Filename, snippet.Content, parser.AllErrors)
	if err != nil {
		issues = append(issues, models.Issue{
			Severity:    "warning",
			Category:    "code",
			Description: fmt.Sprintf("无法解析代码: %v", err),
			Location:    filepath.Base(snippet.Filename),
		})
		return issues
	}

	ast.Inspect(file, func(n ast.Node) bool {
		switch node := n.(type) {
		case *ast.GoStmt:
			issues = append(issues, a.analyzeGoStmt(node, snippet, fset)...)
		case *ast.SelectStmt:
			issues = append(issues, a.analyzeSelectStmt(node, snippet, fset)...)
		case *ast.ForStmt:
			issues = append(issues, a.analyzeForStmt(node, snippet, fset)...)
		case *ast.RangeStmt:
			issues = append(issues, a.analyzeRangeStmt(node, snippet, fset)...)
		}
		return true
	})

	content := snippet.Content

	if strings.Contains(content, "go func()") {
		if !a.hasGoroutineRecovery(content) {
			issues = append(issues, models.Issue{
				Severity:    "critical",
				Category:    "goroutine_leak",
				Description: "goroutine 中没有 panic recovery，可能导致整个程序崩溃",
				Suggestion:  "在 goroutine 开始处添加 defer recover()",
				Location:    filepath.Base(snippet.Filename),
			})
		}
	}

	if a.hasUnbufferedChannelSend(content) {
		issues = append(issues, models.Issue{
			Severity:    "high",
			Category:    "deadlock",
			Description: "检测到可能的无缓冲 channel 发送阻塞",
			Suggestion:  "使用带缓冲的 channel 或确保接收方已准备好",
			Location:    filepath.Base(snippet.Filename),
		})
	}

	if a.hasInfiniteLoop(content) {
		issues = append(issues, models.Issue{
			Severity:    "warning",
			Category:    "infinite_loop",
			Description: "检测到可能的无限循环，缺少退出条件",
			Suggestion:  "添加 context.Done() 或其他退出条件",
			Location:    filepath.Base(snippet.Filename),
		})
	}

	return issues
}

func (a *Analyzer) analyzeGoStmt(node *ast.GoStmt, snippet models.CodeSnippet, fset *token.FileSet) []models.Issue {
	issues := []models.Issue{}

	pos := fset.Position(node.Pos())

	if funcLit, ok := node.Call.Fun.(*ast.FuncLit); ok {
		hasRecover := false
		hasDefer := false

		for _, stmt := range funcLit.Body.List {
			if deferStmt, ok := stmt.(*ast.DeferStmt); ok {
				hasDefer = true
				if call, ok := deferStmt.Call.Fun.(*ast.Ident); ok && call.Name == "recover" {
					hasRecover = true
				}
			}
		}

		if !hasDefer {
			issues = append(issues, models.Issue{
				Severity:    "high",
				Category:    "goroutine",
				Description: fmt.Sprintf("goroutine (行 %d) 没有 defer 语句", pos.Line),
				Suggestion:  "添加 defer 以确保资源清理",
				Location:    fmt.Sprintf("%s:%d", snippet.Filename, pos.Line),
			})
		}

		if !hasRecover && !hasDefer {
			issues = append(issues, models.Issue{
				Severity:    "critical",
				Category:    "panic",
				Description: fmt.Sprintf("goroutine (行 %d) 没有 panic recovery", pos.Line),
				Suggestion:  "添加 defer recover() 防止 panic 传播",
				Location:    fmt.Sprintf("%s:%d", snippet.Filename, pos.Line),
			})
		}
	}

	return issues
}

func (a *Analyzer) analyzeSelectStmt(node *ast.SelectStmt, snippet models.CodeSnippet, fset *token.FileSet) []models.Issue {
	issues := []models.Issue{}

	pos := fset.Position(node.Pos())
	hasDefault := false
	hasContextDone := false

	for _, comm := range node.Body.List {
		if caseClause, ok := comm.(*ast.CaseClause); ok {
			if caseClause.List == nil {
				hasDefault = true
			} else {
				for _, expr := range caseClause.List {
					if unary, ok := expr.(*ast.UnaryExpr); ok {
						if sel, ok := unary.X.(*ast.SelectorExpr); ok {
							if ident, ok := sel.X.(*ast.Ident); ok && ident.Name == "ctx" && sel.Sel.Name == "Done" {
								hasContextDone = true
							}
						}
					}
				}
			}
		}
	}

	if !hasContextDone && !hasDefault {
		issues = append(issues, models.Issue{
			Severity:    "warning",
			Category:    "timeout",
			Description: fmt.Sprintf("select 语句 (行 %d) 没有 context.Done() 或 default case", pos.Line),
			Suggestion:  "添加 context.Done() 以支持取消，或使用 default case",
			Location:    fmt.Sprintf("%s:%d", snippet.Filename, pos.Line),
		})
	}

	return issues
}

func (a *Analyzer) analyzeForStmt(node *ast.ForStmt, snippet models.CodeSnippet, fset *token.FileSet) []models.Issue {
	issues := []models.Issue{}

	pos := fset.Position(node.Pos())

	if node.Cond == nil && node.Init == nil && node.Post == nil {
		hasBreak := false
		hasReturn := false
		hasContextDone := false

		for _, stmt := range node.Body.List {
			a.inspectLoopBody(stmt, &hasBreak, &hasReturn, &hasContextDone)
		}

		if !hasBreak && !hasReturn && !hasContextDone {
			issues = append(issues, models.Issue{
				Severity:    "critical",
				Category:    "infinite_loop",
				Description: fmt.Sprintf("for 循环 (行 %d) 可能是无限循环，缺少退出条件", pos.Line),
				Suggestion:  "添加 break、return 或 context.Done() 退出条件",
				Location:    fmt.Sprintf("%s:%d", snippet.Filename, pos.Line),
			})
		}
	}

	return issues
}

func (a *Analyzer) analyzeRangeStmt(node *ast.RangeStmt, snippet models.CodeSnippet, fset *token.FileSet) []models.Issue {
	issues := []models.Issue{}
	return issues
}

func (a *Analyzer) inspectLoopBody(stmt ast.Stmt, hasBreak, hasReturn, hasContextDone *bool) {
	switch s := stmt.(type) {
	case *ast.BranchStmt:
		if s.Tok == token.BREAK {
			*hasBreak = true
		}
	case *ast.ReturnStmt:
		*hasReturn = true
	case *ast.SelectStmt:
		for _, comm := range s.Body.List {
			if caseClause, ok := comm.(*ast.CaseClause); ok {
				for _, expr := range caseClause.List {
					if unary, ok := expr.(*ast.UnaryExpr); ok {
						if sel, ok := unary.X.(*ast.SelectorExpr); ok {
							if ident, ok := sel.X.(*ast.Ident); ok && ident.Name == "ctx" && sel.Sel.Name == "Done" {
								*hasContextDone = true
							}
						}
					}
				}
				for _, bodyStmt := range caseClause.Body {
					a.inspectLoopBody(bodyStmt, hasBreak, hasReturn, hasContextDone)
				}
			}
		}
	case *ast.IfStmt:
		for _, stmt := range s.Body.List {
			a.inspectLoopBody(stmt, hasBreak, hasReturn, hasContextDone)
		}
	}
}

func (a *Analyzer) hasGoroutineRecovery(content string) bool {
	recoveryPatterns := []*regexp.Regexp{
		regexp.MustCompile(`defer.*recover\(\)`),
		regexp.MustCompile(`defer func\(\).*recover\(\)`),
	}

	for _, pattern := range recoveryPatterns {
		if pattern.MatchString(content) {
			return true
		}
	}
	return false
}

func (a *Analyzer) hasUnbufferedChannelSend(content string) bool {
	patterns := []*regexp.Regexp{
		regexp.MustCompile(`make\(chan\s+[\w\[\]]+\)`),
	}

	for _, pattern := range patterns {
		if pattern.MatchString(content) {
			return true
		}
	}
	return false
}

func (a *Analyzer) hasInfiniteLoop(content string) bool {
	if strings.Contains(content, "for {") {
		if !strings.Contains(content, "ctx.Done()") && !strings.Contains(content, "break") {
			return true
		}
	}
	return false
}

func (a *Analyzer) calculateScore(result *models.AnalysisResult) int {
	score := 100
	severityPenalty := map[string]int{
		"critical": 20,
		"high":     10,
		"warning":  5,
		"low":      2,
	}

	for _, issue := range result.Issues {
		if penalty, ok := severityPenalty[issue.Severity]; ok {
			score -= penalty
		}
	}

	if score < 0 {
		score = 0
	}

	return score
}

func (a *Analyzer) generateRecommendations(result *models.AnalysisResult) {
	recommendations := []models.Recommendation{}

	if len(result.GoroutineTopology.Cycles) > 0 {
		recommendations = append(recommendations, models.Recommendation{
			Priority:    "critical",
			Category:    "topology",
			Description: "修复循环依赖",
			Impact:      "防止死锁和资源竞争",
		})
	}

	for _, issue := range result.Issues {
		if issue.Severity == "critical" {
			recommendations = append(recommendations, models.Recommendation{
				Priority:    "critical",
				Category:    issue.Category,
				Description: issue.Description,
				Impact:      issue.Suggestion,
			})
		}
	}

	if !result.TimeoutAnalysis.HasCancelPropagate {
		recommendations = append(recommendations, models.Recommendation{
			Priority:    "high",
			Category:    "timeout",
			Description: "启用 context 取消传播",
			Impact:      "确保超时和取消信号能正确传递到所有 goroutine",
		})
	}

	if !result.ShutdownAnalysis.Graceful {
		recommendations = append(recommendations, models.Recommendation{
			Priority:    "high",
			Category:    "shutdown",
			Description: "实现优雅关闭",
			Impact:      "防止正在处理的任务丢失",
		})
	}

	if result.BackpressureAnalysis.HasBackpressure {
		recommendations = append(recommendations, models.Recommendation{
			Priority:    "high",
			Category:    "backpressure",
			Description: "解决背压问题",
			Impact:      "增加消费者或优化队列配置",
		})
	}

	seen := make(map[string]bool)
	uniqueRecs := []models.Recommendation{}
	for _, rec := range recommendations {
		key := rec.Category + ":" + rec.Description
		if !seen[key] {
			seen[key] = true
			uniqueRecs = append(uniqueRecs, rec)
		}
	}

	sort.Slice(uniqueRecs, func(i, j int) bool {
		priorityOrder := map[string]int{"critical": 0, "high": 1, "medium": 2, "low": 3}
		return priorityOrder[uniqueRecs[i].Priority] < priorityOrder[uniqueRecs[j].Priority]
	})

	result.Recommendations = uniqueRecs
}

func AnalysisResultToJSON(result *models.AnalysisResult) (string, error) {
	data, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		return "", fmt.Errorf("failed to marshal analysis result: %w", err)
	}
	return string(data), nil
}
