package store

import (
	"github.com/data-contract-exception-api/models"
	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"time"
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
		&models.DataContract{},
		&models.ExceptionRecord{},
		&models.HitRecord{},
		&models.RecoveryReport{},
		&models.AnomalyRecord{},
	)
	if err != nil {
		return nil, err
	}

	return &Store{db: db}, nil
}

func (s *Store) CreateContract(contract *models.DataContract) error {
	if contract.ID == "" {
		contract.ID = uuid.New().String()
	}
	now := time.Now()
	contract.CreatedAt = now
	contract.UpdatedAt = now
	return s.db.Create(contract).Error
}

func (s *Store) GetContractByID(id string) (*models.DataContract, error) {
	var contract models.DataContract
	err := s.db.First(&contract, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &contract, nil
}

func (s *Store) CreateException(exception *models.ExceptionRecord) error {
	if exception.ID == "" {
		exception.ID = uuid.New().String()
	}
	now := time.Now()
	exception.CreatedAt = now
	exception.UpdatedAt = now
	exception.Status = models.StatusPending
	return s.db.Create(exception).Error
}

func (s *Store) GetExceptionByID(id string) (*models.ExceptionRecord, error) {
	var exception models.ExceptionRecord
	err := s.db.First(&exception, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &exception, nil
}

func (s *Store) GetExceptionsByFieldPath(fieldPath string) ([]models.ExceptionRecord, error) {
	var exceptions []models.ExceptionRecord
	err := s.db.Where("field_path = ? AND status IN ?", fieldPath, []models.ExceptionStatus{
		models.StatusActive,
		models.StatusPending,
	}).Find(&exceptions).Error
	return exceptions, err
}

func (s *Store) GetActiveExceptions() ([]models.ExceptionRecord, error) {
	var exceptions []models.ExceptionRecord
	err := s.db.Where("status = ?", models.StatusActive).Find(&exceptions).Error
	return exceptions, err
}

func (s *Store) GetAllExceptions() ([]models.ExceptionRecord, error) {
	var exceptions []models.ExceptionRecord
	err := s.db.Find(&exceptions).Error
	return exceptions, err
}

func (s *Store) UpdateExceptionStatus(id string, status models.ExceptionStatus, approvedBy string) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	if approvedBy != "" {
		updates["approved_by"] = approvedBy
	}
	return s.db.Model(&models.ExceptionRecord{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) UpdateExceptionForRecovery(id string, status models.ExceptionStatus, approvedBy string) error {
	updates := map[string]interface{}{
		"status":                status,
		"updated_at":            time.Now(),
		"recovery_approved_by":  approvedBy,
		"recovery_approved_at":  time.Now(),
	}
	return s.db.Model(&models.ExceptionRecord{}).Where("id = ?", id).Updates(updates).Error
}

func (s *Store) RecordHit(hit *models.HitRecord) error {
	if hit.ID == "" {
		hit.ID = uuid.New().String()
	}
	hit.CreatedAt = time.Now()
	if hit.HitTimestamp.IsZero() {
		hit.HitTimestamp = time.Now()
	}

	err := s.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(hit).Error; err != nil {
			return err
		}

		if err := tx.Model(&models.ExceptionRecord{}).
			Where("id = ?", hit.ExceptionID).
			Updates(map[string]interface{}{
				"hit_count":  gorm.Expr("hit_count + 1"),
				"last_hit_at": time.Now(),
			}).Error; err != nil {
			return err
		}

		return nil
	})

	return err
}

func (s *Store) GetHitRecordsByExceptionID(exceptionID string) ([]models.HitRecord, error) {
	var hits []models.HitRecord
	err := s.db.Where("exception_id = ?", exceptionID).Find(&hits).Error
	return hits, err
}

func (s *Store) CreateRecoveryReport(report *models.RecoveryReport) error {
	if report.ID == "" {
		report.ID = uuid.New().String()
	}
	report.GeneratedAt = time.Now()
	return s.db.Create(report).Error
}

func (s *Store) GetRecoveryReportByExceptionID(exceptionID string) (*models.RecoveryReport, error) {
	var report models.RecoveryReport
	err := s.db.First(&report, "exception_id = ?", exceptionID).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (s *Store) GetAllRecoveryReports() ([]models.RecoveryReport, error) {
	var reports []models.RecoveryReport
	err := s.db.Find(&reports).Error
	return reports, err
}

func (s *Store) CreateAnomalyRecord(anomaly *models.AnomalyRecord) error {
	if anomaly.ID == "" {
		anomaly.ID = uuid.New().String()
	}
	now := time.Now()
	anomaly.CreatedAt = now
	anomaly.UpdatedAt = now
	return s.db.Create(anomaly).Error
}

func (s *Store) GetAnomalyByID(id string) (*models.AnomalyRecord, error) {
	var anomaly models.AnomalyRecord
	err := s.db.First(&anomaly, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &anomaly, nil
}

func (s *Store) GetAllAnomalies() ([]models.AnomalyRecord, error) {
	var anomalies []models.AnomalyRecord
	err := s.db.Find(&anomalies).Error
	return anomalies, err
}

func (s *Store) ResolveAnomaly(id string, handledBy string, resolutionNotes string) error {
	return s.db.Model(&models.AnomalyRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"is_resolved":      true,
		"handled_by":       handledBy,
		"resolution_notes": resolutionNotes,
		"updated_at":       time.Now(),
	}).Error
}

func (s *Store) ManualUpdateExceptionStatus(id string, status models.ExceptionStatus) error {
	return s.db.Model(&models.ExceptionRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}).Error
}

func (s *Store) GetExpiredExceptions() ([]models.ExceptionRecord, error) {
	var exceptions []models.ExceptionRecord
	now := time.Now()
	err := s.db.Where("expire_date < ? AND status = ?", now, models.StatusActive).Find(&exceptions).Error
	return exceptions, err
}
