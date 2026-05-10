package migration

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"migration-chaos-simulator/internal/logger"
	"migration-chaos-simulator/internal/storage"
	"migration-chaos-simulator/internal/tracer"
)

type MigrationExecutor struct {
	dbPool *storage.PostgresPool
	tracer *tracer.Tracer
	config MigrationConfig
	mu     sync.Mutex
}

func NewExecutor(dbPool *storage.PostgresPool, tr *tracer.Tracer, config MigrationConfig) *MigrationExecutor {
	return &MigrationExecutor{
		dbPool: dbPool,
		tracer: tr,
		config: config,
	}
}

func (e *MigrationExecutor) CreateMigration(name, version, description string, steps []*MigrationStep) *Migration {
	m := &Migration{
		ID:          generateMigrationID(),
		Name:        name,
		Version:     version,
		Description: description,
		Steps:       steps,
		Status:      MigrationStatusPending,
		RollbackLog: make([]RollbackEntry, 0),
	}

	for i, step := range steps {
		step.ID = fmt.Sprintf("step-%s-%d", m.ID, i)
		step.Index = i
		step.Status = StepStatusPending
		if e.config.EnableChecksum {
			step.Checksum = calculateChecksum(step.UpSQL + step.DownSQL)
		}
	}

	m.Checksum = calculateMigrationChecksum(m)
	return m
}

func (e *MigrationExecutor) Plan(m *Migration) *ExecutionPlan {
	plan := &ExecutionPlan{
		MigrationID: m.ID,
		TotalSteps:  len(m.Steps),
	}

	var estimatedTime time.Duration
	var riskLevel RiskLevel = RiskLow

	for _, step := range m.Steps {
		stepTime := estimateStepTime(step)
		estimatedTime += stepTime

		stepRisk := assessStepRisk(step)
		if stepRisk > riskLevel {
			riskLevel = stepRisk
		}
	}

	rollbackPlan := make([]RollbackPlanStep, 0, len(m.Steps))
	for i := len(m.Steps) - 1; i >= 0; i-- {
		step := m.Steps[i]
		if step.DownSQL != "" {
			rollbackPlan = append(rollbackPlan, RollbackPlanStep{
				StepID:        step.ID,
				Action:        fmt.Sprintf("Rollback: %s", step.Name),
				EstimatedTime: estimateStepTime(step),
			})
		}
	}

	plan.EstimatedTime = estimatedTime
	plan.RiskLevel = riskLevel
	plan.RollbackPlan = rollbackPlan

	return plan
}

func (e *MigrationExecutor) Execute(ctx context.Context, m *Migration) (*MigrationResult, error) {
	e.mu.Lock()
	defer e.mu.Unlock()

	_, traceCtx := e.tracer.StartTrace(m.Name, map[string]interface{}{
		"migration_id": m.ID,
		"version":      m.Version,
		"total_steps":  len(m.Steps),
	})
	m.TraceID = ""

	m.Status = MigrationStatusRunning
	m.StartTime = time.Now()

	result := &MigrationResult{
		MigrationID: m.ID,
	}

	logger.Info("Starting migration execution",
		zap.String("migration_id", m.ID),
		zap.String("name", m.Name),
		zap.Int("steps", len(m.Steps)),
	)

	for _, step := range m.Steps {
		if err := e.executeStep(traceCtx, m, step); err != nil {
			result.Errors = append(result.Errors, StepError{
				StepID:    step.ID,
				StepName:  step.Name,
				Message:   err.Error(),
				SQL:       step.UpSQL,
				Timestamp: time.Now(),
			})
			result.StepsFailed++

			logger.Error("Migration step failed",
				zap.String("step_id", step.ID),
				zap.String("step_name", step.Name),
				zap.Error(err),
			)

			if !e.config.EnableDryRun {
				rollbackErr := e.rollbackFromStep(traceCtx, m, step)
				if rollbackErr != nil {
					logger.Error("Rollback failed",
						zap.String("migration_id", m.ID),
						zap.Error(rollbackErr),
					)
					m.Status = MigrationStatusFailed
				} else {
					m.Status = MigrationStatusRolledBack
				}
			} else {
				m.Status = MigrationStatusFailed
			}

			m.EndTime = time.Now()
			result.Status = m.Status
			result.Duration = m.EndTime.Sub(m.StartTime)
			e.tracer.EndTrace(m.TraceID, tracer.SpanStatusError)

			return result, err
		}

		result.StepsCompleted++
		result.TotalRowsAffected += step.RowsAffected
	}

	m.Status = MigrationStatusCompleted
	m.EndTime = time.Now()
	result.Status = m.Status
	result.Duration = m.EndTime.Sub(m.StartTime)

	integrityReport := e.runDataIntegrityChecks(traceCtx, m)
	result.DataIntegrity = *integrityReport

	e.tracer.EndTrace(m.TraceID, tracer.SpanStatusOk)

	logger.Info("Migration completed successfully",
		zap.String("migration_id", m.ID),
		zap.Duration("duration", result.Duration),
		zap.Int("completed_steps", result.StepsCompleted),
	)

	return result, nil
}

