package plan

import (
	"fmt"
	"sort"
	"strings"

	"msctl/internal/models"
	"msctl/pkg/utils"
)

type Planner struct {
}

func NewPlanner() *Planner {
	return &Planner{}
}

func (p *Planner) Plan(ws *models.Workspace, analysis *models.AnalysisResult) (*models.PlanResult, error) {
	result := &models.PlanResult{
		Title:            "发布计划分析报告",
		Date:             utils.Timestamp(),
		Admission:        models.AdmissionApproved,
		AdmissionReason:  "所有检查通过",
		BlockingIssues:   []models.BlockingIssue{},
		Warnings:         []models.WarningIssue{},
		RecommendedOrder: []models.OrderedBatch{},
		AffectedServices: []models.AffectedService{},
	}

	if ws.DeployPlan == nil {
		result.Admission = models.AdmissionRejected
		result.AdmissionReason = "没有提供发布计划"
		return result, nil
	}

	result.Title = ws.DeployPlan.Title

	p.checkCriticalIssues(analysis, result)

	p.checkDependencyCycles(analysis, result)

	p.analyzeDeploymentOrder(ws, result)

	p.analyzeAffectedServices(ws, result)

	p.analyzeRollbackImpact(ws, result)

	p.finalizeAdmission(result)

	return result, nil
}

func (p *Planner) checkCriticalIssues(analysis *models.AnalysisResult, result *models.PlanResult) {
	for _, issue := range analysis.Issues {
		if issue.Severity == models.SeverityCritical {
			result.BlockingIssues = append(result.BlockingIssues, models.BlockingIssue{
				ID:          issue.ID,
				IssueType:   string(issue.Type),
				Severity:    issue.Severity,
				Services:    []string{issue.ServiceName},
				Description: issue.Message,
				Evidence:    issue.Evidence,
				Resolution:  issue.Recommendation,
			})
		} else if issue.Severity == models.SeverityHigh {
			result.BlockingIssues = append(result.BlockingIssues, models.BlockingIssue{
				ID:          issue.ID,
				IssueType:   string(issue.Type),
				Severity:    issue.Severity,
				Services:    []string{issue.ServiceName},
				Description: issue.Message,
				Evidence:    issue.Evidence,
				Resolution:  issue.Recommendation,
			})
		} else {
			result.Warnings = append(result.Warnings, models.WarningIssue{
				ID:             issue.ID,
				IssueType:      string(issue.Type),
				Severity:       issue.Severity,
				Services:       []string{issue.ServiceName},
				Description:    issue.Message,
				Evidence:       issue.Evidence,
				Recommendation: issue.Recommendation,
			})
		}
	}
}

func (p *Planner) checkDependencyCycles(analysis *models.AnalysisResult, result *models.PlanResult) {
	for _, cycle := range analysis.ServiceGraph.Cycles {
		cycleStr := strings.Join(cycle, " → ")
		result.BlockingIssues = append(result.BlockingIssues, models.BlockingIssue{
			ID:          utils.GenerateID("CYCLE"),
			IssueType:   string(models.IssueDependencyCycle),
			Severity:    models.SeverityCritical,
			Services:    cycle,
			Description: fmt.Sprintf("检测到依赖环: %s", cycleStr),
			Evidence:    "服务调用关系中存在环，无法确定安全的发布顺序",
			Resolution:  "请解耦依赖环，可以考虑提取共享模块或使用事件驱动架构",
		})
	}
}

