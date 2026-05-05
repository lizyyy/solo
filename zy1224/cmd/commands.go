package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"deferpanic/pkg/executor"
	"deferpanic/pkg/parser"
	"deferpanic/pkg/report"
	"deferpanic/pkg/storage"
)

type Context struct {
	// 可用于在命令间共享状态
}

type InitCmd struct {
	Force bool `help:"强制覆盖现有文件。" short:"f"`
}

func (c *InitCmd) Run(_ *Context) error {
	fmt.Println("初始化 deferpanic 工作目录...")

	dirs := []string{"snippets", ".deferpanic"}
	for _, dir := range dirs {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return fmt.Errorf("创建目录 %s 失败: %w", dir, err)
		}
	}

	casesPath := "cases.yaml"
	if _, err := os.Stat(casesPath); os.IsNotExist(err) || c.Force {
		if err := os.WriteFile(casesPath, []byte(defaultCases), 0644); err != nil {
			return fmt.Errorf("创建 cases.yaml 失败: %w", err)
		}
		fmt.Println("✓ 创建 cases.yaml")
	} else {
		fmt.Println("✓ 跳过 cases.yaml (已存在)")
	}

	eventsPath := "events.jsonl"
	if _, err := os.Stat(eventsPath); os.IsNotExist(err) || c.Force {
		if err := os.WriteFile(eventsPath, []byte(defaultEvents), 0644); err != nil {
			return fmt.Errorf("创建 events.jsonl 失败: %w", err)
		}
		fmt.Println("✓ 创建 events.jsonl")
	} else {
		fmt.Println("✓ 跳过 events.jsonl (已存在)")
	}

	snippets := []struct {
		name    string
		content string
	}{
		{"basic_defer.go", snippetBasicDefer},
		{"multi_defer.go", snippetMultiDefer},
		{"panic_recover.go", snippetPanicRecover},
		{"named_return.go", snippetNamedReturn},
		{"nested_recover.go", snippetNestedRecover},
		{"double_panic.go", snippetDoublePanic},
	}

	for _, s := range snippets {
		path := filepath.Join("snippets", s.name)
		if _, err := os.Stat(path); os.IsNotExist(err) || c.Force {
			if err := os.WriteFile(path, []byte(s.content), 0644); err != nil {
				return fmt.Errorf("创建 %s 失败: %w", path, err)
			}
			fmt.Printf("✓ 创建 snippets/%s\n", s.name)
		} else {
			fmt.Printf("✓ 跳过 snippets/%s (已存在)\n", s.name)
		}
	}

	dbPath := filepath.Join(".deferpanic", "analysis.db")
	if err := storage.InitDB(dbPath); err != nil {
		return fmt.Errorf("初始化数据库失败: %w", err)
	}
	fmt.Println("✓ 初始化分析数据库")

	fmt.Println("\n初始化完成！使用 `deferpanic replay` 开始分析。")
	return nil
}

type ReplayCmd struct {
	Case        string `help:"指定要重放的用例名称。" short:"c"`
	Verbose     bool   `help:"显示详细执行过程。" short:"v"`
	Interactive bool   `help:"交互式模式，逐步执行。" short:"i"`
}

