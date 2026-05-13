package model

import (
	"time"
)

type NotificationStatus string

const (
	StatusPending   NotificationStatus = "pending"
	StatusAllowed   NotificationStatus = "allowed"
	StatusSkipped   NotificationStatus = "skipped"
	StatusSent      NotificationStatus = "sent"
	StatusFailed    NotificationStatus = "failed"
)

type SkipReason string

const (
	ReasonDuplicateInWindow SkipReason = "duplicate_in_window"
	ReasonInvalidCredential SkipReason = "invalid_credential"
	ReasonRateLimitExceeded SkipReason = "rate_limit_exceeded"
)

type UserIdentifier struct {
	UserID    string `json:"user_id"`
	DeviceID  string `json:"device_id,omitempty"`
	Email     string `json:"email,omitempty"`
	Phone     string `json:"phone,omitempty"`
}

func (u *UserIdentifier) Hash() string {
	return u.UserID + "|" + u.DeviceID + "|" + u.Email + "|" + u.Phone
}

type DedupWindow struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	Scene     string    `gorm:"uniqueIndex:idx_scene_window" json:"scene"`
	WindowKey string    `gorm:"uniqueIndex:idx_scene_window" json:"window_key"`
	Duration  int64     `json:"duration"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type BusinessScene struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	Scene       string    `gorm:"uniqueIndex" json:"scene"`
	Description string    `json:"description"`
	DefaultWindow int64  `json:"default_window"`
	Enabled     bool      `json:"enabled"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type SendCredential struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Credential string    `gorm:"uniqueIndex" json:"credential"`
	Scene      string    `json:"scene"`
	UserHash   string    `json:"user_hash"`
	ExpiresAt  time.Time `json:"expires_at"`
	Used       bool      `json:"used"`
	CreatedAt  time.Time `json:"created_at"`
}

type NotificationRequest struct {
	ID            uint               `gorm:"primaryKey" json:"id"`
	RequestID     string             `gorm:"uniqueIndex" json:"request_id"`
	Scene         string             `json:"scene"`
	UserIdentifier UserIdentifier    `gorm:"embedded;embeddedPrefix:user_" json:"user"`
	UserHash      string             `gorm:"index" json:"user_hash"`
	Content       string             `json:"content"`
	DedupWindow   int64              `json:"dedup_window"`
	Credential    string             `json:"credential,omitempty"`
	Status        NotificationStatus `gorm:"index" json:"status"`
	SkipReason    SkipReason         `json:"skip_reason,omitempty"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

type SkipRecord struct {
	ID            uint         `gorm:"primaryKey" json:"id"`
	RequestID     string       `gorm:"index" json:"request_id"`
	Scene         string       `json:"scene"`
	UserHash      string       `gorm:"index" json:"user_hash"`
	SkipReason    SkipReason   `json:"skip_reason"`
	OriginalReqID string       `json:"original_req_id,omitempty"`
	WindowStart   time.Time    `json:"window_start"`
	WindowEnd     time.Time    `json:"window_end"`
	CreatedAt     time.Time    `json:"created_at"`
}

type Statistics struct {
	Scene          string `json:"scene"`
	TotalRequests  int64  `json:"total_requests"`
	AllowedCount   int64  `json:"allowed_count"`
	SkippedCount   int64  `json:"skipped_count"`
	SentCount      int64  `json:"sent_count"`
	FailedCount    int64  `json:"failed_count"`
	DuplicateRate  float64 `json:"duplicate_rate"`
}
