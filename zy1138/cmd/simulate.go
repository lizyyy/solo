package cmd

import (
	"fmt"
	"time"

	"queue-analyzer/pkg/importer"
	"queue-analyzer/pkg/models"
	"queue-analyzer/pkg/reporter"
	"queue-analyzer/pkg/simulator"

	"github.com/spf13/cobra"
)

var simulateCmd = &cobra.Command{
	Use:   "simulate",
	Short: "模拟队列运行",
	Long: `基于导入的任务数据和配置，模拟不同参数下的队列运行情况。

可以模拟的参数包括：
- Worker 数量
- 每个 Worker 的并发数
- Batch Size
- Poll Interval
- 重试策略 (固定间隔、指数退避、线性)
- 超时时间
- 优先级配额`,
	RunE: runSimulate,
}

var (
	simulateJobsPath       string
	simulateConfigPath     string
	simulateOutputFormat   string
	simulateOutputPath     string
	simulateWorkerCount    int
	simulateConcurrency    int
	simulateBatchSize      int
	simulatePollInterval   string
	simulateRetryStrategy  string
	simulateRetryInitial   string
	simulateRetryMax       string
	simulateRetryMultiplier float64
	simulateRetryJitter    float64
	simulateTimeout        string
	simulateGlobalConcurrency int
	simulateConfigName     string
)

func init() {
	rootCmd.AddCommand(simulateCmd)

	simulateCmd.Flags().StringVar(&simulateJobsPath, "jobs", "", "任务数据文件路径 (JSONL)")
	simulateCmd.Flags().StringVar(&simulateConfigPath, "config", "", "模拟配置文件路径 (YAML)")
	simulateCmd.Flags().StringVarP(&simulateOutputFormat, "format", "f", "markdown", "输出格式: json, csv, markdown")
	simulateCmd.Flags().StringVarP(&simulateOutputPath, "output", "o", "", "输出文件路径 (默认 stdout)")
	simulateCmd.Flags().StringVar(&simulateConfigName, "name", "custom-config", "配置名称")

	simulateCmd.Flags().IntVar(&simulateWorkerCount, "workers", 10, "Worker 数量")
	simulateCmd.Flags().IntVar(&simulateConcurrency, "concurrency", 1, "每个 Worker 的并发数")
	simulateCmd.Flags().IntVar(&simulateBatchSize, "batch-size", 1, "批处理大小")
	simulateCmd.Flags().StringVar(&simulatePollInterval, "poll-interval", "1s", "轮询间隔 (如 1s, 500ms)")
	simulateCmd.Flags().StringVar(&simulateRetryStrategy, "retry-strategy", "exponential", "重试策略: fixed, exponential, linear")
	simulateCmd.Flags().StringVar(&simulateRetryInitial, "retry-initial", "1s", "初始重试间隔")
	simulateCmd.Flags().StringVar(&simulateRetryMax, "retry-max", "5m", "最大重试间隔")
	simulateCmd.Flags().Float64Var(&simulateRetryMultiplier, "retry-multiplier", 2.0, "指数退避乘数")
	simulateCmd.Flags().Float64Var(&simulateRetryJitter, "retry-jitter", 0.1, "重试抖动系数 (0.0-1.0)")
	simulateCmd.Flags().StringVar(&simulateTimeout, "timeout", "30s", "默认超时时间")
	simulateCmd.Flags().IntVar(&simulateGlobalConcurrency, "global-concurrency", 0, "全局并发数 (覆盖 Worker 配置)")
}

func runSimulate(cmd *cobra.Command, args []string) error {
	if simulateJobsPath == "" {
		return fmt.Errorf("必须提供 --jobs 参数")
	}

	fmt.Println("正在导入任务数据...")

	imp := importer.NewImporter()
	data, err := imp.ImportAll(simulateJobsPath, "", "", "")
	if err != nil {
		return fmt.Errorf("导入数据失败: %w", err)
	}

	fmt.Printf("成功导入 %d 个任务\n", len(data.Jobs))

	if len(data.Jobs) == 0 {
		return fmt.Errorf("没有可模拟的任务")
	}

	fmt.Println("正在构建模拟配置...")

	simConfig, err := buildSimulationConfig()
	if err != nil {
		return fmt.Errorf("构建配置失败: %w", err)
	}

	printSimulationConfig(simConfig)

	fmt.Println("正在执行模拟...")

	sim := simulator.NewSimulator()
	result, err := sim.Simulate(data.Jobs, simConfig)
	if err != nil {
		return fmt.Errorf("模拟失败: %w", err)
	}

	fmt.Printf("模拟完成:\n")
	fmt.Printf("  - 总任务数: %d\n", result.Summary.TotalJobs)
	fmt.Printf("  - 已处理任务数: %d\n", result.Summary.ProcessedJobs)
	fmt.Printf("  - 成功率: %.2f%%\n", result.Summary.SuccessRate*100)
	fmt.Printf("  - 吞吐率: %.2f 任务/秒\n", result.Summary.ThroughputPerSecond)
	fmt.Printf("  - 峰值积压: %d\n", result.Summary.PeakBacklog)
	fmt.Printf("  - 最大等待时间: %dms\n", result.Summary.MaxWaitTimeMs)
	fmt.Printf("  - 模拟时长: %s\n", result.Summary.SimulationDuration)
	fmt.Printf("  - 实际执行时间: %dms\n", result.Summary.RealDurationMs)

	if len(result.Issues) > 0 {
		fmt.Printf("  - 检测到问题: %d 个\n", len(result.Issues))
	}

	rep := reporter.NewReporter()
	err = rep.ExportSimulationResult(result, simulateOutputFormat, simulateOutputPath)
	if err != nil {
		return fmt.Errorf("导出报告失败: %w", err)
	}

	if simulateOutputPath != "" {
		fmt.Printf("报告已导出到: %s\n", simulateOutputPath)
	}

	return nil
}

