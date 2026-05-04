package models

type TrafficPlan struct {
	Version string `json:"version"`
	PlanName string `json:"plan_name"`
	Description string `json:"description,omitempty"`
	Routes []TrafficRoute `json:"routes"`
	Scenarios []Scenario `json:"scenarios,omitempty"`
}

type TrafficRoute struct {
	Name string `json:"name"`
	Weight float64 `json:"weight"`
	Steps []TrafficStep `json:"steps"`
}

type TrafficStep struct {
	DurationSec int `json:"duration_sec"`
	TargetRPS int `json:"target_rps"`
	ConcurrentUsers int `json:"concurrent_users"`
}

type Scenario struct {
	Name string `json:"name"`
	Description string `json:"description,omitempty"`
	Type ScenarioType `json:"type"`
	Params map[string]interface{} `json:"params"`
	ApplyRoutes []string `json:"apply_routes,omitempty"`
}

type ScenarioType string

const (
	ScenarioCacheMiss      ScenarioType = "cache_miss"
	ScenarioDownstreamSlow ScenarioType = "downstream_slow"
	ScenarioCircuitOpen    ScenarioType = "circuit_open"
	ScenarioRateLimit      ScenarioType = "rate_limit"
	ScenarioHighLatency    ScenarioType = "high_latency"
	ScenarioResourceStress ScenarioType = "resource_stress"
)
