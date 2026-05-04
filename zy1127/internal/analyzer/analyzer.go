package analyzer

import (
	"fmt"
	"sort"
	"strings"
	"sync"
	"time"

	"concurrency-detector/internal/models"
)

type Analyzer struct {
	rules []Rule
}

type Rule interface {
	Name() string
	Category() models.RiskCategory
	Severity() models.RiskSeverity
	Check(ctx *AnalysisContext) (*RuleResult, error)
}

type AnalysisContext struct {
	MapEvents           []*models.MapEvent
	GoroutineSnapshots  []*models.GoroutineSnapshot
	WorkerQueues        []*models.WorkerQueue
}

type RuleResult struct {
	Title       string
	Description string
	Evidence    []string
	Suggestions []string
	Confidence  float64
}

type ConcurrentMapRule struct{}

func (r *ConcurrentMapRule) Name() string {
	return "concurrent_map_access"
}

func (r *ConcurrentMapRule) Category() models.RiskCategory {
	return models.RiskCategoryConcurrentMap
}

func (r *ConcurrentMapRule) Severity() models.RiskSeverity {
	return models.RiskSeverityCritical
}

func (r *ConcurrentMapRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.MapEvents) < 2 {
		return nil, nil
	}

	type mapAccess struct {
		events []*models.MapEvent
	}

	mapAccesses := make(map[string]*mapAccess)
	for _, e := range ctx.MapEvents {
		key := fmt.Sprintf("%s:%s", e.MapName, e.Key)
		if mapAccesses[key] == nil {
			mapAccesses[key] = &mapAccess{}
		}
		mapAccesses[key].events = append(mapAccesses[key].events, e)
	}

	var evidence []string
	var riskyCount int

	for key, access := range mapAccesses {
		if len(access.events) < 2 {
			continue
		}

		sort.Slice(access.events, func(i, j int) bool {
			return access.events[i].Timestamp.Before(access.events[j].Timestamp)
		})

		for i := 1; i < len(access.events); i++ {
			prev := access.events[i-1]
			curr := access.events[i]

			if prev.GoroutineID == curr.GoroutineID {
				continue
			}

			timeDiff := curr.Timestamp.Sub(prev.Timestamp)
			if timeDiff < 100*time.Millisecond {
				hasUnlocked := !prev.HasLock || !curr.HasLock
				hasWrite := prev.Operation == models.MapOperationTypeWrite || curr.Operation == models.MapOperationTypeWrite

				if hasUnlocked && hasWrite {
					riskyCount++
					evidence = append(evidence, fmt.Sprintf(
						"[%s] Map %s, Key %s: goroutine %d (%s) and %d (%s) accessed within %v, one write and at least one without lock",
						prev.Timestamp.Format(time.RFC3339Nano),
						key,
						curr.Key,
						prev.GoroutineID, prev.Operation,
						curr.GoroutineID, curr.Operation,
						timeDiff,
					))
				}
			}
		}
	}

	if riskyCount == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "并发 map 未加锁读写",
		Description: fmt.Sprintf("检测到 %d 处潜在的并发 map 访问风险，涉及未加锁的写操作或读写同时发生。Go 运行时会在检测到并发 map 写时直接 panic。", riskyCount),
		Evidence:    evidence,
		Suggestions: []string{
			"使用 sync.RWMutex 或 sync.Mutex 保护 map 访问",
			"考虑使用 sync.Map 替代普通 map（适用于读多写少场景）",
			"如果是频繁写的热点 key，考虑分桶策略（sharding）",
			"使用 -race 标志运行测试检测数据竞争",
		},
		Confidence: 0.9,
	}, nil
}

type HotKeyWriteRule struct{}

func (r *HotKeyWriteRule) Name() string {
	return "hot_key_write"
}

func (r *HotKeyWriteRule) Category() models.RiskCategory {
	return models.RiskCategoryHotKeyWrite
}

func (r *HotKeyWriteRule) Severity() models.RiskSeverity {
	return models.RiskSeverityHigh
}

