package cmd

import (
	"fmt"
	"path/filepath"
	"time"

	"gcinsight/analyzer"
	"gcinsight/exporter"
	"gcinsight/models"
	"gcinsight/parser"
	"gcinsight/storage"

	"github.com/spf13/cobra"
)

var (
	gcTracePath   string
	heapSamplePath string
	allocEventPath string
	sessionName   string
	sessionDesc   string
	outputFormat  string
	outputPath    string
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析 GC 数据并生成报告",
	Long:  `导入 gctrace.log、heap-samples.csv 和 alloc-events.jsonl，进行 GC 分析并生成报告。`,
	Run:   runAnalyze,
}

func init() {
	analyzeCmd.Flags().StringVarP(&gcTracePath, "gc-trace", "g", "", "gctrace.log 文件路径")
	analyzeCmd.Flags().StringVarP(&heapSamplePath, "heap-sample", "s", "", "heap-samples.csv 文件路径")
	analyzeCmd.Flags().StringVarP(&allocEventPath, "alloc-event", "a", "", "alloc-events.jsonl 文件路径")
	analyzeCmd.Flags().StringVarP(&sessionName, "name", "n", "", "会话名称（可选）")
	analyzeCmd.Flags().StringVarP(&sessionDesc, "desc", "d", "", "会话描述（可选）")
	analyzeCmd.Flags().StringVarP(&outputFormat, "format", "f", "markdown", "输出格式: markdown 或 json")
	analyzeCmd.Flags().StringVarP(&outputPath, "output", "o", "", "输出文件路径（可选）")

	rootCmd.AddCommand(analyzeCmd)
}

func runAnalyze(cmd *cobra.Command, args []string) {
	if gcTracePath == "" && heapSamplePath == "" && allocEventPath == "" {
		exitWithError("必须至少提供一个输入文件", nil)
	}

	dbPath := filepath.Join(".", "gcinsight.db")
	store, err := storage.NewStorage(dbPath)
	if err != nil {
		exitWithError("无法初始化数据库", err)
	}
	defer store.Close()

	var traces []models.GCTraceEntry
	var samples []models.HeapSample
	var events []models.AllocEvent

	if gcTracePath != "" {
		fmt.Printf("正在解析 GC 跟踪日志: %s\n", gcTracePath)
		gcParser := parser.NewGCTraceParser()
		parsedTraces, err := gcParser.ParseFile(gcTracePath)
		if err != nil {
			exitWithError(fmt.Sprintf("解析 gctrace.log 失败: %v", err), nil)
		}
		traces = parsedTraces
		fmt.Printf("  解析完成: %d 条 GC 记录\n", len(traces))
	}

	if heapSamplePath != "" {
		fmt.Printf("正在解析堆采样数据: %s\n", heapSamplePath)
		heapParser := parser.NewHeapSampleParser()
		parsedSamples, err := heapParser.ParseFile(heapSamplePath)
		if err != nil {
			exitWithError(fmt.Sprintf("解析 heap-samples.csv 失败: %v", err), nil)
		}
		samples = parsedSamples
		fmt.Printf("  解析完成: %d 条采样记录\n", len(samples))
	}

	if allocEventPath != "" {
		fmt.Printf("正在解析分配事件: %s\n", allocEventPath)
		allocParser := parser.NewAllocEventParser()
		parsedEvents, err := allocParser.ParseFile(allocEventPath)
		if err != nil {
			exitWithError(fmt.Sprintf("解析 alloc-events.jsonl 失败: %v", err), nil)
		}
		events = parsedEvents
		fmt.Printf("  解析完成: %d 条事件记录\n", len(events))
	}

	if sessionName == "" {
		sessionName = fmt.Sprintf("session_%s", time.Now().Format("20060102_150405"))
	}

	session := &models.AnalysisSession{
		Name:            sessionName,
		Description:     sessionDesc,
		CreatedAt:       time.Now(),
		GCTracePath:     gcTracePath,
		HeapSamplePath:  heapSamplePath,
		AllocEventPath:  allocEventPath,
	}

	if err := store.CreateSession(session); err != nil {
		exitWithError("创建会话失败", err)
	}
	fmt.Printf("\n创建分析会话: %s (ID: %d)\n", session.Name, session.ID)

	if len(traces) > 0 {
		if err := store.SaveGCTraces(session.ID, traces); err != nil {
			exitWithError("保存 GC 跟踪数据失败", err)
		}
	}

	if len(samples) > 0 {
		if err := store.SaveHeapSamples(session.ID, samples); err != nil {
			exitWithError("保存堆采样数据失败", err)
		}
	}

	if len(events) > 0 {
		if err := store.SaveAllocEvents(session.ID, events); err != nil {
			exitWithError("保存分配事件失败", err)
		}
	}

	fmt.Println("\n正在执行 GC 分析...")
	a := analyzer.NewAnalyzer()
	result := a.Analyze(traces, samples, events)
	result.SessionID = session.ID

	if err := store.SaveAnalysisResult(result); err != nil {
		exitWithError("保存分析结果失败", err)
	}

	printAnalysisSummary(result)

	if outputPath != "" {
		exp := exporter.NewExporter()
		if outputFormat == "json" {
			if err := exp.ExportJSON(result, outputPath); err != nil {
				exitWithError("导出 JSON 失败", err)
			}
			fmt.Printf("\n报告已导出到: %s\n", outputPath)
		} else {
			if err := exp.ExportMarkdown(result, outputPath); err != nil {
				exitWithError("导出 Markdown 失败", err)
			}
			fmt.Printf("\n报告已导出到: %s\n", outputPath)
		}
	}

	fmt.Printf("\n分析完成！会话 ID: %d\n", session.ID)
}

