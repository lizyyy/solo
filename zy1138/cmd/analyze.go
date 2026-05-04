package cmd

import (
	"fmt"

	"queue-analyzer/pkg/analyzer"
	"queue-analyzer/pkg/importer"
	"queue-analyzer/pkg/reporter"

	"github.com/spf13/cobra"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "分析队列数据",
	Long: `分析导入的队列数据，生成性能报告和优化建议。

支持导入的数据格式：
- jobs.jsonl: 任务数据
- workers.csv: Worker 配置数据
- queue-events.jsonl: 队列事件数据
- config.yaml: 队列配置`,
	RunE: runAnalyze,
}

var (
	analyzeJobsPath       string
	analyzeWorkersPath    string
	analyzeEventsPath     string
	analyzeConfigPath     string
	analyzeOutputFormat   string
	analyzeOutputPath     string
	analyzeStartAt        string
	analyzeEndAt          string
	analyzeJobTypes       []string
	analyzeQueueNames     []string
)

func init() {
	rootCmd.AddCommand(analyzeCmd)

	analyzeCmd.Flags().StringVar(&analyzeJobsPath, "jobs", "", "任务数据文件路径 (JSONL)")
	analyzeCmd.Flags().StringVar(&analyzeWorkersPath, "workers", "", "Worker 数据文件路径 (CSV)")
	analyzeCmd.Flags().StringVar(&analyzeEventsPath, "events", "", "队列事件文件路径 (JSONL)")
	analyzeCmd.Flags().StringVar(&analyzeConfigPath, "config", "", "配置文件路径 (YAML)")
	analyzeCmd.Flags().StringVarP(&analyzeOutputFormat, "format", "f", "markdown", "输出格式: json, csv, markdown")
	analyzeCmd.Flags().StringVarP(&analyzeOutputPath, "output", "o", "", "输出文件路径 (默认 stdout)")
	analyzeCmd.Flags().StringVar(&analyzeStartAt, "start-at", "", "分析起始时间 (RFC3339)")
	analyzeCmd.Flags().StringVar(&analyzeEndAt, "end-at", "", "分析结束时间 (RFC3339)")
	analyzeCmd.Flags().StringSliceVar(&analyzeJobTypes, "job-types", []string{}, "筛选任务类型")
	analyzeCmd.Flags().StringSliceVar(&analyzeQueueNames, "queue-names", []string{}, "筛选队列名称")
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	if analyzeJobsPath == "" && analyzeEventsPath == "" {
		return fmt.Errorf("必须提供 --jobs 或 --events 参数")
	}

	fmt.Println("正在导入数据...")

	imp := importer.NewImporter()
	data, err := imp.ImportAll(analyzeJobsPath, analyzeWorkersPath, analyzeEventsPath, analyzeConfigPath)
	if err != nil {
		return fmt.Errorf("导入数据失败: %w", err)
	}

	fmt.Printf("成功导入: %d 个任务, %d 个 Worker, %d 个事件\n",
		len(data.Jobs), len(data.Workers), len(data.Events))

	fmt.Println("正在分析数据...")

	ana := analyzer.NewAnalyzer()
	result, err := ana.Analyze(data, nil)
	if err != nil {
		return fmt.Errorf("分析失败: %w", err)
	}

	fmt.Printf("分析完成:\n")
	fmt.Printf("  - 总任务数: %d\n", result.Summary.TotalJobs)
	fmt.Printf("  - 成功率: %.2f%%\n", result.Summary.SuccessRate*100)
	fmt.Printf("  - 平均吞吐: %.2f 任务/秒\n", result.Summary.AvgThroughputPerSec)
	fmt.Printf("  - 峰值积压: %d\n", result.Summary.MaxBacklog)
	fmt.Printf("  - 生成建议: %d 条\n", len(result.Recommendations))

	if len(result.Anomalies) > 0 {
		fmt.Printf("  - 检测到异常: %d 个\n", len(result.Anomalies))
	}

	rep := reporter.NewReporter()
	err = rep.ExportAnalysisResult(result, analyzeOutputFormat, analyzeOutputPath)
	if err != nil {
		return fmt.Errorf("导出报告失败: %w", err)
	}

	if analyzeOutputPath != "" {
		fmt.Printf("报告已导出到: %s\n", analyzeOutputPath)
	}

	return nil
}
