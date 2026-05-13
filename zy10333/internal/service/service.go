package service

import (
	"crypto/rand"
	"encoding/hex"
	"env-switch-guard/internal/model"
	"env-switch-guard/internal/store"
	"env-switch-guard/pkg/errors"
	"fmt"
	"time"
)

type SwitchService struct {
	store store.Store
}

func NewSwitchService(s store.Store) *SwitchService {
	return &SwitchService{store: s}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *SwitchService) CreateTicket(req *model.CreateTicketRequest) (*model.ApprovalTicket, error) {
	if req.IdempotentKey == "" {
		return nil, errors.InvalidParams("幂等键不能为空")
	}
	if req.SwitchID == "" {
		return nil, errors.InvalidParams("开关ID不能为空")
	}
	if !s.isValidEnvironment(req.Environment) {
		return nil, errors.InvalidEnvironment(string(req.Environment))
	}
	if !s.isValidRiskLevel(req.RiskLevel) {
		return nil, errors.InvalidParams("无效的风险等级")
	}

	existing, err := s.store.GetTicketByIdempotentKey(req.IdempotentKey)
	if err != nil {
		return nil, errors.InternalError("查询幂等键失败")
	}
	if existing != nil {
		return existing, nil
	}

	ticket := &model.ApprovalTicket{
		ID:            generateID(),
		SwitchID:      req.SwitchID,
		Environment:   req.Environment,
		RiskLevel:     req.RiskLevel,
		Operator: model.Operator{
			ID:    req.OperatorID,
			Name:  req.OperatorName,
			Email: req.OperatorEmail,
		},
		ChangeType:    req.ChangeType,
		TargetValue:   req.TargetValue,
		Status:        model.StatusPending,
		IdempotentKey: req.IdempotentKey,
		Reason:        req.Reason,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}

	if err := s.store.CreateTicket(ticket); err != nil {
		return nil, errors.InternalError("创建审批票失败")
	}

	return ticket, nil
}

func (s *SwitchService) ValidateTicket(ticketID string) (*model.ApprovalTicket, error) {
	ticket, err := s.store.GetTicket(ticketID)
	if err != nil {
		return nil, errors.InternalError("查询审批票失败")
	}
	if ticket == nil {
		return nil, errors.NotFound("审批票不存在")
	}

	blocked, reason := s.checkRiskAndEnvironment(ticket)
	if blocked {
		ticket.Status = model.StatusRejected
		s.store.UpdateTicket(ticket)
		report := &model.MisuseReport{
			ID:          generateID(),
			TicketID:    ticket.ID,
			SwitchID:    ticket.SwitchID,
			Environment: ticket.Environment,
			Operator:    ticket.Operator,
			RiskLevel:   ticket.RiskLevel,
			Reason:      reason,
			ReportedAt:  time.Now(),
		}
		s.store.CreateMisuseReport(report)
		return nil, errors.RiskLevelBlocked(reason)
	}

	return ticket, nil
}

func (s *SwitchService) ApproveTicket(ticketID, approverID string) (*model.ApprovalTicket, error) {
	ticket, err := s.store.GetTicket(ticketID)
	if err != nil {
		return nil, errors.InternalError("查询审批票失败")
	}
	if ticket == nil {
		return nil, errors.NotFound("审批票不存在")
	}

	if ticket.Status != model.StatusPending {
		return nil, errors.InvalidStatus(string(ticket.Status))
	}

	ticket.Approvers = append(ticket.Approvers, approverID)

	requiredApprovers := s.getRequiredApprovers(ticket.RiskLevel)
	if len(ticket.Approvers) >= requiredApprovers {
		now := time.Now()
		ticket.Status = model.StatusApproved
		ticket.ApprovedAt = &now
	}

	if err := s.store.UpdateTicket(ticket); err != nil {
		return nil, errors.InternalError("更新审批票失败")
	}

	return ticket, nil
}

