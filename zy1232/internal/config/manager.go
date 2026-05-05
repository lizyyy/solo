package config

import (
	"fmt"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"github.com/spf13/viper"

	"github.com/zy1232/microservice-framework/internal/model"
)

type Manager struct {
	viper      *viper.Viper
	configPath string
	current    *model.Config
	history    []*model.Config
	mu         sync.RWMutex
	watchers   []chan<- *model.Config
}

func NewManager(configPath string) *Manager {
	return &Manager{
		viper:      viper.New(),
		configPath: configPath,
		history:    []*model.Config{},
		watchers:   []chan<- *model.Config{},
	}
}

func (m *Manager) Load() error {
	m.viper.SetConfigFile(m.configPath)
	m.viper.AutomaticEnv()

	if err := m.viper.ReadInConfig(); err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	data := make(map[string]interface{})
	for _, key := range m.viper.AllKeys() {
		data[key] = m.viper.Get(key)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	version := fmt.Sprintf("v%d", len(m.history)+1)
	config := &model.Config{
		Version:   version,
		Data:      data,
		CreatedAt: time.Now(),
	}

	m.current = config
	m.history = append(m.history, config)

	log.Info().Str("version", version).Msg("Config loaded")

	// Notify watchers
	for _, w := range m.watchers {
		select {
		case w <- config:
		default:
		}
	}

	return nil
}

func (m *Manager) Watch() error {
	m.viper.WatchConfig()
	m.viper.OnConfigChange(func(e interface{}) {
		log.Info().Msg("Config file changed, reloading...")
		if err := m.Load(); err != nil {
			log.Error().Err(err).Msg("Failed to reload config")
		}
	})
	return nil
}

func (m *Manager) Get(key string) interface{} {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if m.current == nil {
		return nil
	}
	return m.current.Data[key]
}

func (m *Manager) GetString(key string) string {
	val := m.Get(key)
	if str, ok := val.(string); ok {
		return str
	}
	return ""
}

func (m *Manager) GetInt(key string) int {
	val := m.Get(key)
	if i, ok := val.(int); ok {
		return i
	}
	return 0
}

func (m *Manager) GetBool(key string) bool {
	val := m.Get(key)
	if b, ok := val.(bool); ok {
		return b
	}
	return false
}

func (m *Manager) Current() *model.Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.current
}

func (m *Manager) History() []*model.Config {
	m.mu.RLock()
	defer m.mu.RUnlock()
	history := make([]*model.Config, len(m.history))
	copy(history, m.history)
	return history
}

func (m *Manager) Subscribe(ch chan<- *model.Config) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.watchers = append(m.watchers, ch)
}

func (m *Manager) Update(data map[string]interface{}) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Update current config
	for k, v := range data {
		m.current.Data[k] = v
		m.viper.Set(k, v)
	}

	// Write to file
	if err := m.viper.WriteConfig(); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	// Create new version
	version := fmt.Sprintf("v%d", len(m.history)+1)
	newConfig := &model.Config{
		Version:   version,
		Data:      make(map[string]interface{}),
		CreatedAt: time.Now(),
	}
	for k, v := range m.current.Data {
		newConfig.Data[k] = v
	}

	m.current = newConfig
	m.history = append(m.history, newConfig)

	log.Info().Str("version", version).Msg("Config updated")

	// Notify watchers
	for _, w := range m.watchers {
		select {
		case w <- newConfig:
		default:
		}
	}

	return nil
}
