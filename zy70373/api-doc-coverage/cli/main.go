package main

import (
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/example/api-doc-coverage/cli/pkg/checker"
	"github.com/example/api-doc-coverage/cli/pkg/config"
	"github.com/example/api-doc-coverage/cli/pkg/ignore"
	"github.com/example/api-doc-coverage/cli/pkg/openapi"
	"github.com/example/api-doc-coverage/cli/pkg/reporter"
	"github.com/example/api-doc-coverage/cli/pkg/scanner"
)

func main() {
	if len(os.Args) < 2 {
		printUsage()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "scan":
		runScanCommand(os.Args[2:])
	case "check-examples":
		runCheckExamplesCommand(os.Args[2:])
	case "diff":
		runDiffCommand(os.Args[2:])
	case "mark-ignore":
		runMarkIgnoreCommand(os.Args[2:])
	case "report":
		runReportCommand(os.Args[2:])
	default:
		fmt.Printf("未知命令: %s\n\n", command)
		printUsage()
		os.Exit(1)
	}
}

func printUsage() {
	fmt.Println("API 文档覆盖率 CLI")
	fmt.Println("用法: api-doc-coverage <命令> [选项]")
	fmt.Println()
	fmt.Println("可用命令:")
	fmt.Println("  scan           - 扫描路由和文档，输出总体状态")
	fmt.Println("  check-examples - 检查示例请求与文档一致性")
	fmt.Println("  diff           - 比较路由与文档差异")
	fmt.Println("  mark-ignore    - 标记忽略项（带原因和过期时间）")
	fmt.Println("  report         - 生成完整覆盖率报告")
	fmt.Println()
	fmt.Println("通用选项:")
	fmt.Println("  -config <path>  配置文件路径（默认: api-doc-coverage.yaml）")
	fmt.Println()
	fmt.Println("示例:")
	fmt.Println("  api-doc-coverage scan")
	fmt.Println("  api-doc-coverage report -output report.json")
	fmt.Println("  api-doc-coverage mark-ignore -pattern \"GET /internal/.*\" -reason \"内部接口暂不文档化\" -expires 30")
}

func getConfig(configPath string) (*config.Config, error) {
	if configPath == "" {
		configPath = "api-doc-coverage.yaml"
	}
	return config.Load(configPath)
}

