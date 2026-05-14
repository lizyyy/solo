package service

import (
	"errors"
	"fmt"
	"time"

	"api-error-budget-ledger/internal/model"
	"api-error-budget-ledger/internal/storage"
)

var (
	ErrBudgetFrozen     = errors.New("budget is frozen")
	ErrBudgetExhausted  = errors.New("budget exhausted")
	ErrInvalidState     = errors.New("invalid state")
	ErrInvalidAmount    = errors.New("invalid amount")
	ErrDuplicateRequest = errors.New("duplicate request")
)

type BudgetService struct {
	storage storage.Storage
}

func NewBudgetService(storage storage.Storage) *BudgetService {
	return &BudgetService{storage: storage}
}

func (s *BudgetService) CreateBudget(req *model.CreateBudgetRequest) (*model.CreateBudgetResponse, error) {
	budget := &model.ErrorBudget{
		ID:              model.NewID(),
		ServiceID:       req.ServiceID,
		TotalBudget:     req.TotalBudget,
		RemainingBudget: req.TotalBudget,
		WindowDuration:  req.WindowDuration,
		FreezeThreshold: req.FreezeThreshold,
		Status:          model.ServiceStatusActive,
		CreatedAt:       model.Now(),
		UpdatedAt:       model.Now(),
	}

	window := s.createNewWindow(budget.ID, budget.WindowDuration)
	budget.CurrentWindowID = window.ID

	if err := s.storage.SaveWindow(window); err != nil {
		return nil, err
	}
	if err := s.storage.SaveBudget(budget); err != nil {
		return nil, err
	}

	s.addTimelineEntry(budget.ID, model.TimelineActionBudgetCreated, budget.ID, "budget", map[string]interface{}{
		"total_budget":     req.TotalBudget,
		"window_duration":  req.WindowDuration.String(),
		"freeze_threshold": req.FreezeThreshold,
	})

	return &model.CreateBudgetResponse{
		BudgetID:        budget.ID,
		ServiceID:       budget.ServiceID,
		TotalBudget:     budget.TotalBudget,
		RemainingBudget: budget.RemainingBudget,
		Status:          budget.Status,
		WindowID:        window.ID,
	}, nil
}

func (s *BudgetService) DeductBudget(req *model.DeductBudgetRequest) (*model.DeductBudgetResponse, error) {
	if existing, err := s.storage.GetDeductEventByRequestID(req.RequestID); err == nil {
		return &model.DeductBudgetResponse{
			Success:         true,
			DeductEventID:   existing.ID,
			RemainingBudget: -1,
			Message:         "duplicate request, already processed",
		}, ErrDuplicateRequest
	}

	budget, err := s.storage.GetBudget(req.BudgetID)
	if err != nil {
		return nil, err
	}

	if budget.Status == model.ServiceStatusFrozen {
		return &model.DeductBudgetResponse{
			Success:   false,
			WasFrozen: true,
			Message:   "service is frozen",
		}, ErrBudgetFrozen
	}

	window, err := s.ensureActiveWindow(budget)
	if err != nil {
		return nil, err
	}

	if budget.RemainingBudget < req.Amount {
		wasFrozen := false
		if budget.Status != model.ServiceStatusFrozen {
			wasFrozen = true
			s.freezeServiceInternal(budget, model.FreezeReasonBudgetExhausted, "budget exhausted by deduct", "system")
		}
		return &model.DeductBudgetResponse{
			Success:   false,
			WasFrozen: wasFrozen,
			Message:   "insufficient budget",
		}, ErrBudgetExhausted
	}

	event := &model.DeductEvent{
		ID:            model.NewID(),
		BudgetID:      req.BudgetID,
		WindowID:      window.ID,
		RequestID:     req.RequestID,
		Source:        req.Source,
		Amount:        req.Amount,
		ErrorMessage:  req.ErrorMessage,
		Endpoint:      req.Endpoint,
		Timestamp:     model.Now(),
		IsCompensated: false,
	}

	budget.RemainingBudget -= req.Amount
	window.TotalCalls++
	window.ErrorCount++
	window.Deducted += req.Amount
	window.UpdatedAt = model.Now()
	budget.UpdatedAt = model.Now()

	if err := s.storage.SaveDeductEvent(event); err != nil {
		return nil, err
	}
	if err := s.storage.UpdateBudget(budget); err != nil {
		return nil, err
	}
	if err := s.storage.UpdateWindow(window); err != nil {
		return nil, err
	}

	wasFrozen := false
	if budget.FreezeThreshold > 0 && budget.RemainingBudget <= budget.FreezeThreshold {
		wasFrozen = true
		s.freezeServiceInternal(budget, model.FreezeReasonBudgetExhausted, "threshold reached", "system")
	}

	s.addTimelineEntry(budget.ID, model.TimelineActionDeductApplied, event.ID, "deduct_event", map[string]interface{}{
		"amount":          req.Amount,
		"source":          req.Source,
		"remaining_after": budget.RemainingBudget,
		"window_id":       window.ID,
	})

	return &model.DeductBudgetResponse{
		Success:         true,
		DeductEventID:   event.ID,
		RemainingBudget: budget.RemainingBudget,
		Status:          budget.Status,
		WasFrozen:       wasFrozen,
		Message:         "deducted successfully",
	}, nil
}

