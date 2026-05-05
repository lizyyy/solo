package executor

import (
	"fmt"
	"time"

	"deferpanic/pkg/parser"

	"github.com/google/uuid"
)

type ExecutionStatus string

const (
	StatusNormal    ExecutionStatus = "normal"
	StatusPanicked  ExecutionStatus = "panicked"
	StatusRecovered ExecutionStatus = "recovered"
)

type TimelineEvent struct {
	Timestamp   time.Time
	Step        int
	Type        string
	Description string
	ReturnValue interface{}
	Details     map[string]interface{}
}

type ExecutionResult struct {
	ExecutionID   string
	CaseName      string
	Status        ExecutionStatus
	ReturnValue   interface{}
	PanicValue    interface{}
	Recovered     bool
	Timeline      []*TimelineEvent
	DeferStack    []string
	ReturnChanges []*ReturnChange
	RiskAnalysis  *RiskAnalysis
	StartedAt     time.Time
	CompletedAt   time.Time
}

type ReturnChange struct {
	Step        int
	Before      interface{}
	After       interface{}
	Description string
}

type RiskAnalysis struct {
	Level       string
	Description string
	Issues      []*RiskIssue
	Suggestions []string
}

type RiskIssue struct {
	Location    string
	Description string
	Severity    string
}

type DeferEntry struct {
	Name     string
	Position int
	Executed bool
}

type ExecutionState struct {
	step          int
	timeline      []*TimelineEvent
	deferStack    []*DeferEntry
	returnValue   interface{}
	panicValue    interface{}
	recovered     bool
	returnChanges []*ReturnChange
}

func Execute(cs *parser.Case, verbose, interactive bool) (*ExecutionResult, error) {
	state := &ExecutionState{
		timeline:   []*TimelineEvent{},
		deferStack: []*DeferEntry{},
	}

	result := &ExecutionResult{
		ExecutionID: generateID(),
		CaseName:    cs.Name,
		StartedAt:   time.Now(),
		Timeline:    state.timeline,
	}

	addEvent := func(eventType, desc string, details map[string]interface{}) {
		state.step++
		event := &TimelineEvent{
			Timestamp:   time.Now(),
			Step:        state.step,
			Type:        eventType,
			Description: desc,
			Details:     details,
		}
		state.timeline = append(state.timeline, event)

		if verbose {
			fmt.Printf("[%02d] %s: %s\n", state.step, eventType, desc)
		}

		if interactive {
			fmt.Print("按 Enter 继续...")
			fmt.Scanln()
		}
	}

	switch cs.Name {
	case "basic_defer":
		executeBasicDefer(state, addEvent)
		result.Status = StatusNormal

	case "multi_defer":
		executeMultiDefer(state, addEvent)
		result.Status = StatusNormal

	case "panic_recover":
		executePanicRecover(state, addEvent)
		result.Status = StatusRecovered
		result.Recovered = true

	case "named_return":
		executeNamedReturn(state, addEvent)
		result.Status = StatusNormal
		result.ReturnValue = 2

	case "nested_recover":
		executeNestedRecover(state, addEvent)
		result.Status = StatusRecovered
		result.Recovered = true

	case "double_panic":
		executeDoublePanic(state, addEvent)
		result.Status = StatusPanicked
		result.PanicValue = "第二个 panic"

	default:
		executeGeneric(state, addEvent, cs)
		result.Status = StatusNormal
	}

	result.CompletedAt = time.Now()
	result.Timeline = state.timeline
	result.ReturnValue = state.returnValue
	result.PanicValue = state.panicValue
	result.Recovered = state.recovered
	result.ReturnChanges = state.returnChanges

	deferStack := []string{}
	for _, d := range state.deferStack {
		if d.Executed {
			deferStack = append(deferStack, d.Name+" (已执行)")
		} else {
			deferStack = append(deferStack, d.Name)
		}
	}
	result.DeferStack = deferStack

	result.RiskAnalysis = analyzeRisk(cs, result)

	return result, nil
}

