package services

import (
	"encoding/json"
	"errors"
	"time"

	"third-party-api-circuit-breaker/models"
	"third-party-api-circuit-breaker/utils"

	"gorm.io/gorm"
)

type DeduplicationService struct{}

func NewDeduplicationService() *DeduplicationService {
	return &DeduplicationService{}
}

func (s *DeduplicationService) CheckOrRecord(requestID, externalAPIID, businessCallerID string, requestData interface{}) (bool, *string, error) {
	tx := utils.DB.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existing models.RequestDeduplication
	err := tx.Where("request_id = ?", requestID).First(&existing).Error
	if err == nil {
		tx.Rollback()
		if existing.Processed {
			return true, &existing.ResponseData, nil
		}
		return true, nil, errors.New("request is being processed")
	}

	if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return false, nil, err
	}

	requestHash := utils.GenerateRequestHash(requestData)

	var existingByHash models.RequestDeduplication
	err = tx.Where("request_hash = ? AND created_at > ?", requestHash, time.Now().Add(-5*time.Minute)).First(&existingByHash).Error
	if err == nil {
		tx.Rollback()
		if existingByHash.Processed {
			return true, &existingByHash.ResponseData, nil
		}
		return true, nil, errors.New("duplicate request detected by hash")
	}

	dedup := models.RequestDeduplication{
		RequestID:        requestID,
		RequestHash:      requestHash,
		ExternalAPIID:    externalAPIID,
		BusinessCallerID: businessCallerID,
		Processed:        false,
		CreatedAt:        time.Now(),
	}

	if err := tx.Create(&dedup).Error; err != nil {
		tx.Rollback()
		return false, nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return false, nil, err
	}

	return false, nil, nil
}

func (s *DeduplicationService) MarkComplete(requestID string, responseData interface{}) error {
	responseJSON, _ := json.Marshal(responseData)
	return utils.DB.Model(&models.RequestDeduplication{}).
		Where("request_id = ?", requestID).
		Updates(map[string]interface{}{
			"processed":     true,
			"response_data": string(responseJSON),
		}).Error
}

func (s *DeduplicationService) CleanupExpired(olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	return utils.DB.Where("created_at < ?", cutoff).Delete(&models.RequestDeduplication{}).Error
}
