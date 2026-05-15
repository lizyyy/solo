package service

import (
	"fmt"
	"testing"
	"time"

	"queue-backoff-api/internal/model"
	"queue-backoff-api/internal/storage"
)

func TestCreateTopic(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	req := &model.CreateTopicRequest{
		RequestID:    "test-req-001",
		Name:         "test-topic",
		Description:  "Test topic",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}

	resp, err := svc.CreateTopic(req)
	if err != nil {
		t.Fatalf("CreateTopic failed: %v", err)
	}

	if !resp.Created {
		t.Error("Expected Created to be true")
	}

	if resp.Topic.Name != req.Name {
		t.Errorf("Expected topic name %s, got %s", req.Name, resp.Topic.Name)
	}

	resp2, err := svc.CreateTopic(req)
	if err != nil {
		t.Fatalf("Idempotent CreateTopic failed: %v", err)
	}

	if resp2.Topic.ID != resp.Topic.ID {
		t.Error("Idempotent request should return same topic")
	}
}

func TestCreateRule(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-002",
		Name:         "test-topic-rule",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-001",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}

	ruleResp, err := svc.CreateRule(ruleReq)
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	if !ruleResp.Created {
		t.Error("Expected Created to be true")
	}

	invalidReq := &model.CreateRuleRequest{
		RequestID:  "test-req-rule-invalid",
		TopicID:    topicResp.Topic.ID,
		RuleName:   "invalid-rule",
		Thresholds: model.BacklogThreshold{WarningThreshold: 1000, CriticalThreshold: 500, DangerThreshold: 100},
	}
	_, err = svc.CreateRule(invalidReq)
	if err != model.ErrInvalidThreshold {
		t.Errorf("Expected ErrInvalidThreshold, got %v", err)
	}
}

func TestCheckBacklog(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-backlog",
		Name:         "test-topic-backlog",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-backlog",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule-backlog",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}
	svc.CreateRule(ruleReq)

	checkReq := &model.CheckBacklogRequest{
		RequestID:   "check-req-001",
		TopicID:     topicResp.Topic.ID,
		CurrentSize: 1500,
	}

	checkResp, err := svc.CheckBacklog(checkReq)
	if err != nil {
		t.Fatalf("CheckBacklog failed: %v", err)
	}

	if checkResp.BacklogLevel != "DANGER" {
		t.Errorf("Expected BacklogLevel DANGER, got %s", checkResp.BacklogLevel)
	}

	if !checkResp.ShouldThrottle {
		t.Error("Expected ShouldThrottle to be true")
	}

	if checkResp.CurrentStatus != model.TopicStatusThrottled {
		t.Errorf("Expected status THROTTLED, got %s", checkResp.CurrentStatus)
	}
}

func TestSubmitMessage(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-msg",
		Name:         "test-topic-msg",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-msg",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule-msg",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}
	svc.CreateRule(ruleReq)

	checkReq := &model.CheckBacklogRequest{
		RequestID:   "check-req-msg",
		TopicID:     topicResp.Topic.ID,
		CurrentSize: 1500,
	}
	svc.CheckBacklog(checkReq)

	msgReq := &model.SubmitMessageRequest{
		RequestID: "msg-req-001",
		TopicID:   topicResp.Topic.ID,
		MessageID: "msg-001",
		Priority:  model.PriorityLow,
	}

	msgResp, err := svc.SubmitMessage(msgReq)
	if err != nil {
		t.Fatalf("SubmitMessage failed: %v", err)
	}

	if !msgResp.Delayed {
		t.Error("Expected message to be delayed")
	}

	if !msgResp.Accepted {
		t.Error("Expected message to be accepted")
	}
}

func TestStatusAdvancement(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-advance",
		Name:         "test-topic-advance",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	advanceReq := &model.AdvanceStatusRequest{
		RequestID:    "advance-req-001",
		TopicID:      topicResp.Topic.ID,
		TargetStatus: model.TopicStatusBacklog,
	}

	advanceResp, err := svc.AdvanceStatus(advanceReq)
	if err != nil {
		t.Fatalf("AdvanceStatus failed: %v", err)
	}

	if !advanceResp.StatusChanged {
		t.Error("Expected StatusChanged to be true")
	}

	if advanceResp.CurrentStatus != model.TopicStatusBacklog {
		t.Errorf("Expected status BACKLOG, got %s", advanceResp.CurrentStatus)
	}
}

