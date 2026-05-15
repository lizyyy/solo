package repository

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/pkg/database"
	"customer-probe-api/pkg/utils"
)

type DNSRecordRepository struct{}

func NewDNSRecordRepository() *DNSRecordRepository {
	return &DNSRecordRepository{}
}

func (r *DNSRecordRepository) Create(record *models.DNSRecord) (*models.DNSRecord, error) {
	if record.ID == "" {
		record.ID = utils.GenerateID()
	}
	if err := database.GetDB().Create(record).Error; err != nil {
		return nil, err
	}
	return record, nil
}

func (r *DNSRecordRepository) GetByID(id string) (*models.DNSRecord, error) {
	var record models.DNSRecord
	if err := database.GetDB().First(&record, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *DNSRecordRepository) GetByTaskID(taskID string) ([]models.DNSRecord, error) {
	var records []models.DNSRecord
	if err := database.GetDB().Where("task_id = ?", taskID).Find(&records).Error; err != nil {
		return nil, err
	}
	return records, nil
}

func (r *DNSRecordRepository) DeleteByTaskID(taskID string) error {
	return database.GetDB().Delete(&models.DNSRecord{}, "task_id = ?", taskID).Error
}
