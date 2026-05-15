package model

import (
	"time"
)

type SessionStatus string

const (
	SessionStatusActive   SessionStatus = "active"
	SessionStatusPaused   SessionStatus = "paused"
	SessionStatusClosed   SessionStatus = "closed"
	SessionStatusRevoked  SessionStatus = "revoked"
	SessionStatusExpired  SessionStatus = "expired"
)

type Session struct {
	ID             string        `json:"id"`
	ClientID       string        `json:"client_id"`
	UserID         string        `json:"user_id,omitempty"`
	Status         SessionStatus `json:"status"`
	Cursor         int64         `json:"cursor"`
	LastAckCursor  int64         `json:"last_ack_cursor"`
	ReconnectCount int           `json:"reconnect_count"`
	MaxReconnect   int           `json:"max_reconnect"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	LastActiveAt   time.Time     `json:"last_active_at"`
	ExpiresAt      time.Time     `json:"expires_at"`
	LastDisconnect *Disconnect   `json:"last_disconnect,omitempty"`
	Metadata       map[string]any `json:"metadata,omitempty"`
}

type Disconnect struct {
	Reason    DisconnectReason `json:"reason"`
	Message   string           `json:"message,omitempty"`
	Time      time.Time        `json:"time"`
	Reconnect bool             `json:"reconnect"`
}

type DisconnectReason string

const (
	DisconnectReasonClientInitiated DisconnectReason = "client_initiated"
	DisconnectReasonTimeout         DisconnectReason = "timeout"
	DisconnectReasonServerInitiated DisconnectReason = "server_initiated"
	DisconnectReasonError           DisconnectReason = "error"
	DisconnectReasonMaxRetryExceeded DisconnectReason = "max_retry_exceeded"
)

type CreateSessionRequest struct {
	ClientID     string         `json:"client_id" validate:"required"`
	UserID       string         `json:"user_id,omitempty"`
	MaxReconnect int            `json:"max_reconnect,omitempty"`
	TTLSeconds   int            `json:"ttl_seconds,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
	IdempotencyKey string       `json:"idempotency_key,omitempty"`
}

type CreateSessionResponse struct {
	SessionID string    `json:"session_id"`
	Session   *Session  `json:"session"`
	Created   bool      `json:"created"`
}
