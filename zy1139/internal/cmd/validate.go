package cmd

import (
	"fmt"
	"os"

	"capgate/internal/config"

	"github.com/spf13/cobra"
)

var validateCmd = &cobra.Command{
	Use:   "validate",
	Short: "验证配置文件格式和内容",
	Long: `检查所有输入文件的格式正确性、字段完整性、引用一致性等。
验证项目包括：
- routes.yaml: 字段是否缺失、值范围是否有效、依赖引用是否存在
- traffic-plan.json: 路由引用是否存在、场景类型是否有效
- baseline.csv: 数值格式是否正确
- dependency-limits.yaml: 依赖限额是否合理`,
	RunE: func(cmd *cobra.Command, args []string) error {
		routesFile, _ := cmd.Flags().GetString("routes")
		trafficFile, _ := cmd.Flags().GetString("traffic")
		baselineFile, _ := cmd.Flags().GetString("baseline")
		depsFile, _ := cmd.Flags().GetString("deps")

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

		fmt.Println("开始验证配置文件...")
		fmt.Printf("  routes: %s\n", routesFile)
		fmt.Printf("  traffic: %s\n", trafficFile)
		fmt.Printf("  baseline: %s\n", baselineFile)
		fmt.Printf("  deps: %s\n\n", depsFile)

		hasErrors := false

		if config.FileExists(routesFile) {
			fmt.Printf("📋 验证 routes.yaml...\n")
			routes, err := config.LoadRoutes(routesFile)
			if err != nil {
				fmt.Printf("  ❌ 加载失败: %v\n", err)
				hasErrors = true
			} else {
				errs := config.ValidateRoutes(routes)
				if len(errs) > 0 {
					fmt.Printf("  ❌ 发现 %d 个问题:\n", len(errs))
					for i, e := range errs {
						fmt.Printf("     %d. %s\n", i+1, e)
					}
					hasErrors = true
				} else {
					fmt.Printf("  ✅ 验证通过 (%d 个路由)\n", len(routes))
				}
			}
		} else {
			fmt.Printf("⚠️  routes.yaml 不存在，跳过验证\n")
		}
		fmt.Println()

		if config.FileExists(trafficFile) {
			fmt.Printf("📋 验证 traffic-plan.json...\n")
			plan, err := config.LoadTrafficPlan(trafficFile)
			if err != nil {
				fmt.Printf("  ❌ 加载失败: %v\n", err)
				hasErrors = true
			} else {
				errs := config.ValidateTrafficPlan(plan)
				if len(errs) > 0 {
					fmt.Printf("  ❌ 发现 %d 个问题:\n", len(errs))
					for i, e := range errs {
						fmt.Printf("     %d. %s\n", i+1, e)
					}
					hasErrors = true
				} else {
					fmt.Printf("  ✅ 验证通过 (计划: %s, %d 个路由, %d 个场景)\n",
						plan.PlanName, len(plan.Routes), len(plan.Scenarios))
				}
			}
		} else {
			fmt.Printf("⚠️  traffic-plan.json 不存在，跳过验证\n")
		}
		fmt.Println()

		if config.FileExists(baselineFile) {
			fmt.Printf("📋 验证 baseline.csv...\n")
			baseline, err := config.LoadBaseline(baselineFile)
			if err != nil {
				fmt.Printf("  ❌ 加载失败: %v\n", err)
				hasErrors = true
			} else {
				errs := config.ValidateBaseline(baseline)
				if len(errs) > 0 {
					fmt.Printf("  ❌ 发现 %d 个问题:\n", len(errs))
					for i, e := range errs {
						fmt.Printf("     %d. %s\n", i+1, e)
					}
					hasErrors = true
				} else {
					fmt.Printf("  ✅ 验证通过 (%d 条基线记录)\n", len(baseline))
				}
			}
		} else {
			fmt.Printf("⚠️  baseline.csv 不存在，跳过验证\n")
		}
		fmt.Println()

		if config.FileExists(depsFile) {
			fmt.Printf("📋 验证 dependency-limits.yaml...\n")
			deps, err := config.LoadDependencyLimits(depsFile)
			if err != nil {
				fmt.Printf("  ❌ 加载失败: %v\n", err)
				hasErrors = true
			} else {
				errs := config.ValidateDependencyLimits(deps)
				if len(errs) > 0 {
					fmt.Printf("  ❌ 发现 %d 个问题:\n", len(errs))
					for i, e := range errs {
						fmt.Printf("     %d. %s\n", i+1, e)
					}
					hasErrors = true
				} else {
					fmt.Printf("  ✅ 验证通过 (%d 个依赖)\n", len(deps))
				}
			}
		} else {
			fmt.Printf("⚠️  dependency-limits.yaml 不存在，跳过验证\n")
		}
		fmt.Println()

		allExist := config.FileExists(routesFile) && config.FileExists(trafficFile) && config.FileExists(depsFile)
		if allExist {
			fmt.Printf("🔗 验证跨文件引用一致性...\n")
			routes, _ := config.LoadRoutes(routesFile)
			plan, _ := config.LoadTrafficPlan(trafficFile)
			deps, _ := config.LoadDependencyLimits(depsFile)

			errs := config.ValidateCrossReferences(routes, plan, deps)
			if len(errs) > 0 {
				fmt.Printf("  ❌ 发现 %d 个引用问题:\n", len(errs))
				for i, e := range errs {
					fmt.Printf("     %d. %s\n", i+1, e)
				}
				hasErrors = true
			} else {
				fmt.Println("  ✅ 所有引用一致")
			}
		}
		fmt.Println()

		if hasErrors {
			fmt.Println("❌ 验证失败，请修复上述问题后重试")
			os.Exit(1)
		} else {
			fmt.Println("✅ 所有验证通过！配置文件可以安全使用")
		}

		return nil
	},
}

func init() {
	validateCmd.Flags().StringP("routes", "r", "", "路由配置文件路径 (默认: routes.yaml)")
	validateCmd.Flags().StringP("traffic", "t", "", "流量计划文件路径 (默认: traffic-plan.json)")
	validateCmd.Flags().StringP("baseline", "b", "", "基线数据文件路径 (默认: baseline.csv)")
	validateCmd.Flags().StringP("deps", "d", "", "依赖限额文件路径 (默认: dependency-limits.yaml)")
}