func executeBasicDefer(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	addEvent("DEFER_PUSH", "注册 defer fmt.Println(\"1 - 最后执行\")", map[string]interface{}{
		"function":     "fmt.Println",
		"message":      "1 - 最后执行",
		"stack_pos":    1,
		"total_so_far": 1,
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "defer1: fmt.Println(\"1 - 最后执行\")",
		Position: 1,
	})

	addEvent("DEFER_PUSH", "注册 defer fmt.Println(\"2 - 中间执行\")", map[string]interface{}{
		"function":     "fmt.Println",
		"message":      "2 - 中间执行",
		"stack_pos":    2,
		"total_so_far": 2,
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "defer2: fmt.Println(\"2 - 中间执行\")",
		Position: 2,
	})

	addEvent("NORMAL_EXEC", "执行 fmt.Println(\"3 - 最先执行\")", map[string]interface{}{
		"output": "3 - 最先执行",
	})

	addEvent("DEFER_EXEC_START", "开始执行 defer 栈（LIFO 顺序）", map[string]interface{}{
		"defer_count": len(state.deferStack),
		"order":       "后进先出",
	})

	for i := len(state.deferStack) - 1; i >= 0; i-- {
		d := state.deferStack[i]
		d.Executed = true
		addEvent("DEFER_EXEC", fmt.Sprintf("执行 %s", d.Name), map[string]interface{}{
			"position": d.Position,
			"order":    len(state.deferStack) - i,
		})
	}

	addEvent("FUNC_EXIT", "main 函数正常退出", map[string]interface{}{
		"status": "normal",
	})
}

func executeMultiDefer(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	funcs := []string{"defer1", "defer2", "defer3"}
	for i, fn := range funcs {
		pos := i + 1
		addEvent("DEFER_PUSH", fmt.Sprintf("注册 defer %s()", fn), map[string]interface{}{
			"function":     fn,
			"stack_pos":    pos,
			"total_so_far": pos,
		})
		state.deferStack = append(state.deferStack, &DeferEntry{
			Name:     fmt.Sprintf("defer%d: %s()", pos, fn),
			Position: pos,
		})
	}

	addEvent("NORMAL_EXEC", "执行 fmt.Println(\"main 执行中...\")", map[string]interface{}{
		"output": "main 执行中...",
	})

	addEvent("DEFER_EXEC_START", "开始执行 defer 栈", map[string]interface{}{
		"defer_count": 3,
		"order":       "LIFO (defer3 -> defer2 -> defer1)",
	})

	for i := len(state.deferStack) - 1; i >= 0; i-- {
		d := state.deferStack[i]
		d.Executed = true
		addEvent("DEFER_EXEC", fmt.Sprintf("执行 %s", d.Name), map[string]interface{}{
			"position": d.Position,
			"order":    len(state.deferStack) - i,
		})
	}

	addEvent("FUNC_EXIT", "main 函数正常退出", map[string]interface{}{
		"status": "normal",
	})
}

func executePanicRecover(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	addEvent("FUNC_CALL", "调用 safeCall()", map[string]interface{}{
		"callee": "safeCall",
	})

	addEvent("FUNC_ENTER", "进入 safeCall 函数", map[string]interface{}{
		"function": "safeCall",
	})

	addEvent("DEFER_PUSH", "注册 defer 匿名函数（包含 recover）", map[string]interface{}{
		"function":         "匿名闭包",
		"contains_recover": true,
		"stack_pos":        1,
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "defer1: 闭包（包含 recover）",
		Position: 1,
	})

	addEvent("NORMAL_EXEC", "执行 fmt.Println(\"开始执行...\")", map[string]interface{}{
		"output": "开始执行...",
	})

	addEvent("PANIC_TRIGGER", "panic(\"出现问题！\") 触发", map[string]interface{}{
		"panic_value": "出现问题！",
		"location":    "safeCall",
	})
	state.panicValue = "出现问题！"

	addEvent("PANIC_UNWIND", "开始栈展开，执行 defer", map[string]interface{}{
		"reason": "panic 触发",
	})

	for i := len(state.deferStack) - 1; i >= 0; i-- {
		d := state.deferStack[i]
		d.Executed = true

		addEvent("DEFER_EXEC", fmt.Sprintf("执行 %s", d.Name), map[string]interface{}{
			"position":         d.Position,
			"contains_recover": true,
		})

		addEvent("RECOVER_ATTEMPT", "在 defer 中调用 recover()", map[string]interface{}{
			"location":    "defer 闭包内",
			"can_recover": true,
		})

		addEvent("RECOVER_SUCCESS", "recover 成功捕获 panic", map[string]interface{}{
			"captured_value": "出现问题！",
			"location":       "safeCall 的 defer",
		})
		state.recovered = true
		state.panicValue = nil

		addEvent("RECOVER_EFFECT", "panic 被恢复，栈展开停止", map[string]interface{}{
			"current_function": "safeCall",
			"next_step":        "safeCall 正常返回，main 继续执行",
		})
	}

	addEvent("FUNC_EXIT", "safeCall 正常返回（因为已 recover）", map[string]interface{}{
		"status": "recovered",
	})

	addEvent("FUNC_RETURN", "safeCall 返回，main 继续执行", map[string]interface{}{
		"caller": "main",
	})

	addEvent("NORMAL_EXEC", "执行 fmt.Println(\"main 继续执行\")", map[string]interface{}{
		"output": "main 继续执行",
	})

	addEvent("FUNC_EXIT", "main 函数正常退出", map[string]interface{}{
		"status": "normal",
	})
}

