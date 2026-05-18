package dao

import (
	"config-center-service/internal/model"
	"time"
)

type PullLogDAO struct{}

func NewPullLogDAO() *PullLogDAO {
	return &PullLogDAO{}
}

func (dao *PullLogDAO) Create(log *model.InstancePullLog) error {
	return DB.Create(log).Error
}

func (dao *PullLogDAO) GetByInstanceAndKey(appName, configKey, instanceID string) ([]model.InstancePullLog, error) {
	var list []model.InstancePullLog
	err := DB.Where("app_name = ? AND config_key = ? AND instance_id = ?", appName, configKey, instanceID).
		Order("pulled_at desc").Find(&list).Error
	return list, err
}

func (dao *PullLogDAO) GetMismatchedInstances(rollbackID string, expectedVersion int64) ([]model.InstancePullLog, error) {
	var list []model.InstancePullLog
	err := DB.Where("rollback_id = ? AND pulled_version != ?", rollbackID, expectedVersion).
		Group("instance_id").
		Having("MAX(pulled_at) = pulled_at").
		Find(&list).Error
	return list, err
}

func (dao *PullLogDAO) GetLatestByRelease(releaseID string) ([]model.InstancePullLog, error) {
	var list []model.InstancePullLog
	err := DB.Where("release_id = ?", releaseID).
		Group("instance_id").
		Having("MAX(pulled_at) = pulled_at").
		Find(&list).Error
	return list, err
}

func (dao *PullLogDAO) RecordPull(instanceID, appName, configKey string, version int64, releaseID, rollbackID string, isGray, isOffline bool) error {
	log := &model.InstancePullLog{
		AppName:       appName,
		ConfigKey:     configKey,
		InstanceID:    instanceID,
		PulledVersion: version,
		ReleaseID:     releaseID,
		RollbackID:    rollbackID,
		IsGray:        isGray,
		IsOffline:     isOffline,
		PulledAt:      time.Now(),
		CreatedAt:     time.Now(),
	}
	return DB.Create(log).Error
}
