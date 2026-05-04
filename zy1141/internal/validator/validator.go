package validator

import (
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"msctl/internal/models"
	"msctl/pkg/utils"

	"gopkg.in/yaml.v3"
)

type Validator struct {
}

func NewValidator() *Validator {
	return &Validator{}
}

func (v *Validator) ValidateWorkspace(ws *models.Workspace) (*models.ValidationResult, error) {
	result := &models.ValidationResult{
		Valid:    true,
		Errors:   []models.ValidationError{},
		Warnings: []models.ValidationError{},
	}

	if err := v.validateServices(ws, result); err != nil {
		return nil, err
	}

	if err := v.validateCallEdges(ws, result); err != nil {
		return nil, err
	}

	if err := v.validateOwners(ws, result); err != nil {
		return nil, err
	}

	if err := v.validatePolicies(ws, result); err != nil {
		return nil, err
	}

	if err := v.validateDeployPlan(ws, result); err != nil {
		return nil, err
	}

	result.ErrorCount = len(result.Errors)
	if result.ErrorCount > 0 {
		result.Valid = false
	}

	return result, nil
}

func (v *Validator) validateServices(ws *models.Workspace, result *models.ValidationResult) error {
	if len(ws.Services) == 0 {
		result.Warnings = append(result.Warnings, models.ValidationError{
			File:         "services.yaml",
			FieldPath:    "services",
			ErrorMessage: "没有定义任何服务",
			Suggestion:   "请在 services.yaml 中添加服务定义",
		})
		return nil
	}

	serviceNames := make(map[string]bool)
	for name, svc := range ws.Services {
		if serviceNames[name] {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "services.yaml",
				FieldPath:    fmt.Sprintf("services[%s]", name),
				ErrorMessage: fmt.Sprintf("重复的服务名称: %s", name),
				Suggestion:   "请移除重复的服务定义",
			})
		}
		serviceNames[name] = true

		if svc.Name == "" {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "services.yaml",
				FieldPath:    "services[].name",
				ErrorMessage: "服务名称不能为空",
				Suggestion:   "请为服务添加 name 字段",
			})
		}

		if !isValidServiceName(svc.Name) {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "services.yaml",
				FieldPath:    fmt.Sprintf("services[%s].name", svc.Name),
				ErrorMessage: fmt.Sprintf("无效的服务名称: %s (只能包含字母、数字、下划线和连字符)", svc.Name),
				Suggestion:   "请使用有效的服务名称格式",
			})
		}

		if svc.Version == "" {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         "services.yaml",
				FieldPath:    fmt.Sprintf("services[%s].version", name),
				ErrorMessage: fmt.Sprintf("服务 %s 没有指定版本", name),
				Suggestion:   "建议为服务添加版本号",
			})
		}

		for idx, ep := range svc.Endpoints {
			if ep.Method == "" {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "services.yaml",
					FieldPath:    fmt.Sprintf("services[%s].endpoints[%d].method", name, idx),
					ErrorMessage: fmt.Sprintf("服务 %s 的端点缺少 HTTP 方法", name),
					Suggestion:   "请添加 method 字段 (GET, POST, PUT, DELETE 等)",
				})
			}

			if !isValidHTTPMethod(ep.Method) {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "services.yaml",
					FieldPath:    fmt.Sprintf("services[%s].endpoints[%d].method", name, idx),
					ErrorMessage: fmt.Sprintf("无效的 HTTP 方法: %s", ep.Method),
					Suggestion:   "请使用有效的 HTTP 方法 (GET, POST, PUT, DELETE, PATCH, HEAD, OPTIONS)",
				})
			}

			if ep.Path == "" {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "services.yaml",
					FieldPath:    fmt.Sprintf("services[%s].endpoints[%d].path", name, idx),
					ErrorMessage: fmt.Sprintf("服务 %s 的端点缺少路径", name),
					Suggestion:   "请添加 path 字段",
				})
			}

			if !isValidPath(ep.Path) {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "services.yaml",
					FieldPath:    fmt.Sprintf("services[%s].endpoints[%d].path", name, idx),
					ErrorMessage: fmt.Sprintf("无效的路径格式: %s", ep.Path),
					Suggestion:   "路径必须以 / 开头",
				})
			}
		}
	}

	return nil
}

