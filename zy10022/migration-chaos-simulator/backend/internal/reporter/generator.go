package reporter

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"migration-chaos-simulator/internal/chaos"
	"migration-chaos-simulator/internal/migration"
	"migration-chaos-simulator/internal/tracer"
)

type ReportFormat string

const (
	FormatJSON     ReportFormat = "json"
	FormatMarkdown ReportFormat = "markdown"
	FormatHTML     ReportFormat = "html"
)

type ReportType string

const (
	ReportTypeMigration ReportType = "migration"
	ReportTypeChaos     ReportType = "chaos"
	ReportTypeCombined  ReportType = "combined"
)

type FullReport struct {
	ID              string
	GeneratedAt     time.Time
	ReportType      ReportType
	Summary         ReportSummary
	MigrationReport *MigrationReport
	ChaosReport     *ChaosReport
	Recommendations []Recommendation
}

type ReportSummary struct {
	TotalExperiments int
	TotalMigrations  int
	SuccessRate      float64
	ErrorRate        float64
	TotalDuration    time.Duration
	CriticalIssues   int
	Warnings         int
	HealthScore      int
}

type MigrationReport struct {
	MigrationID       string
	Name              string
	Version           string
	Status            string
	Duration          time.Duration
	Steps             []StepReport
	TotalRowsAffected int64
	DataIntegrity     migration.DataIntegrityReport
	RollbackLog       []migration.RollbackEntry
}

type StepReport struct {
	Index        int
	Name         string
	Type         string
	Status       string
	Duration     time.Duration
	RowsAffected int64
	Error        string
	Warnings     []string
}

type ChaosReport struct {
	ExperimentID   string
	Name           string
	Type           string
	Status         string
	Duration       time.Duration
	TotalRequests  int64
	SuccessCount   int64
	ErrorCount     int64
	Config         chaos.ExperimentConfig
	TopErrors      []ErrorOccurrence
	LatencyMetrics LatencyMetrics
}

type ErrorOccurrence struct {
	Count     int
	Type      string
	Message   string
	FirstSeen time.Time
	LastSeen  time.Time
}

type LatencyMetrics struct {
	Min time.Duration
	Max time.Duration
	Avg time.Duration
	P50 time.Duration
	P90 time.Duration
	P95 time.Duration
	P99 time.Duration
}

type Recommendation struct {
	Priority    string
	Category    string
	Title       string
	Description string
	Action      string
}

type Reporter struct {
	outputDir string
}

func NewReporter(outputDir string) (*Reporter, error) {
	if outputDir == "" {
		outputDir = "./reports"
	}

	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create output directory: %w", err)
	}

	return &Reporter{
		outputDir: outputDir,
	}, nil
}

func (r *Reporter) GenerateMigrationReport(m *migration.Migration, result *migration.MigrationResult) *FullReport {
	stepReports := make([]StepReport, 0, len(m.Steps))
	for _, step := range m.Steps {
		stepReports = append(stepReports, StepReport{
			Index:        step.Index,
			Name:         step.Name,
			Type:         string(step.Type),
			Status:       string(step.Status),
			Duration:     step.EndTime.Sub(step.StartTime),
			RowsAffected: step.RowsAffected,
			Error:        step.Error,
			Warnings:     step.Warnings,
		})
	}

	migReport := &MigrationReport{
		MigrationID:       m.ID,
		Name:              m.Name,
		Version:           m.Version,
		Status:            string(m.Status),
		Duration:          m.EndTime.Sub(m.StartTime),
		Steps:             stepReports,
		TotalRowsAffected: result.TotalRowsAffected,
		DataIntegrity:     result.DataIntegrity,
		RollbackLog:       m.RollbackLog,
	}

	report := &FullReport{
		ID:              generateReportID(),
		GeneratedAt:     time.Now(),
		ReportType:      ReportTypeMigration,
		MigrationReport: migReport,
		Recommendations: r.generateMigrationRecommendations(m, result),
	}

	report.Summary = r.calculateSummary(report)

	return report
}