func (e *MigrationExecutor) executeStep(ctx context.Context, m *Migration, step *MigrationStep) error {
	span, _ := e.tracer.StartSpan(ctx, step.Name, "", map[string]interface{}{
		"step_id":   step.ID,
		"step_type": string(step.Type),
	})
	defer e.tracer.EndSpan(span, tracer.SpanStatusOk, "")

	step.Status = StepStatusRunning
	step.StartTime = time.Now()

	logger.Info("Executing migration step",
		zap.String("step_id", step.ID),
		zap.String("step_name", step.Name),
		zap.String("type", string(step.Type)),
	)

	if e.config.EnableDataSnapshot {
		if err := e.takeSnapshot(ctx, step); err != nil {
			step.Warnings = append(step.Warnings, fmt.Sprintf("Snapshot failed: %v", err))
		}
	}

	var lastErr error
	for retry := 0; retry <= e.config.MaxRetryPerStep; retry++ {
		if retry > 0 {
			step.RetryCount = retry
			logger.Warn("Retrying migration step",
				zap.String("step_id", step.ID),
				zap.Int("retry", retry),
			)
			time.Sleep(e.config.RetryDelay)
		}

		var affected int64
		var err error

		if e.config.EnableDryRun {
			affected, err = e.simulateStep(ctx, step)
		} else if e.config.TransactionPerStep {
			affected, err = e.executeStepInTx(ctx, step)
		} else {
			affected, err = e.executeStepDirect(ctx, step)
		}

		if err != nil {
			lastErr = err
			continue
		}

		step.RowsAffected = affected
		step.Status = StepStatusCompleted
		step.EndTime = time.Now()

		logger.Info("Migration step completed",
			zap.String("step_id", step.ID),
			zap.Int64("rows_affected", affected),
			zap.Duration("duration", step.EndTime.Sub(step.StartTime)),
		)

		return nil
	}

	step.Status = StepStatusFailed
	step.EndTime = time.Now()
	step.Error = lastErr.Error()

	return lastErr
}

func (e *MigrationExecutor) executeStepInTx(ctx context.Context, step *MigrationStep) (int64, error) {
	tx, err := e.dbPool.BeginTx(ctx)
	if err != nil {
		return 0, fmt.Errorf("failed to start transaction: %w", err)
	}

	affected, err := tx.Exec(ctx, step.UpSQL)
	if err != nil {
		tx.Rollback(ctx)
		return 0, fmt.Errorf("failed to execute step: %w", err)
	}

	if err := tx.Commit(ctx); err != nil {
		return 0, fmt.Errorf("failed to commit: %w", err)
	}

	return affected, nil
}

func (e *MigrationExecutor) executeStepDirect(ctx context.Context, step *MigrationStep) (int64, error) {
	return e.dbPool.Exec(ctx, step.UpSQL)
}

