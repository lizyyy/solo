package config

import (
	"fmt"
	"strings"

	"capgate/internal/models"
)

type ValidationError struct {
	File   string
	Errors []string
}

func (e *ValidationError) Error() string {
	var sb strings.Builder
	sb.WriteString(fmt.Sprintf("验证失败 (%s):\n", e.File))
	for i, err := range e.Errors {
		sb.WriteString(fmt.Sprintf("  %d. %s\n", i+1, err))
	}
	return sb.String()
}

func ValidateAll(routesPath, trafficPath, baselinePath, depsPath string) error {
	var allErrors []string

	if routesPath != "" {
		routes, err := LoadRoutes(routesPath)
		if err != nil {
			return err
		}
		if errs := ValidateRoutes(routes); len(errs) > 0 {
			allErrors = append(allErrors, errs...)
		}
	}

	if trafficPath != "" {
		plan, err := LoadTrafficPlan(trafficPath)
		if err != nil {
			return err
		}
		if errs := ValidateTrafficPlan(plan); len(errs) > 0 {
			allErrors = append(allErrors, errs...)
		}
	}

	if baselinePath != "" {
		baseline, err := LoadBaseline(baselinePath)
		if err != nil {
			return err
		}
		if errs := ValidateBaseline(baseline); len(errs) > 0 {
			allErrors = append(allErrors, errs...)
		}
	}

	if depsPath != "" {
		deps, err := LoadDependencyLimits(depsPath)
		if err != nil {
			return err
		}
		if errs := ValidateDependencyLimits(deps); len(errs) > 0 {
			allErrors = append(allErrors, errs...)
		}
	}

	if len(allErrors) > 0 {
		return &ValidationError{
			File:   "多个文件",
			Errors: allErrors,
		}
	}

	return nil
}

func ValidateRoutes(routes []models.Route) []string {
	var errors []string
	routeNames := make(map[string]bool)

	for i, route := range routes {
		if route.Name == "" {
			errors = append(errors, fmt.Sprintf("routes[%d]: 缺少必需字段 'name'", i))
		} else {
			if routeNames[route.Name] {
				errors = append(errors, fmt.Sprintf("routes[%d]: 路由名称重复 '%s'", i, route.Name))
			}
			routeNames[route.Name] = true
		}

		if route.Path == "" {
			errors = append(errors, fmt.Sprintf("routes[%d] (%s): 缺少必需字段 'path'", i, route.Name))
		}

		if route.Method == "" {
			errors = append(errors, fmt.Sprintf("routes[%d] (%s): 缺少必需字段 'method'", i, route.Name))
		}

		errors = append(errors, validateRouteBudget(route.Name, route.Budget)...)

		for j, dep := range route.Dependencies {
			if dep.Name == "" {
				errors = append(errors, fmt.Sprintf("routes[%d] (%s).dependencies[%d]: 依赖名称不能为空", i, route.Name, j))
			}
			if dep.Factor < 0 {
				errors = append(errors, fmt.Sprintf("routes[%d] (%s).dependencies[%d]: 依赖调用系数不能为负数 (%.2f)", i, route.Name, j, dep.Factor))
			}
		}
	}

	return errors
}

func validateRouteBudget(routeName string, budget models.RouteBudget) []string {
	var errors []string

	if budget.P95LatencyMs <= 0 {
		errors = append(errors, fmt.Sprintf("%s.budget.p95_latency_ms: 必须大于 0 (当前: %.2f)", routeName, budget.P95LatencyMs))
	}
	if budget.P99LatencyMs <= 0 {
		errors = append(errors, fmt.Sprintf("%s.budget.p99_latency_ms: 必须大于 0 (当前: %.2f)", routeName, budget.P99LatencyMs))
	}
	if budget.P99LatencyMs < budget.P95LatencyMs {
		errors = append(errors, fmt.Sprintf("%s.budget: p99 (%.2fms) 不应小于 p95 (%.2fms)", routeName, budget.P99LatencyMs, budget.P95LatencyMs))
	}
	if budget.MaxErrorRate < 0 || budget.MaxErrorRate > 1 {
		errors = append(errors, fmt.Sprintf("%s.budget.max_error_rate: 必须在 0-1 之间 (当前: %.2f)", routeName, budget.MaxErrorRate))
	}
	if budget.MaxRPS <= 0 {
		errors = append(errors, fmt.Sprintf("%s.budget.max_rps: 必须大于 0 (当前: %d)", routeName, budget.MaxRPS))
	}
	if budget.MaxConcurrent <= 0 {
		errors = append(errors, fmt.Sprintf("%s.budget.max_concurrent: 必须大于 0 (当前: %d)", routeName, budget.MaxConcurrent))
	}
	if budget.CPUBudgetPercent <= 0 || budget.CPUBudgetPercent > 100 {
		errors = append(errors, fmt.Sprintf("%s.budget.cpu_budget_percent: 必须在 1-100 之间 (当前: %.2f)", routeName, budget.CPUBudgetPercent))
	}
	if budget.MemoryBudgetMB <= 0 {
		errors = append(errors, fmt.Sprintf("%s.budget.memory_budget_mb: 必须大于 0 (当前: %d)", routeName, budget.MemoryBudgetMB))
	}

	return errors
}