func (r *Reporter) GenerateChaosReport(exp *chaos.ChaosExperiment, trace *tracer.Trace) *FullReport {
	chaosReport := &ChaosReport{
		ExperimentID:  exp.ID,
		Name:          exp.Name,
		Type:          string(exp.Type),
		Status:        string(exp.Status),
		Duration:      exp.EndTime.Sub(exp.StartTime),
		TotalRequests: exp.TotalRequests,
		SuccessCount:  exp.SuccessCount,
		ErrorCount:    exp.ErrorCount,
		Config:        exp.Config,
		TopErrors:     r.analyzeErrors(trace),
	}

	report := &FullReport{
		ID:          generateReportID(),
		GeneratedAt: time.Now(),
		ReportType:  ReportTypeChaos,
		ChaosReport: chaosReport,
	}

	report.Summary = r.calculateSummary(report)
	report.Recommendations = r.generateChaosRecommendations(exp, trace)

	return report
}

func (r *Reporter) GenerateCombinedReport(m *migration.Migration, migResult *migration.MigrationResult,
	exps []*chaos.ChaosExperiment, traces []*tracer.Trace) *FullReport {

	report := &FullReport{
		ID:          generateReportID(),
		GeneratedAt: time.Now(),
		ReportType:  ReportTypeCombined,
	}

	if m != nil {
		stepReports := make([]StepReport, 0, len(m.Steps))
		for _, step := range m.Steps {
			stepReports = append(stepReports, StepReport{
				Index:        step.Index,
				Name:         step.Name,
				Type:         string(step.Type),
				Status:       string(step.Status),
				Duration:     step.EndTime.Sub(step.StartTime),
				RowsAffected: step.RowsAffected,
				Error:        step.Error,
				Warnings:     step.Warnings,
			})
		}

		report.MigrationReport = &MigrationReport{
			MigrationID:       m.ID,
			Name:              m.Name,
			Version:           m.Version,
			Status:            string(m.Status),
			Duration:          m.EndTime.Sub(m.StartTime),
			Steps:             stepReports,
			TotalRowsAffected: migResult.TotalRowsAffected,
			DataIntegrity:     migResult.DataIntegrity,
			RollbackLog:       m.RollbackLog,
		}
	}

	if len(exps) > 0 {
		exp := exps[0]
		report.ChaosReport = &ChaosReport{
			ExperimentID:  exp.ID,
			Name:          exp.Name,
			Type:          string(exp.Type),
			Status:        string(exp.Status),
			Duration:      exp.EndTime.Sub(exp.StartTime),
			TotalRequests: exp.TotalRequests,
			SuccessCount:  exp.SuccessCount,
			ErrorCount:    exp.ErrorCount,
			Config:        exp.Config,
		}
	}

	report.Summary = r.calculateSummary(report)

	allRecs := make([]Recommendation, 0)
	if m != nil {
		allRecs = append(allRecs, r.generateMigrationRecommendations(m, migResult)...)
	}
	if len(traces) > 0 {
		for i, exp := range exps {
			if i < len(traces) {
				allRecs = append(allRecs, r.generateChaosRecommendations(exp, traces[i])...)
			}
		}
	}
	report.Recommendations = allRecs

	return report
}

func (r *Reporter) Export(report *FullReport, format ReportFormat) (string, error) {
	var content string
	var ext string

	switch format {
	case FormatJSON:
		data, err := json.MarshalIndent(report, "", "  ")
		if err != nil {
			return "", err
		}
		content = string(data)
		ext = "json"
	case FormatMarkdown:
		content = r.renderMarkdown(report)
		ext = "md"
	case FormatHTML:
		content = r.renderHTML(report)
		ext = "html"
	default:
		return "", fmt.Errorf("unsupported format: %s", format)
	}

	filename := fmt.Sprintf("report-%s-%s.%s", string(report.ReportType), report.ID, ext)
	filepath := filepath.Join(r.outputDir, filename)

	if err := os.WriteFile(filepath, []byte(content), 0644); err != nil {
		return "", fmt.Errorf("failed to write report: %w", err)
	}

	return filepath, nil
}

