package migration

import (
	"time"
)

type MigrationStatus string

const (
	MigrationStatusPending    MigrationStatus = "pending"
	MigrationStatusRunning    MigrationStatus = "running"
	MigrationStatusCompleted  MigrationStatus = "completed"
	MigrationStatusFailed     MigrationStatus = "failed"
	MigrationStatusRolledBack MigrationStatus = "rolled_back"
)

type MigrationStepStatus string

const (
	StepStatusPending    MigrationStepStatus = "pending"
	StepStatusRunning    MigrationStepStatus = "running"
	StepStatusCompleted  MigrationStepStatus = "completed"
	StepStatusFailed     MigrationStepStatus = "failed"
	StepStatusRolledBack MigrationStepStatus = "rolled_back"
)

type Migration struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Version     string           `json:"version"`
	Description string           `json:"description"`
	Steps       []*MigrationStep `json:"steps"`
	Status      MigrationStatus  `json:"status"`
	StartTime   time.Time        `json:"start_time"`
	EndTime     time.Time        `json:"end_time"`
	Error       string           `json:"error"`
	RollbackLog []RollbackEntry  `json:"rollback_log"`
	TraceID     string           `json:"trace_id"`
	CreatedBy   string           `json:"created_by"`
	Checksum    string           `json:"checksum"`
}

type MigrationStep struct {
	ID           string              `json:"id"`
	Index        int                 `json:"index"`
	Name         string              `json:"name"`
	Description  string              `json:"description"`
	Type         StepType            `json:"type"`
	UpSQL        string              `json:"up_sql"`
	DownSQL      string              `json:"down_sql"`
	Status       MigrationStepStatus `json:"status"`
	StartTime    time.Time           `json:"start_time"`
	EndTime      time.Time           `json:"end_time"`
	RowsAffected int64               `json:"rows_affected"`
	Error        string              `json:"error"`
	Warnings     []string            `json:"warnings"`
	RetryCount   int                 `json:"retry_count"`
	Checksum     string              `json:"checksum"`
	DataSnapshot *DataSnapshot       `json:"data_snapshot"`
}

type StepType string

const (
	StepTypeDDL        StepType = "ddl"
	StepTypeDML        StepType = "dml"
	StepTypeDataCheck  StepType = "data_check"
	StepTypeIndexBuild StepType = "index_build"
	StepTypeConstraint StepType = "constraint"
	StepTypeTrigger    StepType = "trigger"
)

type RollbackEntry struct {
	Timestamp time.Time
	StepID    string
	Action    string
	Details   string
}

type DataSnapshot struct {
	Timestamp   time.Time
	RowCount    int64
	ColumnStats map[string]ColumnStat
	SampleRows  []map[string]interface{}
}

type ColumnStat struct {
	NullCount     int64
	DistinctCount int64
	MinValue      string
	MaxValue      string
	AvgValue      float64
}

type MigrationResult struct {
	MigrationID       string
	Status            MigrationStatus
	Duration          time.Duration
	StepsCompleted    int
	StepsFailed       int
	TotalRowsAffected int64
	Errors            []StepError
	Warnings          []string
	DataIntegrity     DataIntegrityReport
}

type StepError struct {
	StepID    string
	StepName  string
	Message   string
	SQL       string
	Timestamp time.Time
}

type DataIntegrityReport struct {
	Passed      bool
	Checks      []DataCheck
	FailedCount int
	TotalCount  int
}

type DataCheck struct {
	Name     string
	Passed   bool
	Message  string
	Expected interface{}
	Actual   interface{}
	Diff     string
}

type MigrationConfig struct {
	EnableChecksum     bool
	EnableDataSnapshot bool
	EnableDryRun       bool
	TransactionPerStep bool
	LockTimeout        time.Duration
	StatementTimeout   time.Duration
	MaxRetryPerStep    int
	RetryDelay         time.Duration
}

type ExecutionPlan struct {
	MigrationID   string
	TotalSteps    int
	EstimatedTime time.Duration
	RiskLevel     RiskLevel
	Dependencies  []string
	RollbackPlan  []RollbackPlanStep
}

type RiskLevel string

const (
	RiskLow      RiskLevel = "low"
	RiskMedium   RiskLevel = "medium"
	RiskHigh     RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type RollbackPlanStep struct {
	StepID        string
	Action        string
	EstimatedTime time.Duration
}