func (r *HotKeyWriteRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.MapEvents) < 10 {
		return nil, nil
	}

	keyWriteCount := make(map[string]int)
	var totalWrites int

	for _, e := range ctx.MapEvents {
		if e.Operation == models.MapOperationTypeWrite {
			key := fmt.Sprintf("%s:%s", e.MapName, e.Key)
			keyWriteCount[key]++
			totalWrites++
		}
	}

	if totalWrites < 10 {
		return nil, nil
	}

	var hotKeys []string
	var evidence []string
	threshold := totalWrites / 10

	for key, count := range keyWriteCount {
		if count >= threshold {
			percentage := float64(count) / float64(totalWrites) * 100
			hotKeys = append(hotKeys, fmt.Sprintf("%s: %d writes (%.1f%%)", key, count, percentage))
			evidence = append(evidence, fmt.Sprintf(
				"Hot key %s: %d writes out of %d total (%.1f%%)",
				key, count, totalWrites, percentage,
			))
		}
	}

	if len(hotKeys) == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "热点 Key 频繁写入",
		Description: fmt.Sprintf("检测到 %d 个热点 key 占用了超过 10%% 的写入流量。热点 key 会导致锁竞争加剧，影响系统整体吞吐。", len(hotKeys)),
		Evidence:    evidence,
		Suggestions: []string{
			"考虑热点 key 拆分策略（如加上时间前缀/后缀）",
			"如果是计数器场景，考虑使用 atomic 操作替代 map",
			"实现分桶锁（sharded lock）减少锁粒度",
			"评估是否可以用缓存层（如 local cache + TTL）减少写操作",
		},
		Confidence: 0.85,
	}, nil
}

type CoarseLockRule struct{}

func (r *CoarseLockRule) Name() string {
	return "coarse_lock"
}

func (r *CoarseLockRule) Category() models.RiskCategory {
	return models.RiskCategoryCoarseLock
}

func (r *CoarseLockRule) Severity() models.RiskSeverity {
	return models.RiskSeverityMedium
}

func (r *CoarseLockRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.MapEvents) < 5 {
		return nil, nil
	}

	mapLockPatterns := make(map[string]struct {
		lockCount    int
		readCount    int
		writeCount   int
		differentKeys map[string]bool
	})

	for _, e := range ctx.MapEvents {
		pattern := mapLockPatterns[e.MapName]
		if pattern.differentKeys == nil {
			pattern.differentKeys = make(map[string]bool)
		}

		if e.HasLock {
			pattern.lockCount++
		}
		if e.Operation == models.MapOperationTypeRead {
			pattern.readCount++
		} else {
			pattern.writeCount++
		}
		pattern.differentKeys[e.Key] = true
		mapLockPatterns[e.MapName] = pattern
	}

	var evidence []string
	var riskyMaps int

	for mapName, pattern := range mapLockPatterns {
		lockRatio := float64(pattern.lockCount) / float64(pattern.readCount+pattern.writeCount)
		keyCount := len(pattern.differentKeys)

		if lockRatio > 0.9 && keyCount > 5 && pattern.writeCount > 0 {
			riskyMaps++
			evidence = append(evidence, fmt.Sprintf(
				"Map %s: 锁覆盖率 %.1f%%, 涉及 %d 个不同 key, 读 %d/写 %d - 可能锁粒度过粗",
				mapName, lockRatio*100, keyCount, pattern.readCount, pattern.writeCount,
			))
		}
	}

	if riskyMaps == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "锁粒度过粗",
		Description: fmt.Sprintf("检测到 %d 个 map 可能存在锁粒度过粗的问题。同一个锁保护多个 key 的读写会导致不必要的等待。", riskyMaps),
		Evidence:    evidence,
		Suggestions: []string{
			"考虑使用 sync.RWMutex（读多写少场景）",
			"实现分桶锁（sharding）：每个桶独立锁",
			"评估是否可以用 sync.Map 替代",
			"检查 critical section 是否包含不必要的操作",
		},
		Confidence: 0.7,
	}, nil
}

type WorkerBacklogRule struct{}

func (r *WorkerBacklogRule) Name() string {
	return "worker_backlog"
}

