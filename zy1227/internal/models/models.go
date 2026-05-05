package models

import (
	"database/sql"
	"time"
)

// SyncPrimitiveType 表示 sync 包原语类型
type SyncPrimitiveType string

const (
	SyncTypeMutex     SyncPrimitiveType = "Mutex"
	SyncTypeRWMutex   SyncPrimitiveType = "RWMutex"
	SyncTypeWaitGroup SyncPrimitiveType = "WaitGroup"
	SyncTypeOnce      SyncPrimitiveType = "Once"
	SyncTypeCond      SyncPrimitiveType = "Cond"
	SyncTypePool      SyncPrimitiveType = "Pool"
)

// IssueType 表示检测到的问题类型
type IssueType string

const (
	IssueLockOrderInversion       IssueType = "lock_order_inversion"
	IssueRWMutexStarvation         IssueType = "rwmutex_starvation"
	IssueWaitGroupCountError       IssueType = "waitgroup_count_error"
	IssueOnceInitFailedCache       IssueType = "once_init_failed_cache"
	IssueCondWakeupMiss            IssueType = "cond_wakeup_miss"
	IssuePoolMisuse                IssueType = "pool_misuse"
	IssueRaceCondition             IssueType = "race_condition"
)

// IssueSeverity 表示问题严重程度
type IssueSeverity string

const (
	SeverityCritical IssueSeverity = "critical"
	SeverityHigh     IssueSeverity = "high"
	SeverityMedium   IssueSeverity = "medium"
	SeverityLow      IssueSeverity = "low"
)

// AnalysisRun 表示一次分析运行
type AnalysisRun struct {
	ID        int64
	Name      string
	StartTime time.Time
	EndTime   sql.NullTime
	Status    string
	CreatedAt time.Time
	UpdatedAt time.Time
}

// SyncPrimitive 表示一个 sync 原语实例
type SyncPrimitive struct {
	ID           int64
	RunID        int64
	Type         SyncPrimitiveType
	Name         string
	Location     string
	File         string
	Line         int
	Declaration  string
	CreatedAt    time.Time
}

// SyncEvent 表示一个 sync 操作事件
type SyncEvent struct {
	ID           int64
	RunID        int64
	PrimitiveID  sql.NullInt64
	EventType    string
	PrimitiveName string
	PrimitiveType SyncPrimitiveType
	GoroutineID  int64
	Timestamp    time.Time
	Location     string
	File         string
	Line         int
	Details      string
	CreatedAt    time.Time
}

// Issue 表示检测到的问题
type Issue struct {
	ID           int64
	RunID        int64
	Type         IssueType
	Severity     IssueSeverity
	Title        string
	Description  string
	Location     string
	File         string
	Line         int
	CodeSnippet  string
	Suggestion   string
	References   string
	CreatedAt    time.Time
}

// SyncCase 表示从 sync-cases.yaml 解析的案例
type SyncCase struct {
	Name        string              `yaml:"name"`
	Description string              `yaml:"description"`
	Primitives  []PrimitiveConfig   `yaml:"primitives"`
	Events      []EventConfig       `yaml:"events"`
	Expectations []Expectation      `yaml:"expectations"`
}

// PrimitiveConfig 表示 sync 原语配置
type PrimitiveConfig struct {
	Type     SyncPrimitiveType `yaml:"type"`
	Name     string            `yaml:"name"`
	Location string            `yaml:"location"`
}

// EventConfig 表示事件配置
type EventConfig struct {
	PrimitiveName string            `yaml:"primitive_name"`
	PrimitiveType SyncPrimitiveType `yaml:"primitive_type"`
	EventType     string            `yaml:"event_type"`
	GoroutineID   int64             `yaml:"goroutine_id"`
	Timestamp     string            `yaml:"timestamp"`
	Location      string            `yaml:"location"`
	Details       string            `yaml:"details"`
}

// Expectation 表示预期结果
type Expectation struct {
	IssueType   IssueType `yaml:"issue_type"`
	ShouldExist bool      `yaml:"should_exist"`
	Description string    `yaml:"description"`
}

// CodeSnippet 表示解析的代码片段
type CodeSnippet struct {
	FilePath    string
	Content     string
	Primitives  []PrimitiveUsage
	Operations  []OperationUsage
}

// PrimitiveUsage 表示代码中 sync 原语的使用
type PrimitiveUsage struct {
	Type        SyncPrimitiveType
	Name        string
	Declaration string
	Location    CodeLocation
}

// OperationUsage 表示 sync 原语的操作使用
type OperationUsage struct {
	PrimitiveName string
	Operation     string
	Location      CodeLocation
}

// CodeLocation 表示代码位置
type CodeLocation struct {
	File string
	Line int
	Col  int
}

// AnalysisResult 表示分析结果
type AnalysisResult struct {
	RunID       int64
	RunName     string
	Primitives  []SyncPrimitive
	Events      []SyncEvent
	Issues      []Issue
	Summary     AnalysisSummary
}

// AnalysisSummary 表示分析摘要
type AnalysisSummary struct {
	TotalPrimitives int
	TotalEvents     int
	TotalIssues     int
	IssuesByType    map[IssueType]int
	IssuesBySeverity map[IssueSeverity]int
}

// ComparisonResult 表示两次分析的比较结果
type ComparisonResult struct {
	BaseRunID      int64
	BaseRunName    string
	CompareRunID   int64
	CompareRunName string
	NewIssues      []Issue
	FixedIssues    []Issue
	ChangedIssues  []IssueChange
	Summary        ComparisonSummary
}

// IssueChange 表示问题的变化
type IssueChange struct {
	IssueID      int64
	OldSeverity  IssueSeverity
	NewSeverity  IssueSeverity
	Description  string
}

// ComparisonSummary 表示比较摘要
type ComparisonSummary struct {
	NewIssueCount     int
	FixedIssueCount   int
	ChangedIssueCount int
}
