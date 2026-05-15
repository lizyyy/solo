package storage

import (
	"sync"
	"time"

	"queue-backoff-api/internal/model"
	"queue-backoff-api/pkg/utils"
)

type MemoryStorage struct {
	mu            sync.RWMutex
	topics        map[string]*model.MessageTopic
	rules         map[string]*model.ThrottleRule
	delayedMsgs   map[string]*model.DelayedMessage
	recoveryConds map[string]*model.RecoveryCondition
	timeline      map[string][]*model.TimelineEvent
	reports       map[string]*model.ThrottleReport
	requestCache  map[string]interface{}
	requestTTL    map[string]time.Time
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		topics:        make(map[string]*model.MessageTopic),
		rules:         make(map[string]*model.ThrottleRule),
		delayedMsgs:   make(map[string]*model.DelayedMessage),
		recoveryConds: make(map[string]*model.RecoveryCondition),
		timeline:      make(map[string][]*model.TimelineEvent),
		reports:       make(map[string]*model.ThrottleReport),
		requestCache:  make(map[string]interface{}),
		requestTTL:    make(map[string]time.Time),
	}
}

func (s *MemoryStorage) CheckDuplicateRequest(requestID string) (interface{}, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	resp, exists := s.requestCache[requestID]
	if !exists {
		return nil, false
	}
	
	ttl, ttlExists := s.requestTTL[requestID]
	if ttlExists && time.Now().After(ttl) {
		return nil, false
	}
	
	return resp, true
}

func (s *MemoryStorage) CacheRequest(requestID string, response interface{}) {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.requestCache[requestID] = response
	s.requestTTL[requestID] = time.Now().Add(24 * time.Hour)
}

func (s *MemoryStorage) CreateTopic(topic *model.MessageTopic) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.topics[topic.ID]; exists {
		return model.ErrTopicAlreadyExists
	}
	
	topic.CreatedAt = utils.GetCurrentTime()
	topic.UpdatedAt = utils.GetCurrentTime()
	s.topics[topic.ID] = topic
	
	s.addTimelineEventLocked(topic.ID, "TOPIC_CREATED", 
		"Topic created with name: "+topic.Name, "")
	
	return nil
}

func (s *MemoryStorage) GetTopic(topicID string) (*model.MessageTopic, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	topic, exists := s.topics[topicID]
	if !exists {
		return nil, model.ErrTopicNotFound
	}
	return topic, nil
}

func (s *MemoryStorage) GetTopicByName(name string) (*model.MessageTopic, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	for _, topic := range s.topics {
		if topic.Name == name {
			return topic, nil
		}
	}
	return nil, model.ErrTopicNotFound
}

func (s *MemoryStorage) ListTopics() ([]model.MessageTopic, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	topics := make([]model.MessageTopic, 0, len(s.topics))
	for _, t := range s.topics {
		topics = append(topics, *t)
	}
	return topics, nil
}

func (s *MemoryStorage) UpdateTopic(topic *model.MessageTopic) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.topics[topic.ID]; !exists {
		return model.ErrTopicNotFound
	}
	
	topic.UpdatedAt = utils.GetCurrentTime()
	s.topics[topic.ID] = topic
	return nil
}

func (s *MemoryStorage) CreateRule(rule *model.ThrottleRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	if _, exists := s.rules[rule.ID]; exists {
		return model.ErrRuleAlreadyExists
	}
	
	rule.CreatedAt = utils.GetCurrentTime()
	rule.UpdatedAt = utils.GetCurrentTime()
	s.rules[rule.ID] = rule
	
	s.addTimelineEventLocked(rule.TopicID, "RULE_CREATED", 
		"Throttle rule created: "+rule.RuleName, "")
	
	return nil
}

func (s *MemoryStorage) GetRule(ruleID string) (*model.ThrottleRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	rule, exists := s.rules[ruleID]
	if !exists {
		return nil, model.ErrRuleNotFound
	}
	return rule, nil
}

func (s *MemoryStorage) GetRuleByTopic(topicID string) (*model.ThrottleRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	for _, rule := range s.rules {
		if rule.TopicID == topicID && rule.Enabled {
			return rule, nil
		}
	}
	return nil, model.ErrRuleNotFound
}

func (s *MemoryStorage) CreateRecoveryCondition(rc *model.RecoveryCondition) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.recoveryConds[rc.TopicID] = rc
	return nil
}

func (s *MemoryStorage) GetRecoveryCondition(topicID string) (*model.RecoveryCondition, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	rc, exists := s.recoveryConds[topicID]
	if !exists {
		return nil, nil
	}
	return rc, nil
}

func (s *MemoryStorage) UpdateRecoveryCondition(rc *model.RecoveryCondition) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.recoveryConds[rc.TopicID] = rc
	return nil
}

func (s *MemoryStorage) AddDelayedMessage(msg *model.DelayedMessage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	msg.CreatedAt = utils.GetCurrentTime()
	s.delayedMsgs[msg.ID] = msg
	return nil
}

func (s *MemoryStorage) CountDelayedMessages(topicID string) (int64, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var count int64 = 0
	for _, msg := range s.delayedMsgs {
		if msg.TopicID == topicID && !msg.Delivered {
			count++
		}
	}
	return count, nil
}

func (s *MemoryStorage) AddTimelineEvent(topicID, eventType, message, detail string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.addTimelineEventLocked(topicID, eventType, message, detail)
	return nil
}

func (s *MemoryStorage) addTimelineEventLocked(topicID, eventType, message, detail string) {
	event := &model.TimelineEvent{
		ID:        utils.GenerateID(),
		TopicID:   topicID,
		EventType: eventType,
		Message:   message,
		Detail:    detail,
		CreatedAt: utils.GetCurrentTime(),
	}
	
	s.timeline[topicID] = append(s.timeline[topicID], event)
}

func (s *MemoryStorage) GetTimeline(topicID string, limit int) ([]model.TimelineEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	events := s.timeline[topicID]
	if limit > 0 && len(events) > limit {
		events = events[len(events)-limit:]
	}
	
	result := make([]model.TimelineEvent, len(events))
	for i, e := range events {
		result[i] = *e
	}
	return result, nil
}

func (s *MemoryStorage) QueryTimeline(topicID, eventType string, startTime, endTime time.Time, limit int) ([]model.TimelineEvent, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	var result []model.TimelineEvent
	
	for _, events := range s.timeline {
		for _, e := range events {
			if topicID != "" && e.TopicID != topicID {
				continue
			}
			if eventType != "" && e.EventType != eventType {
				continue
			}
			if !startTime.IsZero() && e.CreatedAt.Before(startTime) {
				continue
			}
			if !endTime.IsZero() && e.CreatedAt.After(endTime) {
				continue
			}
			result = append(result, *e)
		}
	}
	
	total := len(result)
	if limit > 0 && len(result) > limit {
		result = result[:limit]
	}
	
	return result, total, nil
}

func (s *MemoryStorage) CreateReport(report *model.ThrottleReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	
	s.reports[report.ID] = report
	return nil
}

func (s *MemoryStorage) GetReport(reportID string) (*model.ThrottleReport, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	
	report, exists := s.reports[reportID]
	if !exists {
		return nil, nil
	}
	return report, nil
}