func (r *Reporter) calculateSummary(report *FullReport) ReportSummary {
	summary := ReportSummary{}

	if report.MigrationReport != nil {
		summary.TotalMigrations = 1
		if report.MigrationReport.Status == "completed" {
			summary.SuccessRate = 100
		} else {
			summary.ErrorRate = 100
		}
		summary.TotalDuration = report.MigrationReport.Duration
		summary.CriticalIssues = report.MigrationReport.DataIntegrity.FailedCount
	}

	if report.ChaosReport != nil {
		summary.TotalExperiments = 1
		if report.ChaosReport.TotalRequests > 0 {
			summary.SuccessRate = float64(report.ChaosReport.SuccessCount) /
				float64(report.ChaosReport.TotalRequests) * 100
			summary.ErrorRate = float64(report.ChaosReport.ErrorCount) /
				float64(report.ChaosReport.TotalRequests) * 100
		}
	}

	summary.HealthScore = r.calculateHealthScore(summary)

	return summary
}

func (r *Reporter) calculateHealthScore(summary ReportSummary) int {
	score := 100

	if summary.ErrorRate > 50 {
		score -= 50
	} else if summary.ErrorRate > 20 {
		score -= 30
	} else if summary.ErrorRate > 5 {
		score -= 10
	}

	if summary.CriticalIssues > 0 {
		score -= 20 * summary.CriticalIssues
	}

	if score < 0 {
		score = 0
	}

	return score
}

func (r *Reporter) generateMigrationRecommendations(m *migration.Migration, result *migration.MigrationResult) []Recommendation {
	recs := make([]Recommendation, 0)

	if m.Status != migration.MigrationStatusCompleted {
		recs = append(recs, Recommendation{
			Priority:    "CRITICAL",
			Category:    "MIGRATION",
			Title:       "Migration Failed",
			Description: fmt.Sprintf("Migration %s failed", m.Name),
			Action:      "Review error logs and fix issues before retrying",
		})
	}

	if !result.DataIntegrity.Passed {
		recs = append(recs, Recommendation{
			Priority:    "HIGH",
			Category:    "DATA_INTEGRITY",
			Title:       "Data Integrity Checks Failed",
			Description: fmt.Sprintf("%d of %d checks failed", result.DataIntegrity.FailedCount, result.DataIntegrity.TotalCount),
			Action:      "Review failed checks and validate data before proceeding",
		})
	}

	for _, step := range m.Steps {
		if len(step.Warnings) > 0 {
			recs = append(recs, Recommendation{
				Priority:    "MEDIUM",
				Category:    "WARNINGS",
				Title:       fmt.Sprintf("Warnings in step: %s", step.Name),
				Description: strings.Join(step.Warnings, "; "),
				Action:      "Investigate warnings before production deployment",
			})
		}
	}

	return recs
}

func (r *Reporter) generateChaosRecommendations(exp *chaos.ChaosExperiment, trace *tracer.Trace) []Recommendation {
	recs := make([]Recommendation, 0)

	errorRate := 0.0
	if exp.TotalRequests > 0 {
		errorRate = float64(exp.ErrorCount) / float64(exp.TotalRequests) * 100
	}

	if errorRate > 10 {
		recs = append(recs, Recommendation{
			Priority:    "HIGH",
			Category:    "CHAOS",
			Title:       "High Error Rate Detected",
			Description: fmt.Sprintf("Error rate: %.2f%%", errorRate),
			Action:      "System may not handle this level of chaos. Consider reviewing resilience mechanisms.",
		})
	}

	switch exp.Type {
	case chaos.ChaosTypeHighConcurrency:
		if errorRate > 5 {
			recs = append(recs, Recommendation{
				Priority:    "MEDIUM",
				Category:    "CONCURRENCY",
				Title:       "Concurrency Issues",
				Description: "High concurrency causes failures",
				Action:      "Consider increasing connection pool size or implementing rate limiting",
			})
		}
	case chaos.ChaosTypeTimeout:
		recs = append(recs, Recommendation{
			Priority:    "MEDIUM",
			Category:    "TIMEOUT",
			Title:       "Timeout Handling",
			Description: "Ensure proper timeout handling and graceful degradation",
			Action:      "Review timeout configuration and circuit breaker patterns",
		})
	case chaos.ChaosTypeNetworkDrop:
		recs = append(recs, Recommendation{
			Priority:    "MEDIUM",
			Category:    "NETWORK",
			Title:       "Network Resilience",
			Description: "Network instability detected",
			Action:      "Implement proper retry mechanisms with exponential backoff",
		})
	case chaos.ChaosTypeDuplicateRequest:
		recs = append(recs, Recommendation{
			Priority:    "HIGH",
			Category:    "IDEMPOTENCY",
			Title:       "Idempotency Required",
			Description: "Duplicate requests detected",
			Action:      "Ensure all operations are idempotent and use request deduplication",
		})
	case chaos.ChaosTypeDuplicateMessage:
		recs = append(recs, Recommendation{
			Priority:    "HIGH",
			Category:    "MESSAGE_QUEUE",
			Title:       "Message Processing",
			Description: "Duplicate message delivery detected",
			Action:      "Implement idempotent consumers and message deduplication",
		})
	}

	return recs
}

