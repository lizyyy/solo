package service

import (
	"experiment-guard/internal/model"
	"experiment-guard/internal/store"
	"fmt"
	"hash/fnv"
	"math"
	"time"
)

type ExperimentService struct {
	store *store.Store
}

func NewExperimentService(store *store.Store) *ExperimentService {
	return &ExperimentService{store: store}
}

type CreateExperimentRequest struct {
	Name        string               `json:"name" binding:"required"`
	Description string               `json:"description"`
	TrafficRate float64              `json:"traffic_rate" binding:"required,min=0,max=1"`
	BucketKey   string               `json:"bucket_key" binding:"required"`
	Thresholds  []ThresholdRequest   `json:"thresholds"`
}

type ThresholdRequest struct {
	MetricName   string                `json:"metric_name" binding:"required"`
	Operator     model.ThresholdOperator `json:"operator" binding:"required"`
	Value        float64               `json:"value" binding:"required"`
	WindowSize   int                   `json:"window_size"`
	TriggerCount int                   `json:"trigger_count"`
}

func (s *ExperimentService) CreateExperiment(req *CreateExperimentRequest) (*model.Experiment, error) {
	now := time.Now()
	exp := &model.Experiment{
		Name:        req.Name,
		Description: req.Description,
		Status:      model.StatusDraft,
		TrafficRate: req.TrafficRate,
		BucketKey:   req.BucketKey,
		CreatedAt:   now,
		UpdatedAt:   now,
	}

	if err := s.store.CreateExperiment(exp); err != nil {
		return nil, err
	}

	for _, t := range req.Thresholds {
		threshold := &model.Threshold{
			ExperimentID: exp.ID,
			MetricName:   t.MetricName,
			Operator:     t.Operator,
			Value:        t.Value,
			WindowSize:   t.WindowSize,
			TriggerCount: t.TriggerCount,
			CreatedAt:    now,
		}
		if threshold.WindowSize <= 0 {
			threshold.WindowSize = 1
		}
		if threshold.TriggerCount <= 0 {
			threshold.TriggerCount = 1
		}
		if err := s.store.CreateThreshold(threshold); err != nil {
			return nil, err
		}
	}

	return s.store.GetExperiment(exp.ID)
}

func (s *ExperimentService) StartExperiment(experimentID string) (*model.Experiment, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return nil, err
	}

	if exp.Status != model.StatusDraft {
		return nil, fmt.Errorf("experiment is not in draft status")
	}

	now := time.Now()
	exp.Status = model.StatusRunning
	exp.StartedAt = &now
	exp.UpdatedAt = now

	if err := s.store.UpdateExperiment(exp); err != nil {
		return nil, err
	}

	return exp, nil
}

func (s *ExperimentService) CheckBucket(experimentID, userID string) (bool, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return false, err
	}

	if exp.Status != model.StatusRunning {
		return false, nil
	}

	assignment, err := s.store.GetOrCreateBucketAssignment(experimentID, userID, func() (bool, uint32) {
		hash := hashUserBucket(userID, exp.BucketKey)
		inExperiment := float64(hash)/math.MaxUint32 < exp.TrafficRate
		return inExperiment, hash
	})

	if err != nil {
		return false, err
	}

	return assignment.InExperiment, nil
}

func hashUserBucket(userID, bucketKey string) uint32 {
	h := fnv.New32a()
	h.Write([]byte(userID + ":" + bucketKey))
	return h.Sum32()
}

type RecordMetricRequest struct {
	RequestID string    `json:"request_id" binding:"required"`
	UserID    string    `json:"user_id"`
	Name      string    `json:"name" binding:"required"`
	Value     float64   `json:"value" binding:"required"`
	Timestamp time.Time `json:"timestamp"`
	Tags      string    `json:"tags"`
}

type RecordMetricResponse struct {
	Paused   bool   `json:"paused"`
	Reason   string `json:"reason,omitempty"`
	Duplicate bool  `json:"duplicate"`
}

func (s *ExperimentService) RecordMetric(experimentID string, req *RecordMetricRequest) (*RecordMetricResponse, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return nil, err
	}

	if exp.Status != model.StatusRunning && exp.Status != model.StatusPaused {
		return nil, fmt.Errorf("experiment is not running or paused")
	}

	exists, err := s.store.MetricExists(req.RequestID)
	if err != nil {
		return nil, err
	}
	if exists {
		return &RecordMetricResponse{
			Paused:    exp.Status == model.StatusPaused,
			Duplicate: true,
		}, nil
	}

	if req.Timestamp.IsZero() {
		req.Timestamp = time.Now()
	}

	metric := &model.Metric{
		ExperimentID: experimentID,
		RequestID:    req.RequestID,
		UserID:       req.UserID,
		Name:         req.Name,
		Value:        req.Value,
		Timestamp:    req.Timestamp,
		Tags:         req.Tags,
		CreatedAt:    time.Now(),
	}

	if err := s.store.CreateMetric(metric); err != nil {
		return nil, err
	}

	if exp.Status == model.StatusRunning {
		paused, reason, err := s.checkThresholds(exp)
		if err != nil {
			return nil, err
		}
		if paused {
			return &RecordMetricResponse{
				Paused: true,
				Reason: reason,
			}, nil
		}
	}

	return &RecordMetricResponse{
		Paused:    exp.Status == model.StatusPaused,
		Duplicate: false,
	}, nil
}

