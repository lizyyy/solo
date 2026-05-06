package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"

	"go-runtime-analyzer/analyzer"
	"go-runtime-analyzer/storage"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析已导入的数据",
	Long: `analyze 命令对数据库中的所有数据进行综合分析，
包括栈增长、抢占事件、调度状态、代码问题和 benchmark 趋势。

分析内容：
  - 栈增长/收缩统计
  - 抢占事件分析（异步抢占、栈增长、nosplit、syscall）
  - 调度器状态分析
  - 延迟尖刺检测
  - 代码问题汇总
  - Benchmark 趋势
  - 优化建议

使用示例：
  gra analyze
  gra analyze --stack-threshold 2048 --latency-threshold 50
  gra analyze -d mydata.db`,
	Run: func(cmd *cobra.Command, args []string) {
		runAnalyze()
	},
}

var (
	analyzeDBPath      string
	stackThresholdKB   int64
	latencyThresholdUS int64
	syscallThresholdUS int64
)

func init() {
	rootCmd.AddCommand(analyzeCmd)

	analyzeCmd.Flags().StringVarP(&analyzeDBPath, "db", "d", "gra.db", "数据库文件路径")
	analyzeCmd.Flags().Int64Var(&stackThresholdKB, "stack-threshold", 1024, "栈大小警告阈值 (KB)")
	analyzeCmd.Flags().Int64Var(&latencyThresholdUS, "latency-threshold", 100, "普通延迟警告阈值 (µs)")
	analyzeCmd.Flags().Int64Var(&syscallThresholdUS, "syscall-threshold", 1000, "高延迟警告阈值 (µs)")
}