func (s *BudgetService) CreateExemption(req *model.CreateExemptionRequest) (*model.Exemption, error) {
	budget, err := s.storage.GetBudget(req.BudgetID)
	if err != nil {
		return nil, err
	}

	deductEvent, err := s.storage.GetDeductEvent(req.DeductEventID)
	if err != nil {
		return nil, err
	}

	if deductEvent.BudgetID != req.BudgetID {
		return nil, ErrInvalidState
	}

	exemption := &model.Exemption{
		ID:               model.NewID(),
		DeductEventID:    req.DeductEventID,
		BudgetID:         req.BudgetID,
		Reason:           req.Reason,
		RequestedBy:      req.RequestedBy,
		Status:           model.ExemptionStatusPending,
		CompensateAmount: req.CompensateAmount,
		RequestedAt:      model.Now(),
	}

	if err := s.storage.SaveExemption(exemption); err != nil {
		return nil, err
	}

	s.addTimelineEntry(budget.ID, model.TimelineActionExemptionCreated, exemption.ID, "exemption", map[string]interface{}{
		"deduct_event_id":   req.DeductEventID,
		"compensate_amount": req.CompensateAmount,
		"requested_by":      req.RequestedBy,
	})

	return exemption, nil
}

func (s *BudgetService) ReviewExemption(req *model.ReviewExemptionRequest) (*model.Exemption, error) {
	if req.Status != model.ExemptionStatusApproved && req.Status != model.ExemptionStatusRejected {
		return nil, ErrInvalidState
	}

	exemption, err := s.storage.GetExemption(req.ExemptionID)
	if err != nil {
		return nil, err
	}

	if exemption.Status != model.ExemptionStatusPending {
		return nil, ErrInvalidState
	}

	if req.BudgetID != "" && exemption.BudgetID != req.BudgetID {
		return nil, ErrInvalidState
	}

	budget, err := s.storage.GetBudget(exemption.BudgetID)
	if err != nil {
		return nil, err
	}

	now := model.Now()
	exemption.Status = req.Status
	exemption.ApprovedBy = &req.ReviewedBy
	exemption.ReviewedAt = &now

	if req.Status == model.ExemptionStatusApproved {
		event, err := s.storage.GetDeductEvent(exemption.DeductEventID)
		if err != nil {
			return nil, err
		}

		if event.BudgetID != exemption.BudgetID {
			return nil, ErrInvalidState
		}

		compensation := &model.Compensation{
			ID:            model.NewID(),
			BudgetID:      budget.ID,
			DeductEventID: exemption.DeductEventID,
			ExemptionID:   exemption.ID,
			Amount:        exemption.CompensateAmount,
			Reason:        fmt.Sprintf("exemption approved: %s", exemption.Reason),
			PerformedBy:   req.ReviewedBy,
			CreatedAt:     now,
		}

		budget.RemainingBudget += exemption.CompensateAmount
		budget.UpdatedAt = now
		event.IsCompensated = true
		event.CompensationID = &compensation.ID

		if err := s.storage.SaveCompensation(compensation); err != nil {
			return nil, err
		}
		if err := s.storage.UpdateDeductEvent(event); err != nil {
			return nil, err
		}
		if err := s.storage.UpdateBudget(budget); err != nil {
			return nil, err
		}
	}

	if err := s.storage.UpdateExemption(exemption); err != nil {
		return nil, err
	}

	action := model.TimelineActionExemptionRejected
	if req.Status == model.ExemptionStatusApproved {
		action = model.TimelineActionExemptionApproved
	}
	s.addTimelineEntry(budget.ID, action, exemption.ID, "exemption", map[string]interface{}{
		"reviewed_by": req.ReviewedBy,
		"status":      req.Status,
	})

	return exemption, nil
}

func (s *BudgetService) FreezeService(req *model.FreezeServiceRequest) (*model.FreezeAction, error) {
	budget, err := s.storage.GetBudget(req.BudgetID)
	if err != nil {
		return nil, err
	}

	return s.freezeServiceInternal(budget, req.Reason, req.Description, req.FrozenBy)
}

func (s *BudgetService) freezeServiceInternal(budget *model.ErrorBudget, reason model.FreezeReason, description, frozenBy string) (*model.FreezeAction, error) {
	if _, err := s.storage.GetActiveFreeze(budget.ID); err == nil {
		return nil, storage.ErrAlreadyExists
	}

	action := &model.FreezeAction{
		ID:          model.NewID(),
		BudgetID:    budget.ID,
		Reason:      reason,
		Description: description,
		FrozenBy:    frozenBy,
		IsFrozen:    true,
		FrozenAt:    model.Now(),
	}

	budget.Status = model.ServiceStatusFrozen
	budget.UpdatedAt = model.Now()

	if err := s.storage.SaveFreezeAction(action); err != nil {
		return nil, err
	}
	if err := s.storage.UpdateBudget(budget); err != nil {
		return nil, err
	}

	s.addTimelineEntry(budget.ID, model.TimelineActionServiceFrozen, action.ID, "freeze_action", map[string]interface{}{
		"reason":    reason,
		"frozen_by": frozenBy,
	})

	return action, nil
}

