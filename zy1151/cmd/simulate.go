package cmd

import (
	"fmt"
	"memreplay/internal/simulator"
	"memreplay/internal/storage"
	"strconv"
	"time"

	"github.com/spf13/cobra"
)

var simulateCmd = &cobra.Command{
	Use:   "simulate",
	Short: "模拟配置参数变化的风险",
	Long: `根据指定的配置参数，模拟内存使用风险。
支持的参数包括：缓存 TTL、最大缓存大小、Worker 数、GC 百分比、请求速率等。

模拟规则：
- 缓存大小估算 = (请求速率 × (1-缓存命中率)) × TTL × 平均响应大小
- 缓存命中率默认为 80%
- 风险评估基于：缓存堆积风险、Goroutine 风险、GC 压力

示例:
  memreplay simulate --cache-ttl 3600 --max-cache-size 10000
  memreplay simulate --cache-ttl 86400 --max-cache-size 0 --request-rate 1000
  memreplay simulate --worker-count 10000 --gc-percent 200 --duration 24h`,
	Run: func(cmd *cobra.Command, args []string) {
		cacheTTLStr, _ := cmd.Flags().GetString("cache-ttl")
		maxCacheSize, _ := cmd.Flags().GetInt("max-cache-size")
		workerCount, _ := cmd.Flags().GetInt("worker-count")
		gcPercent, _ := cmd.Flags().GetInt("gc-percent")
		requestRate, _ := cmd.Flags().GetFloat64("request-rate")
		avgRequestSize, _ := cmd.Flags().GetInt("avg-request-size")
		avgResponseSize, _ := cmd.Flags().GetInt("avg-response-size")
		durationStr, _ := cmd.Flags().GetString("duration")
		save, _ := cmd.Flags().GetBool("save")

		cacheTTL, err := parseDurationWithDefault(cacheTTLStr, 1*time.Hour)
		if err != nil {
			errorExit(fmt.Sprintf("无效的 cache-ttl: %s", cacheTTLStr), err)
			return
		}

		duration, err := parseDurationWithDefault(durationStr, 24*time.Hour)
		if err != nil {
			errorExit(fmt.Sprintf("无效的 duration: %s", durationStr), err)
			return
		}

		config := simulator.SimulationConfig{
			CacheTTL:        cacheTTL,
			MaxCacheSize:    maxCacheSize,
			WorkerCount:     workerCount,
			GCPercent:       gcPercent,
			RequestRate:     requestRate,
			AvgRequestSize:  avgRequestSize,
			AvgResponseSize: avgResponseSize,
			Duration:        duration,
		}

		sim := simulator.NewSimulator(config)
		params, result, err := sim.Run()
		if err != nil {
			errorExit("模拟执行失败", err)
			return
		}

		if save {
			if err := storage.SaveSimulationResult(params, result); err != nil {
				errorExit("保存模拟结果失败", err)
				return
			}
			fmt.Printf("✓ 模拟结果已保存\n\n")
		}

		fmt.Println("=")
		fmt.Println("  模拟分析报告")
		fmt.Println("=")
		fmt.Println()
		fmt.Printf("风险等级: %s\n", formatRiskLevel(result.RiskLevel))
		fmt.Println()
		fmt.Println("结论:")
		fmt.Printf("  %s\n", result.Conclusion)
		fmt.Println()

		fmt.Println("模拟参数:")
		fmt.Printf("  缓存 TTL: %v\n", cacheTTL)
		fmt.Printf("  最大缓存大小: %d\n", maxCacheSize)
		fmt.Printf("  Worker 数量: %d\n", workerCount)
		fmt.Printf("  GC 百分比: %d%%\n", gcPercent)
		fmt.Printf("  请求速率: %.2f QPS\n", requestRate)
		fmt.Printf("  平均请求大小: %d bytes\n", avgRequestSize)
		fmt.Printf("  平均响应大小: %d bytes\n", avgResponseSize)
		fmt.Printf("  模拟时长: %v\n", duration)
		fmt.Println()

		fmt.Println("预测指标:")
		for key, value := range result.Metrics {
			switch v := value.(type) {
			case float64:
				fmt.Printf("  %s: %.4f\n", key, v)
			case int:
				fmt.Printf("  %s: %d\n", key, v)
			default:
				fmt.Printf("  %s: %v\n", key, v)
			}
		}
		fmt.Println()

		if len(result.Warnings) > 0 {
			fmt.Println("⚠️  警告:")
			for i, warning := range result.Warnings {
				fmt.Printf("  %d. %s\n", i+1, warning)
			}
			fmt.Println()
		}

		fmt.Println("下一步:")
		fmt.Printf("  memreplay simulate --cache-ttl 7200 --max-cache-size 50000\n")
		fmt.Printf("  memreplay export --format markdown --output ./simulation-report.md\n")
	},
}

func parseDurationWithDefault(s string, defaultVal time.Duration) (time.Duration, error) {
	if s == "" {
		return defaultVal, nil
	}

	d, err := time.ParseDuration(s)
	if err == nil {
		return d, nil
	}

	seconds, err := strconv.ParseInt(s, 10, 64)
	if err == nil {
		return time.Duration(seconds) * time.Second, nil
	}

	return 0, fmt.Errorf("无效的时间格式: %s", s)
}

func init() {
	rootCmd.AddCommand(simulateCmd)

	simulateCmd.Flags().String("cache-ttl", "1h", "缓存 TTL (支持 1h, 30m, 86400 等格式)")
	simulateCmd.Flags().Int("max-cache-size", 100000, "最大缓存大小 (0 表示无限制)")
	simulateCmd.Flags().Int("worker-count", 100, "Worker/Goroutine 数量")
	simulateCmd.Flags().Int("gc-percent", 100, "GC 百分比 (GOGC)")
	simulateCmd.Flags().Float64("request-rate", 100, "请求速率 (QPS)")
	simulateCmd.Flags().Int("avg-request-size", 1024, "平均请求大小 (bytes)")
	simulateCmd.Flags().Int("avg-response-size", 2048, "平均响应大小 (bytes)")
	simulateCmd.Flags().String("duration", "24h", "模拟时长")
	simulateCmd.Flags().Bool("save", false, "保存模拟结果到数据库")
}
