package model

import (
	"time"

	"github.com/google/uuid"
)

type RuleStatus string

const (
	RuleStatusActive   RuleStatus = "active"
	RuleStatusPaused   RuleStatus = "paused"
	RuleStatusTriggered RuleStatus = "triggered"
	RuleStatusRestored RuleStatus = "restored"
	RuleStatusRevoked  RuleStatus = "revoked"
)

type ProtectionAction string

const (
	ActionRejectNewConn ProtectionAction = "reject_new_conn"
	ActionSlowDown      ProtectionAction = "slow_down"
	ActionCircuitBreak  ProtectionAction = "circuit_break"
)

type ProtectionRule struct {
	ID            string           `json:"id"`
	Version       int              `json:"version"`
	Name          string           `json:"name"`
	APIPath       string           `json:"api_path"`
	PoolName      string           `json:"pool_name"`
	Description   string           `json:"description"`
	Status        RuleStatus       `json:"status"`
	Thresholds    ThresholdConfig  `json:"thresholds"`
	Action        ProtectionAction `json:"action"`
	ActionParams  map[string]any   `json:"action_params"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
	CreatedBy     string           `json:"created_by"`
	RequestID     string           `json:"request_id"`
}

type ThresholdConfig struct {
	MaxActiveConn   int `json:"max_active_conn"`
	MaxWaitTimeMs   int `json:"max_wait_time_ms"`
	SlowQueryTimeMs int `json:"slow_query_time_ms"`
	ErrorRateThreshold float64 `json:"error_rate_threshold"`
}

type ConnectionStats struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"rule_id"`
	APIPath     string    `json:"api_path"`
	PoolName    string    `json:"pool_name"`
	ActiveConn  int       `json:"active_conn"`
	IdleConn    int       `json:"idle_conn"`
	WaitCount   int       `json:"wait_count"`
	WaitTimeAvg int       `json:"wait_time_avg_ms"`
	Timestamp   time.Time `json:"timestamp"`
}

type SlowQueryRecord struct {
	ID          string    `json:"id"`
	RuleID      string    `json:"rule_id"`
	APIPath     string    `json:"api_path"`
	SQL         string    `json:"sql"`
	DurationMs  int       `json:"duration_ms"`
	TraceID     string    `json:"trace_id"`
	Timestamp   time.Time `json:"timestamp"`
}

type ProtectionEvent struct {
	ID          string           `json:"id"`
	RuleID      string           `json:"rule_id"`
	RuleVersion int              `json:"rule_version"`
	APIPath     string           `json:"api_path"`
	PoolName    string           `json:"pool_name"`
	Action      ProtectionAction `json:"action"`
	Reason      string           `json:"reason"`
	TriggerData map[string]any   `json:"trigger_data"`
	Timestamp   time.Time        `json:"timestamp"`
	Operator    string           `json:"operator"`
}

type RestoreRecord struct {
	ID         string    `json:"id"`
	RuleID     string    `json:"rule_id"`
	EventID    string    `json:"event_id"`
	Reason     string    `json:"reason"`
	CheckData  map[string]any `json:"check_data"`
	Confirmed  bool      `json:"confirmed"`
	Timestamp  time.Time `json:"timestamp"`
	Operator   string    `json:"operator"`
}

type HistoryRecord struct {
	ID         string    `json:"id"`
	ResourceID string    `json:"resource_id"`
	ResourceType string  `json:"resource_type"`
	Action     string    `json:"action"`
	Before     any       `json:"before"`
	After      any       `json:"after"`
	Operator   string    `json:"operator"`
	RequestID  string    `json:"request_id"`
	Timestamp  time.Time `json:"timestamp"`
}

type OverviewStats struct {
	TotalRules        int            `json:"total_rules"`
	ActiveRules       int            `json:"active_rules"`
	TriggeredRules    int            `json:"triggered_rules"`
	TodayProtection   int            `json:"today_protection"`
	TodayRestore      int            `json:"today_restore"`
	TopSlowAPIs       []SlowAPIInfo  `json:"top_slow_apis"`
	PoolStatusList    []PoolStatus   `json:"pool_status_list"`
}

type SlowAPIInfo struct {
	APIPath     string `json:"api_path"`
	Count       int    `json:"count"`
	AvgDuration int    `json:"avg_duration_ms"`
}

type PoolStatus struct {
	PoolName    string `json:"pool_name"`
	ActiveConn  int    `json:"active_conn"`
	UsageRate   float64 `json:"usage_rate"`
}

func NewUUID() string {
	return uuid.NewString()
}
