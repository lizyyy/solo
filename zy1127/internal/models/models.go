package models

import (
	"encoding/json"
	"time"
)

type Project struct {
	ID          string    `json:"id" db:"id"`
	Name        string    `json:"name" db:"name"`
	Description string    `json:"description" db:"description"`
	CreatedAt   time.Time `json:"created_at" db:"created_at"`
	UpdatedAt   time.Time `json:"updated_at" db:"updated_at"`
}

type MapOperationType string

const (
	MapOperationTypeRead  MapOperationType = "READ"
	MapOperationTypeWrite MapOperationType = "WRITE"
)

type MapEvent struct {
	ID            string            `json:"id" db:"id"`
	ProjectID     string            `json:"project_id" db:"project_id"`
	MapName       string            `json:"map_name" db:"map_name"`
	Key           string            `json:"key" db:"key"`
	Operation     MapOperationType  `json:"operation" db:"operation"`
	GoroutineID   int64             `json:"goroutine_id" db:"goroutine_id"`
	HasLock       bool              `json:"has_lock" db:"has_lock"`
	LockType      string            `json:"lock_type,omitempty" db:"lock_type"`
	Timestamp     time.Time         `json:"timestamp" db:"timestamp"`
	StackFrame    string            `json:"stack_frame,omitempty" db:"stack_frame"`
	Metadata      map[string]string `json:"metadata,omitempty" db:"-"`
	MetadataRaw   string            `json:"-" db:"metadata_raw"`
}

type GoroutineSnapshot struct {
	ID            string            `json:"id" db:"id"`
	ProjectID     string            `json:"project_id" db:"project_id"`
	SnapshotID    string            `json:"snapshot_id" db:"snapshot_id"`
	GoroutineID   int64             `json:"goroutine_id" db:"goroutine_id"`
	State         string            `json:"state" db:"state"`
	Stack         string            `json:"stack" db:"stack"`
	BlockedReason string            `json:"blocked_reason,omitempty" db:"blocked_reason"`
	BlockedSince  time.Time         `json:"blocked_since,omitempty" db:"blocked_since"`
	Timestamp     time.Time         `json:"timestamp" db:"timestamp"`
	Metadata      map[string]string `json:"metadata,omitempty" db:"-"`
	MetadataRaw   string            `json:"-" db:"metadata_raw"`
}

type WorkerQueue struct {
	ID               string    `json:"id" db:"id"`
	ProjectID        string    `json:"project_id" db:"project_id"`
	QueueName        string    `json:"queue_name" db:"queue_name"`
	WorkerCount      int       `json:"worker_count" db:"worker_count"`
	QueueCapacity    int       `json:"queue_capacity" db:"queue_capacity"`
	QueueLength      int       `json:"queue_length" db:"queue_length"`
	PendingTasks     int       `json:"pending_tasks" db:"pending_tasks"`
	FailedTasks      int       `json:"failed_tasks" db:"failed_tasks"`
	CompletedTasks   int       `json:"completed_tasks" db:"completed_tasks"`
	LastTaskDuration time.Duration `json:"last_task_duration_ms" db:"last_task_duration_ms"`
	Timestamp        time.Time `json:"timestamp" db:"timestamp"`
}

type RiskCategory string

const (
	RiskCategoryConcurrentMap      RiskCategory = "concurrent_map"
	RiskCategoryHotKeyWrite        RiskCategory = "hot_key_write"
	RiskCategoryCoarseLock         RiskCategory = "coarse_lock"
	RiskCategoryWorkerBacklog      RiskCategory = "worker_backlog"
	RiskCategoryGoroutineLeak      RiskCategory = "goroutine_leak"
	RiskCategoryContextMissing     RiskCategory = "context_missing"
	RiskCategoryChannelBlocked     RiskCategory = "channel_blocked"
)

type RiskSeverity string

const (
	RiskSeverityCritical RiskSeverity = "critical"
	RiskSeverityHigh     RiskSeverity = "high"
	RiskSeverityMedium   RiskSeverity = "medium"
	RiskSeverityLow      RiskSeverity = "low"
)

type AnalysisResult struct {
	ID            string            `json:"id" db:"id"`
	ProjectID     string            `json:"project_id" db:"project_id"`
	Category      RiskCategory      `json:"category" db:"category"`
	Severity      RiskSeverity      `json:"severity" db:"severity"`
	Title         string            `json:"title" db:"title"`
	Description   string            `json:"description" db:"description"`
	EvidenceCount int               `json:"evidence_count" db:"evidence_count"`
	Evidence      []string          `json:"evidence,omitempty" db:"-"`
	EvidenceRaw   string            `json:"-" db:"evidence_raw"`
	Suggestions   []string          `json:"suggestions,omitempty" db:"-"`
	SuggestionsRaw string           `json:"-" db:"suggestions_raw"`
	CreatedAt     time.Time         `json:"created_at" db:"created_at"`
}

