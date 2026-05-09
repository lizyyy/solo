package config

import (
	"encoding/json"
	"errors"
	"log"
	"os"
	"sync"
	"time"
)

type DBConfig struct {
	Host            string
	Port            int
	User            string
	Password        string
	DBName          string
	MaxOpenConns    int
	MaxIdleConns    int
	ConnMaxLifetime time.Duration
}

type RedisConfig struct {
	Host         string
	Port         int
	Password     string
	DB           int
	PoolSize     int
	MinIdleConns int
}

type WebConfig struct {
	Port int
}

type ScenarioConfig struct {
	ConnectionPool struct {
		LeakRate        int
		IntervalMs      int
		MaxLeakedConns  int
	}
	MessageQueue struct {
		ProducerRate   int
		ConsumerRate   int
		QueueCapacity  int
	}
	GoroutineLeak struct {
		LeakRate       int
		IntervalMs     int
		MaxLeakedGoroutines int
	}
	DBLockWait struct {
		NumWorkers     int
		HoldTimeMs     int
	}
	CacheDirty struct {
		UpdateIntervalMs int
	}
	ConfigDrift struct {
		DriftIntervalMs int
	}
}

type Config struct {
	mu       sync.RWMutex
	DB       DBConfig
	Redis    RedisConfig
	Web      WebConfig
	Scenarios ScenarioConfig
}

var instance *Config
var once sync.Once

func Get() *Config {
	once.Do(func() {
		instance = &Config{
			DB: DBConfig{
				Host:            "127.0.0.1",
				Port:            3306,
				User:            "root",
				Password:        "",
				DBName:          "chaos_db",
				MaxOpenConns:    20,
				MaxIdleConns:    10,
				ConnMaxLifetime: time.Hour,
			},
			Redis: RedisConfig{
				Host:         "127.0.0.1",
				Port:         6379,
				Password:     "",
				DB:           0,
				PoolSize:     50,
				MinIdleConns: 10,
			},
			Web: WebConfig{
				Port: 8080,
			},
		}
		
		instance.Scenarios.ConnectionPool.LeakRate = 2
		instance.Scenarios.ConnectionPool.IntervalMs = 500
		instance.Scenarios.ConnectionPool.MaxLeakedConns = 50
		
		instance.Scenarios.MessageQueue.ProducerRate = 100
		instance.Scenarios.MessageQueue.ConsumerRate = 10
		instance.Scenarios.MessageQueue.QueueCapacity = 1000
		
		instance.Scenarios.GoroutineLeak.LeakRate = 5
		instance.Scenarios.GoroutineLeak.IntervalMs = 200
		instance.Scenarios.GoroutineLeak.MaxLeakedGoroutines = 1000
		
		instance.Scenarios.DBLockWait.NumWorkers = 50
		instance.Scenarios.DBLockWait.HoldTimeMs = 5000
		
		instance.Scenarios.CacheDirty.UpdateIntervalMs = 1000
		
		instance.Scenarios.ConfigDrift.DriftIntervalMs = 3000
	})
	return instance
}

func (c *Config) LoadFromFile(path string) error {
	file, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	
	c.mu.Lock()
	defer c.mu.Unlock()
	
	if err := json.Unmarshal(file, &instance); err != nil {
		return err
	}
	
	log.Printf("Config loaded from %s", path)
	return nil
}

func (c *Config) SaveToFile(path string) error {
	c.mu.RLock()
	defer c.mu.RUnlock()
	
	data, err := json.MarshalIndent(instance, "", "  ")
	if err != nil {
		return err
	}
	
	if err := os.WriteFile(path, data, 0644); err != nil {
		return err
	}
	
	log.Printf("Config saved to %s", path)
	return nil
}

func (c *Config) Update(key string, value interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	
	return errors.New("specific update not implemented, use config map updates")
}