func executeNamedReturn(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	addEvent("FUNC_CALL", "调用 namedReturn()", map[string]interface{}{
		"callee":      "namedReturn",
		"return_type": "(result int)",
	})

	addEvent("FUNC_ENTER", "进入 namedReturn 函数", map[string]interface{}{
		"function":     "namedReturn",
		"named_return": "result int",
	})

	state.returnValue = 0
	addEvent("RETURN_INIT", "命名返回值 result 初始化为 0", map[string]interface{}{
		"variable":      "result",
		"initial_value": 0,
	})

	addEvent("DEFER_PUSH", "注册 defer 匿名函数（修改返回值）", map[string]interface{}{
		"function":        "匿名闭包",
		"modifies_return": true,
		"stack_pos":       1,
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "defer1: result++",
		Position: 1,
	})

	addEvent("RETURN_SET", "执行 return 1，设置 result = 1", map[string]interface{}{
		"before": 0,
		"after":  1,
	})
	state.returnValue = 1
	state.returnChanges = append(state.returnChanges, &ReturnChange{
		Step:        state.step,
		Before:      0,
		After:       1,
		Description: "return 1 设置命名返回值",
	})

	addEvent("DEFER_EXEC_START", "执行 defer（在返回之前）", map[string]interface{}{
		"note": "命名返回值可以被 defer 修改",
	})

	for i := len(state.deferStack) - 1; i >= 0; i-- {
		d := state.deferStack[i]
		d.Executed = true

		addEvent("DEFER_EXEC", fmt.Sprintf("执行 %s", d.Name), map[string]interface{}{
			"position": d.Position,
			"action":   "result++",
		})

		old := state.returnValue.(int)
		state.returnValue = old + 1
		addEvent("RETURN_MODIFIED", "defer 修改命名返回值", map[string]interface{}{
			"before": old,
			"after":  state.returnValue,
			"who":    "defer",
		})
		state.returnChanges = append(state.returnChanges, &ReturnChange{
			Step:        state.step,
			Before:      old,
			After:       state.returnValue,
			Description: "defer 修改命名返回值",
		})
	}

	addEvent("RETURN_FINAL", "最终返回值", map[string]interface{}{
		"value":       state.returnValue,
		"explanation": "命名返回值先被 return 1 设置为 1，再被 defer 修改为 2",
	})

	addEvent("FUNC_EXIT", "namedReturn 返回 2", map[string]interface{}{
		"return_value": 2,
	})

	addEvent("FUNC_RETURN", "namedReturn 返回，main 打印结果", map[string]interface{}{
		"output": "2",
	})

	addEvent("FUNC_EXIT", "main 函数正常退出", map[string]interface{}{
		"status": "normal",
	})
}

