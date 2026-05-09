package model

import (
	"time"
)

type MessageStatus string

const (
	MessageStatusProduced      MessageStatus = "PRODUCED"
	MessageStatusSent          MessageStatus = "SENT"
	MessageStatusConsumed      MessageStatus = "CONSUMED"
	MessageStatusRetry         MessageStatus = "RETRY"
	MessageStatusDeadLetter    MessageStatus = "DEAD_LETTER"
	MessageStatusReplaying     MessageStatus = "REPLAYING"
	MessageStatusReplayed      MessageStatus = "REPLAYED"
	MessageStatusFailed        MessageStatus = "FAILED"
	MessageStatusProcessed     MessageStatus = "PROCESSED"
)

type MessageTracking struct {
	ID              int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	TrackingID      string        `json:"tracking_id" gorm:"uniqueIndex;size:64"`
	MessageID       string        `json:"message_id" gorm:"index;size:64"`
	Topic           string        `json:"topic" gorm:"size:128"`
	Tag             string        `json:"tag" gorm:"size:64"`
	Keys            string        `json:"keys" gorm:"size:256"`
	ProducerGroup   string        `json:"producer_group" gorm:"size:128"`
	ConsumerGroup   string        `json:"consumer_group" gorm:"size:128"`
	Status          MessageStatus `json:"status" gorm:"size:32;index"`
	PreviousStatus  MessageStatus `json:"previous_status" gorm:"size:32"`
	RetryCount      int           `json:"retry_count"`
	MaxRetryCount   int           `json:"max_retry_count"`
	Body            string        `json:"body" gorm:"type:longtext"`
	Properties      string        `json:"properties" gorm:"type:longtext"`
	ErrorMessage    string        `json:"error_message" gorm:"type:text"`
	ErrorStack      string        `json:"error_stack" gorm:"type:longtext"`
	LatestError     string        `json:"latest_error" gorm:"type:text"`
	LatestErrorAt   *time.Time    `json:"latest_error_at"`
	ProducedAt      *time.Time    `json:"produced_at"`
	SentAt          *time.Time    `json:"sent_at"`
	ConsumedAt      *time.Time    `json:"consumed_at"`
	DeadLetterAt    *time.Time    `json:"dead_letter_at"`
	ReplayedAt      *time.Time    `json:"replayed_at"`
	ProcessedAt     *time.Time    `json:"processed_at"`
	CreatedAt       time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

func (m *MessageTracking) TableName() string {
	return "message_trackings"
}

func (m *MessageTracking) CanTransitionTo(newStatus MessageStatus) bool {
	switch m.Status {
	case MessageStatusProduced:
		return newStatus == MessageStatusSent || newStatus == MessageStatusFailed
	case MessageStatusSent:
		return newStatus == MessageStatusConsumed || newStatus == MessageStatusRetry || newStatus == MessageStatusDeadLetter || newStatus == MessageStatusFailed
	case MessageStatusConsumed:
		return newStatus == MessageStatusProcessed || newStatus == MessageStatusRetry || newStatus == MessageStatusDeadLetter
	case MessageStatusRetry:
		return newStatus == MessageStatusConsumed || newStatus == MessageStatusRetry || newStatus == MessageStatusDeadLetter
	case MessageStatusDeadLetter:
		return newStatus == MessageStatusReplaying
	case MessageStatusReplaying:
		return newStatus == MessageStatusReplayed || newStatus == MessageStatusDeadLetter
	case MessageStatusReplayed:
		return newStatus == MessageStatusConsumed || newStatus == MessageStatusRetry || newStatus == MessageStatusDeadLetter
	case MessageStatusProcessed:
		return false
	case MessageStatusFailed:
		return newStatus == MessageStatusRetry || newStatus == MessageStatusDeadLetter
	default:
		return false
	}
}

func (m *MessageTracking) TransitionTo(newStatus MessageStatus) error {
	if !m.CanTransitionTo(newStatus) {
		return ErrInvalidStatusTransition
	}
	m.PreviousStatus = m.Status
	m.Status = newStatus
	return nil
}

type DeadLetterMessage struct {
	ID              int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	TrackingID      string        `json:"tracking_id" gorm:"uniqueIndex;size:64"`
	MessageID       string        `json:"message_id" gorm:"index;size:64"`
	Topic           string        `json:"topic" gorm:"size:128"`
	Tag             string        `json:"tag" gorm:"size:64"`
	Keys            string        `json:"keys" gorm:"size:256"`
	ConsumerGroup   string        `json:"consumer_group" gorm:"size:128"`
	Body            string        `json:"body" gorm:"type:longtext"`
	Properties      string        `json:"properties" gorm:"type:longtext"`
	ErrorMessage    string        `json:"error_message" gorm:"type:text"`
	ErrorStack      string        `json:"error_stack" gorm:"type:longtext"`
	TotalRetryCount int           `json:"total_retry_count"`
	ReplayCount     int           `json:"replay_count"`
	MaxReplayCount  int           `json:"max_replay_count"`
	OriginMessageID string        `json:"origin_message_id" gorm:"size:64"`
	OriginTopic     string        `json:"origin_topic" gorm:"size:128"`
	ReplayStatus    MessageStatus `json:"replay_status" gorm:"size:32;index"`
	LastReplayAt    *time.Time    `json:"last_replay_at"`
	DeadLetterAt    *time.Time    `json:"dead_letter_at"`
	CreatedAt       time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

func (d *DeadLetterMessage) TableName() string {
	return "dead_letter_messages"
}

type MessageEventLog struct {
	ID             int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	TrackingID     string        `json:"tracking_id" gorm:"index;size:64"`
	MessageID      string        `json:"message_id" gorm:"index;size:64"`
	EventName      string        `json:"event_name" gorm:"size:64"`
	FromStatus     MessageStatus `json:"from_status" gorm:"size:32"`
	ToStatus       MessageStatus `json:"to_status" gorm:"size:32"`
	Operation      string        `json:"operation" gorm:"size:64"`
	OperatorID     string        `json:"operator_id" gorm:"size:64"`
	Description    string        `json:"description" gorm:"type:text"`
	RequestBody    string        `json:"request_body" gorm:"type:longtext"`
	ResponseBody   string        `json:"response_body" gorm:"type:longtext"`
	ErrorInfo      string        `json:"error_info" gorm:"type:longtext"`
	Success        bool          `json:"success"`
	ExecutionTime  int64         `json:"execution_time"`
	IPAddress      string        `json:"ip_address" gorm:"size:64"`
	UserAgent      string        `json:"user_agent" gorm:"size:512"`
	CreatedAt      time.Time     `json:"created_at" gorm:"autoCreateTime"`
}

func (m *MessageEventLog) TableName() string {
	return "message_event_logs"
}

type ReplayRequest struct {
	ID              int64         `json:"id" gorm:"primaryKey;autoIncrement"`
	RequestID       string        `json:"request_id" gorm:"uniqueIndex;size:64"`
	TrackingIDs     string        `json:"tracking_ids" gorm:"type:longtext"`
	DeadLetterIDs   string        `json:"dead_letter_ids" gorm:"type:longtext"`
	ConsumerGroup   string        `json:"consumer_group" gorm:"size:128"`
	Topic           string        `json:"topic" gorm:"size:128"`
	Tag             string        `json:"tag" gorm:"size:64"`
	DryRun          bool          `json:"dry_run"`
	MaxBatchSize    int           `json:"max_batch_size"`
	Concurrency     int           `json:"concurrency"`
	Timeout         int           `json:"timeout"`
	Status          string        `json:"status" gorm:"size:32;index"`
	SuccessCount    int           `json:"success_count"`
	FailedCount     int           `json:"failed_count"`
	TotalCount      int           `json:"total_count"`
	OperatorID      string        `json:"operator_id" gorm:"size:64"`
	Reason          string        `json:"reason" gorm:"type:text"`
	StartTime       *time.Time    `json:"start_time"`
	EndTime         *time.Time    `json:"end_time"`
	ErrorMessage    string        `json:"error_message" gorm:"type:text"`
	ReportContent   string        `json:"report_content" gorm:"type:longtext"`
	CreatedAt       time.Time     `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time     `json:"updated_at" gorm:"autoUpdateTime"`
}

func (r *ReplayRequest) TableName() string {
	return "replay_requests"
}

type ReplayTask struct {
	ID              int64     `json:"id" gorm:"primaryKey;autoIncrement"`
	RequestID       string    `json:"request_id" gorm:"index;size:64"`
	TrackingID      string    `json:"tracking_id" gorm:"index;size:64"`
	DeadLetterID    int64     `json:"dead_letter_id" gorm:"index"`
	MessageID       string    `json:"message_id" gorm:"size:64"`
	Sequence        int       `json:"sequence"`
	Status          string    `json:"status" gorm:"size:32;index"`
	Result          string    `json:"result" gorm:"type:text"`
	ErrorMessage    string    `json:"error_message" gorm:"type:text"`
	ExecutionTime   int64     `json:"execution_time"`
	StartTime       *time.Time `json:"start_time"`
	EndTime         *time.Time `json:"end_time"`
	CreatedAt       time.Time `json:"created_at" gorm:"autoCreateTime"`
	UpdatedAt       time.Time `json:"updated_at" gorm:"autoUpdateTime"`
}

func (t *ReplayTask) TableName() string {
	return "replay_tasks"
}

type ReplayResult struct {
	TrackingID    string        `json:"tracking_id"`
	MessageID     string        `json:"message_id"`
	Success       bool          `json:"success"`
	Status        MessageStatus `json:"status"`
	ErrorMessage  string        `json:"error_message"`
	ExecutionTime int64         `json:"execution_time"`
}
