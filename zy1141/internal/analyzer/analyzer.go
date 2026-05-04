package analyzer

import (
	"fmt"
	"sort"
	"strings"

	"msctl/internal/models"
	"msctl/pkg/utils"
)

type Analyzer struct {
}

func NewAnalyzer() *Analyzer {
	return &Analyzer{}
}

func (a *Analyzer) Analyze(ws *models.Workspace) (*models.AnalysisResult, error) {
	result := &models.AnalysisResult{
		Issues:        []models.Issue{},
		ContractDiffs: []models.ContractDiff{},
		OwnershipMap:  ws.Owners,
	}

	a.buildServiceGraph(ws, result)

	a.checkBreakingChanges(ws, result)

	a.checkUndeclaredCalls(ws, result)

	a.checkOrphanEndpoints(ws, result)

	a.checkDependencyCycles(ws, result)

	a.checkMissingOwners(ws, result)

	a.checkPolicyMismatch(ws, result)

	a.calculateSummary(result)

	return result, nil
}

func (a *Analyzer) buildServiceGraph(ws *models.Workspace, result *models.AnalysisResult) {
	graph := &models.ServiceGraph{
		Nodes:  []models.ServiceNode{},
		Edges:  []models.GraphEdge{},
		Cycles: [][]string{},
	}

	for name, svc := range ws.Services {
		node := models.ServiceNode{
			Name:          name,
			Version:       svc.Version,
			Tags:          svc.Tags,
			EndpointCount: len(svc.Endpoints),
		}
		graph.Nodes = append(graph.Nodes, node)
	}

	edgeMap := make(map[string]*models.GraphEdge)
	for _, call := range ws.CallEdges {
		key := fmt.Sprintf("%s->%s:%s:%s", call.SourceService, call.TargetService, call.Method, call.Path)
		if edge, exists := edgeMap[key]; exists {
			edge.CallCount++
		} else {
			edgeMap[key] = &models.GraphEdge{
				Source:    call.SourceService,
				Target:    call.TargetService,
				Endpoint:  call.Path,
				Method:    call.Method,
				CallCount: 1,
			}
		}
	}

	for _, edge := range edgeMap {
		graph.Edges = append(graph.Edges, *edge)
	}

	graph.Cycles = a.findCycles(ws)
	result.ServiceGraph = *graph
}

func (a *Analyzer) findCycles(ws *models.Workspace) [][]string {
	adj := make(map[string][]string)
	for _, edge := range ws.CallEdges {
		adj[edge.SourceService] = append(adj[edge.SourceService], edge.TargetService)
	}

	var cycles [][]string
	visited := make(map[string]bool)
	recStack := make(map[string]bool)
	path := []string{}

	var dfs func(string)
	dfs = func(node string) {
		visited[node] = true
		recStack[node] = true
		path = append(path, node)

		for _, neighbor := range adj[node] {
			if !visited[neighbor] {
				dfs(neighbor)
			} else if recStack[neighbor] {
				cycleStart := -1
				for i, n := range path {
					if n == neighbor {
						cycleStart = i
						break
					}
				}
				if cycleStart != -1 {
					cycle := append([]string{}, path[cycleStart:]...)
					cycle = append(cycle, neighbor)
					cycles = append(cycles, cycle)
				}
			}
		}

		path = path[:len(path)-1]
		recStack[node] = false
	}

	for node := range ws.Services {
		if !visited[node] {
			dfs(node)
		}
	}

	return cycles
}