func (p *Planner) analyzeDeploymentOrder(ws *models.Workspace, result *models.PlanResult) {
	if ws.DeployPlan == nil {
		return
	}

	serviceToBatch := make(map[string]int)
	serviceBatchName := make(map[string]string)
	for _, batch := range ws.DeployPlan.Batches {
		for _, svc := range batch.Services {
			serviceToBatch[svc] = batch.Order
			serviceBatchName[svc] = batch.Name
		}
	}

	incomingDeps := make(map[string][]string)
	outgoingDeps := make(map[string][]string)
	for _, edge := range ws.CallEdges {
		outgoingDeps[edge.SourceService] = append(outgoingDeps[edge.SourceService], edge.TargetService)
		incomingDeps[edge.TargetService] = append(incomingDeps[edge.TargetService], edge.SourceService)
	}

	orderIssues := []string{}
	for _, edge := range ws.CallEdges {
		sourceBatch, sourceInPlan := serviceToBatch[edge.SourceService]
		targetBatch, targetInPlan := serviceToBatch[edge.TargetService]

		if sourceInPlan && targetInPlan {
			if sourceBatch < targetBatch {
				orderIssues = append(orderIssues,
					fmt.Sprintf("%s (批次 %d) 调用 %s (批次 %d)，但 %s 发布更早",
						edge.SourceService, sourceBatch, edge.TargetService, targetBatch, edge.SourceService))
			}
		}
	}

	if len(orderIssues) > 0 {
		result.Warnings = append(result.Warnings, models.WarningIssue{
			ID:             utils.GenerateID("ORDER"),
			IssueType:      "release_order",
			Severity:       models.SeverityMedium,
			Description:    "发布顺序可能存在问题",
			Evidence:       strings.Join(orderIssues, "; "),
			Recommendation: "建议调整发布顺序，确保被依赖的服务先发布",
		})
	}

	batches := make([]models.DeployBatch, len(ws.DeployPlan.Batches))
	copy(batches, ws.DeployPlan.Batches)

	sort.Slice(batches, func(i, j int) bool {
		return batches[i].Order < batches[j].Order
	})

	for idx, batch := range batches {
		ordered := models.OrderedBatch{
			OriginalName:  batch.Name,
			OriginalOrder: batch.Order,
			NewOrder:      idx + 1,
			Services:      batch.Services,
			Reason:        "按原始 order 排序",
		}

		for _, svc := range batch.Services {
			if deps, ok := outgoingDeps[svc]; ok {
				for _, dep := range deps {
					if depBatch, inPlan := serviceToBatch[dep]; inPlan && depBatch > batch.Order {
						ordered.Reason = fmt.Sprintf("注意: %s 依赖的 %s 在更晚的批次发布", svc, dep)
					}
				}
			}
		}

		result.RecommendedOrder = append(result.RecommendedOrder, ordered)
	}
}

func (p *Planner) analyzeAffectedServices(ws *models.Workspace, result *models.PlanResult) {
	if ws.DeployPlan == nil {
		return
	}

	serviceToBatch := make(map[string]string)
	for _, batch := range ws.DeployPlan.Batches {
		for _, svc := range batch.Services {
			serviceToBatch[svc] = batch.Name
		}
	}

	incomingDeps := make(map[string][]string)
	outgoingDeps := make(map[string][]string)
	for _, edge := range ws.CallEdges {
		outgoingDeps[edge.SourceService] = append(outgoingDeps[edge.SourceService], edge.TargetService)
		incomingDeps[edge.TargetService] = append(incomingDeps[edge.TargetService], edge.SourceService)
	}

	allServicesInPlan := make(map[string]bool)
	for batchName := range serviceToBatch {
		allServicesInPlan[batchName] = true
	}

	for svcName := range allServicesInPlan {
		directCallers := utils.Unique(incomingDeps[svcName])
		directCallees := utils.Unique(outgoingDeps[svcName])

		transitiveCallers := p.findTransitive(svcName, incomingDeps, allServicesInPlan)
		transitiveCallees := p.findTransitive(svcName, outgoingDeps, allServicesInPlan)

		riskLevel := "低"
		if len(directCallers) > 3 || len(transitiveCallers) > 5 {
			riskLevel = "高"
		} else if len(directCallers) > 0 || len(transitiveCallers) > 0 {
			riskLevel = "中"
		}

		result.AffectedServices = append(result.AffectedServices, models.AffectedService{
			Name:              svcName,
			DeployBatch:       serviceToBatch[svcName],
			DirectCallers:     directCallers,
			DirectCallees:     directCallees,
			TransitiveCallers: transitiveCallers,
			TransitiveCallees: transitiveCallees,
			RiskLevel:         riskLevel,
		})
	}

	sort.Slice(result.AffectedServices, func(i, j int) bool {
		riskOrder := map[string]int{"高": 0, "中": 1, "低": 2}
		return riskOrder[result.AffectedServices[i].RiskLevel] < riskOrder[result.AffectedServices[j].RiskLevel]
	})
}

