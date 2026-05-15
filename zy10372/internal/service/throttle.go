package service

import (
	"fmt"
	"time"

	"queue-backoff-api/internal/model"
	"queue-backoff-api/internal/storage"
	"queue-backoff-api/pkg/utils"
)

type ThrottleService struct {
	store storage.Storage
}

func NewThrottleService(store storage.Storage) *ThrottleService {
	return &ThrottleService{store: store}
}

func (s *ThrottleService) CreateTopic(req *model.CreateTopicRequest) (*model.CreateTopicResponse, error) {
	if cached, exists := s.store.GetCachedCreateTopicResponse(req.RequestID); exists {
		return cached, nil
	}

	if req.Name == "" {
		return nil, model.ErrInvalidRequest
	}
	if req.MaxQueueSize <= 0 {
		return nil, model.ErrInvalidRequest
	}

	existing, err := s.store.GetTopicByName(req.Name)
	if err == nil && existing != nil {
		resp := &model.CreateTopicResponse{Topic: existing, Created: false}
		s.store.CacheRequest("create_topic", req.RequestID, resp)
		return resp, nil
	}

	topic := &model.MessageTopic{
		ID:           utils.GenerateID(),
		Name:         req.Name,
		Description:  req.Description,
		Priority:     req.Priority,
		Status:       model.TopicStatusNormal,
		MaxQueueSize: req.MaxQueueSize,
		CurrentSize:  0,
	}

	if err := s.store.CreateTopic(topic); err != nil {
		return nil, err
	}

	resp := &model.CreateTopicResponse{Topic: topic, Created: true}
	s.store.CacheRequest("create_topic", req.RequestID, resp)
	return resp, nil
}

func (s *ThrottleService) CreateRule(req *model.CreateRuleRequest) (*model.CreateRuleResponse, error) {
	if cached, exists := s.store.GetCachedCreateRuleResponse(req.RequestID); exists {
		return cached, nil
	}

	if req.TopicID == "" {
		return nil, model.ErrInvalidRequest
	}
	if req.RuleName == "" {
		return nil, model.ErrInvalidRequest
	}
	if req.MinDelaySeconds < 0 || req.MaxDelaySeconds < 0 || req.MinDelaySeconds > req.MaxDelaySeconds {
		return nil, model.ErrInvalidRequest
	}

	if _, err := s.store.GetTopic(req.TopicID); err != nil {
		return nil, err
	}

	if req.Thresholds.WarningThreshold <= 0 ||
		req.Thresholds.WarningThreshold > req.Thresholds.CriticalThreshold ||
		req.Thresholds.CriticalThreshold > req.Thresholds.DangerThreshold {
		return nil, model.ErrInvalidThreshold
	}

	rule := &model.ThrottleRule{
		ID:              utils.GenerateID(),
		TopicID:         req.TopicID,
		RuleName:        req.RuleName,
		Thresholds:      req.Thresholds,
		ThrottlePercent: req.ThrottlePercent,
		MaxDelaySeconds: req.MaxDelaySeconds,
		MinDelaySeconds: req.MinDelaySeconds,
		Enabled:         true,
	}

	if err := s.store.CreateRule(rule); err != nil {
		return nil, err
	}

	rc := &model.RecoveryCondition{
		ID:                utils.GenerateID(),
		TopicID:           req.TopicID,
		MinStableSeconds:  60,
		RecoveryThreshold: req.Thresholds.WarningThreshold / 2,
		ConsecutiveChecks: 3,
		CurrentCheckCount: 0,
		LastStableTS:      utils.GetCurrentTime(),
	}
	s.store.CreateRecoveryCondition(rc)

	resp := &model.CreateRuleResponse{Rule: rule, Created: true}
	s.store.CacheRequest("create_rule", req.RequestID, resp)
	return resp, nil
}

