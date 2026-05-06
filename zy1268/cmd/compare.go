package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"

	"go-runtime-analyzer/analyzer"
	"go-runtime-analyzer/storage"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "比较两个分析结果",
	Long: `compare 命令比较两个数据库或两个分析结果，显示差异。

使用示例：
  gra compare --db1 before.db --db2 after.db
  gra compare --db1 old.db --db2 new.db -o comparison.md
  gra compare --db1 test1.db --db2 test2.db -f json`,
	Run: func(cmd *cobra.Command, args []string) {
		runCompare()
	},
}

var (
	compareDB1    string
	compareDB2    string
	compareOutput string
	compareFormat string
)

func init() {
	rootCmd.AddCommand(compareCmd)

	compareCmd.Flags().StringVar(&compareDB1, "db1", "", "第一个数据库文件路径 (必填)")
	compareCmd.Flags().StringVar(&compareDB2, "db2", "", "第二个数据库文件路径 (必填)")
	compareCmd.Flags().StringVarP(&compareOutput, "output", "o", "", "输出文件路径 (可选，默认输出到控制台)")
	compareCmd.Flags().StringVarP(&compareFormat, "format", "f", "markdown", "输出格式: markdown 或 json")
	compareCmd.MarkFlagRequired("db1")
	compareCmd.MarkFlagRequired("db2")
}

func runCompare() {
	// 验证数据库文件存在
	if _, err := os.Stat(compareDB1); os.IsNotExist(err) {
		fmt.Printf("错误: 数据库文件不存在: %s\n", compareDB1)
		os.Exit(1)
	}
	if _, err := os.Stat(compareDB2); os.IsNotExist(err) {
		fmt.Printf("错误: 数据库文件不存在: %s\n", compareDB2)
		os.Exit(1)
	}

	// 分析第一个数据库
	fmt.Println("正在分析第一个数据库...")
	result1, err := analyzeDatabase(compareDB1)
	if err != nil {
		fmt.Printf("错误: 分析 %s 失败: %v\n", compareDB1, err)
		os.Exit(1)
	}

	// 分析第二个数据库
	fmt.Println("正在分析第二个数据库...")
	result2, err := analyzeDatabase(compareDB2)
	if err != nil {
		fmt.Printf("错误: 分析 %s 失败: %v\n", compareDB2, err)
		os.Exit(1)
	}

	// 比较
	fmt.Println("正在比较...")
	comparison := analyzer.CompareResults(result1, result2)

	// 输出
	var content string
	if compareFormat == "json" {
		jsonData, err := json.MarshalIndent(comparison, "", "  ")
		if err != nil {
			fmt.Printf("错误: 序列化 JSON 失败: %v\n", err)
			os.Exit(1)
		}
		content = string(jsonData)
	} else {
		content = comparisonToMarkdown(comparison, compareDB1, compareDB2, result1, result2)
	}

	// 输出到文件或控制台
	if compareOutput != "" {
		if err := os.WriteFile(compareOutput, []byte(content), 0644); err != nil {
			fmt.Printf("错误: 写入文件失败: %v\n", err)
			os.Exit(1)
		}
		fmt.Printf("✓ 比较报告已导出到: %s\n", compareOutput)
	} else {
		fmt.Println("\n" + content)
	}
}

func analyzeDatabase(dbPath string) (*analyzer.AnalysisResult, error) {
	db, err := storage.InitDB(dbPath)
	if err != nil {
		return nil, err
	}
	defer db.Close()

	config := analyzer.DefaultAnalysisConfig()
	an := analyzer.NewAnalyzer(db, config)

	return an.Analyze()
}