func executeNestedRecover(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	addEvent("FUNC_CALL", "调用 outer()", map[string]interface{}{
		"callee": "outer",
	})

	addEvent("FUNC_ENTER", "进入 outer 函数", map[string]interface{}{
		"function": "outer",
	})

	addEvent("DEFER_PUSH", "注册 outer 的 defer（包含 recover）", map[string]interface{}{
		"function":         "outer 闭包",
		"contains_recover": true,
		"stack_pos":        1,
		"level":            "outer",
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "outer_defer: 包含 recover",
		Position: 1,
	})

	addEvent("FUNC_CALL", "调用 inner()", map[string]interface{}{
		"callee": "inner",
		"caller": "outer",
	})

	addEvent("FUNC_ENTER", "进入 inner 函数", map[string]interface{}{
		"function": "inner",
	})

	addEvent("DEFER_PUSH", "注册 inner 的 defer（没有 recover）", map[string]interface{}{
		"function":         "inner 闭包",
		"contains_recover": false,
		"stack_pos":        1,
		"level":            "inner",
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "inner_defer: 仅打印",
		Position: 2,
	})

	addEvent("PANIC_TRIGGER", "panic(\"inner panic\") 触发", map[string]interface{}{
		"panic_value": "inner panic",
		"location":    "inner",
	})
	state.panicValue = "inner panic"

	addEvent("PANIC_UNWIND", "开始栈展开，从 inner 到 outer", map[string]interface{}{
		"reason": "panic 触发",
		"start":  "inner",
	})

	addEvent("DEFER_EXEC", "执行 inner 的 defer（无 recover）", map[string]interface{}{
		"action":           "fmt.Println(\"inner defer\")",
		"contains_recover": false,
	})
	state.deferStack[1].Executed = true

	addEvent("PANIC_CONTINUE", "panic 继续向上传播", map[string]interface{}{
		"current_level": "inner 已退出",
		"next_level":    "outer",
	})

	addEvent("DEFER_EXEC", "执行 outer 的 defer（有 recover）", map[string]interface{}{
		"action":           "recover()",
		"contains_recover": true,
	})
	state.deferStack[0].Executed = true

	addEvent("RECOVER_ATTEMPT", "在 outer 的 defer 中调用 recover()", map[string]interface{}{
		"location":    "outer 的 defer",
		"can_recover": true,
	})

	addEvent("RECOVER_SUCCESS", "recover 成功捕获 panic", map[string]interface{}{
		"captured_value": "inner panic",
		"location":       "outer 的 defer",
	})
	state.recovered = true
	state.panicValue = nil

	addEvent("RECOVER_EFFECT", "panic 被恢复，栈展开停止", map[string]interface{}{
		"current_function": "outer",
		"next_step":        "outer 正常返回，main 继续",
	})

	addEvent("FUNC_EXIT", "outer 正常返回", map[string]interface{}{
		"status": "recovered",
	})

	addEvent("FUNC_RETURN", "outer 返回，main 继续", map[string]interface{}{
		"output": "main 继续执行",
	})

	addEvent("FUNC_EXIT", "main 函数正常退出", map[string]interface{}{
		"status": "normal",
	})
}

func executeDoublePanic(state *ExecutionState, addEvent func(string, string, map[string]interface{})) {
	addEvent("FUNC_ENTER", "进入 main 函数", map[string]interface{}{
		"function": "main",
	})

	addEvent("DEFER_PUSH", "注册第一个 defer（后注册，最后执行）", map[string]interface{}{
		"function":  "闭包 A",
		"action":    "panic(\"第二个 panic\")",
		"stack_pos": 1,
		"note":      "LIFO，最后执行",
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "deferA: panic(\"第二个 panic\")",
		Position: 1,
	})

	addEvent("DEFER_PUSH", "注册第二个 defer（先注册，先执行）", map[string]interface{}{
		"function":         "闭包 B",
		"action":           "recover 后 panic",
		"contains_recover": true,
		"stack_pos":        2,
		"note":             "LIFO，先执行",
	})
	state.deferStack = append(state.deferStack, &DeferEntry{
		Name:     "deferB: recover + panic(\"第一个 defer 内的 panic\")",
		Position: 2,
	})

	addEvent("PANIC_TRIGGER", "panic(\"初始 panic\") 触发", map[string]interface{}{
		"panic_value": "初始 panic",
		"location":    "main",
	})
	state.panicValue = "初始 panic"

	addEvent("PANIC_UNWIND", "开始栈展开，执行 defer", map[string]interface{}{
		"current_panic": "初始 panic",
		"defer_order":   "LIFO: deferB -> deferA",
	})

	addEvent("DEFER_EXEC", "执行 deferB（包含 recover）", map[string]interface{}{
		"position":         2,
		"contains_recover": true,
	})
	state.deferStack[1].Executed = true

	addEvent("RECOVER_ATTEMPT", "deferB 中调用 recover()", map[string]interface{}{
		"location": "deferB",
	})

	addEvent("RECOVER_SUCCESS", "recover 捕获 \"初始 panic\"", map[string]interface{}{
		"captured_value": "初始 panic",
	})
	state.recovered = true
	state.panicValue = nil

	addEvent("PANIC_TRIGGER", "deferB 内又触发新 panic", map[string]interface{}{
		"panic_value": "第一个 defer 内的 panic",
		"location":    "deferB",
		"note":        "这是新的 panic，会覆盖之前恢复的状态",
	})
	state.panicValue = "第一个 defer 内的 panic"
	state.recovered = false

	addEvent("PANIC_CONTINUE", "新 panic 继续传播", map[string]interface{}{
		"current_panic": "第一个 defer 内的 panic",
		"next_defer":    "deferA",
	})

	addEvent("DEFER_EXEC", "执行 deferA（也会 panic）", map[string]interface{}{
		"position": 1,
		"action":   "panic(\"第二个 panic\")",
	})
	state.deferStack[0].Executed = true

	addEvent("PANIC_TRIGGER", "deferA 再次触发 panic", map[string]interface{}{
		"panic_value": "第二个 panic",
		"location":    "deferA",
		"note":        "覆盖之前的 panic",
	})
	state.panicValue = "第二个 panic"

	addEvent("PANIC_FINAL", "程序崩溃，最终 panic", map[string]interface{}{
		"final_panic": "第二个 panic",
		"reason":      "defer 中产生的新 panic 会覆盖旧的 panic",
		"danger":      "这是高风险场景：defer 中的 panic 可能掩盖原始错误",
	})

	addEvent("FUNC_CRASH", "程序崩溃", map[string]interface{}{
		"final_panic_value": "第二个 panic",
		"status":            "panicked",
	})
}

