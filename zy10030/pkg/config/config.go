package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server         ServerConfig         `mapstructure:"server"`
	Database       DatabaseConfig       `mapstructure:"database"`
	Kafka          KafkaConfig          `mapstructure:"kafka"`
	Log            LogConfig            `mapstructure:"log"`
	Trace          TraceConfig          `mapstructure:"trace"`
	GrayRelease    GrayReleaseConfig    `mapstructure:"gray_release"`
	Rollback       RollbackConfig       `mapstructure:"rollback"`
	FaultInjection FaultInjectionConfig `mapstructure:"fault_injection"`
	MessageQueue   MessageQueueConfig   `mapstructure:"message_queue"`
}

type ServerConfig struct {
	Name         string `mapstructure:"name"`
	Port         int    `mapstructure:"port"`
	Mode         string `mapstructure:"mode"`
	ReadTimeout  string `mapstructure:"read_timeout"`
	WriteTimeout string `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	Host                  string `mapstructure:"host"`
	Port                  int    `mapstructure:"port"`
	User                  string `mapstructure:"user"`
	Password              string `mapstructure:"password"`
	DBName                string `mapstructure:"dbname"`
	SSLMode               string `mapstructure:"sslmode"`
	MaxConnections        int    `mapstructure:"max_connections"`
	MaxIdleConnections    int    `mapstructure:"max_idle_connections"`
	ConnectionMaxLifetime string `mapstructure:"connection_max_lifetime"`
}

type KafkaConfig struct {
	Brokers           []string `mapstructure:"brokers"`
	ConsumerGroup     string   `mapstructure:"consumer_group"`
	Topic             string   `mapstructure:"topic"`
	Partition         int      `mapstructure:"partition"`
	ReplicationFactor int      `mapstructure:"replication_factor"`
}

type LogConfig struct {
	Level  string `mapstructure:"level"`
	Format string `mapstructure:"format"`
	Output string `mapstructure:"output"`
}

type TraceConfig struct {
	Enabled        bool   `mapstructure:"enabled"`
	JaegerEndpoint string `mapstructure:"jaeger_endpoint"`
	ServiceName    string `mapstructure:"service_name"`
}

type GrayReleaseConfig struct {
	DefaultStrategy          string `mapstructure:"default_strategy"`
	DefaultPercentage        int    `mapstructure:"default_percentage"`
	EnableRealTimeMonitoring bool   `mapstructure:"enable_real_time_monitoring"`
}

type RollbackConfig struct {
	MaxRetryTimes     int    `mapstructure:"max_retry_times"`
	RetryInterval     string `mapstructure:"retry_interval"`
	Timeout           string `mapstructure:"timeout"`
	EnableSagaPattern bool   `mapstructure:"enable_saga_pattern"`
}

type FaultInjectionConfig struct {
	Enabled         bool                  `mapstructure:"enabled"`
	HighConcurrency HighConcurrencyConfig `mapstructure:"high_concurrency"`
	Timeout         TimeoutConfig         `mapstructure:"timeout"`
	Network         NetworkConfig         `mapstructure:"network"`
}

type HighConcurrencyConfig struct {
	MaxConcurrent int `mapstructure:"max_concurrent"`
	QueueSize     int `mapstructure:"queue_size"`
}

type TimeoutConfig struct {
	MinTimeout  string  `mapstructure:"min_timeout"`
	MaxTimeout  string  `mapstructure:"max_timeout"`
	Probability float64 `mapstructure:"probability"`
}

type NetworkConfig struct {
	FailureProbability float64 `mapstructure:"failure_probability"`
	RetryTimes         int     `mapstructure:"retry_times"`
	BackoffStrategy    string  `mapstructure:"backoff_strategy"`
}

type MessageQueueConfig struct {
	Consumer ConsumerConfig `mapstructure:"consumer"`
}

type ConsumerConfig struct {
	MaxProcessingTime  string `mapstructure:"max_processing_time"`
	EnableManualCommit bool   `mapstructure:"enable_manual_commit"`
	EnableIdempotency  bool   `mapstructure:"enable_idempotency"`
	DedupWindow        string `mapstructure:"dedup_window"`
}

func Load(configPath string) (*Config, error) {
	v := viper.New()
	v.SetConfigFile(configPath)
	v.SetConfigType("yaml")

	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))

	v.SetDefault("server.name", "grayscale-simulator")
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.mode", "release")

	v.SetDefault("database.host", "localhost")
	v.SetDefault("database.port", 5432)
	v.SetDefault("database.user", "postgres")
	v.SetDefault("database.password", "postgres")
	v.SetDefault("database.dbname", "grayscale_simulator")
	v.SetDefault("database.sslmode", "disable")

	v.SetDefault("kafka.brokers", []string{"localhost:9092"})
	v.SetDefault("kafka.consumer_group", "grayscale-simulator-group")
	v.SetDefault("kafka.topic", "grayscale-events")

	v.SetDefault("trace.enabled", true)
	v.SetDefault("trace.jaeger_endpoint", "http://localhost:14268/api/traces")
	v.SetDefault("trace.service_name", "grayscale-simulator")

	v.SetDefault("log.level", "info")
	v.SetDefault("log.format", "json")
	v.SetDefault("log.output", "stdout")

	v.SetDefault("gray_release.default_strategy", "percentage")
	v.SetDefault("gray_release.default_percentage", 10)
	v.SetDefault("gray_release.enable_real_time_monitoring", true)

	v.SetDefault("rollback.max_retry_times", 3)
	v.SetDefault("rollback.retry_interval", "1s")
	v.SetDefault("rollback.timeout", "5m")
	v.SetDefault("rollback.enable_saga_pattern", true)

	v.SetDefault("fault_injection.enabled", true)
	v.SetDefault("fault_injection.high_concurrency.max_concurrent", 1000)
	v.SetDefault("fault_injection.high_concurrency.queue_size", 5000)
	v.SetDefault("fault_injection.timeout.min_timeout", "100ms")
	v.SetDefault("fault_injection.timeout.max_timeout", "5s")
	v.SetDefault("fault_injection.timeout.probability", 0.1)
	v.SetDefault("fault_injection.network.failure_probability", 0.05)
	v.SetDefault("fault_injection.network.retry_times", 3)
	v.SetDefault("fault_injection.network.backoff_strategy", "exponential")

	v.SetDefault("message_queue.consumer.max_processing_time", "30s")
	v.SetDefault("message_queue.consumer.enable_manual_commit", true)
	v.SetDefault("message_queue.consumer.enable_idempotency", true)
	v.SetDefault("message_queue.consumer.dedup_window", "5m")

	if err := v.ReadInConfig(); err != nil {
		return nil, fmt.Errorf("failed to read config file: %w", err)
	}

	var config Config
	if err := v.Unmarshal(&config); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}

	return &config, nil
}

func (c *DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		c.Host, c.Port, c.User, c.Password, c.DBName, c.SSLMode,
	)
}
