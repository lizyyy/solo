package service

import (
	"tenant-migration-api/internal/models"
)

type StateMachine struct {
	transitions map[models.MigrationStatus]map[models.MigrationStatus]bool
}

func NewStateMachine() *StateMachine {
	sm := &StateMachine{
		transitions: make(map[models.MigrationStatus]map[models.MigrationStatus]bool),
	}
	sm.initTransitions()
	return sm
}

func (sm *StateMachine) initTransitions() {
	sm.addTransition(models.StatusCreated, models.StatusValidating)
	sm.addTransition(models.StatusValidating, models.StatusValidationPassed)
	sm.addTransition(models.StatusValidating, models.StatusFailed)
	sm.addTransition(models.StatusValidationPassed, models.StatusDualWriting)
	sm.addTransition(models.StatusDualWriting, models.StatusVerifying)
	sm.addTransition(models.StatusDualWriting, models.StatusRollingBack)
	sm.addTransition(models.StatusVerifying, models.StatusSwitchingRead)
	sm.addTransition(models.StatusVerifying, models.StatusFailed)
	sm.addTransition(models.StatusVerifying, models.StatusRollingBack)
	sm.addTransition(models.StatusSwitchingRead, models.StatusCompleted)
	sm.addTransition(models.StatusSwitchingRead, models.StatusFailed)
	sm.addTransition(models.StatusSwitchingRead, models.StatusRollingBack)
	sm.addTransition(models.StatusCompleted, models.StatusRollingBack)
	sm.addTransition(models.StatusRollingBack, models.StatusRolledBack)
	sm.addTransition(models.StatusRollingBack, models.StatusFailed)
	sm.addTransition(models.StatusFailed, models.StatusValidating)
	sm.addTransition(models.StatusFailed, models.StatusRollingBack)
	sm.addTransition(models.StatusRolledBack, models.StatusValidating)
}

func (sm *StateMachine) addTransition(from, to models.MigrationStatus) {
	if _, exists := sm.transitions[from]; !exists {
		sm.transitions[from] = make(map[models.MigrationStatus]bool)
	}
	sm.transitions[from][to] = true
}

func (sm *StateMachine) CanTransition(from, to models.MigrationStatus) bool {
	if transitions, exists := sm.transitions[from]; exists {
		return transitions[to]
	}
	return false
}

func (sm *StateMachine) GetValidTransitions(status models.MigrationStatus) []models.MigrationStatus {
	var validTransitions []models.MigrationStatus
	if transitions, exists := sm.transitions[status]; exists {
		for to := range transitions {
			validTransitions = append(validTransitions, to)
		}
	}
	return validTransitions
}

func (sm *StateMachine) IsFinalStatus(status models.MigrationStatus) bool {
	return status == models.StatusCompleted || 
		   status == models.StatusRolledBack || 
		   status == models.StatusFailed
}
