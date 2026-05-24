package service

import (
	"testing"

	"print-proof-api/internal/model"
)

func TestStateMachine_Transitions(t *testing.T) {
	sm := NewStateMachine()

	tests := []struct {
		name      string
		fromState string
		action    string
		wantState string
		wantOk    bool
	}{
		{"draft to submit", model.VersionStatusDraft, "submit", model.VersionStatusSubmitted, true},
		{"submitted to auto_pass", model.VersionStatusSubmitted, "auto_pass", model.VersionStatusAutoPass, true},
		{"submitted to auto_fail", model.VersionStatusSubmitted, "auto_fail", model.VersionStatusAutoFail, true},
		{"submitted to start_review", model.VersionStatusSubmitted, "start_review", model.VersionStatusReviewing, true},
		{"auto_pass to start_review", model.VersionStatusAutoPass, "start_review", model.VersionStatusReviewing, true},
		{"auto_pass to finalize", model.VersionStatusAutoPass, "finalize", model.VersionStatusFinalized, true},
		{"auto_pass to reject", model.VersionStatusAutoPass, "reject", model.VersionStatusRejected, true},
		{"auto_fail to start_review", model.VersionStatusAutoFail, "start_review", model.VersionStatusReviewing, true},
		{"auto_fail to need_supplement", model.VersionStatusAutoFail, "need_supplement", model.VersionStatusNeedSupplement, true},
		{"auto_fail to reject", model.VersionStatusAutoFail, "reject", model.VersionStatusRejected, true},
		{"reviewing to approve", model.VersionStatusReviewing, "approve", model.VersionStatusApproved, true},
		{"reviewing to reject", model.VersionStatusReviewing, "reject", model.VersionStatusRejected, true},
		{"reviewing to need_supplement", model.VersionStatusReviewing, "need_supplement", model.VersionStatusNeedSupplement, true},
		{"approved to finalize", model.VersionStatusApproved, "finalize", model.VersionStatusFinalized, true},
		{"need_supplement to resubmit", model.VersionStatusNeedSupplement, "resubmit", model.VersionStatusSubmitted, true},
		{"rejected to resubmit", model.VersionStatusRejected, "resubmit", model.VersionStatusSubmitted, true},
		{"invalid transition", model.VersionStatusDraft, "finalize", "", false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			toState, ok := sm.CanTransition(tt.fromState, tt.action)
			if ok != tt.wantOk {
				t.Errorf("CanTransition(%s, %s) ok = %v, want %v", tt.fromState, tt.action, ok, tt.wantOk)
			}
			if tt.wantOk && toState != tt.wantState {
				t.Errorf("CanTransition(%s, %s) = %v, want %v", tt.fromState, tt.action, toState, tt.wantState)
			}
		})
	}
}

func TestStateMachine_MainWorkflow(t *testing.T) {
	sm := NewStateMachine()

	currentState := model.VersionStatusDraft
	t.Logf("Initial state: %s", currentState)

	currentState, _ = sm.CanTransition(currentState, "submit")
	t.Logf("After submit: %s", currentState)
	if currentState != model.VersionStatusSubmitted {
		t.Errorf("Expected submitted, got %s", currentState)
	}

	currentState, _ = sm.CanTransition(currentState, "auto_pass")
	t.Logf("After auto_pass: %s", currentState)
	if currentState != model.VersionStatusAutoPass {
		t.Errorf("Expected auto_pass, got %s", currentState)
	}

	currentState, _ = sm.CanTransition(currentState, "start_review")
	t.Logf("After start_review: %s", currentState)
	if currentState != model.VersionStatusReviewing {
		t.Errorf("Expected reviewing, got %s", currentState)
	}

	currentState, _ = sm.CanTransition(currentState, "approve")
	t.Logf("After approve: %s", currentState)
	if currentState != model.VersionStatusApproved {
		t.Errorf("Expected approved, got %s", currentState)
	}

	currentState, _ = sm.CanTransition(currentState, "finalize")
	t.Logf("After finalize: %s", currentState)
	if currentState != model.VersionStatusFinalized {
		t.Errorf("Expected finalized, got %s", currentState)
	}
}

func TestStateMachine_GetValidActions(t *testing.T) {
	sm := NewStateMachine()

	tests := []struct {
		state     string
		wantCount int
	}{
		{model.VersionStatusDraft, 1},
		{model.VersionStatusSubmitted, 3},
		{model.VersionStatusAutoPass, 3},
		{model.VersionStatusAutoFail, 3},
		{model.VersionStatusReviewing, 3},
		{model.VersionStatusApproved, 1},
		{model.VersionStatusNeedSupplement, 1},
		{model.VersionStatusRejected, 1},
	}

	for _, tt := range tests {
		t.Run(tt.state, func(t *testing.T) {
			actions := sm.GetValidActions(tt.state)
			if len(actions) != tt.wantCount {
				t.Errorf("GetValidActions(%s) = %d, want %d, actions: %v", tt.state, len(actions), tt.wantCount, actions)
			}
		})
	}
}

func TestStateMachine_IsFinalState(t *testing.T) {
	sm := NewStateMachine()

	tests := []struct {
		state string
		want  bool
	}{
		{model.VersionStatusFinalized, true},
		{model.VersionStatusRejected, true},
		{model.VersionStatusDraft, false},
		{model.VersionStatusSubmitted, false},
		{model.VersionStatusApproved, false},
	}

	for _, tt := range tests {
		t.Run(tt.state, func(t *testing.T) {
			if got := sm.IsFinalState(tt.state); got != tt.want {
				t.Errorf("IsFinalState(%s) = %v, want %v", tt.state, got, tt.want)
			}
		})
	}
}
