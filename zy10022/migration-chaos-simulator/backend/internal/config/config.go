package config

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/spf13/viper"
)

type Config struct {
	Server   ServerConfig   `mapstructure:"server"`
	Database DatabaseConfig `mapstructure:"database"`
	RabbitMQ RabbitMQConfig `mapstructure:"rabbitmq"`
	Chaos    ChaosConfig    `mapstructure:"chaos"`
	Tracer   TracerConfig   `mapstructure:"tracer"`
	Logging  LoggingConfig  `mapstructure:"logging"`
}

type ServerConfig struct {
	Port         int           `mapstructure:"port"`
	Mode         string        `mapstructure:"mode"`
	ReadTimeout  time.Duration `mapstructure:"read_timeout"`
	WriteTimeout time.Duration `mapstructure:"write_timeout"`
}

type DatabaseConfig struct {
	Host            string        `mapstructure:"host"`
	Port            int           `mapstructure:"port"`
	User            string        `mapstructure:"user"`
	Password        string        `mapstructure:"password"`
	Database        string        `mapstructure:"database"`
	SSLMode         string        `mapstructure:"sslmode"`
	MaxConnections  int           `mapstructure:"max_connections"`
	MinConnections  int           `mapstructure:"min_connections"`
	ConnMaxLifetime time.Duration `mapstructure:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `mapstructure:"conn_max_idle_time"`
}

func (c DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=%s",
		c.User, c.Password, c.Host, c.Port, c.Database, c.SSLMode,
	)
}

type RabbitMQConfig struct {
	Host             string        `mapstructure:"host"`
	Port             int           `mapstructure:"port"`
	User             string        `mapstructure:"user"`
	Password         string        `mapstructure:"password"`
	VHost            string        `mapstructure:"vhost"`
	ReconnectAttempts int          `mapstructure:"reconnect_attempts"`
	ReconnectDelay   time.Duration `mapstructure:"reconnect_delay"`
}

func (c RabbitMQConfig) URL() string {
	return fmt.Sprintf(
		"amqp://%s:%s@%s:%d%s",
		c.User, c.Password, c.Host, c.Port, c.VHost,
	)
}

type ChaosConfig struct {
	Enabled                  bool          `mapstructure:"enabled"`
	DefaultExperimentDuration time.Duration `mapstructure:"default_experiment_duration"`
	MaxConcurrentExperiments int           `mapstructure:"max_concurrent_experiments"`
}

type TracerConfig struct {
	Enabled       bool          `mapstructure:"enabled"`
	BufferSize    int           `mapstructure:"buffer_size"`
	FlushInterval time.Duration `mapstructure:"flush_interval"`
}

type LoggingConfig struct {
	Level   string `mapstructure:"level"`
	Format  string `mapstructure:"format"`
	Output  string `mapstructure:"output"`
}

func Load() (*Config, error) {
	v := viper.New()
	
	v.SetConfigName("config")
	v.SetConfigType("yaml")
	
	configPaths := []string{
		"./config",
		"./backend/config",
		"/app/config",
	}
	
	exePath, err := os.Executable()
	if err == nil {
		configPaths = append(configPaths, filepath.Join(filepath.Dir(exePath), "config"))
	}
	
	for _, path := range configPaths {
		v.AddConfigPath(path)
	}
	
	v.AutomaticEnv()
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	
	v.SetDefault("server.port", 8080)
	v.SetDefault("server.mode", "debug")
	v.SetDefault("server.read_timeout", 30*time.Second)
	v.SetDefault("server.write_timeout", 30*time.Second)
	
	if err := v.ReadInConfig(); err != nil {
		if _, ok := err.(viper.ConfigFileNotFoundError); !ok {
			return nil, fmt.Errorf("failed to read config: %w", err)
		}
	}
	
	var cfg Config
	if err := v.Unmarshal(&cfg); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config: %w", err)
	}
	
	overrideFromEnv(&cfg)
	
	return &cfg, nil
}

func overrideFromEnv(cfg *Config) {
	if host := os.Getenv("DB_HOST"); host != "" {
		cfg.Database.Host = host
	}
	if port := os.Getenv("DB_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &cfg.Database.Port)
	}
	if user := os.Getenv("DB_USER"); user != "" {
		cfg.Database.User = user
	}
	if password := os.Getenv("DB_PASSWORD"); password != "" {
		cfg.Database.Password = password
	}
	if db := os.Getenv("DB_NAME"); db != "" {
		cfg.Database.Database = db
	}
	
	if host := os.Getenv("RABBITMQ_HOST"); host != "" {
		cfg.RabbitMQ.Host = host
	}
	if port := os.Getenv("RABBITMQ_PORT"); port != "" {
		fmt.Sscanf(port, "%d", &cfg.RabbitMQ.Port)
	}
}
