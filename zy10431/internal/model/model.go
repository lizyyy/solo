package model

import (
	"time"
)

type Status string

const (
	StatusActive   Status = "active"
	StatusInactive Status = "inactive"
	StatusPending  Status = "pending"
	StatusRejected Status = "rejected"
)

type Consumer struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	QueueName     string    `json:"queue_name" gorm:"index;not null"`
	ConsumerGroup string    `json:"consumer_group" gorm:"index;not null"`
	ProcessScope  string    `json:"process_scope" gorm:"not null"`
	Owner         string    `json:"owner" gorm:"not null"`
	OwnerEmail    string    `json:"owner_email"`
	Status        Status    `json:"status" gorm:"index;default:active"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`
}

type TransferRecord struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	ConsumerID    uint      `json:"consumer_id" gorm:"index;not null"`
	FromOwner     string    `json:"from_owner" gorm:"not null"`
	ToOwner       string    `json:"to_owner" gorm:"not null"`
	FromEmail     string    `json:"from_email"`
	ToEmail       string    `json:"to_email"`
	TransferReason string   `json:"transfer_reason"`
	TransferredAt time.Time `json:"transferred_at"`
	CreatedAt     time.Time `json:"created_at"`
}

type OwnershipReport struct {
	ID              uint      `json:"id" gorm:"primaryKey"`
	ReportDate      time.Time `json:"report_date" gorm:"index"`
	QueueName       string    `json:"queue_name" gorm:"index"`
	TotalConsumers  int       `json:"total_consumers"`
	ActiveConsumers int       `json:"active_consumers"`
	OwnerCount      int       `json:"owner_count"`
	ConflictCount   int       `json:"conflict_count"`
	GeneratedAt     time.Time `json:"generated_at"`
}

type ErrorRecord struct {
	ID            uint      `json:"id" gorm:"primaryKey"`
	RequestPath   string    `json:"request_path"`
	RequestMethod string    `json:"request_method"`
	RawInput      string    `json:"raw_input" gorm:"type:text"`
	ErrorMsg      string    `json:"error_msg" gorm:"type:text"`
	Conclusion    string    `json:"conclusion" gorm:"type:text"`
	Handled       bool      `json:"handled" gorm:"default:false"`
	CreatedAt     time.Time `json:"created_at"`
}
