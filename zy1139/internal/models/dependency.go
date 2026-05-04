package models

type DependencyLimit struct {
	Name          string         `yaml:"name" json:"name"`
	Type          DependencyType `yaml:"type" json:"type"`
	MaxQPS        int            `yaml:"max_qps" json:"max_qps"`
	MaxConcurrent int            `yaml:"max_concurrent" json:"max_concurrent"`
	MaxLatencyMs  float64        `yaml:"max_latency_ms" json:"max_latency_ms"`
	TimeoutMs     float64        `yaml:"timeout_ms" json:"timeout_ms"`
	ConnectionPool *ConnectionPoolLimit `yaml:"connection_pool,omitempty" json:"connection_pool,omitempty"`
}

type DependencyType string

const (
	DependencyTypeDatabase   DependencyType = "database"
	DependencyTypeCache      DependencyType = "cache"
	DependencyTypeHTTP       DependencyType = "http"
	DependencyTypeGRPC       DependencyType = "grpc"
	DependencyTypeMessageQueue DependencyType = "mq"
)

type ConnectionPoolLimit struct {
	MaxConnections   int `yaml:"max_connections" json:"max_connections"`
	MaxIdleConnections int `yaml:"max_idle_connections" json:"max_idle_connections"`
}
