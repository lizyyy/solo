package store

import (
	"experiment-guard/internal/model"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Store struct {
	db *gorm.DB
}

func NewStore(dbPath string) (*Store, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&model.Experiment{},
		&model.Threshold{},
		&model.Metric{},
		&model.PauseLog{},
		&model.RollbackLog{},
		&model.BucketAssignment{},
	)
	if err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) CreateExperiment(exp *model.Experiment) error {
	return s.db.Create(exp).Error
}

func (s *Store) GetExperiment(id string) (*model.Experiment, error) {
	var exp model.Experiment
	err := s.db.Preload("Thresholds").Preload("PauseLogs").Preload("RollbackLog").
		First(&exp, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &exp, nil
}

func (s *Store) UpdateExperiment(exp *model.Experiment) error {
	return s.db.Save(exp).Error
}

func (s *Store) ListExperiments() ([]model.Experiment, error) {
	var exps []model.Experiment
	err := s.db.Preload("Thresholds").Find(&exps).Error
	return exps, err
}

func (s *Store) CreateThreshold(threshold *model.Threshold) error {
	return s.db.Create(threshold).Error
}

func (s *Store) CreateMetric(metric *model.Metric) error {
	return s.db.Create(metric).Error
}

func (s *Store) MetricExists(requestID string) (bool, error) {
	var count int64
	err := s.db.Model(&model.Metric{}).Where("request_id = ?", requestID).Count(&count).Error
	return count > 0, err
}

func (s *Store) GetMetrics(experimentID, metricName string, windowSize int, since time.Time) ([]model.Metric, error) {
	var metrics []model.Metric
	query := s.db.Where("experiment_id = ? AND timestamp >= ?", experimentID, since)
	if metricName != "" {
		query = query.Where("name = ?", metricName)
	}
	err := query.Order("timestamp DESC").Limit(windowSize).Find(&metrics).Error
	return metrics, err
}

func (s *Store) GetAllMetrics(experimentID string, startTime, endTime time.Time) ([]model.Metric, error) {
	var metrics []model.Metric
	query := s.db.Where("experiment_id = ?", experimentID)
	if !startTime.IsZero() {
		query = query.Where("timestamp >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("timestamp <= ?", endTime)
	}
	err := query.Order("timestamp ASC").Find(&metrics).Error
	return metrics, err
}

func (s *Store) CreatePauseLog(log *model.PauseLog) error {
	return s.db.Create(log).Error
}

func (s *Store) GetPauseLogs(experimentID string) ([]model.PauseLog, error) {
	var logs []model.PauseLog
	err := s.db.Where("experiment_id = ?", experimentID).Order("created_at DESC").Find(&logs).Error
	return logs, err
}

func (s *Store) CreateRollbackLog(log *model.RollbackLog) error {
	return s.db.Create(log).Error
}

func (s *Store) GetOrCreateBucketAssignment(experimentID, userID string, assignFunc func() (bool, uint32)) (*model.BucketAssignment, error) {
	var assignment model.BucketAssignment
	err := s.db.Where("experiment_id = ? AND user_id = ?", experimentID, userID).First(&assignment).Error
	if err == nil {
		return &assignment, nil
	}
	if err != gorm.ErrRecordNotFound {
		return nil, err
	}

	inExp, hash := assignFunc()
	assignment = model.BucketAssignment{
		ExperimentID: experimentID,
		UserID:       userID,
		InExperiment: inExp,
		BucketHash:   hash,
	}
	err = s.db.Create(&assignment).Error
	return &assignment, err
}