func executeGeneric(state *ExecutionState, addEvent func(string, string, map[string]interface{}), cs *parser.Case) {
	addEvent("FUNC_ENTER", fmt.Sprintf("进入用例: %s", cs.Name), map[string]interface{}{
		"description": cs.Description,
		"snippet":     cs.Snippet,
	})

	addEvent("GENERIC_EXEC", "通用执行模式", map[string]interface{}{
		"note": "此用例使用通用模拟，请查看 snippet 了解详情",
	})

	addEvent("FUNC_EXIT", "用例执行完成", map[string]interface{}{
		"status": "normal",
	})
}

func analyzeRisk(cs *parser.Case, result *ExecutionResult) *RiskAnalysis {
	analysis := &RiskAnalysis{
		Level:       "low",
		Description: "风险分析",
		Issues:      []*RiskIssue{},
		Suggestions: []string{},
	}

	hasPanic := false
	hasRecover := false
	hasDoublePanic := false
	hasNamedReturn := false

	for _, event := range result.Timeline {
		switch event.Type {
		case "PANIC_TRIGGER":
			hasPanic = true
		case "RECOVER_SUCCESS", "RECOVER_ATTEMPT":
			hasRecover = true
		case "PANIC_FINAL":
			if v, ok := event.Details["danger"]; ok && v != "" {
				hasDoublePanic = true
			}
		case "RETURN_MODIFIED":
			hasNamedReturn = true
		}
	}

	if hasDoublePanic {
		analysis.Level = "high"
		analysis.Issues = append(analysis.Issues, &RiskIssue{
			Location:    "defer 函数",
			Description: "defer 中产生 panic 会覆盖之前的 panic，导致原始错误信息丢失",
			Severity:    "high",
		})
		analysis.Suggestions = append(analysis.Suggestions,
			"defer 中避免产生新的 panic",
			"如果必须在 defer 中操作可能 panic 的代码，务必在 defer 内部也使用 recover",
			"保存原始 panic 信息，不要让新的 panic 覆盖它",
		)
	}

	if hasPanic && !hasRecover {
		analysis.Level = "high"
		analysis.Issues = append(analysis.Issues, &RiskIssue{
			Location:    "函数调用链",
			Description: "存在 panic 但没有对应的 recover，程序会崩溃",
			Severity:    "high",
		})
		analysis.Suggestions = append(analysis.Suggestions,
			"在可能 panic 的上层函数中添加 defer recover",
			"考虑使用错误返回值替代 panic（在库代码中）",
		)
	}

	if hasNamedReturn {
		if analysis.Level == "low" {
			analysis.Level = "medium"
		}
		analysis.Issues = append(analysis.Issues, &RiskIssue{
			Location:    "命名返回值",
			Description: "defer 可以修改命名返回值，这可能导致意外的行为",
			Severity:    "medium",
		})
		analysis.Suggestions = append(analysis.Suggestions,
			"明确理解命名返回值与 defer 的交互顺序",
			"return 语句先设置返回值，然后执行 defer",
			"defer 可以修改命名返回值，最终返回修改后的值",
		)
	}

	if result.Status == StatusRecovered {
		analysis.Suggestions = append(analysis.Suggestions,
			"recover 只在 defer 函数中有效",
			"recover 捕获 panic 后，程序继续执行",
			"如果 defer 中没有 recover，panic 会继续向上传播",
		)
	}

	if len(analysis.Issues) == 0 {
		analysis.Description = "未检测到明显风险"
	} else {
		analysis.Description = fmt.Sprintf("检测到 %d 个潜在风险点", len(analysis.Issues))
	}

	return analysis
}

func generateID() string {
	id := uuid.New()
	return id.String()[:8]
}
