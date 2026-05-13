package config

import (
	"github.com/spf13/viper"
)

type Config struct {
	Server        ServerConfig
	Database      DatabaseConfig
	CircuitBreaker CircuitBreakerConfig
}

type ServerConfig struct {
	Port int
	Mode string
}

type DatabaseConfig struct {
	Path string
}

type CircuitBreakerConfig struct {
	DefaultFailureThreshold     int
	DefaultHalfOpenMaxCalls     int
	DefaultSleepWindowSeconds   int
	DefaultMinimumRequests      int
}

var AppConfig *Config

func LoadConfig() error {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		return err
	}

	AppConfig = &Config{
		Server: ServerConfig{
			Port: viper.GetInt("server.port"),
			Mode: viper.GetString("server.mode"),
		},
		Database: DatabaseConfig{
			Path: viper.GetString("database.path"),
		},
		CircuitBreaker: CircuitBreakerConfig{
			DefaultFailureThreshold:   viper.GetInt("circuit_breaker.default_failure_threshold"),
			DefaultHalfOpenMaxCalls:   viper.GetInt("circuit_breaker.default_half_open_max_calls"),
			DefaultSleepWindowSeconds: viper.GetInt("circuit_breaker.default_sleep_window_seconds"),
			DefaultMinimumRequests:    viper.GetInt("circuit_breaker.default_minimum_requests"),
		},
	}

	return nil
}
