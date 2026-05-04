package models

import "time"

type RetryPolicy struct {
	Strategy     string        `json:"strategy" yaml:"strategy"`
	InitialDelay time.Duration `json:"initial_delay" yaml:"initial_delay"`
	MaxDelay     time.Duration `json:"max_delay" yaml:"max_delay"`
	Multiplier   float64       `json:"multiplier" yaml:"multiplier"`
	Jitter       float64       `json:"jitter" yaml:"jitter"`
}

type PriorityConfig struct {
	Level        int     `json:"level" yaml:"level"`
	Weight       float64 `json:"weight" yaml:"weight"`
	QuotaPercent float64 `json:"quota_percent" yaml:"quota_percent"`
}

type QueueConfig struct {
	Name             string           `json:"name" yaml:"name"`
	JobTypes         []string         `json:"job_types" yaml:"job_types"`
	WorkerConcurrency int             `json:"worker_concurrency" yaml:"worker_concurrency"`
	BatchSize        int              `json:"batch_size" yaml:"batch_size"`
	PollInterval     time.Duration    `json:"poll_interval" yaml:"poll_interval"`
	DefaultTimeout   time.Duration    `json:"default_timeout" yaml:"default_timeout"`
	MaxRetries       int              `json:"max_retries" yaml:"max_retries"`
	RetryPolicy      *RetryPolicy     `json:"retry_policy,omitempty" yaml:"retry_policy,omitempty"`
	PriorityConfig   []PriorityConfig `json:"priority_config,omitempty" yaml:"priority_config,omitempty"`
	DeadLetterQueue  string           `json:"dead_letter_queue,omitempty" yaml:"dead_letter_queue,omitempty"`
}

type WorkerPoolConfig struct {
	Name             string        `json:"name" yaml:"name"`
	WorkerCount      int           `json:"worker_count" yaml:"worker_count"`
	QueueNames       []string      `json:"queue_names" yaml:"queue_names"`
	ConcurrencyPerWorker int       `json:"concurrency_per_worker" yaml:"concurrency_per_worker"`
	BatchSize        int           `json:"batch_size" yaml:"batch_size"`
	PollInterval     time.Duration `json:"poll_interval" yaml:"poll_interval"`
}

type AnalysisConfig struct {
	StartAt     *time.Time `json:"start_at,omitempty" yaml:"start_at,omitempty"`
	EndAt       *time.Time `json:"end_at,omitempty" yaml:"end_at,omitempty"`
	QueueNames  []string   `json:"queue_names,omitempty" yaml:"queue_names,omitempty"`
	JobTypes    []string   `json:"job_types,omitempty" yaml:"job_types,omitempty"`
	Percentiles []float64  `json:"percentiles,omitempty" yaml:"percentiles,omitempty"`
}

type SimulationConfig struct {
	Name                 string              `json:"name" yaml:"name"`
	Description          string              `json:"description" yaml:"description"`
	WorkerPools          []WorkerPoolConfig  `json:"worker_pools,omitempty" yaml:"worker_pools,omitempty"`
	Queues               []QueueConfig       `json:"queues,omitempty" yaml:"queues,omitempty"`
	DefaultRetryPolicy   *RetryPolicy        `json:"default_retry_policy,omitempty" yaml:"default_retry_policy,omitempty"`
	GlobalConcurrency    int                 `json:"global_concurrency,omitempty" yaml:"global_concurrency,omitempty"`
	SimulationDuration   time.Duration       `json:"simulation_duration" yaml:"simulation_duration"`
}

type FullConfig struct {
	Version     string             `json:"version" yaml:"version"`
	Name        string             `json:"name" yaml:"name"`
	Queues      []QueueConfig      `json:"queues" yaml:"queues"`
	WorkerPools []WorkerPoolConfig `json:"worker_pools" yaml:"worker_pools"`
	Analysis    *AnalysisConfig    `json:"analysis,omitempty" yaml:"analysis,omitempty"`
	Simulations []SimulationConfig `json:"simulations,omitempty" yaml:"simulations,omitempty"`
	DefaultRetryPolicy *RetryPolicy `json:"default_retry_policy,omitempty" yaml:"default_retry_policy,omitempty"`
}
