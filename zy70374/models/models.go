package models

import (
	"encoding/json"
	"sync"
	"time"
)

type StrategyType string

const (
	RiskControl   StrategyType = "risk_control"
	DiscountElig  StrategyType = "discount_eligibility"
	Permission    StrategyType = "permission"
)

type Decision string

const (
	DecisionPass    Decision = "pass"
	DecisionReject  Decision = "reject"
	DecisionDefer   Decision = "defer"
)

type FreezeStatus string

const (
	StatusDraft     FreezeStatus = "draft"
	StatusPublished FreezeStatus = "published"
	StatusFrozen    FreezeStatus = "frozen"
)

type Operator string

const (
	OpEqual          Operator = "=="
	OpNotEqual       Operator = "!="
	OpGreaterThan    Operator = ">"
	OpGreaterOrEqual Operator = ">="
	OpLessThan       Operator = "<"
	OpLessOrEqual    Operator = "<="
	OpContains       Operator = "contains"
	OpIn             Operator = "in"
	OpRegex          Operator = "regex"
	OpAnd            Operator = "and"
	OpOr             Operator = "or"
)

type Condition struct {
	ID          string                 `json:"id"`
	Field       string                 `json:"field"`
	Operator    Operator               `json:"operator"`
	Expected    interface{}            `json:"expected"`
	Description string                 `json:"description"`
	Children    []Condition            `json:"children,omitempty"`
	ShortCircuit bool                  `json:"short_circuit,omitempty"`
}

type Rule struct {
	ID          string      `json:"id"`
	Name        string      `json:"name"`
	Description string      `json:"description"`
	Conditions  []Condition `json:"conditions"`
	MatchAll    bool        `json:"match_all"`
	Decision    Decision    `json:"decision"`
}

type StrategyVersion struct {
	Version      int          `json:"version"`
	Status       FreezeStatus `json:"status"`
	Rules        []Rule       `json:"rules"`
	CreatedAt    time.Time    `json:"created_at"`
	PublishedAt  *time.Time   `json:"published_at,omitempty"`
	FrozenAt     *time.Time   `json:"frozen_at,omitempty"`
}

type Strategy struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	Type             StrategyType      `json:"type"`
	Description      string            `json:"description"`
	CurrentVersion   int               `json:"current_version"`
	PublishedVersion int               `json:"published_version"`
	Versions         []StrategyVersion `json:"versions"`
	CreatedAt        time.Time         `json:"created_at"`
	UpdatedAt        time.Time         `json:"updated_at"`
}

type ConditionResult struct {
	ConditionID   string      `json:"condition_id"`
	Field         string      `json:"field"`
	InputValue    interface{} `json:"input_value"`
	ExpectedValue interface{} `json:"expected_value"`
	Operator      Operator    `json:"operator"`
	Match         bool        `json:"match"`
	ShortCircuit  bool        `json:"short_circuit"`
	ShortCircuitReason string `json:"short_circuit_reason,omitempty"`
}

type RuleResult struct {
	RuleID          string            `json:"rule_id"`
	RuleName        string            `json:"rule_name"`
	Decision        Decision          `json:"decision"`
	Matched         bool              `json:"matched"`
	ConditionCount  int               `json:"condition_count"`
	MatchedCount    int               `json:"matched_count"`
	ConditionPath   []string          `json:"condition_path"`
	ConditionResults []ConditionResult `json:"condition_results"`
}

type DecisionResult struct {
	DecisionID      string            `json:"decision_id"`
	StrategyID      string            `json:"strategy_id"`
	StrategyType    StrategyType      `json:"strategy_type"`
	StrategyVersion int               `json:"strategy_version"`
	Decision        Decision          `json:"decision"`
	RequestID       string            `json:"request_id"`
	Context         map[string]interface{} `json:"context"`
	RuleResults     []RuleResult      `json:"rule_results"`
	SimpleExplanation string           `json:"simple_explanation"`
	DetailedExplanation string         `json:"detailed_explanation"`
	DecidedAt       time.Time         `json:"decided_at"`
}

type CreateStrategyRequest struct {
	Name        string       `json:"name" binding:"required"`
	Type        StrategyType `json:"type" binding:"required"`
	Description string       `json:"description"`
	Rules       []Rule       `json:"rules" binding:"required"`
}

type UpdateStrategyRequest struct {
	Rules       []Rule `json:"rules" binding:"required"`
	Description string `json:"description"`
}

type PublishStrategyRequest struct {
	Version int `json:"version" binding:"required"`
}

type FreezeStrategyRequest struct {
	Version int `json:"version" binding:"required"`
}

type RollbackStrategyRequest struct {
	ToVersion int `json:"to_version" binding:"required"`
}

type DecisionRequest struct {
	StrategyID string                 `json:"strategy_id" binding:"required"`
	RequestID  string                 `json:"request_id" binding:"required"`
	Context    map[string]interface{} `json:"context" binding:"required"`
}

type QueryDecisionRequest struct {
	DecisionID string `form:"decision_id"`
	RequestID  string `form:"request_id"`
}

