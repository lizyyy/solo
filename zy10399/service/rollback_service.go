package service

import (
	"config-rollback-api/model"
	"config-rollback-api/store"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math"
	"time"
)

type RollbackService struct {
	store *store.MemoryStore
}

func NewRollbackService(store *store.MemoryStore) *RollbackService {
	return &RollbackService{store: store}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

var validTransitions = map[model.ReleaseStatus][]model.ReleaseStatus{
	model.StatusPending:   {model.StatusRunning},
	model.StatusRunning:   {model.StatusObserving, model.StatusFailed},
	model.StatusObserving: {model.StatusSuccess, model.StatusRollback, model.StatusFailed},
	model.StatusSuccess:   {},
	model.StatusRollback:  {},
	model.StatusFailed:    {},
}

func isValidTransition(from, to model.ReleaseStatus) bool {
	validTos, exists := validTransitions[from]
	if !exists {
		return false
	}
	for _, validTo := range validTos {
		if validTo == to {
			return true
		}
	}
	return false
}

func (s *RollbackService) CreateRelease(configName, version, content, idempotentKey string) (*model.ConfigRelease, error) {
	if idempotentKey == "" {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "idempotent_key is required"}
	}
	if configName == "" || version == "" {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "config_name and version are required"}
	}

	if existingID, exists := s.store.CheckIdempotent(idempotentKey); exists {
		release, _ := s.store.GetRelease(existingID)
		return release, nil
	}

	now := time.Now()
	release := &model.ConfigRelease{
		ID:            generateID(),
		ConfigName:    configName,
		Version:       version,
		Content:       content,
		Status:        model.StatusPending,
		CreatedAt:     now,
		UpdatedAt:     now,
		IdempotentKey: idempotentKey,
	}

	if err := s.store.CreateRelease(release); err != nil {
		return nil, &model.APIError{Code: "CREATE_FAILED", Message: err.Error()}
	}

	s.store.RegisterIdempotent(idempotentKey, release.ID)

	s.recordDecision(release.ID, "CREATE", "", model.StatusPending, "Release created", "", "system")

	return release, nil
}

func (s *RollbackService) StartRelease(id string) (*model.ConfigRelease, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status != model.StatusPending {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot start release in state %s", release.Status),
		}
	}

	s.store.UpdateReleaseStatus(id, model.StatusRunning)
	s.recordDecision(id, "STATE_CHANGE", model.StatusPending, model.StatusRunning, "Release started", "", "system")

	return s.store.GetRelease(id)
}

func (s *RollbackService) SetupBaseline(id string, metrics []model.MetricPoint, windowStart, windowEnd time.Time) (*model.BaselineWindow, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status == model.StatusSuccess || release.Status == model.StatusRollback || release.Status == model.StatusFailed {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot setup baseline in terminal state %s", release.Status),
		}
	}

	if len(metrics) == 0 {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "Metrics cannot be empty"}
	}

	var sum, max, min float64
	max = -math.MaxFloat64
	min = math.MaxFloat64

	for _, m := range metrics {
		sum += m.Value
		if m.Value > max {
			max = m.Value
		}
		if m.Value < min {
			min = m.Value
		}
	}
	avg := sum / float64(len(metrics))

	baseline := &model.BaselineWindow{
		ID:          generateID(),
		ReleaseID:   id,
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		Metrics:     metrics,
		AvgValue:    avg,
		MaxValue:    max,
		MinValue:    min,
		CreatedAt:   time.Now(),
	}

	if err := s.store.CreateBaseline(baseline); err != nil {
		return nil, &model.APIError{Code: "CREATE_FAILED", Message: err.Error()}
	}

	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.BaselineID = baseline.ID
	})

	return baseline, nil
}

func (s *RollbackService) SetupThreshold(id, metricName string, maxDeviation, minThreshold, maxThreshold float64, consecutiveCount int) (*model.AnomalyThreshold, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status == model.StatusSuccess || release.Status == model.StatusRollback || release.Status == model.StatusFailed {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot setup threshold in terminal state %s", release.Status),
		}
	}

	if metricName == "" {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "metric_name is required"}
	}

	if maxDeviation <= 0 {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "max_deviation must be positive"}
	}

	if consecutiveCount < 1 {
		return nil, &model.APIError{Code: "INVALID_REQUEST", Message: "consecutive_count must be at least 1"}
	}

	threshold := &model.AnomalyThreshold{
		ID:               generateID(),
		ReleaseID:        id,
		MetricName:       metricName,
		MaxDeviation:     maxDeviation,
		MinThreshold:     minThreshold,
		MaxThreshold:     maxThreshold,
		ConsecutiveCount: consecutiveCount,
		CreatedAt:        time.Now(),
	}

	if err := s.store.CreateThreshold(threshold); err != nil {
		return nil, &model.APIError{Code: "CREATE_FAILED", Message: err.Error()}
	}

	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.ThresholdID = threshold.ID
	})

	return threshold, nil
}

func (s *RollbackService) StartObservation(id string) (*model.ConfigRelease, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status != model.StatusRunning {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot start observation in state %s", release.Status),
		}
	}

	if release.BaselineID == "" {
		return nil, &model.APIError{Code: "MISSING_CONFIG", Message: "Baseline not setup"}
	}

	if release.ThresholdID == "" {
		return nil, &model.APIError{Code: "MISSING_CONFIG", Message: "Threshold not setup"}
	}

	now := time.Now()
	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.Status = model.StatusObserving
		r.ObservedAt = &now
	})

	s.recordDecision(id, "STATE_CHANGE", model.StatusRunning, model.StatusObserving, "Started observation", "", "system")

	return s.store.GetRelease(id)
}

