package analyzer

import (
	"testing"

	"github.com/yourteam/sync-analyzer/internal/models"
)

func TestSyncAnalyzer_Analyze(t *testing.T) {
	// 创建测试案例
	cases := []models.SyncCase{
		{
			Name:        "test_case_1",
			Description: "Test case for analyzer",
			Primitives: []models.PrimitiveConfig{
				{
					Type:     models.SyncTypeMutex,
					Name:     "mu1",
					Location: "main.go:10",
				},
				{
					Type:     models.SyncTypeMutex,
					Name:     "mu2",
					Location: "main.go:11",
				},
			},
		},
	}

	// 创建测试事件（展示锁顺序反转）
	events := []models.SyncEvent{
		// Goroutine 1: mu1 -> mu2
		{
			PrimitiveName: "mu1",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "mu2",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "mu2",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Unlock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "mu1",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Unlock",
			GoroutineID:   1,
		},
		// Goroutine 2: mu2 -> mu1 (不同顺序)
		{
			PrimitiveName: "mu2",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   2,
		},
		{
			PrimitiveName: "mu1",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   2,
		},
	}

	// 创建分析器
	analyzer := NewSyncAnalyzer()

	// 执行分析
	result, err := analyzer.Analyze(cases, events, nil)
	if err != nil {
		t.Fatalf("Failed to analyze: %v", err)
	}

	// 验证结果
	if result.Summary.TotalPrimitives != 2 {
		t.Errorf("Expected 2 primitives, got %d", result.Summary.TotalPrimitives)
	}
	if result.Summary.TotalEvents != 6 {
		t.Errorf("Expected 6 events, got %d", result.Summary.TotalEvents)
	}
}

func TestLockOrderDetector_Detect(t *testing.T) {
	detector := NewLockOrderDetector()

	// 测试1：有锁顺序反转的情况
	events := []models.SyncEvent{
		// Goroutine 1: muA -> muB
		{
			PrimitiveName: "muA",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "muB",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "muB",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Unlock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "muA",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Unlock",
			GoroutineID:   1,
		},
		// 第二次：muB -> muA (不同顺序)
		{
			PrimitiveName: "muB",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "muA",
			PrimitiveType: models.SyncTypeMutex,
			EventType:     "Lock",
			GoroutineID:   1,
		},
	}

	issues, err := detector.Detect(nil, events, nil)
	if err != nil {
		t.Fatalf("Failed to detect: %v", err)
	}

	// 应该检测到锁顺序反转
	t.Logf("Detected %d issues", len(issues))
	for i, issue := range issues {
		t.Logf("Issue %d: [%s] %s", i+1, issue.Severity, issue.Title)
	}
}

func TestWaitGroupCountDetector_Detect(t *testing.T) {
	detector := NewWaitGroupCountDetector()

	// 测试：Done 调用次数超过 Add
	events := []models.SyncEvent{
		{
			PrimitiveName: "wg",
			PrimitiveType: models.SyncTypeWaitGroup,
			EventType:     "Add",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "wg",
			PrimitiveType: models.SyncTypeWaitGroup,
			EventType:     "Done",
			GoroutineID:   2,
		},
		{
			PrimitiveName: "wg",
			PrimitiveType: models.SyncTypeWaitGroup,
			EventType:     "Done", // 多调用了一次
			GoroutineID:   2,
		},
	}

	issues, err := detector.Detect(nil, events, nil)
	if err != nil {
		t.Fatalf("Failed to detect: %v", err)
	}

	t.Logf("Detected %d issues", len(issues))
	for i, issue := range issues {
		t.Logf("Issue %d: [%s] %s - %s", i+1, issue.Severity, issue.Title, issue.Description)
	}
}

func TestCondWakeupDetector_Detect(t *testing.T) {
	detector := NewCondWakeupDetector()

	// 测试：Wait 但没有 Signal/Broadcast
	events := []models.SyncEvent{
		{
			PrimitiveName: "cond",
			PrimitiveType: models.SyncTypeCond,
			EventType:     "Wait",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "cond",
			PrimitiveType: models.SyncTypeCond,
			EventType:     "Wait",
			GoroutineID:   2,
		},
		// 没有 Signal 或 Broadcast
	}

	issues, err := detector.Detect(nil, events, nil)
	if err != nil {
		t.Fatalf("Failed to detect: %v", err)
	}

	t.Logf("Detected %d issues", len(issues))
	for i, issue := range issues {
		t.Logf("Issue %d: [%s] %s - %s", i+1, issue.Severity, issue.Title, issue.Description)
	}
}

func TestRWMutexStarvationDetector_Detect(t *testing.T) {
	detector := NewRWMutexStarvationDetector()

	// 测试：只有读锁，没有写锁
	events := []models.SyncEvent{
		{
			PrimitiveName: "rwmu",
			PrimitiveType: models.SyncTypeRWMutex,
			EventType:     "RLock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "rwmu",
			PrimitiveType: models.SyncTypeRWMutex,
			EventType:     "RLock",
			GoroutineID:   2,
		},
		{
			PrimitiveName: "rwmu",
			PrimitiveType: models.SyncTypeRWMutex,
			EventType:     "RUnlock",
			GoroutineID:   1,
		},
		{
			PrimitiveName: "rwmu",
			PrimitiveType: models.SyncTypeRWMutex,
			EventType:     "RUnlock",
			GoroutineID:   2,
		},
		// 没有写锁操作
	}

	issues, err := detector.Detect(nil, events, nil)
	if err != nil {
		t.Fatalf("Failed to detect: %v", err)
	}

	t.Logf("Detected %d issues", len(issues))
	for i, issue := range issues {
		t.Logf("Issue %d: [%s] %s - %s", i+1, issue.Severity, issue.Title, issue.Description)
	}
}

func TestDetectorNames(t *testing.T) {
	// 验证所有检测器都有正确的名称
	detectors := []Detector{
		NewLockOrderDetector(),
		NewRWMutexStarvationDetector(),
		NewWaitGroupCountDetector(),
		NewOnceInitDetector(),
		NewCondWakeupDetector(),
		NewPoolMisuseDetector(),
		NewRaceConditionDetector(),
	}

	for _, detector := range detectors {
		name := detector.Name()
		if name == "" {
			t.Errorf("Detector has empty name")
		}
		t.Logf("Detector: %s", name)
	}
}