func comparisonToMarkdown(c *analyzer.ComparisonResult, db1, db2 string, r1, r2 *analyzer.AnalysisResult) string {
	var sb strings.Builder

	// 标题
	sb.WriteString("# 分析结果比较报告\n\n")
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", c.GeneratedAt.Format("2006-01-02 15:04:05")))

	// 比较对象
	sb.WriteString("## 比较对象\n\n")
	sb.WriteString(fmt.Sprintf("- **基准**: %s\n", filepath.Base(db1)))
	sb.WriteString(fmt.Sprintf("- **目标**: %s\n\n", filepath.Base(db2)))

	// 摘要
	sb.WriteString("## 摘要\n\n")
	sb.WriteString(c.Summary + "\n\n")

	// 数据统计对比
	sb.WriteString("## 数据统计对比\n\n")
	sb.WriteString("| 指标 | 基准 | 目标 | 变化 |\n")
	sb.WriteString("|------|------|------|------|\n")

	// Stacktrace
	sb.WriteString(fmt.Sprintf("| Stacktrace | %d | %d | %+d |\n",
		r1.Summary.TotalStacktraces, r2.Summary.TotalStacktraces,
		r2.Summary.TotalStacktraces-r1.Summary.TotalStacktraces))

	// 抢占事件
	sb.WriteString(fmt.Sprintf("| 抢占事件 | %d | %d | %+d |\n",
		r1.Summary.TotalPreemptEvents, r2.Summary.TotalPreemptEvents,
		r2.Summary.TotalPreemptEvents-r1.Summary.TotalPreemptEvents))

	// Schedtrace
	sb.WriteString(fmt.Sprintf("| Schedtrace | %d | %d | %+d |\n",
		r1.Summary.TotalSchedtraces, r2.Summary.TotalSchedtraces,
		r2.Summary.TotalSchedtraces-r1.Summary.TotalSchedtraces))

	// 代码片段
	sb.WriteString(fmt.Sprintf("| 代码片段 | %d | %d | %+d |\n",
		r1.Summary.TotalCodeSnippets, r2.Summary.TotalCodeSnippets,
		r2.Summary.TotalCodeSnippets-r1.Summary.TotalCodeSnippets))

	// Benchmark
	sb.WriteString(fmt.Sprintf("| Benchmark | %d | %d | %+d |\n\n",
		r1.Summary.TotalBenchmarks, r2.Summary.TotalBenchmarks,
		r2.Summary.TotalBenchmarks-r1.Summary.TotalBenchmarks))

	// 关键指标对比
	sb.WriteString("## 关键指标对比\n\n")
	sb.WriteString("| 指标 | 基准 | 目标 | 变化率 | 状态 |\n")
	sb.WriteString("|------|------|------|--------|------|\n")

	// 最大延迟
	maxLatency1 := r1.LatencyAnalysis.MaxLatencyUS
	maxLatency2 := r2.LatencyAnalysis.MaxLatencyUS
	maxLatencyChange := calcChangePct(float64(maxLatency1), float64(maxLatency2))
	maxLatencyStatus := "➖"
	if maxLatencyChange < -10 {
		maxLatencyStatus = "✅ 改善"
	} else if maxLatencyChange > 10 {
		maxLatencyStatus = "⚠️ 恶化"
	}
	sb.WriteString(fmt.Sprintf("| 最大延迟 (µs) | %d | %d | %.1f%% | %s |\n",
		maxLatency1, maxLatency2, maxLatencyChange, maxLatencyStatus))

	// 平均延迟
	avgLatency1 := r1.LatencyAnalysis.AverageLatencyUS
	avgLatency2 := r2.LatencyAnalysis.AverageLatencyUS
	avgLatencyChange := calcChangePct(float64(avgLatency1), float64(avgLatency2))
	avgLatencyStatus := "➖"
	if avgLatencyChange < -10 {
		avgLatencyStatus = "✅ 改善"
	} else if avgLatencyChange > 10 {
		avgLatencyStatus = "⚠️ 恶化"
	}
	sb.WriteString(fmt.Sprintf("| 平均延迟 (µs) | %d | %d | %.1f%% | %s |\n",
		avgLatency1, avgLatency2, avgLatencyChange, avgLatencyStatus))

	// 栈增长事件
	stackGrowth1 := r1.StackAnalysis.TotalGrowthEvents
	stackGrowth2 := r2.StackAnalysis.TotalGrowthEvents
	stackGrowthChange := calcChangePct(float64(stackGrowth1), float64(stackGrowth2))
	stackGrowthStatus := "➖"
	if stackGrowthChange < -10 {
		stackGrowthStatus = "✅ 改善"
	} else if stackGrowthChange > 10 {
		stackGrowthStatus = "⚠️ 恶化"
	}
	sb.WriteString(fmt.Sprintf("| 栈增长事件 | %d | %d | %.1f%% | %s |\n",
		stackGrowth1, stackGrowth2, stackGrowthChange, stackGrowthStatus))

	// 异步抢占
	asyncPreempt1 := r1.PreemptAnalysis.TotalAsyncPreempts
	asyncPreempt2 := r2.PreemptAnalysis.TotalAsyncPreempts
	asyncPreemptChange := calcChangePct(float64(asyncPreempt1), float64(asyncPreempt2))
	asyncPreemptStatus := "➖"
	if asyncPreemptChange < -10 {
		asyncPreemptStatus = "✅ 减少"
	} else if asyncPreemptChange > 10 {
		asyncPreemptStatus = "⚠️ 增加"
	}
	sb.WriteString(fmt.Sprintf("| 异步抢占 | %d | %d | %.1f%% | %s |\n",
		asyncPreempt1, asyncPreempt2, asyncPreemptChange, asyncPreemptStatus))

	// 系统调用阻塞
	syscall1 := r1.PreemptAnalysis.TotalSyscallBlocks
	syscall2 := r2.PreemptAnalysis.TotalSyscallBlocks
	syscallChange := calcChangePct(float64(syscall1), float64(syscall2))
	syscallStatus := "➖"
	if syscallChange < -10 {
		syscallStatus = "✅ 改善"
	} else if syscallChange > 10 {
		syscallStatus = "⚠️ 恶化"
	}
	sb.WriteString(fmt.Sprintf("| 系统调用阻塞 | %d | %d | %.1f%% | %s |\n\n",
		syscall1, syscall2, syscallChange, syscallStatus))

	// 详细差异
	if len(c.Differences) > 0 {
		sb.WriteString("## 详细差异\n\n")

		// 按类别分组
		byCategory := make(map[string][]analyzer.Difference)
		for _, d := range c.Differences {
			byCategory[d.Category] = append(byCategory[d.Category], d)
		}

		for category, diffs := range byCategory {
			categoryLabel := map[string]string{
				"stack":   "栈",
				"latency": "延迟",
				"preempt": "抢占",
				"sched":   "调度",
			}[category]
			if categoryLabel == "" {
				categoryLabel = category
			}

			sb.WriteString(fmt.Sprintf("### %s\n\n", categoryLabel))
			sb.WriteString("| 字段 | 基准 | 目标 | 变化率 | 描述 |\n")
			sb.WriteString("|------|------|------|--------|------|\n")

			for _, d := range diffs {
				sb.WriteString(fmt.Sprintf("| %s | %v | %v | %.1f%% | %s |\n",
					d.Field, d.OldValue, d.NewValue, d.ChangePct, d.Description))
			}
			sb.WriteString("\n")
		}
	}

	// 建议
	sb.WriteString("## 结论\n\n")
	if len(c.Differences) == 0 {
		sb.WriteString("两个分析结果没有显著差异。\n\n")
	} else {
		improvements := 0
		regressions := 0
		for _, d := range c.Differences {
			// 判断是否是改善
			isImprovement := false
			switch d.Field {
			case "max_latency_us", "avg_latency_us", "total_growth_events",
				"async_preempt_count", "stack_growth_count", "nosplit_call_count", "syscall_block_count":
				if d.ChangePct < 0 {
					isImprovement = true
				}
			}

			if isImprovement {
				improvements++
			} else {
				regressions++
			}
		}

		if regressions > 0 {
			sb.WriteString(fmt.Sprintf("⚠️ **检测到 %d 个潜在的性能恶化**。建议审查相关变更。\n\n", regressions))
		}
		if improvements > 0 {
			sb.WriteString(fmt.Sprintf("✅ **检测到 %d 个性能改善**。继续保持！\n\n", improvements))
		}
	}

	return sb.String()
}

func calcChangePct(old, new float64) float64 {
	if old == 0 {
		if new == 0 {
			return 0
		}
		return 100 // 从 0 增长
	}
	return (new - old) / old * 100
}