func (v *Validator) validateCallEdges(ws *models.Workspace, result *models.ValidationResult) error {
	for idx, edge := range ws.CallEdges {
		if edge.SourceService == "" {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "call-edges.jsonl",
				FieldPath:    fmt.Sprintf("edges[%d].source_service", idx),
				ErrorMessage: fmt.Sprintf("调用边 %d 缺少源服务", idx),
				Suggestion:   "请添加 source_service 字段",
			})
		}

		if edge.TargetService == "" {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "call-edges.jsonl",
				FieldPath:    fmt.Sprintf("edges[%d].target_service", idx),
				ErrorMessage: fmt.Sprintf("调用边 %d 缺少目标服务", idx),
				Suggestion:   "请添加 target_service 字段",
			})
		}

		if edge.SourceService != "" && edge.TargetService != "" {
			if _, exists := ws.Services[edge.SourceService]; !exists {
				result.Warnings = append(result.Warnings, models.ValidationError{
					File:         "call-edges.jsonl",
					FieldPath:    fmt.Sprintf("edges[%d].source_service", idx),
					ErrorMessage: fmt.Sprintf("源服务 %s 未在 services.yaml 中定义", edge.SourceService),
					Suggestion:   "请检查服务名称或在 services.yaml 中添加该服务",
				})
			}

			if _, exists := ws.Services[edge.TargetService]; !exists {
				result.Warnings = append(result.Warnings, models.ValidationError{
					File:         "call-edges.jsonl",
					FieldPath:    fmt.Sprintf("edges[%d].target_service", idx),
					ErrorMessage: fmt.Sprintf("目标服务 %s 未在 services.yaml 中定义", edge.TargetService),
					Suggestion:   "请检查服务名称或在 services.yaml 中添加该服务",
				})
			}
		}

		if edge.Method != "" && !isValidHTTPMethod(edge.Method) {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "call-edges.jsonl",
				FieldPath:    fmt.Sprintf("edges[%d].method", idx),
				ErrorMessage: fmt.Sprintf("无效的 HTTP 方法: %s", edge.Method),
				Suggestion:   "请使用有效的 HTTP 方法",
			})
		}
	}

	return nil
}

func (v *Validator) validateOwners(ws *models.Workspace, result *models.ValidationResult) error {
	for svcName, owner := range ws.Owners {
		if _, exists := ws.Services[svcName]; !exists {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         "owners.csv",
				FieldPath:    fmt.Sprintf("owners[%s]", svcName),
				ErrorMessage: fmt.Sprintf("服务 %s 有 owner 但未在 services.yaml 中定义", svcName),
				Suggestion:   "请检查服务名称",
			})
		}

		if owner.Primary == "" {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         "owners.csv",
				FieldPath:    fmt.Sprintf("owners[%s].primary", svcName),
				ErrorMessage: fmt.Sprintf("服务 %s 没有指定主要负责人", svcName),
				Suggestion:   "建议为每个服务指定 primary owner",
			})
		}
	}

	for svcName := range ws.Services {
		if _, exists := ws.Owners[svcName]; !exists {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         "owners.csv",
				FieldPath:    fmt.Sprintf("services[%s]", svcName),
				ErrorMessage: fmt.Sprintf("服务 %s 没有 owner 信息", svcName),
				Suggestion:   "建议在 owners.csv 中添加该服务的负责人",
			})
		}
	}

	return nil
}

