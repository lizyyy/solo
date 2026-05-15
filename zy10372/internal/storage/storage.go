package storage

import (
	"time"

	"queue-backoff-api/internal/model"
)

type Storage interface {
	CheckDuplicateRequest(operation, requestID string) (interface{}, bool)
	CacheRequest(operation, requestID string, response interface{})
	GetCachedCreateTopicResponse(requestID string) (*model.CreateTopicResponse, bool)
	GetCachedCreateRuleResponse(requestID string) (*model.CreateRuleResponse, bool)
	GetCachedCheckBacklogResponse(requestID string) (*model.CheckBacklogResponse, bool)
	GetCachedSubmitMessageResponse(requestID string) (*model.SubmitMessageResponse, bool)
	GetCachedAdvanceStatusResponse(requestID string) (*model.AdvanceStatusResponse, bool)

	CreateTopic(topic *model.MessageTopic) error
	GetTopic(topicID string) (*model.MessageTopic, error)
	GetTopicByName(name string) (*model.MessageTopic, error)
	ListTopics() ([]model.MessageTopic, error)
	UpdateTopic(topic *model.MessageTopic) error

	CreateRule(rule *model.ThrottleRule) error
	GetRule(ruleID string) (*model.ThrottleRule, error)
	GetRuleByTopic(topicID string) (*model.ThrottleRule, error)

	CreateRecoveryCondition(rc *model.RecoveryCondition) error
	GetRecoveryCondition(topicID string) (*model.RecoveryCondition, error)
	UpdateRecoveryCondition(rc *model.RecoveryCondition) error

	AddDelayedMessage(msg *model.DelayedMessage) error
	CountDelayedMessages(topicID string) (int64, error)

	AddTimelineEvent(topicID, eventType, message, detail string) error
	GetTimeline(topicID string, limit int) ([]model.TimelineEvent, error)
	QueryTimeline(topicID, eventType string, startTime, endTime time.Time, limit int) ([]model.TimelineEvent, int, error)

	CreateReport(report *model.ThrottleReport) error
	GetReport(reportID string) (*model.ThrottleReport, error)
}