func (s *ThrottleService) CheckBacklog(req *model.CheckBacklogRequest) (*model.CheckBacklogResponse, error) {
	if cached, exists := s.store.GetCachedCheckBacklogResponse(req.RequestID); exists {
		return cached, nil
	}

	if req.TopicID == "" {
		return nil, model.ErrInvalidRequest
	}
	if req.CurrentSize < 0 {
		return nil, model.ErrInvalidRequest
	}

	topic, err := s.store.GetTopic(req.TopicID)
	if err != nil {
		return nil, err
	}

	prevStatus := topic.Status
	topic.CurrentSize = req.CurrentSize

	rule, err := s.store.GetRuleByTopic(req.TopicID)
	if err != nil {
		rule = nil
	}

	backlogLevel := "NORMAL"
	shouldThrottle := false

	if rule != nil {
		switch {
		case req.CurrentSize >= rule.Thresholds.DangerThreshold:
			backlogLevel = "DANGER"
			shouldThrottle = true
			topic.Status = model.TopicStatusThrottled
		case req.CurrentSize >= rule.Thresholds.CriticalThreshold:
			backlogLevel = "CRITICAL"
			shouldThrottle = true
			topic.Status = model.TopicStatusBacklog
		case req.CurrentSize >= rule.Thresholds.WarningThreshold:
			backlogLevel = "WARNING"
			topic.Status = model.TopicStatusBacklog
		default:
			backlogLevel = "NORMAL"
			if topic.Status == model.TopicStatusRecovered {
				topic.Status = model.TopicStatusNormal
			}
		}
	}

	if rule != nil && (topic.Status == model.TopicStatusThrottled || topic.Status == model.TopicStatusBacklog) {
		if topic.CurrentSize <= rule.Thresholds.WarningThreshold {
			s.checkRecoveryCondition(topic)
		} else {
			rc, _ := s.store.GetRecoveryCondition(topic.ID)
			if rc != nil {
				rc.CurrentCheckCount = 0
				rc.LastStableTS = utils.GetCurrentTime()
				s.store.UpdateRecoveryCondition(rc)
			}
		}
	}

	s.store.UpdateTopic(topic)

	resp := &model.CheckBacklogResponse{
		TopicID:        topic.ID,
		PreviousStatus: prevStatus,
		CurrentStatus:  topic.Status,
		BacklogLevel:   backlogLevel,
		ThrottleActive: topic.Status == model.TopicStatusThrottled,
		ShouldThrottle: shouldThrottle,
	}
	s.store.CacheRequest("check_backlog", req.RequestID, resp)
	return resp, nil
}

func isValidPriority(p model.Priority) bool {
	switch p {
	case model.PriorityLow, model.PriorityMedium, model.PriorityHigh, model.PriorityCritical:
		return true
	default:
		return false
	}
}

func (s *ThrottleService) SubmitMessage(req *model.SubmitMessageRequest) (*model.SubmitMessageResponse, error) {
	if cached, exists := s.store.GetCachedSubmitMessageResponse(req.RequestID); exists {
		return cached, nil
	}

	if req.TopicID == "" || req.MessageID == "" {
		return nil, model.ErrInvalidRequest
	}

	if !isValidPriority(req.Priority) {
		return nil, model.ErrInvalidPriority
	}

	topic, err := s.store.GetTopic(req.TopicID)
	if err != nil {
		return nil, err
	}

	rule, _ := s.store.GetRuleByTopic(req.TopicID)

	resp := &model.SubmitMessageResponse{
		MessageID: req.MessageID,
		TopicID:   req.TopicID,
		Accepted:  true,
		Delayed:   false,
	}

	if rule != nil && topic.Status == model.TopicStatusThrottled {
		delaySeconds := rule.MinDelaySeconds

		switch req.Priority {
		case model.PriorityLow:
			delaySeconds = rule.MaxDelaySeconds
		case model.PriorityMedium:
			delaySeconds = (rule.MinDelaySeconds + rule.MaxDelaySeconds) / 2
		case model.PriorityHigh:
			delaySeconds = rule.MinDelaySeconds
		case model.PriorityCritical:
			delaySeconds = 0
		}

		if delaySeconds > 0 {
			delayedMsg := &model.DelayedMessage{
				ID:           utils.GenerateID(),
				TopicID:      req.TopicID,
				MessageID:    req.MessageID,
				OriginalTS:   utils.GetCurrentTime(),
				DelayedUntil: utils.GetCurrentTime().Add(time.Duration(delaySeconds) * time.Second),
				DelayReason:  "THROTTLED_BACKLOG",
				Priority:     req.Priority,
				Delivered:    false,
			}
			s.store.AddDelayedMessage(delayedMsg)

			resp.Delayed = true
			resp.DelayedUntil = delayedMsg.DelayedUntil
			resp.Reason = delayedMsg.DelayReason

			s.store.AddTimelineEvent(topic.ID, "MESSAGE_DELAYED",
				fmt.Sprintf("Message %s delayed for %d seconds", req.MessageID, delaySeconds),
				fmt.Sprintf("Priority: %s", req.Priority))
		}
	}

	s.store.CacheRequest("submit_message", req.RequestID, resp)
	return resp, nil
}

