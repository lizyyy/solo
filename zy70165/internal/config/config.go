package config

import "time"

type Config struct {
	Server        ServerConfig
	TaskScheduler SchedulerConfig
	Rollback      RollbackConfig
	HealthCheck   HealthCheckConfig
}

type ServerConfig struct {
	Port         string
	ReadTimeout  time.Duration
	WriteTimeout time.Duration
}

type SchedulerConfig struct {
	TaskCheckInterval    time.Duration
	ExpiryCheckInterval  time.Duration
	RetryBackoffBase     time.Duration
	MaxRetries           int
	TaskTimeout          time.Duration
}

type RollbackConfig struct {
	Enabled            bool
	RollbackTimeout    time.Duration
	HealthCheckTimeout time.Duration
}

type HealthCheckConfig struct {
	Timeout  time.Duration
	Interval time.Duration
	Retries  int
}

func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			Port:         "8080",
			ReadTimeout:  15 * time.Second,
			WriteTimeout: 15 * time.Second,
		},
		TaskScheduler: SchedulerConfig{
			TaskCheckInterval:   10 * time.Second,
			ExpiryCheckInterval: 1 * time.Hour,
			RetryBackoffBase:    5 * time.Second,
			MaxRetries:          3,
			TaskTimeout:         5 * time.Minute,
		},
		Rollback: RollbackConfig{
			Enabled:            true,
			RollbackTimeout:    2 * time.Minute,
			HealthCheckTimeout: 30 * time.Second,
		},
		HealthCheck: HealthCheckConfig{
			Timeout:  10 * time.Second,
			Interval: 5 * time.Second,
			Retries:  3,
		},
	}
}
