package model

import "time"

type TaskStatus string

const (
	TaskStatusPending   TaskStatus = "pending"
	TaskStatusLeased    TaskStatus = "leased"
	TaskStatusRunning   TaskStatus = "running"
	TaskStatusCompleted TaskStatus = "completed"
	TaskStatusFailed    TaskStatus = "failed"
	TaskStatusTimeout   TaskStatus = "timeout"
)

type Task struct {
	ID          string     `json:"id"`
	Name        string     `json:"name"`
	Payload     string     `json:"payload"`
	Status      TaskStatus `json:"status"`
	Priority    int        `json:"priority"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	MaxRetries  int        `json:"max_retries"`
	RetryCount  int        `json:"retry_count"`
	LeaseTimeout int       `json:"lease_timeout"`
}

type Lease struct {
	ID         string    `json:"id"`
	TaskID     string    `json:"task_id"`
	HolderID   string    `json:"holder_id"`
	HolderName string    `json:"holder_name"`
	AcquiredAt time.Time `json:"acquired_at"`
	ExpiresAt  time.Time `json:"expires_at"`
	RenewCount int       `json:"renew_count"`
	IsActive   bool      `json:"is_active"`
}

type ExecutionResult struct {
	ID          string    `json:"id"`
	TaskID      string    `json:"task_id"`
	LeaseID     string    `json:"lease_id"`
	HolderID    string    `json:"holder_id"`
	Status      string    `json:"status"`
	ResultData  string    `json:"result_data"`
	ErrorMessage string   `json:"error_message"`
	StartedAt   time.Time `json:"started_at"`
	CompletedAt time.Time `json:"completed_at"`
	DurationMs  int64     `json:"duration_ms"`
}

type ReleaseRecord struct {
	ID           string    `json:"id"`
	TaskID       string    `json:"task_id"`
	LeaseID      string    `json:"lease_id"`
	HolderID     string    `json:"holder_id"`
	ReleasedAt   time.Time `json:"released_at"`
	ReleaseType  string    `json:"release_type"`
	Reason       string    `json:"reason"`
	PreemptedBy  string    `json:"preempted_by,omitempty"`
}

type TimelineEvent struct {
	ID        string    `json:"id"`
	TaskID    string    `json:"task_id"`
	LeaseID   string    `json:"lease_id,omitempty"`
	EventType string    `json:"event_type"`
	HolderID  string    `json:"holder_id,omitempty"`
	Message   string    `json:"message"`
	Details   string    `json:"details,omitempty"`
	CreatedAt time.Time `json:"created_at"`
}

type DiagnosticsReport struct {
	TotalTasks      int            `json:"total_tasks"`
	PendingTasks    int            `json:"pending_tasks"`
	RunningTasks    int            `json:"running_tasks"`
	CompletedTasks  int            `json:"completed_tasks"`
	FailedTasks     int            `json:"failed_tasks"`
	ActiveLeases    int            `json:"active_leases"`
	RecentEvents    []TimelineEvent `json:"recent_events"`
	GeneratedAt     time.Time      `json:"generated_at"`
}