func runScanCommand(args []string) {
	cmd := flag.NewFlagSet("scan", flag.ExitOnError)
	configPath := cmd.String("config", "", "配置文件路径")
	showDetails := cmd.Bool("details", false, "显示详细信息")
	cmd.Parse(args)

	cfg, err := getConfig(*configPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("正在扫描路由...")
	routes, err := scanner.ScanRoutes(cfg)
	if err != nil {
		fmt.Printf("扫描路由失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("正在解析 OpenAPI 文档...")
	openapiRoutes, err := openapi.Parse(cfg.OpenAPIPath)
	if err != nil {
		fmt.Printf("解析 OpenAPI 文档失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("正在扫描示例...")
	examples, err := scanner.ScanExamples(cfg.ExamplesDir)
	if err != nil {
		fmt.Printf("扫描示例失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("\n扫描结果:\n")
	fmt.Printf("  发现路由:       %d\n", len(routes))
	fmt.Printf("  文档路由:       %d\n", len(openapiRoutes))
	fmt.Printf("  示例请求:       %d\n", len(examples))

	if *showDetails {
		fmt.Println("\n--- 路由列表 ---")
		for _, r := range routes {
			fmt.Printf("  %s %s [%s] @%s\n", r.Method, r.Path, r.Service, r.Owner)
		}
	}
}

func runCheckExamplesCommand(args []string) {
	cmd := flag.NewFlagSet("check-examples", flag.ExitOnError)
	configPath := cmd.String("config", "", "配置文件路径")
	cmd.Parse(args)

	cfg, err := getConfig(*configPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	openapiRoutes, err := openapi.Parse(cfg.OpenAPIPath)
	if err != nil {
		fmt.Printf("解析 OpenAPI 文档失败: %v\n", err)
		os.Exit(1)
	}

	examples, err := scanner.ScanExamples(cfg.ExamplesDir)
	if err != nil {
		fmt.Printf("扫描示例失败: %v\n", err)
		os.Exit(1)
	}

	issues := checker.CheckExamples(examples, openapiRoutes)
	reporter.PrintExampleIssues(issues)

	if len(issues) > 0 {
		for _, issue := range issues {
			if issue.Severity == "blocker" {
				os.Exit(1)
			}
		}
	}
}

func runDiffCommand(args []string) {
	cmd := flag.NewFlagSet("diff", flag.ExitOnError)
	configPath := cmd.String("config", "", "配置文件路径")
	useIgnore := cmd.Bool("ignore", true, "应用忽略规则")
	cmd.Parse(args)

	cfg, err := getConfig(*configPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	routes, err := scanner.ScanRoutes(cfg)
	if err != nil {
		fmt.Printf("扫描路由失败: %v\n", err)
		os.Exit(1)
	}

	openapiRoutes, err := openapi.Parse(cfg.OpenAPIPath)
	if err != nil {
		fmt.Printf("解析 OpenAPI 文档失败: %v\n", err)
		os.Exit(1)
	}

	diff := checker.DiffRoutes(routes, openapiRoutes)

	if *useIgnore && cfg.IgnoreFile != "" {
		ignoreList, err := ignore.Load(cfg.IgnoreFile)
		if err == nil {
			diff = ignore.FilterDiffResult(diff, ignoreList)
		}
	}

	reporter.PrintDiffResult(diff)
}

func runMarkIgnoreCommand(args []string) {
	cmd := flag.NewFlagSet("mark-ignore", flag.ExitOnError)
	configPath := cmd.String("config", "", "配置文件路径")
	pattern := cmd.String("pattern", "", "匹配模式（支持正则）")
	itemType := cmd.String("type", "", "忽略类型（如: UNDOCUMENTED）")
	reason := cmd.String("reason", "", "忽略原因")
	service := cmd.String("service", "", "服务名称")
	owner := cmd.String("owner", "", "负责人")
	expiresDays := cmd.Int("expires", 90, "过期天数（默认 90 天）")
	remove := cmd.String("remove", "", "要移除的忽略项 ID")
	list := cmd.Bool("list", false, "列出所有忽略项")
	cmd.Parse(args)

	cfg, err := getConfig(*configPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	if cfg.IgnoreFile == "" {
		cfg.IgnoreFile = ".api-doc-coverage-ignore.json"
	}

	ignoreList, err := ignore.Load(cfg.IgnoreFile)
	if err != nil {
		fmt.Printf("加载忽略列表失败: %v\n", err)
		os.Exit(1)
	}

	if *list {
		fmt.Println("忽略项列表:")
		for _, item := range ignoreList.Items {
			expired := time.Now().After(item.ExpiresAt)
			status := "有效"
			if expired {
				status = "已过期"
			}
			fmt.Printf("\nID: %s\n", item.ID)
			fmt.Printf("  模式: %s\n", item.Pattern)
			fmt.Printf("  类型: %s\n", item.Type)
			fmt.Printf("  原因: %s\n", item.Reason)
			fmt.Printf("  服务: %s\n", item.Service)
			fmt.Printf("  负责人: %s\n", item.Owner)
			fmt.Printf("  创建: %s\n", item.CreatedAt.Format("2006-01-02"))
			fmt.Printf("  过期: %s [%s]\n", item.ExpiresAt.Format("2006-01-02"), status)
		}
		return
	}

	if *remove != "" {
		if ignoreList.Remove(*remove) {
			err = ignore.Save(ignoreList, cfg.IgnoreFile)
			if err != nil {
				fmt.Printf("保存失败: %v\n", err)
				os.Exit(1)
			}
			fmt.Printf("已移除忽略项: %s\n", *remove)
		} else {
			fmt.Printf("未找到忽略项: %s\n", *remove)
			os.Exit(1)
		}
		return
	}

	if *pattern == "" {
		fmt.Println("错误: 必须提供 -pattern 参数")
		cmd.Usage()
		os.Exit(1)
	}

	if *reason == "" {
		fmt.Println("错误: 必须提供 -reason 参数")
		cmd.Usage()
		os.Exit(1)
	}

	expiresAt := time.Now().AddDate(0, 0, *expiresDays)
	item := ignoreList.Add(*pattern, *itemType, *reason, *service, *owner, expiresAt)

	err = ignore.Save(ignoreList, cfg.IgnoreFile)
	if err != nil {
		fmt.Printf("保存失败: %v\n", err)
		os.Exit(1)
	}

	fmt.Println("已添加忽略项:")
	fmt.Printf("  ID:      %s\n", item.ID)
	fmt.Printf("  模式:    %s\n", item.Pattern)
	fmt.Printf("  原因:    %s\n", item.Reason)
	fmt.Printf("  过期:    %s\n", item.ExpiresAt.Format("2006-01-02"))
}

func runReportCommand(args []string) {
	cmd := flag.NewFlagSet("report", flag.ExitOnError)
	configPath := cmd.String("config", "", "配置文件路径")
	outputPath := cmd.String("output", "", "JSON 输出文件路径")
	useIgnore := cmd.Bool("ignore", true, "应用忽略规则")
	cmd.Parse(args)

	cfg, err := getConfig(*configPath)
	if err != nil {
		fmt.Printf("加载配置失败: %v\n", err)
		os.Exit(1)
	}

	routes, err := scanner.ScanRoutes(cfg)
	if err != nil {
		fmt.Printf("扫描路由失败: %v\n", err)
		os.Exit(1)
	}

	openapiRoutes, err := openapi.Parse(cfg.OpenAPIPath)
	if err != nil {
		fmt.Printf("解析 OpenAPI 文档失败: %v\n", err)
		os.Exit(1)
	}

	examples, err := scanner.ScanExamples(cfg.ExamplesDir)
	if err != nil {
		fmt.Printf("扫描示例失败: %v\n", err)
		os.Exit(1)
	}

	checkResult := checker.RunFullCheck(routes, openapiRoutes, examples)

	if *useIgnore && cfg.IgnoreFile != "" {
		ignoreList, err := ignore.Load(cfg.IgnoreFile)
		if err == nil {
			checkResult = ignore.FilterCheckResult(checkResult, ignoreList)
		}
	}

	report := reporter.GenerateReport(routes, openapiRoutes, checkResult)
	reporter.PrintTextReport(report)

	if *outputPath != "" {
		err = reporter.SaveJSONReport(report, *outputPath)
		if err != nil {
			fmt.Printf("\n保存 JSON 报告失败: %v\n", err)
		} else {
			fmt.Printf("\nJSON 报告已保存到: %s\n", *outputPath)
		}
	}

	if len(report.Blockers) > 0 {
		os.Exit(1)
	}
}
