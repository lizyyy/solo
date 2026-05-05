package analyzer

import (
	"context-health/pkg/model"
	"regexp"
	"strings"
	"time"
)

type Rule interface {
	Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue
	Name() string
	Category() string
}

type DeadlineInheritanceRule struct{}

func (r *DeadlineInheritanceRule) Name() string     { return "deadline_inheritance" }
func (r *DeadlineInheritanceRule) Category() string { return "deadline" }

func (r *DeadlineInheritanceRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	for _, step := range plan.CallChain {
		if step.From == call.Caller && step.To == call.Callee {
			if step.Timeout > 0 && !call.HasDeadline {
				return &model.RiskIssue{
					Category:    r.Category(),
					Level:       model.RiskHigh,
					Title:       "Deadline 未继承",
					Description: "调用 " + call.Caller + " -> " + call.Callee + " 应该设置超时 " + step.Timeout.String() + "，但未设置 deadline",
					Suggestion:  "使用 context.WithTimeout 或 context.WithDeadline 传递超时上下文",
					Caller:      call.Caller,
					Callee:      call.Callee,
					SourceFile:  call.SourceFile,
					LineNumber:  call.LineNumber,
				}
			}
			break
		}
	}
	return nil
}

type CancelPropagationRule struct{}

func (r *CancelPropagationRule) Name() string     { return "cancel_propagation" }
func (r *CancelPropagationRule) Category() string { return "cancellation" }

func (r *CancelPropagationRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	for _, step := range plan.CallChain {
		if step.From == call.Caller && step.To == call.Callee {
			if step.RequiresCancel {
				if !call.HasCancel {
					return &model.RiskIssue{
						Category:    r.Category(),
						Level:       model.RiskCritical,
						Title:       "取消传播缺失",
						Description: "调用 " + call.Caller + " -> " + call.Callee + " 要求传播取消信号，但未使用可取消的 context",
						Suggestion:  "使用 context.WithCancel 创建可取消的上下文，并确保在调用链中传播",
						Caller:      call.Caller,
						Callee:      call.Callee,
						SourceFile:  call.SourceFile,
						LineNumber:  call.LineNumber,
					}
				}
				if call.HasCancel && !call.CancelCalled {
					return &model.RiskIssue{
						Category:    r.Category(),
						Level:       model.RiskHigh,
						Title:       "Cancel 函数未调用",
						Description: "调用 " + call.Caller + " -> " + call.Callee + " 创建了可取消 context，但 cancel 函数未被调用",
						Suggestion:  "确保在 defer 中调用 cancel 函数释放资源",
						Caller:      call.Caller,
						Callee:      call.Callee,
						SourceFile:  call.SourceFile,
						LineNumber:  call.LineNumber,
					}
				}
			}
			break
		}
	}
	return nil
}

type BudgetAllocationRule struct{}

func (r *BudgetAllocationRule) Name() string     { return "budget_allocation" }
func (r *BudgetAllocationRule) Category() string { return "budget" }

func (r *BudgetAllocationRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if budget, ok := plan.Budgets[call.Callee]; ok {
		if call.TimeoutBudget > budget.Allocation {
			return &model.RiskIssue{
				Category:    r.Category(),
				Level:       model.RiskHigh,
				Title:       "超时预算超支",
				Description: "服务 " + call.Callee + " 配置的超时 " + call.TimeoutBudget.String() + " 超过了预算 " + budget.Allocation.String(),
				Suggestion:  "调整超时时间或重新分配预算，当前已超支 " + (call.TimeoutBudget - budget.Allocation).String(),
				Caller:      call.Caller,
				Callee:      call.Callee,
				SourceFile:  call.SourceFile,
				LineNumber:  call.LineNumber,
			}
		}
	}
	return nil
}

type WithValueMisuseRule struct{}

func (r *WithValueMisuseRule) Name() string     { return "withvalue_misuse" }
func (r *WithValueMisuseRule) Category() string { return "withvalue" }

var withValueKeyPattern = regexp.MustCompile(`^[a-z0-9_]+$`)