func (r *Reporter) analyzeErrors(trace *tracer.Trace) []ErrorOccurrence {
	errorMap := make(map[string]*ErrorOccurrence)

	for _, span := range trace.Spans {
		for _, event := range span.Events {
			if event.Level == tracer.EventLevelError || event.Level == tracer.EventLevelCritical {
				key := event.Message
				if existing, ok := errorMap[key]; ok {
					existing.Count++
					existing.LastSeen = event.Timestamp
				} else {
					errorMap[key] = &ErrorOccurrence{
						Count:     1,
						Type:      string(event.Level),
						Message:   event.Message,
						FirstSeen: event.Timestamp,
						LastSeen:  event.Timestamp,
					}
				}
			}
		}
	}

	errors := make([]ErrorOccurrence, 0, len(errorMap))
	for _, err := range errorMap {
		errors = append(errors, *err)
	}

	sort.Slice(errors, func(i, j int) bool {
		return errors[i].Count > errors[j].Count
	})

	return errors
}

func (r *Reporter) renderMarkdown(report *FullReport) string {
	var buf bytes.Buffer

	buf.WriteString(fmt.Sprintf("# Chaos Migration Report\n\n"))
	buf.WriteString(fmt.Sprintf("**Generated:** %s\n\n", report.GeneratedAt.Format(time.RFC3339)))
	buf.WriteString(fmt.Sprintf("**Report Type:** %s\n\n", report.ReportType))

	buf.WriteString("## Summary\n\n")
	buf.WriteString(fmt.Sprintf("- **Health Score:** %d/100\n", report.Summary.HealthScore))
	buf.WriteString(fmt.Sprintf("- **Success Rate:** %.2f%%\n", report.Summary.SuccessRate))
	buf.WriteString(fmt.Sprintf("- **Error Rate:** %.2f%%\n", report.Summary.ErrorRate))
	buf.WriteString(fmt.Sprintf("- **Critical Issues:** %d\n", report.Summary.CriticalIssues))
	buf.WriteString("\n")

	if report.MigrationReport != nil {
		mr := report.MigrationReport
		buf.WriteString("## Migration Report\n\n")
		buf.WriteString(fmt.Sprintf("- **ID:** %s\n", mr.MigrationID))
		buf.WriteString(fmt.Sprintf("- **Name:** %s\n", mr.Name))
		buf.WriteString(fmt.Sprintf("- **Version:** %s\n", mr.Version))
		buf.WriteString(fmt.Sprintf("- **Status:** %s\n", mr.Status))
		buf.WriteString(fmt.Sprintf("- **Duration:** %v\n", mr.Duration))
		buf.WriteString(fmt.Sprintf("- **Rows Affected:** %d\n", mr.TotalRowsAffected))
		buf.WriteString("\n")

		buf.WriteString("### Steps\n\n")
		for _, step := range mr.Steps {
			buf.WriteString(fmt.Sprintf("#### Step %d: %s\n\n", step.Index+1, step.Name))
			buf.WriteString(fmt.Sprintf("- **Type:** %s\n", step.Type))
			buf.WriteString(fmt.Sprintf("- **Status:** %s\n", step.Status))
			buf.WriteString(fmt.Sprintf("- **Duration:** %v\n", step.Duration))
			buf.WriteString(fmt.Sprintf("- **Rows Affected:** %d\n", step.RowsAffected))
			if step.Error != "" {
				buf.WriteString(fmt.Sprintf("- **Error:** %s\n", step.Error))
			}
			buf.WriteString("\n")
		}

		if len(mr.RollbackLog) > 0 {
			buf.WriteString("### Rollback Log\n\n")
			for _, entry := range mr.RollbackLog {
				buf.WriteString(fmt.Sprintf("- **%s** [%s] %s\n",
					entry.Timestamp.Format(time.RFC3339),
					entry.Action,
					entry.Details,
				))
			}
			buf.WriteString("\n")
		}
	}

	if report.ChaosReport != nil {
		cr := report.ChaosReport
		buf.WriteString("## Chaos Experiment Report\n\n")
		buf.WriteString(fmt.Sprintf("- **ID:** %s\n", cr.ExperimentID))
		buf.WriteString(fmt.Sprintf("- **Name:** %s\n", cr.Name))
		buf.WriteString(fmt.Sprintf("- **Type:** %s\n", cr.Type))
		buf.WriteString(fmt.Sprintf("- **Status:** %s\n", cr.Status))
		buf.WriteString(fmt.Sprintf("- **Duration:** %v\n", cr.Duration))
		buf.WriteString(fmt.Sprintf("- **Total Requests:** %d\n", cr.TotalRequests))
		buf.WriteString(fmt.Sprintf("- **Success:** %d\n", cr.SuccessCount))
		buf.WriteString(fmt.Sprintf("- **Errors:** %d\n", cr.ErrorCount))
		buf.WriteString("\n")
	}

	if len(report.Recommendations) > 0 {
		buf.WriteString("## Recommendations\n\n")
		for _, rec := range report.Recommendations {
			buf.WriteString(fmt.Sprintf("### [%s] %s\n\n", rec.Priority, rec.Title))
			buf.WriteString(fmt.Sprintf("**Category:** %s\n\n", rec.Category))
			buf.WriteString(fmt.Sprintf("%s\n\n", rec.Description))
			buf.WriteString(fmt.Sprintf("**Action:** %s\n\n", rec.Action))
		}
	}

	return buf.String()
}

