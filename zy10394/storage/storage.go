package storage

import (
	"api-status-aggregator/models"
	"errors"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Storage struct {
	db *gorm.DB
}

func NewStorage(dbPath string) (*Storage, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&models.SubscriptionTopic{},
		&models.BusinessObject{},
		&models.Subscription{},
		&models.DeliveryPreference{},
		&models.StatusChange{},
		&models.DeliveryRecord{},
		&models.SubscriptionSnapshot{},
	)
	if err != nil {
		return nil, err
	}

	return &Storage{db: db}, nil
}

func (s *Storage) GetDB() *gorm.DB {
	return s.db
}

func (s *Storage) CreateTopic(topic *models.SubscriptionTopic) error {
	return s.db.Create(topic).Error
}

func (s *Storage) GetTopicByName(name string) (*models.SubscriptionTopic, error) {
	var topic models.SubscriptionTopic
	err := s.db.Where("name = ?", name).First(&topic).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &topic, err
}

func (s *Storage) CreateOrGetBusinessObject(business *models.BusinessObject) (*models.BusinessObject, error) {
	var existing models.BusinessObject
	err := s.db.Where("type = ? AND identifier = ?", business.Type, business.Identifier).First(&existing).Error
	if err == nil {
		return &existing, nil
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		err = s.db.Create(business).Error
		return business, err
	}
	return nil, err
}

func (s *Storage) GetBusinessObject(typeName, identifier string) (*models.BusinessObject, error) {
	var business models.BusinessObject
	err := s.db.Where("type = ? AND identifier = ?", typeName, identifier).First(&business).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &business, err
}

func (s *Storage) CreateSubscription(sub *models.Subscription) error {
	return s.db.Create(sub).Error
}

func (s *Storage) GetSubscriptionByID(id string) (*models.Subscription, error) {
	var sub models.Subscription
	err := s.db.Where("id = ?", id).First(&sub).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &sub, err
}

func (s *Storage) GetSubscriptionsByTopicAndBusiness(topicID, businessID string) ([]models.Subscription, error) {
	var subs []models.Subscription
	err := s.db.Where("topic_id = ? AND business_id = ? AND enabled = ?", topicID, businessID, true).Find(&subs).Error
	return subs, err
}

func (s *Storage) CreateDeliveryPreference(pref *models.DeliveryPreference) error {
	return s.db.Create(pref).Error
}

func (s *Storage) GetDeliveryPreferenceBySubscriptionID(subID string) (*models.DeliveryPreference, error) {
	var pref models.DeliveryPreference
	err := s.db.Where("subscription_id = ?", subID).First(&pref).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &pref, err
}

func (s *Storage) CreateStatusChange(change *models.StatusChange) error {
	return s.db.Create(change).Error
}

func (s *Storage) GetStatusChangeByIdempotentKey(key string) (*models.StatusChange, error) {
	var change models.StatusChange
	err := s.db.Where("idempotent_key = ?", key).First(&change).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	return &change, err
}

func (s *Storage) CreateDeliveryRecord(record *models.DeliveryRecord) error {
	return s.db.Create(record).Error
}

func (s *Storage) UpdateDeliveryRecord(record *models.DeliveryRecord) error {
	return s.db.Save(record).Error
}

func (s *Storage) GetPendingDeliveries() ([]models.DeliveryRecord, error) {
	var records []models.DeliveryRecord
	now := time.Now()
	err := s.db.Where("status IN ? AND next_attempt_at <= ?",
		[]string{models.DeliveryStatusPending, models.DeliveryStatusRetrying}, now).
		Find(&records).Error
	return records, err
}

func (s *Storage) GetFailedDeliveries() ([]models.DeliveryRecord, error) {
	var records []models.DeliveryRecord
	err := s.db.Where("status = ?", models.DeliveryStatusFailed).Find(&records).Error
	return records, err
}

func (s *Storage) CreateSnapshot(snapshot *models.SubscriptionSnapshot) error {
	return s.db.Create(snapshot).Error
}

func (s *Storage) GetSnapshotsBySubscriptionID(subID string, limit int) ([]models.SubscriptionSnapshot, error) {
	var snapshots []models.SubscriptionSnapshot
	err := s.db.Where("subscription_id = ?", subID).Order("snapshot_at DESC").Limit(limit).Find(&snapshots).Error
	return snapshots, err
}

func (s *Storage) QueryStatusChanges(businessID, topicID string, startTime, endTime time.Time, page, pageSize int) ([]models.StatusChange, int64, error) {
	var changes []models.StatusChange
	var total int64

	query := s.db.Model(&models.StatusChange{})
	if businessID != "" {
		query = query.Where("business_id = ?", businessID)
	}
	if topicID != "" {
		query = query.Where("topic_id = ?", topicID)
	}
	if !startTime.IsZero() {
		query = query.Where("created_at >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("created_at <= ?", endTime)
	}

	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&changes).Error
	return changes, total, err
}

func (s *Storage) GetDeliveryRecordsByStatusChangeID(changeID string) ([]models.DeliveryRecord, error) {
	var records []models.DeliveryRecord
	err := s.db.Where("status_change_id = ?", changeID).Find(&records).Error
	return records, err
}
