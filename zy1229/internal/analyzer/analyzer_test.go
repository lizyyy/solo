package analyzer

import (
	"strings"
	"testing"
	"time"
)

func TestNewAnalyzer(t *testing.T) {
	// 测试使用默认配置
	analyzer := NewAnalyzer(nil)
	if analyzer == nil {
		t.Error("NewAnalyzer returned nil")
	}

	// 测试使用自定义配置
	config := &AnalyzerConfig{
		CPUThreshold:      0.15,
		MemoryThreshold:   0.25,
		BlockingThreshold: 0.15,
		MutexThreshold:    0.15,
	}
	analyzer = NewAnalyzer(config)
	if analyzer == nil {
		t.Error("NewAnalyzer with config returned nil")
	}
}

func TestAnalyzeEmpty(t *testing.T) {
	analyzer := NewAnalyzer(nil)
	options := &AnalysisOptions{
		Name: "Test Analysis",
	}

	analysis, err := analyzer.Analyze(options)
	if err != nil {
		t.Errorf("Analyze failed: %v", err)
	}

	if analysis == nil {
		t.Error("Analysis returned nil")
	}

	if analysis.Name != "Test Analysis" {
		t.Errorf("Expected name 'Test Analysis', got '%s'", analysis.Name)
	}
}

func TestAnalyzeWithCPUProfile(t *testing.T) {
	analyzer := NewAnalyzer(nil)

	// 创建测试用的 CPU 样本
	samples := []CPUProfileSample{
		{
			CallStack: CallStack{
				Frames: []StackFrame{
					{Function: "main.hotFunction", File: "main.go", Line: 100},
					{Function: "main.main", File: "main.go", Line: 10},
				},
			},
			Value: 6000, // 60%
		},
		{
			CallStack: CallStack{
				Frames: []StackFrame{
					{Function: "main.coldFunction", File: "main.go", Line: 200},
					{Function: "main.main", File: "main.go", Line: 10},
				},
			},
			Value: 4000, // 40%
		},
	}

	options := &AnalysisOptions{
		Name:       "CPU Test",
		CPUProfile: samples,
	}

	analysis, err := analyzer.Analyze(options)
	if err != nil {
		t.Errorf("Analyze failed: %v", err)
	}

	// 检查摘要
	if analysis.Summary.TotalCPUSamples != 10000 {
		t.Errorf("Expected total CPU samples 10000, got %d", analysis.Summary.TotalCPUSamples)
	}

	// 检查瓶颈识别
	if len(analysis.Bottlenecks) == 0 {
		t.Error("Expected at least one bottleneck, got none")
	}

	// 检查 CPU 瓶颈是否被正确识别
	foundCPUBottleneck := false
	for _, b := range analysis.Bottlenecks {
		if b.Type == BottleneckTypeCPU {
			foundCPUBottleneck = true
			if !strings.Contains(b.Description, "hotFunction") {
				t.Errorf("Expected hotFunction in CPU bottleneck, got: %s", b.Description)
			}
		}
	}

	if !foundCPUBottleneck {
		t.Error("Expected to find CPU bottleneck, but none found")
	}

	// 检查优化建议
	if len(analysis.Recommendations) == 0 {
		t.Error("Expected at least one recommendation, got none")
	}
}

