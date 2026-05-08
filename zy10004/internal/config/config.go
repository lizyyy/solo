package config

import (
	"fmt"
	"io/ioutil"

	"gopkg.in/yaml.v2"
)

type Config struct {
	Server      ServerConfig      `yaml:"server"`
	Database    DatabaseConfig    `yaml:"database"`
	Redis       RedisConfig       `yaml:"redis"`
	RabbitMQ    RabbitMQConfig    `yaml:"rabbitmq"`
	Tracing     TracingConfig     `yaml:"tracing"`
	Chaos       ChaosConfig       `yaml:"chaos"`
	Logging     LoggingConfig     `yaml:"logging"`
}

type ServerConfig struct {
	Gateway        ServicePortConfig `yaml:"gateway"`
	OrderService   ServicePortConfig `yaml:"order_service"`
	PaymentService ServicePortConfig `yaml:"payment_service"`
	InventoryService ServicePortConfig `yaml:"inventory_service"`
	ControlCenter  ServicePortConfig `yaml:"control_center"`
}

type ServicePortConfig struct {
	Port     int `yaml:"port"`
	GRPCPort int `yaml:"grpc_port,omitempty"`
}

type DatabaseConfig struct {
	Type   string       `yaml:"type"`
	SQLite SQLiteConfig `yaml:"sqlite"`
}

type SQLiteConfig struct {
	Path string `yaml:"path"`
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
}

type RabbitMQConfig struct {
	Host     string           `yaml:"host"`
	Port     int              `yaml:"port"`
	Username string           `yaml:"username"`
	Password string           `yaml:"password"`
	VHost    string           `yaml:"vhost"`
	Exchange string           `yaml:"exchange"`
	Queue    RabbitMQQueues   `yaml:"queue"`
}

type RabbitMQQueues struct {
	Order      string `yaml:"order"`
	Payment    string `yaml:"payment"`
	Inventory  string `yaml:"inventory"`
	DeadLetter string `yaml:"dead_letter"`
}

type TracingConfig struct {
	Enabled  bool           `yaml:"enabled"`
	OTEL     OTELConfig     `yaml:"otel"`
	Business BusinessConfig `yaml:"business"`
}

type OTELConfig struct {
	Endpoint    string `yaml:"endpoint"`
	ServiceName string `yaml:"service_name"`
}

type BusinessConfig struct {
	Enabled bool   `yaml:"enabled"`
	Storage string `yaml:"storage"`
}

type ChaosConfig struct {
	DefaultTimeoutMS int                 `yaml:"default_timeout_ms"`
	MaxRetries       int                 `yaml:"max_retries"`
	RetryBackoffMS   int                 `yaml:"retry_backoff_ms"`
	CircuitBreaker   CircuitBreakerConfig `yaml:"circuit_breaker"`
}

type CircuitBreakerConfig struct {
	Enabled          bool    `yaml:"enabled"`
	FailureThreshold float64 `yaml:"failure_threshold"`
	SuccessThreshold float64 `yaml:"success_threshold"`
	TimeoutMS        int     `yaml:"timeout_ms"`
}

type LoggingConfig struct {
	Level  string `yaml:"level"`
	Format string `yaml:"format"`
	Output string `yaml:"output"`
}

func Load(path string) (*Config, error) {
	data, err := ioutil.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config file: %w", err)
	}

	cfg.applyDefaults()
	return &cfg, nil
}

func (c *Config) applyDefaults() {
	if c.Chaos.DefaultTimeoutMS == 0 {
		c.Chaos.DefaultTimeoutMS = 1000
	}
	if c.Chaos.MaxRetries == 0 {
		c.Chaos.MaxRetries = 3
	}
	if c.Chaos.RetryBackoffMS == 0 {
		c.Chaos.RetryBackoffMS = 100
	}
	if c.Logging.Level == "" {
		c.Logging.Level = "info"
	}
	if c.Logging.Format == "" {
		c.Logging.Format = "json"
	}
}
