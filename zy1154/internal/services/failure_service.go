package services

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type FailureService struct {
	db *gorm.DB
}

func NewFailureService() *FailureService {
	return &FailureService{
		db: database.GetDB(),
	}
}

type FailureType string

const (
	FailureTypeNetworkTimeout    FailureType = "network_timeout"
	FailureTypeDatabaseError     FailureType = "database_error"
	FailureTypeServiceUnavailable FailureType = "service_unavailable"
	FailureTypePartialSuccess    FailureType = "partial_success"
	FailureTypeNoop              FailureType = "noop"
)

func (s *FailureService) InjectFailure(serviceName, operation string) error {
	var fi models.FailureInjection
	err := s.db.Where("service_name = ? AND operation = ? AND is_active = ?",
		serviceName, operation, true).First(&fi).Error

	if err == gorm.ErrRecordNotFound {
		return nil
	}

	if err != nil {
		return err
	}

	switch FailureType(fi.FailureType) {
	case FailureTypeNetworkTimeout:
		time.Sleep(5 * time.Second)
		return errors.New("network timeout: operation took too long")

	case FailureTypeDatabaseError:
		return errors.New("database error: connection refused")

	case FailureTypeServiceUnavailable:
		return errors.New("service unavailable: 503 status")

	case FailureTypePartialSuccess:
		return errors.New("partial success: some operations succeeded, some failed")

	case FailureTypeNoop:
		return nil
	}

	return nil
}

func (s *FailureService) RegisterFailure(serviceName, operation string, failureType FailureType) error {
	var fi models.FailureInjection
	err := s.db.Where("service_name = ? AND operation = ?", serviceName, operation).First(&fi).Error

	if err == gorm.ErrRecordNotFound {
		fi = models.FailureInjection{
			ID:          utils.GenerateID(),
			ServiceName: serviceName,
			Operation:   operation,
			FailureType: string(failureType),
			IsActive:    true,
			CreatedAt:   time.Now(),
			UpdatedAt:   time.Now(),
		}
		return s.db.Create(&fi).Error
	}

	if err != nil {
		return err
	}

	fi.FailureType = string(failureType)
	fi.IsActive = true
	fi.UpdatedAt = time.Now()
	return s.db.Save(&fi).Error
}

func (s *FailureService) DisableFailure(serviceName, operation string) error {
	result := s.db.Model(&models.FailureInjection{}).
		Where("service_name = ? AND operation = ?", serviceName, operation).
		Update("is_active", false)

	if result.RowsAffected == 0 {
		return fmt.Errorf("no active failure found for %s.%s", serviceName, operation)
	}

	return result.Error
}

func (s *FailureService) DisableAllFailures() error {
	return s.db.Model(&models.FailureInjection{}).
		Where("is_active = ?", true).
		Update("is_active", false).Error
}

func (s *FailureService) GetActiveFailures() ([]models.FailureInjection, error) {
	var failures []models.FailureInjection
	err := s.db.Where("is_active = ?", true).Find(&failures).Error
	return failures, err
}

func (s *FailureService) GetAllFailures() ([]models.FailureInjection, error) {
	var failures []models.FailureInjection
	err := s.db.Order("created_at DESC").Find(&failures).Error
	return failures, err
}
