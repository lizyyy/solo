package models

import (
	"time"
)

type MigrationStatus string

const (
	StatusCreated          MigrationStatus = "CREATED"
	StatusValidating     MigrationStatus = "VALIDATING"
	StatusValidationPassed MigrationStatus = "VALIDATION_PASSED"
	StatusDualWriting   MigrationStatus = "DUAL_WRITING"
	StatusVerifying     MigrationStatus = "VERIFYING"
	StatusSwitchingRead MigrationStatus = "SWITCHING_READ"
	StatusCompleted      MigrationStatus = "COMPLETED"
	StatusRollingBack    MigrationStatus = "ROLLING_BACK"
	StatusRolledBack     MigrationStatus = "ROLLED_BACK"
	StatusFailed         MigrationStatus = "FAILED"
)

type CheckStatus string

const (
	CheckPending  CheckStatus = "PENDING"
	CheckRunning  CheckStatus = "RUNNING"
	CheckPassed   CheckStatus = "PASSED"
	CheckFailed   CheckStatus = "FAILED"
)

type CheckType string

const (
	CheckTypeConnectivity CheckType = "CONNECTIVITY"
	CheckTypeSchema       CheckType = "SCHEMA"
	CheckTypeDataCount   CheckType = "DATA_COUNT"
	CheckTypeDataConsistency CheckType = "DATA_CONSISTENCY"
	CheckTypePerformance CheckType = "PERFORMANCE"
)

type Tenant struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Code        string    `json:"code" gorm:"uniqueIndex"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type Cluster struct {
	ID          string    `json:"id" gorm:"primaryKey"`
	Name        string    `json:"name"`
	Type        string    `json:"type"`
	Endpoint    string    `json:"endpoint"`
	Region      string    `json:"region"`
	Status      string    `json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type MigrationTask struct {
	ID             string          `json:"id" gorm:"primaryKey"`
	TenantID       string          `json:"tenant_id"`
	SourceClusterID string         `json:"source_cluster_id"`
	TargetClusterID string         `json:"target_cluster_id"`
	Status         MigrationStatus `json:"status"`
	CurrentPhase     string          `json:"current_phase"`
	RetryCount     int            `json:"retry_count"`
	ErrorMessage   string          `json:"error_message"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
	CompletedAt    *time.Time      `json:"completed_at"`
}

type CheckItem struct {
	ID             string      `json:"id" gorm:"primaryKey"`
	MigrationTaskID string      `json:"migration_task_id"`
	CheckType      CheckType   `json:"check_type"`
	Name           string      `json:"name"`
	Status         CheckStatus `json:"status"`
	ExpectedValue  string      `json:"expected_value"`
	ActualValue    string      `json:"actual_value"`
	ErrorMessage   string      `json:"error_message"`
	ExecutedAt     *time.Time  `json:"executed_at"`
	CreatedAt      time.Time   `json:"created_at"`
	UpdatedAt      time.Time   `json:"updated_at"`
}

type RollbackPoint struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	MigrationTaskID string    `json:"migration_task_id"`
	Phase          string    `json:"phase"`
	SnapshotData   string    `json:"snapshot_data"`
	CreatedAt      time.Time `json:"created_at"`
}

type MigrationHistory struct {
	ID             string          `json:"id" gorm:"primaryKey"`
	MigrationTaskID string          `json:"migration_task_id"`
	FromStatus     MigrationStatus `json:"from_status"`
	ToStatus       MigrationStatus `json:"to_status"`
	Operator       string          `json:"operator"`
	Remark         string          `json:"remark"`
	CreatedAt      time.Time       `json:"created_at"`
}

type ValidationReport struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	MigrationTaskID string    `json:"migration_task_id"`
	ReportType     string    `json:"report_type"`
	Content        string    `json:"content"`
	PassRate       float64   `json:"pass_rate"`
	TotalChecks    int       `json:"total_checks"`
	PassedChecks   int       `json:"passed_checks"`
	FailedChecks   int       `json:"failed_checks"`
	CreatedAt      time.Time `json:"created_at"`
}

type DualWriteRecord struct {
	ID             string    `json:"id" gorm:"primaryKey"`
	MigrationTaskID string    `json:"migration_task_id"`
	OperationType  string    `json:"operation_type"`
	SourceResult   string    `json:"source_result"`
	TargetResult   string    `json:"target_result"`
	IsConsistent   bool      `json:"is_consistent"`
	CheckedAt      time.Time `json:"checked_at"`
}
