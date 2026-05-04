package diagnostic

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"

	"middleware-diagnostic/internal/model"
)

type Engine struct {
	db *sql.DB
}

func NewEngine(db *sql.DB) *Engine {
	return &Engine{db: db}
}

func (e *Engine) InitializeRules() error {
	rules := []model.DiagnosticRule{
		{
			Name:        "recover_not_outermost",
			Category:    "ordering",
			Severity:    "critical",
			Description: "Recover 中间件没有放在最外层，导致 panic 无法被捕获",
			CheckLogic:  "recover_position",
		},
		{
			Name:        "cors_preflight_blocked_by_auth",
			Category:    "ordering",
			Severity:    "high",
			Description: "CORS 中间件在 auth 之后，导致预检请求被鉴权挡住",
			CheckLogic:  "cors_before_auth",
		},
		{
			Name:        "auth_before_tenant",
			Category:    "ordering",
			Severity:    "high",
			Description: "Auth 中间件在 tenant 解析之前，可能导致跨租户访问",
			CheckLogic:  "tenant_before_auth",
		},
		{
			Name:        "rate_limit_key_wrong",
			Category:    "configuration",
			Severity:    "high",
			Description: "限流 key 取错，可能导致错误的限流行为",
			CheckLogic:  "rate_limit_key_check",
		},
		{
			Name:        "context_key_overwritten",
			Category:    "context",
			Severity:    "high",
			Description: "Context key 被不同中间件覆盖",
			CheckLogic:  "context_override_check",
		},
		{
			Name:        "body_read_multiple_times",
			Category:    "request",
			Severity:    "medium",
			Description: "Request body 被多个中间件重复读取",
			CheckLogic:  "body_read_count_check",
		},
		{
			Name:        "timeout_context_not_propagated",
			Category:    "context",
			Severity:    "high",
			Description: "Timeout/context 没有继续传递下去",
			CheckLogic:  "context_propagation_check",
		},
		{
			Name:        "trace_header_lost",
			Category:    "observability",
			Severity:    "medium",
			Description: "Trace header 在中间件链路中丢失",
			CheckLogic:  "trace_header_check",
		},
		{
			Name:        "idempotency_key_conflict",
			Category:    "configuration",
			Severity:    "high",
			Description: "幂等键冲突或配置错误",
			CheckLogic:  "idempotency_check",
		},
		{
			Name:        "middleware_not_calling_next",
			Category:    "ordering",
			Severity:    "critical",
			Description: "中间件没有调用 next，导致请求被截断",
			CheckLogic:  "next_call_check",
		},
	}

	for _, rule := range rules {
		_, err := e.db.Exec(`
			INSERT OR IGNORE INTO diagnostic_rules (name, category, severity, description, check_logic, is_enabled)
			VALUES (?, ?, ?, ?, ?, ?)
		`, rule.Name, rule.Category, rule.Severity, rule.Description, rule.CheckLogic, true)
		if err != nil {
			return fmt.Errorf("failed to insert rule %s: %w", rule.Name, err)
		}
	}

	return nil
}

func (e *Engine) RunAllDiagnostics() (*model.DiagnosticResult, error) {
	result := &model.DiagnosticResult{
		BySeverity: make(map[string]int),
		ByCategory: make(map[string]int),
	}

	rules, err := e.getEnabledRules()
	if err != nil {
		return nil, err
	}

	for _, rule := range rules {
		risks, err := e.checkRule(&rule)
		if err != nil {
			return nil, fmt.Errorf("failed to check rule %s: %w", rule.Name, err)
		}

		for _, risk := range risks {
			result.Risks = append(result.Risks, risk)
			result.BySeverity[rule.Severity]++
			result.ByCategory[rule.Category]++
			result.TotalRisks++
		}
	}

	return result, nil
}

