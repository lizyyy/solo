package service

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/google/uuid"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/tracer"
)

type ReportService struct {
	reportsDir   string
	traceService *TraceService
}

func NewReportService(reportsDir string, traceService *TraceService) *ReportService {
	if reportsDir == "" {
		reportsDir = "./reports"
	}
	os.MkdirAll(reportsDir, 0755)
	
	return &ReportService{
		reportsDir:   reportsDir,
		traceService: traceService,
	}
}

func (s *ReportService) CreateIncidentReport(ctx context.Context, title, severity, category string,
	triggerReleaseID, triggerRollbackID *int64, affectedServices []string,
	rootCause, impactAnalysis, resolutionSteps string, reportedBy string) (*model.IncidentReport, error) {

	ctx, span := tracer.StartSpan(ctx, "report_service.CreateIncidentReport")
	defer span.End()

	reportID := uuid.New().String()
	now := time.Now()

	timeline := []map[string]interface{}{
		{
			"timestamp": now.Format(time.RFC3339),
			"event":     "Incident reported",
			"actor":     reportedBy,
		},
	}
	timelineJSON, _ := json.Marshal(timeline)

	report := &model.IncidentReport{
		ReportID:          reportID,
		Title:             title,
		Severity:          severity,
		Category:          category,
		Status:            "open",
		TriggerReleaseID:  triggerReleaseID,
		TriggerRollbackID: triggerRollbackID,
		AffectedServices:  affectedServices,
		RootCause:         rootCause,
		ImpactAnalysis:    impactAnalysis,
		ResolutionSteps:   resolutionSteps,
		Timeline:          timelineJSON,
		ReportedBy:        reportedBy,
		CreatedAt:         now,
		UpdatedAt:         now,
	}

	query := `
		INSERT INTO incident_reports (
			report_id, title, severity, category, status, trigger_release_id,
			trigger_rollback_id, affected_services, root_cause, impact_analysis,
			resolution_steps, timeline, reported_by, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
		RETURNING id
	`

	var id int64
	err := database.QueryRow(query,
		report.ReportID, report.Title, report.Severity, report.Category, report.Status,
		report.TriggerReleaseID, report.TriggerRollbackID, report.AffectedServices,
		report.RootCause, report.ImpactAnalysis, report.ResolutionSteps, report.Timeline,
		report.ReportedBy, report.CreatedAt, report.UpdatedAt,
	).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create incident report: %w", err)
	}

	report.ID = id
	logger.WithFields(map[string]interface{}{
		"report_id": reportID,
		"severity":  severity,
		"title":     title,
	}).Info("Incident report created")

	return report, nil
}

func (s *ReportService) UpdateIncidentReport(ctx context.Context, reportID int64, updates map[string]interface{}) error {
	ctx, span := tracer.StartSpan(ctx, "report_service.UpdateIncidentReport")
	defer span.End()

	now := time.Now()
	updates["updated_at"] = now

	setClauses := []string{}
	args := []interface{}{}
	argIndex := 1

	for key, value := range updates {
		setClauses = append(setClauses, fmt.Sprintf("%s = $%d", key, argIndex))
		args = append(args, value)
		argIndex++
	}

	if len(setClauses) == 0 {
		return nil
	}

	query := fmt.Sprintf("UPDATE incident_reports SET %s WHERE id = $%d",
		strings.Join(setClauses, ", "), argIndex)
	args = append(args, reportID)

	_, err := database.Exec(query, args...)
	if err != nil {
		return fmt.Errorf("failed to update incident report: %w", err)
	}

	logger.WithField("report_id", reportID).Info("Incident report updated")
	return nil
}