func (a *Analyzer) checkBreakingChanges(ws *models.Workspace, result *models.AnalysisResult) {
	for _, svc := range ws.Services {
		for _, ep := range svc.Endpoints {
			for i, param := range ep.Parameters {
				if param.Required {
					requiredFields := param.Schema.Required
					for _, field := range requiredFields {
						prop, exists := param.Schema.Properties[field]
						if exists && prop.Type == "string" {
							if prop.MinLength != nil && *prop.MinLength > 0 {
								result.Issues = append(result.Issues, models.Issue{
									ID:             utils.GenerateID("BC"),
									Type:           models.IssueBreakingChange,
									Severity:       models.SeverityHigh,
									ServiceName:    svc.Name,
									Endpoint:       fmt.Sprintf("%s %s", ep.Method, ep.Path),
									FieldPath:      fmt.Sprintf("endpoints[%s].parameters[%d].schema.required[%s]", ep.Path, i, field),
									Message:        fmt.Sprintf("必需字符串参数 %s 添加了最小长度限制 %d，可能破坏现有调用", field, *prop.MinLength),
									Evidence:       fmt.Sprintf("参数 %s (in=%s) 的 required 包含 %s，且该字段 min_length=%d", param.Name, param.In, field, *prop.MinLength),
									Recommendation: "建议移除 min_length 限制，或提供兼容的默认值，并通知下游服务",
								})
							}
						}
					}
				}
			}

			if ep.Deprecated {
				result.Issues = append(result.Issues, models.Issue{
					ID:             utils.GenerateID("DEPRECATED"),
					Type:           models.IssueBreakingChange,
					Severity:       models.SeverityMedium,
					ServiceName:    svc.Name,
					Endpoint:       fmt.Sprintf("%s %s", ep.Method, ep.Path),
					Message:        fmt.Sprintf("端点 %s %s 已标记为废弃", ep.Method, ep.Path),
					Evidence:       "deprecated 字段设置为 true",
					Recommendation: "请通知所有下游服务尽快迁移到替代接口，并设置废弃截止日期",
				})
			}
		}
	}
}

func (a *Analyzer) checkUndeclaredCalls(ws *models.Workspace, result *models.AnalysisResult) {
	endpointMap := make(map[string]bool)
	for _, svc := range ws.Services {
		for _, ep := range svc.Endpoints {
			key := fmt.Sprintf("%s:%s:%s", svc.Name, strings.ToUpper(ep.Method), ep.Path)
			endpointMap[key] = true
		}
	}

	for _, call := range ws.CallEdges {
		key := fmt.Sprintf("%s:%s:%s", call.TargetService, strings.ToUpper(call.Method), call.Path)
		if _, exists := endpointMap[key]; !exists {
			result.Issues = append(result.Issues, models.Issue{
				ID:             utils.GenerateID("UC"),
				Type:           models.IssueUndeclaredCall,
				Severity:       models.SeverityCritical,
				ServiceName:    call.SourceService,
				Endpoint:       fmt.Sprintf("%s %s", call.Method, call.Path),
				Message:        fmt.Sprintf("%s 调用了 %s 未声明的端点 %s %s", call.SourceService, call.TargetService, call.Method, call.Path),
				Evidence:       fmt.Sprintf("call-edges 中存在调用，但 target_service %s 的 endpoints 中没有匹配的端点", call.TargetService),
				Recommendation: fmt.Sprintf("请检查: 1) %s 是否真的提供了该端点; 2) 路径和方法是否正确; 3) 是否需要在 services.yaml 中添加该端点", call.TargetService),
			})
		}
	}
}

func (a *Analyzer) checkOrphanEndpoints(ws *models.Workspace, result *models.AnalysisResult) {
	calledEndpoints := make(map[string]bool)
	for _, call := range ws.CallEdges {
		key := fmt.Sprintf("%s:%s:%s", call.TargetService, strings.ToUpper(call.Method), call.Path)
		calledEndpoints[key] = true
	}

	for _, svc := range ws.Services {
		for _, ep := range svc.Endpoints {
			key := fmt.Sprintf("%s:%s:%s", svc.Name, strings.ToUpper(ep.Method), ep.Path)
			if _, called := calledEndpoints[key]; !called {
				if !ep.Deprecated {
					result.Issues = append(result.Issues, models.Issue{
						ID:             utils.GenerateID("OE"),
						Type:           models.IssueOrphanEndpoint,
						Severity:       models.SeverityLow,
						ServiceName:    svc.Name,
						Endpoint:       fmt.Sprintf("%s %s", ep.Method, ep.Path),
						Message:        fmt.Sprintf("端点 %s %s 没有任何调用", ep.Method, ep.Path),
						Evidence:       "call-edges 中没有找到对该端点的调用记录",
						Recommendation: "建议: 1) 确认该端点是否仍在使用; 2) 考虑标记为 deprecated; 3) 如果确实不需要，可以安全移除",
					})
				}
			}
		}
	}
}

