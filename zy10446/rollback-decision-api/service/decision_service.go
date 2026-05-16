package service

import (
	"encoding/json"
	"fmt"
	"rollback-decision-api/models"
	"rollback-decision-api/storage"
	"time"

	"github.com/google/uuid"
)

func EvaluateBatch(batchID string, rawInput string) (*models.DecisionRecord, error) {
	db := storage.GetDB()

	var batch models.ReleaseBatch
	if err := db.First(&batch, "id = ?", batchID).Error; err != nil {
		return nil, fmt.Errorf("batch not found: %w", err)
	}

	var coreMetrics []models.CoreMetric
	db.Where("batch_id = ?", batchID).Find(&coreMetrics)

	var rules []models.ThresholdRule
	db.Where("batch_id = ?", batchID).Find(&rules)

	violatedRules, conclusion := evaluateMetrics(coreMetrics, rules)
	newStatus := models.StatusApproved
	decisionType := "AUTO_APPROVED"
	reason := "All metrics within thresholds"

	if len(violatedRules) > 0 {
		newStatus = models.StatusRollback
		decisionType = "AUTO_ROLLBACK"
		reason = fmt.Sprintf("Violated %d threshold rules", len(violatedRules))
	}

	violatedJSON, _ := json.Marshal(violatedRules)

	decision := &models.DecisionRecord{
		ID:            uuid.New().String(),
		BatchID:       batchID,
		Status:        newStatus,
		DecisionType:  decisionType,
		Reason:        reason,
		RawInput:      rawInput,
		Conclusion:    conclusion,
		ViolatedRules: string(violatedJSON),
		DecidedBy:     "SYSTEM",
		DecidedAt:     time.Now(),
	}

	if err := db.Create(decision).Error; err != nil {
		return nil, err
	}

	batch.Status = newStatus
	batch.UpdatedAt = time.Now()
	db.Save(&batch)

	return decision, nil
}

func evaluateMetrics(metrics []models.CoreMetric, rules []models.ThresholdRule) ([]map[string]interface{}, string) {
	var violated []map[string]interface{}
	conclusion := "Metrics evaluated successfully"

	for _, rule := range rules {
		var metric *models.CoreMetric
		for i, m := range metrics {
			if m.Name == rule.MetricName {
				metric = &metrics[i]
				break
			}
		}

		if metric == nil {
			continue
		}

		if isViolated(metric.Value, rule.Operator, rule.Threshold) {
			violation := map[string]interface{}{
				"rule_id":    rule.ID,
				"metric":     rule.MetricName,
				"value":      metric.Value,
				"threshold":  rule.Threshold,
				"operator":   rule.Operator,
				"severity":   rule.Severity,
				"description": rule.Description,
			}
			violated = append(violated, violation)
		}
	}

	if len(violated) > 0 {
		conclusion = fmt.Sprintf("ROLLBACK TRIGGERED: %d rules violated", len(violated))
	}

	return violated, conclusion
}

func isViolated(value float64, op models.ThresholdOperator, threshold float64) bool {
	switch op {
	case models.OpGreaterThan:
		return value > threshold
	case models.OpLessThan:
		return value < threshold
	case models.OpGreaterEqual:
		return value >= threshold
	case models.OpLessEqual:
		return value <= threshold
	case models.OpEqual:
		return value == threshold
	default:
		return false
	}
}

func ManualOverride(batchID string, newStatus models.ReleaseStatus, reason string, operator string) (*models.DecisionRecord, error) {
	db := storage.GetDB()

	var batch models.ReleaseBatch
	if err := db.First(&batch, "id = ?", batchID).Error; err != nil {
		return nil, fmt.Errorf("batch not found: %w", err)
	}

	decision := &models.DecisionRecord{
		ID:            uuid.New().String(),
		BatchID:       batchID,
		Status:        newStatus,
		DecisionType:  "MANUAL_OVERRIDE",
		Reason:        reason,
		Conclusion:    fmt.Sprintf("Manual override by %s: %s", operator, reason),
		DecidedBy:     operator,
		DecidedAt:     time.Now(),
	}

	if err := db.Create(decision).Error; err != nil {
		return nil, err
	}

	batch.Status = newStatus
	batch.UpdatedAt = time.Now()
	db.Save(&batch)

	return decision, nil
}

func ExportSummary(batchID string, exportedBy string) (*models.RollbackSummary, error) {
	db := storage.GetDB()

	var batch models.ReleaseBatch
	if err := db.First(&batch, "id = ?", batchID).Error; err != nil {
		return nil, fmt.Errorf("batch not found: %w", err)
	}

	var coreMetrics []models.CoreMetric
	db.Where("batch_id = ?", batchID).Find(&coreMetrics)

	var decisions []models.DecisionRecord
	db.Where("batch_id = ?", batchID).Order("decided_at desc").Find(&decisions)

	metricsJSON, _ := json.Marshal(coreMetrics)
	decisionsJSON, _ := json.Marshal(decisions)

	summaryText := generateSummaryText(batch, coreMetrics, decisions)

	summary := &models.RollbackSummary{
		ID:           uuid.New().String(),
		BatchID:      batchID,
		SummaryText:  summaryText,
		MetricsData:  string(metricsJSON),
		DecisionData: string(decisionsJSON),
		ExportedAt:   time.Now(),
		ExportedBy:   exportedBy,
	}

	if err := db.Create(summary).Error; err != nil {
		return nil, err
	}

	return summary, nil
}

func generateSummaryText(batch models.ReleaseBatch, metrics []models.CoreMetric, decisions []models.DecisionRecord) string {
	summary := fmt.Sprintf("Release Batch Summary: %s (%s)\n", batch.Name, batch.Version)
	summary += fmt.Sprintf("Status: %s\n", batch.Status)
	summary += fmt.Sprintf("Created: %s\n\n", batch.CreatedAt.Format(time.RFC3339))

	summary += "Core Metrics:\n"
	for _, m := range metrics {
		summary += fmt.Sprintf("  - %s: %.4f (baseline: %.4f)\n", m.Name, m.Value, m.Baseline)
	}

	summary += "\nDecisions:\n"
	for _, d := range decisions {
		summary += fmt.Sprintf("  - [%s] %s by %s: %s\n",
			d.DecidedAt.Format(time.RFC3339), d.Status, d.DecidedBy, d.Conclusion)
	}

	return summary
}

func AggregateMetrics(batchID string) (map[string]float64, error) {
	db := storage.GetDB()

	var metrics []models.CoreMetric
	if err := db.Where("batch_id = ?", batchID).Find(&metrics).Error; err != nil {
		return nil, err
	}

	aggregated := make(map[string]float64)
	for _, m := range metrics {
		aggregated[m.Name] = m.Value
	}

	return aggregated, nil
}