func (r *Reporter) renderHTML(report *FullReport) string {
	healthColor := "green"
	if report.Summary.HealthScore < 50 {
		healthColor = "red"
	} else if report.Summary.HealthScore < 80 {
		healthColor = "yellow"
	}

	return fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chaos Migration Report</title>
    <style>
        body { font-family: Arial, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
        .summary { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
        .health-score { font-size: 48px; font-weight: bold; color: %s; }
        .section { margin-bottom: 30px; padding: 20px; border: 1px solid #ddd; border-radius: 8px; }
        h1 { color: #333; }
        h2 { color: #555; border-bottom: 2px solid #ddd; padding-bottom: 10px; }
        .metric { display: inline-block; margin-right: 30px; }
        table { width: 100%%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f0f0f0; }
        .status-completed { color: green; }
        .status-failed { color: red; }
        .status-rolled_back { color: orange; }
        .priority-critical { color: #dc3545; font-weight: bold; }
        .priority-high { color: #fd7e14; }
        .priority-medium { color: #ffc107; }
    </style>
</head>
<body>
    <h1>Chaos Migration Report</h1>
    <p><em>Generated: %s</em></p>
    
    <div class="summary">
        <h2>Summary</h2>
        <div class="health-score">%d/100</div>
        <div class="metric"><strong>Success Rate:</strong> %.2f%%</div>
        <div class="metric"><strong>Error Rate:</strong> %.2f%%</div>
        <div class="metric"><strong>Critical Issues:</strong> %d</div>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
        <table>
            <tr><th>Priority</th><th>Category</th><th>Title</th><th>Action</th></tr>
            %s
        </table>
    </div>
</body>
</html>`,
		healthColor,
		report.GeneratedAt.Format(time.RFC3339),
		report.Summary.HealthScore,
		report.Summary.SuccessRate,
		report.Summary.ErrorRate,
		report.Summary.CriticalIssues,
		r.renderRecommendationsHTML(report.Recommendations),
	)
}

func (r *Reporter) renderRecommendationsHTML(recs []Recommendation) string {
	if len(recs) == 0 {
		return "<tr><td colspan='4'>No recommendations</td></tr>"
	}

	var buf bytes.Buffer
	for _, rec := range recs {
		priorityClass := fmt.Sprintf("priority-%s", strings.ToLower(rec.Priority))
		buf.WriteString(fmt.Sprintf(`<tr class="%s"><td>%s</td><td>%s</td><td>%s</td><td>%s</td></tr>`,
			priorityClass, rec.Priority, rec.Category, rec.Title, rec.Action))
	}
	return buf.String()
}

func generateReportID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
