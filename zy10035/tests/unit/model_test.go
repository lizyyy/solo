package unit_test

import (
	"testing"

	"mq-deadletter-review/internal/domain/model"
)

func TestMessageStatusTransition(t *testing.T) {
	tests := []struct {
		name         string
		from         model.MessageStatus
		to           model.MessageStatus
		expectResult bool
	}{
		{"PRODUCED -> SENT", model.MessageStatusProduced, model.MessageStatusSent, true},
		{"PRODUCED -> CONSUMED (invalid)", model.MessageStatusProduced, model.MessageStatusConsumed, false},
		{"SENT -> CONSUMED", model.MessageStatusSent, model.MessageStatusConsumed, true},
		{"SENT -> RETRY", model.MessageStatusSent, model.MessageStatusRetry, true},
		{"SENT -> DEAD_LETTER", model.MessageStatusSent, model.MessageStatusDeadLetter, true},
		{"CONSUMED -> PROCESSED", model.MessageStatusConsumed, model.MessageStatusProcessed, true},
		{"CONSUMED -> RETRY", model.MessageStatusConsumed, model.MessageStatusRetry, true},
		{"RETRY -> DEAD_LETTER", model.MessageStatusRetry, model.MessageStatusDeadLetter, true},
		{"DEAD_LETTER -> REPLAYING", model.MessageStatusDeadLetter, model.MessageStatusReplaying, true},
		{"DEAD_LETTER -> PROCESSED (invalid)", model.MessageStatusDeadLetter, model.MessageStatusProcessed, false},
		{"PROCESSED -> any (invalid)", model.MessageStatusProcessed, model.MessageStatusSent, false},
		{"REPLAYING -> REPLAYED", model.MessageStatusReplaying, model.MessageStatusReplayed, true},
		{"REPLAYED -> CONSUMED", model.MessageStatusReplayed, model.MessageStatusConsumed, true},
		{"FAILED -> RETRY", model.MessageStatusFailed, model.MessageStatusRetry, true},
		{"FAILED -> DEAD_LETTER", model.MessageStatusFailed, model.MessageStatusDeadLetter, true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tracking := &model.MessageTracking{
				Status: tt.from,
			}

			result := tracking.CanTransitionTo(tt.to)
			if result != tt.expectResult {
				t.Errorf("CanTransitionTo(%s -> %s) = %v, want %v", tt.from, tt.to, result, tt.expectResult)
			}
		})
	}
}

func TestMessageTrackingTransitionTo(t *testing.T) {
	tracking := &model.MessageTracking{
		Status: model.MessageStatusProduced,
	}

	err := tracking.TransitionTo(model.MessageStatusSent)
	if err != nil {
		t.Errorf("TransitionTo should succeed: %v", err)
	}

	if tracking.Status != model.MessageStatusSent {
		t.Errorf("Status should be SENT, got %s", tracking.Status)
	}

	if tracking.PreviousStatus != model.MessageStatusProduced {
		t.Errorf("PreviousStatus should be PRODUCED, got %s", tracking.PreviousStatus)
	}

	err = tracking.TransitionTo(model.MessageStatusProduced)
	if err == nil {
		t.Error("TransitionTo should fail for invalid transition")
	}
}

func TestMessageTracking_TableName(t *testing.T) {
	tracking := &model.MessageTracking{}
	expected := "message_trackings"
	if tracking.TableName() != expected {
		t.Errorf("TableName = %s, want %s", tracking.TableName(), expected)
	}
}

func TestDeadLetterMessage_TableName(t *testing.T) {
	dl := &model.DeadLetterMessage{}
	expected := "dead_letter_messages"
	if dl.TableName() != expected {
		t.Errorf("TableName = %s, want %s", dl.TableName(), expected)
	}
}

func TestMessageEventLog_TableName(t *testing.T) {
	log := &model.MessageEventLog{}
	expected := "message_event_logs"
	if log.TableName() != expected {
		t.Errorf("TableName = %s, want %s", log.TableName(), expected)
	}
}

func TestReplayRequest_TableName(t *testing.T) {
	req := &model.ReplayRequest{}
	expected := "replay_requests"
	if req.TableName() != expected {
		t.Errorf("TableName = %s, want %s", req.TableName(), expected)
	}
}

func TestReplayTask_TableName(t *testing.T) {
	task := &model.ReplayTask{}
	expected := "replay_tasks"
	if task.TableName() != expected {
		t.Errorf("TableName = %s, want %s", task.TableName(), expected)
	}
}
