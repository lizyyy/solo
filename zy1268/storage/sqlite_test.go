package storage

import (
	"os"
	"testing"
	"time"
)

func TestInitDB(t *testing.T) {
	// 使用临时文件
	tmpFile := "test_temp.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 验证表是否创建
	tables := []string{
		"stacktraces",
		"schedtraces",
		"sched_goroutines",
		"preempt_events",
		"stack_growths",
		"nosplit_calls",
		"syscall_blocks",
		"code_snippets",
		"benchmark_results",
		"analysis_reports",
	}

	for _, table := range tables {
		var name string
		err := db.QueryRow("SELECT name FROM sqlite_master WHERE type='table' AND name=?", table).Scan(&name)
		if err != nil {
			t.Errorf("Table %s not found: %v", table, err)
		}
	}
}

func TestInsertAndGetStacktrace(t *testing.T) {
	tmpFile := "test_stacktrace.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入
	st := &Stacktrace{
		Timestamp:   time.Now(),
		GoroutineID: 42,
		Status:      "running",
		Frames:      "[]",
		Raw:         "goroutine 42 [running]:\nmain.func()\n\t/test.go:10",
		SourceFile:  "test.txt",
	}

	if err := db.InsertStacktrace(st); err != nil {
		t.Fatalf("InsertStacktrace failed: %v", err)
	}

	if st.ID == 0 {
		t.Error("Expected ID to be set after insert")
	}

	// 查询
	traces, err := db.GetAllStacktraces()
	if err != nil {
		t.Fatalf("GetAllStacktraces failed: %v", err)
	}

	if len(traces) != 1 {
		t.Errorf("Expected 1 stacktrace, got %d", len(traces))
	}

	if traces[0].GoroutineID != 42 {
		t.Errorf("Expected GoroutineID=42, got %d", traces[0].GoroutineID)
	}

	// 计数
	count, err := db.CountStacktraces()
	if err != nil {
		t.Fatalf("CountStacktraces failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}
}

func TestInsertAndGetPreemptEvent(t *testing.T) {
	tmpFile := "test_preempt.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入
	event := &PreemptEvent{
		Timestamp:   time.Now(),
		GoroutineID: 12,
		EventType:   "async_preempt",
		Reason:      "long_running",
		Duration:    1500,
		Details:     "{}",
		Raw:         "timestamp=1.0, goroutine=12, type=async_preempt",
		SourceFile:  "test.txt",
	}

	id, err := db.InsertPreemptEvent(event)
	if err != nil {
		t.Fatalf("InsertPreemptEvent failed: %v", err)
	}

	if id == 0 {
		t.Error("Expected ID to be returned")
	}

	// 插入子表
	sg := &StackGrowth{
		PreemptEventID: id,
		OldSize:        2048,
		NewSize:        4096,
		GrowthType:     "growth",
	}
	if err := db.InsertStackGrowth(sg); err != nil {
		t.Fatalf("InsertStackGrowth failed: %v", err)
	}

	// 查询
	events, err := db.GetAllPreemptEvents()
	if err != nil {
		t.Fatalf("GetAllPreemptEvents failed: %v", err)
	}

	if len(events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(events))
	}

	if events[0].EventType != "async_preempt" {
		t.Errorf("Expected EventType='async_preempt', got '%s'", events[0].EventType)
	}

	// 查询栈增长
	growths, err := db.GetStackGrowths()
	if err != nil {
		t.Fatalf("GetStackGrowths failed: %v", err)
	}
	if len(growths) != 1 {
		t.Errorf("Expected 1 stack growth, got %d", len(growths))
	}

	// 计数
	count, err := db.CountPreemptEvents()
	if err != nil {
		t.Fatalf("CountPreemptEvents failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}
}

func TestInsertAndGetSchedtrace(t *testing.T) {
	tmpFile := "test_sched.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入 schedtrace
	st := &Schedtrace{
		Timestamp:       time.Now(),
		GOMAXPROCS:      4,
		IdleProcs:       2,
		Threads:         10,
		SpinningThreads: 0,
		IdleThreads:     3,
		RunQueue:        2,
		PerProcRunQ:     "[0 2 0 0]",
		Raw:             "SCHED 1000ms: ...",
		SourceFile:      "test.txt",
	}

	id, err := db.InsertSchedtrace(st)
	if err != nil {
		t.Fatalf("InsertSchedtrace failed: %v", err)
	}

	// 插入关联的 goroutine
	sg := &SchedGoroutine{
		SchedtraceID: id,
		GoroutineID:  42,
		Status:       "running",
		Function:     "main.worker",
		Latency:      500,
		Tick:         1000,
	}
	if err := db.InsertSchedGoroutine(sg); err != nil {
		t.Fatalf("InsertSchedGoroutine failed: %v", err)
	}

	// 查询
	traces, err := db.GetAllSchedtraces()
	if err != nil {
		t.Fatalf("GetAllSchedtraces failed: %v", err)
	}

	if len(traces) != 1 {
		t.Errorf("Expected 1 schedtrace, got %d", len(traces))
	}

	if traces[0].GOMAXPROCS != 4 {
		t.Errorf("Expected GOMAXPROCS=4, got %d", traces[0].GOMAXPROCS)
	}

	// 查询关联的 goroutines
	goroutines, err := db.GetSchedGoroutinesByTraceID(id)
	if err != nil {
		t.Fatalf("GetSchedGoroutinesByTraceID failed: %v", err)
	}
	if len(goroutines) != 1 {
		t.Errorf("Expected 1 goroutine, got %d", len(goroutines))
	}

	// 计数
	count, err := db.CountSchedtraces()
	if err != nil {
		t.Fatalf("CountSchedtraces failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}
}

func TestInsertAndGetBenchmark(t *testing.T) {
	tmpFile := "test_bench.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入
	b := &BenchmarkResult{
		Timestamp:   time.Now(),
		TestName:    "BenchmarkTest",
		Iterations:  1000,
		NsPerOp:     123456,
		BytesPerOp:  1024,
		AllocsPerOp: 5,
		GoOS:        "darwin",
		GoArch:      "amd64",
		CPU:         "Intel",
		Raw:         "BenchmarkTest-12  1000  123456 ns/op",
		SourceFile:  "test.txt",
	}

	if err := db.InsertBenchmarkResult(b); err != nil {
		t.Fatalf("InsertBenchmarkResult failed: %v", err)
	}

	// 查询
	results, err := db.GetAllBenchmarks()
	if err != nil {
		t.Fatalf("GetAllBenchmarks failed: %v", err)
	}

	if len(results) != 1 {
		t.Errorf("Expected 1 benchmark, got %d", len(results))
	}

	if results[0].NsPerOp != 123456 {
		t.Errorf("Expected NsPerOp=123456, got %d", results[0].NsPerOp)
	}

	// 计数
	count, err := db.CountBenchmarks()
	if err != nil {
		t.Fatalf("CountBenchmarks failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}
}

func TestInsertAndGetSnippet(t *testing.T) {
	tmpFile := "test_snippet.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入
	s := &CodeSnippet{
		FilePath:   "test.go",
		Content:    "package main\n\nfunc main() {}",
		Issues:     "[]",
		ImportedAt: time.Now(),
	}

	if err := db.InsertCodeSnippet(s); err != nil {
		t.Fatalf("InsertCodeSnippet failed: %v", err)
	}

	// 查询
	snippets, err := db.GetAllSnippets()
	if err != nil {
		t.Fatalf("GetAllSnippets failed: %v", err)
	}

	if len(snippets) != 1 {
		t.Errorf("Expected 1 snippet, got %d", len(snippets))
	}

	if snippets[0].FilePath != "test.go" {
		t.Errorf("Expected FilePath='test.go', got '%s'", snippets[0].FilePath)
	}

	// 计数
	count, err := db.CountSnippets()
	if err != nil {
		t.Fatalf("CountSnippets failed: %v", err)
	}
	if count != 1 {
		t.Errorf("Expected count=1, got %d", count)
	}
}

func TestForeignKeys(t *testing.T) {
	tmpFile := "test_fk.db"
	defer os.Remove(tmpFile)

	db, err := InitDB(tmpFile)
	if err != nil {
		t.Fatalf("InitDB failed: %v", err)
	}
	defer db.Close()

	// 插入 schedtrace
	st := &Schedtrace{
		Timestamp:  time.Now(),
		GOMAXPROCS: 2,
		Raw:        "test",
	}
	id, err := db.InsertSchedtrace(st)
	if err != nil {
		t.Fatalf("InsertSchedtrace failed: %v", err)
	}

	// 插入关联的 goroutine
	sg := &SchedGoroutine{
		SchedtraceID: id,
		GoroutineID:  1,
		Status:       "running",
	}
	if err := db.InsertSchedGoroutine(sg); err != nil {
		t.Fatalf("InsertSchedGoroutine failed: %v", err)
	}

	// 尝试插入无效的外键（应该失败）
	invalidSG := &SchedGoroutine{
		SchedtraceID: 999999, // 不存在的 ID
		GoroutineID:  2,
		Status:       "waiting",
	}
	if err := db.InsertSchedGoroutine(invalidSG); err == nil {
		t.Error("Expected foreign key constraint violation, but got no error")
	}
}
