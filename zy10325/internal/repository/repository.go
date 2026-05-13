package repository

import (
	"batch-notification-dedup/internal/model"
	"errors"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(dbPath string) (*Repository, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&model.NotificationRequest{},
		&model.DedupWindow{},
		&model.BusinessScene{},
		&model.SendCredential{},
		&model.SkipRecord{},
	)
	if err != nil {
		return nil, err
	}

	return &Repository{db: db}, nil
}

func (r *Repository) GetDB() *gorm.DB {
	return r.db
}

func (r *Repository) CreateNotificationRequest(req *model.NotificationRequest) error {
	return r.db.Create(req).Error
}

func (r *Repository) GetNotificationRequestByRequestID(requestID string) (*model.NotificationRequest, error) {
	var req model.NotificationRequest
	err := r.db.Where("request_id = ?", requestID).First(&req).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func (r *Repository) UpdateNotificationRequestStatus(requestID string, status model.NotificationStatus) error {
	return r.db.Model(&model.NotificationRequest{}).
		Where("request_id = ?", requestID).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": time.Now(),
		}).Error
}

func (r *Repository) FindDuplicateInWindow(scene, userHash string, windowSeconds int64, beforeTime time.Time) (*model.NotificationRequest, error) {
	var req model.NotificationRequest
	windowStart := beforeTime.Add(-time.Duration(windowSeconds) * time.Second)
	err := r.db.Where("scene = ? AND user_hash = ? AND status = ? AND created_at > ?",
		scene, userHash, model.StatusAllowed, windowStart).
		First(&req).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &req, nil
}

func (r *Repository) CreateSkipRecord(record *model.SkipRecord) error {
	return r.db.Create(record).Error
}

func (r *Repository) CreateSendCredential(cred *model.SendCredential) error {
	return r.db.Create(cred).Error
}

func (r *Repository) GetSendCredential(credential string) (*model.SendCredential, error) {
	var cred model.SendCredential
	err := r.db.Where("credential = ?", credential).First(&cred).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &cred, nil
}

func (r *Repository) MarkCredentialUsed(credential string) error {
	return r.db.Model(&model.SendCredential{}).
		Where("credential = ?", credential).
		Update("used", true).Error
}

func (r *Repository) GetBusinessScene(scene string) (*model.BusinessScene, error) {
	var bs model.BusinessScene
	err := r.db.Where("scene = ?", scene).First(&bs).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &bs, nil
}

func (r *Repository) CreateBusinessScene(bs *model.BusinessScene) error {
	return r.db.Create(bs).Error
}

func (r *Repository) ListNotificationRequests(scene string, userHash string, status model.NotificationStatus, startTime, endTime time.Time, offset, limit int) ([]model.NotificationRequest, int64, error) {
	var reqs []model.NotificationRequest
	var total int64

	query := r.db.Model(&model.NotificationRequest{})
	if scene != "" {
		query = query.Where("scene = ?", scene)
	}
	if userHash != "" {
		query = query.Where("user_hash = ?", userHash)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("created_at <= ?", endTime)
	}

	query.Count(&total)
	err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&reqs).Error
	return reqs, total, err
}

func (r *Repository) ListSkipRecords(scene string, userHash string, startTime, endTime time.Time, offset, limit int) ([]model.SkipRecord, int64, error) {
	var records []model.SkipRecord
	var total int64

	query := r.db.Model(&model.SkipRecord{})
	if scene != "" {
		query = query.Where("scene = ?", scene)
	}
	if userHash != "" {
		query = query.Where("user_hash = ?", userHash)
	}
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("created_at <= ?", endTime)
	}

	query.Count(&total)
	err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&records).Error
	return records, total, err
}

func (r *Repository) GetStatistics(scene string, startTime, endTime time.Time) (*model.Statistics, error) {
	var stats model.Statistics
	stats.Scene = scene

	query := r.db.Model(&model.NotificationRequest{})
	if scene != "" {
		query = query.Where("scene = ?", scene)
	}
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("created_at <= ?", endTime)
	}

	query.Count(&stats.TotalRequests)

	var counts []struct {
		Status model.NotificationStatus
		Count  int64
	}
	r.db.Model(&model.NotificationRequest{}).
		Select("status, count(*) as count").
		Group("status").
		Scan(&counts)

	for _, c := range counts {
		switch c.Status {
		case model.StatusAllowed:
			stats.AllowedCount = c.Count
		case model.StatusSkipped:
			stats.SkippedCount = c.Count
		case model.StatusSent:
			stats.SentCount = c.Count
		case model.StatusFailed:
			stats.FailedCount = c.Count
		}
	}

	if stats.TotalRequests > 0 {
		stats.DuplicateRate = float64(stats.SkippedCount) / float64(stats.TotalRequests)
	}

	return &stats, nil
}