func (s *RollbackService) ObserveMetrics(id string, currentMetrics []model.MetricPoint) (*model.ObservationResult, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status != model.StatusObserving {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot observe metrics in state %s", release.Status),
		}
	}

	baseline, err := s.store.GetBaseline(release.BaselineID)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Baseline not found"}
	}

	threshold, err := s.store.GetThreshold(release.ThresholdID)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Threshold not found"}
	}

	var currentValue float64
	for _, m := range currentMetrics {
		if m.Metric == threshold.MetricName {
			currentValue = m.Value
			break
		}
	}

	deviation := math.Abs(currentValue - baseline.AvgValue)
	anomalyScore := deviation / baseline.AvgValue

	isAnomaly := false
	reason := ""

	if deviation > threshold.MaxDeviation {
		isAnomaly = true
		reason = fmt.Sprintf("Deviation %.2f exceeds max allowed %.2f", deviation, threshold.MaxDeviation)
	} else if currentValue < threshold.MinThreshold && threshold.MinThreshold != 0 {
		isAnomaly = true
		reason = fmt.Sprintf("Value %.2f below min threshold %.2f", currentValue, threshold.MinThreshold)
	} else if currentValue > threshold.MaxThreshold && threshold.MaxThreshold != 0 {
		isAnomaly = true
		reason = fmt.Sprintf("Value %.2f above max threshold %.2f", currentValue, threshold.MaxThreshold)
	}

	result := &model.ObservationResult{
		IsAnomaly:    isAnomaly,
		AnomalyScore: anomalyScore,
		Deviation:    deviation,
		CurrentValue: currentValue,
		BaselineAvg:  baseline.AvgValue,
		MetricName:   threshold.MetricName,
		Timestamp:    time.Now(),
	}

	if isAnomaly {
		s.triggerRollback(id, reason, result)
	}

	return result, nil
}

func (s *RollbackService) triggerRollback(id, reason string, result *model.ObservationResult) {
	anomalyData, _ := json.Marshal(result)

	rollback := &model.RollbackAction{
		ID:           generateID(),
		ReleaseID:    id,
		Reason:       reason,
		AnomalyData:  string(anomalyData),
		ExecutedAt:   time.Now(),
		Success:      true,
	}

	s.store.CreateRollback(rollback)

	now := time.Now()
	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.Status = model.StatusRollback
		r.RollbackAt = &now
	})

	s.recordDecision(id, "ROLLBACK", model.StatusObserving, model.StatusRollback, reason, string(anomalyData), "system")
}

func (s *RollbackService) ConfirmSuccess(id string) (*model.ConfigRelease, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status != model.StatusObserving {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot confirm success in state %s", release.Status),
		}
	}

	now := time.Now()
	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.Status = model.StatusSuccess
		r.CompletedAt = &now
	})

	s.recordDecision(id, "STATE_CHANGE", model.StatusObserving, model.StatusSuccess, "Observation completed successfully", "", "operator")

	return s.store.GetRelease(id)
}

func (s *RollbackService) ManualRollback(id, reason string) (*model.RollbackAction, error) {
	release, err := s.store.GetRelease(id)
	if err != nil {
		return nil, &model.APIError{Code: "NOT_FOUND", Message: "Release not found"}
	}

	if release.Status == model.StatusSuccess || release.Status == model.StatusRollback || release.Status == model.StatusFailed {
		return nil, &model.APIError{
			Code:    "INVALID_STATE",
			Message: fmt.Sprintf("Cannot rollback in terminal state %s", release.Status),
		}
	}

	rollback := &model.RollbackAction{
		ID:          generateID(),
		ReleaseID:   id,
		Reason:      reason,
		ExecutedAt:  time.Now(),
		Success:     true,
	}

	s.store.CreateRollback(rollback)

	now := time.Now()
	s.store.UpdateRelease(id, func(r *model.ConfigRelease) {
		r.Status = model.StatusRollback
		r.RollbackAt = &now
	})

	s.recordDecision(id, "MANUAL_ROLLBACK", release.Status, model.StatusRollback, reason, "", "operator")

	return rollback, nil
}

func (s *RollbackService) GetRelease(id string) (*model.ConfigRelease, error) {
	return s.store.GetRelease(id)
}

func (s *RollbackService) ListReleases() []*model.ConfigRelease {
	return s.store.ListReleases()
}

func (s *RollbackService) GetDecisionHistory(id string) []*model.DecisionRecord {
	return s.store.GetDecisionsByRelease(id)
}

func (s *RollbackService) GetAllDecisions() []*model.DecisionRecord {
	return s.store.ListAllDecisions()
}

func (s *RollbackService) recordDecision(releaseID, decisionType string, from, to model.ReleaseStatus, reason, metricsData, operator string) {
	decision := &model.DecisionRecord{
		ID:           generateID(),
		ReleaseID:    releaseID,
		DecisionType: decisionType,
		FromStatus:   from,
		ToStatus:     to,
		Reason:       reason,
		MetricsData:  metricsData,
		DecidedAt:    time.Now(),
		Operator:     operator,
	}
	s.store.CreateDecision(decision)
}