func (v *Validator) validatePolicies(ws *models.Workspace, result *models.ValidationResult) error {
	for idx, policy := range ws.Policies {
		if policy.ServiceName == "" {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].service_name", idx),
				ErrorMessage: fmt.Sprintf("策略 %d 缺少服务名称", idx),
				Suggestion:   "请添加 service_name 字段",
			})
		}

		if policy.SLO.Availability < 0 || policy.SLO.Availability > 1 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].slo.availability", idx),
				ErrorMessage: fmt.Sprintf("SLO 可用性必须在 0-1 之间，当前值: %f", policy.SLO.Availability),
				Suggestion:   "请将 availability 设置为 0 到 1 之间的值",
			})
		}

		if policy.SLO.LatencyP99 < 0 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].slo.latency_p99_ms", idx),
				ErrorMessage: fmt.Sprintf("P99 延迟不能为负数: %d", policy.SLO.LatencyP99),
				Suggestion:   "请设置有效的延迟值",
			})
		}

		if policy.SLO.LatencyP95 < 0 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].slo.latency_p95_ms", idx),
				ErrorMessage: fmt.Sprintf("P95 延迟不能为负数: %d", policy.SLO.LatencyP95),
				Suggestion:   "请设置有效的延迟值",
			})
		}

		if policy.RateLimit.MaxRequests < 0 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].rate_limit.max_requests", idx),
				ErrorMessage: fmt.Sprintf("限流请求数不能为负数: %d", policy.RateLimit.MaxRequests),
				Suggestion:   "请设置有效的限流值",
			})
		}

		if policy.RateLimit.WindowSeconds <= 0 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "policies.yaml",
				FieldPath:    fmt.Sprintf("policies[%d].rate_limit.window_seconds", idx),
				ErrorMessage: fmt.Sprintf("限流窗口必须大于 0: %d", policy.RateLimit.WindowSeconds),
				Suggestion:   "请设置有效的窗口值",
			})
		}

		if policy.ServiceName != "" {
			if _, exists := ws.Services[policy.ServiceName]; !exists {
				result.Warnings = append(result.Warnings, models.ValidationError{
					File:         "policies.yaml",
					FieldPath:    fmt.Sprintf("policies[%d].service_name", idx),
					ErrorMessage: fmt.Sprintf("策略指定的服务 %s 未在 services.yaml 中定义", policy.ServiceName),
					Suggestion:   "请检查服务名称",
				})
			}
		}
	}

	return nil
}

func (v *Validator) validateDeployPlan(ws *models.Workspace, result *models.ValidationResult) error {
	if ws.DeployPlan == nil {
		return nil
	}

	if len(ws.DeployPlan.Batches) == 0 {
		result.Warnings = append(result.Warnings, models.ValidationError{
			File:         "deploy-plan.yaml",
			FieldPath:    "batches",
			ErrorMessage: "发布计划没有定义任何批次",
			Suggestion:   "请添加发布批次",
		})
		return nil
	}

	seenOrders := make(map[int]bool)
	allServices := make(map[string]bool)

	for batchIdx, batch := range ws.DeployPlan.Batches {
		if batch.Order < 0 {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "deploy-plan.yaml",
				FieldPath:    fmt.Sprintf("batches[%d].order", batchIdx),
				ErrorMessage: fmt.Sprintf("批次 %s 的 order 不能为负数: %d", batch.Name, batch.Order),
				Suggestion:   "请使用非负的 order 值",
			})
		}

		if seenOrders[batch.Order] {
			result.Errors = append(result.Errors, models.ValidationError{
				File:         "deploy-plan.yaml",
				FieldPath:    fmt.Sprintf("batches[%d].order", batchIdx),
				ErrorMessage: fmt.Sprintf("重复的 order 值: %d", batch.Order),
				Suggestion:   "每个批次的 order 应该是唯一的",
			})
		}
		seenOrders[batch.Order] = true

		if len(batch.Services) == 0 {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         "deploy-plan.yaml",
				FieldPath:    fmt.Sprintf("batches[%d].services", batchIdx),
				ErrorMessage: fmt.Sprintf("批次 %s 没有包含任何服务", batch.Name),
				Suggestion:   "请添加要发布的服务",
			})
		}

		for _, svc := range batch.Services {
			if allServices[svc] {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "deploy-plan.yaml",
					FieldPath:    fmt.Sprintf("batches[%d].services[]", batchIdx),
					ErrorMessage: fmt.Sprintf("服务 %s 出现在多个批次中", svc),
					Suggestion:   "每个服务只能在一个批次中发布",
				})
			}
			allServices[svc] = true

			if _, exists := ws.Services[svc]; !exists {
				result.Warnings = append(result.Warnings, models.ValidationError{
					File:         "deploy-plan.yaml",
					FieldPath:    fmt.Sprintf("batches[%d].services[%s]", batchIdx, svc),
					ErrorMessage: fmt.Sprintf("发布计划中的服务 %s 未在 services.yaml 中定义", svc),
					Suggestion:   "请检查服务名称",
				})
			}
		}

		if batch.Canary {
			if batch.CanaryPercent < 0 || batch.CanaryPercent > 100 {
				result.Errors = append(result.Errors, models.ValidationError{
					File:         "deploy-plan.yaml",
					FieldPath:    fmt.Sprintf("batches[%d].canary_percent", batchIdx),
					ErrorMessage: fmt.Sprintf("灰度百分比必须在 0-100 之间: %d", batch.CanaryPercent),
					Suggestion:   "请设置有效的灰度百分比",
				})
			}
		}
	}

	return nil
}

