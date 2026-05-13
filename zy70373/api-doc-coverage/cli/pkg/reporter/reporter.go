package reporter

import (
	"encoding/json"
	"fmt"
	"io/ioutil"
	"time"

	"github.com/example/api-doc-coverage/cli/pkg/checker"
	"github.com/example/api-doc-coverage/cli/pkg/models"
)

func GenerateReport(routes []models.Route, openapiRoutes []models.OpenAPIRoute, checkResult checker.CheckResult) *models.CoverageReport {
	report := &models.CoverageReport{
		Timestamp:   time.Now(),
		TotalRoutes: len(routes),
		ByService:   make(map[string]models.ServiceCoverage),
		ByOwner:     make(map[string]models.OwnerCoverage),
	}

	docRoutes := make(map[string]bool)
	for _, r := range openapiRoutes {
		key := fmt.Sprintf("%s %s", r.Method, r.Path)
		docRoutes[key] = true
	}

	documented := 0
	for _, route := range routes {
		key := fmt.Sprintf("%s %s", route.Method, route.Path)
		if docRoutes[key] {
			documented++
		}
	}

	report.Documented = documented
	report.Undocumented = len(routes) - documented
	report.Outdated = len(checkResult.Warnings)
	report.Blockers = checkResult.Blockers
	report.Warnings = checkResult.Warnings
	report.Suggestions = checkResult.Suggestions

	for _, route := range routes {
		key := fmt.Sprintf("%s %s", route.Method, route.Path)
		isDocumented := docRoutes[key]

		serviceCov, ok := report.ByService[route.Service]
		if !ok {
			serviceCov = models.ServiceCoverage{Service: route.Service}
		}
		serviceCov.TotalRoutes++
		if isDocumented {
			serviceCov.Documented++
		} else {
			serviceCov.Undocumented++
		}
		report.ByService[route.Service] = serviceCov

		ownerCov, ok := report.ByOwner[route.Owner]
		if !ok {
			ownerCov = models.OwnerCoverage{Owner: route.Owner}
		}
		ownerCov.TotalRoutes++
		if isDocumented {
			ownerCov.Documented++
		} else {
			ownerCov.Undocumented++
		}
		report.ByOwner[route.Owner] = ownerCov
	}

	for _, issue := range checkResult.Blockers {
		if sc, ok := report.ByService[issue.Route.Service]; ok {
			sc.Issues++
			sc.Blockers++
			report.ByService[issue.Route.Service] = sc
		}
		if oc, ok := report.ByOwner[issue.Route.Owner]; ok {
			oc.Issues++
			oc.Blockers++
			report.ByOwner[issue.Route.Owner] = oc
		}
	}

	warningCount := len(checkResult.Warnings)
	for name := range report.ByService {
		sc := report.ByService[name]
		sc.Warnings = warningCount
		report.ByService[name] = sc
	}
	for name := range report.ByOwner {
		oc := report.ByOwner[name]
		oc.Warnings = warningCount
		report.ByOwner[name] = oc
	}

	return report
}

func PrintTextReport(report *models.CoverageReport) {
	fmt.Println("========================================")
	fmt.Println("    API 文档覆盖率报告")
	fmt.Println("========================================")
	fmt.Printf("生成时间: %s\n\n", report.Timestamp.Format("2006-01-02 15:04:05"))

	coverageRate := 0.0
	if report.TotalRoutes > 0 {
		coverageRate = float64(report.Documented) / float64(report.TotalRoutes) * 100
	}

	fmt.Println("--- 总体统计 ---")
	fmt.Printf("总路由数:     %d\n", report.TotalRoutes)
	fmt.Printf("已文档化:     %d\n", report.Documented)
	fmt.Printf("未文档化:     %d\n", report.Undocumented)
	fmt.Printf("过期文档:     %d\n", report.Outdated)
	fmt.Printf("文档覆盖率:   %.1f%%\n", coverageRate)
	fmt.Printf("阻断问题数:   %d\n", len(report.Blockers))
	fmt.Printf("警告问题数:   %d\n", len(report.Warnings))
	fmt.Println()

	fmt.Println("--- 按服务分组 ---")
	for name, sc := range report.ByService {
		rate := 0.0
		if sc.TotalRoutes > 0 {
			rate = float64(sc.Documented) / float64(sc.TotalRoutes) * 100
		}
		fmt.Printf("\n  [%s] 覆盖率: %.1f%%\n", name, rate)
		fmt.Printf("    路由: %d/%d, 阻断: %d, 警告: %d\n",
			sc.Documented, sc.TotalRoutes, sc.Blockers, sc.Warnings)
	}
	fmt.Println()

	fmt.Println("--- 按负责人分组 ---")
	for name, oc := range report.ByOwner {
		rate := 0.0
		if oc.TotalRoutes > 0 {
			rate = float64(oc.Documented) / float64(oc.TotalRoutes) * 100
		}
		fmt.Printf("\n  [%s] 覆盖率: %.1f%%\n", name, rate)
		fmt.Printf("    路由: %d/%d, 阻断: %d, 警告: %d\n",
			oc.Documented, oc.TotalRoutes, oc.Blockers, oc.Warnings)
	}
	fmt.Println()

	if len(report.Blockers) > 0 {
		fmt.Println("--- 阻断问题 (必须修复) ---")
		for _, issue := range report.Blockers {
			fmt.Printf("\n  [%s] %s %s\n", issue.Severity, issue.Route.Method, issue.Route.Path)
			fmt.Printf("    类型: %s\n", issue.Type)
			fmt.Printf("    问题: %s\n", issue.Message)
			fmt.Printf("    建议: %s\n", issue.Suggestion)
		}
		fmt.Println()
	}

	if len(report.Warnings) > 0 {
		fmt.Println("--- 警告问题 (建议修复) ---")
		for _, issue := range report.Warnings {
			fmt.Printf("\n  [%s] %s %s\n", issue.Severity, issue.Route.Method, issue.Route.Path)
			fmt.Printf("    类型: %s\n", issue.Type)
			fmt.Printf("    问题: %s\n", issue.Message)
			fmt.Printf("    建议: %s\n", issue.Suggestion)
		}
		fmt.Println()
	}

	if len(report.Suggestions) > 0 {
		fmt.Println("--- 开发建议 (任务分派) ---")
		for _, s := range report.Suggestions {
			fmt.Printf("\n  服务: %s | 负责人: %s\n", s.Service, s.Owner)
			fmt.Printf("  操作: %s\n", s.Action)
			fmt.Printf("  路由: %s %s\n", s.Method, s.Route)
			fmt.Printf("  详情: %s\n", s.Details)
		}
		fmt.Println()
	}

	fmt.Println("========================================")
	if len(report.Blockers) > 0 {
		fmt.Println("状态: 失败 - 存在阻断问题")
	} else if len(report.Warnings) > 0 {
		fmt.Println("状态: 通过但有警告")
	} else {
		fmt.Println("状态: 通过")
	}
	fmt.Println("========================================")
}