func (s *SwitchService) ExecuteTicket(ticketID string) (*model.ChangeResult, error) {
	ticket, err := s.store.GetTicket(ticketID)
	if err != nil {
		return nil, errors.InternalError("查询审批票失败")
	}
	if ticket == nil {
		return nil, errors.NotFound("审批票不存在")
	}

	if ticket.Status == model.StatusExecuted {
		results, _ := s.store.GetResultsByTicketID(ticketID)
		if len(results) > 0 {
			return results[0], nil
		}
	}

	if ticket.Status != model.StatusApproved {
		return nil, errors.InvalidStatus(string(ticket.Status))
	}

	existingResults, _ := s.store.GetResultsByTicketID(ticketID)
	if len(existingResults) > 0 {
		return existingResults[0], nil
	}

	result := &model.ChangeResult{
		ID:          generateID(),
		TicketID:    ticket.ID,
		SwitchID:    ticket.SwitchID,
		Environment: ticket.Environment,
		Operator:    ticket.Operator,
		ChangeType:  ticket.ChangeType,
		OldValue:    nil,
		NewValue:    ticket.TargetValue,
		Success:     true,
		ExecutedAt:  time.Now(),
	}

	if err := s.store.CreateResult(result); err != nil {
		return nil, errors.InternalError("创建变更结果失败")
	}

	now := time.Now()
	ticket.Status = model.StatusExecuted
	ticket.ExecutedAt = &now
	if err := s.store.UpdateTicket(ticket); err != nil {
		return nil, errors.InternalError("更新审批票状态失败")
	}

	return result, nil
}

func (s *SwitchService) GetTicket(id string) (*model.ApprovalTicket, error) {
	ticket, err := s.store.GetTicket(id)
	if err != nil {
		return nil, errors.InternalError("查询审批票失败")
	}
	if ticket == nil {
		return nil, errors.NotFound("审批票不存在")
	}
	return ticket, nil
}

func (s *SwitchService) ListTickets(query *model.HistoryQuery) ([]*model.ApprovalTicket, int, error) {
	tickets, total, err := s.store.ListTickets(query)
	if err != nil {
		return nil, 0, errors.InternalError("查询历史记录失败")
	}
	return tickets, total, nil
}

func (s *SwitchService) GetResult(id string) (*model.ChangeResult, error) {
	result, err := s.store.GetResult(id)
	if err != nil {
		return nil, errors.InternalError("查询变更结果失败")
	}
	if result == nil {
		return nil, errors.NotFound("变更结果不存在")
	}
	return result, nil
}

func (s *SwitchService) CreateSwitchItem(name, description, category string) (*model.SwitchItem, error) {
	item := &model.SwitchItem{
		ID:          generateID(),
		Name:        name,
		Description: description,
		Category:    category,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.store.CreateSwitchItem(item); err != nil {
		return nil, errors.InternalError("创建开关项失败")
	}
	return item, nil
}

func (s *SwitchService) isValidEnvironment(env model.Environment) bool {
	switch env {
	case model.EnvDev, model.EnvTest, model.EnvPre, model.EnvProd:
		return true
	default:
		return false
	}
}

func (s *SwitchService) isValidRiskLevel(risk model.RiskLevel) bool {
	switch risk {
	case model.RiskLow, model.RiskMedium, model.RiskHigh, model.RiskCritical:
		return true
	default:
		return false
	}
}

func (s *SwitchService) checkRiskAndEnvironment(ticket *model.ApprovalTicket) (bool, string) {
	if ticket.Environment == model.EnvProd {
		if ticket.RiskLevel == model.RiskCritical || ticket.RiskLevel == model.RiskHigh {
			return true, fmt.Sprintf("生产环境不允许%s风险操作", ticket.RiskLevel)
		}
		if ticket.RiskLevel == model.RiskMedium {
			return false, ""
		}
	}
	if ticket.Environment == model.EnvPre {
		if ticket.RiskLevel == model.RiskCritical {
			return true, "预发环境不允许critical风险操作"
		}
	}
	return false, ""
}

func (s *SwitchService) getRequiredApprovers(risk model.RiskLevel) int {
	switch risk {
	case model.RiskLow:
		return 1
	case model.RiskMedium:
		return 1
	case model.RiskHigh:
		return 2
	case model.RiskCritical:
		return 3
	default:
		return 1
	}
}