func (a *Analyzer) checkDependencyCycles(ws *models.Workspace, result *models.AnalysisResult) {
	for _, cycle := range result.ServiceGraph.Cycles {
		cycleStr := strings.Join(cycle, " → ")
		result.Issues = append(result.Issues, models.Issue{
			ID:             utils.GenerateID("DC"),
			Type:           models.IssueDependencyCycle,
			Severity:       models.SeverityHigh,
			Message:        fmt.Sprintf("检测到依赖环: %s", cycleStr),
			Evidence:       "服务调用关系图中发现了环，这会导致发布顺序问题",
			Recommendation: "建议: 1) 分析依赖环的原因; 2) 考虑提取共享模块; 3) 使用事件驱动解耦; 4) 调整服务职责",
		})
	}
}

func (a *Analyzer) checkMissingOwners(ws *models.Workspace, result *models.AnalysisResult) {
	for name := range ws.Services {
		if _, exists := ws.Owners[name]; !exists {
			result.Issues = append(result.Issues, models.Issue{
				ID:             utils.GenerateID("MO"),
				Type:           models.IssueMissingOwner,
				Severity:       models.SeverityMedium,
				ServiceName:    name,
				Message:        fmt.Sprintf("服务 %s 缺少 owner 信息", name),
				Evidence:       "owners.csv 中没有该服务的记录",
				Recommendation: fmt.Sprintf("请在 owners.csv 中添加服务 %s 的负责人信息，包括 primary、secondary 和 team", name),
			})
		} else {
			owner := ws.Owners[name]
			if owner.Primary == "" {
				result.Issues = append(result.Issues, models.Issue{
					ID:             utils.GenerateID("MPO"),
					Type:           models.IssueMissingOwner,
					Severity:       models.SeverityLow,
					ServiceName:    name,
					Message:        fmt.Sprintf("服务 %s 没有指定 primary owner", name),
					Evidence:       "owners.csv 中 primary 字段为空",
					Recommendation: fmt.Sprintf("建议为服务 %s 指定主要负责人", name),
				})
			}
		}
	}
}

func (a *Analyzer) checkPolicyMismatch(ws *models.Workspace, result *models.AnalysisResult) {
	policiesByService := make(map[string][]models.Policy)
	for _, policy := range ws.Policies {
		policiesByService[policy.ServiceName] = append(policiesByService[policy.ServiceName], policy)
	}

	matchingCount := 0
	mismatchingCount := 0

	for name, policies := range policiesByService {
		if _, exists := ws.Services[name]; !exists {
			for range policies {
				result.Issues = append(result.Issues, models.Issue{
					ID:             utils.GenerateID("PM"),
					Type:           models.IssuePolicyMismatch,
					Severity:       models.SeverityMedium,
					ServiceName:    name,
					Message:        fmt.Sprintf("策略引用了不存在的服务 %s", name),
					Evidence:       fmt.Sprintf("policies.yaml 中存在针对 %s 的策略，但该服务未在 services.yaml 中定义", name),
					Recommendation: "请检查服务名称是否正确，或在 services.yaml 中添加该服务",
				})
				mismatchingCount++
			}
			continue
		}

		for _, policy := range policies {
			if policy.Endpoint != "" {
				found := false
				for _, ep := range ws.Services[name].Endpoints {
					if ep.Path == policy.Endpoint {
						found = true
						matchingCount++
						break
					}
				}
				if !found {
					result.Issues = append(result.Issues, models.Issue{
						ID:             utils.GenerateID("EP"),
						Type:           models.IssuePolicyMismatch,
						Severity:       models.SeverityLow,
						ServiceName:    name,
						Endpoint:       policy.Endpoint,
						Message:        fmt.Sprintf("策略引用了不存在的端点 %s", policy.Endpoint),
						Evidence:       fmt.Sprintf("服务 %s 的 endpoints 中没有路径 %s", name, policy.Endpoint),
						Recommendation: "请检查端点路径是否正确",
					})
					mismatchingCount++
				}
			} else {
				matchingCount++
			}

			if policy.SLO.LatencyP99 > 0 && policy.SLO.LatencyP95 > 0 {
				if policy.SLO.LatencyP99 < policy.SLO.LatencyP95 {
					result.Issues = append(result.Issues, models.Issue{
						ID:             utils.GenerateID("SL"),
						Type:           models.IssuePolicyMismatch,
						Severity:       models.SeverityMedium,
						ServiceName:    name,
						Message:        fmt.Sprintf("服务 %s 的 SLO 配置异常: P99 (%dms) < P95 (%dms)", name, policy.SLO.LatencyP99, policy.SLO.LatencyP95),
						Evidence:       "P99 延迟应该大于等于 P95 延迟",
						Recommendation: "请检查并修正 SLO 配置，P99 应该大于 P95",
					})
				}
			}
		}
	}

	result.PolicySummary = models.PolicySummary{
		PoliciesWithSLO:       a.countPoliciesWithSLO(ws.Policies),
		PoliciesWithRateLimit: a.countPoliciesWithRateLimit(ws.Policies),
		MatchingPolicies:      matchingCount,
		MismatchingPolicies:   mismatchingCount,
	}
}