func (s *ReportService) AddTimelineEvent(ctx context.Context, reportID int64, event, actor string) error {
	ctx, span := tracer.StartSpan(ctx, "report_service.AddTimelineEvent")
	defer span.End()

	var existingTimeline []map[string]interface{}
	var currentTimeline json.RawMessage
	
	err := database.Get(&currentTimeline, `SELECT timeline FROM incident_reports WHERE id = $1`, reportID)
	if err != nil {
		return err
	}

	if len(currentTimeline) > 0 {
		json.Unmarshal(currentTimeline, &existingTimeline)
	}

	newEvent := map[string]interface{}{
		"timestamp": time.Now().Format(time.RFC3339),
		"event":     event,
		"actor":     actor,
	}
	existingTimeline = append(existingTimeline, newEvent)

	newTimeline, _ := json.Marshal(existingTimeline)
	
	_, err = database.Exec(`
		UPDATE incident_reports 
		SET timeline = $1, updated_at = $2 
		WHERE id = $3
	`, newTimeline, time.Now(), reportID)

	return err
}

func (s *ReportService) GetReportByID(ctx context.Context, reportID int64) (*model.IncidentReport, error) {
	var report model.IncidentReport
	if err := database.Get(&report, `SELECT * FROM incident_reports WHERE id = $1`, reportID); err != nil {
		return nil, err
	}
	return &report, nil
}

func (s *ReportService) GetReportByReportID(ctx context.Context, reportID string) (*model.IncidentReport, error) {
	var report model.IncidentReport
	if err := database.Get(&report, `SELECT * FROM incident_reports WHERE report_id = $1`, reportID); err != nil {
		return nil, err
	}
	return &report, nil
}