func ValidateTrafficPlan(plan *models.TrafficPlan) []string {
	var errors []string

	if plan.PlanName == "" {
		errors = append(errors, "traffic-plan: 缺少必需字段 'plan_name'")
	}

	if len(plan.Routes) == 0 {
		errors = append(errors, "traffic-plan: 'routes' 不能为空")
	}

	for i, route := range plan.Routes {
		if route.Name == "" {
			errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d]: 缺少必需字段 'name'", i))
		}
		if route.Weight < 0 {
			errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d] (%s): weight 不能为负数 (%.2f)", i, route.Name, route.Weight))
		}
		if len(route.Steps) == 0 {
			errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d] (%s): 'steps' 不能为空", i, route.Name))
		}

		for j, step := range route.Steps {
			if step.DurationSec <= 0 {
				errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d].steps[%d]: duration_sec 必须大于 0 (当前: %d)", i, j, step.DurationSec))
			}
			if step.TargetRPS < 0 {
				errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d].steps[%d]: target_rps 不能为负数 (当前: %d)", i, j, step.TargetRPS))
			}
			if step.ConcurrentUsers < 0 {
				errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d].steps[%d]: concurrent_users 不能为负数 (当前: %d)", i, j, step.ConcurrentUsers))
			}
		}
	}

	for i, scenario := range plan.Scenarios {
		if scenario.Name == "" {
			errors = append(errors, fmt.Sprintf("traffic-plan.scenarios[%d]: 缺少必需字段 'name'", i))
		}
		if scenario.Type == "" {
			errors = append(errors, fmt.Sprintf("traffic-plan.scenarios[%d]: 缺少必需字段 'type'", i))
		} else {
			validTypes := map[models.ScenarioType]bool{
				models.ScenarioCacheMiss:      true,
				models.ScenarioDownstreamSlow: true,
				models.ScenarioCircuitOpen:    true,
				models.ScenarioRateLimit:      true,
				models.ScenarioHighLatency:    true,
				models.ScenarioResourceStress: true,
			}
			if !validTypes[scenario.Type] {
				errors = append(errors, fmt.Sprintf("traffic-plan.scenarios[%d]: 未知的 scenario type '%s'", i, scenario.Type))
			}
		}
	}

	return errors
}

func ValidateBaseline(baseline []models.BaselineRecord) []string {
	var errors []string

	for i, record := range baseline {
		if record.RouteName == "" {
			errors = append(errors, fmt.Sprintf("baseline[%d]: 缺少必需字段 'route_name'", i))
		}
		if record.P50LatencyMs < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): p50_latency_ms 不能为负数 (%.2f)", i, record.RouteName, record.P50LatencyMs))
		}
		if record.P95LatencyMs < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): p95_latency_ms 不能为负数 (%.2f)", i, record.RouteName, record.P95LatencyMs))
		}
		if record.P99LatencyMs < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): p99_latency_ms 不能为负数 (%.2f)", i, record.RouteName, record.P99LatencyMs))
		}
		if record.AvgLatencyMs < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): avg_latency_ms 不能为负数 (%.2f)", i, record.RouteName, record.AvgLatencyMs))
		}
		if record.ThroughputRPS < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): throughput_rps 不能为负数 (%.2f)", i, record.RouteName, record.ThroughputRPS))
		}
		if record.ErrorRate < 0 || record.ErrorRate > 1 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): error_rate 必须在 0-1 之间 (%.2f)", i, record.RouteName, record.ErrorRate))
		}
		if record.MaxConcurrent < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): max_concurrent 不能为负数 (%d)", i, record.RouteName, record.MaxConcurrent))
		}
		if record.CPUPeakPercent < 0 || record.CPUPeakPercent > 100 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): cpu_peak_percent 必须在 0-100 之间 (%.2f)", i, record.RouteName, record.CPUPeakPercent))
		}
		if record.MemoryPeakMB < 0 {
			errors = append(errors, fmt.Sprintf("baseline[%d] (%s): memory_peak_mb 不能为负数 (%d)", i, record.RouteName, record.MemoryPeakMB))
		}
	}

	return errors
}