func (r *WorkerBacklogRule) Category() models.RiskCategory {
	return models.RiskCategoryWorkerBacklog
}

func (r *WorkerBacklogRule) Severity() models.RiskSeverity {
	return models.RiskSeverityHigh
}

func (r *WorkerBacklogRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.WorkerQueues) == 0 {
		return nil, nil
	}

	var evidence []string
	var backlogCount int

	for _, w := range ctx.WorkerQueues {
		capacityRatio := float64(w.QueueLength) / float64(w.QueueCapacity)
		backlogRatio := float64(w.PendingTasks) / float64(w.QueueCapacity)

		if capacityRatio > 0.8 || backlogRatio > 0.5 {
			backlogCount++
			evidence = append(evidence, fmt.Sprintf(
				"Queue %s: 长度 %d/%d (%.0f%%), 待处理 %d, worker %d, 失败任务 %d",
				w.QueueName, w.QueueLength, w.QueueCapacity, capacityRatio*100,
				w.PendingTasks, w.WorkerCount, w.FailedTasks,
			))
		}

		if w.FailedTasks > 10 {
			evidence = append(evidence, fmt.Sprintf(
				"Queue %s: 检测到 %d 个失败任务，可能导致重试风暴",
				w.QueueName, w.FailedTasks,
			))
		}
	}

	if backlogCount == 0 && len(evidence) == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "Worker 队列积压",
		Description: fmt.Sprintf("检测到 %d 个队列存在积压风险。队列长期满负荷运行可能导致：上游阻塞、消息丢失、延迟飙升。", backlogCount),
		Evidence:    evidence,
		Suggestions: []string{
			"增加 worker 数量（考虑实际 CPU 核心数）",
			"检查任务处理耗时是否异常",
			"评估是否需要动态伸缩 worker",
			"实现背压机制（backpressure）",
			"检查是否有任务卡住导致 worker 无法释放",
		},
		Confidence: 0.9,
	}, nil
}

type GoroutineLeakRule struct{}

func (r *GoroutineLeakRule) Name() string {
	return "goroutine_leak"
}

func (r *GoroutineLeakRule) Category() models.RiskCategory {
	return models.RiskCategoryGoroutineLeak
}

func (r *GoroutineLeakRule) Severity() models.RiskSeverity {
	return models.RiskSeverityCritical
}

func (r *GoroutineLeakRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.GoroutineSnapshots) == 0 {
		return nil, nil
	}

	snapshotGroups := make(map[string][]*models.GoroutineSnapshot)
	for _, s := range ctx.GoroutineSnapshots {
		snapshotGroups[s.SnapshotID] = append(snapshotGroups[s.SnapshotID], s)
	}

	var evidence []string
	var blockedCount int

	for snapID, snapshots := range snapshotGroups {
		for _, s := range snapshots {
			if strings.Contains(s.State, "blocked") ||
				strings.Contains(s.State, "waiting") ||
				strings.Contains(s.State, "IO wait") {

				blockedReason := s.BlockedReason
				if blockedReason == "" {
					if strings.Contains(s.Stack, "chan send") {
						blockedReason = "channel send"
					} else if strings.Contains(s.Stack, "chan receive") {
						blockedReason = "channel receive"
					} else if strings.Contains(s.Stack, "Lock") || strings.Contains(s.Stack, "Mutex") {
						blockedReason = "mutex contention"
					} else if strings.Contains(s.Stack, "WaitGroup") {
						blockedReason = "WaitGroup wait"
					} else {
						blockedReason = "unknown"
					}
				}

				blockedCount++
				stackPreview := s.Stack
				if len(stackPreview) > 200 {
					stackPreview = stackPreview[:200] + "..."
				}

				evidence = append(evidence, fmt.Sprintf(
					"[Snapshot %s] Goroutine %d in state '%s', blocked reason: %s\nStack preview: %s",
					snapID, s.GoroutineID, s.State, blockedReason, stackPreview,
				))
			}

			if strings.Contains(s.Stack, "time.Sleep") &&
				!strings.Contains(s.Stack, "context") &&
				!strings.Contains(s.Stack, "select") {
				evidence = append(evidence, fmt.Sprintf(
					"Goroutine %d 使用 time.Sleep 而没有 context/select 包装，可能无法被优雅取消",
					s.GoroutineID,
				))
			}
		}
	}

	if blockedCount == 0 && len(evidence) == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "Goroutine 泄漏/卡住",
		Description: fmt.Sprintf("检测到 %d 个 goroutine 处于阻塞或等待状态。长期阻塞的 goroutine 是泄漏的前兆，会导致内存持续增长。", blockedCount),
		Evidence:    evidence,
		Suggestions: []string{
			"检查所有启动 goroutine 的地方是否有对应的退出机制",
			"使用 context.Context 控制 goroutine 生命周期",
			"channel 操作应该配合 select + timeout 使用",
			"使用 pprof 的 goroutine profile 分析堆栈",
			"检查是否有循环引用导致的 deadlock",
		},
		Confidence: 0.85,
	}, nil
}

