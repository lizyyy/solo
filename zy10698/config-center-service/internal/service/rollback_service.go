package service

import (
	"config-center-service/internal/dao"
	"config-center-service/internal/model"
	"encoding/json"
	"errors"
	"time"
)

type RollbackService struct {
	rollbackDAO *dao.RollbackDAO
	pullLogDAO  *dao.PullLogDAO
}

func NewRollbackService() *RollbackService {
	return &RollbackService{
		rollbackDAO: dao.NewRollbackDAO(),
		pullLogDAO:  dao.NewPullLogDAO(),
	}
}

type CreateRollbackRequest struct {
	AppName           string            `json:"app_name" binding:"required"`
	ConfigKey         string            `json:"config_key" binding:"required"`
	TargetVersion     int64             `json:"target_version" binding:"required,min=1"`
	SourceVersion     int64             `json:"source_version" binding:"required,min=1"`
	Confirmer         string            `json:"confirmer" binding:"required"`
	InstanceScopeType model.InstanceScopeType `json:"instance_scope_type" binding:"required"`
	InstanceIDs       []string          `json:"instance_ids"`
	GrayGroupID       string            `json:"gray_group_id"`
	Remark            string            `json:"remark"`
}

func (s *RollbackService) CreateRollback(req *CreateRollbackRequest) (*model.RollbackConfirmation, error) {
	existing, err := s.rollbackDAO.GetPendingByAppAndKey(req.AppName, req.ConfigKey)
	if err == nil && existing != nil {
		return nil, errors.New("存在待确认的回滚申请，请先处理")
	}

	instanceIDsJSON, _ := json.Marshal(req.InstanceIDs)

	rc := &model.RollbackConfirmation{
		AppName:           req.AppName,
		ConfigKey:         req.ConfigKey,
		TargetVersion:     req.TargetVersion,
		SourceVersion:     req.SourceVersion,
		Confirmer:         req.Confirmer,
		InstanceScopeType: req.InstanceScopeType,
		InstanceIDs:       string(instanceIDsJSON),
		GrayGroupID:       req.GrayGroupID,
		Status:            model.RollbackStatusPending,
		Remark:            req.Remark,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	err = s.rollbackDAO.Create(rc)
	if err != nil {
		return nil, err
	}

	return rc, nil
}

func (s *RollbackService) ConfirmRollback(id, operator string) (*model.RollbackConfirmation, error) {
	rc, err := s.rollbackDAO.GetByID(id)
	if err != nil {
		return nil, errors.New("回滚记录不存在")
	}

	if rc.Status != model.RollbackStatusPending {
		return nil, errors.New("当前状态不允许确认")
	}

	err = s.rollbackDAO.UpdateStatus(id, model.RollbackStatusConfirmed)
	if err != nil {
		return nil, err
	}

	return s.rollbackDAO.GetByID(id)
}

func (s *RollbackService) ExecuteRollback(id string) (*model.RollbackConfirmation, error) {
	rc, err := s.rollbackDAO.GetByID(id)
	if err != nil {
		return nil, errors.New("回滚记录不存在")
	}

	if rc.Status != model.RollbackStatusConfirmed {
		return nil, errors.New("当前状态不允许执行")
	}

	err = s.rollbackDAO.UpdateStatus(id, model.RollbackStatusExecuted)
	if err != nil {
		return nil, err
	}

	return s.rollbackDAO.GetByID(id)
}

func (s *RollbackService) GetRollbackDetail(id string) (*model.RollbackConfirmation, error) {
	return s.rollbackDAO.GetByID(id)
}

func (s *RollbackService) ListRollbacks(appName string) ([]model.RollbackConfirmation, error) {
	return s.rollbackDAO.ListByApp(appName)
}

func (s *RollbackService) GetMismatchedInstances(rollbackID string) ([]model.InstancePullLog, error) {
	rc, err := s.rollbackDAO.GetByID(rollbackID)
	if err != nil {
		return nil, err
	}

	instances, err := s.pullLogDAO.GetMismatchedInstances(rollbackID, rc.TargetVersion)
	if err != nil {
		return nil, err
	}

	return instances, nil
}

func (s *RollbackService) RecordInstancePull(instanceID, appName, configKey string, version int64, releaseID, rollbackID string, isGray, isOffline bool) error {
	return s.pullLogDAO.RecordPull(instanceID, appName, configKey, version, releaseID, rollbackID, isGray, isOffline)
}

func (s *RollbackService) GetInstanceIDs(rc *model.RollbackConfirmation) ([]string, error) {
	if rc.InstanceIDs == "" {
		return []string{}, nil
	}

	var ids []string
	err := json.Unmarshal([]byte(rc.InstanceIDs), &ids)
	return ids, err
}
