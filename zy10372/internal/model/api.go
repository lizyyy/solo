package model

import (
	"errors"
	"time"
)

var (
	ErrTopicNotFound      = errors.New("topic not found")
	ErrRuleNotFound       = errors.New("rule not found")
	ErrDuplicateRequest   = errors.New("duplicate request")
	ErrInvalidThreshold   = errors.New("invalid threshold")
	ErrTopicAlreadyExists = errors.New("topic already exists")
	ErrRuleAlreadyExists  = errors.New("rule already exists")
	ErrInvalidPriority    = errors.New("invalid priority")
	ErrTopicNotThrottled  = errors.New("topic not throttled")
	ErrInvalidRequest     = errors.New("invalid request parameters")
)

type CreateTopicRequest struct {
	RequestID    string   `json:"request_id"`
	Name         string   `json:"name"`
	Description  string   `json:"description,omitempty"`
	Priority     Priority `json:"priority"`
	MaxQueueSize int64    `json:"max_queue_size"`
}

type CreateTopicResponse struct {
	Topic   *MessageTopic `json:"topic"`
	Created bool          `json:"created"`
}

type CreateRuleRequest struct {
	RequestID       string           `json:"request_id"`
	TopicID         string           `json:"topic_id"`
	RuleName        string           `json:"rule_name"`
	Thresholds      BacklogThreshold `json:"thresholds"`
	ThrottlePercent int              `json:"throttle_percent"`
	MaxDelaySeconds int              `json:"max_delay_seconds"`
	MinDelaySeconds int              `json:"min_delay_seconds"`
}

type CreateRuleResponse struct {
	Rule    *ThrottleRule `json:"rule"`
	Created bool          `json:"created"`
}

type CheckBacklogRequest struct {
	RequestID   string `json:"request_id"`
	TopicID     string `json:"topic_id"`
	CurrentSize int64  `json:"current_size"`
}

type CheckBacklogResponse struct {
	TopicID        string      `json:"topic_id"`
	PreviousStatus TopicStatus `json:"previous_status"`
	CurrentStatus  TopicStatus `json:"current_status"`
	BacklogLevel   string      `json:"backlog_level"`
	ThrottleActive bool        `json:"throttle_active"`
	ShouldThrottle bool        `json:"should_throttle"`
}

type SubmitMessageRequest struct {
	RequestID string   `json:"request_id"`
	TopicID   string   `json:"topic_id"`
	MessageID string   `json:"message_id"`
	Priority  Priority `json:"priority"`
	Payload   string   `json:"payload,omitempty"`
}

type SubmitMessageResponse struct {
	MessageID    string    `json:"message_id"`
	TopicID      string    `json:"topic_id"`
	Accepted     bool      `json:"accepted"`
	Delayed      bool      `json:"delayed"`
	DelayedUntil time.Time `json:"delayed_until,omitempty"`
	Reason       string    `json:"reason,omitempty"`
}

type GetTopicStatusResponse struct {
	Topic        *MessageTopic      `json:"topic"`
	CurrentRule  *ThrottleRule      `json:"current_rule,omitempty"`
	RecoveryCond *RecoveryCondition `json:"recovery_condition,omitempty"`
	DelayedCount int64              `json:"delayed_count"`
	RecentEvents []TimelineEvent    `json:"recent_events"`
}

type ListTopicsResponse struct {
	Topics []MessageTopic `json:"topics"`
	Total  int            `json:"total"`
}

type AdvanceStatusRequest struct {
	RequestID    string      `json:"request_id"`
	TopicID      string      `json:"topic_id"`
	TargetStatus TopicStatus `json:"target_status"`
}

type AdvanceStatusResponse struct {
	TopicID        string      `json:"topic_id"`
	PreviousStatus TopicStatus `json:"previous_status"`
	CurrentStatus  TopicStatus `json:"current_status"`
	StatusChanged  bool        `json:"status_changed"`
}

type QueryHistoryRequest struct {
	TopicID   string    `json:"topic_id,omitempty"`
	StartTime time.Time `json:"start_time,omitempty"`
	EndTime   time.Time `json:"end_time,omitempty"`
	EventType string    `json:"event_type,omitempty"`
	Limit     int       `json:"limit,omitempty"`
}

type QueryHistoryResponse struct {
	Events []TimelineEvent `json:"events"`
	Total  int             `json:"total"`
}

type ExportReportRequest struct {
	TopicID   string    `json:"topic_id"`
	StartTime time.Time `json:"start_time,omitempty"`
	EndTime   time.Time `json:"end_time,omitempty"`
}

type ExportReportResponse struct {
	ReportID    string          `json:"report_id"`
	GeneratedAt time.Time       `json:"generated_at"`
	Summary     *ReportSummary  `json:"summary"`
	Timeline    []TimelineEvent `json:"timeline"`
}

type ReportSummary struct {
	TopicID       string      `json:"topic_id"`
	TopicName     string      `json:"topic_name"`
	ReportPeriod  string      `json:"report_period"`
	MaxBacklog    int64       `json:"max_backlog"`
	AvgBacklog    int64       `json:"avg_backlog"`
	TotalDelayed  int64       `json:"total_delayed"`
	StatusChanges int         `json:"status_changes"`
	FinalStatus   TopicStatus `json:"final_status"`
}

type ErrorResponse struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Detail    string `json:"detail,omitempty"`
	RequestID string `json:"request_id,omitempty"`
	Timestamp string `json:"timestamp"`
}
