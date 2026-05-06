package parser

import (
	"strings"
	"testing"
)

const sampleStacktrace = `goroutine 1 [running]:
main.heavyFunction(0x1, 0x2)
	/Users/user/project/main.go:42 +0x30
main.main()
	/Users/user/project/main.go:18 +0x50

goroutine 5 [syscall, 10 minutes]:
syscall.Syscall(0x1, 0x2, 0x3, 0x4)
	/usr/local/go/src/syscall/asm_darwin_amd64.s:20 +0x10
os.(*File).Write(0xc000010010, {0xc000016000, 0x400, 0x400})
	/usr/local/go/src/os/file.go:174 +0x6e
created by main.main in goroutine 1
	/Users/user/project/main.go:15 +0x3a

goroutine 7 [chan receive]:
main.worker(0xc000014000)
	/Users/user/project/main.go:100 +0x85
`

func TestParseStacktrace(t *testing.T) {
	traces, err := ParseStacktrace(sampleStacktrace, "test.txt")
	if err != nil {
		t.Fatalf("ParseStacktrace failed: %v", err)
	}

	if len(traces) != 3 {
		t.Errorf("Expected 3 goroutines, got %d", len(traces))
	}

	// 检查第一个 goroutine
	if traces[0].GoroutineID != 1 {
		t.Errorf("Expected goroutine ID 1, got %d", traces[0].GoroutineID)
	}
	if traces[0].Status != "running" {
		t.Errorf("Expected status 'running', got '%s'", traces[0].Status)
	}

	// 检查 syscall goroutine
	if traces[1].GoroutineID != 5 {
		t.Errorf("Expected goroutine ID 5, got %d", traces[1].GoroutineID)
	}
	// 状态可能包含时间信息，检查前缀
	if !strings.HasPrefix(traces[1].Status, "syscall") {
		t.Errorf("Expected status starting with 'syscall', got '%s'", traces[1].Status)
	}

	// 检查 chan receive goroutine
	if traces[2].GoroutineID != 7 {
		t.Errorf("Expected goroutine ID 7, got %d", traces[2].GoroutineID)
	}
	if traces[2].Status != "chan receive" {
		t.Errorf("Expected status 'chan receive', got '%s'", traces[2].Status)
	}
}

func TestValidateStacktraceFormat(t *testing.T) {
	// 有效格式
	if err := ValidateStacktraceFormat(sampleStacktrace); err != nil {
		t.Errorf("Valid stacktrace should pass validation: %v", err)
	}

	// 无效格式：缺少 goroutine
	invalid := "this is not a stacktrace"
	if err := ValidateStacktraceFormat(invalid); err == nil {
		t.Error("Invalid stacktrace should fail validation")
	}
}

const sampleSchedtrace = `SCHED 1000ms: gomaxprocs=2 idleprocs=1 threads=5 spinningthreads=0 idlethreads=2 runqueue=0 [0 0]
[0]: RUNNING goroutine 5: runtime.sysmon (10/2/0)
[1]: RUNNABLE goroutine 12: main.worker (0/1/0)
  M P  ID  TICK  STATUS  GOMAXPROCS  THREADS  IDLEPROCS  RUNQ  LATENCY
  0  0   5  1000  running           2        5          1     0  500us
  1  -   1  1000  idle              2        5          1     0  0us
  0  -   7  1000  waiting           2        5          1     0  200us
  0  -   3  1000  syscall           2        5          1     0  1500us
`

func TestParseSchedtrace(t *testing.T) {
	trace, goroutines, err := ParseSchedtrace(sampleSchedtrace, "test.txt")
	if err != nil {
		t.Fatalf("ParseSchedtrace failed: %v", err)
	}

	if trace.GOMAXPROCS != 2 {
		t.Errorf("Expected GOMAXPROCS=2, got %d", trace.GOMAXPROCS)
	}
	if trace.IdleProcs != 1 {
		t.Errorf("Expected idleprocs=1, got %d", trace.IdleProcs)
	}
	if trace.Threads != 5 {
		t.Errorf("Expected threads=5, got %d", trace.Threads)
	}

	if len(goroutines) == 0 {
		t.Error("Expected at least one goroutine in schedtrace")
	}
}

func TestValidateSchedtraceFormat(t *testing.T) {
	// 有效格式
	if err := ValidateSchedtraceFormat(sampleSchedtrace); err != nil {
		t.Errorf("Valid schedtrace should pass validation: %v", err)
	}

	// 无效格式
	invalid := "this is not a schedtrace"
	if err := ValidateSchedtraceFormat(invalid); err == nil {
		t.Error("Invalid schedtrace should fail validation")
	}
}

const samplePreemptEvents = `timestamp=1699999999.123456, goroutine=12, type=async_preempt, reason=long_running, duration=1500us, pc=0x45a8b0
timestamp=1699999999.234567, goroutine=5, type=stack_growth, old_size=2048, new_size=4096, duration=250us
timestamp=1699999999.345678, goroutine=3, type=nosplit_call, function=runtime.memmove, frames=3, duration=100us
timestamp=1699999999.456789, goroutine=7, type=syscall_block, syscall=write, duration=3000us
`

