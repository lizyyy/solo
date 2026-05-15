package model

import (
	"time"
)

type Priority string

const (
	PriorityHigh    Priority = "HIGH"
	PriorityMedium  Priority = "MEDIUM"
	PriorityLow     Priority = "LOW"
	PriorityCritical Priority = "CRITICAL"
)

type TopicStatus string

const (
	TopicStatusNormal    TopicStatus = "NORMAL"
	TopicStatusBacklog   TopicStatus = "BACKLOG"
	TopicStatusThrottled TopicStatus = "THROTTLED"
	TopicStatusRecovered TopicStatus = "RECOVERED"
)

type MessageTopic struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description,omitempty"`
	Priority    Priority    `json:"priority"`
	Status      TopicStatus `json:"status"`
	MaxQueueSize int64      `json:"max_queue_size"`
	CurrentSize int64       `json:"current_size"`
	CreatedAt   time.Time   `json:"created_at"`
	UpdatedAt   time.Time   `json:"updated_at"`
}

type BacklogThreshold struct {
	WarningThreshold  int64 `json:"warning_threshold"`
	CriticalThreshold int64 `json:"critical_threshold"`
	DangerThreshold   int64 `json:"danger_threshold"`
}

type ThrottleRule struct {
	ID              string           `json:"id"`
	TopicID         string           `json:"topic_id"`
	RuleName        string           `json:"rule_name"`
	Thresholds      BacklogThreshold `json:"thresholds"`
	ThrottlePercent int              `json:"throttle_percent"`
	MaxDelaySeconds int              `json:"max_delay_seconds"`
	MinDelaySeconds int              `json:"min_delay_seconds"`
	Enabled         bool             `json:"enabled"`
	CreatedAt       time.Time        `json:"created_at"`
	UpdatedAt       time.Time        `json:"updated_at"`
}

type DelayedMessage struct {
	ID          string    `json:"id"`
	TopicID     string    `json:"topic_id"`
	MessageID   string    `json:"message_id"`
	OriginalTS  time.Time `json:"original_ts"`
	DelayedUntil time.Time `json:"delayed_until"`
	DelayReason string    `json:"delay_reason"`
	Priority    Priority  `json:"priority"`
	Delivered   bool      `json:"delivered"`
	CreatedAt   time.Time `json:"created_at"`
}

type RecoveryCondition struct {
	ID                 string    `json:"id"`
	TopicID            string    `json:"topic_id"`
	MinStableSeconds   int       `json:"min_stable_seconds"`
	RecoveryThreshold  int64     `json:"recovery_threshold"`
	ConsecutiveChecks  int       `json:"consecutive_checks"`
	CurrentCheckCount  int       `json:"current_check_count"`
	LastStableTS       time.Time `json:"last_stable_ts"`
}

type TimelineEvent struct {
	ID         string    `json:"id"`
	TopicID    string    `json:"topic_id"`
	EventType  string    `json:"event_type"`
	Message    string    `json:"message"`
	Detail     string    `json:"detail,omitempty"`
	CreatedAt  time.Time `json:"created_at"`
}

type ThrottleReport struct {
	ID                 string        `json:"id"`
	TopicID            string        `json:"topic_id"`
	StartTime          time.Time     `json:"start_time"`
	EndTime            time.Time     `json:"end_time,omitempty"`
	PeakBacklog        int64         `json:"peak_backlog"`
	CurrentBacklog     int64         `json:"current_backlog"`
	MessagesDelayed    int64         `json:"messages_delayed"`
	AverageDelayMs     int64         `json:"average_delay_ms"`
	Status             TopicStatus   `json:"status"`
	Timeline           []TimelineEvent `json:"timeline"`
}