type ContextMissingRule struct{}

func (r *ContextMissingRule) Name() string {
	return "context_missing"
}

func (r *ContextMissingRule) Category() models.RiskCategory {
	return models.RiskCategoryContextMissing
}

func (r *ContextMissingRule) Severity() models.RiskSeverity {
	return models.RiskSeverityMedium
}

func (r *ContextMissingRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.GoroutineSnapshots) == 0 {
		return nil, nil
	}

	var evidence []string
	var riskyPatterns int

	for _, s := range ctx.GoroutineSnapshots {
		stack := s.Stack

		hasHTTP := strings.Contains(stack, "net/http")
		hasGRPC := strings.Contains(stack, "google.golang.org/grpc")
		hasDBCall := strings.Contains(stack, "database/sql") || strings.Contains(stack, "gorm") || strings.Contains(stack, "sqlx")
		hasHTTPCall := strings.Contains(stack, "http.Client") || strings.Contains(stack, "net/http.(*Client)")

		hasContext := strings.Contains(stack, "context.Context") ||
			strings.Contains(stack, "context.With") ||
			strings.Contains(stack, "ctx context")

		if (hasHTTP || hasGRPC || hasDBCall || hasHTTPCall) && !hasContext {
			riskyPatterns++
			stackPreview := stack
			if len(stackPreview) > 300 {
				stackPreview = stackPreview[:300] + "..."
			}

			pattern := ""
			if hasHTTP {
				pattern = "HTTP handler"
			} else if hasGRPC {
				pattern = "gRPC handler"
			} else if hasDBCall {
				pattern = "database call"
			} else if hasHTTPCall {
				pattern = "HTTP client call"
			}

			evidence = append(evidence, fmt.Sprintf(
				"Goroutine %d: %s 操作中未检测到 context 使用\nStack: %s",
				s.GoroutineID, pattern, stackPreview,
			))
		}
	}

	if riskyPatterns == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "Context 未传递",
		Description: fmt.Sprintf("检测到 %d 处可能缺少 context 传递的操作。在 I/O 操作中不传递 context 会导致：请求取消后资源仍在占用、超时无法生效、链路追踪断裂。", riskyPatterns),
		Evidence:    evidence,
		Suggestions: []string{
			"确保 context 从入口（HTTP/gRPC handler）一直传递到下游",
			"数据库操作应该使用 WithContext 版本的方法",
			"HTTP 客户端应该使用 Request.WithContext",
			"gRPC 方法的第一个参数应该是 ctx",
			"使用 context.WithTimeout/WithCancel 控制 I/O 超时",
		},
		Confidence: 0.6,
	}, nil
}

type ChannelBlockedRule struct{}

func (r *ChannelBlockedRule) Name() string {
	return "channel_blocked"
}

func (r *ChannelBlockedRule) Category() models.RiskCategory {
	return models.RiskCategoryChannelBlocked
}

func (r *ChannelBlockedRule) Severity() models.RiskSeverity {
	return models.RiskSeverityHigh
}

