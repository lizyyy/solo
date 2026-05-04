package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"msctl/internal/analyzer"
	"msctl/internal/importer"
	"msctl/internal/models"
	"msctl/internal/plan"
	"msctl/internal/report"
	"msctl/internal/validator"
	"msctl/internal/workspace"
	"msctl/pkg/utils"

	"github.com/spf13/cobra"
)

func NewInitCmd() *cobra.Command {
	var (
		name        string
		description string
	)

	cmd := &cobra.Command{
		Use:   "init [path]",
		Short: "初始化一个新的微服务治理工作空间",
		Long: `在指定路径创建一个新的微服务治理工作空间，包括必要的目录结构和配置文件。
如果未指定路径，则使用当前目录。`,
		Args: cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			rootPath := "."
			if len(args) > 0 {
				rootPath = args[0]
			}

			absPath, err := filepath.Abs(rootPath)
			if err != nil {
				return fmt.Errorf("获取绝对路径失败: %w", err)
			}

			if name == "" {
				name = filepath.Base(absPath)
			}

			wsManager := workspace.NewManager(absPath)

			if wsManager.Exists() {
				return fmt.Errorf("工作空间已存在: %s", absPath)
			}

			if err := wsManager.Init(name, description); err != nil {
				return err
			}

			fmt.Printf("✅ 工作空间初始化成功: %s\n", absPath)
			fmt.Println("\n下一步:")
			fmt.Println("  1. 准备以下数据文件:")
			fmt.Println("     - services.yaml: 服务定义")
			fmt.Println("     - openapi/: OpenAPI 文档目录")
			fmt.Println("     - call-edges.jsonl: 服务调用关系")
			fmt.Println("     - owners.csv: 服务负责人")
			fmt.Println("     - policies.yaml: SLO/限流策略")
			fmt.Println("     - deploy-plan.yaml: 发布计划")
			fmt.Println("  2. 运行: msctl import --services <path> --openapi <dir> ...")
			return nil
		},
	}

	cmd.Flags().StringVarP(&name, "name", "n", "", "工作空间名称 (默认使用目录名)")
	cmd.Flags().StringVarP(&description, "description", "d", "", "工作空间描述")

	return cmd
}

