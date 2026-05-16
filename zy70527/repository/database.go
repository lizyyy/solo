package repository

import (
	"cert-rotation/model"
	"errors"
	"log"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&model.Tenant{},
		&model.CertificateRotation{},
		&model.ValidationSample{},
		&model.RotationReport{},
		&model.FailedRecord{},
		&model.SwitchReceipt{},
	)
	if err != nil {
		return err
	}

	log.Println("Database initialized successfully")
	return nil
}

type RotationRepository struct{}

func NewRotationRepository() *RotationRepository {
	return &RotationRepository{}
}

func (r *RotationRepository) CreateRotation(rotation *model.CertificateRotation) error {
	if rotation.ID == "" {
		rotation.ID = uuid.NewString()
	}
	now := time.Now()
	rotation.CreatedAt = now
	rotation.UpdatedAt = now
	return DB.Create(rotation).Error
}

func (r *RotationRepository) GetRotationByID(id string) (*model.CertificateRotation, error) {
	var rotation model.CertificateRotation
	err := DB.Where("id = ?", id).First(&rotation).Error
	if err != nil {
		return nil, err
	}
	return &rotation, nil
}

func (r *RotationRepository) GetRotationsByTenant(tenantID string, page, pageSize int) ([]model.CertificateRotation, int64, error) {
	var rotations []model.CertificateRotation
	var total int64

	query := DB.Model(&model.CertificateRotation{}).Where("tenant_id = ?", tenantID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&rotations).Error
	return rotations, total, err
}

func (r *RotationRepository) GetAllRotations(page, pageSize int) ([]model.CertificateRotation, int64, error) {
	var rotations []model.CertificateRotation
	var total int64

	DB.Model(&model.CertificateRotation{}).Count(&total)
	offset := (page - 1) * pageSize
	err := DB.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&rotations).Error
	return rotations, total, err
}

func (r *RotationRepository) UpdateRotationStatus(id string, status model.RotationStatus) error {
	result := DB.Model(&model.CertificateRotation{}).Where("id = ?", id).Updates(map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("rotation not found")
	}
	return nil
}

func (r *RotationRepository) UpdateRotation(rotation *model.CertificateRotation) error {
	rotation.UpdatedAt = time.Now()
	return DB.Save(rotation).Error
}

func (r *RotationRepository) AddValidationSample(sample *model.ValidationSample) error {
	if sample.ID == "" {
		sample.ID = uuid.NewString()
	}
	sample.CreatedAt = time.Now()
	return DB.Create(sample).Error
}

func (r *RotationRepository) GetValidationSamples(rotationID string, page, pageSize int) ([]model.ValidationSample, int64, error) {
	var samples []model.ValidationSample
	var total int64

	query := DB.Model(&model.ValidationSample{}).Where("rotation_id = ?", rotationID)
	query.Count(&total)

	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&samples).Error
	return samples, total, err
}

func (r *RotationRepository) GetValidationStats(rotationID string) (oldCount, newCount, oldSuccess, newSuccess int64, err error) {
	DB.Model(&model.ValidationSample{}).Where("rotation_id = ? AND cert_used = 'OLD'", rotationID).Count(&oldCount)
	DB.Model(&model.ValidationSample{}).Where("rotation_id = ? AND cert_used = 'OLD' AND success = ?", rotationID, true).Count(&oldSuccess)
	DB.Model(&model.ValidationSample{}).Where("rotation_id = ? AND cert_used = 'NEW'", rotationID).Count(&newCount)
	DB.Model(&model.ValidationSample{}).Where("rotation_id = ? AND cert_used = 'NEW' AND success = ?", rotationID, true).Count(&newSuccess)
	return
}

func (r *RotationRepository) CreateReport(report *model.RotationReport) error {
	if report.ID == "" {
		report.ID = uuid.NewString()
	}
	report.GeneratedAt = time.Now()
	return DB.Create(report).Error
}

func (r *RotationRepository) GetReportsByRotation(rotationID string) ([]model.RotationReport, error) {
	var reports []model.RotationReport
	err := DB.Where("rotation_id = ?", rotationID).Order("generated_at DESC").Find(&reports).Error
	return reports, err
}

func (r *RotationRepository) CreateFailedRecord(record *model.FailedRecord) error {
	if record.ID == "" {
		record.ID = uuid.NewString()
	}
	record.CreatedAt = time.Now()
	return DB.Create(record).Error
}

func (r *RotationRepository) GetFailedRecords(rotationID string) ([]model.FailedRecord, error) {
	var records []model.FailedRecord
	err := DB.Where("rotation_id = ?", rotationID).Order("created_at DESC").Find(&records).Error
	return records, err
}

func (r *RotationRepository) UpdateFailedRecord(id string, fixedBy, fixNotes string) error {
	now := time.Now()
	result := DB.Model(&model.FailedRecord{}).Where("id = ?", id).Updates(map[string]interface{}{
		"fixed_at":  &now,
		"fixed_by":  fixedBy,
		"fix_notes": fixNotes,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("failed record not found")
	}
	return nil
}

func (r *RotationRepository) CreateSwitchReceipt(receipt *model.SwitchReceipt) error {
	if receipt.ID == "" {
		receipt.ID = uuid.NewString()
	}
	receipt.CreatedAt = time.Now()
	return DB.Create(receipt).Error
}

func (r *RotationRepository) AcknowledgeReceipt(id, ackBy string) error {
	now := time.Now()
	result := DB.Model(&model.SwitchReceipt{}).Where("id = ?", id).Updates(map[string]interface{}{
		"acknowledged": true,
		"ack_by":       ackBy,
		"ack_time":     &now,
	})
	if result.Error != nil {
		return result.Error
	}
	if result.RowsAffected == 0 {
		return errors.New("receipt not found")
	}
	return nil
}

func (r *RotationRepository) GetActiveRotationByTenantAndCerts(tenantID, oldFingerprint, newFingerprint string) (*model.CertificateRotation, error) {
	var rotation model.CertificateRotation
	err := DB.Where("tenant_id = ? AND old_cert_fingerprint = ? AND new_cert_fingerprint = ? AND status NOT IN (?, ?)",
		tenantID, oldFingerprint, newFingerprint, model.StatusCompleted, model.StatusFailed).First(&rotation).Error
	if err != nil {
		return nil, err
	}
	return &rotation, nil
}