func buildSimulationConfig() (*models.SimulationConfig, error) {
	config := &models.SimulationConfig{
		Name:              simulateConfigName,
		Description:       "CLI 配置的模拟",
		GlobalConcurrency: simulateGlobalConcurrency,
	}

	if simulateConfigPath != "" {
		imp := importer.NewImporter()
		fullConfig, err := imp.ImportConfig(simulateConfigPath)
		if err != nil {
			return nil, err
		}

		if len(fullConfig.Simulations) > 0 {
			return &fullConfig.Simulations[0], nil
		}
	}

	pollInterval, err := time.ParseDuration(simulatePollInterval)
	if err != nil {
		return nil, fmt.Errorf("解析 poll-interval 失败: %w", err)
	}

	retryInitial, err := time.ParseDuration(simulateRetryInitial)
	if err != nil {
		return nil, fmt.Errorf("解析 retry-initial 失败: %w", err)
	}

	retryMax, err := time.ParseDuration(simulateRetryMax)
	if err != nil {
		return nil, fmt.Errorf("解析 retry-max 失败: %w", err)
	}

	timeout, err := time.ParseDuration(simulateTimeout)
	if err != nil {
		return nil, fmt.Errorf("解析 timeout 失败: %w", err)
	}

	config.WorkerPools = []models.WorkerPoolConfig{
		{
			Name:               "default-pool",
			WorkerCount:        simulateWorkerCount,
			QueueNames:         []string{"default"},
			ConcurrencyPerWorker: simulateConcurrency,
			BatchSize:          simulateBatchSize,
			PollInterval:       pollInterval,
		},
	}

	config.DefaultRetryPolicy = &models.RetryPolicy{
		Strategy:     simulateRetryStrategy,
		InitialDelay: retryInitial,
		MaxDelay:     retryMax,
		Multiplier:   simulateRetryMultiplier,
		Jitter:       simulateRetryJitter,
	}

	config.Queues = []models.QueueConfig{
		{
			Name:             "default",
			WorkerConcurrency: simulateWorkerCount * simulateConcurrency,
			BatchSize:        simulateBatchSize,
			PollInterval:     pollInterval,
			DefaultTimeout:   timeout,
			MaxRetries:       3,
		},
	}

	return config, nil
}

func printSimulationConfig(config *models.SimulationConfig) {
	fmt.Println("模拟配置:")
	fmt.Printf("  - 配置名称: %s\n", config.Name)
	if config.GlobalConcurrency > 0 {
		fmt.Printf("  - 全局并发数: %d\n", config.GlobalConcurrency)
	}
	if len(config.WorkerPools) > 0 {
		for i, pool := range config.WorkerPools {
			fmt.Printf("  - Worker Pool %d (%s):\n", i+1, pool.Name)
			fmt.Printf("    - Worker 数量: %d\n", pool.WorkerCount)
			fmt.Printf("    - 每 Worker 并发: %d\n", pool.ConcurrencyPerWorker)
			fmt.Printf("    - Batch Size: %d\n", pool.BatchSize)
			fmt.Printf("    - Poll Interval: %s\n", pool.PollInterval)
		}
	}
	if config.DefaultRetryPolicy != nil {
		fmt.Printf("  - 重试策略: %s\n", config.DefaultRetryPolicy.Strategy)
		fmt.Printf("    - 初始间隔: %s\n", config.DefaultRetryPolicy.InitialDelay)
		fmt.Printf("    - 最大间隔: %s\n", config.DefaultRetryPolicy.MaxDelay)
		fmt.Printf("    - 乘数: %.1f\n", config.DefaultRetryPolicy.Multiplier)
		fmt.Printf("    - 抖动: %.1f\n", config.DefaultRetryPolicy.Jitter)
	}
}
