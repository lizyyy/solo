package model

import (
	"time"
)

type PaymentStatus string

const (
	StatusPending    PaymentStatus = "PENDING"
	StatusProcessing PaymentStatus = "PROCESSING"
	StatusSuccess    PaymentStatus = "SUCCESS"
	StatusFailed     PaymentStatus = "FAILED"
	StatusCancelling PaymentStatus = "CANCELLING"
	StatusCancelled  PaymentStatus = "CANCELLED"
	StatusUnknown    PaymentStatus = "UNKNOWN"
)

type ReceiverAccount struct {
	ID           int64     `json:"id" db:"id"`
	BankName     string    `json:"bank_name" db:"bank_name"`
	AccountNo    string    `json:"account_no" db:"account_no"`
	AccountName  string    `json:"account_name" db:"account_name"`
	BankBranch   string    `json:"bank_branch,omitempty" db:"bank_branch"`
	Province     string    `json:"province,omitempty" db:"province"`
	City         string    `json:"city,omitempty" db:"city"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	UpdatedAt    time.Time `json:"updated_at" db:"updated_at"`
}

type IdempotentKey struct {
	ID           int64     `json:"id" db:"id"`
	IdempotentKey string   `json:"idempotent_key" db:"idempotent_key"`
	PaymentID    int64     `json:"payment_id" db:"payment_id"`
	CreatedAt    time.Time `json:"created_at" db:"created_at"`
	ExpiredAt    time.Time `json:"expired_at" db:"expired_at"`
}

type PaymentInstruction struct {
	ID               int64         `json:"id" db:"id"`
	PaymentNo        string        `json:"payment_no" db:"payment_no"`
	IdempotentKey    string        `json:"idempotent_key" db:"idempotent_key"`
	MerchantID       string        `json:"merchant_id" db:"merchant_id"`
	Amount           int64         `json:"amount" db:"amount"`
	Currency         string        `json:"currency" db:"currency"`
	ReceiverAccountID int64        `json:"receiver_account_id" db:"receiver_account_id"`
	ReceiverAccount  *ReceiverAccount `json:"receiver_account,omitempty" db:"-"`
	Status           PaymentStatus `json:"status" db:"status"`
	Channel          string        `json:"channel" db:"channel"`
	ChannelOrderNo   string        `json:"channel_order_no,omitempty" db:"channel_order_no"`
	Remark           string        `json:"remark,omitempty" db:"remark"`
	NotifyURL        string        `json:"notify_url,omitempty" db:"notify_url"`
	CreatedAt        time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at" db:"updated_at"`
}

type ChannelReceipt struct {
	ID              int64         `json:"id" db:"id"`
	PaymentID       int64         `json:"payment_id" db:"payment_id"`
	PaymentNo       string        `json:"payment_no" db:"payment_no"`
	Channel         string        `json:"channel" db:"channel"`
	ChannelOrderNo  string        `json:"channel_order_no" db:"channel_order_no"`
	ChannelStatus   string        `json:"channel_status" db:"channel_status"`
	ReceiptContent  string        `json:"receipt_content,omitempty" db:"receipt_content"`
	IsSuccess       bool          `json:"is_success" db:"is_success"`
	ResponseTime    time.Time     `json:"response_time" db:"response_time"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
}

type CancelApplication struct {
	ID              int64         `json:"id" db:"id"`
	PaymentID       int64         `json:"payment_id" db:"payment_id"`
	PaymentNo       string        `json:"payment_no" db:"payment_no"`
	CancelReason    string        `json:"cancel_reason" db:"cancel_reason"`
	CancelStatus    PaymentStatus `json:"cancel_status" db:"cancel_status"`
	ChannelCancelNo string        `json:"channel_cancel_no,omitempty" db:"channel_cancel_no"`
	CreatedAt       time.Time     `json:"created_at" db:"created_at"`
	UpdatedAt       time.Time     `json:"updated_at" db:"updated_at"`
}

type TimelineEvent struct {
	ID          int64       `json:"id" db:"id"`
	PaymentID   int64       `json:"payment_id" db:"payment_id"`
	PaymentNo   string      `json:"payment_no" db:"payment_no"`
	EventType   string      `json:"event_type" db:"event_type"`
	EventStatus string      `json:"event_status" db:"event_status"`
	Content     string      `json:"content,omitempty" db:"content"`
	Operator    string      `json:"operator,omitempty" db:"operator"`
	IPAddress   string      `json:"ip_address,omitempty" db:"ip_address"`
	CreatedAt   time.Time   `json:"created_at" db:"created_at"`
}

type ProblemSummary struct {
	PaymentNo       string           `json:"payment_no"`
	IdempotentKey   string           `json:"idempotent_key"`
	Status          PaymentStatus    `json:"status"`
	TotalAmount     int64            `json:"total_amount"`
	Currency        string           `json:"currency"`
	Channel         string           `json:"channel"`
	CreatedAt       time.Time        `json:"created_at"`
	LastUpdatedAt   time.Time        `json:"last_updated_at"`
	TimelineEvents  []*TimelineEvent `json:"timeline_events"`
	ChannelReceipts []*ChannelReceipt `json:"channel_receipts"`
	CancelInfo      *CancelApplication `json:"cancel_info,omitempty"`
	DurationSeconds float64          `json:"duration_seconds"`
	IsProblematic   bool             `json:"is_problematic"`
	ProblemDesc     string           `json:"problem_desc,omitempty"`
}