func printAnalysisSummary(result *models.AnalysisResult) {
	fmt.Println("\n" + "=" + " 分析摘要 " + "=")
	fmt.Printf("\n【基本指标】\n")
	fmt.Printf("  GC 总次数: %d\n", result.RawMetrics.TotalGCs)
	fmt.Printf("  总暂停时间: %v\n", result.RawMetrics.TotalPauseTime)
	fmt.Printf("  GOGC: %d\n", result.RawMetrics.GOGC)
	if result.RawMetrics.GOMEMLIMIT > 0 {
		fmt.Printf("  GOMEMLIMIT: %s\n", formatBytesReadable(result.RawMetrics.GOMEMLIMIT))
	}

	fmt.Printf("\n【暂停分布】\n")
	fmt.Printf("  平均暂停: %v\n", result.PauseDistribution.MeanPause)
	fmt.Printf("  P95 暂停: %v\n", result.PauseDistribution.P95Pause)
	fmt.Printf("  P99 暂停: %v\n", result.PauseDistribution.P99Pause)
	fmt.Printf("  最大暂停: %v\n", result.PauseDistribution.MaxPause)

	fmt.Printf("\n【堆目标分析】\n")
	fmt.Printf("  目标达成: %d/%d\n", result.HeapGoalDeviation.GoalAchieved, result.HeapGoalDeviation.TotalGCs)
	fmt.Printf("  平均偏差: %.2f%%\n", result.HeapGoalDeviation.MeanDeviation)

	fmt.Printf("\n【GC Assist 压力】\n")
	if result.AssistPressure.TotalAssists > 0 {
		fmt.Printf("  Assist 次数: %d\n", result.AssistPressure.TotalAssists)
		fmt.Printf("  总 Assist 字节: %s\n", formatBytesReadable(result.AssistPressure.TotalAssistedBytes))
		if len(result.AssistPressure.HighPressureGCs) > 0 {
			fmt.Printf("  高压 GC: %v\n", result.AssistPressure.HighPressureGCs)
		}
	} else {
		fmt.Printf("  无 Assist 压力 ✓\n")
	}

	fmt.Printf("\n【内存峰值】\n")
	fmt.Printf("  堆分配峰值: %s\n", formatBytesReadable(result.MemoryPeaks.PeakHeapAlloc))
	fmt.Printf("  堆使用峰值: %s\n", formatBytesReadable(result.MemoryPeaks.PeakHeapInUse))
	fmt.Printf("  对象数峰值: %d\n", result.MemoryPeaks.PeakObjects)

	if len(result.Recommendations) > 0 {
		fmt.Printf("\n【调参建议】\n")
		for i, rec := range result.Recommendations {
			severity := ""
			if rec.Severity == "Critical" {
				severity = "[🚨 严重]"
			} else if rec.Severity == "High" {
				severity = "[⚠️ 高]"
			} else {
				severity = "[ℹ️ 低]"
			}
			fmt.Printf("  %d. %s %s\n", i+1, severity, rec.Title)
		}
	} else {
		fmt.Printf("\n【调参建议】\n")
		fmt.Printf("  无特殊建议 ✓\n")
	}
}

func formatBytesReadable(bytes uint64) string {
	const (
		KB = 1024
		MB = 1024 * KB
		GB = 1024 * MB
	)

	switch {
	case bytes >= GB:
		return fmt.Sprintf("%.2f GB", float64(bytes)/float64(GB))
	case bytes >= MB:
		return fmt.Sprintf("%.2f MB", float64(bytes)/float64(MB))
	case bytes >= KB:
		return fmt.Sprintf("%.2f KB", float64(bytes)/float64(KB))
	default:
		return fmt.Sprintf("%d B", bytes)
	}
}
