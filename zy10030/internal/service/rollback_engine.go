package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/jmoiron/sqlx"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/tracer"
)

type RollbackEngine struct {
	maxRetries    int
	retryInterval time.Duration
	enableSaga    bool
}

func NewRollbackEngine(maxRetries int, retryIntervalStr string, enableSaga bool) *RollbackEngine {
	retryInterval, _ := time.ParseDuration(retryIntervalStr)
	if retryInterval <= 0 {
		retryInterval = 1 * time.Second
	}

	return &RollbackEngine{
		maxRetries:    maxRetries,
		retryInterval: retryInterval,
		enableSaga:    enableSaga,
	}
}

type RollbackStepAction func(ctx context.Context, params map[string]interface{}) error
type RollbackStepCompensate func(ctx context.Context, params map[string]interface{}) error

var stepActions = map[string]RollbackStepAction{}
var stepCompensates = map[string]RollbackStepCompensate{}
var stepMu sync.RWMutex

func RegisterStepAction(stepType string, action RollbackStepAction, compensate RollbackStepCompensate) {
	stepMu.Lock()
	defer stepMu.Unlock()
	stepActions[stepType] = action
	stepCompensates[stepType] = compensate
}

func (e *RollbackEngine) TriggerRollback(ctx context.Context, releaseID int64, triggerType, triggerBy, reason string) (*model.RollbackRecord, error) {
	ctx, span := tracer.StartSpan(ctx, "rollback.TriggerRollback")
	defer span.End()

	tx, err := database.DB.Beginx()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var release model.GrayRelease
	if err := tx.Get(&release, `SELECT * FROM gray_releases WHERE id = $1`, releaseID); err != nil {
		return nil, fmt.Errorf("release not found: %w", err)
	}

	if release.Status != "running" && release.Status != "paused" {
		return nil, fmt.Errorf("release is not in rollbackable state")
	}

	now := time.Now()
	rollbackRecord := &model.RollbackRecord{
		ReleaseID:   releaseID,
		TriggerType: triggerType,
		TriggerBy:   triggerBy,
		Reason:      reason,
		Status:      "initiated",
		StartedAt:   now,
		CreatedAt:   now,
	}

	var rollbackID int64
	err = tx.QueryRow(`
		INSERT INTO rollback_records (release_id, trigger_type, trigger_by, reason, status, started_at, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id
	`, rollbackRecord.ReleaseID, rollbackRecord.TriggerType, rollbackRecord.TriggerBy, rollbackRecord.Reason,
		rollbackRecord.Status, rollbackRecord.StartedAt, rollbackRecord.CreatedAt).Scan(&rollbackID)

	if err != nil {
		return nil, fmt.Errorf("failed to create rollback record: %w", err)
	}

	rollbackRecord.ID = rollbackID

	if err := e.generateRollbackSteps(ctx, tx, rollbackID, &release); err != nil {
		return nil, fmt.Errorf("failed to generate rollback steps: %w", err)
	}

	if _, err := tx.Exec(`UPDATE gray_releases SET status = 'rolling_back', updated_at = $1 WHERE id = $2`, now, releaseID); err != nil {
		return nil, fmt.Errorf("failed to update release status: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	logger.WithFields(map[string]interface{}{
		"rollback_id": rollbackID,
		"release_id":  releaseID,
	}).Info("Rollback triggered")

	go e.executeRollback(context.Background(), rollbackID)

	return rollbackRecord, nil
}

func (e *RollbackEngine) generateRollbackSteps(ctx context.Context, tx *sqlx.Tx, rollbackID int64, release *model.GrayRelease) error {
	var instances []model.GrayInstance
	if err := tx.Select(&instances, `SELECT * FROM gray_instances WHERE release_id = $1 ORDER BY id DESC`, release.ID); err != nil {
		return err
	}

	for i, instance := range instances {
		params := map[string]interface{}{
			"instance_id": instance.InstanceID,
			"host":        instance.Host,
			"port":        instance.Port,
			"version":     instance.Version,
		}
		paramsJSON, _ := json.Marshal(params)

		step := &model.RollbackStep{
			RollbackID:     rollbackID,
			StepIndex:      i,
			StepType:       "instance_rollback",
			TargetInstance: instance.InstanceID,
			Action:         "rollback_instance",
			Params:         paramsJSON,
			Status:         "pending",
			MaxRetries:     e.maxRetries,
			CreatedAt:      time.Now(),
		}

		_, err := tx.Exec(`
			INSERT INTO rollback_steps (rollback_id, step_index, step_type, target_instance, action, params, status, retry_count, max_retries, created_at)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		`, step.RollbackID, step.StepIndex, step.StepType, step.TargetInstance, step.Action, step.Params,
			step.Status, step.RetryCount, step.MaxRetries, step.CreatedAt)

		if err != nil {
			return err
		}
	}

	configParams := map[string]interface{}{
		"release_id": release.ID,
	}
	configParamsJSON, _ := json.Marshal(configParams)

	_, err := tx.Exec(`
		INSERT INTO rollback_steps (rollback_id, step_index, step_type, target_instance, action, params, status, retry_count, max_retries, created_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
	`, rollbackID, len(instances), "release_finalize", "", "finalize_release", configParamsJSON,
		"pending", 0, e.maxRetries, time.Now())

	return err
}