func (c *ReplayCmd) Run(_ *Context) error {
	cases, err := parser.ParseCases("cases.yaml")
	if err != nil {
		return fmt.Errorf("解析用例失败: %w", err)
	}

	events, err := parser.ParseEvents("events.jsonl")
	if err != nil {
		return fmt.Errorf("解析事件失败: %w", err)
	}

	dbPath := filepath.Join(".deferpanic", "analysis.db")
	db, err := storage.OpenDB(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer db.Close()

	targetCases := []*parser.Case{}
	if c.Case != "" {
		for _, cs := range cases {
			if cs.Name == c.Case {
				targetCases = append(targetCases, cs)
				break
			}
		}
		if len(targetCases) == 0 {
			return fmt.Errorf("未找到用例: %s", c.Case)
		}
	} else {
		targetCases = cases
	}

	for _, cs := range targetCases {
		fmt.Printf("\n========================================\n")
		fmt.Printf("重放用例: %s\n", cs.Name)
		fmt.Printf("========================================\n")

		result, err := executor.Execute(cs, c.Verbose, c.Interactive)
		if err != nil {
			return fmt.Errorf("执行用例 %s 失败: %w", cs.Name, err)
		}

		fmt.Printf("\n执行结果:\n")
		fmt.Printf("  状态: %s\n", result.Status)
		if result.ReturnValue != nil {
			fmt.Printf("  返回值: %v\n", result.ReturnValue)
		}
		if result.PanicValue != nil {
			fmt.Printf("  Panic: %v\n", result.PanicValue)
		}
		if result.Recovered {
			fmt.Printf("  已恢复: 是\n")
		}

		execData := &storage.ExecutionData{
			ID:          result.ExecutionID,
			CaseName:    result.CaseName,
			Status:      string(result.Status),
			ReturnValue: result.ReturnValue,
			PanicValue:  result.PanicValue,
			Recovered:   result.Recovered,
			DeferStack:  result.DeferStack,
			Timeline:    result.Timeline,
			StartedAt:   result.StartedAt,
			CompletedAt: result.CompletedAt,
		}
		if result.RiskAnalysis != nil {
			execData.RiskLevel = result.RiskAnalysis.Level
			execData.Risk = result.RiskAnalysis
		}

		if err := storage.SaveExecution(db, execData); err != nil {
			return fmt.Errorf("保存执行记录失败: %w", err)
		}
		fmt.Printf("✓ 已保存到数据库 (ID: %s)\n", result.ExecutionID)
	}

	// 存储事件（如果有）
	for _, event := range events {
		eventData := &storage.EventData{
			Timestamp: event.Timestamp,
			EventType: event.EventType,
			CaseName:  event.CaseName,
			Details:   event.Details,
		}
		if err := storage.SaveEvent(db, eventData); err != nil {
			fmt.Printf("警告: 保存事件失败: %v\n", err)
		}
	}

	return nil
}

type CompareCmd struct {
	First  string `help:"第一个执行记录的 ID。" arg:"" required:""`
	Second string `help:"第二个执行记录的 ID。" arg:"" required:""`
	Output string `help:"输出格式: table/json。" short:"o" default:"table"`
}

func (c *CompareCmd) Run(_ *Context) error {
	dbPath := filepath.Join(".deferpanic", "analysis.db")
	db, err := storage.OpenDB(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer db.Close()

	exec1, err := storage.GetExecution(db, c.First)
	if err != nil {
		return fmt.Errorf("获取执行记录 %s 失败: %w", c.First, err)
	}

	exec2, err := storage.GetExecution(db, c.Second)
	if err != nil {
		return fmt.Errorf("获取执行记录 %s 失败: %w", c.Second, err)
	}

	diff := report.CompareExecutions(exec1, exec2)
	if c.Output == "json" {
		jsonStr, err := report.ToJSON(diff)
		if err != nil {
			return err
		}
		fmt.Println(jsonStr)
	} else {
		report.PrintDiffTable(diff)
	}

	return nil
}

type ExportCmd struct {
	ExecutionID string `help:"执行记录 ID，不指定则导出全部。" short:"e"`
	Format      string `help:"导出格式: markdown/json。" short:"f" default:"markdown"`
	Output      string `help:"输出文件路径。" short:"o"`
	IncludeRisk bool   `help:"包含风险分析和修复建议。" short:"r"`
}

func (c *ExportCmd) Run(_ *Context) error {
	dbPath := filepath.Join(".deferpanic", "analysis.db")
	db, err := storage.OpenDB(dbPath)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer db.Close()

	var executions []*storage.ExecutionRecord
	if c.ExecutionID != "" {
		exec, err := storage.GetExecution(db, c.ExecutionID)
		if err != nil {
			return fmt.Errorf("获取执行记录失败: %w", err)
		}
		executions = []*storage.ExecutionRecord{exec}
	} else {
		executions, err = storage.GetAllExecutions(db)
		if err != nil {
			return fmt.Errorf("获取执行记录列表失败: %w", err)
		}
	}

	if len(executions) == 0 {
		fmt.Println("没有找到执行记录，请先运行 `deferpanic replay`。")
		return nil
	}

	var content string
	if c.Format == "json" {
		content, err = report.ExportJSON(executions, c.IncludeRisk)
	} else {
		content, err = report.ExportMarkdown(executions, c.IncludeRisk)
	}

	if err != nil {
		return fmt.Errorf("生成报告失败: %w", err)
	}

	if c.Output != "" {
		if err := os.WriteFile(c.Output, []byte(content), 0644); err != nil {
			return fmt.Errorf("写入文件失败: %w", err)
		}
		fmt.Printf("✓ 报告已导出到: %s\n", c.Output)
	} else {
		fmt.Println(content)
	}

	return nil
}

const defaultCases = `# deferpanic 分析用例
# 每个用例描述一个 defer/panic/recover 场景

cases:
  - name: basic_defer
    description: 基础 defer 执行顺序
    snippet: snippets/basic_defer.go
    expected_return:
      type: int
      value: 0
    expected_status: normal

  - name: multi_defer
    description: 多个 defer 的 LIFO 执行顺序
    snippet: snippets/multi_defer.go
    expected_return:
      type: int
      value: 0
    expected_status: normal

  - name: panic_recover
    description: panic 后 recover 恢复
    snippet: snippets/panic_recover.go
    expected_return:
      type: int
      value: 0
    expected_status: recovered

  - name: named_return
    description: defer 修改命名返回值
    snippet: snippets/named_return.go
    expected_return:
      type: int
      value: 2
    expected_status: normal

  - name: nested_recover
    description: 嵌套 recover 场景
    snippet: snippets/nested_recover.go
    expected_status: recovered

  - name: double_panic
    description: 二次 panic 覆盖问题
    snippet: snippets/double_panic.go
    expected_status: panicked
    risk_level: high
`

const defaultEvents = `{"timestamp": "2024-01-15T10:00:00Z", "event_type": "case_start", "case_name": "basic_defer", "details": {"snippet": "snippets/basic_defer.go"}}
{"timestamp": "2024-01-15T10:00:01Z", "event_type": "defer_push", "details": {"function": "defer1", "position": 1}}
{"timestamp": "2024-01-15T10:00:02Z", "event_type": "defer_push", "details": {"function": "defer2", "position": 2}}
{"timestamp": "2024-01-15T10:00:03Z", "event_type": "defer_exec", "details": {"function": "defer2", "order": 1}}
{"timestamp": "2024-01-15T10:00:04Z", "event_type": "defer_exec", "details": {"function": "defer1", "order": 2}}
{"timestamp": "2024-01-15T10:00:05Z", "event_type": "case_end", "case_name": "basic_defer", "details": {"status": "completed"}}
`

const snippetBasicDefer = `package main

import "fmt"

func main() {
	defer fmt.Println("1 - 最后执行")
	defer fmt.Println("2 - 中间执行")
	fmt.Println("3 - 最先执行")
}

// 预期输出:
// 3 - 最先执行
// 2 - 中间执行
// 1 - 最后执行
`

const snippetMultiDefer = `package main

import "fmt"

func defer1() { fmt.Println("defer1") }
func defer2() { fmt.Println("defer2") }
func defer3() { fmt.Println("defer3") }

func main() {
	defer defer1()
	defer defer2()
	defer defer3()
	
	fmt.Println("main 执行中...")
}

// 预期输出:
// main 执行中...
// defer3
// defer2
// defer1
`

const snippetPanicRecover = `package main

import "fmt"

func safeCall() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("恢复:", r)
		}
	}()
	
	fmt.Println("开始执行...")
	panic("出现问题！")
	fmt.Println("这行不会执行")
}

func main() {
	safeCall()
	fmt.Println("main 继续执行")
}

// 预期输出:
// 开始执行...
// 恢复: 出现问题！
// main 继续执行
`

const snippetNamedReturn = `package main

import "fmt"

func namedReturn() (result int) {
	defer func() {
		result++ // 修改命名返回值
	}()
	
	return 1 // 先赋值 result=1，然后执行 defer
}

func main() {
	fmt.Println(namedReturn()) // 输出: 2
}

// 关键点:
// 1. 执行 return 1 时，先将 result 设置为 1
// 2. 然后执行 defer，result 增加到 2
// 3. 最后返回 result
`

const snippetNestedRecover = `package main

import "fmt"

func outer() {
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("外层恢复:", r)
		}
	}()
	
	inner()
	fmt.Println("outer 继续")
}

func inner() {
	defer func() {
		// 内层没有 recover
		fmt.Println("inner defer")
	}()
	
	panic("inner panic")
	fmt.Println("inner 继续")
}

func main() {
	outer()
	fmt.Println("main 继续")
}

// 预期输出:
// inner defer
// 外层恢复: inner panic
// main 继续
`

const snippetDoublePanic = `package main

import "fmt"

func main() {
	defer func() {
		// 这个 defer 也会 panic，覆盖之前的 panic
		panic("第二个 panic")
	}()
	
	defer func() {
		// 尝试恢复
		if r := recover(); r != nil {
			fmt.Println("恢复:", r)
			// 但这里又 panic 了
			panic("第一个 defer 内的 panic")
		}
	}()
	
	panic("初始 panic")
}

// 关键点:
// 1. panic 触发后，按 LIFO 执行 defer
// 2. 第二个 defer (先注册的) 尝试 recover，成功
// 3. 但 recover 后又 panic，这是新的 panic
// 4. 继续执行剩余的 defer (第一个 defer)
// 5. 第一个 defer 再次 panic，覆盖之前的 panic
// 最终程序崩溃，显示最后一个 panic: "第二个 panic"
`
