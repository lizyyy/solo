package services

import (
	"errors"
	"time"

	"third-party-api-circuit-breaker/config"
	"third-party-api-circuit-breaker/models"
	"third-party-api-circuit-breaker/utils"

	"gorm.io/gorm"
)

type CircuitBreakerService struct{}

func NewCircuitBreakerService() *CircuitBreakerService {
	return &CircuitBreakerService{}
}

func (s *CircuitBreakerService) GetOrCreateCircuitBreaker(externalAPIID, businessCallerID string) (*models.CircuitBreaker, error) {
	var cb models.CircuitBreaker
	err := utils.DB.Where("external_api_id = ? AND business_caller_id = ?", externalAPIID, businessCallerID).First(&cb).Error
	if err == nil {
		return &cb, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	now := time.Now()
	cb = models.CircuitBreaker{
		ExternalAPIID:    externalAPIID,
		BusinessCallerID: businessCallerID,
		State:            models.StateClosed,
		LastStateChange:  now,
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	if err := utils.DB.Create(&cb).Error; err != nil {
		return nil, err
	}

	return &cb, nil
}

func (s *CircuitBreakerService) GetThreshold(externalAPIID, businessCallerID string) (*models.CircuitThreshold, error) {
	var threshold models.CircuitThreshold
	err := utils.DB.Where("external_api_id = ? AND business_caller_id = ?", externalAPIID, businessCallerID).First(&threshold).Error
	if err == nil {
		return &threshold, nil
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	defaultCfg := config.AppConfig.CircuitBreaker
	threshold = models.CircuitThreshold{
		ExternalAPIID:      externalAPIID,
		BusinessCallerID:   businessCallerID,
		FailureThreshold:   defaultCfg.DefaultFailureThreshold,
		HalfOpenMaxCalls:   defaultCfg.DefaultHalfOpenMaxCalls,
		SleepWindowSeconds: defaultCfg.DefaultSleepWindowSeconds,
		MinimumRequests:    defaultCfg.DefaultMinimumRequests,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	if err := utils.DB.Create(&threshold).Error; err != nil {
		return nil, err
	}

	return &threshold, nil
}

func (s *CircuitBreakerService) RecordCall(cbID string, result models.CallResult, durationMs int64, errorMessage string, responseCode int) (*models.CircuitBreaker, error) {
	tx := utils.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var cb models.CircuitBreaker
	if err := tx.Where("id = ?", cbID).First(&cb).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	prevState := cb.State
	cb.TotalRequests++

	if result == models.ResultSuccess {
		cb.SuccessCount++
	} else {
		cb.FailureCount++
		now := time.Now()
		cb.LastFailureTime = &now
	}

	probeResult := models.ProbeResult{
		CircuitBreakerID: cbID,
		ProbeTime:        time.Now(),
		Result:           result,
		DurationMs:       durationMs,
		ErrorMessage:     errorMessage,
		ResponseCode:     responseCode,
		CreatedAt:        time.Now(),
	}
	if err := tx.Create(&probeResult).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	threshold, err := s.GetThreshold(cb.ExternalAPIID, cb.BusinessCallerID)
	if err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.transitionState(tx, &cb, threshold, result); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.logArbitration(tx, cbID, "", "RECORD_CALL", prevState, cb.State, "Result: "+string(result), "system"); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &cb, nil
}

func (s *CircuitBreakerService) transitionState(tx *gorm.DB, cb *models.CircuitBreaker, threshold *models.CircuitThreshold, result models.CallResult) error {
	now := time.Now()

	switch cb.State {
	case models.StateClosed:
		if cb.TotalRequests >= threshold.MinimumRequests && cb.FailureCount >= threshold.FailureThreshold {
			cb.State = models.StateOpen
			cb.LastStateChange = now
			cb.HalfOpenCallCount = 0
			return s.createRecoveryConclusion(tx, cb.ID, "AUTO_TRIGGER", models.StateClosed, models.StateOpen, "Failure threshold reached", "system")
		}

	case models.StateOpen:
		sleepWindow := time.Duration(threshold.SleepWindowSeconds) * time.Second
		if now.Sub(cb.LastStateChange) >= sleepWindow {
			cb.State = models.StateHalfOpen
			cb.LastStateChange = now
			cb.HalfOpenCallCount = 0
			cb.SuccessCount = 0
			cb.FailureCount = 0
			return s.createRecoveryConclusion(tx, cb.ID, "AUTO_TRANSITION", models.StateOpen, models.StateHalfOpen, "Sleep window expired", "system")
		}

	case models.StateHalfOpen:
		cb.HalfOpenCallCount++

		if result == models.ResultSuccess {
			if cb.HalfOpenCallCount >= threshold.HalfOpenMaxCalls {
				cb.State = models.StateClosed
				cb.LastStateChange = now
				cb.SuccessCount = 0
				cb.FailureCount = 0
				cb.TotalRequests = 0
				cb.HalfOpenCallCount = 0
				return s.createRecoveryConclusion(tx, cb.ID, "AUTO_RECOVERY", models.StateHalfOpen, models.StateClosed, "Half-open probes succeeded", "system")
			}
		} else {
			cb.State = models.StateOpen
			cb.LastStateChange = now
			cb.HalfOpenCallCount = 0
			return s.createRecoveryConclusion(tx, cb.ID, "AUTO_TRIGGER", models.StateHalfOpen, models.StateOpen, "Half-open probe failed", "system")
		}
	}

	cb.UpdatedAt = now
	return tx.Save(cb).Error
}

func (s *CircuitBreakerService) createRecoveryConclusion(tx *gorm.DB, cbID, conclusionType string, prevState, newState models.CircuitState, reason, operator string) error {
	conclusion := models.RecoveryConclusion{
		CircuitBreakerID: cbID,
		ConclusionType:   conclusionType,
		PreviousState:    prevState,
		NewState:         newState,
		Reason:           reason,
		Operator:         operator,
		ConclusionTime:   time.Now(),
		CreatedAt:        time.Now(),
	}
	return tx.Create(&conclusion).Error
}

func (s *CircuitBreakerService) logArbitration(tx *gorm.DB, cbID, requestID, action string, prevState, newState models.CircuitState, details, operator string) error {
	log := models.ArbitrationLog{
		CircuitBreakerID: cbID,
		RequestID:        requestID,
		Action:           action,
		PreviousState:    prevState,
		NewState:         newState,
		Details:          details,
		Operator:         operator,
		LogTime:          time.Now(),
		CreatedAt:        time.Now(),
	}
	return tx.Create(&log).Error
}

func (s *CircuitBreakerService) IsAllowed(cb *models.CircuitBreaker, threshold *models.CircuitThreshold) (bool, string) {
	switch cb.State {
	case models.StateOpen:
		sleepWindow := time.Duration(threshold.SleepWindowSeconds) * time.Second
		if time.Now().Sub(cb.LastStateChange) >= sleepWindow {
			return true, "Transitioning to HALF_OPEN"
		}
		return false, "Circuit is OPEN"

	case models.StateHalfOpen:
		if cb.HalfOpenCallCount >= threshold.HalfOpenMaxCalls {
			return false, "Half-open max calls reached"
		}
		return true, "Allowed for half-open probe"

	default:
		return true, "Circuit is CLOSED"
	}
}

func (s *CircuitBreakerService) ManualReset(cbID, operator string) (*models.CircuitBreaker, error) {
	tx := utils.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var cb models.CircuitBreaker
	if err := tx.Where("id = ?", cbID).First(&cb).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	prevState := cb.State
	now := time.Now()
	cb.State = models.StateClosed
	cb.LastStateChange = now
	cb.SuccessCount = 0
	cb.FailureCount = 0
	cb.TotalRequests = 0
	cb.HalfOpenCallCount = 0
	cb.UpdatedAt = now

	if err := tx.Save(&cb).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.createRecoveryConclusion(tx, cbID, "MANUAL_RESET", prevState, models.StateClosed, "Manual reset by operator", operator); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.logArbitration(tx, cbID, "", "MANUAL_RESET", prevState, models.StateClosed, "Manual reset", operator); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &cb, nil
}

func (s *CircuitBreakerService) ForceOpen(cbID, operator, reason string) (*models.CircuitBreaker, error) {
	tx := utils.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var cb models.CircuitBreaker
	if err := tx.Where("id = ?", cbID).First(&cb).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	prevState := cb.State
	now := time.Now()
	cb.State = models.StateOpen
	cb.LastStateChange = now
	cb.UpdatedAt = now

	if err := tx.Save(&cb).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.createRecoveryConclusion(tx, cbID, "FORCE_OPEN", prevState, models.StateOpen, reason, operator); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := s.logArbitration(tx, cbID, "", "FORCE_OPEN", prevState, models.StateOpen, reason, operator); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, err
	}

	return &cb, nil
}

func (s *CircuitBreakerService) GetHistory(cbID string, limit int) ([]models.ArbitrationLog, error) {
	var logs []models.ArbitrationLog
	err := utils.DB.Where("circuit_breaker_id = ?", cbID).Order("log_time DESC").Limit(limit).Find(&logs).Error
	return logs, err
}

func (s *CircuitBreakerService) GetAllCircuitBreakers() ([]models.CircuitBreaker, error) {
	var cbs []models.CircuitBreaker
	err := utils.DB.Find(&cbs).Error
	return cbs, err
}

func (s *CircuitBreakerService) GetCircuitBreakerByID(cbID string) (*models.CircuitBreaker, error) {
	var cb models.CircuitBreaker
	err := utils.DB.Where("id = ?", cbID).First(&cb).Error
	if err != nil {
		return nil, err
	}
	return &cb, nil
}
