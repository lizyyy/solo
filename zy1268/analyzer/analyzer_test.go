package analyzer

import (
	"os"
	"testing"
	"time"

	"go-runtime-analyzer/storage"
)

func setupTestDB(t *testing.T) *storage.DB {
	tmpFile := "test_analyzer.db"
	db, err := storage.InitDB(tmpFile)
	if err != nil {
		t.Fatalf("Failed to init DB: %v", err)
	}
	return db
}

func cleanupTestDB(db *storage.DB) {
	db.Close()
	os.Remove("test_analyzer.db")
}

func TestNewAnalyzer(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(db)

	config := DefaultAnalysisConfig()
	an := NewAnalyzer(db, config)

	if an == nil {
		t.Error("Expected analyzer to be created")
	}

	if an.config.StackThresholdKB != 1024 {
		t.Errorf("Expected StackThresholdKB=1024, got %d", an.config.StackThresholdKB)
	}
}

func TestAnalyzeEmptyDB(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(db)

	an := NewAnalyzer(db, nil)
	result, err := an.Analyze()

	if err != nil {
		t.Fatalf("Analyze failed on empty DB: %v", err)
	}

	if result.Summary.TotalStacktraces != 0 {
		t.Errorf("Expected 0 stacktraces, got %d", result.Summary.TotalStacktraces)
	}
	if result.Summary.TotalPreemptEvents != 0 {
		t.Errorf("Expected 0 preempt events, got %d", result.Summary.TotalPreemptEvents)
	}
}

func TestAnalyzeWithData(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(db)

	// 插入测试数据
	now := time.Now()

	// Stacktrace
	st := &storage.Stacktrace{
		Timestamp:   now,
		GoroutineID: 1,
		Status:      "running",
		Raw:         "goroutine 1 [running]",
	}
	db.InsertStacktrace(st)

	// Preempt events
	e1 := &storage.PreemptEvent{
		Timestamp:   now,
		GoroutineID: 1,
		EventType:   "async_preempt",
		Reason:      "long_running",
		Duration:    1500,
	}
	db.InsertPreemptEvent(e1)

	e2 := &storage.PreemptEvent{
		Timestamp:   now,
		GoroutineID: 2,
		EventType:   "stack_growth",
		Duration:    500,
	}
	db.InsertPreemptEvent(e2)

	// 分析
	an := NewAnalyzer(db, nil)
	result, err := an.Analyze()

	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	// 验证结果
	if result.Summary.TotalStacktraces != 1 {
		t.Errorf("Expected 1 stacktrace, got %d", result.Summary.TotalStacktraces)
	}
	if result.Summary.TotalPreemptEvents != 2 {
		t.Errorf("Expected 2 preempt events, got %d", result.Summary.TotalPreemptEvents)
	}
	if result.PreemptAnalysis.TotalAsyncPreempts != 1 {
		t.Errorf("Expected 1 async_preempt, got %d", result.PreemptAnalysis.TotalAsyncPreempts)
	}
	if result.PreemptAnalysis.TotalStackGrowths != 1 {
		t.Errorf("Expected 1 stack_growth, got %d", result.PreemptAnalysis.TotalStackGrowths)
	}
	if result.LatencyAnalysis.TotalLatencyEvents != 2 {
		t.Errorf("Expected 2 latency events, got %d", result.LatencyAnalysis.TotalLatencyEvents)
	}
	if result.LatencyAnalysis.MaxLatencyUS != 1500 {
		t.Errorf("Expected max latency 1500, got %d", result.LatencyAnalysis.MaxLatencyUS)
	}
}

func TestCompareResults(t *testing.T) {
	// 创建两个结果
	r1 := &AnalysisResult{
		GeneratedAt: time.Now(),
		Config:      DefaultAnalysisConfig(),
		StackAnalysis: StackAnalysis{
			TotalGrowthEvents: 10,
		},
		LatencyAnalysis: LatencyAnalysis{
			MaxLatencyUS:     1000,
			AverageLatencyUS: 500,
		},
		PreemptAnalysis: PreemptAnalysis{
			TotalAsyncPreempts: 5,
			TotalSyscallBlocks: 3,
		},
	}

	r2 := &AnalysisResult{
		GeneratedAt: time.Now(),
		Config:      DefaultAnalysisConfig(),
		StackAnalysis: StackAnalysis{
			TotalGrowthEvents: 5, // 减少了
		},
		LatencyAnalysis: LatencyAnalysis{
			MaxLatencyUS:     2000, // 增加了
			AverageLatencyUS: 800,  // 增加了
		},
		PreemptAnalysis: PreemptAnalysis{
			TotalAsyncPreempts: 10, // 增加了
			TotalSyscallBlocks: 2,  // 减少了
		},
	}

	comparison := CompareResults(r1, r2)

	if comparison == nil {
		t.Fatal("Expected comparison result")
	}

	if len(comparison.Differences) == 0 {
		t.Error("Expected at least one difference")
	}
}

