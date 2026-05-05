package model

import (
	"time"
)

type RiskLevel string

const (
	RiskCritical RiskLevel = "critical"
	RiskHigh     RiskLevel = "high"
	RiskMedium   RiskLevel = "medium"
	RiskLow      RiskLevel = "low"
	RiskInfo     RiskLevel = "info"
)

type AnalysisSession struct {
	ID        int64
	SessionID string
	CreatedAt time.Time
	Config    []byte
	TotalCalls int
	RiskCount  int
}

type CallRecord struct {
	ID              int64
	SessionID       string
	Caller          string
	Callee          string
	Method          string
	HasDeadline     bool
	Deadline        time.Time
	TimeoutBudget   time.Duration
	HasCancel       bool
	CancelPropagated bool
	UsesBackground  bool
	UsesTODO        bool
	WithValueKeys   []string
	IsGoroutine     bool
	CancelCalled    bool
	SourceFile      string
	LineNumber      int
	RawData         []byte
}

type RiskIssue struct {
	ID          int64
	SessionID   string
	CallID      int64
	Category    string
	Level       RiskLevel
	Title       string
	Description string
	Suggestion  string
	Caller      string
	Callee      string
	SourceFile  string
	LineNumber  int
}

type BudgetAllocation struct {
	ID            int64
	SessionID     string
	Caller        string
	Callee        string
	TotalBudget   time.Duration
	UsedBudget    time.Duration
	Remaining     time.Duration
	Percentage    float64
	IsCritical    bool
}

type AnalysisResult struct {
	Session        AnalysisSession
	Calls          []CallRecord
	Risks          []RiskIssue
	Budgets        []BudgetAllocation
	BudgetWaterfall []BudgetSegment
}

type BudgetSegment struct {
	Caller      string
	Callee      string
	Allocated   time.Duration
	Used        time.Duration
	Remaining   time.Duration
	Percentage  float64
	Level       string
}

type ContextPlan struct {
	APIName       string            `yaml:"api_name"`
	Description   string            `yaml:"description"`
	EntryPoint    string            `yaml:"entry_point"`
	TotalTimeout  time.Duration     `yaml:"total_timeout"`
	CallChain     []CallStep        `yaml:"call_chain"`
	Budgets       map[string]Budget `yaml:"budgets"`
	AllowedValues []string          `yaml:"allowed_withvalue_keys"`
}

type CallStep struct {
	From         string        `yaml:"from"`
	To           string        `yaml:"to"`
	Timeout      time.Duration `yaml:"timeout"`
	RequiresCancel bool        `yaml:"requires_cancel"`
	IsGoroutine  bool          `yaml:"is_goroutine"`
}

type Budget struct {
	Service     string        `yaml:"service"`
	Allocation  time.Duration `yaml:"allocation"`
	Percentage  float64       `yaml:"percentage"`
}
