package report

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"text/template"
	"time"

	"github.com/yourname/pcheck/pkg/types"
)

type ReportFormat string

const (
	FormatJSON     ReportFormat = "json"
	FormatMarkdown ReportFormat = "markdown"
	FormatCSV      ReportFormat = "csv"
)

type Generator struct{}

func NewGenerator() *Generator {
	return &Generator{}
}

func (g *Generator) Generate(report *types.Report, format ReportFormat) ([]byte, error) {
	switch format {
	case FormatJSON:
		return g.generateJSON(report)
	case FormatMarkdown:
		return g.generateMarkdown(report)
	case FormatCSV:
		return g.generateCSV(report)
	default:
		return g.generateJSON(report)
	}
}

func (g *Generator) GenerateToFile(report *types.Report, format ReportFormat, filePath string) error {
	data, err := g.Generate(report, format)
	if err != nil {
		return err
	}
	return os.WriteFile(filePath, data, 0644)
}

func (g *Generator) generateJSON(report *types.Report) ([]byte, error) {
	return json.MarshalIndent(report, "", "  ")
}

func (g *Generator) generateMarkdown(report *types.Report) ([]byte, error) {
	funcMap := template.FuncMap{
		"formatTime": func(t time.Time) string {
			return t.Format("2006-01-02 15:04:05")
		},
		"formatDuration": func(d time.Duration) string {
			return d.String()
		},
		"formatSize": func(bytes int) string {
			if bytes < 1024 {
				return fmt.Sprintf("%d B", bytes)
			}
			if bytes < 1024*1024 {
				return fmt.Sprintf("%.1f KB", float64(bytes)/1024)
			}
			return fmt.Sprintf("%.1f MB", float64(bytes)/(1024*1024))
		},
		"formatPercent": func(ratio float64) string {
			return fmt.Sprintf("%.1f%%", (1-ratio)*100)
		},
		"severityColor": func(severity types.IssueSeverity) string {
			switch severity {
			case types.SeverityCritical:
				return "🔴"
			case types.SeverityHigh:
				return "🟠"
			case types.SeverityMedium:
				return "🟡"
			case types.SeverityLow:
				return "🟢"
			default:
				return "🔵"
			}
		},
	}

	const markdownTemplate = `# JSON to Protobuf/MessagePack Migration Report

## Overview
- **Project**: {{.ProjectName}}
- **Generated At**: {{formatTime .GeneratedAt}}
- **Tool Version**: {{.Version}}

---

## Executive Summary

### Risk Assessment
| Metric | Value |
|--------|-------|
| Overall Risk Level | **{{.Summary.OverallRiskLevel}}** |
| Total Issues | {{.Summary.TotalIssues}} |
| Critical Issues | {{.Summary.CriticalIssues}} |
| High Issues | {{.Summary.HighIssues}} |

### Performance Comparison
| Format | Size Reduction | Speedup |
|--------|----------------|---------|
| Protobuf vs JSON | {{formatPercent .Summary.ProtobufSizeReduction}} | {{if gt .Summary.ProtobufSpeedup 1.0}}{{printf "%.1fx" .Summary.ProtobufSpeedup}}{{else}}N/A{{end}} |
| MessagePack vs JSON | {{formatPercent .Summary.MsgpackSizeReduction}} | {{if gt .Summary.MsgpackSpeedup 1.0}}{{printf "%.1fx" .Summary.MsgpackSpeedup}}{{else}}N/A{{end}} |

---

## Schema Information
- **Source Type**: {{.SchemaInfo.SourceType}}
- **Source File**: {{.SchemaInfo.SourceFile}}
- **Messages**: {{.SchemaInfo.MessageCount}}
- **Enums**: {{.SchemaInfo.EnumCount}}

### Messages
{{range .SchemaInfo.Messages}}
- **{{.Name}}**: {{.FieldCount}} fields
{{end}}

---

## Compatibility Issues

### Summary
| Severity | Count |
|----------|-------|
| Critical | {{.Compatibility.Issues.CriticalCount}} |
| High | {{.Compatibility.Issues.HighCount}} |
| Medium | {{.Compatibility.Issues.MediumCount}} |
| Low | {{.Compatibility.Issues.LowCount}} |
| Info | {{.Compatibility.Issues.InfoCount}} |

### Issues by Type
{{range $issueType, $issues := .Compatibility.Issues.ByType}}
#### {{$issueType}} ({{len $issues}})
{{range $issues}}
- {{severityColor .Severity}} **[{{.Severity}}]** {{.Message}}
  {{if .FieldName}}- Field: {{.FieldName}}{{end}}
  {{if .PayloadID}}- Payload: {{.PayloadID}}{{end}}
{{end}}
{{end}}

---

## Performance Benchmarks

### Format Statistics
{{range $format, $stats := .Performance.Benchmarks.FormatStats}}
#### {{$format}}
| Metric | Value |
|--------|-------|
| Average Size | {{formatSize (int $stats.AverageSize)}} |
| Min Size | {{formatSize $stats.MinSize}} |
| Max Size | {{formatSize $stats.MaxSize}} |
| Total Size | {{formatSize (int $stats.TotalSizeBytes)}} |
| Avg Encode Time | {{formatDuration $stats.AverageEncodeTime}} |
| Avg Decode Time | {{formatDuration $stats.AverageDecodeTime}} |
| Success Rate | {{if gt $stats.TotalCount 0}}{{printf "%.1f%%" (multiply 100 (divide $stats.SuccessCount $stats.TotalCount))}}{{else}}N/A{{end}} |
{{end}}

### Comparisons
{{if .Performance.Comparisons.ProtobufVsJSON.FormatA}}
#### Protobuf vs JSON
- Size Ratio: {{printf "%.2fx" .Performance.Comparisons.ProtobufVsJSON.SizeRatio}}
- Encode Speed Ratio: {{printf "%.2fx" .Performance.Comparisons.ProtobufVsJSON.EncodeSpeedRatio}}
- Decode Speed Ratio: {{printf "%.2fx" .Performance.Comparisons.ProtobufVsJSON.DecodeSpeedRatio}}
{{end}}

{{if .Performance.Comparisons.MsgpackVsJSON.FormatA}}
#### MessagePack vs JSON
- Size Ratio: {{printf "%.2fx" .Performance.Comparisons.MsgpackVsJSON.SizeRatio}}
- Encode Speed Ratio: {{printf "%.2fx" .Performance.Comparisons.MsgpackVsJSON.EncodeSpeedRatio}}
- Decode Speed Ratio: {{printf "%.2fx" .Performance.Comparisons.MsgpackVsJSON.DecodeSpeedRatio}}
{{end}}

---

## Recommendations

{{range .Recommendations}}
### {{severityColor .Severity}} {{.Title}}
- **Severity**: {{.Severity}}
- **Description**: {{.Description}}
- **Action**: {{.Action}}

{{end}}

---

## Payload Information
- **Source File**: {{.PayloadInfo.SourceFile}}
- **Total Count**: {{.PayloadInfo.TotalCount}}
- **Sample Size**: {{.PayloadInfo.SampleSize}}

---

*Report generated by pcheck - JSON to Protobuf/MessagePack Migration Checker*
`

	tmpl, err := template.New("report").Funcs(funcMap).Parse(markdownTemplate)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, report); err != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

