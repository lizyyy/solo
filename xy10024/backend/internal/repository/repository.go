package repository

import (
	"device-borrow-system/internal/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByUsername(username string) (*models.User, error) {
	var user models.User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindAll(page, pageSize int) ([]models.User, int64, error) {
	var users []models.User
	var total int64

	offset := (page - 1) * pageSize

	r.db.Model(&models.User{}).Count(&total)
	err := r.db.Offset(offset).Limit(pageSize).Find(&users).Error

	return users, total, err
}

func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

func (r *UserRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.User{}, id).Error
}

type DeviceRepository struct {
	db *gorm.DB
}

func NewDeviceRepository(db *gorm.DB) *DeviceRepository {
	return &DeviceRepository{db: db}
}

func (r *DeviceRepository) Create(device *models.Device) error {
	return r.db.Create(device).Error
}

func (r *DeviceRepository) FindByID(id uuid.UUID) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("id = ?", id).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *DeviceRepository) FindByCode(code string) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("device_code = ?", code).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

func (r *DeviceRepository) FindAll(filters map[string]interface{}, page, pageSize int) ([]models.Device, int64, error) {
	var devices []models.Device
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&models.Device{})
	for key, value := range filters {
		query = query.Where(key+" = ?", value)
	}

	query.Count(&total)
	err := query.Offset(offset).Limit(pageSize).Find(&devices).Error

	return devices, total, err
}

func (r *DeviceRepository) Update(device *models.Device) error {
	return r.db.Save(device).Error
}

func (r *DeviceRepository) UpdateWithVersion(device *models.Device, expectedVersion int64) error {
	result := r.db.Model(&models.Device{}).
		Where("id = ? AND version = ?", device.ID, expectedVersion).
		Updates(device)
	if result.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return result.Error
}

func (r *DeviceRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Device{}, id).Error
}

type BorrowRepository struct {
	db *gorm.DB
}

func NewBorrowRepository(db *gorm.DB) *BorrowRepository {
	return &BorrowRepository{db: db}
}

func (r *BorrowRepository) Create(record *models.BorrowRecord) error {
	return r.db.Create(record).Error
}

func (r *BorrowRepository) FindByID(id uuid.UUID) (*models.BorrowRecord, error) {
	var record models.BorrowRecord
	err := r.db.Where("id = ?", id).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *BorrowRepository) FindActiveByDevice(deviceID uuid.UUID) (*models.BorrowRecord, error) {
	var record models.BorrowRecord
	err := r.db.Where("device_id = ? AND status = ?", deviceID, "borrowed").
		Order("borrow_date DESC").
		First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *BorrowRepository) FindAll(filters map[string]interface{}, page, pageSize int) ([]models.BorrowRecord, int64, error) {
	var records []models.BorrowRecord
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&models.BorrowRecord{})
	for key, value := range filters {
		query = query.Where(key+" = ?", value)
	}

	query.Count(&total)
	err := query.Order("borrow_date DESC").
		Offset(offset).Limit(pageSize).
		Find(&records).Error

	return records, total, err
}

func (r *BorrowRepository) Update(record *models.BorrowRecord) error {
	return r.db.Save(record).Error
}

func (r *BorrowRepository) FindByUser(borrowerID uuid.UUID, page, pageSize int) ([]models.BorrowRecord, int64, error) {
	var records []models.BorrowRecord
	var total int64

	offset := (page - 1) * pageSize

	r.db.Model(&models.BorrowRecord{}).
		Where("borrower_id = ?", borrowerID).
		Count(&total)

	err := r.db.Where("borrower_id = ?", borrowerID).
		Order("borrow_date DESC").
		Offset(offset).Limit(pageSize).
		Find(&records).Error

	return records, total, err
}

type AuditRepository struct {
	db *gorm.DB
}

func NewAuditRepository(db *gorm.DB) *AuditRepository {
	return &AuditRepository{db: db}
}

func (r *AuditRepository) Create(log *models.AuditLog) error {
	return r.db.Create(log).Error
}

func (r *AuditRepository) FindAll(filters map[string]interface{}, page, pageSize int) ([]models.AuditLog, int64, error) {
	var logs []models.AuditLog
	var total int64

	offset := (page - 1) * pageSize

	query := r.db.Model(&models.AuditLog{})
	for key, value := range filters {
		query = query.Where(key+" = ?", value)
	}

	query.Count(&total)
	err := query.Order("timestamp DESC").
		Offset(offset).Limit(pageSize).
		Find(&logs).Error

	return logs, total, err
}

func (r *AuditRepository) FindByResource(resourceType string, resourceID uuid.UUID) ([]models.AuditLog, error) {
	var logs []models.AuditLog
	err := r.db.Where("resource_type = ? AND resource_id = ?", resourceType, resourceID).
		Order("timestamp DESC").
		Limit(100).
		Find(&logs).Error
	return logs, err
}