func (r *WithValueMisuseRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if len(call.WithValueKeys) == 0 {
		return nil
	}

	for _, key := range call.WithValueKeys {
		if !withValueKeyPattern.MatchString(key) {
			return &model.RiskIssue{
				Category:    r.Category(),
				Level:       model.RiskMedium,
				Title:       "WithValue 键名不规范",
				Description: "键名 '" + key + "' 不符合 Go 惯例，应该使用小写字母、数字和下划线",
				Suggestion:  "使用小写字母、数字和下划线命名 WithValue 键，如 'user_id', 'request_id'",
				Caller:      call.Caller,
				Callee:      call.Callee,
				SourceFile:  call.SourceFile,
				LineNumber:  call.LineNumber,
			}
		}

		allowed := false
		for _, allowedKey := range plan.AllowedValues {
			if strings.HasPrefix(key, allowedKey) {
				allowed = true
				break
			}
		}
		if len(plan.AllowedValues) > 0 && !allowed {
			return &model.RiskIssue{
				Category:    r.Category(),
				Level:       model.RiskHigh,
				Title:       "WithValue 键未授权",
				Description: "键名 '" + key + "' 不在允许的 WithValue 键列表中",
				Suggestion:  "检查是否应该使用这个键，或在 context-plan.yaml 的 allowed_withvalue_keys 中添加它",
				Caller:      call.Caller,
				Callee:      call.Callee,
				SourceFile:  call.SourceFile,
				LineNumber:  call.LineNumber,
			}
		}
	}

	if len(call.WithValueKeys) > 5 {
		return &model.RiskIssue{
			Category:    r.Category(),
			Level:       model.RiskMedium,
			Title:       "WithValue 过度使用",
			Description: "单次调用中使用了 " + string(rune(len(call.WithValueKeys))) + " 个 WithValue 键，可能表示滥用",
			Suggestion:  "考虑使用结构体或专用类型来传递多个值，而不是滥用 WithValue",
			Caller:      call.Caller,
			Callee:      call.Callee,
			SourceFile:  call.SourceFile,
			LineNumber:  call.LineNumber,
		}
	}

	return nil
}

type BackgroundMisuseRule struct{}

func (r *BackgroundMisuseRule) Name() string     { return "background_misuse" }
func (r *BackgroundMisuseRule) Category() string { return "background_todo" }

func (r *BackgroundMisuseRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if !call.UsesBackground {
		return nil
	}

	if call.Caller == plan.EntryPoint {
		return nil
	}

	return &model.RiskIssue{
		Category:    r.Category(),
		Level:       model.RiskCritical,
		Title:       "context.Background 误用",
		Description: "在调用链中间使用了 context.Background，这会中断 deadline 和取消信号的传播",
		Suggestion:  "从上层调用传递 context，而不是新建 Background。只有在入口点才应该使用 Background 或 TODO",
		Caller:      call.Caller,
		Callee:      call.Callee,
		SourceFile:  call.SourceFile,
		LineNumber:  call.LineNumber,
	}
}

type TODOMisuseRule struct{}

func (r *TODOMisuseRule) Name() string     { return "todo_misuse" }
func (r *TODOMisuseRule) Category() string { return "background_todo" }

func (r *TODOMisuseRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if !call.UsesTODO {
		return nil
	}

	return &model.RiskIssue{
		Category:    r.Category(),
		Level:       model.RiskMedium,
		Title:       "context.TODO 临时使用",
		Description: "使用了 context.TODO，这通常表示临时代码，需要确定正确的 context 传递方式",
		Suggestion:  "分析应该使用哪个 context，并替换 TODO 为正确的上下文传递方式",
		Caller:      call.Caller,
		Callee:      call.Callee,
		SourceFile:  call.SourceFile,
		LineNumber:  call.LineNumber,
	}
}

type GoroutineBoundaryRule struct{}

func (r *GoroutineBoundaryRule) Name() string     { return "goroutine_boundary" }
func (r *GoroutineBoundaryRule) Category() string { return "goroutine" }