func (g *Generator) generateCSV(report *types.Report) ([]byte, error) {
	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	writer.Write([]string{"JSON to Protobuf/MessagePack Migration Report"})
	writer.Write([]string{"Project", report.ProjectName})
	writer.Write([]string{"Generated At", report.GeneratedAt.Format("2006-01-02 15:04:05")})
	writer.Write([]string{})

	writer.Write([]string{"=== Summary ==="})
	writer.Write([]string{"Overall Risk Level", report.Summary.OverallRiskLevel})
	writer.Write([]string{"Total Issues", fmt.Sprintf("%d", report.Summary.TotalIssues)})
	writer.Write([]string{"Critical Issues", fmt.Sprintf("%d", report.Summary.CriticalIssues)})
	writer.Write([]string{"High Issues", fmt.Sprintf("%d", report.Summary.HighIssues)})
	writer.Write([]string{"Protobuf Size Reduction", fmt.Sprintf("%.1f%%", (1-report.Summary.ProtobufSizeReduction)*100)})
	writer.Write([]string{"MessagePack Size Reduction", fmt.Sprintf("%.1f%%", (1-report.Summary.MsgpackSizeReduction)*100)})
	writer.Write([]string{})

	writer.Write([]string{"=== Compatibility Issues ==="})
	writer.Write([]string{"Type", "Severity", "Message", "Message Type", "Field Name", "Payload ID"})

	for _, issue := range report.Compatibility.Issues.Issues {
		writer.Write([]string{
			string(issue.Type),
			string(issue.Severity),
			issue.Message,
			issue.MessageType,
			issue.FieldName,
			issue.PayloadID,
		})
	}
	writer.Write([]string{})

	writer.Write([]string{"=== Performance Statistics ==="})
	writer.Write([]string{"Format", "Average Size", "Min Size", "Max Size",
		"Avg Encode Time", "Avg Decode Time", "Success Count", "Total Count"})

	for format, stats := range report.Performance.Benchmarks.FormatStats {
		writer.Write([]string{
			string(format),
			fmt.Sprintf("%.0f", stats.AverageSize),
			fmt.Sprintf("%d", stats.MinSize),
			fmt.Sprintf("%d", stats.MaxSize),
			stats.AverageEncodeTime.String(),
			stats.AverageDecodeTime.String(),
			fmt.Sprintf("%d", stats.SuccessCount),
			fmt.Sprintf("%d", stats.TotalCount),
		})
	}
	writer.Write([]string{})

	writer.Write([]string{"=== Recommendations ==="})
	writer.Write([]string{"Title", "Severity", "Description", "Action"})

	for _, rec := range report.Recommendations {
		writer.Write([]string{
			rec.Title,
			rec.Severity,
			rec.Description,
			rec.Action,
		})
	}

	writer.Flush()
	return buf.Bytes(), nil
}

