package service

import (
	"fmt"

	"print-proof-api/internal/model"
)

type StateTransition struct {
	FromState string
	Action    string
	ToState   string
}

var validTransitions = map[string][]StateTransition{
	model.VersionStatusDraft: {
		{FromState: model.VersionStatusDraft, Action: "submit", ToState: model.VersionStatusSubmitted},
	},
	model.VersionStatusSubmitted: {
		{FromState: model.VersionStatusSubmitted, Action: "auto_pass", ToState: model.VersionStatusAutoPass},
		{FromState: model.VersionStatusSubmitted, Action: "auto_fail", ToState: model.VersionStatusAutoFail},
		{FromState: model.VersionStatusSubmitted, Action: "start_review", ToState: model.VersionStatusReviewing},
	},
	model.VersionStatusAutoPass: {
		{FromState: model.VersionStatusAutoPass, Action: "finalize", ToState: model.VersionStatusFinalized},
		{FromState: model.VersionStatusAutoPass, Action: "reject", ToState: model.VersionStatusRejected},
	},
	model.VersionStatusAutoFail: {
		{FromState: model.VersionStatusAutoFail, Action: "need_supplement", ToState: model.VersionStatusNeedSupplement},
		{FromState: model.VersionStatusAutoFail, Action: "reject", ToState: model.VersionStatusRejected},
	},
	model.VersionStatusReviewing: {
		{FromState: model.VersionStatusReviewing, Action: "approve", ToState: model.VersionStatusApproved},
		{FromState: model.VersionStatusReviewing, Action: "reject", ToState: model.VersionStatusRejected},
		{FromState: model.VersionStatusReviewing, Action: "need_supplement", ToState: model.VersionStatusNeedSupplement},
	},
	model.VersionStatusApproved: {
		{FromState: model.VersionStatusApproved, Action: "finalize", ToState: model.VersionStatusFinalized},
	},
	model.VersionStatusNeedSupplement: {
		{FromState: model.VersionStatusNeedSupplement, Action: "resubmit", ToState: model.VersionStatusSubmitted},
	},
	model.VersionStatusRejected: {
		{FromState: model.VersionStatusRejected, Action: "resubmit", ToState: model.VersionStatusSubmitted},
	},
}

type StateMachine struct{}

func NewStateMachine() *StateMachine {
	return &StateMachine{}
}

func (sm *StateMachine) CanTransition(currentState, action string) (string, bool) {
	transitions, ok := validTransitions[currentState]
	if !ok {
		return "", false
	}

	for _, t := range transitions {
		if t.Action == action {
			return t.ToState, true
		}
	}
	return "", false
}

func (sm *StateMachine) ValidateTransition(currentState, action string) (string, error) {
	toState, ok := sm.CanTransition(currentState, action)
	if !ok {
		return "", fmt.Errorf("invalid transition: cannot perform action '%s' from state '%s'", action, currentState)
	}
	return toState, nil
}

func (sm *StateMachine) GetValidActions(currentState string) []string {
	transitions, ok := validTransitions[currentState]
	if !ok {
		return []string{}
	}

	actions := make([]string, len(transitions))
	for i, t := range transitions {
		actions[i] = t.Action
	}
	return actions
}

func (sm *StateMachine) IsFinalState(state string) bool {
	return state == model.VersionStatusFinalized || state == model.VersionStatusRejected
}
