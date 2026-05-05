package analyzer

import (
	"context-health/pkg/model"
	"testing"
	"time"
)

func TestDeadlineInheritanceRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
		CallChain: []model.CallStep{
			{
				From:           "Handler",
				To:             "Service",
				Timeout:        500 * time.Millisecond,
				RequiresCancel: true,
			},
		},
	}

	rule := &DeadlineInheritanceRule{}

	t.Run("有deadline应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:      "Handler",
			Callee:      "Service",
			HasDeadline: true,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("没有deadline应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:      "Handler",
			Callee:      "Service",
			HasDeadline: false,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})
}

func TestCancelPropagationRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
		CallChain: []model.CallStep{
			{
				From:           "Handler",
				To:             "Service",
				Timeout:        500 * time.Millisecond,
				RequiresCancel: true,
			},
		},
	}

	rule := &CancelPropagationRule{}

	t.Run("有cancel且已调用应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:       "Handler",
			Callee:       "Service",
			HasCancel:    true,
			CancelCalled: true,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("没有cancel应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:       "Handler",
			Callee:       "Service",
			HasCancel:    false,
			CancelCalled: false,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskCritical {
			t.Errorf("期望 Critical 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("有cancel但没调用应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:       "Handler",
			Callee:       "Service",
			HasCancel:    true,
			CancelCalled: false,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})
}

func TestBackgroundMisuseRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
	}

	rule := &BackgroundMisuseRule{}

	t.Run("入口点使用Background应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:         "Handler",
			Callee:         "Service",
			UsesBackground: true,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("中间层使用Background应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:         "Service",
			Callee:         "DB",
			UsesBackground: true,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskCritical {
			t.Errorf("期望 Critical 级别，但得到: %v", risk.Level)
		}
	})
}

func TestTODOMisuseRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
	}

	rule := &TODOMisuseRule{}

	t.Run("使用TODO应该检测到", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:   "Service",
			Callee:   "DB",
			UsesTODO: true,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskMedium {
			t.Errorf("期望 Medium 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("不使用TODO应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:   "Service",
			Callee:   "DB",
			UsesTODO: false,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})
}

func TestGoroutineBoundaryRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
	}

	rule := &GoroutineBoundaryRule{}

	t.Run("Goroutine没有cancel应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:      "Service",
			Callee:      "Notifier",
			IsGoroutine: true,
			HasCancel:   false,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("Goroutine有cancel但没调用应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:       "Service",
			Callee:       "Notifier",
			IsGoroutine:  true,
			HasCancel:    true,
			CancelCalled: false,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskCritical {
			t.Errorf("期望 Critical 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("Goroutine有cancel且已调用应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:       "Service",
			Callee:       "Notifier",
			IsGoroutine:  true,
			HasCancel:    true,
			CancelCalled: true,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})
}

func TestWithValueMisuseRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint:    "Handler",
		AllowedValues: []string{"request_id", "user_id"},
	}

	rule := &WithValueMisuseRule{}

	t.Run("正确的键名应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:         "Handler",
			Callee:         "Service",
			WithValueKeys:  []string{"request_id", "user_id"},
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("不规范的键名应该检测到", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "Service",
			WithValueKeys: []string{"BadKey"},
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskMedium {
			t.Errorf("期望 Medium 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("未授权的键应该检测到", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "Service",
			WithValueKeys: []string{"secret_token"},
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})

	t.Run("过多WithValue应该检测到", func(t *testing.T) {
		call := &model.CallRecord{
			Caller: "Handler",
			Callee: "Service",
			WithValueKeys: []string{
				"request_id", "user_id", "config", "logger", "metrics", "cache",
			},
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
	})
}

func TestBudgetAllocationRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint: "Handler",
		Budgets: map[string]model.Budget{
			"UserService": {
				Service:    "UserService",
				Allocation: 1 * time.Second,
			},
		},
	}

	rule := &BudgetAllocationRule{}

	t.Run("在预算内应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "UserService",
			TimeoutBudget: 500 * time.Millisecond,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("超过预算应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "UserService",
			TimeoutBudget: 2 * time.Second,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})
}

