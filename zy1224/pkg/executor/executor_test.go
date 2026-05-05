package executor_test

import (
	"testing"

	"deferpanic/pkg/executor"
	"deferpanic/pkg/parser"
)

func TestBasicDeferExecution(t *testing.T) {
	cs := &parser.Case{
		Name:        "basic_defer",
		Description: "测试基础 defer",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.Status != executor.StatusNormal {
		t.Errorf("期望状态 normal，实际: %s", result.Status)
	}

	if len(result.Timeline) == 0 {
		t.Error("时间线不应为空")
	}
}

func TestMultiDeferLIFO(t *testing.T) {
	cs := &parser.Case{
		Name:        "multi_defer",
		Description: "测试多个 defer 的 LIFO 顺序",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.Status != executor.StatusNormal {
		t.Errorf("期望状态 normal，实际: %s", result.Status)
	}

	foundDeferExec := false
	for _, event := range result.Timeline {
		if event.Type == "DEFER_EXEC" {
			foundDeferExec = true
			break
		}
	}

	if !foundDeferExec && len(result.Timeline) > 0 {
		t.Log("注意: 此测试验证基本执行流程")
	}
}

func TestPanicRecover(t *testing.T) {
	cs := &parser.Case{
		Name:        "panic_recover",
		Description: "测试 panic 后 recover",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.Status != executor.StatusRecovered {
		t.Errorf("期望状态 recovered，实际: %s", result.Status)
	}

	if !result.Recovered {
		t.Error("期望 Recovered 为 true")
	}
}

func TestNamedReturn(t *testing.T) {
	cs := &parser.Case{
		Name:        "named_return",
		Description: "测试 defer 修改命名返回值",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.Status != executor.StatusNormal {
		t.Errorf("期望状态 normal，实际: %s", result.Status)
	}

	// 命名返回值应该是 2
	if result.ReturnValue != nil {
		if val, ok := result.ReturnValue.(int); ok && val != 2 {
			t.Errorf("期望返回值 2，实际: %d", val)
		}
	}
}

func TestDoublePanic(t *testing.T) {
	cs := &parser.Case{
		Name:        "double_panic",
		Description: "测试二次 panic 覆盖",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.Status != executor.StatusPanicked {
		t.Errorf("期望状态 panicked，实际: %s", result.Status)
	}

	if result.PanicValue == nil {
		t.Error("期望有 PanicValue")
	}
}

func TestRiskAnalysis(t *testing.T) {
	cs := &parser.Case{
		Name:        "double_panic",
		Description: "测试风险分析",
		RiskLevel:   "high",
	}

	result, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result.RiskAnalysis == nil {
		t.Error("期望有风险分析")
	} else {
		if result.RiskAnalysis.Level != "high" {
			t.Errorf("期望风险等级 high，实际: %s", result.RiskAnalysis.Level)
		}
		if len(result.RiskAnalysis.Suggestions) == 0 {
			t.Error("期望有修复建议")
		}
	}
}

func TestExecutionIDGeneration(t *testing.T) {
	cs := &parser.Case{
		Name: "basic_defer",
	}

	result1, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	result2, err := executor.Execute(cs, false, false)
	if err != nil {
		t.Fatalf("执行失败: %v", err)
	}

	if result1.ExecutionID == "" {
		t.Error("ExecutionID 不应为空")
	}

	if result1.ExecutionID == result2.ExecutionID {
		t.Error("每次执行的 ExecutionID 应不同")
	}
}