func (e *RollbackEngine) executeRollback(ctx context.Context, rollbackID int64) {
	ctx, span := tracer.StartSpan(ctx, "rollback.ExecuteRollback")
	defer span.End()

	logger.WithField("rollback_id", rollbackID).Info("Starting rollback execution")

	var steps []model.RollbackStep
	if err := database.Select(&steps, `SELECT * FROM rollback_steps WHERE rollback_id = $1 ORDER BY step_index`, rollbackID); err != nil {
		logger.Errorf("Failed to get rollback steps: %v", err)
		e.markRollbackFailed(ctx, rollbackID, fmt.Sprintf("failed to get steps: %v", err))
		return
	}

	failedSteps := []map[string]interface{}{}

	for i := range steps {
		step := &steps[i]
		
		if e.enableSaga && step.Status == "failed" && step.StepIndex > 0 {
			if err := e.compensatePreviousSteps(ctx, rollbackID, step.StepIndex); err != nil {
				logger.Errorf("Compensation failed: %v", err)
			}
			break
		}

		if err := e.executeStepWithRetry(ctx, step); err != nil {
			logger.Errorf("Step %d failed after max retries: %v", step.StepIndex, err)
			failedSteps = append(failedSteps, map[string]interface{}{
				"step_index": step.StepIndex,
				"step_type":  step.StepType,
				"error":      err.Error(),
			})

			if e.enableSaga {
				logger.Infof("Starting compensation for failed rollback")
				if err := e.compensatePreviousSteps(ctx, rollbackID, step.StepIndex); err != nil {
					logger.Errorf("Compensation failed: %v", err)
				}
			}
			break
		}
	}

	if len(failedSteps) > 0 {
		failedStepsJSON, _ := json.Marshal(failedSteps)
		_, _ = database.Exec(`
			UPDATE rollback_records SET status = 'failed', failed_steps = $1, completed_at = $2 WHERE id = $3
		`, failedStepsJSON, time.Now(), rollbackID)
		logger.WithField("rollback_id", rollbackID).Error("Rollback completed with failures")
	} else {
		_, _ = database.Exec(`
			UPDATE rollback_records SET status = 'completed', completed_at = $1 WHERE id = $2
		`, time.Now(), rollbackID)
		
		var releaseID int64
		_ = database.Get(&releaseID, `SELECT release_id FROM rollback_records WHERE id = $1`, rollbackID)
		_, _ = database.Exec(`UPDATE gray_releases SET status = 'rolled_back', updated_at = $1 WHERE id = $2`, time.Now(), releaseID)
		
		logger.WithField("rollback_id", rollbackID).Info("Rollback completed successfully")
	}
}

func (e *RollbackEngine) executeStepWithRetry(ctx context.Context, step *model.RollbackStep) error {
	stepMu.RLock()
	action, hasAction := stepActions[step.Action]
	stepMu.RUnlock()

	if !hasAction {
		return fmt.Errorf("no action registered for: %s", step.Action)
	}

	var params map[string]interface{}
	if err := json.Unmarshal(step.Params, &params); err != nil {
		return err
	}

	var lastErr error

	for retry := 0; retry <= step.MaxRetries; retry++ {
		now := time.Now()
		_, _ = database.Exec(`
			UPDATE rollback_steps SET status = 'running', retry_count = $1, started_at = $2, updated_at = $3 WHERE id = $4
		`, retry, now, now, step.ID)

		logger.WithFields(map[string]interface{}{
			"step_id":   step.ID,
			"step_type": step.StepType,
			"retry":     retry,
		}).Info("Executing rollback step")

		if err := action(ctx, params); err != nil {
			lastErr = err
			_, _ = database.Exec(`
				UPDATE rollback_steps SET status = 'failed', error_message = $1, updated_at = $2 WHERE id = $3
			`, err.Error(), time.Now(), step.ID)

			if retry < step.MaxRetries {
				logger.Warnf("Step failed, retrying in %v: %v", e.retryInterval, err)
				time.Sleep(e.retryInterval * time.Duration(retry+1))
				continue
			}

			return fmt.Errorf("step failed after %d retries: %w", step.MaxRetries, lastErr)
		}

		_, _ = database.Exec(`
			UPDATE rollback_steps SET status = 'completed', completed_at = $1, updated_at = $2 WHERE id = $3
		`, time.Now(), time.Now(), step.ID)

		return nil
	}

	return lastErr
}