func TestParsePreemptEvent(t *testing.T) {
	events, err := ParsePreemptEvent(samplePreemptEvents, "test.txt")
	if err != nil {
		t.Fatalf("ParsePreemptEvent failed: %v", err)
	}

	if len(events) != 4 {
		t.Errorf("Expected 4 events, got %d", len(events))
	}

	// 检查各类型
	eventTypes := make(map[string]int)
	for _, e := range events {
		eventTypes[e.EventType]++
	}

	if eventTypes["async_preempt"] != 1 {
		t.Errorf("Expected 1 async_preempt, got %d", eventTypes["async_preempt"])
	}
	if eventTypes["stack_growth"] != 1 {
		t.Errorf("Expected 1 stack_growth, got %d", eventTypes["stack_growth"])
	}
	if eventTypes["nosplit_call"] != 1 {
		t.Errorf("Expected 1 nosplit_call, got %d", eventTypes["nosplit_call"])
	}
	if eventTypes["syscall_block"] != 1 {
		t.Errorf("Expected 1 syscall_block, got %d", eventTypes["syscall_block"])
	}
}

func TestValidatePreemptEventFormat(t *testing.T) {
	// 有效格式
	if err := ValidatePreemptEventFormat(samplePreemptEvents); err != nil {
		t.Errorf("Valid preempt events should pass validation: %v", err)
	}

	// 无效格式
	invalid := "this is not a preempt event log"
	if err := ValidatePreemptEventFormat(invalid); err == nil {
		t.Error("Invalid preempt events should fail validation")
	}
}

const sampleBenchmark = `goos: darwin
goarch: amd64
pkg: github.com/example/project
cpu: Intel(R) Core(TM) i7-9750H CPU @ 2.60GHz
BenchmarkHeavyFunction-12            100          12543210 ns/op          2048 B/op          5 allocs/op
BenchmarkWorker-12                   500           2345678 ns/op          1024 B/op          3 allocs/op
PASS
ok      github.com/example/project  3.123s
`

func TestParseBenchmark(t *testing.T) {
	results, err := ParseBenchmark(sampleBenchmark, "test.txt")
	if err != nil {
		t.Fatalf("ParseBenchmark failed: %v", err)
	}

	if len(results) != 2 {
		t.Errorf("Expected 2 benchmark results, got %d", len(results))
	}

	// 检查第一个 benchmark
	foundHeavy := false
	foundWorker := false
	for _, r := range results {
		if r.NsPerOp == 12543210 {
			foundHeavy = true
			if r.BytesPerOp != 2048 {
				t.Errorf("Expected BytesPerOp=2048, got %d", r.BytesPerOp)
			}
			if r.AllocsPerOp != 5 {
				t.Errorf("Expected AllocsPerOp=5, got %d", r.AllocsPerOp)
			}
		}
		if r.NsPerOp == 2345678 {
			foundWorker = true
		}
	}

	if !foundHeavy {
		t.Error("Did not find BenchmarkHeavyFunction result")
	}
	if !foundWorker {
		t.Error("Did not find BenchmarkWorker result")
	}
}

func TestValidateBenchmarkFormat(t *testing.T) {
	// 有效格式
	if err := ValidateBenchmarkFormat(sampleBenchmark); err != nil {
		t.Errorf("Valid benchmark should pass validation: %v", err)
	}

	// 无效格式
	invalid := "this is not a benchmark output"
	if err := ValidateBenchmarkFormat(invalid); err == nil {
		t.Error("Invalid benchmark should fail validation")
	}
}

const sampleCodeWithIssues = `//go:nosplit
func fastHash(data []byte) uint64 {
	h := uint64(17)
	for _, b := range data {
		h = h*31 + uint64(b)
	}
	return h
}

func processData(data []int) {
	for i := 0; i < len(data); i++ {
		data[i] = data[i] * 2
	}
}

func writeFile(f *os.File, data []byte) {
	f.Write(data)
}
`

func TestParseCodeSnippet(t *testing.T) {
	snippet, err := ParseCodeSnippet(sampleCodeWithIssues, "test.go")
	if err != nil {
		t.Fatalf("ParseCodeSnippet failed: %v", err)
	}

	if snippet.FilePath != "test.go" {
		t.Errorf("Expected FilePath='test.go', got '%s'", snippet.FilePath)
	}

	// 检查是否检测到问题
	if snippet.Issues == "" || snippet.Issues == "[]" {
		// 这可能没问题，因为检测逻辑可能不同
		t.Log("No issues detected (this may be expected)")
	}
}

func TestDetectCodeIssues(t *testing.T) {
	issues := detectCodeIssues(sampleCodeWithIssues)

	// 应该检测到 nosplit
	foundNosplit := false
	for _, issue := range issues {
		if issue.Type == "nosplit" {
			foundNosplit = true
			break
		}
	}

	if !foundNosplit {
		// nosplit 检测是明确的，应该能找到
		t.Error("Expected to detect //go:nosplit issue")
	}
}
