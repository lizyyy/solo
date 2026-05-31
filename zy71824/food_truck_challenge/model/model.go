package model

import "time"

type RecordStatus string

const (
	StatusPending      RecordStatus = "pending"
	StatusConfirmed    RecordStatus = "confirmed"
	StatusDisputed     RecordStatus = "disputed"
	StatusReviewNeeded RecordStatus = "review_needed"
	StatusResolved     RecordStatus = "resolved"
)

type RecordSource string

const (
	SourceActivityReview RecordSource = "activity_review"
	SourcePlayerFeedback RecordSource = "player_feedback"
	SourceManualEntry    RecordSource = "manual_entry"
	SourceSystemAuto     RecordSource = "system_auto"
)

type DisputeReason string

const (
	DisconnProgressLost   DisputeReason = "disconnect_progress_lost"
	RewardMissing         DisputeReason = "reward_missing"
	DataMismatch          DisputeReason = "data_mismatch"
	DuplicateSubmission   DisputeReason = "duplicate_submission"
	OtherControversial    DisputeReason = "other_controversial"
)

type EventRecord struct {
	ID             string        `json:"id"`
	BatchID        string        `json:"batch_id"`
	ChallengeName  string        `json:"challenge_name"`
	PlayerID       string        `json:"player_id"`
	Source         RecordSource  `json:"source"`
	Status         RecordStatus  `json:"status"`
	DisputeReason  *DisputeReason `json:"dispute_reason,omitempty"`
	ReviewNote     string        `json:"review_note,omitempty"`
	RawData        interface{}   `json:"raw_data,omitempty"`
	CreatedAt      time.Time     `json:"created_at"`
	UpdatedAt      time.Time     `json:"updated_at"`
	Fingerprint    string        `json:"fingerprint"`
}

type AuditEntry struct {
	ID          string       `json:"id"`
	RecordID    string       `json:"record_id"`
	OldStatus   RecordStatus `json:"old_status"`
	NewStatus   RecordStatus `json:"new_status"`
	ChangedBy   string       `json:"changed_by"`
	Reason      string       `json:"reason"`
	Detail      string       `json:"detail,omitempty"`
	ChangedAt   time.Time    `json:"changed_at"`
}

type ExportRecord struct {
	Record   EventRecord  `json:"record"`
	Audits   []AuditEntry `json:"audits"`
}
