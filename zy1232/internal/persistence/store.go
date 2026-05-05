package persistence

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/model"
)

type Store struct {
	dataDir string
	mu      sync.RWMutex
}

func NewStore(dataDir string) (*Store, error) {
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create data directory: %w", err)
	}

	return &Store{
		dataDir: dataDir,
	}, nil
}

func (s *Store) SaveRegistry(registry map[string]*model.Service) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(registry, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal registry: %w", err)
	}

	filename := filepath.Join(s.dataDir, "registry.json")
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write registry: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Registry saved")
	return nil
}

func (s *Store) LoadRegistry() (map[string]*model.Service, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := filepath.Join(s.dataDir, "registry.json")
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return make(map[string]*model.Service), nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read registry: %w", err)
	}

	var registry map[string]*model.Service
	if err := json.Unmarshal(data, &registry); err != nil {
		return nil, fmt.Errorf("failed to unmarshal registry: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Registry loaded")
	return registry, nil
}

func (s *Store) SaveConfigHistory(configs []*model.Config) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(configs, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal config history: %w", err)
	}

	filename := filepath.Join(s.dataDir, "configs.json")
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write config history: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Config history saved")
	return nil
}

func (s *Store) LoadConfigHistory() ([]*model.Config, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := filepath.Join(s.dataDir, "configs.json")
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return []*model.Config{}, nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read config history: %w", err)
	}

	var configs []*model.Config
	if err := json.Unmarshal(data, &configs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal config history: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Config history loaded")
	return configs, nil
}

func (s *Store) SaveRequestLog(logEntry *model.RequestLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	logsDir := filepath.Join(s.dataDir, "logs")
	if err := os.MkdirAll(logsDir, 0755); err != nil {
		return fmt.Errorf("failed to create logs directory: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	filename := filepath.Join(logsDir, fmt.Sprintf("requests-%s.json", today))

	var logs []*model.RequestLog
	if data, err := os.ReadFile(filename); err == nil {
		_ = json.Unmarshal(data, &logs)
	}

	logs = append(logs, logEntry)

	data, err := json.MarshalIndent(logs, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal request logs: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write request logs: %w", err)
	}

	return nil
}

func (s *Store) LoadRequestLogs(date string) ([]*model.RequestLog, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	filename := filepath.Join(s.dataDir, "logs", fmt.Sprintf("requests-%s.json", date))
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return []*model.RequestLog{}, nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read request logs: %w", err)
	}

	var logs []*model.RequestLog
	if err := json.Unmarshal(data, &logs); err != nil {
		return nil, fmt.Errorf("failed to unmarshal request logs: %w", err)
	}

	return logs, nil
}

func (s *Store) SaveCircuitBreakerStates(states map[string]*model.CircuitBreakerState) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	data, err := json.MarshalIndent(states, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal circuit breaker states: %w", err)
	}

	filename := filepath.Join(s.dataDir, "circuitbreakers.json")
	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write circuit breaker states: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Circuit breaker states saved")
	return nil
}

func (s *Store) LoadCircuitBreakerStates() (map[string]*model.CircuitBreakerState, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filename := filepath.Join(s.dataDir, "circuitbreakers.json")
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return make(map[string]*model.CircuitBreakerState), nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read circuit breaker states: %w", err)
	}

	var states map[string]*model.CircuitBreakerState
	if err := json.Unmarshal(data, &states); err != nil {
		return nil, fmt.Errorf("failed to unmarshal circuit breaker states: %w", err)
	}

	log.Debug().Str("file", filename).Msg("Circuit breaker states loaded")
	return states, nil
}

func (s *Store) SaveRoutingDecision(decision *model.RoutingDecision) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	decisionsDir := filepath.Join(s.dataDir, "decisions")
	if err := os.MkdirAll(decisionsDir, 0755); err != nil {
		return fmt.Errorf("failed to create decisions directory: %w", err)
	}

	today := time.Now().Format("2006-01-02")
	filename := filepath.Join(decisionsDir, fmt.Sprintf("decisions-%s.json", today))

	var decisions []*model.RoutingDecision
	if data, err := os.ReadFile(filename); err == nil {
		_ = json.Unmarshal(data, &decisions)
	}

	decisions = append(decisions, decision)

	data, err := json.MarshalIndent(decisions, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal routing decisions: %w", err)
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return fmt.Errorf("failed to write routing decisions: %w", err)
	}

	return nil
}

func (s *Store) LoadRoutingDecisions(date string) ([]*model.RoutingDecision, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	filename := filepath.Join(s.dataDir, "decisions", fmt.Sprintf("decisions-%s.json", date))
	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return []*model.RoutingDecision{}, nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return nil, fmt.Errorf("failed to read routing decisions: %w", err)
	}

	var decisions []*model.RoutingDecision
	if err := json.Unmarshal(data, &decisions); err != nil {
		return nil, fmt.Errorf("failed to unmarshal routing decisions: %w", err)
	}

	return decisions, nil
}
