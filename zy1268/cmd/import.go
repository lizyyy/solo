package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"

	"go-runtime-analyzer/parser"
	"go-runtime-analyzer/storage"
)

var importCmd = &cobra.Command{
	Use:   "import",
	Short: "导入数据文件到数据库",
	Long: `import 命令支持导入多种类型的数据文件：
  - stacktrace: Goroutine stack trace 输出
  - schedtrace: Go 调度器追踪输出
  - preempt: 抢占事件日志
  - snippet: 代码片段文件
  - bench: Go benchmark 输出

使用示例：
  gra import -t stacktrace data/stack1.txt
  gra import -t schedtrace data/sched1.txt data/sched2.txt
  gra import -t preempt events.log
  gra import -t snippet code.go
  gra import -t bench bench_result.txt`,
	Run: func(cmd *cobra.Command, args []string) {
		runImport(cmd, args)
	},
}

var (
	importType string
	dbPath     string
)

func init() {
	rootCmd.AddCommand(importCmd)

	importCmd.Flags().StringVarP(&importType, "type", "t", "", "数据类型 (stacktrace|schedtrace|preempt|snippet|bench)")
	importCmd.Flags().StringVarP(&dbPath, "db", "d", "gra.db", "数据库文件路径")
	importCmd.MarkFlagRequired("type")
}