type ReplayTaskStatus string

const (
	ReplayStatusPending   ReplayTaskStatus = "pending"
	ReplayStatusRunning   ReplayTaskStatus = "running"
	ReplayStatusCompleted ReplayTaskStatus = "completed"
	ReplayStatusFailed    ReplayTaskStatus = "failed"
	ReplayStatusTimeout   ReplayTaskStatus = "timeout"
	ReplayStatusCancelled ReplayTaskStatus = "cancelled"
)

type ReplayTask struct {
	ID             string           `json:"id" db:"id"`
	ProjectID      string           `json:"project_id" db:"project_id"`
	AnalysisResultID string         `json:"analysis_result_id,omitempty" db:"analysis_result_id"`
	TargetCategory RiskCategory     `json:"target_category" db:"target_category"`
	Status         ReplayTaskStatus `json:"status" db:"status"`
	Config         map[string]interface{} `json:"config,omitempty" db:"-"`
	ConfigRaw      string           `json:"-" db:"config_raw"`
	Concurrency    int              `json:"concurrency" db:"concurrency"`
	Duration       time.Duration    `json:"duration_seconds" db:"duration_seconds"`
	Timeout        time.Duration    `json:"timeout_seconds" db:"timeout_seconds"`
	Result         string           `json:"result,omitempty" db:"result"`
	Error          string           `json:"error,omitempty" db:"error"`
	CreatedAt      time.Time        `json:"created_at" db:"created_at"`
	StartedAt      *time.Time       `json:"started_at,omitempty" db:"started_at"`
	CompletedAt    *time.Time       `json:"completed_at,omitempty" db:"completed_at"`
}

func (e *MapEvent) SetMetadata(meta map[string]string) error {
	if meta == nil {
		e.MetadataRaw = ""
		e.Metadata = nil
		return nil
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	e.MetadataRaw = string(data)
	e.Metadata = meta
	return nil
}

func (e *MapEvent) LoadMetadata() error {
	if e.MetadataRaw == "" {
		e.Metadata = nil
		return nil
	}
	return json.Unmarshal([]byte(e.MetadataRaw), &e.Metadata)
}

func (s *GoroutineSnapshot) SetMetadata(meta map[string]string) error {
	if meta == nil {
		s.MetadataRaw = ""
		s.Metadata = nil
		return nil
	}
	data, err := json.Marshal(meta)
	if err != nil {
		return err
	}
	s.MetadataRaw = string(data)
	s.Metadata = meta
	return nil
}

func (s *GoroutineSnapshot) LoadMetadata() error {
	if s.MetadataRaw == "" {
		s.Metadata = nil
		return nil
	}
	return json.Unmarshal([]byte(s.MetadataRaw), &s.Metadata)
}

func (r *AnalysisResult) SetEvidence(evidence []string) error {
	if evidence == nil {
		r.EvidenceRaw = ""
		r.Evidence = nil
		return nil
	}
	data, err := json.Marshal(evidence)
	if err != nil {
		return err
	}
	r.EvidenceRaw = string(data)
	r.Evidence = evidence
	return nil
}

func (r *AnalysisResult) LoadEvidence() error {
	if r.EvidenceRaw == "" {
		r.Evidence = nil
		return nil
	}
	return json.Unmarshal([]byte(r.EvidenceRaw), &r.Evidence)
}

func (r *AnalysisResult) SetSuggestions(suggestions []string) error {
	if suggestions == nil {
		r.SuggestionsRaw = ""
		r.Suggestions = nil
		return nil
	}
	data, err := json.Marshal(suggestions)
	if err != nil {
		return err
	}
	r.SuggestionsRaw = string(data)
	r.Suggestions = suggestions
	return nil
}

func (r *AnalysisResult) LoadSuggestions() error {
	if r.SuggestionsRaw == "" {
		r.Suggestions = nil
		return nil
	}
	return json.Unmarshal([]byte(r.SuggestionsRaw), &r.Suggestions)
}

func (t *ReplayTask) SetConfig(config map[string]interface{}) error {
	if config == nil {
		t.ConfigRaw = ""
		t.Config = nil
		return nil
	}
	data, err := json.Marshal(config)
	if err != nil {
		return err
	}
	t.ConfigRaw = string(data)
	t.Config = config
	return nil
}

func (t *ReplayTask) LoadConfig() error {
	if t.ConfigRaw == "" {
		t.Config = nil
		return nil
	}
	return json.Unmarshal([]byte(t.ConfigRaw), &t.Config)
}