func (p *Planner) findTransitive(start string, deps map[string][]string, filter map[string]bool) []string {
	visited := make(map[string]bool)
	result := []string{}

	var dfs func(string)
	dfs = func(node string) {
		for _, neighbor := range deps[node] {
			if !visited[neighbor] {
				visited[neighbor] = true
				if filter[neighbor] {
					result = append(result, neighbor)
				}
				dfs(neighbor)
			}
		}
	}

	dfs(start)
	return utils.Unique(result)
}

func (p *Planner) analyzeRollbackImpact(ws *models.Workspace, result *models.PlanResult) {
	if ws.DeployPlan == nil {
		return
	}

	incomingDeps := make(map[string][]string)
	outgoingDeps := make(map[string][]string)
	for _, edge := range ws.CallEdges {
		outgoingDeps[edge.SourceService] = append(outgoingDeps[edge.SourceService], edge.TargetService)
		incomingDeps[edge.TargetService] = append(incomingDeps[edge.TargetService], edge.SourceService)
	}

	allServices := make(map[string]bool)
	for _, batch := range ws.DeployPlan.Batches {
		for _, svc := range batch.Services {
			allServices[svc] = true
		}
	}

	rollbackOrder := []string{}
	for i := len(ws.DeployPlan.Batches) - 1; i >= 0; i-- {
		for _, svc := range ws.DeployPlan.Batches[i].Services {
			rollbackOrder = append(rollbackOrder, svc)
		}
	}

	serviceImpacts := make(map[string]models.ServiceImpact)
	for svcName := range allServices {
		callers := incomingDeps[svcName]
		impactLevel := "低"
		if len(callers) > 5 {
			impactLevel = "高"
		} else if len(callers) > 0 {
			impactLevel = "中"
		}

		serviceImpacts[svcName] = models.ServiceImpact{
			ServiceName:        svcName,
			ImpactLevel:        impactLevel,
			DirectDependencies: callers,
			FailedEndpoints:    []string{},
		}
	}

	estimatedDowntime := "未知"
	if ws.DeployPlan.RollbackPlan.Strategy == "automated" {
		estimatedDowntime = "5-15 分钟"
	} else if ws.DeployPlan.RollbackPlan.Strategy == "manual" {
		estimatedDowntime = "30-60 分钟"
	}

	result.RollbackImpact = models.RollbackImpactReport{
		TotalAffectedServices: len(allServices),
		RollbackOrder:         rollbackOrder,
		ServiceImpacts:        serviceImpacts,
		EstimatedDowntime:     estimatedDowntime,
	}
}

func (p *Planner) finalizeAdmission(result *models.PlanResult) {
	if len(result.BlockingIssues) > 0 {
		result.Admission = models.AdmissionRejected
		result.AdmissionReason = fmt.Sprintf("存在 %d 个阻断问题，需要先解决才能发布", len(result.BlockingIssues))
	} else if len(result.Warnings) > 0 {
		result.Admission = models.AdmissionWarning
		result.AdmissionReason = fmt.Sprintf("通过，但有 %d 个警告项建议关注", len(result.Warnings))
	} else {
		result.Admission = models.AdmissionApproved
		result.AdmissionReason = "所有检查通过，可以安全发布"
	}
}

func GetAdmissionStatusLabel(status models.AdmissionStatus) string {
	labels := map[models.AdmissionStatus]string{
		models.AdmissionApproved: "✅ 通过",
		models.AdmissionRejected: "❌ 拒绝",
		models.AdmissionWarning:  "⚠️  警告",
	}
	return labels[status]
}
