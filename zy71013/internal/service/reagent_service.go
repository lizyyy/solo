package service

import (
	"errors"
	"fmt"
	"time"

	"lab-reagent-api/config"
	"lab-reagent-api/internal/database"
	"lab-reagent-api/internal/model"
)

type ReagentService struct {
	cfg        *config.Config
	reagentRepo *database.ReagentRepo
	usageRepo   *database.UsageRepo
	orderRepo   *database.OrderRepo
}

func NewReagentService(cfg *config.Config, reagentRepo *database.ReagentRepo, usageRepo *database.UsageRepo, orderRepo *database.OrderRepo) *ReagentService {
	return &ReagentService{
		cfg:        cfg,
		reagentRepo: reagentRepo,
		usageRepo:   usageRepo,
		orderRepo:   orderRepo,
	}
}

func (s *ReagentService) ThawReagent(req *model.ThawRequest) (*model.Reagent, *model.APIError) {
	exists, _ := s.reagentRepo.CheckDuplicateRequest(req.RequestID)
	if exists {
		return nil, &model.APIError{
			Code:    model.ErrCodeDuplicate,
			Message: "重复请求",
			Details: fmt.Sprintf("请求ID %s 已被处理", req.RequestID),
		}
	}

	reagent, err := s.reagentRepo.GetByBatchNo(req.BatchNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}

	if reagent == nil {
		reagent = &model.Reagent{
			BatchNo:     req.BatchNo,
			ReagentType: req.ReagentType,
			Status:      model.StatusFrozen,
			RequestID:   req.RequestID,
		}
		if err := s.reagentRepo.Create(reagent); err != nil {
			return nil, &model.APIError{
				Code:    model.ErrCodeMissingMaterial,
				Message: "创建试剂失败",
				Details: err.Error(),
			}
		}
	}

	if reagent.Status == model.StatusDiscarded {
		return nil, &model.APIError{
			Code:    model.ErrCodeDiscarded,
			Message: "试剂已废弃",
			Details: "该试剂已被废弃，无法解冻",
		}
	}

	if reagent.Status == model.StatusThawed || reagent.Status == model.StatusInUse {
		if !s.isExpired(reagent) {
			return reagent, nil
		}
	}

	now := time.Now()
	expireAt := now.Add(time.Duration(s.cfg.ThawWindowHours) * time.Hour)
	reagent.Status = model.StatusThawed
	reagent.ThawedAt = &now
	reagent.ThawedBy = req.ThawedBy
	reagent.Project = req.Project
	reagent.ExpireAt = &expireAt

	if err := s.reagentRepo.Update(reagent); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "更新试剂状态失败",
			Details: err.Error(),
		}
	}

	return reagent, nil
}

func (s *ReagentService) UseReagent(req *model.UsageRequest) (*model.UsageRecord, *model.APIError) {
	exists, _ := s.usageRepo.CheckDuplicateRequest(req.RequestID)
	if exists {
		records, err := s.usageRepo.GetByBatchNo(req.BatchNo)
		if err == nil && len(records) > 0 {
			for _, r := range records {
				if r.RequestID == req.RequestID {
					return &r, nil
				}
			}
		}
		return nil, &model.APIError{
			Code:    model.ErrCodeDuplicate,
			Message: "重复请求",
			Details: fmt.Sprintf("请求ID %s 已被处理", req.RequestID),
		}
	}

	reagent, err := s.reagentRepo.GetByBatchNo(req.BatchNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}

	if reagent == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "试剂不存在",
			Details: fmt.Sprintf("批号 %s 未找到，请先执行解冻操作", req.BatchNo),
		}
	}

	if apiErr := s.validateReagentUsable(reagent); apiErr != nil {
		return nil, apiErr
	}

	record := &model.UsageRecord{
		ReagentID: reagent.ID,
		BatchNo:   req.BatchNo,
		UsedBy:    req.UsedBy,
		Project:   req.Project,
		Volume:    req.Volume,
		Notes:     req.Notes,
		RequestID: req.RequestID,
	}

	if err := s.usageRepo.Create(record); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "创建领用记录失败",
			Details: err.Error(),
		}
	}

	reagent.Status = model.StatusInUse
	if err := s.reagentRepo.Update(reagent); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "更新试剂状态失败",
			Details: err.Error(),
		}
	}

	return record, nil
}