func (s *BudgetService) UnfreezeService(req *model.UnfreezeServiceRequest) (*model.FreezeAction, error) {
	budget, err := s.storage.GetBudget(req.BudgetID)
	if err != nil {
		return nil, err
	}

	action, err := s.storage.GetActiveFreeze(budget.ID)
	if err != nil {
		return nil, err
	}

	now := model.Now()
	action.IsFrozen = false
	action.UnfrozenBy = &req.UnfrozenBy
	action.UnfrozenAt = &now

	budget.Status = model.ServiceStatusActive
	budget.UpdatedAt = now

	if err := s.storage.UpdateFreezeAction(action); err != nil {
		return nil, err
	}
	if err := s.storage.UpdateBudget(budget); err != nil {
		return nil, err
	}

	s.addTimelineEntry(budget.ID, model.TimelineActionServiceUnfrozen, action.ID, "freeze_action", map[string]interface{}{
		"unfrozen_by": req.UnfrozenBy,
	})

	return action, nil
}

func (s *BudgetService) GetBudgetStatus(budgetID string) (*model.BudgetStatusResponse, error) {
	budget, err := s.storage.GetBudget(budgetID)
	if err != nil {
		return nil, err
	}

	window, err := s.storage.GetWindow(budget.CurrentWindowID)
	if err != nil {
		return nil, err
	}

	budgetUsed := budget.TotalBudget - budget.RemainingBudget
	usagePercent := float64(budgetUsed) / float64(budget.TotalBudget) * 100

	_, isFrozenErr := s.storage.GetActiveFreeze(budgetID)
	isFrozen := isFrozenErr == nil

	return &model.BudgetStatusResponse{
		BudgetID:        budget.ID,
		ServiceID:       budget.ServiceID,
		TotalBudget:     budget.TotalBudget,
		RemainingBudget: budget.RemainingBudget,
		BudgetUsed:      budgetUsed,
		UsagePercent:    usagePercent,
		Status:          budget.Status,
		IsFrozen:        isFrozen,
		CurrentWindow: model.WindowInfo{
			WindowID:   window.ID,
			StartTime:  window.StartTime,
			EndTime:    window.EndTime,
			TotalCalls: window.TotalCalls,
			ErrorCount: window.ErrorCount,
			Deducted:   window.Deducted,
		},
	}, nil
}

func (s *BudgetService) GetTimeline(budgetID string, limit, offset int) (*model.TimelineResponse, error) {
	entries := s.storage.ListTimeline(budgetID, limit, offset)
	total := s.storage.GetTimelineCount(budgetID)

	result := make([]model.TimelineEntry, len(entries))
	for i, e := range entries {
		result[i] = *e
	}

	return &model.TimelineResponse{
		Entries: result,
		Total:   total,
	}, nil
}

func (s *BudgetService) createNewWindow(budgetID string, duration time.Duration) *model.RequestWindow {
	now := model.Now()
	return &model.RequestWindow{
		ID:         model.NewID(),
		BudgetID:   budgetID,
		StartTime:  now,
		EndTime:    now.Add(duration),
		TotalCalls: 0,
		ErrorCount: 0,
		Deducted:   0,
		IsActive:   true,
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

func (s *BudgetService) ensureActiveWindow(budget *model.ErrorBudget) (*model.RequestWindow, error) {
	window, err := s.storage.GetWindow(budget.CurrentWindowID)
	if err != nil {
		return nil, err
	}

	now := model.Now()
	if now.After(window.EndTime) {
		window.IsActive = false
		window.UpdatedAt = now
		if err := s.storage.UpdateWindow(window); err != nil {
			return nil, err
		}

		newWindow := s.createNewWindow(budget.ID, budget.WindowDuration)
		budget.CurrentWindowID = newWindow.ID
		budget.UpdatedAt = now

		if err := s.storage.SaveWindow(newWindow); err != nil {
			return nil, err
		}
		if err := s.storage.UpdateBudget(budget); err != nil {
			return nil, err
		}

		s.addTimelineEntry(budget.ID, model.TimelineActionWindowRolled, newWindow.ID, "window", map[string]interface{}{
			"old_window_id": window.ID,
			"new_window_id": newWindow.ID,
		})

		return newWindow, nil
	}

	return window, nil
}

func (s *BudgetService) addTimelineEntry(budgetID string, action model.TimelineAction, entityID, entityType string, details map[string]interface{}) {
	entry := &model.TimelineEntry{
		ID:         model.NewID(),
		BudgetID:   budgetID,
		Action:     action,
		EntityID:   entityID,
		EntityType: entityType,
		Details:    details,
		CreatedAt:  model.Now(),
	}
	_ = s.storage.SaveTimelineEntry(entry)
}
