package exporter

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"

	"middleware-diagnostic/internal/model"
)

type Exporter struct{}

func NewExporter() *Exporter {
	return &Exporter{}
}

func (e *Exporter) ExportMarkdown(risks []model.Risk, diagResult *model.DiagnosticResult) ([]byte, error) {
	var buf bytes.Buffer

	buf.WriteString("# 中间件链路诊断报告\n\n")
	buf.WriteString(fmt.Sprintf("生成时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05")))

	if diagResult != nil {
		buf.WriteString("## 摘要\n\n")
		buf.WriteString(fmt.Sprintf("- **总风险数**: %d\n", diagResult.TotalRisks))
		buf.WriteString("\n### 按严重程度分布\n\n")
		buf.WriteString("| 严重程度 | 数量 |\n")
		buf.WriteString("|----------|------|\n")
		for _, severity := range []string{"critical", "high", "medium", "low"} {
			buf.WriteString(fmt.Sprintf("| %s | %d |\n", severity, diagResult.BySeverity[severity]))
		}
		buf.WriteString("\n### 按类别分布\n\n")
		buf.WriteString("| 类别 | 数量 |\n")
		buf.WriteString("|------|------|\n")
		for category, count := range diagResult.ByCategory {
			buf.WriteString(fmt.Sprintf("| %s | %d |\n", category, count))
		}
		buf.WriteString("\n")
	}

	if len(risks) > 0 {
		buf.WriteString("## 风险详情\n\n")

		severityGroups := make(map[string][]model.Risk)
		for _, r := range risks {
			severity := "unknown"
			if r.Rule != nil {
				severity = r.Rule.Severity
			}
			severityGroups[severity] = append(severityGroups[severity], r)
		}

		severityOrder := []string{"critical", "high", "medium", "low", "unknown"}
		for _, severity := range severityOrder {
			groupRisks := severityGroups[severity]
			if len(groupRisks) == 0 {
				continue
			}

			severityLabel := map[string]string{
				"critical": "🔴 严重 (Critical)",
				"high":     "🟠 高 (High)",
				"medium":   "🟡 中 (Medium)",
				"low":      "🟢 低 (Low)",
				"unknown":  "⚪ 未知",
			}[severity]

			buf.WriteString(fmt.Sprintf("### %s\n\n", severityLabel))

			for i, risk := range groupRisks {
				buf.WriteString(fmt.Sprintf("#### 风险 #%d\n\n", i+1))

				if risk.Rule != nil {
					buf.WriteString(fmt.Sprintf("- **规则**: %s\n", risk.Rule.Name))
					buf.WriteString(fmt.Sprintf("- **类别**: %s\n", risk.Rule.Category))
					buf.WriteString(fmt.Sprintf("- **描述**: %s\n\n", risk.Rule.Description))
				}

				buf.WriteString(fmt.Sprintf("- **状态**: %s\n", risk.Status))
				if risk.RouteID != nil {
					buf.WriteString(fmt.Sprintf("- **路由 ID**: %d\n", *risk.RouteID))
				}
				if risk.TraceID != nil {
					buf.WriteString(fmt.Sprintf("- **Trace ID**: %s\n", *risk.TraceID))
				}

				buf.WriteString(fmt.Sprintf("\n**证据**: %s\n\n", risk.Evidence))
				buf.WriteString(fmt.Sprintf("**影响**: %s\n\n", risk.Impact))
				buf.WriteString(fmt.Sprintf("**建议**: %s\n\n", risk.Suggestion))
				buf.WriteString("---\n\n")
			}
		}
	}

	if len(risks) == 0 {
		buf.WriteString("## 结果\n\n")
		buf.WriteString("✅ 未检测到任何风险。\n\n")
	}

	buf.WriteString("## 附录\n\n")
	buf.WriteString("### 状态说明\n\n")
	buf.WriteString("- `new`: 新发现的风险\n")
	buf.WriteString("- `confirmed`: 已确认的风险\n")
	buf.WriteString("- `false_positive`: 误报\n")
	buf.WriteString("- `resolved`: 已解决\n\n")

	return buf.Bytes(), nil
}

func (e *Exporter) ExportJSON(risks []model.Risk, diagResult *model.DiagnosticResult) ([]byte, error) {
	type ExportData struct {
		GeneratedAt string               `json:"generated_at"`
		Summary     *model.DiagnosticResult `json:"summary,omitempty"`
		Risks       []model.Risk         `json:"risks"`
	}

	data := ExportData{
		GeneratedAt: time.Now().Format(time.RFC3339),
		Summary:     diagResult,
		Risks:       risks,
	}

	return json.MarshalIndent(data, "", "  ")
}

func (e *Exporter) ExportCSV(risks []model.Risk) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	headers := []string{
		"ID", "Rule Name", "Category", "Severity", "Status",
		"Route ID", "Trace ID", "Evidence", "Impact", "Suggestion",
		"Created At", "Updated At",
	}

	if err := writer.Write(headers); err != nil {
		return nil, fmt.Errorf("failed to write CSV headers: %w", err)
	}

	for _, r := range risks {
		ruleName := ""
		category := ""
		severity := ""
		if r.Rule != nil {
			ruleName = r.Rule.Name
			category = r.Rule.Category
			severity = r.Rule.Severity
		}

		routeID := ""
		if r.RouteID != nil {
			routeID = fmt.Sprintf("%d", *r.RouteID)
		}

		traceID := ""
		if r.TraceID != nil {
			traceID = *r.TraceID
		}

		row := []string{
			fmt.Sprintf("%d", r.ID),
			ruleName,
			category,
			severity,
			r.Status,
			routeID,
			traceID,
			r.Evidence,
			r.Impact,
			r.Suggestion,
			r.CreatedAt.Format(time.RFC3339),
			r.UpdatedAt.Format(time.RFC3339),
		}

		if err := writer.Write(row); err != nil {
			return nil, fmt.Errorf("failed to write CSV row: %w", err)
		}
	}

	writer.Flush()
	if err := writer.Error(); err != nil {
		return nil, fmt.Errorf("failed to flush CSV: %w", err)
	}

	return buf.Bytes(), nil
}