func (g *Generator) BuildReport(
	schema *types.Schema,
	payloads *types.PayloadCollection,
	issues *types.IssueCollection,
	benchmarks *types.BenchmarkCollection,
	comparisons *types.ComparisonReport,
	projectName string,
) *types.Report {

	report := &types.Report{
		Version:     "1.0.0",
		GeneratedAt: time.Now(),
		ProjectName: projectName,
	}

	report.SchemaInfo = types.SchemaReport{
		SourceType:   string(schema.Type),
		SourceFile:   "",
		MessageCount: len(schema.Messages),
		EnumCount:    len(schema.Enums),
		Messages:     []types.MessageSummary{},
	}

	for _, msg := range schema.Messages {
		report.SchemaInfo.Messages = append(report.SchemaInfo.Messages, types.MessageSummary{
			Name:        msg.Name,
			FieldCount:  len(msg.Fields),
			Description: msg.Description,
		})
	}

	report.PayloadInfo = types.PayloadReport{
		TotalCount: payloads.TotalCount,
		SampleSize: len(payloads.Payloads),
	}

	report.Compatibility = types.CompatibilityReport{
		Issues:      *issues,
		HasBreaking: issues.CriticalCount > 0 || issues.HighCount > 0,
		RiskLevel:   calculateRiskLevel(issues),
	}

	if benchmarks != nil {
		report.Performance = types.PerformanceReport{
			Benchmarks:  *benchmarks,
			Comparisons: *comparisons,
		}
	}

	report.Recommendations = g.generateRecommendations(issues, benchmarks)

	report.Summary = g.buildSummary(report)

	return report
}