func (v *Validator) ValidateFile(path string) (*models.ValidationResult, error) {
	result := &models.ValidationResult{
		Valid:    true,
		Errors:   []models.ValidationError{},
		Warnings: []models.ValidationError{},
	}

	ext := strings.ToLower(filepath.Ext(path))
	filename := filepath.Base(path)

	switch ext {
	case ".yaml", ".yml":
		if err := v.validateYAMLFile(path, result); err != nil {
			return nil, err
		}
	case ".json":
		if err := v.validateJSONFile(path, result); err != nil {
			return nil, err
		}
	case ".jsonl":
		if err := v.validateJSONLFile(path, result); err != nil {
			return nil, err
		}
	case ".csv":
		if err := v.validateCSVFile(path, result); err != nil {
			return nil, err
		}
	default:
		result.Warnings = append(result.Warnings, models.ValidationError{
			File:         filename,
			ErrorMessage: fmt.Sprintf("不支持的文件类型: %s", ext),
			Suggestion:   "支持的类型: yaml, yml, json, jsonl, csv",
		})
	}

	result.ErrorCount = len(result.Errors)
	if result.ErrorCount > 0 {
		result.Valid = false
	}

	return result, nil
}

func (v *Validator) validateYAMLFile(path string, result *models.ValidationResult) error {
	data, err := os.ReadFile(path)
	if err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("读取文件失败: %v", err),
		})
		return nil
	}

	var obj interface{}
	if err := validateYAML(data, &obj); err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("YAML 格式错误: %v", err),
			Suggestion:   "请检查 YAML 语法",
		})
	}

	return nil
}

func (v *Validator) validateJSONFile(path string, result *models.ValidationResult) error {
	_, err := os.ReadFile(path)
	if err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("读取文件失败: %v", err),
		})
		return nil
	}

	var obj interface{}
	if err := utils.ReadJSON(path, &obj); err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("JSON 格式错误: %v", err),
			Suggestion:   "请检查 JSON 语法",
		})
	}

	return nil
}

func (v *Validator) validateJSONLFile(path string, result *models.ValidationResult) error {
	items, err := utils.ReadJSONL(path)
	if err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("JSONL 格式错误: %v", err),
			Suggestion:   "请检查每行是否为有效的 JSON",
		})
		return nil
	}

	for i, item := range items {
		if _, ok := item["source_service"]; !ok {
			if _, ok := item["target_service"]; !ok {
				result.Warnings = append(result.Warnings, models.ValidationError{
					File:         filepath.Base(path),
					FieldPath:    fmt.Sprintf("line[%d]", i+1),
					ErrorMessage: fmt.Sprintf("第 %d 行缺少必需字段 (source_service, target_service)", i+1),
					Suggestion:   "调用边需要源服务和目标服务",
				})
			}
		}
	}

	return nil
}

func (v *Validator) validateCSVFile(path string, result *models.ValidationResult) error {
	records, err := utils.ReadCSV(path)
	if err != nil {
		result.Errors = append(result.Errors, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: fmt.Sprintf("CSV 格式错误: %v", err),
			Suggestion:   "请检查 CSV 格式",
		})
		return nil
	}

	if len(records) == 0 {
		result.Warnings = append(result.Warnings, models.ValidationError{
			File:         filepath.Base(path),
			ErrorMessage: "CSV 文件为空",
			Suggestion:   "请添加数据",
		})
		return nil
	}

	if len(records) > 0 {
		headers := records[0]
		if len(headers) == 0 {
			result.Warnings = append(result.Warnings, models.ValidationError{
				File:         filepath.Base(path),
				ErrorMessage: "CSV 文件没有表头",
				Suggestion:   "请添加表头行",
			})
		}
	}

	return nil
}

func isValidServiceName(name string) bool {
	matched, _ := regexp.MatchString(`^[a-zA-Z0-9_\-]+$`, name)
	return matched
}

func isValidHTTPMethod(method string) bool {
	validMethods := []string{"GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT"}
	method = strings.ToUpper(method)
	for _, m := range validMethods {
		if method == m {
			return true
		}
	}
	return false
}

func isValidPath(path string) bool {
	return strings.HasPrefix(path, "/")
}

func validateYAML(data []byte, out interface{}) error {
	return yaml.Unmarshal(data, out)
}
