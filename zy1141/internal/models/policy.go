package models

type Policy struct {
	ServiceName string          `yaml:"service_name" json:"service_name"`
	Endpoint    string          `yaml:"endpoint,omitempty" json:"endpoint,omitempty"`
	SLO         SLOConfig       `yaml:"slo" json:"slo"`
	RateLimit   RateLimitConfig `yaml:"rate_limit" json:"rate_limit"`
	Tags        []string        `yaml:"tags,omitempty" json:"tags,omitempty"`
}

type SLOConfig struct {
	Availability float64 `yaml:"availability" json:"availability"`
	LatencyP99   int     `yaml:"latency_p99_ms" json:"latency_p99_ms"`
	LatencyP95   int     `yaml:"latency_p95_ms" json:"latency_p95_ms"`
	ErrorBudget  float64 `yaml:"error_budget" json:"error_budget"`
}

type RateLimitConfig struct {
	MaxRequests   int `yaml:"max_requests" json:"max_requests"`
	WindowSeconds int `yaml:"window_seconds" json:"window_seconds"`
	Burst         int `yaml:"burst,omitempty" json:"burst,omitempty"`
}