func (s *ReagentService) DiscardReagent(req *model.DiscardRequest) (*model.Reagent, *model.APIError) {
	reagent, err := s.reagentRepo.GetByBatchNo(req.BatchNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}

	if reagent == nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "试剂不存在",
			Details: fmt.Sprintf("批号 %s 未找到", req.BatchNo),
		}
	}

	if reagent.Status == model.StatusDiscarded {
		return nil, &model.APIError{
			Code:    model.ErrCodeInvalidStatus,
			Message: "试剂已废弃",
			Details: "该试剂已处于废弃状态",
		}
	}

	now := time.Now()
	reagent.Status = model.StatusDiscarded
	reagent.DiscardedAt = &now
	reagent.DiscardedBy = req.DiscardedBy
	reagent.DiscardReason = req.Reason

	if err := s.reagentRepo.Update(reagent); err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "更新试剂状态失败",
			Details: err.Error(),
		}
	}

	return reagent, nil
}

func (s *ReagentService) validateReagentUsable(reagent *model.Reagent) *model.APIError {
	if reagent.Status == model.StatusDiscarded {
		return &model.APIError{
			Code:    model.ErrCodeDiscarded,
			Message: "试剂已废弃",
			Details: "该试剂已被废弃，禁止领用",
		}
	}

	if reagent.Status == model.StatusFrozen {
		return &model.APIError{
			Code:    model.ErrCodeInvalidStatus,
			Message: "试剂未解冻",
			Details: "该试剂处于冷冻状态，请先执行解冻操作",
		}
	}

	if s.isExpired(reagent) {
		reagent.Status = model.StatusExpired
		s.reagentRepo.Update(reagent)
		return &model.APIError{
			Code:    model.ErrCodeExpired,
			Message: "试剂已超期",
			Details: fmt.Sprintf("解冻窗口已过期，过期时间: %s", reagent.ExpireAt.Format(time.RFC3339)),
		}
	}

	return nil
}

func (s *ReagentService) isExpired(reagent *model.Reagent) bool {
	if reagent.ExpireAt == nil {
		return false
	}
	return time.Now().After(*reagent.ExpireAt)
}

func (s *ReagentService) GetReagent(batchNo string) (*model.Reagent, []model.UsageRecord, *model.APIError) {
	reagent, err := s.reagentRepo.GetByBatchNo(batchNo)
	if err != nil {
		return nil, nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂失败",
			Details: err.Error(),
		}
	}

	if reagent == nil {
		return nil, nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "试剂不存在",
			Details: fmt.Sprintf("批号 %s 未找到", batchNo),
		}
	}

	usageRecords, err := s.usageRepo.GetByBatchNo(batchNo)
	if err != nil {
		return reagent, nil, nil
	}

	return reagent, usageRecords, nil
}

func (s *ReagentService) ListReagents() ([]model.Reagent, *model.APIError) {
	s.reagentRepo.UpdateExpiredStatus()
	reagents, err := s.reagentRepo.ListAll()
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询试剂列表失败",
			Details: err.Error(),
		}
	}
	return reagents, nil
}

func (s *ReagentService) GetSharedProjects(batchNo string) ([]string, *model.APIError) {
	projects, err := s.usageRepo.GetProjectsByBatchNo(batchNo)
	if err != nil {
		return nil, &model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "查询共享项目失败",
			Details: err.Error(),
		}
	}
	return projects, nil
}

var ErrDuplicateRequest = errors.New("duplicate request")