func ValidateDependencyLimits(deps []models.DependencyLimit) []string {
	var errors []string
	depNames := make(map[string]bool)

	for i, dep := range deps {
		if dep.Name == "" {
			errors = append(errors, fmt.Sprintf("dependencies[%d]: 缺少必需字段 'name'", i))
		} else {
			if depNames[dep.Name] {
				errors = append(errors, fmt.Sprintf("dependencies[%d]: 依赖名称重复 '%s'", i, dep.Name))
			}
			depNames[dep.Name] = true
		}

		if dep.Type == "" {
			errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): 缺少必需字段 'type'", i, dep.Name))
		} else {
			validTypes := map[models.DependencyType]bool{
				models.DependencyTypeDatabase:     true,
				models.DependencyTypeCache:        true,
				models.DependencyTypeHTTP:         true,
				models.DependencyTypeGRPC:         true,
				models.DependencyTypeMessageQueue: true,
			}
			if !validTypes[dep.Type] {
				errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): 未知的依赖类型 '%s'", i, dep.Name, dep.Type))
			}
		}

		if dep.MaxQPS < 0 {
			errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): max_qps 不能为负数 (%d)", i, dep.Name, dep.MaxQPS))
		}
		if dep.MaxConcurrent < 0 {
			errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): max_concurrent 不能为负数 (%d)", i, dep.Name, dep.MaxConcurrent))
		}
		if dep.MaxLatencyMs < 0 {
			errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): max_latency_ms 不能为负数 (%.2f)", i, dep.Name, dep.MaxLatencyMs))
		}
		if dep.TimeoutMs < 0 {
			errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): timeout_ms 不能为负数 (%.2f)", i, dep.Name, dep.TimeoutMs))
		}

		if dep.ConnectionPool != nil {
			if dep.ConnectionPool.MaxConnections < 0 {
				errors = append(errors, fmt.Sprintf("dependencies[%d] (%s).connection_pool.max_connections 不能为负数 (%d)", i, dep.Name, dep.ConnectionPool.MaxConnections))
			}
			if dep.ConnectionPool.MaxIdleConnections < 0 {
				errors = append(errors, fmt.Sprintf("dependencies[%d] (%s).connection_pool.max_idle_connections 不能为负数 (%d)", i, dep.Name, dep.ConnectionPool.MaxIdleConnections))
			}
			if dep.ConnectionPool.MaxIdleConnections > dep.ConnectionPool.MaxConnections {
				errors = append(errors, fmt.Sprintf("dependencies[%d] (%s): max_idle_connections (%d) 不应大于 max_connections (%d)", i, dep.Name, dep.ConnectionPool.MaxIdleConnections, dep.ConnectionPool.MaxConnections))
			}
		}
	}

	return errors
}

func ValidateCrossReferences(routes []models.Route, plan *models.TrafficPlan, deps []models.DependencyLimit) []string {
	var errors []string

	routeMap := make(map[string]bool)
	for _, r := range routes {
		routeMap[r.Name] = true
	}

	depMap := make(map[string]bool)
	for _, d := range deps {
		depMap[d.Name] = true
	}

	for i, planRoute := range plan.Routes {
		if !routeMap[planRoute.Name] {
			errors = append(errors, fmt.Sprintf("traffic-plan.routes[%d]: 引用的路由 '%s' 在 routes.yaml 中不存在", i, planRoute.Name))
		}
	}

	for i, route := range routes {
		for j, dep := range route.Dependencies {
			if !depMap[dep.Name] {
				errors = append(errors, fmt.Sprintf("routes[%d] (%s).dependencies[%d]: 引用的依赖 '%s' 在 dependency-limits.yaml 中不存在", i, route.Name, j, dep.Name))
			}
		}
	}

	return errors
}
