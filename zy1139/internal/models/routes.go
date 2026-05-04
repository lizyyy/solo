package models

type Route struct {
	Name        string            `yaml:"name" json:"name"`
	Path        string            `yaml:"path" json:"path"`
	Method      string            `yaml:"method" json:"method"`
	Description string            `yaml:"description" json:"description,omitempty"`
	Tags        []string          `yaml:"tags" json:"tags,omitempty"`
	Budget      RouteBudget       `yaml:"budget" json:"budget"`
	Dependencies []DependencyRef  `yaml:"dependencies" json:"dependencies,omitempty"`
}

type RouteBudget struct {
	P95LatencyMs  float64 `yaml:"p95_latency_ms" json:"p95_latency_ms"`
	P99LatencyMs  float64 `yaml:"p99_latency_ms" json:"p99_latency_ms"`
	MaxErrorRate  float64 `yaml:"max_error_rate" json:"max_error_rate"`
	MaxRPS        int     `yaml:"max_rps" json:"max_rps"`
	MaxConcurrent int     `yaml:"max_concurrent" json:"max_concurrent"`
	CPUBudgetPercent float64 `yaml:"cpu_budget_percent" json:"cpu_budget_percent"`
	MemoryBudgetMB int `yaml:"memory_budget_mb" json:"memory_budget_mb"`
}

type DependencyRef struct {
	Name string `yaml:"name" json:"name"`
	Factor float64 `yaml:"factor" json:"factor"`
}
