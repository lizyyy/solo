package analyzer

import (
	"fmt"
	"time"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// ==================== RWMutexStarvationDetector ====================

// RWMutexStarvationDetector 检测读写锁饥饿问题
type RWMutexStarvationDetector struct{}

// NewRWMutexStarvationDetector 创建一个新的读写锁饥饿检测器
func NewRWMutexStarvationDetector() *RWMutexStarvationDetector {
	return &RWMutexStarvationDetector{}
}

// Name 返回检测器名称
func (d *RWMutexStarvationDetector) Name() string {
	return "RWMutexStarvationDetector"
}

// Detect 检测读写锁饥饿问题
func (d *RWMutexStarvationDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从事件中检测饥饿
	starvationIssues := d.detectFromEvents(events)
	issues = append(issues, starvationIssues...)

	// 从代码中检测潜在的饥饿问题
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromEvents 从事件中检测饥饿
func (d *RWMutexStarvationDetector) detectFromEvents(events []models.SyncEvent) []models.Issue {
	var issues []models.Issue

	// 按 RWMutex 分组
	rwMutexEvents := make(map[string][]models.SyncEvent)
	for _, event := range events {
		if event.PrimitiveType == models.SyncTypeRWMutex {
			rwMutexEvents[event.PrimitiveName] = append(rwMutexEvents[event.PrimitiveName], event)
		}
	}

	for mutexName, events := range rwMutexEvents {
		// 统计读写锁操作
		readCount := 0
		writeCount := 0
		var writeWaitTimes []time.Duration

		writePending := false
		var writeStartTime time.Time

		for _, event := range events {
			switch event.EventType {
			case "RLock":
				readCount++
				// 如果有写锁等待，检查是否导致写饥饿
				if writePending {
					waitTime := time.Since(writeStartTime)
					if waitTime > 5*time.Second {
						issues = append(issues, issueTemplate(
							models.IssueRWMutexStarvation,
							models.SeverityHigh,
							"Potential Writer Starvation",
							fmt.Sprintf("RWMutex %s: Writer has been waiting for %v while readers continue to acquire the lock. This may indicate writer starvation.",
								mutexName, waitTime),
							event.Location,
							event.File,
							event.Line,
							"",
							"Consider using sync.Mutex if write performance is critical, or implement a fair locking strategy. Go 1.19+ has improved RWMutex fairness.",
							"https://go.dev/src/sync/rwmutex.go",
						))
					}
				}
			case "Lock":
				writeCount++
				writePending = true
				writeStartTime = event.Timestamp
			case "Unlock":
				if writePending {
					writePending = false
					writeWaitTimes = append(writeWaitTimes, time.Since(writeStartTime))
				}
			case "RUnlock":
				// 读锁释放
			}
		}

		// 检查读写比例
		if readCount > 0 && writeCount > 0 {
			ratio := float64(readCount) / float64(writeCount)
			if ratio > 100 {
				issues = append(issues, issueTemplate(
					models.IssueRWMutexStarvation,
					models.SeverityMedium,
					"High Read-Write Ratio",
					fmt.Sprintf("RWMutex %s has %d reads and %d writes (ratio %.1f:1). A very high read ratio may indicate RWMutex is not providing benefit, or could lead to write contention issues.",
						mutexName, readCount, writeCount, ratio),
					"",
					"",
					0,
					"",
					"Review if RWMutex is the right choice. For very high read ratios, consider other synchronization patterns like atomic operations or copy-on-write.",
					"https://go.dev/blog/go-mutex",
				))
			}
		}
	}

	return issues
}

// detectFromCode 从代码中检测潜在问题
func (d *RWMutexStarvationDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		// 查找是否有 RWMutex 但只有读操作
		hasRWMutex := false
		hasWrite := false

		for _, p := range snippet.Primitives {
			if p.Type == models.SyncTypeRWMutex {
				hasRWMutex = true
			}
		}

		for _, op := range snippet.Operations {
			if op.Operation == "Lock" || op.Operation == "Unlock" {
				hasWrite = true
			}
		}

		if hasRWMutex && !hasWrite {
			issues = append(issues, issueTemplate(
				models.IssueRWMutexStarvation,
				models.SeverityLow,
				"RWMutex Used Without Writes",
				"RWMutex is declared but no write operations (Lock/Unlock) were found. Consider using sync.Mutex or removing the lock entirely if synchronization is not needed.",
				snippet.FilePath,
				snippet.FilePath,
				0,
				"",
				"If only read operations are needed, consider whether synchronization is necessary at all, or use a simpler synchronization primitive.",
				"",
			))
		}
	}

	return issues
}

// ==================== WaitGroupCountDetector ====================

// WaitGroupCountDetector 检测 WaitGroup 计数错误
type WaitGroupCountDetector struct{}

// NewWaitGroupCountDetector 创建一个新的 WaitGroup 计数检测器
func NewWaitGroupCountDetector() *WaitGroupCountDetector {
	return &WaitGroupCountDetector{}
}

// Name 返回检测器名称
func (d *WaitGroupCountDetector) Name() string {
	return "WaitGroupCountDetector"
}

// Detect 检测 WaitGroup 计数错误
func (d *WaitGroupCountDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从事件中检测
	eventIssues := d.detectFromEvents(events)
	issues = append(issues, eventIssues...)

	// 从代码中检测
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromEvents 从事件中检测
func (d *WaitGroupCountDetector) detectFromEvents(events []models.SyncEvent) []models.Issue {
	var issues []models.Issue

	// 按 WaitGroup 分组
	wgEvents := make(map[string][]models.SyncEvent)
	for _, event := range events {
		if event.PrimitiveType == models.SyncTypeWaitGroup {
			wgEvents[event.PrimitiveName] = append(wgEvents[event.PrimitiveName], event)
		}
	}

	for wgName, events := range wgEvents {
		addCount := 0
		doneCount := 0
		waitCalled := false

		for _, event := range events {
			switch event.EventType {
			case "Add":
				addCount++
			case "Done":
				doneCount++
			case "Wait":
				waitCalled = true
			}
		}

		// 检查是否有 Wait 但没有 Add
		if waitCalled && addCount == 0 {
			issues = append(issues, issueTemplate(
				models.IssueWaitGroupCountError,
				models.SeverityCritical,
				"WaitGroup Wait Called Without Add",
				fmt.Sprintf("WaitGroup %s: Wait() was called but Add() was never called. This will cause Wait() to return immediately without waiting.",
					wgName),
				"",
				"",
				0,
				"",
				"Always call Add() before starting goroutines that will call Done(). Add() should be called from the main goroutine before Wait().",
				"https://go.dev/pkg/sync/#WaitGroup",
			))
		}

		// 检查 Done 次数是否超过 Add
		if doneCount > addCount {
			issues = append(issues, issueTemplate(
				models.IssueWaitGroupCountError,
				models.SeverityCritical,
				"WaitGroup Done Called More Than Add",
				fmt.Sprintf("WaitGroup %s: Done() called %d times but Add() only called %d times. This will cause a panic.",
					wgName, doneCount, addCount),
				"",
				"",
				0,
				"",
				"Ensure each Add() call has a corresponding Done() call. Use defer wg.Done() after wg.Add(1) to ensure proper cleanup.",
				"https://go.dev/pkg/sync/#WaitGroup",
			))
		}
	}

	return issues
}

// detectFromCode 从代码中检测
func (d *WaitGroupCountDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		for _, op := range snippet.Operations {
			// 检查是否在 goroutine 内部调用 Add
			if op.Operation == "Add" {
				// 这是一个启发式检查 - 我们需要更多上下文
				// 这里我们标记可能的问题位置
				issues = append(issues, issueTemplate(
					models.IssueWaitGroupCountError,
					models.SeverityMedium,
					"Potential WaitGroup Add Misuse",
					fmt.Sprintf("WaitGroup Add() called at %s:%d. Ensure Add() is called BEFORE starting the goroutine, not inside it.",
						op.Location.File, op.Location.Line),
					fmt.Sprintf("%s:%d", op.Location.File, op.Location.Line),
					op.Location.File,
					op.Location.Line,
					"",
					"The correct pattern is: wg.Add(1); go func() { defer wg.Done(); ... }(). Calling Add() inside the goroutine can cause Wait() to return before the goroutine starts.",
					"https://go.dev/pkg/sync/#WaitGroup",
				))
			}
		}
	}

	return issues
}

// ==================== OnceInitDetector ====================

// OnceInitDetector 检测 Once 初始化失败缓存问题
type OnceInitDetector struct{}

// NewOnceInitDetector 创建一个新的 Once 初始化检测器
func NewOnceInitDetector() *OnceInitDetector {
	return &OnceInitDetector{}
}

// Name 返回检测器名称
func (d *OnceInitDetector) Name() string {
	return "OnceInitDetector"
}

// Detect 检测 Once 初始化问题
func (d *OnceInitDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从代码中检测
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromCode 从代码中检测
func (d *OnceInitDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		for _, p := range snippet.Primitives {
			if p.Type == models.SyncTypeOnce {
				// 检查 Once 的使用方式
				// 这是一个启发式检查 - 查找可能的失败缓存问题
				issues = append(issues, issueTemplate(
					models.IssueOnceInitFailedCache,
					models.SeverityMedium,
					"Potential sync.Once Initialization Issue",
					fmt.Sprintf("sync.Once %s detected. Ensure that if the initialization function can fail, you handle retries appropriately. sync.Once only runs the function once, even if it fails.",
						p.Name),
					p.Location.File,
					p.Location.File,
					p.Location.Line,
					"",
					"If initialization can fail, consider using sync.Once with a retry mechanism, or use a different pattern like sync.Mutex with a boolean flag that allows retries.",
					"https://go.dev/pkg/sync/#Once",
				))
			}
		}
	}

	return issues
}

// ==================== CondWakeupDetector ====================

// CondWakeupDetector 检测 Cond 唤醒遗漏问题
type CondWakeupDetector struct{}

// NewCondWakeupDetector 创建一个新的 Cond 唤醒检测器
func NewCondWakeupDetector() *CondWakeupDetector {
	return &CondWakeupDetector{}
}

// Name 返回检测器名称
func (d *CondWakeupDetector) Name() string {
	return "CondWakeupDetector"
}

// Detect 检测 Cond 唤醒遗漏问题
func (d *CondWakeupDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从事件中检测
	eventIssues := d.detectFromEvents(events)
	issues = append(issues, eventIssues...)

	// 从代码中检测
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromEvents 从事件中检测
func (d *CondWakeupDetector) detectFromEvents(events []models.SyncEvent) []models.Issue {
	var issues []models.Issue

	// 按 Cond 分组
	condEvents := make(map[string][]models.SyncEvent)
	for _, event := range events {
		if event.PrimitiveType == models.SyncTypeCond {
			condEvents[event.PrimitiveName] = append(condEvents[event.PrimitiveName], event)
		}
	}

	for condName, events := range condEvents {
		waitCount := 0
		signalCount := 0
		broadcastCount := 0

		for _, event := range events {
			switch event.EventType {
			case "Wait":
				waitCount++
			case "Signal":
				signalCount++
			case "Broadcast":
				broadcastCount++
			}
		}

		// 检查是否有 Wait 但没有唤醒
		if waitCount > 0 && signalCount == 0 && broadcastCount == 0 {
			issues = append(issues, issueTemplate(
				models.IssueCondWakeupMiss,
				models.SeverityCritical,
				"Cond Wait Without Wakeup",
				fmt.Sprintf("Cond %s: Wait() called %d times but no Signal() or Broadcast() calls detected. Waiting goroutines may block forever.",
					condName, waitCount),
				"",
				"",
				0,
				"",
				"Ensure that every Wait() has a corresponding Signal() or Broadcast() call. Signal() wakes one goroutine, Broadcast() wakes all waiting goroutines.",
				"https://go.dev/pkg/sync/#Cond",
			))
		}
	}

	return issues
}

// detectFromCode 从代码中检测
func (d *CondWakeupDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		for _, op := range snippet.Operations {
			// 检查是否使用了 Signal 而不是 Broadcast
			if op.Operation == "Signal" {
				issues = append(issues, issueTemplate(
					models.IssueCondWakeupMiss,
					models.SeverityLow,
					"Cond.Signal() Usage",
					fmt.Sprintf("Cond.Signal() called at %s:%d. Signal() only wakes one waiting goroutine. If multiple goroutines may be waiting, consider using Broadcast() or ensure the condition is rechecked in a loop.",
						op.Location.File, op.Location.Line),
					fmt.Sprintf("%s:%d", op.Location.File, op.Location.Line),
					op.Location.File,
					op.Location.Line,
					"",
					"The correct pattern for Cond.Wait() is: for !condition { cond.Wait() }. Always wrap Wait() in a loop that rechecks the condition, as spurious wakeups can occur.",
					"https://go.dev/pkg/sync/#Cond",
				))
			}
		}
	}

	return issues
}

// ==================== PoolMisuseDetector ====================

// PoolMisuseDetector 检测 Pool 误用问题
type PoolMisuseDetector struct{}

// NewPoolMisuseDetector 创建一个新的 Pool 误用检测器
func NewPoolMisuseDetector() *PoolMisuseDetector {
	return &PoolMisuseDetector{}
}

// Name 返回检测器名称
func (d *PoolMisuseDetector) Name() string {
	return "PoolMisuseDetector"
}

// Detect 检测 Pool 误用问题
func (d *PoolMisuseDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从代码中检测
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromCode 从代码中检测
func (d *PoolMisuseDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		for _, p := range snippet.Primitives {
			if p.Type == models.SyncTypePool {
				issues = append(issues, issueTemplate(
					models.IssuePoolMisuse,
					models.SeverityMedium,
					"sync.Pool Usage Review",
					fmt.Sprintf("sync.Pool %s detected. Remember that sync.Pool is for temporary objects and items can be evicted at any time. Do not store long-lived or important data in Pool.",
						p.Name),
					p.Location.File,
					p.Location.File,
					p.Location.Line,
					"",
					"sync.Pool is designed for: 1) Reducing GC pressure for frequently allocated objects, 2) Reusing objects that are expensive to create. Objects in Pool may be removed without notice.",
					"https://go.dev/pkg/sync/#Pool",
				))
			}
		}

		// 检查是否在 Get 之前使用了 Put 而没有重置
		for _, op := range snippet.Operations {
			if op.Operation == "Put" {
				issues = append(issues, issueTemplate(
					models.IssuePoolMisuse,
					models.SeverityLow,
					"Pool.Put() Usage",
					fmt.Sprintf("Pool.Put() called at %s:%d. Ensure the object is properly reset before putting it back into the pool. Pool.Get() may return objects in any state.",
						op.Location.File, op.Location.Line),
					fmt.Sprintf("%s:%d", op.Location.File, op.Location.Line),
					op.Location.File,
					op.Location.Line,
					"",
					"Always reset objects obtained from Pool.Get() before using them. The Pool does not clean or reset objects for you.",
					"https://go.dev/pkg/sync/#Pool",
				))
			}
		}
	}

	return issues
}

// ==================== RaceConditionDetector ====================

// RaceConditionDetector 检测竞争条件
type RaceConditionDetector struct{}

// NewRaceConditionDetector 创建一个新的竞争条件检测器
func NewRaceConditionDetector() *RaceConditionDetector {
	return &RaceConditionDetector{}
}

// Name 返回检测器名称
func (d *RaceConditionDetector) Name() string {
	return "RaceConditionDetector"
}

// Detect 检测竞争条件
func (d *RaceConditionDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从事件中检测
	eventIssues := d.detectFromEvents(events)
	issues = append(issues, eventIssues...)

	// 从代码中检测
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromEvents 从事件中检测
func (d *RaceConditionDetector) detectFromEvents(events []models.SyncEvent) []models.Issue {
	var issues []models.Issue

	// 检查是否有未同步的并发访问
	// 这是一个启发式检查

	// 按原语分组，检查并发访问模式
	for _, event := range events {
		// 检查是否有潜在的竞争条件迹象
		// 例如：同一时间多个 goroutine 访问非线程安全的数据
	}

	return issues
}

// detectFromCode 从代码中检测
func (d *RaceConditionDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		// 启发式检查：查找可能的竞争条件
		// 注意：这不是一个完整的竞争条件检测器，只是提示潜在问题

		// 检查是否有 goroutine 但没有同步
		hasGoroutine := false
		hasSync := false

		for _, p := range snippet.Primitives {
			if p.Type == models.SyncTypeMutex || p.Type == models.SyncTypeRWMutex ||
				p.Type == models.SyncTypeWaitGroup || p.Type == models.SyncTypeOnce ||
				p.Type == models.SyncTypeCond || p.Type == models.SyncTypePool {
				hasSync = true
			}
		}

		// 检查是否有 goroutine（通过 go 关键字 - 我们的解析器不直接检测这个）
		// 所以我们只提供一般性建议

		if len(snippet.Operations) > 0 && !hasSync {
			issues = append(issues, issueTemplate(
				models.IssueRaceCondition,
				models.SeverityLow,
				"Potential Race Condition",
				fmt.Sprintf("File %s contains sync operations but no sync primitives declared. If these operations are called from multiple goroutines, race conditions may occur.",
					snippet.FilePath),
				snippet.FilePath,
				snippet.FilePath,
				0,
				"",
				"Use Go's race detector to find race conditions: go run -race or go test -race. Always synchronize access to shared data from multiple goroutines.",
				"https://go.dev/blog/race-detector",
			))
		}
	}

	return issues
}