func (s *ExperimentService) checkThresholds(exp *model.Experiment) (bool, string, error) {
	for _, threshold := range exp.Thresholds {
		since := time.Now().Add(-time.Hour * 24)
		metrics, err := s.store.GetMetrics(exp.ID, threshold.MetricName, threshold.WindowSize, since)
		if err != nil {
			return false, "", err
		}

		if len(metrics) < threshold.WindowSize {
			continue
		}

		triggerCount := 0
		var lastValue float64
		for _, metric := range metrics {
			if evaluateThreshold(metric.Value, threshold.Operator, threshold.Value) {
				triggerCount++
				lastValue = metric.Value
			}
		}

		if triggerCount >= threshold.TriggerCount {
			now := time.Now()
			pauseLog := &model.PauseLog{
				ExperimentID:      exp.ID,
				TriggeredBy:       "system",
				Reason:            fmt.Sprintf("Threshold exceeded for metric '%s'", threshold.MetricName),
				ThresholdID:       &threshold.ID,
				MetricName:        threshold.MetricName,
				MetricValue:       lastValue,
				ThresholdValue:    threshold.Value,
				ThresholdOperator: string(threshold.Operator),
				PausedAt:          now,
				CreatedAt:         now,
			}

			if err := s.store.CreatePauseLog(pauseLog); err != nil {
				return false, "", err
			}

			exp.Status = model.StatusPaused
			exp.UpdatedAt = now
			if err := s.store.UpdateExperiment(exp); err != nil {
				return false, "", err
			}

			return true, pauseLog.Reason, nil
		}
	}

	return false, "", nil
}

func evaluateThreshold(metricValue float64, operator model.ThresholdOperator, thresholdValue float64) bool {
	switch operator {
	case model.OpGreaterThan:
		return metricValue > thresholdValue
	case model.OpLessThan:
		return metricValue < thresholdValue
	case model.OpGreaterThanEqual:
		return metricValue >= thresholdValue
	case model.OpLessThanEqual:
		return metricValue <= thresholdValue
	case model.OpEqual:
		return math.Abs(metricValue-thresholdValue) < 0.0001
	default:
		return false
	}
}

func (s *ExperimentService) CheckPaused(experimentID string) (bool, string, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return false, "", err
	}

	if exp.Status == model.StatusPaused {
		if len(exp.PauseLogs) > 0 {
			return true, exp.PauseLogs[0].Reason, nil
		}
		return true, "Experiment is paused", nil
	}

	return false, "", nil
}

type RollbackRequest struct {
	ConfirmedBy string `json:"confirmed_by" binding:"required"`
	Reason      string `json:"reason"`
}

func (s *ExperimentService) ConfirmRollback(experimentID string, req *RollbackRequest) (*model.Experiment, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return nil, err
	}

	if exp.Status != model.StatusPaused {
		return nil, fmt.Errorf("experiment is not in paused status")
	}

	now := time.Now()
	rollbackLog := &model.RollbackLog{
		ExperimentID: experimentID,
		ConfirmedBy:  req.ConfirmedBy,
		Reason:       req.Reason,
		RollbackAt:   now,
		CreatedAt:    now,
	}

	if err := s.store.CreateRollbackLog(rollbackLog); err != nil {
		return nil, err
	}

	exp.Status = model.StatusRollback
	exp.EndedAt = &now
	exp.UpdatedAt = now

	if err := s.store.UpdateExperiment(exp); err != nil {
		return nil, err
	}

	return exp, nil
}

func (s *ExperimentService) ResumeExperiment(experimentID string) (*model.Experiment, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return nil, err
	}

	if exp.Status != model.StatusPaused {
		return nil, fmt.Errorf("experiment is not in paused status")
	}

	now := time.Now()
	exp.Status = model.StatusRunning
	exp.UpdatedAt = now

	if err := s.store.UpdateExperiment(exp); err != nil {
		return nil, err
	}

	return exp, nil
}

func (s *ExperimentService) GetExperiment(experimentID string) (*model.Experiment, error) {
	return s.store.GetExperiment(experimentID)
}

func (s *ExperimentService) ListExperiments() ([]model.Experiment, error) {
	return s.store.ListExperiments()
}

type ObservationResult struct {
	Experiment *model.Experiment  `json:"experiment"`
	Metrics    []model.Metric     `json:"metrics"`
	PauseLogs  []model.PauseLog   `json:"pause_logs"`
	RollbackLog *model.RollbackLog `json:"rollback_log,omitempty"`
}

func (s *ExperimentService) ExportObservations(experimentID string, startTime, endTime time.Time) (*ObservationResult, error) {
	exp, err := s.store.GetExperiment(experimentID)
	if err != nil {
		return nil, err
	}

	metrics, err := s.store.GetAllMetrics(experimentID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	pauseLogs, err := s.store.GetPauseLogs(experimentID)
	if err != nil {
		return nil, err
	}

	return &ObservationResult{
		Experiment:  exp,
		Metrics:     metrics,
		PauseLogs:   pauseLogs,
		RollbackLog: exp.RollbackLog,
	}, nil
}
