package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

type Queue struct {
	ID               int64
	Name             string
	Description      string
	RetryStrategy    string
	RetryDelaySeconds int
	MaxDelaySeconds  int
	VisibilityTimeoutSeconds int
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type MessageStatus string

const (
	StatusPending    MessageStatus = "pending"
	StatusReady      MessageStatus = "ready"
	StatusReserved   MessageStatus = "reserved"
	StatusDead       MessageStatus = "dead"
	StatusSucceeded  MessageStatus = "succeeded"
	StatusFailed     MessageStatus = "failed"
)

type Message struct {
	ID               int64
	QueueID          int64
	QueueName        string
	Body             string
	Priority         int
	DelaySeconds     int
	MaxAttempts      int
	Attempts         int
	IdempotencyKey   sql.NullString
	Metadata         json.RawMessage
	Status           MessageStatus
	ReservedBy       sql.NullString
	ReservedAt       sql.NullTime
	VisibleAt        time.Time
	DeadReason       sql.NullString
	LastError        sql.NullString
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

type AuditLog struct {
	ID               int64
	MessageID        int64
	Action           string
	OldStatus        sql.NullString
	NewStatus        string
	AttemptNumber    int
	ErrorReason      sql.NullString
	CreatedAt        time.Time
}

type QueueStats struct {
	QueueName        string
	Total            int64
	Pending          int64
	Ready            int64
	Reserved         int64
	Succeeded        int64
	Failed           int64
	Dead             int64
}

type EnqueueRequest struct {
	QueueName        string          `json:"queue_name"`
	Body             string          `json:"body"`
	Priority         int             `json:"priority"`
	DelaySeconds     int             `json:"delay_seconds"`
	MaxAttempts      int             `json:"max_attempts"`
	IdempotencyKey   *string         `json:"idempotency_key"`
	Metadata         json.RawMessage `json:"metadata"`
}

type ReserveRequest struct {
	QueueName        string `json:"queue_name"`
	WorkerID         string `json:"worker_id"`
	Limit            int    `json:"limit"`
}

type MessageResponse struct {
	ID               int64           `json:"id"`
	QueueName        string          `json:"queue_name"`
	Body             string          `json:"body"`
	Priority         int             `json:"priority"`
	Attempts         int             `json:"attempts"`
	MaxAttempts      int             `json:"max_attempts"`
	IdempotencyKey   *string         `json:"idempotency_key,omitempty"`
	Metadata         json.RawMessage `json:"metadata,omitempty"`
	Status           MessageStatus   `json:"status"`
	ReservedBy       *string         `json:"reserved_by,omitempty"`
	ReservedAt       *time.Time      `json:"reserved_at,omitempty"`
	VisibleAt        time.Time       `json:"visible_at"`
	DeadReason       *string         `json:"dead_reason,omitempty"`
	LastError        *string         `json:"last_error,omitempty"`
	CreatedAt        time.Time       `json:"created_at"`
}

type AckRequest struct {
	MessageID        int64  `json:"message_id"`
	WorkerID         string `json:"worker_id"`
}

type NackRequest struct {
	MessageID        int64   `json:"message_id"`
	WorkerID         string  `json:"worker_id"`
	ErrorReason      *string `json:"error_reason"`
	ForceRetry       bool    `json:"force_retry"`
}

type ExtendLeaseRequest struct {
	MessageID        int64 `json:"message_id"`
	WorkerID         string `json:"worker_id"`
	Seconds          int    `json:"seconds"`
}

type ReplayDeadLetterRequest struct {
	QueueName        string   `json:"queue_name"`
	DeadReasons      []string `json:"dead_reasons,omitempty"`
	MessageIDs       []int64  `json:"message_ids,omitempty"`
	NewDelaySeconds  *int     `json:"new_delay_seconds,omitempty"`
}

type CreateQueueRequest struct {
	Name                    string `json:"name"`
	Description             string `json:"description"`
	RetryStrategy           string `json:"retry_strategy"`
	RetryDelaySeconds       int    `json:"retry_delay_seconds"`
	MaxDelaySeconds         int    `json:"max_delay_seconds"`
	VisibilityTimeoutSeconds int   `json:"visibility_timeout_seconds"`
}