func runAnalyze() {
	// 打开数据库
	db, err := storage.InitDB(analyzeDBPath)
	if err != nil {
		fmt.Printf("错误: 打开数据库失败: %v\n", err)
		os.Exit(1)
	}
	defer db.Close()

	// 检查是否有数据
	stackCount, _ := db.CountStacktraces()
	preemptCount, _ := db.CountPreemptEvents()
	schedCount, _ := db.CountSchedtraces()
	benchCount, _ := db.CountBenchmarks()
	snippetCount, _ := db.CountSnippets()

	totalData := stackCount + preemptCount + schedCount + benchCount + snippetCount
	if totalData == 0 {
		fmt.Println("警告: 数据库中没有数据。请先使用 'gra import' 命令导入数据。")
		fmt.Println("\n使用示例:")
		fmt.Println("  gra import -t stacktrace data/stacktraces/sample1.txt")
		fmt.Println("  gra import -t schedtrace data/schedtraces/sample1.txt")
		os.Exit(0)
	}

	// 显示数据概览
	fmt.Println("=== 数据概览 ===")
	fmt.Printf("Stacktrace:   %d 条\n", stackCount)
	fmt.Printf("抢占事件:     %d 条\n", preemptCount)
	fmt.Printf("Schedtrace:   %d 条\n", schedCount)
	fmt.Printf("Benchmark:    %d 条\n", benchCount)
	fmt.Printf("代码片段:     %d 条\n", snippetCount)
	fmt.Println()

	// 创建分析器
	config := &analyzer.AnalysisConfig{
		StackThresholdKB:     stackThresholdKB,
		LatencyThresholdUS:   latencyThresholdUS,
		HighSyscallThreshold: syscallThresholdUS,
	}

	an := analyzer.NewAnalyzer(db, config)

	// 执行分析
	fmt.Println("正在分析...")
	result, err := an.Analyze()
	if err != nil {
		fmt.Printf("错误: 分析失败: %v\n", err)
		os.Exit(1)
	}

	// 输出摘要
	fmt.Println("\n=== 分析结果摘要 ===")

	// 栈分析
	fmt.Println("\n[栈分析]")
	fmt.Printf("  栈增长事件:   %d 次\n", result.StackAnalysis.TotalGrowthEvents)
	fmt.Printf("  栈收缩事件:   %d 次\n", result.StackAnalysis.TotalShrinkEvents)
	fmt.Printf("  最大栈大小:   %d 字节 (%.2f KB)\n", result.StackAnalysis.LargestStackSize, float64(result.StackAnalysis.LargestStackSize)/1024)
	if result.StackAnalysis.StacksOverThreshold > 0 {
		fmt.Printf("  ⚠ 超过阈值:   %d 个 (阈值: %d KB)\n", result.StackAnalysis.StacksOverThreshold, stackThresholdKB)
	}

	// 抢占分析
	fmt.Println("\n[抢占分析]")
	fmt.Printf("  异步抢占:     %d 次\n", result.PreemptAnalysis.TotalAsyncPreempts)
	fmt.Printf("  栈增长:       %d 次\n", result.PreemptAnalysis.TotalStackGrowths)
	fmt.Printf("  Nosplit:      %d 次\n", result.PreemptAnalysis.TotalNosplitCalls)
	fmt.Printf("  Syscall阻塞:  %d 次\n", result.PreemptAnalysis.TotalSyscallBlocks)
	fmt.Printf("  平均延迟:     %d µs\n", result.PreemptAnalysis.AveragePreemptLatency)
	fmt.Printf("  最大延迟:     %d µs\n", result.PreemptAnalysis.MaxPreemptLatency)

	// 调度分析
	fmt.Println("\n[调度分析]")
	fmt.Printf("  平均 RunQueue: %.1f\n", result.SchedAnalysis.AverageRunQueue)
	fmt.Printf("  最大 RunQueue: %d\n", result.SchedAnalysis.MaxRunQueue)
	fmt.Printf("  平均 GOMAXPROCS: %.1f\n", result.SchedAnalysis.AverageGOMAXPROCS)

	// 延迟分析
	fmt.Println("\n[延迟分析]")
	fmt.Printf("  总延迟:       %d µs (%.2f ms)\n", result.LatencyAnalysis.TotalLatencyUS, float64(result.LatencyAnalysis.TotalLatencyUS)/1000)
	fmt.Printf("  平均延迟:     %d µs\n", result.LatencyAnalysis.AverageLatencyUS)
	fmt.Printf("  最大延迟:     %d µs (%.2f ms)\n", result.LatencyAnalysis.MaxLatencyUS, float64(result.LatencyAnalysis.MaxLatencyUS)/1000)
	if len(result.LatencyAnalysis.LatencySpikes) > 0 {
		fmt.Printf("  ⚠ 延迟尖刺:   %d 个\n", len(result.LatencyAnalysis.LatencySpikes))
	}

	// 代码问题
	fmt.Println("\n[代码问题]")
	if len(result.CodeIssues) > 0 {
		warningCount := 0
		for _, issue := range result.CodeIssues {
			if issue.Severity == "warning" {
				warningCount++
			}
		}
		fmt.Printf("  警告:         %d 个\n", warningCount)
		fmt.Printf("  信息:         %d 个\n", len(result.CodeIssues)-warningCount)
	} else {
		fmt.Println("  未检测到问题")
	}

	// Benchmark 趋势
	fmt.Println("\n[Benchmark 趋势]")
	if len(result.BenchmarkTrends) > 0 {
		improving := 0
		worsening := 0
		stable := 0
		for _, trend := range result.BenchmarkTrends {
			switch trend.Trend {
			case "improving":
				improving++
			case "worsening":
				worsening++
			default:
				stable++
			}
		}
		fmt.Printf("  改善:         %d 个\n", improving)
		fmt.Printf("  稳定:         %d 个\n", stable)
		if worsening > 0 {
			fmt.Printf("  ⚠ 恶化:       %d 个\n", worsening)
		}
	} else {
		fmt.Println("  无数据")
	}

	// 建议
	fmt.Println("\n[建议]")
	if len(result.Recommendations) > 0 {
		highCount := 0
		mediumCount := 0
		lowCount := 0
		for _, rec := range result.Recommendations {
			switch rec.Priority {
			case "high":
				highCount++
			case "medium":
				mediumCount++
			default:
				lowCount++
			}
		}

		if highCount > 0 {
			fmt.Printf("  🔴 高优先级:  %d 条\n", highCount)
		}
		if mediumCount > 0 {
			fmt.Printf("  🟡 中优先级:  %d 条\n", mediumCount)
		}
		if lowCount > 0 {
			fmt.Printf("  🟢 低优先级:  %d 条\n", lowCount)
		}

		// 显示高优先级建议
		if highCount > 0 {
			fmt.Println("\n  高优先级建议详情:")
			for _, rec := range result.Recommendations {
				if rec.Priority == "high" {
					fmt.Printf("\n    - %s\n", rec.Title)
					fmt.Printf("      %s\n", rec.Description)
				}
			}
		}
	} else {
		fmt.Println("  无建议")
	}

	fmt.Println("\n✓ 分析完成")
	fmt.Println("\n使用 'gra export' 命令导出完整报告:")
	fmt.Println("  gra export -o report.md  (Markdown 格式)")
	fmt.Println("  gra export -o report.json -f json  (JSON 格式)")
}