func (e *MigrationExecutor) simulateStep(ctx context.Context, step *MigrationStep) (int64, error) {
	logger.Info("[Dry Run] Would execute SQL",
		zap.String("sql", step.UpSQL),
	)

	if step.DownSQL != "" {
		logger.Info("[Dry Run] Rollback SQL available",
			zap.String("rollback_sql", step.DownSQL),
		)
	}

	return 0, nil
}

func (e *MigrationExecutor) rollbackFromStep(ctx context.Context, m *Migration, failedStep *MigrationStep) error {
	logger.Warn("Starting rollback",
		zap.String("migration_id", m.ID),
		zap.String("failed_step", failedStep.ID),
	)

	for i := len(m.Steps) - 1; i >= 0; i-- {
		step := m.Steps[i]

		if step.Status != StepStatusCompleted || step.DownSQL == "" {
			continue
		}

		logger.Info("Rolling back step",
			zap.String("step_id", step.ID),
			zap.String("step_name", step.Name),
		)

		if !e.config.EnableDryRun {
			if _, err := e.dbPool.Exec(ctx, step.DownSQL); err != nil {
				m.RollbackLog = append(m.RollbackLog, RollbackEntry{
					Timestamp: time.Now(),
					StepID:    step.ID,
					Action:    "ROLLBACK_FAILED",
					Details:   err.Error(),
				})
				return fmt.Errorf("rollback failed at step %s: %w", step.ID, err)
			}
		}

		step.Status = StepStatusRolledBack
		m.RollbackLog = append(m.RollbackLog, RollbackEntry{
			Timestamp: time.Now(),
			StepID:    step.ID,
			Action:    "ROLLED_BACK",
			Details:   fmt.Sprintf("Step '%s' successfully rolled back", step.Name),
		})
	}

	return nil
}

func (e *MigrationExecutor) takeSnapshot(ctx context.Context, step *MigrationStep) error {
	snapshot := &DataSnapshot{
		Timestamp:   time.Now(),
		ColumnStats: make(map[string]ColumnStat),
	}

	step.DataSnapshot = snapshot
	return nil
}

func (e *MigrationExecutor) runDataIntegrityChecks(ctx context.Context, m *Migration) *DataIntegrityReport {
	report := &DataIntegrityReport{
		Passed:     true,
		Checks:     make([]DataCheck, 0),
		TotalCount: len(m.Steps),
	}

	for _, step := range m.Steps {
		if step.Type == StepTypeDataCheck {
			check := DataCheck{
				Name:    step.Name,
				Passed:  step.Status == StepStatusCompleted,
				Message: step.Error,
			}
			if !check.Passed {
				report.Passed = false
				report.FailedCount++
			}
			report.Checks = append(report.Checks, check)
		}
	}

	return report
}

func estimateStepTime(step *MigrationStep) time.Duration {
	switch step.Type {
	case StepTypeDDL:
		return 30 * time.Second
	case StepTypeIndexBuild:
		return 2 * time.Minute
	case StepTypeDML:
		return 1 * time.Minute
	case StepTypeConstraint:
		return 45 * time.Second
	default:
		return 10 * time.Second
	}
}

func assessStepRisk(step *MigrationStep) RiskLevel {
	switch step.Type {
	case StepTypeDDL:
		return RiskHigh
	case StepTypeIndexBuild:
		return RiskMedium
	case StepTypeDML:
		if step.RowsAffected > 10000 {
			return RiskHigh
		}
		return RiskMedium
	case StepTypeConstraint:
		return RiskCritical
	default:
		return RiskLow
	}
}

func calculateChecksum(data string) string {
	h := sha256.Sum256([]byte(data))
	return hex.EncodeToString(h[:])
}

func calculateMigrationChecksum(m *Migration) string {
	var data string
	for _, step := range m.Steps {
		data += step.UpSQL + step.DownSQL
	}
	return calculateChecksum(data)
}

func generateMigrationID() string {
	return fmt.Sprintf("mig-%d", time.Now().UnixNano())
}