func (a *Analyzer) countPoliciesWithSLO(policies []models.Policy) int {
	count := 0
	for _, p := range policies {
		if p.SLO.Availability > 0 || p.SLO.LatencyP99 > 0 || p.SLO.LatencyP95 > 0 {
			count++
		}
	}
	return count
}

func (a *Analyzer) countPoliciesWithRateLimit(policies []models.Policy) int {
	count := 0
	for _, p := range policies {
		if p.RateLimit.MaxRequests > 0 || p.RateLimit.WindowSeconds > 0 {
			count++
		}
	}
	return count
}

func (a *Analyzer) calculateSummary(result *models.AnalysisResult) {
	summary := models.AnalysisSummary{
		TotalServices:    len(result.ServiceGraph.Nodes),
		TotalEndpoints:   a.countTotalEndpoints(result),
		TotalCallEdges:   len(result.ServiceGraph.Edges),
		IssuesBySeverity: make(map[models.Severity]int),
	}

	for _, issue := range result.Issues {
		summary.IssuesBySeverity[issue.Severity]++
		switch issue.Severity {
		case models.SeverityCritical:
			summary.CriticalCount++
		case models.SeverityHigh:
			summary.HighCount++
		case models.SeverityMedium:
			summary.MediumCount++
		case models.SeverityLow:
			summary.LowCount++
		}
	}

	summary.Passed = summary.CriticalCount == 0 && summary.HighCount == 0
	result.Summary = summary
}

func (a *Analyzer) countTotalEndpoints(result *models.AnalysisResult) int {
	count := 0
	for _, node := range result.ServiceGraph.Nodes {
		count += node.EndpointCount
	}
	return count
}

func GetIssueTypeLabel(issueType models.IssueType) string {
	labels := map[models.IssueType]string{
		models.IssueBreakingChange:    "破坏性契约变更",
		models.IssueUndeclaredCall:    "未声明调用",
		models.IssueOrphanEndpoint:    "孤儿接口",
		models.IssueDependencyCycle:   "依赖环",
		models.IssueMissingOwner:      "Owner 缺失",
		models.IssuePolicyMismatch:    "策略不匹配",
		models.IssueInvalidSchema:     "Schema 无效",
		models.IssueMissingDependency: "依赖缺失",
		models.IssueDuplicateService:  "重复服务",
		models.IssueInvalidEndpoint:   "端点无效",
		models.IssueMissingField:      "字段缺失",
		models.IssueInvalidValue:      "值无效",
	}
	return labels[issueType]
}

func GetSeverityColor(severity models.Severity) string {
	colors := map[models.Severity]string{
		models.SeverityCritical: "🔴",
		models.SeverityHigh:     "🟠",
		models.SeverityMedium:   "🟡",
		models.SeverityLow:      "🟢",
	}
	return colors[severity]
}

func SortIssuesBySeverity(issues []models.Issue) []models.Issue {
	severityOrder := map[models.Severity]int{
		models.SeverityCritical: 0,
		models.SeverityHigh:     1,
		models.SeverityMedium:   2,
		models.SeverityLow:      3,
	}

	sorted := make([]models.Issue, len(issues))
	copy(sorted, issues)

	sort.Slice(sorted, func(i, j int) bool {
		return severityOrder[sorted[i].Severity] < severityOrder[sorted[j].Severity]
	})

	return sorted
}
