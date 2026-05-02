package report

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/zy8078/netpol-precheck/pkg/model"
)

type Report struct {
	Results     []*model.ReachabilityResult
	RiskMatrix  []model.RiskMatrixEntry
}

func NewReport(results []*model.ReachabilityResult, matrix []model.RiskMatrixEntry) *Report {
	return &Report{
		Results:    results,
		RiskMatrix: matrix,
	}
}

func (r *Report) ToMarkdown() string {
	var sb strings.Builder

	sb.WriteString("# Network Policy Reachability Precheck Report\n\n")
	sb.WriteString("## Summary\n")
	
	total := len(r.Results)
	allowed := 0
	denied := 0
	critical := 0
	high := 0
	medium := 0
	low := 0

	for _, result := range r.Results {
		if result.Allowed {
			allowed++
		} else {
			denied++
		}
		switch result.RiskLevel {
		case model.RiskCritical:
			critical++
		case model.RiskHigh:
			high++
		case model.RiskMedium:
			medium++
		case model.RiskLow:
			low++
		}
	}

	sb.WriteString(fmt.Sprintf("- Total traffic intents: %d\n", total))
	sb.WriteString(fmt.Sprintf("- Allowed: %d\n", allowed))
	sb.WriteString(fmt.Sprintf("- Denied: %d\n", denied))
	sb.WriteString(fmt.Sprintf("- Critical risks: %d\n", critical))
	sb.WriteString(fmt.Sprintf("- High risks: %d\n", high))
	sb.WriteString(fmt.Sprintf("- Medium risks: %d\n", medium))
	sb.WriteString(fmt.Sprintf("- Low risks: %d\n", low))

	sb.WriteString("\n## Traffic Intent Results\n\n")
	sb.WriteString("| Source | Destination | Port | Protocol | Allowed | Risk Level | Reason |\n")
	sb.WriteString("|--------|-------------|------|----------|---------|------------|--------|\n")

	for _, result := range r.Results {
		src := fmt.Sprintf("%s/%v", result.Intent.SourceNamespace, result.Intent.SourceLabels)
		dst := fmt.Sprintf("%s/%v", result.Intent.DestinationNamespace, result.Intent.DestinationLabels)
		if result.Intent.DestinationService != "" {
			dst = fmt.Sprintf("%s/service:%s", result.Intent.DestinationNamespace, result.Intent.DestinationService)
		}

		allowedStr := "✅"
		if !result.Allowed {
			allowedStr = "❌"
		}

		riskColor := getRiskColor(result.RiskLevel)

		sb.WriteString(fmt.Sprintf("| %s | %s | %d | %s | %s | %s | %s |\n",
			src, dst, result.Intent.Port, result.Intent.Protocol, allowedStr, riskColor, escapeMarkdown(result.Reason)))
	}

	sb.WriteString("\n## Risk Matrix\n\n")
	sb.WriteString("| Source | Destination | Port | Protocol | Allowed | Risk Level | Conflicting Policies |\n")
	sb.WriteString("|--------|-------------|------|----------|---------|------------|----------------------|\n")

	for _, entry := range r.RiskMatrix {
		allowedStr := "✅"
		if !entry.Allowed {
			allowedStr = "❌"
		}

		riskColor := getRiskColor(entry.RiskLevel)
		policies := strings.Join(entry.ConflictingPolicies, ", ")
		if policies == "" {
			policies = "-"
		}

		sb.WriteString(fmt.Sprintf("| %s | %s | %d | %s | %s | %s | %s |\n",
			entry.Source, entry.Destination, entry.Port, entry.Protocol, allowedStr, riskColor, policies))
	}

	sb.WriteString("\n## Legend\n\n")
	sb.WriteString("- ✅ Allowed: Traffic is permitted by network policy\n")
	sb.WriteString("- ❌ Denied: Traffic is blocked by network policy\n")
	sb.WriteString("- 🟥 CRITICAL: Traffic will be blocked after policy change\n")
	sb.WriteString("- 🟧 HIGH: Target or source pods not found\n")
	sb.WriteString("- 🟨 MEDIUM: No explicit policy allows this traffic\n")
	sb.WriteString("- 🟩 LOW: Traffic is explicitly allowed by policy\n")

	return sb.String()
}

