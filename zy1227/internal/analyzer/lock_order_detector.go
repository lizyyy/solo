package analyzer

import (
	"fmt"
	"sort"

	"github.com/yourteam/sync-analyzer/internal/models"
)

// LockOrderDetector 检测锁顺序反转问题
type LockOrderDetector struct{}

// NewLockOrderDetector 创建一个新的锁顺序检测器
func NewLockOrderDetector() *LockOrderDetector {
	return &LockOrderDetector{}
}

// Name 返回检测器名称
func (d *LockOrderDetector) Name() string {
	return "LockOrderDetector"
}

// Detect 检测锁顺序反转问题
func (d *LockOrderDetector) Detect(cases []models.SyncCase, events []models.SyncEvent, snippets []*models.CodeSnippet) ([]models.Issue, error) {
	var issues []models.Issue

	// 从事件序列中检测锁顺序反转
	lockOrderIssues := d.detectFromEvents(events)
	issues = append(issues, lockOrderIssues...)

	// 从代码片段中检测潜在的锁顺序问题
	codeIssues := d.detectFromCode(snippets)
	issues = append(issues, codeIssues...)

	return issues, nil
}

// detectFromEvents 从事件序列中检测锁顺序反转
func (d *LockOrderDetector) detectFromEvents(events []models.SyncEvent) []models.Issue {
	var issues []models.Issue

	// 按 goroutine 分组事件
	goroutineEvents := make(map[int64][]models.SyncEvent)
	for _, event := range events {
		if event.PrimitiveType == models.SyncTypeMutex || event.PrimitiveType == models.SyncTypeRWMutex {
			goroutineEvents[event.GoroutineID] = append(goroutineEvents[event.GoroutineID], event)
		}
	}

	// 分析每个 goroutine 的锁获取顺序
	for goroutineID, events := range goroutineEvents {
		lockAcquisitions := d.trackLockAcquisitions(events)
		orderViolations := d.detectOrderViolations(lockAcquisitions)

		for _, violation := range orderViolations {
			issues = append(issues, issueTemplate(
				models.IssueLockOrderInversion,
				models.SeverityCritical,
				"Lock Order Inversion Detected",
				fmt.Sprintf("Goroutine %d acquired locks in inconsistent order: %s then %s, but previously acquired in reverse order",
					goroutineID, violation.lockA, violation.lockB),
				violation.location,
				violation.file,
				violation.line,
				"",
				"Always acquire locks in a consistent, global order. Consider using a lock hierarchy or documenting the required acquisition order.",
				"https://go.dev/blog/go-mutex",
			))
		}
	}

	return issues
}

// trackLockAcquisitions 跟踪锁获取顺序
func (d *LockOrderDetector) trackLockAcquisitions(events []models.SyncEvent) [][]string {
	var acquisitions [][]string
	currentLocks := make(map[string]bool)
	acquisitionOrder := []string{}

	for _, event := range events {
		switch event.EventType {
		case "Lock", "RLock":
			if !currentLocks[event.PrimitiveName] {
				currentLocks[event.PrimitiveName] = true
				acquisitionOrder = append(acquisitionOrder, event.PrimitiveName)
			}
		case "Unlock", "RUnlock":
			if currentLocks[event.PrimitiveName] {
				delete(currentLocks, event.PrimitiveName)
				// 当所有锁都释放时，记录这次获取序列
				if len(currentLocks) == 0 && len(acquisitionOrder) > 1 {
					// 保存一个副本
					seq := make([]string, len(acquisitionOrder))
					copy(seq, acquisitionOrder)
					acquisitions = append(acquisitions, seq)
				}
			}
		}
	}

	return acquisitions
}