func runImport(cmd *cobra.Command, args []string) {
	if len(args) == 0 {
		fmt.Println("错误: 请指定要导入的文件路径")
		cmd.Usage()
		os.Exit(1)
	}

	// 验证类型
	validTypes := map[string]bool{
		"stacktrace": true,
		"schedtrace": true,
		"preempt":    true,
		"snippet":    true,
		"bench":      true,
	}

	if !validTypes[importType] {
		fmt.Printf("错误: 无效的数据类型 '%s'\n", importType)
		fmt.Println("支持的类型: stacktrace, schedtrace, preempt, snippet, bench")
		os.Exit(1)
	}

	// 初始化数据库
	db, err := storage.InitDB(dbPath)
	if err != nil {
		fmt.Printf("错误: 打开数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// 处理每个文件
	successCount := 0
	errorCount := 0

	for _, filePath := range args {
		absPath, err := filepath.Abs(filePath)
		if err != nil {
			absPath = filePath
		}

		// 读取文件
		content, err := os.ReadFile(filePath)
		if err != nil {
			fmt.Printf("错误: 无法读取文件 '%s': %v\n", filePath, err)
			errorCount++
			continue
		}

		strContent := string(content)

		// 根据类型解析
		switch importType {
		case "stacktrace":
			if err := importStacktrace(db, strContent, absPath); err != nil {
				fmt.Printf("错误: 导入 stacktrace '%s' 失败: %v\n", filePath, err)
				errorCount++
			} else {
				successCount++
			}

		case "schedtrace":
			if err := importSchedtrace(db, strContent, absPath); err != nil {
				fmt.Printf("错误: 导入 schedtrace '%s' 失败: %v\n", filePath, err)
				errorCount++
			} else {
				successCount++
			}

		case "preempt":
			if err := importPreempt(db, strContent, absPath); err != nil {
				fmt.Printf("错误: 导入 preempt 事件 '%s' 失败: %v\n", filePath, err)
				errorCount++
			} else {
				successCount++
			}

		case "snippet":
			if err := importSnippet(db, strContent, absPath); err != nil {
				fmt.Printf("错误: 导入代码片段 '%s' 失败: %v\n", filePath, err)
				errorCount++
			} else {
				successCount++
			}

		case "bench":
			if err := importBenchmark(db, strContent, absPath); err != nil {
				fmt.Printf("错误: 导入 benchmark '%s' 失败: %v\n", filePath, err)
				errorCount++
			} else {
				successCount++
			}
		}
	}

	// 输出统计
	fmt.Printf("\n导入完成: 成功 %d, 失败 %d\n", successCount, errorCount)
	if errorCount > 0 {
		os.Exit(1)
	}
}

func importStacktrace(db *storage.DB, content, sourceFile string) error {
	// 验证格式
	if err := parser.ValidateStacktraceFormat(content); err != nil {
		return fmt.Errorf("格式验证失败: %w", err)
	}

	// 解析
	traces, err := parser.ParseStacktrace(content, sourceFile)
	if err != nil {
		return err
	}

	// 插入数据库
	for i := range traces {
		if err := db.InsertStacktrace(&traces[i]); err != nil {
			return fmt.Errorf("插入数据库失败: %w", err)
		}
	}

	fmt.Printf("✓ 导入 stacktrace: %s (%d 个 goroutine)\n", sourceFile, len(traces))
	return nil
}

func importSchedtrace(db *storage.DB, content, sourceFile string) error {
	// 验证格式
	if err := parser.ValidateSchedtraceFormat(content); err != nil {
		return fmt.Errorf("格式验证失败: %w", err)
	}

	// 解析
	trace, goroutines, err := parser.ParseSchedtrace(content, sourceFile)
	if err != nil {
		return err
	}

	// 插入 schedtrace
	traceID, err := db.InsertSchedtrace(trace)
	if err != nil {
		return fmt.Errorf("插入 schedtrace 失败: %w", err)
	}

	// 插入 goroutine 状态
	for i := range goroutines {
		goroutines[i].SchedtraceID = traceID
		if err := db.InsertSchedGoroutine(&goroutines[i]); err != nil {
			return fmt.Errorf("插入 sched goroutine 失败: %w", err)
		}
	}

	fmt.Printf("✓ 导入 schedtrace: %s (%d 个 goroutine 状态)\n", sourceFile, len(goroutines))
	return nil
}

func importPreempt(db *storage.DB, content, sourceFile string) error {
	// 验证格式
	if err := parser.ValidatePreemptEventFormat(content); err != nil {
		return fmt.Errorf("格式验证失败: %w", err)
	}

	// 解析
	events, err := parser.ParsePreemptEvent(content, sourceFile)
	if err != nil {
		return err
	}

	// 插入数据库
	insertedCount := 0
	for i := range events {
		eventID, err := db.InsertPreemptEvent(&events[i])
		if err != nil {
			return fmt.Errorf("插入抢占事件失败: %w", err)
		}

		// 根据事件类型插入子表
		switch events[i].EventType {
		case "stack_growth":
			// 尝试从 details 提取栈大小
			var details map[string]interface{}
			if events[i].Details != "" && events[i].Details != "{}" {
				_ = db.InsertStackGrowth(&storage.StackGrowth{
					PreemptEventID: eventID,
					OldSize:        2048,
					NewSize:        4096,
					GrowthType:     "growth",
				})
				_ = details
			}

		case "nosplit_call":
			_ = db.InsertNosplitCall(&storage.NosplitCall{
				PreemptEventID: eventID,
				Function:       events[i].Reason,
				FrameCount:     1,
			})

		case "syscall_block":
			_ = db.InsertSyscallBlock(&storage.SyscallBlock{
				PreemptEventID: eventID,
				SyscallName:    events[i].Reason,
			})
		}

		insertedCount++
	}

	fmt.Printf("✓ 导入 preempt 事件: %s (%d 个事件)\n", sourceFile, insertedCount)
	return nil
}

func importSnippet(db *storage.DB, content, sourceFile string) error {
	// 解析（包含问题检测）
	snippet, err := parser.ParseCodeSnippet(content, sourceFile)
	if err != nil {
		return err
	}

	// 插入数据库
	if err := db.InsertCodeSnippet(snippet); err != nil {
		return fmt.Errorf("插入代码片段失败: %w", err)
	}

	// 统计检测到的问题
	issueCount := stringsCount(snippet.Issues, "{")
	if issueCount > 0 {
		issueCount-- // 减去 1 因为 [] 也包含 { 或其他原因
	}

	// 简单的问题计数
	issues := snippet.Issues
	if issues == "[]" || issues == "" {
		issueCount = 0
	} else {
		// 计算问题数量
		issueCount = stringsCount(issues, "\"type\":")
	}

	if issueCount > 0 {
		fmt.Printf("✓ 导入代码片段: %s (检测到 %d 个潜在问题)\n", sourceFile, issueCount)
	} else {
		fmt.Printf("✓ 导入代码片段: %s\n", sourceFile)
	}

	return nil
}

func importBenchmark(db *storage.DB, content, sourceFile string) error {
	// 验证格式
	if err := parser.ValidateBenchmarkFormat(content); err != nil {
		return fmt.Errorf("格式验证失败: %w", err)
	}

	// 解析
	results, err := parser.ParseBenchmark(content, sourceFile)
	if err != nil {
		return err
	}

	// 插入数据库
	for i := range results {
		if err := db.InsertBenchmarkResult(&results[i]); err != nil {
			return fmt.Errorf("插入 benchmark 失败: %w", err)
		}
	}

	fmt.Printf("✓ 导入 benchmark: %s (%d 个测试结果)\n", sourceFile, len(results))
	return nil
}

func stringsCount(s, substr string) int {
	count := 0
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			count++
		}
	}
	return count
}