func (r *Report) ToJSON() (string, error) {
	type jsonResult struct {
		Intent struct {
			SourceNamespace      string            `json:"sourceNamespace"`
			SourceLabels         map[string]string `json:"sourceLabels"`
			DestinationNamespace string            `json:"destinationNamespace"`
			DestinationLabels    map[string]string `json:"destinationLabels"`
			DestinationService   string            `json:"destinationService,omitempty"`
			Port                 int32             `json:"port"`
			Protocol             string            `json:"protocol"`
			Description          string            `json:"description,omitempty"`
		} `json:"intent"`
		Allowed      bool   `json:"allowed"`
		Reason       string `json:"reason"`
		RiskLevel    string `json:"riskLevel"`
		MatchedPolicies []string `json:"matchedPolicies"`
	}

	type jsonReport struct {
		Summary struct {
			Total       int `json:"total"`
			Allowed     int `json:"allowed"`
			Denied      int `json:"denied"`
			Critical    int `json:"critical"`
			High        int `json:"high"`
			Medium      int `json:"medium"`
			Low         int `json:"low"`
		} `json:"summary"`
		Results    []jsonResult          `json:"results"`
		RiskMatrix []model.RiskMatrixEntry `json:"riskMatrix"`
	}

	report := jsonReport{}
	
	total := len(r.Results)
	allowed := 0
	denied := 0
	critical := 0
	high := 0
	medium := 0
	low := 0

	for _, result := range r.Results {
		if result.Allowed {
			allowed++
		} else {
			denied++
		}
		switch result.RiskLevel {
		case model.RiskCritical:
			critical++
		case model.RiskHigh:
			high++
		case model.RiskMedium:
			medium++
		case model.RiskLow:
			low++
		}

		policies := make([]string, len(result.MatchedPolicies))
		for i, np := range result.MatchedPolicies {
			policies[i] = fmt.Sprintf("%s/%s", np.ObjectMeta.Namespace, np.ObjectMeta.Name)
		}

		res := jsonResult{
			Allowed:   result.Allowed,
			Reason:    result.Reason,
			RiskLevel: string(result.RiskLevel),
			MatchedPolicies: policies,
		}
		res.Intent.SourceNamespace = result.Intent.SourceNamespace
		res.Intent.SourceLabels = result.Intent.SourceLabels
		res.Intent.DestinationNamespace = result.Intent.DestinationNamespace
		res.Intent.DestinationLabels = result.Intent.DestinationLabels
		res.Intent.DestinationService = result.Intent.DestinationService
		res.Intent.Port = result.Intent.Port
		res.Intent.Protocol = result.Intent.Protocol
		res.Intent.Description = result.Intent.Description

		report.Results = append(report.Results, res)
	}

	report.Summary.Total = total
	report.Summary.Allowed = allowed
	report.Summary.Denied = denied
	report.Summary.Critical = critical
	report.Summary.High = high
	report.Summary.Medium = medium
	report.Summary.Low = low
	report.RiskMatrix = r.RiskMatrix

	data, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return "", err
	}

	return string(data), nil
}

func getRiskColor(risk model.RiskLevel) string {
	switch risk {
	case model.RiskCritical:
		return "🟥 CRITICAL"
	case model.RiskHigh:
		return "🟧 HIGH"
	case model.RiskMedium:
		return "🟨 MEDIUM"
	case model.RiskLow:
		return "🟩 LOW"
	default:
		return string(risk)
	}
}

func escapeMarkdown(text string) string {
	text = strings.ReplaceAll(text, "\\", "\\\\")
	text = strings.ReplaceAll(text, "|", "\\|")
	text = strings.ReplaceAll(text, "_", "\\_")
	text = strings.ReplaceAll(text, "*", "\\*")
	return text
}
