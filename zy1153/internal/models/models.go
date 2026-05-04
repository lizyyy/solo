package models

import (
	"time"
)

// ConnectionPool 表示数据库连接池的配置和当前状态
type ConnectionPool struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	MaxOpen     int           `json:"max_open"`
	MaxIdle     int           `json:"max_idle"`
	IdleTimeout time.Duration `json:"idle_timeout"`
	TenantQuota int           `json:"tenant_quota"`
	
	// 运行时状态
	OpenConnections     int       `json:"open_connections"`
	IdleConnections     int       `json:"idle_connections"`
	InUseConnections    int       `json:"in_use_connections"`
	WaitCount           int64     `json:"wait_count"`
	WaitDuration        time.Duration `json:"wait_duration"`
	MaxIdleClosed       int64     `json:"max_idle_closed"`
	MaxLifetimeClosed   int64     `json:"max_lifetime_closed"`
	
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// ConnectionLease 表示连接租约（借出和归还）
type ConnectionLease struct {
	ID            string    `json:"id"`
	ConnectionID  string    `json:"connection_id"`
	RequestID     string    `json:"request_id"`
	TenantID      string    `json:"tenant_id"`
	
	// 借出信息
	BorrowedAt    time.Time `json:"borrowed_at"`
	BorrowSource  string    `json:"borrow_source"` // idle/new/wait
	
	// 归还信息
	ReturnedAt    *time.Time `json:"returned_at,omitempty"`
	ReturnReason  string     `json:"return_reason,omitempty"` // normal/timeout/error/force
	
	// 耗时统计
	WaitDuration   time.Duration `json:"wait_duration"`   // 等待获取连接的时间
	UseDuration    time.Duration `json:"use_duration"`    // 实际使用时间（借出到归还）
	
	// 关联信息
	TransactionID  *string   `json:"transaction_id,omitempty"`
	SQLCount       int       `json:"sql_count"`
	HasError       bool      `json:"has_error"`
	ErrorMessage   string    `json:"error_message,omitempty"`
	
	// 状态
	Status         LeaseStatus `json:"status"`
}

type LeaseStatus string

const (
	LeaseStatusWaiting   LeaseStatus = "waiting"
	LeaseStatusBorrowed  LeaseStatus = "borrowed"
	LeaseStatusReturned  LeaseStatus = "returned"
	LeaseStatusTimeout   LeaseStatus = "timeout"
	LeaseStatusSuspicious LeaseStatus = "suspicious"
)

// WaitQueueItem 表示等待队列中的项
type WaitQueueItem struct {
	ID           string        `json:"id"`
	RequestID    string        `json:"request_id"`
	TenantID     string        `json:"tenant_id"`
	
	EnqueuedAt   time.Time     `json:"enqueued_at"`
	DequeuedAt   *time.Time    `json:"dequeued_at,omitempty"`
	
	WaitDuration time.Duration `json:"wait_duration"`
	
	Priority     int           `json:"priority"`
	Status       QueueStatus   `json:"status"`
	
	ConnectionID *string       `json:"connection_id,omitempty"`
	Timeout      time.Duration `json:"timeout"`
	IsTimeout    bool          `json:"is_timeout"`
}

type QueueStatus string

const (
	QueueStatusWaiting  QueueStatus = "waiting"
	QueueStatusAcquired QueueStatus = "acquired"
	QueueStatusTimeout  QueueStatus = "timeout"
	QueueStatusCanceled QueueStatus = "canceled"
)

// SQLQuery 表示执行的 SQL 语句
type SQLQuery struct {
	ID             string        `json:"id"`
	ConnectionID   string        `json:"connection_id"`
	RequestID      string        `json:"request_id"`
	TenantID       string        `json:"tenant_id"`
	
	SQLText        string        `json:"sql_text"`
	SQLType        SQLType       `json:"sql_type"`
	
	StartTime      time.Time     `json:"start_time"`
	EndTime        *time.Time    `json:"end_time,omitempty"`
	
	Duration       time.Duration `json:"duration"`
	
	RowsAffected   int64         `json:"rows_affected"`
	Error          string        `json:"error,omitempty"`
	
	TransactionID  *string       `json:"transaction_id,omitempty"`
	IsSlow         bool          `json:"is_slow"`
	SlowThreshold  time.Duration `json:"slow_threshold"`
}

type SQLType string

const (
	SQLTypeSelect    SQLType = "SELECT"
	SQLTypeInsert    SQLType = "INSERT"
	SQLTypeUpdate    SQLType = "UPDATE"
	SQLTypeDelete    SQLType = "DELETE"
	SQLTypeDDL       SQLType = "DDL"
	SQLTypeOther     SQLType = "OTHER"
)

