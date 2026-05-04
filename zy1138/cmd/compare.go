package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"queue-analyzer/pkg/importer"
	"queue-analyzer/pkg/models"
	"queue-analyzer/pkg/reporter"
	"queue-analyzer/pkg/simulator"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare",
	Short: "对比多个模拟配置",
	Long: `对比多个模拟配置的性能，找出最优方案。

使用方式：
1. 通过 --config 指定一个包含多个模拟配置的 YAML 文件
2. 或者通过 --results 指定多个已保存的 JSON 结果文件进行对比`,
	RunE: runCompare,
}

var (
	compareConfigPath    string
	compareResultsPaths   []string
	compareJobsPath      string
	compareOutputFormat  string
	compareOutputPath    string
	compareBaseConfig    string
)

func init() {
	rootCmd.AddCommand(compareCmd)

	compareCmd.Flags().StringVar(&compareConfigPath, "config", "", "包含多个模拟配置的 YAML 文件路径")
	compareCmd.Flags().StringSliceVar(&compareResultsPaths, "results", []string{}, "已保存的 JSON 结果文件路径 (多个)")
	compareCmd.Flags().StringVar(&compareJobsPath, "jobs", "", "任务数据文件路径 (JSONL) - 用于重新运行模拟")
	compareCmd.Flags().StringVarP(&compareOutputFormat, "format", "f", "markdown", "输出格式: json, csv, markdown")
	compareCmd.Flags().StringVarP(&compareOutputPath, "output", "o", "", "输出文件路径 (默认 stdout)")
	compareCmd.Flags().StringVar(&compareBaseConfig, "base", "", "基准配置名称 (用于计算差值)")
}

func runCompare(cmd *cobra.Command, args []string) error {
	if compareConfigPath == "" && len(compareResultsPaths) == 0 {
		return fmt.Errorf("必须提供 --config 或 --results 参数")
	}

	var results []*models.SimulationResult
	var baseResult *models.SimulationResult

	if compareConfigPath != "" {
		if compareJobsPath == "" {
			return fmt.Errorf("使用 --config 时必须提供 --jobs 参数")
		}

		fmt.Println("正在导入任务数据...")
		imp := importer.NewImporter()
		data, err := imp.ImportAll(compareJobsPath, "", "", "")
		if err != nil {
			return fmt.Errorf("导入数据失败: %w", err)
		}
		fmt.Printf("成功导入 %d 个任务\n", len(data.Jobs))

		fmt.Println("正在加载模拟配置...")
		fullConfig, err := imp.ImportConfig(compareConfigPath)
		if err != nil {
			return fmt.Errorf("加载配置失败: %w", err)
		}

		if len(fullConfig.Simulations) == 0 {
			return fmt.Errorf("配置文件中没有定义模拟配置 (simulations 字段为空)")
		}

		fmt.Printf("找到 %d 个模拟配置\n", len(fullConfig.Simulations))

		for i, simConfig := range fullConfig.Simulations {
			fmt.Printf("\n正在执行模拟 %d/%d: %s\n", i+1, len(fullConfig.Simulations), simConfig.Name)

			sim := simulator.NewSimulator()
			result, err := sim.Simulate(data.Jobs, &simConfig)
			if err != nil {
				return fmt.Errorf("模拟 %s 失败: %w", simConfig.Name, err)
			}

			results = append(results, result)

			fmt.Printf("  完成: 成功率 %.2f%%, 吞吐 %.2f/s, 峰值积压 %d\n",
				result.Summary.SuccessRate*100,
				result.Summary.ThroughputPerSecond,
				result.Summary.PeakBacklog)

			if compareBaseConfig == "" || simConfig.Name == compareBaseConfig {
				baseResult = result
			}
		}
	}

	if len(compareResultsPaths) > 0 {
		fmt.Println("正在加载已保存的结果...")

		for i, path := range compareResultsPaths {
			fmt.Printf("加载 %d/%d: %s\n", i+1, len(compareResultsPaths), path)

			result, err := loadSimulationResult(path)
			if err != nil {
				return fmt.Errorf("加载结果 %s 失败: %w", path, err)
			}

			results = append(results, result)

			configName := result.ConfigName
			if configName == "" {
				configName = fmt.Sprintf("config-%d", i+1)
			}

			fmt.Printf("  配置: %s, 成功率: %.2f%%\n", configName, result.Summary.SuccessRate*100)

			if compareBaseConfig != "" && strings.Contains(path, compareBaseConfig) {
				baseResult = result
			}
		}
	}

	if len(results) < 2 {
		return fmt.Errorf("至少需要 2 个结果进行对比，当前只有 %d 个", len(results))
	}

	if baseResult == nil {
		baseResult = results[0]
	}

	fmt.Println("\n正在执行对比分析...")

	otherResults := make([]*models.SimulationResult, 0)
	for _, r := range results {
		if r.ConfigName != baseResult.ConfigName {
			otherResults = append(otherResults, r)
		}
	}

	sim := simulator.NewSimulator()
	compareResult, err := sim.Compare(baseResult, otherResults)
	if err != nil {
		return fmt.Errorf("对比分析失败: %w", err)
	}

	fmt.Printf("对比完成:\n")
	fmt.Printf("  - 总模拟数: %d\n", compareResult.Summary.TotalSimulations)
	fmt.Printf("  - 最佳配置: %s\n", compareResult.Summary.BestConfigName)
	fmt.Printf("  - 最佳成功率: %.2f%%\n", compareResult.Summary.BestSuccessRate*100)
	fmt.Printf("  - 最佳吞吐: %.2f/s\n", compareResult.Summary.BestThroughput)
	fmt.Printf("  - 最差配置: %s\n", compareResult.Summary.WorstConfigName)

	rep := reporter.NewReporter()
	err = rep.ExportComparisonResult(compareResult, compareOutputFormat, compareOutputPath)
	if err != nil {
		return fmt.Errorf("导出报告失败: %w", err)
	}

	if compareOutputPath != "" {
		fmt.Printf("报告已导出到: %s\n", compareOutputPath)
	}

	return nil
}

func loadSimulationResult(path string) (*models.SimulationResult, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	var result models.SimulationResult
	decoder := json.NewDecoder(file)
	if err := decoder.Decode(&result); err != nil {
		return nil, err
	}

	return &result, nil
}
