package model

import (
	"time"
)

type JobStatus string

const (
	JobStatusPending   JobStatus = "pending"
	JobStatusSigned    JobStatus = "signed"
	JobStatusVerified  JobStatus = "verified"
	JobStatusExpired   JobStatus = "expired"
	JobStatusRevoked   JobStatus = "revoked"
)

type JobBatch struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	BatchNo     string    `json:"batch_no" gorm:"uniqueIndex;size:128"`
	Creator     string    `json:"creator" gorm:"size:64"`
	TotalFiles  int       `json:"total_files"`
	Status      JobStatus `json:"status" gorm:"size:32;index"`
	ExpireAt    time.Time `json:"expire_at"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type ResultFile struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	BatchID     string    `json:"batch_id" gorm:"index;size:64"`
	FileIndex   int       `json:"file_index"`
	FileName    string    `json:"file_name" gorm:"size:256"`
	FileHash    string    `json:"file_hash" gorm:"size:128;index"`
	FileSize    int64     `json:"file_size"`
	FilePath    string    `json:"file_path" gorm:"size:512"`
	CreatedAt   time.Time `json:"created_at"`
}

type SignatureDigest struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	BatchID     string    `json:"batch_id" gorm:"uniqueIndex;size:64"`
	Algorithm   string    `json:"algorithm" gorm:"size:32"`
	Digest      string    `json:"digest" gorm:"size:512"`
	PublicKey   string    `json:"public_key" gorm:"type:text"`
	Signer      string    `json:"signer" gorm:"size:64"`
	SignedAt    time.Time `json:"signed_at"`
	CreatedAt   time.Time `json:"created_at"`
}

type Consumer struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	Name        string    `json:"name" gorm:"size:128"`
	AppKey      string    `json:"app_key" gorm:"uniqueIndex;size:64"`
	PublicKey   string    `json:"public_key" gorm:"type:text"`
	IsActive    bool      `json:"is_active"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type VerifyRecord struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	BatchID     string    `json:"batch_id" gorm:"index;size:64"`
	ConsumerID  string    `json:"consumer_id" gorm:"index;size:64"`
	VerifyResult bool     `json:"verify_result"`
	ErrorMessage string   `json:"error_message" gorm:"size:512"`
	VerifyAt    time.Time `json:"verify_at"`
	ClientIP    string    `json:"client_ip" gorm:"size:64"`
}

type ExpireStrategy struct {
	ID          string    `json:"id" gorm:"primaryKey;size:64"`
	BatchID     string    `json:"batch_id" gorm:"uniqueIndex;size:64"`
	StrategyType string   `json:"strategy_type" gorm:"size:32"`
	ExpireDays  int       `json:"expire_days"`
	MaxVerifyCount int    `json:"max_verify_count"`
	CurrentVerifyCount int `json:"current_verify_count"`
	CreatedAt   time.Time `json:"created_at"`
}
