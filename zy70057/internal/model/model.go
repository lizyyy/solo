package model

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
)

type JSONStringArray []string

func (a JSONStringArray) Value() (driver.Value, error) {
	return json.Marshal(a)
}

func (a *JSONStringArray) Scan(value interface{}) error {
	if value == nil {
		*a = nil
		return nil
	}
	b, ok := value.([]byte)
	if !ok {
		return errors.New("failed to unmarshal JSONStringArray: not []byte")
	}
	return json.Unmarshal(b, a)
}

type NullableString struct {
	sql.NullString
}

func (ns NullableString) MarshalJSON() ([]byte, error) {
	if !ns.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(ns.String)
}

func (ns *NullableString) UnmarshalJSON(data []byte) error {
	if string(data) == "null" {
		ns.Valid = false
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	ns.String = s
	ns.Valid = true
	return nil
}

type Account struct {
	ID          string         `db:"id" json:"id"`
	Code        string         `db:"code" json:"code"`
	Name        string         `db:"name" json:"name"`
	ParentID    NullableString `db:"parent_id" json:"parent_id"`
	Level       int            `db:"level" json:"level"`
	CompanyType string         `db:"company_type" json:"company_type"`
	Status      string         `db:"status" json:"status"`
	CreatedAt   time.Time      `db:"created_at" json:"created_at"`
	UpdatedAt   time.Time      `db:"updated_at" json:"updated_at"`
}

func (a *Account) GetParentID() string {
	if a.ParentID.Valid {
		return a.ParentID.String
	}
	return ""
}

func (a *Account) HasParent() bool {
	return a.ParentID.Valid
}

type AggregationTask struct {
	ID             string    `db:"id" json:"id"`
	TaskDate       string    `db:"task_date" json:"task_date"`
	IDEMPOTENCYKEY string    `db:"idempotency_key" json:"idempotency_key"`
	SourceAccount  string    `db:"source_account" json:"source_account"`
	TargetAccount  string    `db:"target_account" json:"target_account"`
	Amount         int64     `db:"amount" json:"amount"`
	Status         string    `db:"status" json:"status"`
	RetryCount     int       `db:"retry_count" json:"retry_count"`
	MaxRetries     int       `db:"max_retries" json:"max_retries"`
	LastError      string    `db:"last_error" json:"last_error"`
	CreatedAt      time.Time `db:"created_at" json:"created_at"`
	UpdatedAt      time.Time `db:"updated_at" json:"updated_at"`
}

type Transaction struct {
	ID              string    `db:"id" json:"id"`
	AccountID       string    `db:"account_id" json:"account_id"`
	TransactionDate string    `db:"transaction_date" json:"transaction_date"`
	TransactionType string    `db:"transaction_type" json:"transaction_type"`
	Amount          int64     `db:"amount" json:"amount"`
	Balance         int64     `db:"balance" json:"balance"`
	ReferenceID     string    `db:"reference_id" json:"reference_id"`
	TaskID          string    `db:"task_id" json:"task_id"`
	CreatedAt       time.Time `db:"created_at" json:"created_at"`
}

type DailyReport struct {
	ID                 string           `db:"id" json:"id"`
	ReportDate         string           `db:"report_date" json:"report_date"`
	Status             string           `db:"status" json:"status"`
	TotalTasks         int              `db:"total_tasks" json:"total_tasks"`
	SuccessfulTasks    int              `db:"successful_tasks" json:"successful_tasks"`
	FailedTasks        int              `db:"failed_tasks" json:"failed_tasks"`
	DiscrepancyCount   int              `db:"discrepancy_count" json:"discrepancy_count"`
	DiscrepancyAmount  int64            `db:"discrepancy_amount" json:"discrepancy_amount"`
	DiscrepantAccounts JSONStringArray  `db:"discrepant_accounts" json:"discrepant_accounts"`
	GeneratedAt        time.Time        `db:"generated_at" json:"generated_at"`
}

type DiscrepancyRecord struct {
	ID                string    `db:"id" json:"id"`
	AccountID         string    `db:"account_id" json:"account_id"`
	RecordDate        string    `db:"record_date" json:"record_date"`
	ExpectedBalance   int64     `db:"expected_balance" json:"expected_balance"`
	ActualBalance     int64     `db:"actual_balance" json:"actual_balance"`
	DiffAmount        int64     `db:"diff_amount" json:"diff_amount"`
	Status            string    `db:"status" json:"status"`
	ResolvedBy        string    `db:"resolved_by" json:"resolved_by"`
	ResolvedAt        time.Time `db:"resolved_at" json:"resolved_at"`
	CreatedAt         time.Time `db:"created_at" json:"created_at"`
}

const (
	AccountTypeHeadquarters = "HEADQUARTERS"
	AccountTypeBranch       = "BRANCH"
	AccountTypeSubsidiary   = "SUBSIDIARY"
	
	AccountStatusActive   = "ACTIVE"
	AccountStatusInactive = "INACTIVE"
	
	TaskStatusPending    = "PENDING"
	TaskStatusProcessing = "PROCESSING"
	TaskStatusSuccess    = "SUCCESS"
	TaskStatusFailed     = "FAILED"
	TaskStatusRetrying   = "RETRYING"
	
	DiscrepancyStatusPending       = "PENDING"
	DiscrepancyStatusInvestigating = "INVESTIGATING"
	DiscrepancyStatusResolved      = "RESOLVED"
	
	ReportStatusGenerating = "GENERATING"
	ReportStatusCompleted  = "COMPLETED"
	ReportStatusFailed     = "FAILED"
	
	TransTypeCredit = "CREDIT"
	TransTypeDebit  = "DEBIT"
)

func NewUUID() string {
	return uuid.NewString()
}

func NullString(s string) NullableString {
	if s == "" {
		return NullableString{}
	}
	return NullableString{sql.NullString{String: s, Valid: true}}
}