// Transaction 表示数据库事务
type Transaction struct {
	ID               string        `json:"id"`
	ConnectionID     string        `json:"connection_id"`
	RequestID        string        `json:"request_id"`
	TenantID         string        `json:"tenant_id"`
	
	BeginTime        time.Time     `json:"begin_time"`
	EndTime          *time.Time    `json:"end_time,omitempty"`
	
	Duration         time.Duration `json:"duration"`
	
	Status           TransactionStatus `json:"status"`
	CommitOrRollback string            `json:"commit_or_rollback,omitempty"` // commit/rollback
	
	SQLCount         int           `json:"sql_count"`
	HasSavepoints    bool          `json:"has_savepoints"`
	
	IsLongRunning    bool          `json:"is_long_running"`
	LongThreshold    time.Duration `json:"long_threshold"`
}

type TransactionStatus string

const (
	TransactionStatusActive    TransactionStatus = "active"
	TransactionStatusCommitted TransactionStatus = "committed"
	TransactionStatusRolledBack TransactionStatus = "rolled_back"
	TransactionStatusSuspicious TransactionStatus = "suspicious"
)

// Tenant 表示租户信息
type Tenant struct {
	ID               string    `json:"id"`
	Name             string    `json:"name"`
	Quota            int       `json:"quota"`
	
	// 统计信息
	CurrentConnections int     `json:"current_connections"`
	TotalBorrows       int64   `json:"total_borrows"`
	TotalWaitTime      time.Duration `json:"total_wait_time"`
	AvgWaitTime        time.Duration `json:"avg_wait_time"`
	
	// 告警统计
	AlertCount         int     `json:"alert_count"`
	
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// Alert 表示告警信息
type Alert struct {
	ID               string          `json:"id"`
	Type             AlertType       `json:"type"`
	Severity         AlertSeverity   `json:"severity"`
	
	Title            string          `json:"title"`
	Description      string          `json:"description"`
	RootCause        string          `json:"root_cause"`
	Recommendation   string          `json:"recommendation"`
	
	// 关联信息
	ConnectionID     *string         `json:"connection_id,omitempty"`
	RequestID        *string         `json:"request_id,omitempty"`
	TenantID         *string         `json:"tenant_id,omitempty"`
	TransactionID    *string         `json:"transaction_id,omitempty"`
	QueryID          *string         `json:"query_id,omitempty"`
	
	// 时间信息
	CreatedAt        time.Time       `json:"created_at"`
	FirstSeenAt      time.Time       `json:"first_seen_at"`
	LastSeenAt       *time.Time      `json:"last_seen_at,omitempty"`
	
	// 状态
	Status           AlertStatus     `json:"status"`
	IsFalsePositive  bool            `json:"is_false_positive"`
	ConfirmedBy      *string         `json:"confirmed_by,omitempty"`
	ConfirmedAt      *time.Time      `json:"confirmed_at,omitempty"`
	
	// 诊断详情
	Evidence         interface{}     `json:"evidence"`
	Score            float64         `json:"score"`
}

type AlertType string

const (
	AlertTypeConnectionUnreturned    AlertType = "connection_unreturned"
	AlertTypeLongTransaction          AlertType = "long_transaction"
	AlertTypeSlowSQLOccupation       AlertType = "slow_sql_occupation"
	AlertTypeWaitQueueStarvation      AlertType = "wait_queue_starvation"
	AlertTypeConfigurationIssue       AlertType = "configuration_issue"
	AlertTypeTenantContention         AlertType = "tenant_contention"
	AlertTypeConnectionFluctuation    AlertType = "connection_fluctuation"
	AlertTypeTimeoutRetryAmplification AlertType = "timeout_retry_amplification"
)

type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical"
	AlertSeverityHigh     AlertSeverity = "high"
	AlertSeverityMedium   AlertSeverity = "medium"
	AlertSeverityLow      AlertSeverity = "low"
)

type AlertStatus string

const (
	AlertStatusOpen       AlertStatus = "open"
	AlertStatusAcknowledged AlertStatus = "acknowledged"
	AlertStatusResolved   AlertStatus = "resolved"
	AlertStatusFalsePositive AlertStatus = "false_positive"
)

// AuditEvent 表示审计事件
type AuditEvent struct {
	ID          string          `json:"id"`
	EventType   AuditEventType  `json:"event_type"`
	
	// 事件时间线
	Timestamp   time.Time       `json:"timestamp"`
	Sequence    int64           `json:"sequence"`
	
	// 关联实体
	ConnectionID *string        `json:"connection_id,omitempty"`
	RequestID    *string        `json:"request_id,omitempty"`
	TenantID     *string        `json:"tenant_id,omitempty"`
	
	// 事件详情
	Description string          `json:"description"`
	Details     interface{}     `json:"details"`
	
	// 来源
	Source      string          `json:"source"` // import/api/analysis
}

type AuditEventType string

