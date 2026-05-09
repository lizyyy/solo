package config

import (
	"os"
	"strconv"
	"time"
)

type Config struct {
	Server    ServerConfig    `json:"server"`
	Database  DatabaseConfig  `json:"database"`
	Redis     RedisConfig     `json:"redis"`
	RocketMQ  RocketMQConfig  `json:"rocketmq"`
	Logger    LoggerConfig    `json:"logger"`
	Tracking  TrackingConfig  `json:"tracking"`
	Replay    ReplayConfig    `json:"replay"`
}

type ServerConfig struct {
	Port         int           `json:"port"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
}

type DatabaseConfig struct {
	Driver          string        `json:"driver"`
	Host            string        `json:"host"`
	Port            int           `json:"port"`
	User            string        `json:"user"`
	Password        string        `json:"password"`
	DBName          string        `json:"dbname"`
	MaxOpenConns    int           `json:"max_open_conns"`
	MaxIdleConns    int           `json:"max_idle_conns"`
	ConnMaxLifetime time.Duration `json:"conn_max_lifetime"`
}

type RedisConfig struct {
	Host         string        `json:"host"`
	Port         int           `json:"port"`
	Password     string        `json:"password"`
	DB           int           `json:"db"`
	PoolSize     int           `json:"pool_size"`
	MinIdleConns int           `json:"min_idle_conns"`
	TTL          time.Duration `json:"ttl"`
}

type RocketMQConfig struct {
	NamesrvAddr string `json:"namesrv_addr"`
	Group       string `json:"group"`
	Topic       string `json:"topic"`
	ConsumerID  string `json:"consumer_id"`
}

type LoggerConfig struct {
	Level string `json:"level"`
	Path  string `json:"path"`
}

type TrackingConfig struct {
	EnableDetailedLog    bool          `json:"enable_detailed_log"`
	MaxRetryTimes        int           `json:"max_retry_times"`
	RetryInterval        time.Duration `json:"retry_interval"`
	PowerfulConsistency  bool          `json:"powerful_consistency"`
}

type ReplayConfig struct {
	MaxBatchSize      int           `json:"max_batch_size"`
	Timeout           time.Duration `json:"timeout"`
	Concurrency       int           `json:"concurrency"`
	DryRunByDefault   bool          `json:"dry_run_by_default"`
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         getEnvInt("SERVER_PORT", 8080),
			ReadTimeout:  getEnvDuration("SERVER_READ_TIMEOUT", "30s"),
			WriteTimeout: getEnvDuration("SERVER_WRITE_TIMEOUT", "30s"),
		},
		Database: DatabaseConfig{
			Driver:          getEnv("DB_DRIVER", "mysql"),
			Host:            getEnv("DB_HOST", "localhost"),
			Port:            getEnvInt("DB_PORT", 3306),
			User:            getEnv("DB_USER", "root"),
			Password:        getEnv("DB_PASSWORD", "root"),
			DBName:          getEnv("DB_NAME", "mq_review"),
			MaxOpenConns:    getEnvInt("DB_MAX_OPEN_CONNS", 50),
			MaxIdleConns:    getEnvInt("DB_MAX_IDLE_CONNS", 10),
			ConnMaxLifetime: getEnvDuration("DB_CONN_MAX_LIFETIME", "1h"),
		},
		Redis: RedisConfig{
			Host:         getEnv("REDIS_HOST", "localhost"),
			Port:         getEnvInt("REDIS_PORT", 6379),
			Password:     getEnv("REDIS_PASSWORD", ""),
			DB:           getEnvInt("REDIS_DB", 0),
			PoolSize:     getEnvInt("REDIS_POOL_SIZE", 50),
			MinIdleConns: getEnvInt("REDIS_MIN_IDLE_CONNS", 5),
			TTL:          getEnvDuration("REDIS_TTL", "1h"),
		},
		RocketMQ: RocketMQConfig{
			NamesrvAddr: getEnv("ROCKETMQ_NAMESRV_ADDR", "localhost:9876"),
			Group:       getEnv("ROCKETMQ_GROUP", "DLQ_REVIEW_GROUP"),
			Topic:       getEnv("ROCKETMQ_TOPIC", "order_topic"),
			ConsumerID:  getEnv("ROCKETMQ_CONSUMER_ID", "order_consumer"),
		},
		Logger: LoggerConfig{
			Level: getEnv("LOG_LEVEL", "info"),
			Path:  getEnv("LOG_PATH", "./logs"),
		},
		Tracking: TrackingConfig{
			EnableDetailedLog:    getEnvBool("TRACKING_ENABLE_DETAILED_LOG", true),
			MaxRetryTimes:        getEnvInt("TRACKING_MAX_RETRY_TIMES", 3),
			RetryInterval:        getEnvDuration("TRACKING_RETRY_INTERVAL", "1s"),
			PowerfulConsistency:  getEnvBool("TRACKING_POWERFUL_CONSISTENCY", true),
		},
		Replay: ReplayConfig{
			MaxBatchSize:    getEnvInt("REPLAY_MAX_BATCH_SIZE", 100),
			Timeout:         getEnvDuration("REPLAY_TIMEOUT", "5m"),
			Concurrency:     getEnvInt("REPLAY_CONCURRENCY", 5),
			DryRunByDefault: getEnvBool("REPLAY_DRY_RUN_BY_DEFAULT", true),
		},
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvDuration(key, defaultValue string) time.Duration {
	value := getEnv(key, defaultValue)
	duration, err := time.ParseDuration(value)
	if err != nil {
		duration, _ = time.ParseDuration(defaultValue)
	}
	return duration
}

func getEnvBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		boolValue, err := strconv.ParseBool(value)
		if err == nil {
			return boolValue
		}
	}
	return defaultValue
}