func (s *ThrottleService) GetTopicStatus(topicID string) (*model.GetTopicStatusResponse, error) {
	topic, err := s.store.GetTopic(topicID)
	if err != nil {
		return nil, err
	}

	rule, _ := s.store.GetRuleByTopic(topicID)
	rc, _ := s.store.GetRecoveryCondition(topicID)
	delayedCount, _ := s.store.CountDelayedMessages(topicID)
	events, _ := s.store.GetTimeline(topicID, 10)

	return &model.GetTopicStatusResponse{
		Topic:        topic,
		CurrentRule:  rule,
		RecoveryCond: rc,
		DelayedCount: delayedCount,
		RecentEvents: events,
	}, nil
}

func (s *ThrottleService) ListTopics() (*model.ListTopicsResponse, error) {
	topics, err := s.store.ListTopics()
	if err != nil {
		return nil, err
	}

	return &model.ListTopicsResponse{
		Topics: topics,
		Total:  len(topics),
	}, nil
}

func (s *ThrottleService) AdvanceStatus(req *model.AdvanceStatusRequest) (*model.AdvanceStatusResponse, error) {
	if cached, exists := s.store.GetCachedAdvanceStatusResponse(req.RequestID); exists {
		return cached, nil
	}

	if req.TopicID == "" {
		return nil, model.ErrInvalidRequest
	}

	topic, err := s.store.GetTopic(req.TopicID)
	if err != nil {
		return nil, err
	}

	prevStatus := topic.Status
	statusChanged := false

	if prevStatus != req.TargetStatus {
		validTransition := false

		switch prevStatus {
		case model.TopicStatusNormal:
			validTransition = req.TargetStatus == model.TopicStatusBacklog
		case model.TopicStatusBacklog:
			validTransition = req.TargetStatus == model.TopicStatusThrottled ||
				req.TargetStatus == model.TopicStatusNormal
		case model.TopicStatusThrottled:
			validTransition = req.TargetStatus == model.TopicStatusRecovered ||
				req.TargetStatus == model.TopicStatusBacklog
		case model.TopicStatusRecovered:
			validTransition = req.TargetStatus == model.TopicStatusNormal
		}

		if validTransition {
			topic.Status = req.TargetStatus
			s.store.UpdateTopic(topic)
			statusChanged = true

			s.store.AddTimelineEvent(topic.ID, "STATUS_ADVANCED",
				fmt.Sprintf("Status advanced from %s to %s", prevStatus, req.TargetStatus),
				"Manual status transition")
		}
	}

	resp := &model.AdvanceStatusResponse{
		TopicID:        topic.ID,
		PreviousStatus: prevStatus,
		CurrentStatus:  topic.Status,
		StatusChanged:  statusChanged,
	}
	s.store.CacheRequest("advance_status", req.RequestID, resp)
	return resp, nil
}

func (s *ThrottleService) CheckRecovery(topicID string) (bool, error) {
	if topicID == "" {
		return false, model.ErrInvalidRequest
	}

	topic, err := s.store.GetTopic(topicID)
	if err != nil {
		return false, err
	}

	if topic.Status != model.TopicStatusThrottled && topic.Status != model.TopicStatusBacklog {
		return false, nil
	}

	return s.checkRecoveryCondition(topic)
}

func (s *ThrottleService) checkRecoveryCondition(topic *model.MessageTopic) (bool, error) {
	rc, err := s.store.GetRecoveryCondition(topic.ID)
	if err != nil || rc == nil {
		return false, nil
	}

	now := utils.GetCurrentTime()

	if topic.CurrentSize <= rc.RecoveryThreshold {
		rc.CurrentCheckCount++
		stableDuration := now.Sub(rc.LastStableTS)

		if rc.CurrentCheckCount >= rc.ConsecutiveChecks && int(stableDuration.Seconds()) >= rc.MinStableSeconds {
			topic.Status = model.TopicStatusRecovered
			s.store.UpdateTopic(topic)

			s.store.AddTimelineEvent(topic.ID, "RECOVERED",
				fmt.Sprintf("Topic recovered after %d consecutive checks and %d seconds stability",
					rc.ConsecutiveChecks, rc.MinStableSeconds),
				fmt.Sprintf("Current size: %d, Threshold: %d", topic.CurrentSize, rc.RecoveryThreshold))

			rc.CurrentCheckCount = 0
			rc.LastStableTS = now
			s.store.UpdateRecoveryCondition(rc)
			return true, nil
		}
	} else {
		rc.CurrentCheckCount = 0
		rc.LastStableTS = now
	}

	s.store.UpdateRecoveryCondition(rc)
	return false, nil
}