func TestCheckRecovery(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-recovery",
		Name:         "test-topic-recovery",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-recovery",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule-recovery",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}
	svc.CreateRule(ruleReq)

	checkReq := &model.CheckBacklogRequest{
		RequestID:   "check-req-recovery",
		TopicID:     topicResp.Topic.ID,
		CurrentSize: 1500,
	}
	svc.CheckBacklog(checkReq)

	recovered, err := svc.CheckRecovery(topicResp.Topic.ID)
	if err != nil {
		t.Fatalf("CheckRecovery failed: %v", err)
	}
	if recovered {
		t.Error("Should not recover yet")
	}
}

func TestInvalidPriorityReturnsError(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-priority",
		Name:         "test-topic-priority",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-priority",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule-priority",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}
	svc.CreateRule(ruleReq)

	msgReq := &model.SubmitMessageRequest{
		RequestID: "msg-req-invalid-priority",
		TopicID:   topicResp.Topic.ID,
		MessageID: "msg-001",
		Priority:  model.Priority("INVALID_PRIORITY"),
	}

	_, err := svc.SubmitMessage(msgReq)
	if err != model.ErrInvalidPriority {
		t.Errorf("Expected ErrInvalidPriority, got %v", err)
	}
}

func TestRecoveryConditionAccumulation(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := NewThrottleService(store)

	topicReq := &model.CreateTopicRequest{
		RequestID:    "test-req-accumulate",
		Name:         "test-topic-accumulate",
		Priority:     model.PriorityHigh,
		MaxQueueSize: 10000,
	}
	topicResp, _ := svc.CreateTopic(topicReq)

	ruleReq := &model.CreateRuleRequest{
		RequestID:       "test-req-rule-accumulate",
		TopicID:         topicResp.Topic.ID,
		RuleName:        "test-rule-accumulate",
		Thresholds:      model.BacklogThreshold{WarningThreshold: 100, CriticalThreshold: 500, DangerThreshold: 1000},
		ThrottlePercent: 50,
		MaxDelaySeconds: 60,
		MinDelaySeconds: 10,
	}
	svc.CreateRule(ruleReq)

	checkReq := &model.CheckBacklogRequest{
		RequestID:   "check-req-accumulate-throttled",
		TopicID:     topicResp.Topic.ID,
		CurrentSize: 1500,
	}
	svc.CheckBacklog(checkReq)

	topicAfterThrottle, _ := store.GetTopic(topicResp.Topic.ID)
	if topicAfterThrottle.Status != model.TopicStatusThrottled {
		t.Errorf("Expected status THROTTLED, got %s", topicAfterThrottle.Status)
	}

	for i := 0; i < 3; i++ {
		checkReq := &model.CheckBacklogRequest{
			RequestID:   fmt.Sprintf("check-req-recovery-%d", i),
			TopicID:     topicResp.Topic.ID,
			CurrentSize: 50,
		}
		svc.CheckBacklog(checkReq)
	}

	rc, _ := store.GetRecoveryCondition(topicResp.Topic.ID)
	if rc.CurrentCheckCount != 3 {
		t.Errorf("Expected 3 consecutive checks, got %d", rc.CurrentCheckCount)
	}

	now := time.Now()
	twoMinutesAgo := now.Add(-2 * time.Minute)
	rc.LastStableTS = twoMinutesAgo
	store.UpdateRecoveryCondition(rc)

	recovered, _ := svc.CheckRecovery(topicResp.Topic.ID)
	if !recovered {
		t.Error("Expected topic to be recovered")
	}

	topicAfterRecovery, _ := store.GetTopic(topicResp.Topic.ID)
	if topicAfterRecovery.Status != model.TopicStatusRecovered {
		t.Errorf("Expected status RECOVERED after consecutive checks, got %s", topicAfterRecovery.Status)
	}
}