func (s *ReportService) ListReports(ctx context.Context, status, severity string, limit, offset int) ([]*model.IncidentReport, error) {
	query := `SELECT * FROM incident_reports WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if status != "" {
		query += fmt.Sprintf(` AND status = $%d`, argIndex)
		args = append(args, status)
		argIndex++
	}

	if severity != "" {
		query += fmt.Sprintf(` AND severity = $%d`, argIndex)
		args = append(args, severity)
		argIndex++
	}

	query += ` ORDER BY created_at DESC`

	if limit > 0 {
		query += fmt.Sprintf(` LIMIT $%d`, argIndex)
		args = append(args, limit)
	}

	var reports []*model.IncidentReport
	if err := database.Select(&reports, query, args...); err != nil {
		return nil, err
	}

	return reports, nil
}

func (s *ReportService) GenerateDetailedReport(ctx context.Context, reportID int64) (map[string]interface{}, error) {
	ctx, span := tracer.StartSpan(ctx, "report_service.GenerateDetailedReport")
	defer span.End()

	report, err := s.GetReportByID(ctx, reportID)
	if err != nil {
		return nil, err
	}

	detailedReport := map[string]interface{}{
		"report_id":         report.ReportID,
		"title":             report.Title,
		"severity":          report.Severity,
		"category":          report.Category,
		"status":            report.Status,
		"affected_services": report.AffectedServices,
		"root_cause":        report.RootCause,
		"impact_analysis":   report.ImpactAnalysis,
		"resolution_steps":  report.ResolutionSteps,
		"reported_by":       report.ReportedBy,
		"created_at":        report.CreatedAt,
		"updated_at":        report.UpdatedAt,
	}

	var timeline []map[string]interface{}
	if len(report.Timeline) > 0 {
		json.Unmarshal(report.Timeline, &timeline)
	}
	detailedReport["timeline"] = timeline

	if report.TriggerReleaseID != nil {
		var release model.GrayRelease
		if err := database.Get(&release, `SELECT * FROM gray_releases WHERE id = $1`, *report.TriggerReleaseID); err == nil {
			detailedReport["trigger_release"] = map[string]interface{}{
				"id":           release.ID,
				"service_name": release.ServiceName,
				"version":      release.Version,
				"status":       release.Status,
			}
		}
	}

	if report.TriggerRollbackID != nil {
		var rollback model.RollbackRecord
		if err := database.Get(&rollback, `SELECT * FROM rollback_records WHERE id = $1`, *report.TriggerRollbackID); err == nil {
			detailedReport["trigger_rollback"] = map[string]interface{}{
				"id":          rollback.ID,
				"release_id":  rollback.ReleaseID,
				"trigger_type": rollback.TriggerType,
				"trigger_by":  rollback.TriggerBy,
				"reason":      rollback.Reason,
				"status":      rollback.Status,
			}

			var steps []model.RollbackStep
			if err := database.Select(&steps, `SELECT * FROM rollback_steps WHERE rollback_id = $1`, rollback.ID); err == nil {
				detailedReport["rollback_steps"] = steps
			}
		}
	}

	if len(report.RelatedTraces) > 0 {
		traceDetails := []map[string]interface{}{}
		for _, traceID := range report.RelatedTraces {
			if analysis, err := s.traceService.AnalyzeTrace(ctx, traceID); err == nil {
				traceDetails = append(traceDetails, analysis)
			}
		}
		detailedReport["related_traces_analysis"] = traceDetails
	}

	return detailedReport, nil
}

func (s *ReportService) ExportReport(ctx context.Context, reportID int64, format string) (string, error) {
	ctx, span := tracer.StartSpan(ctx, "report_service.ExportReport")
	defer span.End()

	detailedReport, err := s.GenerateDetailedReport(ctx, reportID)
	if err != nil {
		return "", err
	}

	reportIDStr := detailedReport["report_id"].(string)
	var filePath string
	var fileContent []byte

	switch strings.ToLower(format) {
	case "json":
		fileContent, err = json.MarshalIndent(detailedReport, "", "  ")
		if err != nil {
			return "", err
		}
		filePath = filepath.Join(s.reportsDir, fmt.Sprintf("incident_%s.json", reportIDStr))

	case "markdown":
		fileContent = s.generateMarkdownReport(detailedReport)
		filePath = filepath.Join(s.reportsDir, fmt.Sprintf("incident_%s.md", reportIDStr))

	default:
		return "", fmt.Errorf("unsupported export format: %s", format)
	}

	if err := os.WriteFile(filePath, fileContent, 0644); err != nil {
		return "", fmt.Errorf("failed to write report file: %w", err)
	}

	now := time.Now()
	_, _ = database.Exec(`
		UPDATE incident_reports 
		SET export_format = $1, exported_at = $2, file_path = $3, updated_at = $4 
		WHERE id = $5
	`, format, now, filePath, now, reportID)

	logger.WithFields(map[string]interface{}{
		"report_id": reportID,
		"format":    format,
		"file_path": filePath,
	}).Info("Incident report exported successfully")

	return filePath, nil
}

func (s *ReportService) generateMarkdownReport(data map[string]interface{}) []byte {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# Incident Report: %s\n\n", data["title"]))
	sb.WriteString(fmt.Sprintf("**Report ID**: %s  \n", data["report_id"]))
	sb.WriteString(fmt.Sprintf("**Severity**: %s  \n", data["severity"]))
	sb.WriteString(fmt.Sprintf("**Category**: %s  \n", data["category"]))
	sb.WriteString(fmt.Sprintf("**Status**: %s  \n", data["status"]))
	sb.WriteString(fmt.Sprintf("**Reported By**: %s  \n", data["reported_by"]))
	sb.WriteString(fmt.Sprintf("**Created At**: %s  \n\n", data["created_at"]))

	if services, ok := data["affected_services"].([]string); ok && len(services) > 0 {
		sb.WriteString("## Affected Services\n\n")
		for _, svc := range services {
			sb.WriteString(fmt.Sprintf("- %s\n", svc))
		}
		sb.WriteString("\n")
	}

	if rootCause, ok := data["root_cause"].(string); ok && rootCause != "" {
		sb.WriteString("## Root Cause\n\n")
		sb.WriteString(fmt.Sprintf("%s\n\n", rootCause))
	}

	if impact, ok := data["impact_analysis"].(string); ok && impact != "" {
		sb.WriteString("## Impact Analysis\n\n")
		sb.WriteString(fmt.Sprintf("%s\n\n", impact))
	}

	if resolution, ok := data["resolution_steps"].(string); ok && resolution != "" {
		sb.WriteString("## Resolution Steps\n\n")
		sb.WriteString(fmt.Sprintf("%s\n\n", resolution))
	}

	if timeline, ok := data["timeline"].([]map[string]interface{}); ok && len(timeline) > 0 {
		sb.WriteString("## Timeline\n\n")
		for i, event := range timeline {
			ts, _ := event["timestamp"].(string)
			evt, _ := event["event"].(string)
			actor, _ := event["actor"].(string)
			sb.WriteString(fmt.Sprintf("%d. **[%s]** %s - by %s\n", i+1, ts, evt, actor))
		}
		sb.WriteString("\n")
	}

	if triggerRelease, ok := data["trigger_release"].(map[string]interface{}); ok {
		sb.WriteString("## Trigger Release\n\n")
		sb.WriteString(fmt.Sprintf("- **Service**: %s\n", triggerRelease["service_name"]))
		sb.WriteString(fmt.Sprintf("- **Version**: %s\n", triggerRelease["version"]))
		sb.WriteString(fmt.Sprintf("- **Status**: %s\n\n", triggerRelease["status"]))
	}

	if triggerRollback, ok := data["trigger_rollback"].(map[string]interface{}); ok {
		sb.WriteString("## Trigger Rollback\n\n")
		sb.WriteString(fmt.Sprintf("- **Trigger Type**: %s\n", triggerRollback["trigger_type"]))
		sb.WriteString(fmt.Sprintf("- **Trigger By**: %s\n", triggerRollback["trigger_by"]))
		sb.WriteString(fmt.Sprintf("- **Reason**: %s\n", triggerRollback["reason"]))
		sb.WriteString(fmt.Sprintf("- **Status**: %s\n\n", triggerRollback["status"]))

		if steps, ok := data["rollback_steps"].([]model.RollbackStep); ok && len(steps) > 0 {
			sb.WriteString("### Rollback Steps\n\n")
			for _, step := range steps {
				sb.WriteString(fmt.Sprintf("- **Step %d**: %s - %s (%s)\n",
					step.StepIndex, step.StepType, step.Action, step.Status))
			}
			sb.WriteString("\n")
		}
	}

	return []byte(sb.String())
}

func (s *ReportService) ResolveReport(ctx context.Context, reportID int64, resolution string) error {
	now := time.Now()
	
	if err := s.AddTimelineEvent(ctx, reportID, "Incident resolved", "system"); err != nil {
		return err
	}

	_, err := database.Exec(`
		UPDATE incident_reports 
		SET status = 'resolved', resolution_steps = COALESCE(resolution_steps, '') || $1, 
		    resolved_at = $2, updated_at = $3 
		WHERE id = $4
	`, "\n"+resolution, now, now, reportID)

	if err != nil {
		return err
	}

	logger.WithField("report_id", reportID).Info("Incident report resolved")
	return nil
}

func (s *ReportService) AutoDetectAndCreateReport(ctx context.Context, releaseID int64, rollbackID int64) (*model.IncidentReport, error) {
	ctx, span := tracer.StartSpan(ctx, "report_service.AutoDetectAndCreateReport")
	defer span.End()

	var release model.GrayRelease
	if err := database.Get(&release, `SELECT * FROM gray_releases WHERE id = $1`, releaseID); err != nil {
		return nil, err
	}

	var rollback model.RollbackRecord
	if err := database.Get(&rollback, `SELECT * FROM rollback_records WHERE id = $1`, rollbackID); err != nil {
		return nil, err
	}

	title := fmt.Sprintf("Auto-detected issue during rollback of %s v%s", release.ServiceName, release.Version)
	severity := "high"
	
	if rollback.Status == "failed" {
		severity = "critical"
		title = fmt.Sprintf("CRITICAL: Rollback failed for %s v%s", release.ServiceName, release.Version)
	}

	affectedServices := []string{release.ServiceName}
	triggerReleaseID := releaseID
	triggerRollbackID := rollbackID

	report, err := s.CreateIncidentReport(ctx, title, severity, "rollback_issue",
		&triggerReleaseID, &triggerRollbackID, affectedServices,
		rollback.Reason,
		fmt.Sprintf("Rollback was triggered for release %d due to: %s", releaseID, rollback.Reason),
		"",
		"system")

	if err != nil {
		return nil, err
	}

	return report, nil
}