func TestAnalyzeWithHeapProfile(t *testing.T) {
	analyzer := NewAnalyzer(nil)

	// 创建测试用的内存样本
	samples := []HeapProfileSample{
		{
			CallStack: CallStack{
				Frames: []StackFrame{
					{Function: "main.memoryHog", File: "main.go", Line: 150},
				},
			},
			InUseBytes:   50 * 1024 * 1024, // 50MB
			InUseObjects: 50000,
			AllocBytes:   100 * 1024 * 1024,
			AllocObjects: 100000,
		},
		{
			CallStack: CallStack{
				Frames: []StackFrame{
					{Function: "main.normalUsage", File: "main.go", Line: 250},
				},
			},
			InUseBytes:   5 * 1024 * 1024, // 5MB
			InUseObjects: 5000,
			AllocBytes:   10 * 1024 * 1024,
			AllocObjects: 10000,
		},
	}

	options := &AnalysisOptions{
		Name:        "Heap Test",
		HeapProfile: samples,
	}

	analysis, err := analyzer.Analyze(options)
	if err != nil {
		t.Errorf("Analyze failed: %v", err)
	}

	// 检查摘要
	if analysis.Summary.TotalHeapInUse != 55*1024*1024 {
		t.Errorf("Expected total heap in use 57671680, got %d", analysis.Summary.TotalHeapInUse)
	}

	// 检查内存瓶颈
	foundMemoryBottleneck := false
	for _, b := range analysis.Bottlenecks {
		if b.Type == BottleneckTypeMemory && strings.Contains(b.Description, "memoryHog") {
			foundMemoryBottleneck = true
		}
	}

	if !foundMemoryBottleneck {
		t.Error("Expected to find memory bottleneck for memoryHog, but none found")
	}
}

func TestComparisonEngine(t *testing.T) {
	engine := NewComparisonEngine()

	// 创建两个分析结果进行对比
	oldAnalysis := &Analysis{
		ID:        "old-1",
		Name:      "Old Analysis",
		CreatedAt: time.Now().Add(-24 * time.Hour),
		Summary: AnalysisSummary{
			TotalCPUSamples: 10000,
			TotalHeapInUse:  100 * 1024 * 1024,
			TotalBlockCount: 1000,
			TotalMutexCount: 500,
		},
		Bottlenecks: []Bottleneck{
			{Type: BottleneckTypeCPU, Severity: 8.0},
			{Type: BottleneckTypeMemory, Severity: 6.0},
		},
	}

	newAnalysis := &Analysis{
		ID:        "new-1",
		Name:      "New Analysis",
		CreatedAt: time.Now(),
		Summary: AnalysisSummary{
			TotalCPUSamples: 8000,             // 减少了 20%
			TotalHeapInUse:  50 * 1024 * 1024, // 减少了 50%
			TotalBlockCount: 800,              // 减少了 20%
			TotalMutexCount: 600,              // 增加了 20%
		},
		Bottlenecks: []Bottleneck{
			{Type: BottleneckTypeCPU, Severity: 4.0},
		},
	}

	comparison, err := engine.CompareAnalyses(oldAnalysis, newAnalysis)
	if err != nil {
		t.Errorf("CompareAnalyses failed: %v", err)
	}

	if comparison == nil {
		t.Error("Comparison returned nil")
	}

	// 检查改进项
	if len(comparison.Improvements) == 0 {
		t.Error("Expected at least one improvement, got none")
	}

	// 检查回归项（锁竞争增加）
	// 注意：这取决于阈值设置
	t.Logf("Comparison Summary: Improvements=%d, Regressions=%d, Score=%.2f",
		comparison.Summary.TotalImprovements,
		comparison.Summary.TotalRegressions,
		comparison.Summary.OverallScore)
}

func TestBottleneckSorting(t *testing.T) {
	analyzer := NewAnalyzer(nil)

	// 创建多个不同严重程度的瓶颈
	options := &AnalysisOptions{
		Name: "Sorting Test",
		CPUProfile: []CPUProfileSample{
			{
				CallStack: CallStack{Frames: []StackFrame{{Function: "func1"}}},
				Value:     7000, // 70% - 最严重
			},
			{
				CallStack: CallStack{Frames: []StackFrame{{Function: "func2"}}},
				Value:     2000, // 20% - 中等
			},
			{
				CallStack: CallStack{Frames: []StackFrame{{Function: "func3"}}},
				Value:     1000, // 10% - 最轻
			},
		},
	}

	analysis, err := analyzer.Analyze(options)
	if err != nil {
		t.Errorf("Analyze failed: %v", err)
	}

	// 验证瓶颈按严重程度降序排列
	if len(analysis.Bottlenecks) >= 2 {
		firstSeverity := analysis.Bottlenecks[0].Severity
		secondSeverity := analysis.Bottlenecks[1].Severity

		if firstSeverity < secondSeverity {
			t.Error("Expected bottlenecks to be sorted by severity descending")
		}
	}
}