func NewImportCmd() *cobra.Command {
	var (
		servicesPath   string
		openapiDir     string
		callEdgesPath  string
		ownersPath     string
		policiesPath   string
		deployPlanPath string
	)

	cmd := &cobra.Command{
		Use:   "import",
		Short: "导入微服务治理数据到工作空间",
		Long:  `从外部源导入服务定义、OpenAPI 文档、调用关系、负责人、策略和发布计划到当前工作空间。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			currentDir, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("获取当前目录失败: %w", err)
			}

			wsManager := workspace.NewManager(currentDir)
			if !wsManager.Exists() {
				return fmt.Errorf("当前目录不是有效的工作空间，请先运行 'msctl init'")
			}

			config := models.ImportConfig{}

			if servicesPath != "" {
				absPath, err := filepath.Abs(servicesPath)
				if err != nil {
					return err
				}
				if !utils.FileExists(absPath) {
					return fmt.Errorf("服务文件不存在: %s", absPath)
				}
				config.ServicesPath = absPath
			}

			if openapiDir != "" {
				absPath, err := filepath.Abs(openapiDir)
				if err != nil {
					return err
				}
				if !utils.DirExists(absPath) {
					return fmt.Errorf("OpenAPI 目录不存在: %s", absPath)
				}
				config.OpenAPIDir = absPath
			}

			if callEdgesPath != "" {
				absPath, err := filepath.Abs(callEdgesPath)
				if err != nil {
					return err
				}
				if !utils.FileExists(absPath) {
					return fmt.Errorf("调用关系文件不存在: %s", absPath)
				}
				config.CallEdgesPath = absPath
			}

			if ownersPath != "" {
				absPath, err := filepath.Abs(ownersPath)
				if err != nil {
					return err
				}
				if !utils.FileExists(absPath) {
					return fmt.Errorf("负责人文件不存在: %s", absPath)
				}
				config.OwnersPath = absPath
			}

			if policiesPath != "" {
				absPath, err := filepath.Abs(policiesPath)
				if err != nil {
					return err
				}
				if !utils.FileExists(absPath) {
					return fmt.Errorf("策略文件不存在: %s", absPath)
				}
				config.PoliciesPath = absPath
			}

			if deployPlanPath != "" {
				absPath, err := filepath.Abs(deployPlanPath)
				if err != nil {
					return err
				}
				if !utils.FileExists(absPath) {
					return fmt.Errorf("发布计划文件不存在: %s", absPath)
				}
				config.DeployPlanPath = absPath
			}

			imp := importer.NewImporter(wsManager)
			ws, err := imp.Import(config)
			if err != nil {
				return err
			}

			fmt.Println("✅ 导入成功!")
			fmt.Printf("\n统计:\n")
			fmt.Printf("  - 服务: %d\n", len(ws.Services))
			fmt.Printf("  - 调用边: %d\n", len(ws.CallEdges))
			fmt.Printf("  - Owner: %d\n", len(ws.Owners))
			fmt.Printf("  - 策略: %d\n", len(ws.Policies))
			if ws.DeployPlan != nil {
				fmt.Printf("  - 发布批次: %d\n", len(ws.DeployPlan.Batches))
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&servicesPath, "services", "", "服务定义文件路径 (services.yaml)")
	cmd.Flags().StringVar(&openapiDir, "openapi", "", "OpenAPI 文档目录路径")
	cmd.Flags().StringVar(&callEdgesPath, "call-edges", "", "调用关系文件路径 (call-edges.jsonl)")
	cmd.Flags().StringVar(&ownersPath, "owners", "", "负责人文件路径 (owners.csv)")
	cmd.Flags().StringVar(&policiesPath, "policies", "", "策略文件路径 (policies.yaml)")
	cmd.Flags().StringVar(&deployPlanPath, "deploy-plan", "", "发布计划文件路径 (deploy-plan.yaml)")

	return cmd
}

func NewValidateCmd() *cobra.Command {
	var (
		allFiles bool
	)

	cmd := &cobra.Command{
		Use:   "validate [files...]",
		Short: "校验输入数据的 Schema 正确性",
		Long: `校验工作空间中的数据文件或指定文件的 Schema 正确性，包括:
- services.yaml 格式和内容
- call-edges.jsonl 格式和内容
- owners.csv 格式和内容
- policies.yaml 格式和内容
- deploy-plan.yaml 格式和内容
- OpenAPI 文档格式`,
		RunE: func(cmd *cobra.Command, args []string) error {
			currentDir, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("获取当前目录失败: %w", err)
			}

			wsManager := workspace.NewManager(currentDir)

			v := validator.NewValidator()

			if len(args) > 0 {
				for _, path := range args {
					absPath, err := filepath.Abs(path)
					if err != nil {
						return err
					}

					fmt.Printf("\n📋 校验文件: %s\n", absPath)
					result, err := v.ValidateFile(absPath)
					if err != nil {
						return err
					}

					printValidationResult(result)
				}
				return nil
			}

			if !wsManager.Exists() {
				return fmt.Errorf("当前目录不是有效的工作空间，请先运行 'msctl init' 或指定要校验的文件")
			}

			ws, err := wsManager.LoadWorkspace()
			if err != nil {
				return err
			}

			fmt.Println("📋 校验工作空间数据...")
			result, err := v.ValidateWorkspace(ws)
			if err != nil {
				return err
			}

			printValidationResult(result)

			if !result.Valid {
				return fmt.Errorf("校验失败，存在 %d 个错误", result.ErrorCount)
			}

			return nil
		},
	}

	cmd.Flags().BoolVarP(&allFiles, "all", "a", false, "校验所有数据文件")

	return cmd
}

func printValidationResult(result *models.ValidationResult) {
	if result.Valid {
		fmt.Println("✅ 校验通过!")
	} else {
		fmt.Printf("❌ 校验失败，存在 %d 个错误:\n\n", result.ErrorCount)
		for _, err := range result.Errors {
			fmt.Printf("  🔴 错误: %s\n", err.ErrorMessage)
			if err.File != "" {
				fmt.Printf("     文件: %s\n", err.File)
			}
			if err.FieldPath != "" {
				fmt.Printf("     字段: %s\n", err.FieldPath)
			}
			if err.Suggestion != "" {
				fmt.Printf("     建议: %s\n", err.Suggestion)
			}
			fmt.Println()
		}
	}

	if len(result.Warnings) > 0 {
		fmt.Printf("\n⚠️  警告 (%d 个):\n\n", len(result.Warnings))
		for _, warn := range result.Warnings {
			fmt.Printf("  🟡 %s\n", warn.ErrorMessage)
			if warn.File != "" {
				fmt.Printf("     文件: %s\n", warn.File)
			}
			if warn.Suggestion != "" {
				fmt.Printf("     建议: %s\n", warn.Suggestion)
			}
			fmt.Println()
		}
	}
}

func NewAnalyzeCmd() *cobra.Command {
	var (
		outputFormat string
		outputPath   string
		saveResult   bool
	)

	cmd := &cobra.Command{
		Use:   "analyze",
		Short: "分析微服务治理数据",
		Long: `分析工作空间中的微服务数据，识别:
- 破坏性契约变更
- 未声明调用
- 孤儿接口
- 依赖环
- Owner 缺失
- SLO/限流策略不匹配`,
		RunE: func(cmd *cobra.Command, args []string) error {
			currentDir, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("获取当前目录失败: %w", err)
			}

			wsManager := workspace.NewManager(currentDir)
			if !wsManager.Exists() {
				return fmt.Errorf("当前目录不是有效的工作空间，请先运行 'msctl init'")
			}

			ws, err := wsManager.LoadWorkspace()
			if err != nil {
				return err
			}

			a := analyzer.NewAnalyzer()
			result, err := a.Analyze(ws)
			if err != nil {
				return err
			}

			if saveResult {
				if err := wsManager.SaveAnalysisResult(result); err != nil {
					return err
				}
				fmt.Println("💾 分析结果已保存到 reports/ 目录")
			}

			printAnalysisSummary(result)

			if outputFormat != "" {
				if outputPath == "" {
					timestamp := utils.Timestamp()
					outputPath = fmt.Sprintf("analysis-%s.%s", timestamp, outputFormat)
				}

				exporter := report.NewExporter()
				if err := exporter.ExportAnalysis(result, outputFormat, outputPath); err != nil {
					return err
				}
				fmt.Printf("📄 报告已导出到: %s\n", outputPath)
			}

			if result.Summary.CriticalCount > 0 || result.Summary.HighCount > 0 {
				return fmt.Errorf("分析发现严重问题，请查看报告")
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&outputFormat, "format", "f", "", "输出格式: json, csv, md (markdown)")
	cmd.Flags().StringVarP(&outputPath, "output", "o", "", "输出文件路径")
	cmd.Flags().BoolVarP(&saveResult, "save", "s", true, "保存结果到工作空间")

	return cmd
}

func printAnalysisSummary(result *models.AnalysisResult) {
	fmt.Println("\n📊 分析摘要")
	fmt.Println(strings.Repeat("=", 50))

	status := "✅ 通过"
	if !result.Summary.Passed {
		status = "❌ 未通过"
	}
	fmt.Printf("总体状态: %s\n\n", status)

	fmt.Printf("服务总数: %d\n", result.Summary.TotalServices)
	fmt.Printf("端点总数: %d\n", result.Summary.TotalEndpoints)
	fmt.Printf("调用边总数: %d\n", result.Summary.TotalCallEdges)
	fmt.Println()

	fmt.Println("问题统计:")
	if result.Summary.CriticalCount > 0 {
		fmt.Printf("  🔴 CRITICAL: %d\n", result.Summary.CriticalCount)
	}
	if result.Summary.HighCount > 0 {
		fmt.Printf("  🟠 HIGH: %d\n", result.Summary.HighCount)
	}
	if result.Summary.MediumCount > 0 {
		fmt.Printf("  🟡 MEDIUM: %d\n", result.Summary.MediumCount)
	}
	if result.Summary.LowCount > 0 {
		fmt.Printf("  🟢 LOW: %d\n", result.Summary.LowCount)
	}

	if len(result.ServiceGraph.Cycles) > 0 {
		fmt.Printf("\n🔗 检测到 %d 个依赖环:\n", len(result.ServiceGraph.Cycles))
		for i, cycle := range result.ServiceGraph.Cycles {
			fmt.Printf("  %d. %s\n", i+1, strings.Join(cycle, " → "))
		}
	}

	if len(result.Issues) > 0 {
		fmt.Println("\n📋 问题详情:")
		sorted := analyzer.SortIssuesBySeverity(result.Issues)
		for i, issue := range sorted {
			if i >= 10 {
				fmt.Printf("  ... 还有 %d 个问题，请查看完整报告\n", len(sorted)-10)
				break
			}
			fmt.Printf("\n  %s [%s] %s\n",
				analyzer.GetSeverityColor(issue.Severity),
				issue.Severity,
				analyzer.GetIssueTypeLabel(issue.Type))
			fmt.Printf("     消息: %s\n", issue.Message)
		}
	}
}

func NewPlanCmd() *cobra.Command {
	var (
		outputFormat string
		outputPath   string
		saveResult   bool
	)

	cmd := &cobra.Command{
		Use:   "plan",
		Short: "分析发布计划",
		Long: `根据发布计划进行准入分析，包括:
- 检查阻断问题
- 分析发布顺序
- 评估受影响服务
- 分析回滚影响面`,
		RunE: func(cmd *cobra.Command, args []string) error {
			currentDir, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("获取当前目录失败: %w", err)
			}

			wsManager := workspace.NewManager(currentDir)
			if !wsManager.Exists() {
				return fmt.Errorf("当前目录不是有效的工作空间，请先运行 'msctl init'")
			}

			ws, err := wsManager.LoadWorkspace()
			if err != nil {
				return err
			}

			if ws.DeployPlan == nil {
				return fmt.Errorf("工作空间中没有发布计划，请先通过 'msctl import --deploy-plan <path>' 导入")
			}

			a := analyzer.NewAnalyzer()
			analysisResult, err := a.Analyze(ws)
			if err != nil {
				return err
			}

			p := plan.NewPlanner()
			result, err := p.Plan(ws, analysisResult)
			if err != nil {
				return err
			}

			if saveResult {
				if err := wsManager.SavePlanResult(result); err != nil {
					return err
				}
				fmt.Println("💾 发布计划分析结果已保存到 reports/ 目录")
			}

			printPlanSummary(result)

			if outputFormat != "" {
				if outputPath == "" {
					timestamp := utils.Timestamp()
					outputPath = fmt.Sprintf("plan-%s.%s", timestamp, outputFormat)
				}

				exporter := report.NewExporter()
				if err := exporter.ExportPlan(result, outputFormat, outputPath); err != nil {
					return err
				}
				fmt.Printf("📄 报告已导出到: %s\n", outputPath)
			}

			if result.Admission == models.AdmissionRejected {
				return fmt.Errorf("发布计划被拒绝: %s", result.AdmissionReason)
			}

			return nil
		},
	}

	cmd.Flags().StringVarP(&outputFormat, "format", "f", "", "输出格式: json, csv, md (markdown)")
	cmd.Flags().StringVarP(&outputPath, "output", "o", "", "输出文件路径")
	cmd.Flags().BoolVarP(&saveResult, "save", "s", true, "保存结果到工作空间")

	return cmd
}

func printPlanSummary(result *models.PlanResult) {
	fmt.Println("\n📋 发布计划分析")
	fmt.Println(strings.Repeat("=", 50))

	fmt.Printf("计划名称: %s\n", result.Title)
	fmt.Printf("分析时间: %s\n\n", result.Date)

	fmt.Printf("准入结论: %s\n", plan.GetAdmissionStatusLabel(result.Admission))
	fmt.Printf("原因: %s\n\n", result.AdmissionReason)

	if len(result.BlockingIssues) > 0 {
		fmt.Printf("❌ 阻断问题 (%d 个):\n", len(result.BlockingIssues))
		for _, issue := range result.BlockingIssues {
			fmt.Printf("\n  🔴 [%s] %s\n", issue.Severity, issue.IssueType)
			fmt.Printf("     描述: %s\n", issue.Description)
			fmt.Printf("     解决方案: %s\n", issue.Resolution)
		}
		fmt.Println()
	}

	if len(result.Warnings) > 0 {
		fmt.Printf("⚠️  警告事项 (%d 个):\n", len(result.Warnings))
		for _, warn := range result.Warnings {
			fmt.Printf("  %s [%s] %s\n",
				analyzer.GetSeverityColor(warn.Severity),
				warn.Severity,
				warn.Description)
		}
		fmt.Println()
	}

	if len(result.RecommendedOrder) > 0 {
		fmt.Println("📅 建议发布顺序:")
		for _, batch := range result.RecommendedOrder {
			fmt.Printf("  %d. %s: %s\n", batch.NewOrder, batch.OriginalName, strings.Join(batch.Services, ", "))
			if batch.Reason != "按原始 order 排序" {
				fmt.Printf("     注意: %s\n", batch.Reason)
			}
		}
	}

	if len(result.AffectedServices) > 0 {
		fmt.Println("\n🎯 受影响服务 (按风险等级):")
		for _, svc := range result.AffectedServices {
			riskEmoji := "🟢"
			if svc.RiskLevel == "高" {
				riskEmoji = "🔴"
			} else if svc.RiskLevel == "中" {
				riskEmoji = "🟡"
			}
			fmt.Printf("  %s %s (批次: %s, 风险: %s)\n", riskEmoji, svc.Name, svc.DeployBatch, svc.RiskLevel)
			if len(svc.DirectCallers) > 0 {
				fmt.Printf("     直接调用方: %s\n", strings.Join(svc.DirectCallers, ", "))
			}
		}
	}

	if result.RollbackImpact.TotalAffectedServices > 0 {
		fmt.Printf("\n🔄 回滚影响分析:\n")
		fmt.Printf("  受影响服务总数: %d\n", result.RollbackImpact.TotalAffectedServices)
		fmt.Printf("  预估停机时间: %s\n", result.RollbackImpact.EstimatedDowntime)
	}
}

func NewExportCmd() *cobra.Command {
	var (
		format     string
		outputDir  string
		reportType string
	)

	cmd := &cobra.Command{
		Use:   "export",
		Short: "导出分析报告",
		Long: `将最新的分析结果和发布计划导出为指定格式的报告。
支持格式: json, csv, md (markdown)`,
		RunE: func(cmd *cobra.Command, args []string) error {
			currentDir, err := os.Getwd()
			if err != nil {
				return fmt.Errorf("获取当前目录失败: %w", err)
			}

			wsManager := workspace.NewManager(currentDir)
			if !wsManager.Exists() {
				return fmt.Errorf("当前目录不是有效的工作空间，请先运行 'msctl init'")
			}

			ws, err := wsManager.LoadWorkspace()
			if err != nil {
				return err
			}

			var analysisResult *models.AnalysisResult
			var planResult *models.PlanResult

			if reportType == "analysis" || reportType == "all" {
				a := analyzer.NewAnalyzer()
				analysisResult, err = a.Analyze(ws)
				if err != nil {
					return err
				}
			}

			if reportType == "plan" || reportType == "all" {
				if ws.DeployPlan != nil {
					a := analyzer.NewAnalyzer()
					ar, err := a.Analyze(ws)
					if err != nil {
						return err
					}
					p := plan.NewPlanner()
					planResult, err = p.Plan(ws, ar)
					if err != nil {
						return err
					}
				}
			}

			if outputDir == "" {
				outputDir = wsManager.GetReportsDir()
			}

			exporter := report.NewExporter()
			if err := exporter.ExportCombined(analysisResult, planResult, format, outputDir); err != nil {
				return err
			}

			fmt.Printf("✅ 报告已导出到: %s\n", outputDir)
			return nil
		},
	}

	cmd.Flags().StringVarP(&format, "format", "f", "json", "输出格式: json, csv, md (markdown)")
	cmd.Flags().StringVarP(&outputDir, "output", "o", "", "输出目录 (默认使用工作空间的 reports/ 目录)")
	cmd.Flags().StringVarP(&reportType, "type", "t", "all", "报告类型: analysis, plan, all")

	return cmd
}
