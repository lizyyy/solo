package model

import (
	"time"
)

type SessionQueryRequest struct {
	SessionID   string        `json:"session_id,omitempty"`
	ClientID    string        `json:"client_id,omitempty"`
	UserID      string        `json:"user_id,omitempty"`
	Status      SessionStatus `json:"status,omitempty"`
	CursorStart int64         `json:"cursor_start,omitempty"`
	CursorEnd   int64         `json:"cursor_end,omitempty"`
	TimeStart   *time.Time    `json:"time_start,omitempty"`
	TimeEnd     *time.Time    `json:"time_end,omitempty"`
	Page        int           `json:"page,omitempty"`
	PageSize    int           `json:"page_size,omitempty"`
}

type SessionQueryResponse struct {
	Sessions   []*Session `json:"sessions"`
	Total      int64      `json:"total"`
	Page       int        `json:"page"`
	PageSize   int        `json:"page_size"`
}

type MessageQueryRequest struct {
	SessionID    string         `json:"session_id,omitempty"`
	Status       MessageStatus  `json:"status,omitempty"`
	CursorStart  int64          `json:"cursor_start,omitempty"`
	CursorEnd    int64          `json:"cursor_end,omitempty"`
	CreatedStart *time.Time     `json:"created_start,omitempty"`
	CreatedEnd   *time.Time     `json:"created_end,omitempty"`
	Page         int            `json:"page,omitempty"`
	PageSize     int            `json:"page_size,omitempty"`
}

type MessageQueryResponse struct {
	Messages []*Message `json:"messages"`
	Total    int64      `json:"total"`
	Page     int        `json:"page"`
	PageSize int        `json:"page_size"`
}

type ExportRequest struct {
	SessionID    string         `json:"session_id,omitempty"`
	ClientID     string         `json:"client_id,omitempty"`
	Format       ExportFormat   `json:"format,omitempty"`
	CursorStart  int64          `json:"cursor_start,omitempty"`
	CursorEnd    int64          `json:"cursor_end,omitempty"`
	IncludeAcked bool           `json:"include_acked,omitempty"`
}

type ExportFormat string

const (
	ExportFormatJSON ExportFormat = "json"
	ExportFormatCSV  ExportFormat = "csv"
)

type ExportResponse struct {
	Session       *Session     `json:"session,omitempty"`
	Messages      []*Message   `json:"messages"`
	Receipts      []*DeliveryReceipt `json:"receipts,omitempty"`
	ExportedAt    time.Time    `json:"exported_at"`
	MessageCount  int          `json:"message_count"`
}

type RevokeSessionRequest struct {
	SessionID string `json:"session_id" validate:"required"`
	Reason    string `json:"reason,omitempty"`
}

type RevokeSessionResponse struct {
	SessionID string `json:"session_id"`
	Success   bool   `json:"success"`
}

type AdvanceRequest struct {
	SessionID   string        `json:"session_id" validate:"required"`
	NewStatus   SessionStatus `json:"new_status,omitempty"`
	Reason      string        `json:"reason,omitempty"`
	ExtendTTL   int           `json:"extend_ttl,omitempty"`
}

type AdvanceResponse struct {
	Session *Session `json:"session"`
}