// detectOrderViolations 检测顺序违反
func (d *LockOrderDetector) detectOrderViolations(acquisitions [][]string) []lockOrderViolation {
	var violations []lockOrderViolation

	if len(acquisitions) < 2 {
		return violations
	}

	// 建立基准顺序
	baseOrder := make(map[string]int)
	for i, lock := range acquisitions[0] {
		baseOrder[lock] = i
	}

	// 检查后续的获取序列
	for i := 1; i < len(acquisitions); i++ {
		seq := acquisitions[i]
		for j := 0; j < len(seq)-1; j++ {
			for k := j + 1; k < len(seq); k++ {
				lockA := seq[j]
				lockB := seq[k]

				// 检查在基准顺序中是否是相反的
				posA, hasA := baseOrder[lockA]
				posB, hasB := baseOrder[lockB]

				if hasA && hasB && posA > posB {
					violations = append(violations, lockOrderViolation{
						lockA:    lockA,
						lockB:    lockB,
						location: "",
						file:     "",
						line:     0,
					})
				}
			}
		}
	}

	return violations
}

// detectFromCode 从代码片段中检测潜在的锁顺序问题
func (d *LockOrderDetector) detectFromCode(snippets []*models.CodeSnippet) []models.Issue {
	var issues []models.Issue

	for _, snippet := range snippets {
		// 查找嵌套的锁获取
		lockOperations := d.extractLockOperations(snippet)
		nestedLocks := d.findNestedLocks(lockOperations)

		for _, nested := range nestedLocks {
			issues = append(issues, issueTemplate(
				models.IssueLockOrderInversion,
				models.SeverityHigh,
				"Potential Lock Order Inversion",
				fmt.Sprintf("Detected nested lock acquisition: %s acquired while holding %s. This can lead to deadlock if other goroutines acquire in reverse order.",
					nested.innerLock, nested.outerLock),
				snippet.FilePath,
				snippet.FilePath,
				nested.line,
				nested.codeSnippet,
				"Review lock acquisition order. If nested locks are necessary, ensure all goroutines acquire them in the same order.",
				"https://go.dev/ref/mem#lock",
			))
		}
	}

	return issues
}

// extractLockOperations 提取锁操作
func (d *LockOrderDetector) extractLockOperations(snippet *models.CodeSnippet) []lockOperation {
	var operations []lockOperation

	for _, op := range snippet.Operations {
		if op.Operation == "Lock" || op.Operation == "RLock" ||
			op.Operation == "Unlock" || op.Operation == "RUnlock" {
			operations = append(operations, lockOperation{
				name:      op.PrimitiveName,
				operation: op.Operation,
				line:      op.Location.Line,
			})
		}
	}

	// 按行号排序
	sort.Slice(operations, func(i, j int) bool {
		return operations[i].line < operations[j].line
	})

	return operations
}

// findNestedLocks 查找嵌套锁
func (d *LockOrderDetector) findNestedLocks(operations []lockOperation) []nestedLock {
	var nestedLocks []nestedLock
	heldLocks := make(map[string]int)

	for _, op := range operations {
		switch op.operation {
		case "Lock", "RLock":
			// 如果已经持有锁，这就是嵌套
			if len(heldLocks) > 0 {
				// 获取外层锁（第一个获取的）
				var outerLock string
				for lock := range heldLocks {
					outerLock = lock
					break
				}
				nestedLocks = append(nestedLocks, nestedLock{
					outerLock:   outerLock,
					innerLock:   op.name,
					line:        op.line,
					codeSnippet: "",
				})
			}
			heldLocks[op.name] = op.line
		case "Unlock", "RUnlock":
			delete(heldLocks, op.name)
		}
	}

	return nestedLocks
}

// lockOrderViolation 表示锁顺序违反
type lockOrderViolation struct {
	lockA    string
	lockB    string
	location string
	file     string
	line     int
}

// lockOperation 表示锁操作
type lockOperation struct {
	name      string
	operation string
	line      int
}

// nestedLock 表示嵌套锁
type nestedLock struct {
	outerLock   string
	innerLock   string
	line        int
	codeSnippet string
}