func (e *Exporter) ExportRouteChain(route *model.Route) ([]byte, error) {
	type ChainAnalysis struct {
		Issues       []string `json:"issues,omitempty"`
		Suggestions  []string `json:"suggestions,omitempty"`
		HasRecover   bool     `json:"has_recover"`
		RecoverPos   int      `json:"recover_position,omitempty"`
		HasCORS      bool     `json:"has_cors"`
		CORSPos      int      `json:"cors_position,omitempty"`
		HasAuth      bool     `json:"has_auth"`
		AuthPos      int      `json:"auth_position,omitempty"`
		HasTenant    bool     `json:"has_tenant"`
		TenantPos    int      `json:"tenant_position,omitempty"`
	}

	type ChainExport struct {
		RouteID     int64                      `json:"route_id"`
		Method      string                     `json:"method"`
		Path        string                     `json:"path"`
		Description string                     `json:"description,omitempty"`
		Middlewares []model.RouteMiddlewareInfo `json:"middlewares"`
		Analysis    ChainAnalysis              `json:"analysis"`
	}

	analysis := ChainAnalysis{}
	issues := []string{}
	suggestions := []string{}

	for _, mw := range route.Middlewares {
		switch mw.Type {
		case "recover":
			analysis.HasRecover = true
			analysis.RecoverPos = mw.Position
		case "cors":
			analysis.HasCORS = true
			analysis.CORSPos = mw.Position
		case "auth":
			analysis.HasAuth = true
			analysis.AuthPos = mw.Position
		case "tenant":
			analysis.HasTenant = true
			analysis.TenantPos = mw.Position
		}
	}

	if !analysis.HasRecover {
		issues = append(issues, "缺少 recover 中间件")
		suggestions = append(suggestions, "添加 recover 中间件到最外层")
	} else if analysis.RecoverPos != 0 {
		issues = append(issues, fmt.Sprintf("recover 中间件位置不正确（当前位置 %d，应为 0）", analysis.RecoverPos))
		suggestions = append(suggestions, "将 recover 中间件移到位置 0")
	}

	if analysis.HasCORS && analysis.HasAuth {
		if analysis.CORSPos > analysis.AuthPos {
			issues = append(issues, "CORS 中间件在 auth 之后")
			suggestions = append(suggestions, "将 CORS 中间件移到 auth 之前")
		}
	}

	if analysis.HasAuth && !analysis.HasTenant {
		issues = append(issues, "有 auth 但没有 tenant 中间件")
		suggestions = append(suggestions, "考虑添加 tenant 中间件在 auth 之前")
	} else if analysis.HasAuth && analysis.HasTenant {
		if analysis.AuthPos < analysis.TenantPos {
			issues = append(issues, "auth 在 tenant 解析之前")
			suggestions = append(suggestions, "调整顺序：先解析 tenant，再执行 auth")
		}
	}

	analysis.Issues = issues
	analysis.Suggestions = suggestions

	export := ChainExport{
		RouteID:     route.ID,
		Method:      route.Method,
		Path:        route.Path,
		Description: route.Description,
		Middlewares: route.Middlewares,
		Analysis:    analysis,
	}

	return json.MarshalIndent(export, "", "  ")
}

func (e *Exporter) GenerateMiddlewareOrderSuggestion(route *model.Route) string {
	type mwInfo struct {
		pos      int
		name     string
		mwType   string
		priority int
	}

	var mws []mwInfo
	for _, mw := range route.Middlewares {
		priority := 100
		switch mw.Type {
		case "recover":
			priority = 0
		case "cors":
			priority = 1
		case "rate_limit":
			priority = 2
		case "tenant":
			priority = 3
		case "auth":
			priority = 4
		case "timeout":
			priority = 5
		case "trace":
			priority = 6
		case "idempotency":
			priority = 7
		}
		mws = append(mws, mwInfo{
			pos:      mw.Position,
			name:     mw.Name,
			mwType:   mw.Type,
			priority: priority,
		})
	}

	sort.Slice(mws, func(i, j int) bool {
		return mws[i].priority < mws[j].priority
	})

	var lines []string
	lines = append(lines, "推荐的中间件顺序：")
	lines = append(lines, "")

	for i, mw := range mws {
		marker := "  "
		if mw.pos != i {
			marker = "⚠️ "
		}
		lines = append(lines, fmt.Sprintf("%s%d. %s (%s) [原位置: %d]", marker, i, mw.name, mw.mwType, mw.pos))
	}

	lines = append(lines, "")
	lines = append(lines, "优先级说明：")
	lines = append(lines, "- 0: recover (最外层，捕获所有 panic)")
	lines = append(lines, "- 1: cors (处理预检请求)")
	lines = append(lines, "- 2: rate_limit (限流)")
	lines = append(lines, "- 3: tenant (租户解析)")
	lines = append(lines, "- 4: auth (认证授权)")
	lines = append(lines, "- 5: timeout (超时控制)")
	lines = append(lines, "- 6: trace (链路追踪)")
	lines = append(lines, "- 7: idempotency (幂等处理)")

	return strings.Join(lines, "\n")
}
