package service

import (
	"encoding/json"
	"fmt"
	"webhook-migration/model"
	"webhook-migration/repository"
)

type StateMachineService struct {
	migrationRepo    *repository.MigrationRepository
	transitionRepo   *repository.StatusTransitionRepository
}

func NewStateMachineService() *StateMachineService {
	return &StateMachineService{
		migrationRepo:  repository.NewMigrationRepository(),
		transitionRepo: repository.NewStatusTransitionRepository(),
	}
}

var validTransitions = map[model.MigrationStatus][]model.MigrationStatus{
	model.StatusCreated: {
		model.StatusDualSend,
		model.StatusFailed,
	},
	model.StatusDualSend: {
		model.StatusReconciling,
		model.StatusFailed,
		model.StatusRolledBack,
	},
	model.StatusReconciling: {
		model.StatusVerified,
		model.StatusFailed,
		model.StatusRolledBack,
		model.StatusDualSend,
	},
	model.StatusVerified: {
		model.StatusSwitched,
		model.StatusFailed,
		model.StatusRolledBack,
		model.StatusReconciling,
	},
	model.StatusSwitched: {
		model.StatusRolledBack,
	},
	model.StatusFailed: {
		model.StatusDualSend,
		model.StatusReconciling,
	},
	model.StatusRolledBack: {
		model.StatusDualSend,
		model.StatusReconciling,
	},
}

func (s *StateMachineService) CanTransition(from, to model.MigrationStatus) bool {
	validTargets, exists := validTransitions[from]
	if !exists {
		return false
	}
	for _, target := range validTargets {
		if target == to {
			return true
		}
	}
	return false
}

func (s *StateMachineService) Transition(migrationID string, toStatus model.MigrationStatus, triggeredBy string, reason string, rawInput interface{}) error {
	migration, err := s.migrationRepo.GetByID(migrationID)
	if err != nil {
		return fmt.Errorf("migration not found: %w", err)
	}

	fromStatus := migration.Status

	if !s.CanTransition(fromStatus, toStatus) {
		return fmt.Errorf("invalid state transition: %s -> %s", fromStatus, toStatus)
	}

	var rawInputJSON string
	if rawInput != nil {
		if bytes, err := json.Marshal(rawInput); err == nil {
			rawInputJSON = string(bytes)
		}
	}

	transition := &model.StatusTransition{
		MigrationID: migrationID,
		FromStatus:  fromStatus,
		ToStatus:    toStatus,
		TriggeredBy: triggeredBy,
		Reason:      reason,
		RawInput:    rawInputJSON,
	}

	if err := s.transitionRepo.Create(transition); err != nil {
		return fmt.Errorf("failed to record transition: %w", err)
	}

	var conclusion, failureReason string
	if toStatus == model.StatusSwitched {
		conclusion = fmt.Sprintf("切换成功，成功率: %.2f%%", migration.SuccessRate*100)
	} else if toStatus == model.StatusFailed {
		failureReason = reason
	} else if toStatus == model.StatusRolledBack {
		conclusion = fmt.Sprintf("已回退至旧地址，原因: %s", reason)
	}

	if err := s.migrationRepo.UpdateStatus(migrationID, toStatus, conclusion, failureReason); err != nil {
		return fmt.Errorf("failed to update migration status: %w", err)
	}

	return nil
}

func (s *StateMachineService) GetTransitions(migrationID string) ([]model.StatusTransition, error) {
	return s.transitionRepo.GetByMigrationID(migrationID)
}
