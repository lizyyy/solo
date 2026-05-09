package migration

import (
	"time"
)

type MigrationStatus string

const (
	MigrationStatusPending   MigrationStatus = "pending"
	MigrationStatusRunning   MigrationStatus = "running"
	MigrationStatusCompleted MigrationStatus = "completed"
	MigrationStatusFailed    MigrationStatus = "failed"
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
	ID          string
	Name        string
	Version     string
	Description string
	Steps       []*MigrationStep
	Status      MigrationStatus
	StartTime   time.Time
	EndTime     time.Time
	Error       string
	RollbackLog []RollbackEntry
	TraceID     string
	CreatedBy   string
	Checksum    string
}

type MigrationStep struct {
	ID            string
	Index         int
	Name          string
	Description   string
	Type          StepType
	UpSQL         string
	DownSQL       string
	Status        MigrationStepStatus
	StartTime     time.Time
	EndTime       time.Time
	RowsAffected  int64
	Error         string
	Warnings      []string
	RetryCount    int
	Checksum      string
	DataSnapshot  *DataSnapshot
}

type StepType string

const (
	StepTypeDDL          StepType = "ddl"
	StepTypeDML          StepType = "dml"
	StepTypeDataCheck    StepType = "data_check"
	StepTypeIndexBuild   StepType = "index_build"
	StepTypeConstraint   StepType = "constraint"
	StepTypeTrigger      StepType = "trigger"
)

type RollbackEntry struct {
	Timestamp   time.Time
	StepID      string
	Action      string
	Details     string
}

type DataSnapshot struct {
	Timestamp    time.Time
	RowCount     int64
	ColumnStats  map[string]ColumnStat
	SampleRows   []map[string]interface{}
}

type ColumnStat struct {
	NullCount    int64
	DistinctCount int64
	MinValue     string
	MaxValue     string
	AvgValue     float64
}

type MigrationResult struct {
	MigrationID    string
	Status         MigrationStatus
	Duration       time.Duration
	StepsCompleted int
	StepsFailed    int
	TotalRowsAffected int64
	Errors         []StepError
	Warnings       []string
	DataIntegrity  DataIntegrityReport
}

type StepError struct {
	StepID      string
	StepName    string
	Message     string
	SQL         string
	Timestamp   time.Time
}

type DataIntegrityReport struct {
	Passed      bool
	Checks      []DataCheck
	FailedCount int
	TotalCount  int
}

type DataCheck struct {
	Name        string
	Passed      bool
	Message     string
	Expected    interface{}
	Actual      interface{}
	Diff        string
}

type MigrationConfig struct {
	EnableChecksum      bool
	EnableDataSnapshot  bool
	EnableDryRun        bool
	TransactionPerStep  bool
	LockTimeout         time.Duration
	StatementTimeout    time.Duration
	MaxRetryPerStep     int
	RetryDelay          time.Duration
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
	RiskLow    RiskLevel = "low"
	RiskMedium RiskLevel = "medium"
	RiskHigh   RiskLevel = "high"
	RiskCritical RiskLevel = "critical"
)

type RollbackPlanStep struct {
	StepID      string
	Action      string
	EstimatedTime time.Duration
}
