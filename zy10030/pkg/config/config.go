package config

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Server        ServerConfig        `mapstructure:"server"`
	Database      DatabaseConfig      `mapstructure:"database"`
	Kafka         KafkaConfig         `mapstructure:"kafka"`
	Log           LogConfig           `mapstructure:"log"`
	Trace         TraceConfig         `mapstructure:"trace"`
	GrayRelease   GrayReleaseConfig   `mapstructure:"gray_release"`
	Rollback      RollbackConfig      `mapstructure:"rollback"`
	FaultInjection FaultInjectionConfig `mapstructure:"fault_injection"`
	MessageQueue  MessageQueueConfig  `mapstructure:"message_queue"`
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
	Brokers          []string `mapstructure:"brokers"`
	ConsumerGroup    string   `mapstructure:"consumer_group"`
	Topic            string   `mapstructure:"topic"`
	Partition        int      `mapstructure:"partition"`
	ReplicationFactor int     `mapstructure:"replication_factor"`
}

type LogConfig struct {
	Level   string `mapstructure:"level"`
	Format  string `mapstructure:"format"`
	Output  string `mapstructure:"output"`
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
	MaxRetryTimes  int    `mapstructure:"max_retry_times"`
	RetryInterval  string `mapstructure:"retry_interval"`
	Timeout        string `mapstructure:"timeout"`
	EnableSagaPattern bool `mapstructure:"enable_saga_pattern"`
}

type FaultInjectionConfig struct {
	Enabled        bool                     `mapstructure:"enabled"`
	HighConcurrency HighConcurrencyConfig    `mapstructure:"high_concurrency"`
	Timeout        TimeoutConfig            `mapstructure:"timeout"`
	Network        NetworkConfig            `mapstructure:"network"`
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

