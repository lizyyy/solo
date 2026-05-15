package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type BaseModel struct {
	ID        string    `gorm:"type:varchar(36);primaryKey" json:"id"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == "" {
		b.ID = uuid.New().String()
	}
	return nil
}

type SubscriptionTopic struct {
	BaseModel
	Name        string `gorm:"type:varchar(100);uniqueIndex;not null" json:"name"`
	Description string `gorm:"type:text" json:"description"`
	Enabled     bool   `gorm:"default:true" json:"enabled"`
}

type BusinessObject struct {
	BaseModel
	Type        string `gorm:"type:varchar(50);not null" json:"type"`
	Identifier  string `gorm:"type:varchar(100);not null" json:"identifier"`
	DisplayName string `gorm:"type:varchar(200)" json:"display_name"`
	Metadata    string `gorm:"type:text" json:"metadata"`
}

type Subscription struct {
	BaseModel
	TopicID       string `gorm:"type:varchar(36);index;not null" json:"topic_id"`
	BusinessID    string `gorm:"type:varchar(36);index;not null" json:"business_id"`
	SubscriberID  string `gorm:"type:varchar(100);not null" json:"subscriber_id"`
	Subscriber    string `gorm:"type:varchar(200)" json:"subscriber"`
	Enabled       bool   `gorm:"default:true" json:"enabled"`
	FilterExpr    string `gorm:"type:text" json:"filter_expr"`
	IdempotentKey string `gorm:"type:varchar(100);uniqueIndex;not null" json:"idempotent_key"`
}

type DeliveryPreference struct {
	BaseModel
	SubscriptionID string `gorm:"type:varchar(36);uniqueIndex;not null" json:"subscription_id"`
	Endpoint       string `gorm:"type:varchar(500);not null" json:"endpoint"`
	Method         string `gorm:"type:varchar(10);default:'POST'" json:"method"`
	Headers        string `gorm:"type:text" json:"headers"`
	Timeout        int    `gorm:"default:30" json:"timeout"`
	RetryCount     int    `gorm:"default:3" json:"retry_count"`
	RetryInterval  int    `gorm:"default:60" json:"retry_interval"`
}

type StatusChange struct {
	BaseModel
	BusinessID    string `gorm:"type:varchar(36);index;not null" json:"business_id"`
	TopicID       string `gorm:"type:varchar(36);index;not null" json:"topic_id"`
	FromStatus    string `gorm:"type:varchar(50)" json:"from_status"`
	ToStatus      string `gorm:"type:varchar(50);not null" json:"to_status"`
	ChangeReason  string `gorm:"type:text" json:"change_reason"`
	OperatorID    string `gorm:"type:varchar(100)" json:"operator_id"`
	OperatorName  string `gorm:"type:varchar(200)" json:"operator_name"`
	IdempotentKey string `gorm:"type:varchar(100);uniqueIndex" json:"idempotent_key"`
}

type DeliveryRecord struct {
	BaseModel
	StatusChangeID string    `gorm:"type:varchar(36);index;not null" json:"status_change_id"`
	SubscriptionID string    `gorm:"type:varchar(36);index;not null" json:"subscription_id"`
	Endpoint       string    `gorm:"type:varchar(500);not null" json:"endpoint"`
	AttemptCount   int       `gorm:"default:0" json:"attempt_count"`
	Status         string    `gorm:"type:varchar(20);index;not null" json:"status"`
	LastAttemptAt  time.Time `json:"last_attempt_at"`
	NextAttemptAt  time.Time `json:"next_attempt_at"`
	ResponseCode   int       `json:"response_code"`
	ResponseBody   string    `gorm:"type:text" json:"response_body"`
	ErrorMessage   string    `gorm:"type:text" json:"error_message"`
}

type SubscriptionSnapshot struct {
	BaseModel
	SubscriptionID string    `gorm:"type:varchar(36);index;not null" json:"subscription_id"`
	TopicID        string    `gorm:"type:varchar(36);not null" json:"topic_id"`
	BusinessID     string    `gorm:"type:varchar(36);not null" json:"business_id"`
	SnapshotAt     time.Time `gorm:"index;not null" json:"snapshot_at"`
	SnapshotData   string    `gorm:"type:text;not null" json:"snapshot_data"`
	Conclusion     string    `gorm:"type:text" json:"conclusion"`
}

const (
	DeliveryStatusPending  = "pending"
	DeliveryStatusSuccess  = "success"
	DeliveryStatusFailed   = "failed"
	DeliveryStatusRetrying = "retrying"
)

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type CreateSubscriptionRequest struct {
	TopicName     string            `json:"topic_name" binding:"required"`
	BusinessType  string            `json:"business_type" binding:"required"`
	BusinessID    string            `json:"business_id" binding:"required"`
	SubscriberID  string            `json:"subscriber_id" binding:"required"`
	Subscriber    string            `json:"subscriber"`
	FilterExpr    string            `json:"filter_expr"`
	Endpoint      string            `json:"endpoint" binding:"required"`
	Method        string            `json:"method"`
	Headers       map[string]string `json:"headers"`
	Timeout       int               `json:"timeout"`
	RetryCount    int               `json:"retry_count"`
	RetryInterval int               `json:"retry_interval"`
	IdempotentKey string            `json:"idempotent_key" binding:"required"`
}

type StatusChangeRequest struct {
	BusinessType  string `json:"business_type" binding:"required"`
	BusinessID    string `json:"business_id" binding:"required"`
	TopicName     string `json:"topic_name" binding:"required"`
	FromStatus    string `json:"from_status"`
	ToStatus      string `json:"to_status" binding:"required"`
	ChangeReason  string `json:"change_reason"`
	OperatorID    string `json:"operator_id"`
	OperatorName  string `json:"operator_name"`
	IdempotentKey string `json:"idempotent_key" binding:"required"`
}

type QueryHistoryRequest struct {
	BusinessType string `json:"business_type"`
	BusinessID   string `json:"business_id"`
	TopicName    string `json:"topic_name"`
	StartTime    string `json:"start_time"`
	EndTime      string `json:"end_time"`
	Page         int    `json:"page"`
	PageSize     int    `json:"page_size"`
}