const (
	AuditEventTypePoolImport       AuditEventType = "pool_import"
	AuditEventTypeConnectionBorrow AuditEventType = "connection_borrow"
	AuditEventTypeConnectionReturn AuditEventType = "connection_return"
	AuditEventTypeWaitEnqueue      AuditEventType = "wait_enqueue"
	AuditEventTypeWaitDequeue      AuditEventType = "wait_dequeue"
	AuditEventTypeWaitTimeout      AuditEventType = "wait_timeout"
	AuditEventTypeSQLStart         AuditEventType = "sql_start"
	AuditEventTypeSQLEnd           AuditEventType = "sql_end"
	AuditEventTypeTransactionBegin AuditEventType = "transaction_begin"
	AuditEventTypeTransactionEnd   AuditEventType = "transaction_end"
	AuditEventTypeAlertRaised      AuditEventType = "alert_raised"
	AuditEventTypeAlertAcknowledged AuditEventType = "alert_acknowledged"
	AuditEventTypeAlertResolved    AuditEventType = "alert_resolved"
	AuditEventTypeConfigChange     AuditEventType = "config_change"
	AuditEventTypeReportGenerated  AuditEventType = "report_generated"
)

// PoolEvent 表示连接池事件（用于 JSONL 导入）
type PoolEvent struct {
	EventType     string            `json:"event_type"`
	Timestamp     time.Time         `json:"timestamp"`
	ConnectionID  string            `json:"connection_id"`
	RequestID     string            `json:"request_id"`
	TenantID      string            `json:"tenant_id"`
	
	// 借入/归还特定字段
	WaitDuration  *time.Duration    `json:"wait_duration,omitempty"`
	ReturnReason  *string           `json:"return_reason,omitempty"`
	
	// 事务特定字段
	TransactionID *string           `json:"transaction_id,omitempty"`
	Status        *string           `json:"status,omitempty"`
	
	// SQL 特定字段
	SQLText       *string           `json:"sql_text,omitempty"`
	Duration      *time.Duration    `json:"duration,omitempty"`
	IsSlow        *bool             `json:"is_slow,omitempty"`
	
	// 错误信息
	Error         *string           `json:"error,omitempty"`
	
	// 额外属性
	Attributes    map[string]interface{} `json:"attributes,omitempty"`
}

// ImportResult 表示导入结果
type ImportResult struct {
	TotalRecords    int64 `json:"total_records"`
	SuccessRecords  int64 `json:"success_records"`
	FailedRecords   int64 `json:"failed_records"`
	Errors          []ImportError `json:"errors,omitempty"`
}

type ImportError struct {
	LineNumber    int    `json:"line_number"`
	RecordType    string `json:"record_type"`
	Error         string `json:"error"`
	RawRecord     string `json:"raw_record,omitempty"`
}

// TimelineEvent 时间线事件
type TimelineEvent struct {
	Timestamp   time.Time       `json:"timestamp"`
	Type        string          `json:"type"`
	Description string          `json:"description"`
	Details     interface{}     `json:"details"`
}

// AnalysisResult 分析结果
type AnalysisResult struct {
	AnalysisTime   time.Time       `json:"analysis_time"`
	Alerts         []Alert         `json:"alerts"`
	Summary        AnalysisSummary `json:"summary"`
}

type AnalysisSummary struct {
	TotalAlerts              int     `json:"total_alerts"`
	CriticalAlerts           int     `json:"critical_alerts"`
	HighAlerts               int     `json:"high_alerts"`
	MediumAlerts             int     `json:"medium_alerts"`
	LowAlerts                int     `json:"low_alerts"`
	
	ActiveConnections        int     `json:"active_connections"`
	SuspiciousConnections    int     `json:"suspicious_connections"`
	WaitingRequests          int     `json:"waiting_requests"`
	LongRunningTransactions  int     `json:"long_running_transactions"`
	SlowSQLCount             int     `json:"slow_sql_count"`
	
	AvgWaitTime              time.Duration `json:"avg_wait_time"`
	MaxWaitTime              time.Duration `json:"max_wait_time"`
}

// ConfigSimulation 配置模拟结果
type ConfigSimulation struct {
	OriginalConfig   PoolConfig      `json:"original_config"`
	ProposedConfig   PoolConfig      `json:"proposed_config"`
	ExpectedImprovements []Improvement `json:"expected_improvements"`
	Risks            []Risk          `json:"risks"`
}

type PoolConfig struct {
	MaxOpen     int           `json:"max_open"`
	MaxIdle     int           `json:"max_idle"`
	IdleTimeout time.Duration `json:"idle_timeout"`
	TenantQuota int           `json:"tenant_quota"`
}

type Improvement struct {
	Metric          string  `json:"metric"`
	OriginalValue   float64 `json:"original_value"`
	ExpectedValue   float64 `json:"expected_value"`
	ImprovementPct  float64 `json:"improvement_pct"`
}

type Risk struct {
	Description string `json:"description"`
	Severity    string `json:"severity"`
	Mitigation  string `json:"mitigation"`
}

// ReportExport 报告导出
type ReportExport struct {
	Format       string    `json:"format"` // markdown/json/csv
	GeneratedAt  time.Time `json:"generated_at"`
	Content      string    `json:"content"`
}
