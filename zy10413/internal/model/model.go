package model

import (
	"time"
)

type TokenStatus string

const (
	TokenStatusActive    TokenStatus = "ACTIVE"
	TokenStatusInactive  TokenStatus = "INACTIVE"
	TokenStatusExpired   TokenStatus = "EXPIRED"
	TokenStatusUnsubscribed TokenStatus = "UNSUBSCRIBED"
	TokenStatusRebound   TokenStatus = "REBOUND"
)

type Platform string

const (
	PlatformiOS     Platform = "iOS"
	PlatformAndroid Platform = "Android"
	PlatformHarmony Platform = "Harmony"
)

type FailureReason string

const (
	FailureReasonInvalidToken FailureReason = "INVALID_TOKEN"
	FailureReasonUnregistered FailureReason = "UNREGISTERED"
	FailureReasonMismatched   FailureReason = "MISMATCHED"
	FailureReasonRateLimit    FailureReason = "RATE_LIMIT"
	FailureReasonUnknown      FailureReason = "UNKNOWN"
)

type Device struct {
	ID          string    `json:"id" db:"id"`
	UserID      string    `json:"user_id" db:"user_id"`
	DeviceID    string    `json:"device_id" db:"device_id"`
	Platform    Platform  `json:"platform" db:"platform"`
	DeviceName  string    `json:"device_name" db:"device_name"`
	AppVersion  string    `json:"app_version" db:"app_version"`
	OSVersion   string    `json:"os_version" db:"os_version"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type PushToken struct {
	ID            string      `json:"id" db:"id"`
	Token         string      `json:"token" db:"token"`
	UserID        string      `json:"user_id" db:"user_id"`
	DeviceID      string      `json:"device_id" db:"device_id"`
	Platform      Platform    `json:"platform" db:"platform"`
	Status        TokenStatus `json:"status" db:"status"`
	BindCount     int         `json:"bind_count" db:"bind_count"`
	LastBindAt    time.Time   `json:"last_bind_at" db:"last_bind_at"`
	LastPushAt    *time.Time  `json:"last_push_at" db:"last_push_at"`
	ExpireAt      *time.Time  `json:"expire_at" db:"expire_at"`
	CreatedAt     time.Time   `json:"created_at" db:"created_at"`
	UpdatedAt     time.Time   `json:"updated_at" db:"updated_at"`
}

type BindEvent struct {
	ID         string    `json:"id" db:"id"`
	TokenID    string    `json:"token_id" db:"token_id"`
	UserID     string    `json:"user_id" db:"user_id"`
	DeviceID   string    `json:"device_id" db:"device_id"`
	PreviousUserID *string `json:"previous_user_id" db:"previous_user_id"`
	PreviousDeviceID *string `json:"previous_device_id" db:"previous_device_id"`
	BindType   string    `json:"bind_type" db:"bind_type"`
	CreatedAt  time.Time `json:"created_at" db:"created_at"`
}

type UnsubscribeEvent struct {
	ID          string    `json:"id" db:"id"`
	TokenID     string    `json:"token_id" db:"token_id"`
	UserID      string    `json:"user_id" db:"user_id"`
	DeviceID    string    `json:"device_id" db:"device_id"`
	Reason      string    `json:"reason" db:"reason"`
	Channel     string    `json:"channel" db:"channel"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
}

type PushReceipt struct {
	ID            string        `json:"id" db:"id"`
	TokenID       string        `json:"token_id" db:"token_id"`
	PushID        string        `json:"push_id" db:"push_id"`
	Success       bool          `json:"success" db:"success"`
	FailureReason FailureReason `json:"failure_reason" db:"failure_reason"`
	ErrorMessage  string        `json:"error_message" db:"error_message"`
	RawResponse   string        `json:"raw_response" db:"raw_response"`
	SentAt        time.Time     `json:"sent_at" db:"sent_at"`
	ReceivedAt    *time.Time    `json:"received_at" db:"received_at"`
	CreatedAt     time.Time     `json:"created_at" db:"created_at"`
}

type LifecycleReport struct {
	TokenID       string    `json:"token_id" db:"token_id"`
	Token         string    `json:"token" db:"token"`
	UserID        string    `json:"user_id" db:"user_id"`
	DeviceID      string    `json:"device_id" db:"device_id"`
	Status        TokenStatus `json:"status" db:"status"`
	TotalBinds    int       `json:"total_binds" db:"total_binds"`
	TotalPushes   int       `json:"total_pushes" db:"total_pushes"`
	SuccessPushes int       `json:"success_pushes" db:"success_pushes"`
	FailedPushes  int       `json:"failed_pushes" db:"failed_pushes"`
	LastFailureAt *time.Time `json:"last_failure_at" db:"last_failure_at"`
	LastFailureReason FailureReason `json:"last_failure_reason" db:"last_failure_reason"`
	IsUnsubscribed bool     `json:"is_unsubscribed" db:"is_unsubscribed"`
	IsRebound     bool      `json:"is_rebound" db:"is_rebound"`
	GeneratedAt   time.Time `json:"generated_at" db:"generated_at"`
}

type TokenLifecycleRequest struct {
	Token     string   `json:"token" validate:"required"`
	UserID    string   `json:"user_id" validate:"required"`
	DeviceID  string   `json:"device_id" validate:"required"`
	Platform  Platform `json:"platform" validate:"required"`
	DeviceName string  `json:"device_name"`
	AppVersion string  `json:"app_version"`
	OSVersion  string  `json:"os_version"`
}

type PushReceiptRequest struct {
	PushID        string        `json:"push_id" validate:"required"`
	Token         string        `json:"token" validate:"required"`
	Success       bool          `json:"success"`
	FailureReason FailureReason `json:"failure_reason"`
	ErrorMessage  string        `json:"error_message"`
	RawResponse   string        `json:"raw_response"`
	SentAt        time.Time     `json:"sent_at"`
}

type ManualCorrectionRequest struct {
	TokenID     string      `json:"token_id" validate:"required"`
	NewStatus   TokenStatus `json:"new_status" validate:"required"`
	Reason      string      `json:"reason" validate:"required"`
	OperatorID  string      `json:"operator_id"`
}