func (e *Engine) getEnabledRules() ([]model.DiagnosticRule, error) {
	rows, err := e.db.Query(`
		SELECT id, name, category, severity, description, check_logic, is_enabled, created_at, updated_at
		FROM diagnostic_rules WHERE is_enabled = 1
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var rules []model.DiagnosticRule
	for rows.Next() {
		var r model.DiagnosticRule
		err := rows.Scan(&r.ID, &r.Name, &r.Category, &r.Severity, &r.Description, &r.CheckLogic, &r.IsEnabled, &r.CreatedAt, &r.UpdatedAt)
		if err != nil {
			return nil, err
		}
		rules = append(rules, r)
	}
	return rules, nil
}

func (e *Engine) checkRule(rule *model.DiagnosticRule) ([]model.Risk, error) {
	switch rule.CheckLogic {
	case "recover_position":
		return e.checkRecoverPosition(rule)
	case "cors_before_auth":
		return e.checkCorsBeforeAuth(rule)
	case "tenant_before_auth":
		return e.checkTenantBeforeAuth(rule)
	case "rate_limit_key_check":
		return e.checkRateLimitKey(rule)
	case "context_override_check":
		return e.checkContextOverwrite(rule)
	case "body_read_count_check":
		return e.checkBodyReadCount(rule)
	case "context_propagation_check":
		return e.checkContextPropagation(rule)
	case "trace_header_check":
		return e.checkTraceHeader(rule)
	case "idempotency_check":
		return e.checkIdempotency(rule)
	case "next_call_check":
		return e.checkNextCall(rule)
	default:
		return nil, nil
	}
}

func (e *Engine) checkRecoverPosition(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT r.id, r.method, r.path, rm.position, m.name
		FROM routes r
		JOIN route_middlewares rm ON r.id = rm.route_id
		JOIN middlewares m ON rm.middleware_id = m.id
		WHERE m.type = 'recover'
		ORDER BY r.id, rm.position
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	type routePosition struct {
		routeID  int64
		method   string
		path     string
		position int
		name     string
	}

	var routesWithRecover []routePosition
	for rows.Next() {
		var rp routePosition
		err := rows.Scan(&rp.routeID, &rp.method, &rp.path, &rp.position, &rp.name)
		if err != nil {
			return nil, err
		}
		routesWithRecover = append(routesWithRecover, rp)
	}

	var risks []model.Risk
	for _, rp := range routesWithRecover {
		if rp.position > 0 {
			evidence := fmt.Sprintf("路由 %s %s 的 recover 中间件 '%s' 位于位置 %d，不是最外层（位置 0）",
				rp.method, rp.path, rp.name, rp.position)
			impact := "Panic 可能不会被捕获，导致服务崩溃"
			suggestion := "将 recover 中间件移到中间件链的最外层（位置 0）"
			
			risk, err := e.createOrGetRisk(rule, rp.routeID, "", evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
		}
	}

	// 检查没有 recover 中间件的路由
	routesWithoutRecover, err := e.getRoutesWithoutMiddlewareType("recover")
	if err != nil {
		return nil, err
	}
	for _, route := range routesWithoutRecover {
		evidence := fmt.Sprintf("路由 %s %s 没有配置 recover 中间件", route.Method, route.Path)
		impact := "任何 panic 都会导致服务崩溃"
		suggestion := "添加 recover 中间件到该路由的最外层"
		
		risk, err := e.createOrGetRisk(rule, route.ID, "", evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkCorsBeforeAuth(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		WITH middleware_positions AS (
			SELECT 
				rm.route_id,
				rm.position,
				m.type,
				m.name
			FROM route_middlewares rm
			JOIN middlewares m ON rm.middleware_id = m.id
		)
		SELECT 
			r.id, r.method, r.path,
			cors.position as cors_pos, cors.name as cors_name,
			auth.position as auth_pos, auth.name as auth_name
		FROM routes r
		JOIN middleware_positions cors ON r.id = cors.route_id AND cors.type = 'cors'
		JOIN middleware_positions auth ON r.id = auth.route_id AND auth.type = 'auth'
		WHERE cors.position > auth.position
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}

	type corsAuthIssue struct {
		routeID  int64
		method   string
		path     string
		corsPos  int
		corsName string
		authPos  int
		authName string
	}

	var issues []corsAuthIssue
	for rows.Next() {
		var issue corsAuthIssue
		err := rows.Scan(&issue.routeID, &issue.method, &issue.path, &issue.corsPos, &issue.corsName, &issue.authPos, &issue.authName)
		if err != nil {
			rows.Close()
			return nil, err
		}
		issues = append(issues, issue)
	}
	rows.Close()

	var risks []model.Risk
	for _, issue := range issues {
		evidence := fmt.Sprintf("路由 %s %s: CORS 中间件 '%s'(位置 %d) 在 auth 中间件 '%s'(位置 %d) 之后",
			issue.method, issue.path, issue.corsName, issue.corsPos, issue.authName, issue.authPos)
		impact := "CORS 预检请求（OPTIONS）会被 auth 中间件拦截，导致跨域请求失败"
		suggestion := "将 CORS 中间件移到 auth 中间件之前"
		
		risk, err := e.createOrGetRisk(rule, issue.routeID, "", evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkTenantBeforeAuth(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		WITH middleware_positions AS (
			SELECT 
				rm.route_id,
				rm.position,
				m.type,
				m.name
			FROM route_middlewares rm
			JOIN middlewares m ON rm.middleware_id = m.id
		)
		SELECT 
			r.id, r.method, r.path,
			auth.position as auth_pos, auth.name as auth_name,
			tenant.position as tenant_pos, tenant.name as tenant_name
		FROM routes r
		JOIN middleware_positions auth ON r.id = auth.route_id AND auth.type = 'auth'
		LEFT JOIN middleware_positions tenant ON r.id = tenant.route_id AND tenant.type = 'tenant'
		WHERE tenant.position IS NULL OR auth.position < tenant.position
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}

	type tenantAuthIssue struct {
		routeID    int64
		method     string
		path       string
		authPos    int
		authName   string
		tenantPos  sql.NullInt64
		tenantName sql.NullString
	}

	var issues []tenantAuthIssue
	for rows.Next() {
		var issue tenantAuthIssue
		err := rows.Scan(&issue.routeID, &issue.method, &issue.path, &issue.authPos, &issue.authName, &issue.tenantPos, &issue.tenantName)
		if err != nil {
			rows.Close()
			return nil, err
		}
		issues = append(issues, issue)
	}
	rows.Close()

	var risks []model.Risk
	for _, issue := range issues {
		var evidence, impact, suggestion string
		if !issue.tenantPos.Valid {
			evidence = fmt.Sprintf("路由 %s %s 有 auth 中间件 '%s' 但没有 tenant 解析中间件",
				issue.method, issue.path, issue.authName)
			impact = "无法验证租户上下文，可能导致跨租户数据访问"
			suggestion = "添加 tenant 中间件并确保在 auth 之前执行"
		} else {
			evidence = fmt.Sprintf("路由 %s %s: auth 中间件 '%s'(位置 %d) 在 tenant 中间件 '%s'(位置 %d) 之前",
				issue.method, issue.path, issue.authName, issue.authPos, issue.tenantName.String, issue.tenantPos.Int64)
			impact = "Auth 验证时无法获取正确的租户上下文，可能导致权限判断错误"
			suggestion = "调整顺序：先解析 tenant，再执行 auth 验证"
		}
		
		risk, err := e.createOrGetRisk(rule, issue.routeID, "", evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkRateLimitKey(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT r.id, r.method, r.path, m.name, m.config
		FROM routes r
		JOIN route_middlewares rm ON r.id = rm.route_id
		JOIN middlewares m ON rm.middleware_id = m.id
		WHERE m.type = 'rate_limit'
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var routeID int64
		var method, path, name, config string
		err := rows.Scan(&routeID, &method, &path, &name, &config)
		if err != nil {
			return nil, err
		}

		var configMap map[string]interface{}
		if err := json.Unmarshal([]byte(config), &configMap); err != nil {
			continue
		}

		keySource, ok := configMap["key_source"].(string)
		if !ok {
			evidence := fmt.Sprintf("路由 %s %s 的限流中间件 '%s' 没有配置 key_source", method, path, name)
			impact := "可能使用默认的限流 key，无法正确区分不同用户/租户"
			suggestion := "配置 key_source 为 user_id 或 tenant_id 等唯一标识"
			
			risk, err := e.createOrGetRisk(rule, routeID, "", evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
			continue
		}

		if keySource == "ip" || keySource == "remote_addr" {
			evidence := fmt.Sprintf("路由 %s %s 的限流中间件 '%s' 使用了 '%s' 作为 key_source", method, path, name, keySource)
			impact := "基于 IP 的限流在 NAT 或代理环境下可能不准确，可能导致合法用户被限流或恶意用户绕过"
			suggestion := "考虑使用 user_id、tenant_id 或其他更可靠的标识作为限流 key"
			
			risk, err := e.createOrGetRisk(rule, routeID, "", evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
		}
	}

	return risks, nil
}

func (e *Engine) checkContextOverwrite(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT 
			ce1.trace_id,
			ce1.key,
			ce1.middleware_name as first_middleware,
			ce1.old_value as original_value,
			ce1.value as first_value,
			ce2.middleware_name as overwrite_middleware,
			ce2.value as overwrite_value,
			ce1.timestamp as first_time,
			ce2.timestamp as overwrite_time
		FROM context_events ce1
		JOIN context_events ce2 ON ce1.trace_id = ce2.trace_id 
			AND ce1.key = ce2.key 
			AND ce1.id < ce2.id
			AND ce1.middleware_name != ce2.middleware_name
		WHERE ce1.event_type = 'context_set' 
			AND ce2.event_type = 'context_set'
		ORDER BY ce1.trace_id, ce1.key
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID, key, firstMiddleware, firstValue, overwriteMiddleware, overwriteValue string
		var originalValue, firstTime, overwriteTime sql.NullString
		err := rows.Scan(&traceID, &key, &firstMiddleware, &originalValue, &firstValue, &overwriteMiddleware, &overwriteValue, &firstTime, &overwriteTime)
		if err != nil {
			return nil, err
		}

		evidence := fmt.Sprintf("Trace %s: Context key '%s' 被不同中间件覆盖。'%s' 设置为 '%s'，然后 '%s' 覆盖为 '%s'",
			traceID, key, firstMiddleware, firstValue, overwriteMiddleware, overwriteValue)
		impact := "Context 污染可能导致数据混乱，特别是当不同中间件使用相同的 key 存储不同含义的数据时"
		suggestion := fmt.Sprintf("建议 '%s' 和 '%s' 使用不同的 context key，或协调使用方式", firstMiddleware, overwriteMiddleware)
		
		risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkBodyReadCount(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT trace_id, method, path, body_read_count
		FROM request_traces
		WHERE body_read_count > 1
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID, method, path string
		var bodyReadCount int
		err := rows.Scan(&traceID, &method, &path, &bodyReadCount)
		if err != nil {
			return nil, err
		}

		evidence := fmt.Sprintf("Trace %s (%s %s): Request body 被读取了 %d 次",
			traceID, method, path, bodyReadCount)
		impact := "Go 的 http.Request.Body 只能读取一次，多次读取可能导致 body 为空或数据不一致"
		suggestion := "使用 io.NopCloser 包装 body 或使用缓冲机制，确保 body 只被读取一次"
		
		risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkContextPropagation(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT 
			rt.trace_id, rt.method, rt.path,
			ce_start.key as timeout_key,
			ce_start.value as timeout_value,
			ce_middleware.middleware_name
		FROM request_traces rt
		JOIN context_events ce_start ON rt.trace_id = ce_start.trace_id 
			AND ce_start.event_type = 'context_set'
			AND (ce_start.key LIKE '%timeout%' OR ce_start.key LIKE '%deadline%' OR ce_start.key LIKE '%cancel%')
		LEFT JOIN context_events ce_middleware ON rt.trace_id = ce_middleware.trace_id
			AND ce_middleware.event_type = 'context_missing'
		WHERE rt.duration_ms > 0
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID, method, path, timeoutKey, timeoutValue string
		var middlewareName sql.NullString
		err := rows.Scan(&traceID, &method, &path, &timeoutKey, &timeoutValue, &middlewareName)
		if err != nil {
			return nil, err
		}

		if middlewareName.Valid {
			evidence := fmt.Sprintf("Trace %s (%s %s): Timeout context key '%s'=%s 在中间件 '%s' 中丢失",
				traceID, method, path, timeoutKey, timeoutValue, middlewareName.String)
			impact := "Timeout 没有传递下去，可能导致请求挂起或资源泄漏"
			suggestion := "确保在所有中间件中正确传递 context，特别是包含 timeout/deadline 的 context"
			
			risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
		}
	}

	return risks, nil
}

func (e *Engine) checkTraceHeader(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT 
			rt.trace_id, rt.method, rt.path, rt.headers,
			ce.middleware_name
		FROM request_traces rt
		LEFT JOIN context_events ce ON rt.trace_id = ce.trace_id
			AND ce.event_type = 'header_lost'
		WHERE rt.headers IS NOT NULL
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID, method, path, headers string
		var middlewareName sql.NullString
		err := rows.Scan(&traceID, &method, &path, &headers, &middlewareName)
		if err != nil {
			return nil, err
		}

		var headerMap map[string]string
		if err := json.Unmarshal([]byte(headers), &headerMap); err != nil {
			continue
		}

		traceHeaders := []string{"x-trace-id", "traceparent", "x-request-id", "x-b3-traceid"}
		var foundHeaders []string
		for _, h := range traceHeaders {
			if _, exists := headerMap[h]; exists {
				foundHeaders = append(foundHeaders, h)
			}
			if _, exists := headerMap[strings.ToLower(h)]; exists && !contains(foundHeaders, h) {
				foundHeaders = append(foundHeaders, strings.ToLower(h))
			}
		}

		if len(foundHeaders) == 0 {
			evidence := fmt.Sprintf("Trace %s (%s %s): 请求头中没有找到常见的 trace header", traceID, method, path)
			impact := "无法进行分布式追踪，问题排查困难"
			suggestion := "确保请求包含 x-trace-id、traceparent 或其他标准 trace header"
			
			risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
		}

		if middlewareName.Valid {
			evidence := fmt.Sprintf("Trace %s (%s %s): Trace header 在中间件 '%s' 中丢失",
				traceID, method, path, middlewareName.String)
			impact := "分布式追踪链路断裂，无法完整追踪请求"
			suggestion := "确保中间件正确转发 trace 相关的 header"
			
			risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
			if err != nil {
				return nil, err
			}
			risks = append(risks, *risk)
		}
	}

	return risks, nil
}

func (e *Engine) checkIdempotency(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT 
			ce1.trace_id,
			ce1.key as idempotency_key,
			ce1.value as first_value,
			ce2.value as conflict_value,
			rt1.method as method1, rt1.path as path1,
			rt2.method as method2, rt2.path as path2
		FROM context_events ce1
		JOIN context_events ce2 ON ce1.key = ce2.key 
			AND ce1.value = ce2.value 
			AND ce1.trace_id != ce2.trace_id
			AND ce1.id < ce2.id
		JOIN request_traces rt1 ON ce1.trace_id = rt1.trace_id
		JOIN request_traces rt2 ON ce2.trace_id = rt2.trace_id
		WHERE ce1.event_type = 'idempotency_set' 
			AND ce2.event_type = 'idempotency_set'
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID1, idempotencyKey, value1, value2, method1, path1, method2, path2 string
		err := rows.Scan(&traceID1, &idempotencyKey, &value1, &value2, &method1, &path1, &method2, &path2)
		if err != nil {
			return nil, err
		}

		evidence := fmt.Sprintf("幂等键冲突: key='%s', value='%s' 被多个请求使用。Trace1: %s (%s %s), Trace2 方法: %s %s",
			idempotencyKey, value1, traceID1, method1, path1, method2, path2)
		impact := "幂等键冲突可能导致重复请求被错误处理，数据不一致"
		suggestion := "检查幂等键生成逻辑，确保每个请求有唯一的幂等键，或确认冲突是否为预期行为"
		
		risk, err := e.createOrGetRisk(rule, 0, traceID1, evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) checkNextCall(rule *model.DiagnosticRule) ([]model.Risk, error) {
	query := `
		SELECT 
			rt.trace_id, rt.method, rt.path, rt.status_code,
			ce.middleware_name, ce.key as missing_next
		FROM request_traces rt
		JOIN context_events ce ON rt.trace_id = ce.trace_id
			AND ce.event_type = 'next_not_called'
	`

	rows, err := e.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var traceID, method, path, middlewareName, missingNext string
		var statusCode int
		err := rows.Scan(&traceID, &method, &path, &statusCode, &middlewareName, &missingNext)
		if err != nil {
			return nil, err
		}

		evidence := fmt.Sprintf("Trace %s (%s %s) 状态码 %d: 中间件 '%s' 没有调用 next()",
			traceID, method, path, statusCode, middlewareName)
		impact := "请求被中间件截断，后续中间件和 handler 不会执行，可能导致意外的响应"
		suggestion := fmt.Sprintf("检查中间件 '%s' 的逻辑，确保在所有路径都调用了 next.ServeHTTP()", middlewareName)
		
		risk, err := e.createOrGetRisk(rule, 0, traceID, evidence, impact, suggestion)
		if err != nil {
			return nil, err
		}
		risks = append(risks, *risk)
	}

	return risks, nil
}

func (e *Engine) getRoutesWithoutMiddlewareType(mwType string) ([]model.Route, error) {
	query := `
		SELECT r.id, r.service_id, r.method, r.path, COALESCE(r.description, ''), r.created_at
		FROM routes r
		WHERE r.id NOT IN (
			SELECT DISTINCT rm.route_id
			FROM route_middlewares rm
			JOIN middlewares m ON rm.middleware_id = m.id
			WHERE m.type = ?
		)
	`

	rows, err := e.db.Query(query, mwType)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var routes []model.Route
	for rows.Next() {
		var r model.Route
		err := rows.Scan(&r.ID, &r.ServiceID, &r.Method, &r.Path, &r.Description, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		routes = append(routes, r)
	}
	return routes, nil
}

func (e *Engine) createOrGetRisk(rule *model.DiagnosticRule, routeID int64, traceID, evidence, impact, suggestion string) (*model.Risk, error) {
	var existingID int64
	var existingStatus string
	
	query := `
		SELECT id, status FROM risks 
		WHERE rule_id = ? AND evidence = ?
	`
	
	err := e.db.QueryRow(query, rule.ID, evidence).Scan(&existingID, &existingStatus)
	if err == nil {
		return &model.Risk{
			ID:         existingID,
			RuleID:     rule.ID,
			RouteID:    func() *int64 { if routeID > 0 { return &routeID }; return nil }(),
			TraceID:    func() *string { if traceID != "" { return &traceID }; return nil }(),
			Status:     existingStatus,
			Evidence:   evidence,
			Impact:     impact,
			Suggestion: suggestion,
			Rule:       rule,
		}, nil
	} else if err != sql.ErrNoRows {
		return nil, err
	}

	result, err := e.db.Exec(`
		INSERT INTO risks (rule_id, route_id, trace_id, status, evidence, impact, suggestion)
		VALUES (?, ?, ?, 'new', ?, ?, ?)
	`, rule.ID, func() interface{} { if routeID > 0 { return routeID }; return nil }(),
		func() interface{} { if traceID != "" { return traceID }; return nil }(),
		evidence, impact, suggestion)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return &model.Risk{
		ID:         id,
		RuleID:     rule.ID,
		RouteID:    func() *int64 { if routeID > 0 { return &routeID }; return nil }(),
		TraceID:    func() *string { if traceID != "" { return &traceID }; return nil }(),
		Status:     "new",
		Evidence:   evidence,
		Impact:     impact,
		Suggestion: suggestion,
		Rule:       rule,
	}, nil
}

func (e *Engine) UpdateRiskStatus(riskID int64, status string) error {
	validStatuses := map[string]bool{"new": true, "confirmed": true, "false_positive": true, "resolved": true}
	if !validStatuses[status] {
		return fmt.Errorf("invalid status: %s", status)
	}

	_, err := e.db.Exec(`
		UPDATE risks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, status, riskID)
	return err
}

