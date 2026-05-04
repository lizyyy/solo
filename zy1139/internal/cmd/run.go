package cmd

import (
	"fmt"
	"os"
	"time"

	"capgate/internal/config"
	"capgate/internal/engine"
	"capgate/internal/models"

	"github.com/spf13/cobra"
)

var runCmd = &cobra.Command{
	Use:   "run",
	Short: "执行压测计划并生成预算闸门结论",
	Long: `根据流量计划执行压测模拟，检查每个接口在不同并发/RPS下的
延迟、错误率、CPU、依赖调用量等指标是否超过预算，并生成容量闸门结论。`,
	RunE: func(cmd *cobra.Command, args []string) error {
		routesFile, _ := cmd.Flags().GetString("routes")
		trafficFile, _ := cmd.Flags().GetString("traffic")
		baselineFile, _ := cmd.Flags().GetString("baseline")
		depsFile, _ := cmd.Flags().GetString("deps")
		outputDir, _ := cmd.Flags().GetString("output")
		runName, _ := cmd.Flags().GetString("name")
		skipScenario, _ := cmd.Flags().GetStringSlice("skip-scenario")

		if routesFile == "" {
			routesFile = "routes.yaml"
		}
		if trafficFile == "" {
			trafficFile = "traffic-plan.json"
		}
		if baselineFile == "" {
			baselineFile = "baseline.csv"
		}
		if depsFile == "" {
			depsFile = "dependency-limits.yaml"
		}
		if outputDir == "" {
			outputDir = "./results"
		}
		if runName == "" {
			runName = fmt.Sprintf("run-%s", time.Now().Format("20060102-150405"))
		}

		fmt.Println("🚀 开始执行压测计划...")
		fmt.Printf("  运行名称: %s\n", runName)
		fmt.Printf("  路由配置: %s\n", routesFile)
		fmt.Printf("  流量计划: %s\n", trafficFile)
		fmt.Printf("  基线数据: %s\n", baselineFile)
		fmt.Printf("  依赖限额: %s\n", depsFile)
		fmt.Printf("  输出目录: %s\n\n", outputDir)

		if err := config.EnsureDir(outputDir); err != nil {
			return fmt.Errorf("创建输出目录失败: %w", err)
		}

		fmt.Println("📥 加载配置文件...")

		routes, err := config.LoadRoutes(routesFile)
		if err != nil {
			return fmt.Errorf("加载路由配置失败: %w", err)
		}
		fmt.Printf("  ✓ 加载 %d 个路由\n", len(routes))

		plan, err := config.LoadTrafficPlan(trafficFile)
		if err != nil {
			return fmt.Errorf("加载流量计划失败: %w", err)
		}
		fmt.Printf("  ✓ 加载计划: %s\n", plan.PlanName)

		baseline := []models.BaselineRecord{}
		if config.FileExists(baselineFile) {
			baseline, err = config.LoadBaseline(baselineFile)
			if err != nil {
				fmt.Printf("  ⚠  加载基线数据失败: %v\n", err)
			} else {
				fmt.Printf("  ✓ 加载 %d 条基线记录\n", len(baseline))
			}
		} else {
			fmt.Println("  ℹ 基线数据文件不存在，使用默认基线")
		}

		deps := []models.DependencyLimit{}
		if config.FileExists(depsFile) {
			deps, err = config.LoadDependencyLimits(depsFile)
			if err != nil {
				fmt.Printf("  ⚠  加载依赖限额失败: %v\n", err)
			} else {
				fmt.Printf("  ✓ 加载 %d 个依赖限额\n", len(deps))
			}
		}

		if len(skipScenario) > 0 {
			var filteredScenarios []models.Scenario
			for _, sc := range plan.Scenarios {
				skip := false
				for _, skipName := range skipScenario {
					if sc.Name == skipName {
						skip = true
						break
					}
				}
				if !skip {
					filteredScenarios = append(filteredScenarios, sc)
				}
			}
			plan.Scenarios = filteredScenarios
		}

		if len(plan.Scenarios) > 0 {
			fmt.Printf("\n🔧 应用场景 (%d 个):\n", len(plan.Scenarios))
			for _, sc := range plan.Scenarios {
				fmt.Printf("  - %s (%s)\n", sc.Name, sc.Type)
			}
		}

		fmt.Println("\n⚙️  执行压测模拟...")

		sim := engine.NewSimulator(routes, plan, deps, baseline)
		result, err := sim.Run()
		if err != nil {
			return fmt.Errorf("压测执行失败: %w", err)
		}

		fmt.Println("\n📊 执行结果汇总:")
		fmt.Printf("  总体状态: ")
		switch result.OverallStatus {
		case models.StatusPass:
			fmt.Println("✅ PASS")
		case models.StatusWarning:
			fmt.Println("⚠️  WARNING")
		case models.StatusFail:
			fmt.Println("❌ FAIL")
		}

		passCount := 0
		warnCount := 0
		failCount := 0

		fmt.Printf("\n  各路由状态:\n")
		for _, rr := range result.RouteResults {
			statusIcon := "✅"
			switch rr.Status {
			case models.StatusPass:
				passCount++
			case models.StatusWarning:
				warnCount++
				statusIcon = "⚠️"
			case models.StatusFail:
				failCount++
				statusIcon = "❌"
			}
			fmt.Printf("    %s %s: p95=%.1fms, rps=%.0f, errors=%.4f%%\n",
				statusIcon, rr.RouteName,
				rr.LatencyMetrics.P95Ms,
				rr.Throughput.ActualRPS,
				rr.ErrorMetrics.ErrorRate*100)
		}

		fmt.Printf("\n  汇总: %d PASS, %d WARNING, %d FAIL\n", passCount, warnCount, failCount)

		if len(result.DependencyMetrics) > 0 {
			fmt.Printf("\n  依赖调用状态:\n")
			for _, dm := range result.DependencyMetrics {
				if dm.TotalCalls > 0 {
					statusIcon := "✅"
					if dm.Status == models.StatusFail {
						statusIcon = "❌"
					}
					fmt.Printf("    %s %s: qps=%.0f (限额: %d)\n",
						statusIcon, dm.Name, dm.CallsPerSec, dm.MaxQPS)
				}
			}
		}

		outputFile := fmt.Sprintf("%s/%s-result.json", outputDir, runName)
		if err := config.SaveRunResult(result, outputFile); err != nil {
			return fmt.Errorf("保存结果失败: %w", err)
		}
		fmt.Printf("\n💾 结果已保存到: %s\n", outputFile)

		if result.OverallStatus == models.StatusFail {
			fmt.Println("\n⚠️  容量闸门检查未通过！不建议上线。")
			os.Exit(1)
		} else if result.OverallStatus == models.StatusWarning {
			fmt.Println("\n⚠️  部分指标接近阈值，建议进一步检查。")
		} else {
			fmt.Println("\n✅ 容量闸门检查通过！")
		}

		return nil
	},
}

func init() {
	runCmd.Flags().StringP("routes", "r", "", "路由配置文件路径 (默认: routes.yaml)")
	runCmd.Flags().StringP("traffic", "t", "", "流量计划文件路径 (默认: traffic-plan.json)")
	runCmd.Flags().StringP("baseline", "b", "", "基线数据文件路径 (默认: baseline.csv)")
	runCmd.Flags().StringP("deps", "d", "", "依赖限额文件路径 (默认: dependency-limits.yaml)")
	runCmd.Flags().StringP("output", "o", "", "输出目录 (默认: ./results)")
	runCmd.Flags().StringP("name", "n", "", "运行名称 (默认: run-时间戳)")
	runCmd.Flags().StringSliceP("skip-scenario", "s", []string{}, "跳过指定的场景 (可多次使用)")
}
