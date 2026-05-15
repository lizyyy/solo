package model

import (
	"time"
)

type MessageStatus string

const (
	MessageStatusPending   MessageStatus = "pending"
	MessageStatusDelivered MessageStatus = "delivered"
	MessageStatusAcked     MessageStatus = "acked"
	MessageStatusFailed    MessageStatus = "failed"
)

type Message struct {
	ID          string        `json:"id"`
	SessionID   string        `json:"session_id"`
	Cursor      int64         `json:"cursor"`
	Payload     any           `json:"payload"`
	Status      MessageStatus `json:"status"`
	Priority    int           `json:"priority,omitempty"`
	Type        string        `json:"type,omitempty"`
	CreatedAt   time.Time     `json:"created_at"`
	DeliveredAt *time.Time    `json:"delivered_at,omitempty"`
	AckedAt     *time.Time    `json:"acked_at,omitempty"`
	DeliveryCount int         `json:"delivery_count"`
	MaxDelivery int           `json:"max_delivery"`
}

type DeliveryReceipt struct {
	ID           string    `json:"id"`
	SessionID    string    `json:"session_id"`
	MessageID    string    `json:"message_id"`
	Cursor       int64     `json:"cursor"`
	ReceivedAt   time.Time `json:"received_at"`
	ClientIP     string    `json:"client_ip,omitempty"`
	UserAgent    string    `json:"user_agent,omitempty"`
	IsDuplicate  bool      `json:"is_duplicate"`
}

type PollRequest struct {
	SessionID    string `json:"session_id" validate:"required"`
	LastCursor   int64  `json:"last_cursor,omitempty"`
	WaitTimeout  int    `json:"wait_timeout,omitempty"`
	BatchSize    int    `json:"batch_size,omitempty"`
}

type PollResponse struct {
	Messages []*Message `json:"messages"`
	Cursor   int64      `json:"cursor"`
	HasMore  bool       `json:"has_more"`
}

type AckRequest struct {
	SessionID string   `json:"session_id" validate:"required"`
	Cursors   []int64  `json:"cursors" validate:"required"`
}

type AckResponse struct {
	AckedCount int     `json:"acked_count"`
	NewCursor  int64   `json:"new_cursor"`
}

type PushMessageRequest struct {
	SessionID   string `json:"session_id" validate:"required"`
	Payload     any    `json:"payload" validate:"required"`
	Type        string `json:"type,omitempty"`
	Priority    int    `json:"priority,omitempty"`
	MaxDelivery int    `json:"max_delivery,omitempty"`
}

type PushMessageResponse struct {
	MessageID string `json:"message_id"`
	Cursor    int64  `json:"cursor"`
}