func (e *Engine) GetAllRisks(statusFilter string) ([]model.Risk, error) {
	var query string
	var args []interface{}

	if statusFilter != "" && statusFilter != "all" {
		query = `
			SELECT r.id, r.rule_id, r.route_id, r.trace_id, r.status, 
				COALESCE(r.evidence, ''), COALESCE(r.impact, ''), COALESCE(r.suggestion, ''), 
				r.created_at, r.updated_at,
				dr.name, dr.category, dr.severity, COALESCE(dr.description, '')
			FROM risks r
			JOIN diagnostic_rules dr ON r.rule_id = dr.id
			WHERE r.status = ?
			ORDER BY 
				CASE dr.severity 
					WHEN 'critical' THEN 1 
					WHEN 'high' THEN 2 
					WHEN 'medium' THEN 3 
					WHEN 'low' THEN 4 
					ELSE 5 
				END,
				r.created_at DESC
		`
		args = append(args, statusFilter)
	} else {
		query = `
			SELECT r.id, r.rule_id, r.route_id, r.trace_id, r.status, 
				COALESCE(r.evidence, ''), COALESCE(r.impact, ''), COALESCE(r.suggestion, ''), 
				r.created_at, r.updated_at,
				dr.name, dr.category, dr.severity, COALESCE(dr.description, '')
			FROM risks r
			JOIN diagnostic_rules dr ON r.rule_id = dr.id
			ORDER BY 
				CASE dr.severity 
					WHEN 'critical' THEN 1 
					WHEN 'high' THEN 2 
					WHEN 'medium' THEN 3 
					WHEN 'low' THEN 4 
					ELSE 5 
				END,
				r.created_at DESC
		`
	}

	rows, err := e.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var risks []model.Risk
	for rows.Next() {
		var r model.Risk
		var rule model.DiagnosticRule
		err := rows.Scan(
			&r.ID, &r.RuleID, &r.RouteID, &r.TraceID, &r.Status,
			&r.Evidence, &r.Impact, &r.Suggestion, &r.CreatedAt, &r.UpdatedAt,
			&rule.Name, &rule.Category, &rule.Severity, &rule.Description,
		)
		if err != nil {
			return nil, err
		}
		r.Rule = &rule
		risks = append(risks, r)
	}
	return risks, nil
}

func contains(slice []string, item string) bool {
	for _, s := range slice {
		if s == item {
			return true
		}
	}
	return false
}
