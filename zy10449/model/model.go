package model

import (
	"time"
)

type MigrationStatus string

const (
	StatusCreated       MigrationStatus = "CREATED"
	StatusDualSend      MigrationStatus = "DUAL_SEND"
	StatusReconciling   MigrationStatus = "RECONCILING"
	StatusVerified      MigrationStatus = "VERIFIED"
	StatusSwitched      MigrationStatus = "SWITCHED"
	StatusFailed        MigrationStatus = "FAILED"
	StatusRolledBack    MigrationStatus = "ROLLED_BACK"
)

type EventCompareResult string

const (
	CompareMatch    EventCompareResult = "MATCH"
	CompareMismatch EventCompareResult = "MISMATCH"
	CompareMissing  EventCompareResult = "MISSING"
	CompareTimeout  EventCompareResult = "TIMEOUT"
)

type Supplier struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	OldWebhook  string    `json:"old_webhook"`
	NewWebhook  string    `json:"new_webhook"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Migration struct {
	ID                 string          `json:"id" gorm:"primaryKey"`
	SupplierID         string          `json:"supplier_id"`
	SupplierName       string          `json:"supplier_name"`
	OldWebhook         string          `json:"old_webhook"`
	NewWebhook         string          `json:"new_webhook"`
	EventTypes         []string        `json:"event_types" gorm:"serializer:json"`
	DualSendStartAt    time.Time       `json:"dual_send_start_at"`
	DualSendEndAt      time.Time       `json:"dual_send_end_at"`
	Status             MigrationStatus `json:"status"`
	TotalEvents        int             `json:"total_events"`
	MatchedEvents      int             `json:"matched_events"`
	MismatchedEvents   int             `json:"mismatched_events"`
	MissingEvents      int             `json:"missing_events"`
	SuccessRate        float64         `json:"success_rate"`
	SwitchConclusion   string          `json:"switch_conclusion"`
	FailureReason      string          `json:"failure_reason"`
	RawInputSnapshot   string          `json:"raw_input_snapshot" gorm:"type:text"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
	CompletedAt        *time.Time      `json:"completed_at,omitempty"`
}

type EventRecord struct {
	ID                 string             `json:"id" gorm:"primaryKey"`
	MigrationID        string             `json:"migration_id"`
	EventType          string             `json:"event_type"`
	EventID            string             `json:"event_id"`
	PayloadHash        string             `json:"payload_hash"`
	OldDelivered       bool               `json:"old_delivered"`
	OldResponseStatus  int                `json:"old_response_status"`
	OldResponseTime    int64              `json:"old_response_time_ms"`
	OldResponseBody    string             `json:"old_response_body" gorm:"type:text"`
	NewDelivered       bool               `json:"new_delivered"`
	NewResponseStatus  int                `json:"new_response_status"`
	NewResponseTime    int64              `json:"new_response_time_ms"`
	NewResponseBody    string             `json:"new_response_body" gorm:"type:text"`
	CompareResult      EventCompareResult `json:"compare_result"`
	CompareDetail      string             `json:"compare_detail"`
	RawOldRequest      string             `json:"raw_old_request" gorm:"type:text"`
	RawNewRequest      string             `json:"raw_new_request" gorm:"type:text"`
	CreatedAt          time.Time          `json:"created_at"`
}

type StatusTransition struct {
	ID             string          `json:"id" gorm:"primaryKey"`
	MigrationID    string          `json:"migration_id"`
	FromStatus     MigrationStatus `json:"from_status"`
	ToStatus       MigrationStatus `json:"to_status"`
	TriggeredBy    string          `json:"triggered_by"`
	Reason         string          `json:"reason"`
	RawInput       string          `json:"raw_input" gorm:"type:text"`
	CreatedAt      time.Time       `json:"created_at"`
}

type MigrationExport struct {
	MigrationID        string    `json:"migration_id"`
	SupplierName       string    `json:"supplier_name"`
	OldWebhook         string    `json:"old_webhook"`
	NewWebhook         string    `json:"new_webhook"`
	EventTypes         string    `json:"event_types"`
	DualSendWindow     string    `json:"dual_send_window"`
	FinalStatus        string    `json:"final_status"`
	TotalEvents        int       `json:"total_events"`
	MatchedEvents      int       `json:"matched_events"`
	MismatchedEvents   int       `json:"mismatched_events"`
	MissingEvents      int       `json:"missing_events"`
	SuccessRate        string    `json:"success_rate"`
	Conclusion         string    `json:"conclusion"`
	FailureReason      string    `json:"failure_reason"`
	CompletedAt        string    `json:"completed_at"`
}