func (e *RollbackEngine) compensatePreviousSteps(ctx context.Context, rollbackID int64, failedStepIndex int) error {
	var steps []model.RollbackStep
	if err := database.Select(&steps, `
		SELECT * FROM rollback_steps 
		WHERE rollback_id = $1 AND step_index < $2 AND status = 'completed'
		ORDER BY step_index DESC
	`, rollbackID, failedStepIndex); err != nil {
		return err
	}

	for _, step := range steps {
		stepMu.RLock()
		compensate, hasCompensate := stepCompensates[step.Action]
		stepMu.RUnlock()

		if !hasCompensate {
			continue
		}

		var params map[string]interface{}
		if err := json.Unmarshal(step.Params, &params); err != nil {
			continue
		}

		logger.WithField("step_id", step.ID).Info("Compensating step")

		if err := compensate(ctx, params); err != nil {
			logger.Errorf("Compensation failed for step %d: %v", step.ID, err)
			continue
		}

		_, _ = database.Exec(`
			UPDATE rollback_steps SET status = 'compensated', updated_at = $1 WHERE id = $2
		`, time.Now(), step.ID)
	}

	return nil
}

func (e *RollbackEngine) markRollbackFailed(ctx context.Context, rollbackID int64, reason string) {
	failedSteps := []map[string]interface{}{{"error": reason}}
	failedStepsJSON, _ := json.Marshal(failedSteps)
	_, _ = database.Exec(`
		UPDATE rollback_records SET status = 'failed', failed_steps = $1, completed_at = $2 WHERE id = $3
	`, failedStepsJSON, time.Now(), rollbackID)
}

func (e *RollbackEngine) GetRollbackByID(ctx context.Context, rollbackID int64) (*model.RollbackRecord, error) {
	var record model.RollbackRecord
	if err := database.Get(&record, `SELECT * FROM rollback_records WHERE id = $1`, rollbackID); err != nil {
		return nil, err
	}
	return &record, nil
}

func (e *RollbackEngine) GetRollbackSteps(ctx context.Context, rollbackID int64) ([]*model.RollbackStep, error) {
	var steps []*model.RollbackStep
	if err := database.Select(&steps, `SELECT * FROM rollback_steps WHERE rollback_id = $1 ORDER BY step_index`, rollbackID); err != nil {
		return nil, err
	}
	return steps, nil
}

func (e *RollbackEngine) ListRollbacks(ctx context.Context, releaseID int64, limit, offset int) ([]*model.RollbackRecord, error) {
	query := `SELECT * FROM rollback_records WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if releaseID > 0 {
		query += ` AND release_id = $` + fmt.Sprint(argIndex)
		args = append(args, releaseID)
		argIndex++
	}

	query += ` ORDER BY created_at DESC LIMIT $` + fmt.Sprint(argIndex)
	args = append(args, limit)
	argIndex++

	if offset > 0 {
		query += ` OFFSET $` + fmt.Sprint(argIndex)
		args = append(args, offset)
	}

	var records []*model.RollbackRecord
	if err := database.Select(&records, query, args...); err != nil {
		return nil, err
	}

	return records, nil
}

func init() {
	RegisterStepAction("rollback_instance", func(ctx context.Context, params map[string]interface{}) error {
		instanceID, _ := params["instance_id"].(string)
		version, _ := params["version"].(string)
		
		logger.WithFields(map[string]interface{}{
			"instance_id": instanceID,
			"version":     version,
		}).Info("Simulating instance rollback")
		
		time.Sleep(500 * time.Millisecond)
		return nil
	}, func(ctx context.Context, params map[string]interface{}) error {
		instanceID, _ := params["instance_id"].(string)
		logger.WithField("instance_id", instanceID).Info("Compensating: restoring instance to previous version")
		return nil
	})

	RegisterStepAction("finalize_release", func(ctx context.Context, params map[string]interface{}) error {
		releaseID, _ := params["release_id"].(float64)
		logger.WithField("release_id", int64(releaseID)).Info("Finalizing release rollback")
		return nil
	}, nil)
}