var (
	strategies = make(map[string]*Strategy)
	decisions  = make(map[string]*DecisionResult)
	reqIDMap   = make(map[string]string)
	mu         sync.RWMutex
)

func init() {
	now := time.Now()
	
	risks := []Rule{
		{
			ID:          "risk-ip",
			Name:        "黑名单IP拦截",
			Description: "检测IP是否在黑名单",
			MatchAll:    true,
			Decision:    DecisionReject,
			Conditions: []Condition{
				{
					ID:          "c-ip",
					Field:       "ip_address",
					Operator:    OpIn,
					Expected:    []string{"192.168.1.1", "10.0.0.5"},
					Description: "IP黑名单",
					ShortCircuit: true,
				},
			},
		},
		{
			ID:          "risk-age",
			Name:        "高危账户拦截",
			Description: "注册不满24小时且单笔>10000",
			MatchAll:    true,
			Decision:    DecisionReject,
			Conditions: []Condition{
				{
					ID:          "c-age",
					Field:       "account_age_hours",
					Operator:    OpLessThan,
					Expected:    24,
					Description: "注册不满24h",
				},
				{
					ID:          "c-amt",
					Field:       "transaction_amount",
					Operator:    OpGreaterThan,
					Expected:    10000,
					Description: "金额超限",
					ShortCircuit: true,
				},
			},
		},
	}
	
	discounts := []Rule{
		{
			ID:          "disc-vip",
			Name:        "VIP用户优惠通过",
			Description: "VIP用户享受优惠",
			MatchAll:    true,
			Decision:    DecisionPass,
			Conditions: []Condition{
				{
					ID:          "c-vip",
					Field:       "user_level",
					Operator:    OpEqual,
					Expected:    "VIP",
					Description: "VIP等级",
				},
			},
		},
		{
			ID:          "disc-score",
			Name:        "积分达标优惠通过",
			Description: "积分>=5000",
			MatchAll:    true,
			Decision:    DecisionPass,
			Conditions: []Condition{
				{
					ID:          "c-score",
					Field:       "user_score",
					Operator:    OpGreaterOrEqual,
					Expected:    5000,
					Description: "积分达标",
				},
			},
		},
		{
			ID:          "disc-reject",
			Name:        "默认拒绝",
			Description: "无匹配规则则拒绝",
			MatchAll:    true,
			Decision:    DecisionReject,
			Conditions:  []Condition{},
		},
	}
	
	now2 := now
	strategies["risk-strategy"] = &Strategy{
		ID:               "risk-strategy",
		Name:             "风控拦截策略",
		Type:             RiskControl,
		Description:      "风控拦截",
		CurrentVersion:   1,
		PublishedVersion: 1,
		CreatedAt:        now,
		UpdatedAt:        now,
		Versions: []StrategyVersion{
			{
				Version:     1,
				Status:      StatusPublished,
				Rules:       risks,
				CreatedAt:   now,
				PublishedAt: &now2,
			},
		},
	}
	
	strategies["discount-strategy"] = &Strategy{
		ID:               "discount-strategy",
		Name:             "优惠资格策略",
		Type:             DiscountElig,
		Description:      "优惠资格",
		CurrentVersion:   1,
		PublishedVersion: 1,
		CreatedAt:        now,
		UpdatedAt:        now,
		Versions: []StrategyVersion{
			{
				Version:     1,
				Status:      StatusPublished,
				Rules:       discounts,
				CreatedAt:   now,
				PublishedAt: &now2,
			},
		},
	}
}

func SaveStrategy(s *Strategy) {
	mu.Lock()
	defer mu.Unlock()
	s.UpdatedAt = time.Now()
	strategies[s.ID] = s
}

func GetStrategy(id string) (*Strategy, bool) {
	mu.RLock()
	defer mu.RUnlock()
	s, ok := strategies[id]
	if !ok {
		return nil, false
	}
	cpy := *s
	b, _ := json.Marshal(s.Versions)
	json.Unmarshal(b, &cpy.Versions)
	return &cpy, true
}

func ListStrategies() []*Strategy {
	mu.RLock()
	defer mu.RUnlock()
	out := make([]*Strategy, 0, len(strategies))
	for _, s := range strategies {
		cpy := *s
		out = append(out, &cpy)
	}
	return out
}

func SaveDecision(d *DecisionResult) {
	mu.Lock()
	defer mu.Unlock()
	decisions[d.DecisionID] = d
	reqIDMap[d.RequestID] = d.DecisionID
}

func GetDecisionByID(id string) (*DecisionResult, bool) {
	mu.RLock()
	defer mu.RUnlock()
	d, ok := decisions[id]
	if !ok {
		return nil, false
	}
	cpy := *d
	return &cpy, true
}

func GetDecisionByRequestID(reqID string) (*DecisionResult, bool) {
	mu.RLock()
	defer mu.RUnlock()
	decID, ok := reqIDMap[reqID]
	if !ok {
		return nil, false
	}
	d, ok := decisions[decID]
	if !ok {
		return nil, false
	}
	cpy := *d
	return &cpy, true
}