func (r *ChannelBlockedRule) Check(ctx *AnalysisContext) (*RuleResult, error) {
	if len(ctx.GoroutineSnapshots) == 0 {
		return nil, nil
	}

	var evidence []string
	var blockedCount int

	for _, s := range ctx.GoroutineSnapshots {
		stack := s.Stack
		state := s.State

		if (strings.Contains(state, "blocked") || strings.Contains(state, "waiting")) &&
			(strings.Contains(stack, "chan send") || strings.Contains(stack, "chan receive")) {

			blockedCount++
			isSend := strings.Contains(stack, "chan send")
			stackPreview := stack
			if len(stackPreview) > 250 {
				stackPreview = stackPreview[:250] + "..."
			}

			evidence = append(evidence, fmt.Sprintf(
				"Goroutine %d blocked on channel %s\nState: %s\nStack: %s",
				s.GoroutineID,
				map[bool]string{true: "send", false: "receive"}[isSend],
				state,
				stackPreview,
			))
		}
	}

	if blockedCount == 0 {
		return nil, nil
	}

	return &RuleResult{
		Title:       "Channel 阻塞",
		Description: fmt.Sprintf("检测到 %d 个 goroutine 在 channel 操作上阻塞。无缓冲 channel 或满缓冲 channel 会导致发送方/接收方永久阻塞，是死锁的常见原因。", blockedCount),
		Evidence:    evidence,
		Suggestions: []string{
			"检查 channel 是否有对应的接收方/发送方",
			"使用带缓冲的 channel 配合 select+default 非阻塞模式",
			"所有 channel 操作应该配合 select + timeout",
			"检查是否有 goroutine 意外退出导致 channel 另一端永久等待",
			"使用 context 来可以取消阻塞的 channel 操作",
		},
		Confidence: 0.9,
	}, nil
}

func NewAnalyzer() *Analyzer {
	return &Analyzer{
		rules: []Rule{
			&ConcurrentMapRule{},
			&HotKeyWriteRule{},
			&CoarseLockRule{},
			&WorkerBacklogRule{},
			&GoroutineLeakRule{},
			&ContextMissingRule{},
			&ChannelBlockedRule{},
		},
	}
}

type AnalysisResult struct {
	RuleName  string
	Category  models.RiskCategory
	Severity  models.RiskSeverity
	Result    *RuleResult
	Error     error
}

func (a *Analyzer) Analyze(ctx *AnalysisContext) ([]*models.AnalysisResult, error) {
	var wg sync.WaitGroup
	results := make(chan *AnalysisResult, len(a.rules))

	for _, rule := range a.rules {
		wg.Add(1)
		go func(r Rule) {
			defer wg.Done()

			result, err := r.Check(ctx)
			results <- &AnalysisResult{
				RuleName: r.Name(),
				Category: r.Category(),
				Severity: r.Severity(),
				Result:   result,
				Error:    err,
			}
		}(rule)
	}

	go func() {
		wg.Wait()
		close(results)
	}()

	var modelResults []*models.AnalysisResult
	now := time.Now()

	for ar := range results {
		if ar.Error != nil {
			continue
		}
		if ar.Result == nil {
			continue
		}

		mr := &models.AnalysisResult{
			ID:            generateID(),
			Category:      ar.Category,
			Severity:      ar.Severity,
			Title:         ar.Result.Title,
			Description:   ar.Result.Description,
			EvidenceCount: len(ar.Result.Evidence),
			Evidence:      ar.Result.Evidence,
			Suggestions:   ar.Result.Suggestions,
			CreatedAt:     now,
		}
		_ = mr.SetEvidence(mr.Evidence)
		_ = mr.SetSuggestions(mr.Suggestions)

		modelResults = append(modelResults, mr)
	}

	sort.Slice(modelResults, func(i, j int) bool {
		severityOrder := map[models.RiskSeverity]int{
			models.RiskSeverityCritical: 0,
			models.RiskSeverityHigh:     1,
			models.RiskSeverityMedium:   2,
			models.RiskSeverityLow:      3,
		}
		return severityOrder[modelResults[i].Severity] < severityOrder[modelResults[j].Severity]
	})

	return modelResults, nil
}

func generateID() string {
	return fmt.Sprintf("res_%d", time.Now().UnixNano())
}