func (g *Generator) generateRecommendations(
	issues *types.IssueCollection,
	benchmarks *types.BenchmarkCollection,
) []types.Recommendation {
	var recommendations []types.Recommendation

	if issues.CriticalCount > 0 {
		recommendations = append(recommendations, types.Recommendation{
			Title:       "Resolve Critical Compatibility Issues",
			Description: fmt.Sprintf("Found %d critical issues that will break compatibility. These must be addressed before migration.", issues.CriticalCount),
			Severity:    "critical",
			Action:      "Review critical issues and fix schema changes to maintain backward compatibility.",
		})
	}

	if issues.HighCount > 0 {
		recommendations = append(recommendations, types.Recommendation{
			Title:       "Address High Priority Issues",
			Description: fmt.Sprintf("Found %d high priority issues that may cause data loss or unexpected behavior.", issues.HighCount),
			Severity:    "high",
			Action:      "Review high priority issues and consider adding deprecation periods or fallback mechanisms.",
		})
	}

	if len(issues.ByType[types.IssueTypeTypeNarrowed]) > 0 {
		recommendations = append(recommendations, types.Recommendation{
			Title:       "Review Type Narrowing Changes",
			Description: "Type narrowing (e.g., int64 to int32) can cause data loss with large values.",
			Severity:    "medium",
			Action:      "Validate historical data to ensure values fit within the new type range, or keep the original type.",
		})
	}

	if len(issues.ByType[types.IssueTypeDefaultValueDrift]) > 0 {
		recommendations = append(recommendations, types.Recommendation{
			Title:       "Check Default Value Changes",
			Description: "Default value changes may cause unexpected behavior for clients that rely on defaults.",
			Severity:    "medium",
			Action:      "Ensure default value changes are intentional and document them in the migration plan.",
		})
	}

	if len(issues.ByType[types.IssueTypeEnumExtended]) > 0 {
		recommendations = append(recommendations, types.Recommendation{
			Title:       "Handle Enum Changes",
			Description: "Enum value changes can break old clients that don't recognize new values.",
			Severity:    "medium",
			Action:      "Add UNKNOWN enum value as default, or ensure all clients are updated before removing old values.",
		})
	}

	if benchmarks != nil {
		jsonStats, hasJSON := benchmarks.FormatStats[types.FormatJSON]
		protoStats, hasProto := benchmarks.FormatStats[types.FormatProtobuf]

		if hasJSON && hasProto && protoStats.AverageSize < jsonStats.AverageSize {
			reduction := (1 - protoStats.AverageSize/jsonStats.AverageSize) * 100
			recommendations = append(recommendations, types.Recommendation{
				Title:       "Consider Protobuf for Size Reduction",
				Description: fmt.Sprintf("Protobuf reduces payload size by %.1f%% on average compared to JSON.", reduction),
				Severity:    "info",
				Action:      "Protobuf is recommended for bandwidth-constrained scenarios.",
			})
		}
	}

	return recommendations
}

func (g *Generator) buildSummary(report *types.Report) types.Summary {
	summary := types.Summary{
		OverallRiskLevel:      report.Compatibility.RiskLevel,
		TotalIssues:           report.Compatibility.Issues.TotalCount,
		CriticalIssues:        report.Compatibility.Issues.CriticalCount,
		HighIssues:            report.Compatibility.Issues.HighCount,
		ProtobufSizeReduction: 1.0,
		MsgpackSizeReduction:  1.0,
		ProtobufSpeedup:       1.0,
		MsgpackSpeedup:        1.0,
	}

	jsonStats, hasJSON := report.Performance.Benchmarks.FormatStats[types.FormatJSON]
	protoStats, hasProto := report.Performance.Benchmarks.FormatStats[types.FormatProtobuf]
	msgpackStats, hasMsgpack := report.Performance.Benchmarks.FormatStats[types.FormatMessagePack]

	if hasJSON && hasProto && jsonStats.AverageSize > 0 {
		summary.ProtobufSizeReduction = protoStats.AverageSize / jsonStats.AverageSize
		if protoStats.AverageEncodeTime > 0 {
			summary.ProtobufSpeedup = float64(jsonStats.AverageEncodeTime) / float64(protoStats.AverageEncodeTime)
		}
	}

	if hasJSON && hasMsgpack && jsonStats.AverageSize > 0 {
		summary.MsgpackSizeReduction = msgpackStats.AverageSize / jsonStats.AverageSize
		if msgpackStats.AverageEncodeTime > 0 {
			summary.MsgpackSpeedup = float64(jsonStats.AverageEncodeTime) / float64(msgpackStats.AverageEncodeTime)
		}
	}

	return summary
}

func calculateRiskLevel(issues *types.IssueCollection) string {
	if issues.CriticalCount > 0 {
		return "CRITICAL"
	}
	if issues.HighCount > 0 {
		return "HIGH"
	}
	if issues.MediumCount > 0 {
		return "MEDIUM"
	}
	if issues.LowCount > 0 || issues.InfoCount > 0 {
		return "LOW"
	}
	return "SAFE"
}

func multiply(a, b interface{}) float64 {
	switch av := a.(type) {
	case float64:
		switch bv := b.(type) {
		case float64:
			return av * bv
		case int:
			return av * float64(bv)
		}
	case int:
		switch bv := b.(type) {
		case float64:
			return float64(av) * bv
		case int:
			return float64(av * bv)
		}
	}
	return 0
}

func divide(a, b interface{}) float64 {
	switch av := a.(type) {
	case int:
		switch bv := b.(type) {
		case int:
			if bv == 0 {
				return 0
			}
			return float64(av) / float64(bv)
		}
	}
	return 0
}
