package models

import (
	"database/sql"
	"encoding/json"
	"time"
)

type Contract struct {
	ID          int64           `json:"id"`
	Name        string          `json:"name"`
	Version     string          `json:"version"`
	Method      string          `json:"method"`
	Path        string          `json:"path"`
	Schema      json.RawMessage `json:"schema"`
	Description string          `json:"description"`
	CreatedAt   time.Time       `json:"created_at"`
	UpdatedAt   time.Time       `json:"updated_at"`
}

type Sample struct {
	ID         int64           `json:"id"`
	ContractID int64           `json:"contract_id"`
	Payload    json.RawMessage `json:"payload"`
	Source     string          `json:"source"`
	Hash       string          `json:"hash"`
	Status     string          `json:"status"`
	CreatedAt  time.Time       `json:"created_at"`
	AnalyzedAt sql.NullTime    `json:"analyzed_at,omitempty"`
}

type FieldExplanation struct {
	ID         int64  `json:"id"`
	ContractID int64  `json:"contract_id"`
	FieldPath  string `json:"field_path"`
	Type       string `json:"type"`
	Required   bool   `json:"required"`
	Comment    string `json:"comment"`
}

type Consumer struct {
	ID        int64     `json:"id"`
	Name      string    `json:"name"`
	Version   string    `json:"version"`
	Service   string    `json:"service"`
	CreatedAt time.Time `json:"created_at"`
}

type Confirmation struct {
	ID         int64     `json:"id"`
	SampleID   int64     `json:"sample_id"`
	ConsumerID int64     `json:"consumer_id"`
	Status     string    `json:"status"`
	Comment    string    `json:"comment"`
	ConfirmedAt time.Time `json:"confirmed_at"`
}

type DriftRecord struct {
	ID              int64           `json:"id"`
	SampleID        int64           `json:"sample_id"`
	ContractID      int64           `json:"contract_id"`
	FieldPath       string          `json:"field_path"`
	DriftType       string          `json:"drift_type"`
	ExpectedValue   json.RawMessage `json:"expected_value"`
	ActualValue     json.RawMessage `json:"actual_value"`
	Severity        string          `json:"severity"`
	Status          string          `json:"status"`
	ResolvedBy      sql.NullInt64   `json:"resolved_by,omitempty"`
	ResolvedComment string          `json:"resolved_comment,omitempty"`
	ResolvedAt      sql.NullTime    `json:"resolved_at,omitempty"`
	DetectedAt      time.Time       `json:"detected_at"`
}

type DriftReport struct {
	ID             int64         `json:"id"`
	ContractID     int64         `json:"contract_id"`
	ContractName   string        `json:"contract_name"`
	ContractVersion string       `json:"contract_version"`
	TotalSamples   int           `json:"total_samples"`
	DriftedSamples int           `json:"drifted_samples"`
	FieldDrifts    []FieldDrift  `json:"field_drifts"`
	GeneratedAt    time.Time     `json:"generated_at"`
}

type FieldDrift struct {
	FieldPath    string `json:"field_path"`
	DriftCount   int    `json:"drift_count"`
	LastDriftAt  string `json:"last_drift_at"`
}

type ExceptionRecord struct {
	ID           int64           `json:"id"`
	Operation    string          `json:"operation"`
	RawInput     json.RawMessage `json:"raw_input"`
	ErrorMessage string          `json:"error_message"`
	Conclusion   string          `json:"conclusion"`
	Fixed        bool            `json:"fixed"`
	FixedBy      sql.NullString  `json:"fixed_by,omitempty"`
	FixedComment string          `json:"fixed_comment,omitempty"`
	FixedAt      sql.NullTime    `json:"fixed_at,omitempty"`
	CreatedAt    time.Time       `json:"created_at"`
}

type DriftAnalysisResult struct {
	HasDrift     bool           `json:"has_drift"`
	DriftCount   int            `json:"drift_count"`
	DriftRecords []DriftRecord  `json:"drift_records"`
}
