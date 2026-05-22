package config

import (
	"time"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Queue    QueueConfig
}

type ServerConfig struct {
	Port string
}

type DatabaseConfig struct {
	Path string
}

type QueueConfig struct {
	MaxRetries        int
	RetryInterval     time.Duration
	MaxRetryInterval  time.Duration
	BackoffMultiplier float64
	BatchSize         int
	CronSchedule      string
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port: "8080",
		},
		Database: DatabaseConfig{
			Path: "used_car_queue.db",
		},
		Queue: QueueConfig{
			MaxRetries:        5,
			RetryInterval:     5 * time.Minute,
			MaxRetryInterval:  2 * time.Hour,
			BackoffMultiplier: 2.0,
			BatchSize:         100,
			CronSchedule:      "*/5 * * * *",
		},
	}
}
