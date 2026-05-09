package config

import (
	"fmt"
	"path/filepath"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	Tracing  TracingConfig  `mapstructure:"tracing"`
	Mock     MockConfig     `mapstructure:"mock"`
	Traffic  TrafficConfig  `mapstructure:"traffic"`
	Logging  LoggingConfig  `mapstructure:"logging"`
}

type ServerConfig struct {
	GRPCPort int `mapstructure:"grpc_port"`
	HTTPPort int `mapstructure:"http_port"`
	MockPort int `mapstructure:"mock_port"`
}

type DatabaseConfig struct {
	Host     string `mapstructure:"host"`
	Port     int    `mapstructure:"port"`
	User     string `mapstructure:"user"`
	Password string `mapstructure:"password"`
	DBName   string `mapstructure:"dbname"`
	SSLMode  string `mapstructure:"sslmode"`
}

type TracingConfig struct {
	Enabled       bool   `mapstructure:"enabled"`
	JaegerEndpoint string `mapstructure:"jaeger_endpoint"`
	ServiceName   string `mapstructure:"service_name"`
}

type MockConfig struct {
	DefaultDelayMs     int  `mapstructure:"default_delay_ms"`
	MaxDelayMs         int  `mapstructure:"max_delay_ms"`
	EnableFaultInjection bool `mapstructure:"enable_fault_injection"`
}

type TrafficConfig struct {
	MaxConcurrentRequests int `mapstructure:"max_concurrent_requests"`
	DefaultTimeoutMs      int `mapstructure:"default_timeout_ms"`
}

type LoggingConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
}

func Load(configPath ...string) (*Config, error) {
	v := viper.New()
	v.SetConfigType("yaml")

	if len(configPath) > 0 && configPath[0] != "" {
		v.SetConfigFile(configPath[0])
	} else {
		v.AddConfigPath(".")
		v.AddConfigPath("./config")
		v.AddConfigPath("/etc/api-guardian")
		v.SetConfigName("config")
	}

	v.AutomaticEnv()
	v.SetEnvPrefix("API_GUARDIAN")

	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); ok {
			return nil, fmt.Errorf("config file not found: %w", err)
		}
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

func (d DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		d.Host, d.Port, d.User, d.Password, d.DBName, d.SSLMode,
	)
}

func ConfigDir() string {
	return filepath.Join(".", "config")
}
