package config

import (
	"fmt"
	"path/filepath"
	"strings"

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
	Enabled        bool   `mapstructure:"enabled"`
	JaegerEndpoint string `mapstructure:"jaeger_endpoint"`
	ServiceName    string `mapstructure:"service_name"`
}

type MockConfig struct {
	DefaultDelayMs       int  `mapstructure:"default_delay_ms"`
	MaxDelayMs           int  `mapstructure:"max_delay_ms"`
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
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	setupEnvBindings(v)

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

	applyEnvOverrides(v, &config)

	return &config, nil
}

func setupEnvBindings(v *viper.Viper) {
	bindings := []string{
		"server.grpc_port",
		"server.http_port",
		"server.mock_port",
		"database.host",
		"database.port",
		"database.user",
		"database.password",
		"database.dbname",
		"database.sslmode",
		"tracing.enabled",
		"tracing.jaeger_endpoint",
		"tracing.service_name",
		"mock.default_delay_ms",
		"mock.max_delay_ms",
		"mock.enable_fault_injection",
		"traffic.max_concurrent_requests",
		"traffic.default_timeout_ms",
		"logging.level",
		"logging.format",
	}

	for _, key := range bindings {
		v.BindEnv(key)
	}
}

func applyEnvOverrides(v *viper.Viper, cfg *Config) {
	if v.IsSet("database.host") {
		cfg.Database.Host = v.GetString("database.host")
	}
	if v.IsSet("database.port") {
		cfg.Database.Port = v.GetInt("database.port")
	}
	if v.IsSet("database.user") {
		cfg.Database.User = v.GetString("database.user")
	}
	if v.IsSet("database.password") {
		cfg.Database.Password = v.GetString("database.password")
	}
	if v.IsSet("database.dbname") {
		cfg.Database.DBName = v.GetString("database.dbname")
	}
	if v.IsSet("database.sslmode") {
		cfg.Database.SSLMode = v.GetString("database.sslmode")
	}

	if v.IsSet("tracing.enabled") {
		cfg.Tracing.Enabled = v.GetBool("tracing.enabled")
	}
	if v.IsSet("tracing.jaeger_endpoint") {
		cfg.Tracing.JaegerEndpoint = v.GetString("tracing.jaeger_endpoint")
	}
	if v.IsSet("tracing.service_name") {
		cfg.Tracing.ServiceName = v.GetString("tracing.service_name")
	}

	if v.IsSet("server.grpc_port") {
		cfg.Server.GRPCPort = v.GetInt("server.grpc_port")
	}
	if v.IsSet("server.http_port") {
		cfg.Server.HTTPPort = v.GetInt("server.http_port")
	}
	if v.IsSet("server.mock_port") {
		cfg.Server.MockPort = v.GetInt("server.mock_port")
	}

	if v.IsSet("logging.level") {
		cfg.Logging.Level = v.GetString("logging.level")
	}
	if v.IsSet("logging.format") {
		cfg.Logging.Format = v.GetString("logging.format")
	}
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
