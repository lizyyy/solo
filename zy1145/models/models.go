package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    string         `gorm:"uniqueIndex;not null" json:"user_id"`
	Username  string         `gorm:"not null" json:"username"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`
}

type RechargeAddress struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	UserID        string         `gorm:"index;not null" json:"user_id"`
	Address       string         `gorm:"uniqueIndex;not null" json:"address"`
	Index         int            `gorm:"not null" json:"index"`
	Status        string         `gorm:"default:active" json:"status"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type UTXO struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	TxID          string         `gorm:"index;not null" json:"tx_id"`
	OutputIndex   int            `gorm:"not null" json:"output_index"`
	Address       string         `gorm:"index;not null" json:"address"`
	Amount        int64          `gorm:"not null" json:"amount"`
	Confirmations int            `gorm:"default:0" json:"confirmations"`
	BlockHeight   int64          `json:"block_height"`
	Status        string         `gorm:"default:unspent" json:"status"`
	IsDust        bool           `gorm:"default:false" json:"is_dust"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type Transaction struct {
	ID            uint           `gorm:"primaryKey" json:"id"`
	TxID          string         `gorm:"uniqueIndex;not null" json:"tx_id"`
	BlockHeight   int64          `json:"block_height"`
	BlockHash     string         `json:"block_hash"`
	Confirmations int            `gorm:"default:0" json:"confirmations"`
	IsConfirmed   bool           `gorm:"default:false" json:"is_confirmed"`
	IsRBF         bool           `gorm:"default:false" json:"is_rbf"`
	HasDoubleSpend bool          `gorm:"default:false" json:"has_double_spend"`
	Status        string         `gorm:"default:pending" json:"status"`
	Fee           int64          `json:"fee"`
	RawTx         string         `json:"-"`
	CreatedAt     time.Time      `json:"created_at"`
	UpdatedAt     time.Time      `json:"updated_at"`
	DeletedAt     gorm.DeletedAt `gorm:"index" json:"-"`
}

type Block struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	Height      int64          `gorm:"uniqueIndex;not null" json:"height"`
	Hash        string         `gorm:"uniqueIndex;not null" json:"hash"`
	PrevHash    string         `json:"prev_hash"`
	Timestamp   time.Time      `json:"timestamp"`
	TxCount     int            `json:"tx_count"`
	IsReorged   bool           `gorm:"default:false" json:"is_reorged"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`
}

type CollectionPlan struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	PlanID          string         `gorm:"uniqueIndex;not null" json:"plan_id"`
	Status          string         `gorm:"default:pending" json:"status"`
	TotalAmount     int64          `json:"total_amount"`
	FeeAmount       int64          `json:"fee_amount"`
	HotWalletAmount int64          `json:"hot_wallet_amount"`
	ColdWalletAmount int64         `json:"cold_wallet_amount"`
	HotWalletAddress string        `json:"hot_wallet_address"`
	ColdWalletAddress string       `json:"cold_wallet_address"`
	UTXOs           string         `json:"utxos"`
	TxID            string         `json:"tx_id"`
	Confirmations   int            `gorm:"default:0" json:"confirmations"`
	IsConfirmed     bool           `gorm:"default:false" json:"is_confirmed"`
	NeedsAudit      bool           `gorm:"default:false" json:"needs_audit"`
	AuditStatus     string         `gorm:"default:pending" json:"audit_status"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type ManualAudit struct {
	ID              uint           `gorm:"primaryKey" json:"id"`
	AuditID         string         `gorm:"uniqueIndex;not null" json:"audit_id"`
	CollectionPlanID uint          `gorm:"index;not null" json:"collection_plan_id"`
	AuditorID       string         `gorm:"not null" json:"auditor_id"`
	AuditResult     string         `gorm:"not null" json:"audit_result"`
	Reason          string         `json:"reason"`
	AuditTime       time.Time      `json:"audit_time"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
	DeletedAt       gorm.DeletedAt `gorm:"index" json:"-"`
}

type AuditLog struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	LogID     string         `gorm:"uniqueIndex;not null" json:"log_id"`
	Action    string         `gorm:"not null" json:"action"`
	Resource  string         `gorm:"not null" json:"resource"`
	ResourceID string        `gorm:"not null" json:"resource_id"`
	UserID    string         `gorm:"not null" json:"user_id"`
	Details   string         `json:"details"`
	IPAddress string         `json:"ip_address"`
	CreatedAt time.Time      `json:"created_at"`
}

type WalletConfig struct {
	ID                uint           `gorm:"primaryKey" json:"id"`
	HotWalletAddress  string         `gorm:"not null" json:"hot_wallet_address"`
	ColdWalletAddress string         `gorm:"not null" json:"cold_wallet_address"`
	MaxHotBalance     int64          `gorm:"not null" json:"max_hot_balance"`
	MinColdBalance    int64          `gorm:"not null" json:"min_cold_balance"`
	ConfirmedBlocks   int            `gorm:"not null" json:"confirmed_blocks"`
	DustThreshold     int64          `gorm:"not null" json:"dust_threshold"`
	FeeRate           int64          `gorm:"not null" json:"fee_rate"`
	EnableZeroConf    bool           `gorm:"default:false" json:"enable_zero_conf"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}