func SaveJSONReport(report *models.CoverageReport, path string) error {
	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return err
	}
	return ioutil.WriteFile(path, data, 0644)
}

func PrintExampleIssues(issues []models.ExampleIssue) {
	if len(issues) == 0 {
		fmt.Println("所有示例检查通过!")
		return
	}

	fmt.Println("========================================")
	fmt.Println("    示例请求检查结果")
	fmt.Println("========================================")
	fmt.Println()

	blockers := 0
	warnings := 0

	for _, issue := range issues {
		if issue.Severity == "blocker" {
			blockers++
		} else {
			warnings++
		}

		fmt.Printf("[%s] %s %s (%s)\n", issue.Severity, issue.Example.Method, issue.Example.Path, issue.Example.Name)
		fmt.Printf("  类型:    %s\n", issue.Type)
		fmt.Printf("  问题:    %s\n", issue.Message)
		fmt.Printf("  根因:    %s\n", rootCauseDescription(issue.RootCause))
		fmt.Printf("  建议:    %s\n", issue.Suggestion)
		fmt.Println()
	}

	fmt.Println("========================================")
	fmt.Printf("阻断问题: %d, 警告问题: %d\n", blockers, warnings)
	fmt.Println("========================================")
}

func rootCauseDescription(cause string) string {
	switch cause {
	case "DOCUMENTATION_MISSING":
		return "文档缺失 - 应该先添加 OpenAPI 文档"
	case "DOCUMENTATION_OUTDATED":
		return "文档过期 - 文档与实际实现不一致，需要更新文档"
	case "EXAMPLE_OUTDATED":
		return "示例过期 - 示例请求/响应需要更新以匹配文档"
	default:
		return cause
	}
}

func PrintDiffResult(diff checker.DiffResult) {
	fmt.Println("========================================")
	fmt.Println("    路由与文档差异分析")
	fmt.Println("========================================")
	fmt.Println()

	if len(diff.UndocumentedRoutes) > 0 {
		fmt.Println("--- 未文档化的路由 (代码中有但文档中没有) ---")
		for _, route := range diff.UndocumentedRoutes {
			fmt.Printf("  %s %s\n", route.Method, route.Path)
			fmt.Printf("    服务: %s | 负责人: %s\n", route.Service, route.Owner)
			if route.Handler != "" {
				fmt.Printf("    处理器: %s\n", route.Handler)
			}
			fmt.Println()
		}
	}

	if len(diff.UnmatchedDocs) > 0 {
		fmt.Println("--- 孤立文档 (文档中有但代码中没有) ---")
		for _, doc := range diff.UnmatchedDocs {
			fmt.Printf("  %s %s\n", doc.Method, doc.Path)
			if doc.Summary != "" {
				fmt.Printf("    摘要: %s\n", doc.Summary)
			}
			fmt.Println()
		}
	}

	if len(diff.OutdatedDocs) > 0 {
		fmt.Println("--- 可能过期的文档 ---")
		for _, outdated := range diff.OutdatedDocs {
			fmt.Printf("  %s %s\n", outdated.CodeRoute.Method, outdated.CodeRoute.Path)
			for _, diff := range outdated.Differences {
				fmt.Printf("    - %s\n", diff)
			}
			fmt.Println()
		}
	}

	if len(diff.UndocumentedRoutes) == 0 && len(diff.UnmatchedDocs) == 0 && len(diff.OutdatedDocs) == 0 {
		fmt.Println("路由与文档完全匹配!")
	}

	fmt.Println("========================================")
	fmt.Printf("未文档化: %d | 孤立文档: %d | 过期文档: %d\n",
		len(diff.UndocumentedRoutes), len(diff.UnmatchedDocs), len(diff.OutdatedDocs))
	fmt.Println("========================================")
}
