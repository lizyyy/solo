package dao

import (
	"config-center-service/internal/model"
	"time"
)

type RollbackDAO struct{}

func NewRollbackDAO() *RollbackDAO {
	return &RollbackDAO{}
}

func (dao *RollbackDAO) Create(rc *model.RollbackConfirmation) error {
	return DB.Create(rc).Error
}

func (dao *RollbackDAO) GetByID(id string) (*model.RollbackConfirmation, error) {
	var rc model.RollbackConfirmation
	err := DB.Where("id = ?", id).First(&rc).Error
	if err != nil {
		return nil, err
	}
	return &rc, nil
}

func (dao *RollbackDAO) UpdateStatus(id string, status model.RollbackStatus) error {
	updates := map[string]interface{}{
		"status":     status,
		"updated_at": time.Now(),
	}
	if status == model.RollbackStatusConfirmed {
		now := time.Now()
		updates["confirmed_at"] = &now
	} else if status == model.RollbackStatusExecuted {
		now := time.Now()
		updates["executed_at"] = &now
	}
	return DB.Model(&model.RollbackConfirmation{}).Where("id = ?", id).Updates(updates).Error
}

func (dao *RollbackDAO) ListByApp(appName string) ([]model.RollbackConfirmation, error) {
	var list []model.RollbackConfirmation
	err := DB.Where("app_name = ?", appName).Order("created_at desc").Find(&list).Error
	return list, err
}

func (dao *RollbackDAO) GetPendingByAppAndKey(appName, configKey string) (*model.RollbackConfirmation, error) {
	var rc model.RollbackConfirmation
	err := DB.Where("app_name = ? AND config_key = ? AND status = ?", appName, configKey, model.RollbackStatusPending).First(&rc).Error
	if err != nil {
		return nil, err
	}
	return &rc, nil
}