func (r *GoroutineBoundaryRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if !call.IsGoroutine {
		return nil
	}

	if !call.HasCancel {
		return &model.RiskIssue{
			Category:    r.Category(),
			Level:       model.RiskHigh,
			Title:       "Goroutine 边界无取消机制",
			Description: "在 goroutine 中执行 " + call.Caller + " -> " + call.Callee + "，但没有使用可取消的 context",
			Suggestion:  "在启动 goroutine 前使用 context.WithCancel 或 context.WithTimeout 创建上下文，确保可以在需要时释放资源",
			Caller:      call.Caller,
			Callee:      call.Callee,
			SourceFile:  call.SourceFile,
			LineNumber:  call.LineNumber,
		}
	}

	if call.HasCancel && !call.CancelCalled {
		return &model.RiskIssue{
			Category:    r.Category(),
			Level:       model.RiskCritical,
			Title:       "Goroutine 资源泄漏风险",
			Description: "Goroutine 中使用了可取消 context，但 cancel 函数未被调用，存在资源泄漏",
			Suggestion:  "在 goroutine 内使用 defer cancel() 确保资源释放，或在主协程中适当的时机调用 cancel",
			Caller:      call.Caller,
			Callee:      call.Callee,
			SourceFile:  call.SourceFile,
			LineNumber:  call.LineNumber,
		}
	}

	return nil
}

type CascadeTimeoutRule struct{}

func (r *CascadeTimeoutRule) Name() string     { return "cascade_timeout" }
func (r *CascadeTimeoutRule) Category() string { return "timeout" }

func (r *CascadeTimeoutRule) Check(call *model.CallRecord, plan *model.ContextPlan) *model.RiskIssue {
	if !call.HasDeadline || call.TimeoutBudget == 0 {
		return nil
	}

	totalBudget := plan.TotalTimeout
	if totalBudget == 0 {
		return nil
	}

	if call.TimeoutBudget >= totalBudget {
		return &model.RiskIssue{
			Category:    r.Category(),
			Level:       model.RiskHigh,
			Title:       "级联超时风险",
			Description: "单次调用超时 " + call.TimeoutBudget.String() + " 接近或超过总预算 " + totalBudget.String(),
			Suggestion:  "确保子调用的超时时间小于父调用，给错误处理和日志记录预留时间",
			Caller:      call.Caller,
			Callee:      call.Callee,
			SourceFile:  call.SourceFile,
			LineNumber:  call.LineNumber,
		}
	}

	return nil
}

var AllRules = []Rule{
	&DeadlineInheritanceRule{},
	&CancelPropagationRule{},
	&BudgetAllocationRule{},
	&WithValueMisuseRule{},
	&BackgroundMisuseRule{},
	&TODOMisuseRule{},
	&GoroutineBoundaryRule{},
	&CascadeTimeoutRule{},
}

func RunAllRules(calls []model.CallRecord, plan *model.ContextPlan) []model.RiskIssue {
	var risks []model.RiskIssue

	for i := range calls {
		for _, rule := range AllRules {
			if risk := rule.Check(&calls[i], plan); risk != nil {
				risks = append(risks, *risk)
			}
		}
	}

	return risks
}

func BuildBudgetWaterfall(calls []model.CallRecord, plan *model.ContextPlan) []model.BudgetSegment {
	var segments []model.BudgetSegment
	totalBudget := plan.TotalTimeout
	used := time.Duration(0)

	for i := range calls {
		call := &calls[i]
		if call.TimeoutBudget == 0 {
			continue
		}

		percentage := float64(call.TimeoutBudget) / float64(totalBudget) * 100
		used += call.TimeoutBudget

		level := "safe"
		if percentage > 80 {
			level = "critical"
		} else if percentage > 50 {
			level = "warning"
		}

		segments = append(segments, model.BudgetSegment{
			Caller:    call.Caller,
			Callee:    call.Callee,
			Allocated: call.TimeoutBudget,
			Used:      call.TimeoutBudget,
			Remaining: totalBudget - used,
			Percentage: percentage,
			Level:     level,
		})
	}

	return segments
}