func TestCascadeTimeoutRule(t *testing.T) {
	plan := &model.ContextPlan{
		EntryPoint:   "Handler",
		TotalTimeout: 10 * time.Second,
	}

	rule := &CascadeTimeoutRule{}

	t.Run("单次超时合理应该通过", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "Service",
			HasDeadline:   true,
			TimeoutBudget: 5 * time.Second,
		}
		risk := rule.Check(call, plan)
		if risk != nil {
			t.Errorf("期望没有风险，但得到: %v", risk)
		}
	})

	t.Run("单次超时接近总预算应该失败", func(t *testing.T) {
		call := &model.CallRecord{
			Caller:        "Handler",
			Callee:        "Service",
			HasDeadline:   true,
			TimeoutBudget: 10 * time.Second,
		}
		risk := rule.Check(call, plan)
		if risk == nil {
			t.Error("期望有风险，但没有检测到")
		}
		if risk.Level != model.RiskHigh {
			t.Errorf("期望 High 级别，但得到: %v", risk.Level)
		}
	})
}

func TestRunAllRules(t *testing.T) {
	plan := &model.ContextPlan{
		APIName:     "test_api",
		Description: "Test API",
		EntryPoint:  "Handler",
		TotalTimeout: 10 * time.Second,
		CallChain: []model.CallStep{
			{
				From:           "Handler",
				To:             "Service",
				Timeout:        1 * time.Second,
				RequiresCancel: true,
			},
		},
	}

	t.Run("好的调用应该没有风险", func(t *testing.T) {
		calls := []model.CallRecord{
			{
				Caller:         "Handler",
				Callee:         "Service",
				HasDeadline:    true,
				TimeoutBudget:  500 * time.Millisecond,
				HasCancel:      true,
				CancelCalled:   true,
				UsesBackground: true,
			},
		}

		risks := RunAllRules(calls, plan)
		if len(risks) != 0 {
			t.Errorf("期望没有风险，但得到 %d 个", len(risks))
		}
	})

	t.Run("坏的调用应该检测到多个风险", func(t *testing.T) {
		calls := []model.CallRecord{
			{
				Caller:         "Service",
				Callee:         "DB",
				HasDeadline:    false,
				HasCancel:      false,
				UsesBackground: true,
				UsesTODO:       true,
				IsGoroutine:    true,
			},
		}

		risks := RunAllRules(calls, plan)
		if len(risks) == 0 {
			t.Error("期望检测到风险，但没有")
		}
	})
}

func TestBuildBudgetWaterfall(t *testing.T) {
	plan := &model.ContextPlan{
		TotalTimeout: 10 * time.Second,
	}

	calls := []model.CallRecord{
		{
			Caller:        "A",
			Callee:        "B",
			TimeoutBudget: 2 * time.Second,
		},
		{
			Caller:        "B",
			Callee:        "C",
			TimeoutBudget: 3 * time.Second,
		},
	}

	waterfall := BuildBudgetWaterfall(calls, plan)

	if len(waterfall) != 2 {
		t.Errorf("期望 2 个段，但得到 %d", len(waterfall))
	}

	if waterfall[0].Caller != "A" || waterfall[0].Callee != "B" {
		t.Errorf("第一个段期望 A->B，但得到 %s->%s", waterfall[0].Caller, waterfall[0].Callee)
	}

	if waterfall[1].Caller != "B" || waterfall[1].Callee != "C" {
		t.Errorf("第二个段期望 B->C，但得到 %s->%s", waterfall[1].Caller, waterfall[1].Callee)
	}

	expectedPercentage := 20.0
	if waterfall[0].Percentage != expectedPercentage {
		t.Errorf("第一个段期望 %.1f%%，但得到 %.1f%%", expectedPercentage, waterfall[0].Percentage)
	}
}
