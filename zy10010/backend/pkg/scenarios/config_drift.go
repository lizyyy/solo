package scenarios

import (
	"math/rand"
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
)

type ConfigDriftScenario struct {
	mu          sync.Mutex
	sm          *statemanager.StateManager
	eb          *eventbus.EventBus
	configItems map[string]interface{}
	stopCh      chan struct{}
	running     bool
}

func NewConfigDriftScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *ConfigDriftScenario {
	return &ConfigDriftScenario{
		sm:          sm,
		eb:          eb,
		configItems: make(map[string]interface{}),
		stopCh:      make(chan struct{}),
	}
}

func (s *ConfigDriftScenario) Start(driftRate float64, duration time.Duration) {
	s.mu.Lock()
	s.running = true
	s.configItems = map[string]interface{}{
		"timeout_ms":       5000,
		"retry_count":      3,
		"max_connections":  100,
		"cache_ttl_sec":    300,
		"log_level":        "info",
		"feature_flag_a":   true,
		"feature_flag_b":   false,
	}

	for key, expectedVal := range s.configItems {
		s.sm.SetConfig(key, expectedVal, "default", nil)
	}
	s.mu.Unlock()

	go s.simulateConfigChanges(driftRate, duration)
}

func (s *ConfigDriftScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
	}
}

func (s *ConfigDriftScenario) simulateConfigChanges(driftRate float64, duration time.Duration) {
	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		default:
			if rand.Float64() < 0.4 {
				s.mu.Lock()
				keys := make([]string, 0, len(s.configItems))
				for k := range s.configItems {
					keys = append(keys, k)
				}
				key := keys[rand.Intn(len(keys))]
				expectedVal := s.configItems[key]

				if rand.Float64() < driftRate {
					driftedVal := s.generateDriftedValue(expectedVal)
					s.sm.SetConfig(key, driftedVal, "environment_override", expectedVal)
				} else {
					s.sm.SetConfig(key, expectedVal, "default", nil)
				}
				s.mu.Unlock()
			}
			time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
		}
	}
}

func (s *ConfigDriftScenario) generateDriftedValue(original interface{}) interface{} {
	switch v := original.(type) {
	case int:
		if rand.Float64() < 0.5 {
			return v + rand.Intn(1000)
		}
		return v - rand.Intn(max(v, 1))
	case string:
		if v == "info" {
			return []string{"debug", "warn", "error"}[rand.Intn(3)]
		}
		return v + "_modified"
	case bool:
		return !v
	default:
		return original
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