func TestToMarkdown(t *testing.T) {
	result := &AnalysisResult{
		GeneratedAt: time.Now(),
		Config:      DefaultAnalysisConfig(),
		Summary: AnalysisSummary{
			TotalStacktraces:   5,
			TotalPreemptEvents: 10,
		},
		StackAnalysis: StackAnalysis{
			TotalGrowthEvents: 3,
			LargestStackSize:  8192,
		},
		PreemptAnalysis: PreemptAnalysis{
			TotalAsyncPreempts:    2,
			TotalStackGrowths:     3,
			TotalNosplitCalls:     1,
			TotalSyscallBlocks:    4,
			AveragePreemptLatency: 500,
			MaxPreemptLatency:     2000,
		},
		LatencyAnalysis: LatencyAnalysis{
			TotalLatencyEvents: 10,
			TotalLatencyUS:     5000,
			AverageLatencyUS:   500,
			MaxLatencyUS:       2000,
		},
	}

	md := result.ToMarkdown()

	if md == "" {
		t.Error("Expected non-empty markdown")
	}

	// 检查关键内容
	checks := []string{
		"# Go Runtime 栈增长和抢占分析报告",
		"## 摘要",
		"## 栈分析",
		"## 抢占分析",
		"## 延迟分析",
	}

	for _, check := range checks {
		if !contains(md, check) {
			t.Errorf("Expected markdown to contain: %s", check)
		}
	}
}

func TestToJSON(t *testing.T) {
	result := &AnalysisResult{
		GeneratedAt: time.Now(),
		Config:      DefaultAnalysisConfig(),
		Summary: AnalysisSummary{
			TotalStacktraces:   5,
			TotalPreemptEvents: 10,
		},
	}

	jsonStr, err := result.ToJSON()

	if err != nil {
		t.Fatalf("ToJSON failed: %v", err)
	}

	if jsonStr == "" {
		t.Error("Expected non-empty JSON")
	}

	// 验证是有效的 JSON
	if !contains(jsonStr, `"generated_at"`) {
		t.Error("Expected JSON to contain generated_at")
	}
	if !contains(jsonStr, `"summary"`) {
		t.Error("Expected JSON to contain summary")
	}
}

func TestGenerateRecommendations(t *testing.T) {
	db := setupTestDB(t)
	defer cleanupTestDB(db)

	// 插入高延迟数据
	e := &storage.PreemptEvent{
		Timestamp:   time.Now(),
		GoroutineID: 1,
		EventType:   "syscall_block",
		Duration:    5000, // 超过默认阈值 1000us
	}
	db.InsertPreemptEvent(e)

	// 插入多个栈增长
	for i := 0; i < 15; i++ {
		ge := &storage.PreemptEvent{
			Timestamp:   time.Now(),
			GoroutineID: i + 2,
			EventType:   "stack_growth",
			Duration:    100,
		}
		db.InsertPreemptEvent(ge)
	}

	an := NewAnalyzer(db, nil)
	result, err := an.Analyze()

	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if len(result.Recommendations) == 0 {
		t.Error("Expected recommendations for high latency and frequent stack growth")
	}

	// 检查是否有高优先级建议
	hasHighPriority := false
	for _, rec := range result.Recommendations {
		if rec.Priority == "high" {
			hasHighPriority = true
			break
		}
	}

	if !hasHighPriority {
		t.Error("Expected at least one high priority recommendation")
	}
}

func TestDefaultAnalysisConfig(t *testing.T) {
	config := DefaultAnalysisConfig()

	if config.StackThresholdKB != 1024 {
		t.Errorf("Expected StackThresholdKB=1024, got %d", config.StackThresholdKB)
	}
	if config.LatencyThresholdUS != 100 {
		t.Errorf("Expected LatencyThresholdUS=100, got %d", config.LatencyThresholdUS)
	}
	if config.HighSyscallThreshold != 1000 {
		t.Errorf("Expected HighSyscallThreshold=1000, got %d", config.HighSyscallThreshold)
	}
}

// 辅助函数
func contains(s, substr string) bool {
	return len(s) >= len(substr) && (len(substr) == 0 || indexOf(s, substr) >= 0)
}

func indexOf(s, substr string) int {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return i
		}
	}
	return -1
}
