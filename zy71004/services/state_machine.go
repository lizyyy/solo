package services

import (
	"errors"
	"museum-exhibit-condition-api/models"
)

type StateMachine struct{}

func NewStateMachine() *StateMachine {
	return &StateMachine{}
}

var validTransitions = map[models.LiabilityStatus][]models.LiabilityStatus{
	models.StatusPending:    {models.StatusImported, models.StatusRevoked},
	models.StatusImported:   {models.StatusValidated, models.StatusRejected, models.StatusRevoked},
	models.StatusValidated:  {models.StatusProcessing, models.StatusDisputed, models.StatusRevoked},
	models.StatusProcessing: {models.StatusConfirmed, models.StatusDisputed, models.StatusRevoked},
	models.StatusDisputed:   {models.StatusProcessing, models.StatusConfirmed, models.StatusRejected, models.StatusRevoked},
	models.StatusConfirmed:  {models.StatusClosed, models.StatusDisputed, models.StatusRevoked},
	models.StatusRejected:   {models.StatusProcessing, models.StatusRevoked},
	models.StatusClosed:     {models.StatusRevoked},
	models.StatusRevoked:    {models.StatusPending},
}

func (sm *StateMachine) CanTransition(from, to models.LiabilityStatus) bool {
	validTos, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, valid := range validTos {
		if valid == to {
			return true
		}
	}
	return false
}

func (sm *StateMachine) ValidateTransition(from, to models.LiabilityStatus) error {
	if !sm.CanTransition(from, to) {
		return errors.New("invalid state transition from " + string(from) + " to " + string(to))
	}
	return nil
}
