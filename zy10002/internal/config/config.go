package config

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Redis    RedisConfig    `yaml:"redis"`
	Order    OrderConfig    `yaml:"order"`
	Chaos    ChaosConfig    `yaml:"chaos"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Host             string `yaml:"host"`
	Port             int    `yaml:"port"`
	User             string `yaml:"user"`
	Password         string `yaml:"password"`
	DBName           string `yaml:"dbname"`
	MaxOpenConns     int    `yaml:"max_open_conns"`
	MaxIdleConns     int    `yaml:"max_idle_conns"`
	ConnMaxLifetime  int    `yaml:"conn_max_lifetime"`
}

func (c DatabaseConfig) DSN() string {
	return fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=disable",
		c.Host, c.Port, c.User, c.Password, c.DBName,
	)
}

type RedisConfig struct {
	Host     string `yaml:"host"`
	Port     int    `yaml:"port"`
	Password string `yaml:"password"`
	DB       int    `yaml:"db"`
	PoolSize int    `yaml:"pool_size"`
}

func (c RedisConfig) Addr() string {
	return fmt.Sprintf("%s:%d", c.Host, c.Port)
}

type OrderConfig struct {
	DefaultAmount          float64 `yaml:"default_amount"`
	DuplicateCallbackDelay int     `yaml:"duplicate_callback_delay"`
	CallbackTimeout        int     `yaml:"callback_timeout"`
}

type ChaosConfig struct {
	Enabled   bool                    `yaml:"enabled"`
	Scenarios ChaosScenariosConfig    `yaml:"scenarios"`
}

type ChaosScenariosConfig struct {
	ConnectionPoolExhaustion ChaosScenariosDetail `yaml:"connection_pool_exhaustion"`
	MessageBacklog           ChaosScenariosDetail `yaml:"message_backlog"`
	GoroutineLeak            ChaosScenariosDetail `yaml:"goroutine_leak"`
	DatabaseLockWait         ChaosScenariosDetail `yaml:"database_lock_wait"`
	CacheDirtyData           ChaosScenariosDetail `yaml:"cache_dirty_data"`
	ConfigDrift              ChaosScenariosDetail `yaml:"config_drift"`
}

type ChaosScenariosDetail struct {
	Enabled            bool    `yaml:"enabled"`
	DelayMs            int64   `yaml:"delay_ms"`
	TriggerCount       int     `yaml:"trigger_count"`
	QueueSize          int     `yaml:"queue_size"`
	ProcessingDelayMs  int64   `yaml:"processing_delay_ms"`
	LeakRate           float64 `yaml:"leak_rate"`
	LockHoldTimeMs     int64   `yaml:"lock_hold_time_ms"`
	DirtyRate          float64 `yaml:"dirty_rate"`
	DriftIntervalMs    int64   `yaml:"drift_interval_ms"`
}

var (
	instance *Config
	once     sync.Once
	mu       sync.RWMutex
)

func Get() *Config {
	once.Do(func() {
		loadConfig()
	})
	mu.RLock()
	defer mu.RUnlock()
	return instance
}

func loadConfig() {
	configPath := getConfigPath()
	data, err := os.ReadFile(configPath)
	if err != nil {
		panic(fmt.Sprintf("Failed to read config file: %v", err))
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		panic(fmt.Sprintf("Failed to parse config file: %v", err))
	}

	instance = &cfg
}

func getConfigPath() string {
	if path := os.Getenv("CHAOS_CONFIG_PATH"); path != "" {
		return path
	}
	return filepath.Join("config", "config.yaml")
}

func Update(updateFn func(*Config)) {
	mu.Lock()
	defer mu.Unlock()
	if instance == nil {
		loadConfig()
	}
	updateFn(instance)
}

func Save() error {
	mu.RLock()
	defer mu.RUnlock()

	data, err := yaml.Marshal(instance)
	if err != nil {
		return err
	}

	configPath := getConfigPath()
	return os.WriteFile(configPath, data, 0644)
}
