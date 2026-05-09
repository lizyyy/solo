package scenarios

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"math/rand"
	"reflect"
	"sync"
	"sync/atomic"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/pkg/models"
)

type ConfigValue struct {
	Key      string
	Original interface{}
	Current  interface{}
	Drifted  bool
}

type ConfigDriftScenario struct {
	*BaseScenario
	db          *sql.DB
	configs     map[string]*ConfigValue
	driftCount  int64
	wg          sync.WaitGroup
}

func NewConfigDriftScenario(db *sql.DB) *ConfigDriftScenario {
	return &ConfigDriftScenario{
		BaseScenario: NewBaseScenario("config_drift", models.ScenarioConfigDrift),
		db:           db,
		configs:      make(map[string]*ConfigValue),
	}
}

func (s *ConfigDriftScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.ConfigDrift
	return map[string]interface{}{
		"drift_interval_ms": cfg.DriftIntervalMs,
	}
}

func (s *ConfigDriftScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	atomic.StoreInt64(&s.driftCount, 0)

	s.initConfigs()
	s.wg.Add(1)

	go s.run()

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Config drift scenario started", map[string]interface{}{
		"drift_interval": config.Get().Scenarios.ConfigDrift.DriftIntervalMs,
	}))

	return nil
}

func (s *ConfigDriftScenario) initConfigs() {
	defaultConfigs := map[string]interface{}{
		"db.max_connections":         20,
		"redis.pool_size":            50,
		"api.timeout_ms":             30000,
		"queue.max_size":             10000,
		"cache.ttl_seconds":          300,
		"retry.max_attempts":         3,
		"retry.backoff_ms":           100,
		"load_balancer.weight":       100,
		"circuit_breaker.threshold":  50,
		"rate_limit.requests_per_min": 1000,
	}

	for key, value := range defaultConfigs {
		s.configs[key] = &ConfigValue{
			Key:      key,
			Original: value,
			Current:  value,
			Drifted:  false,
		}
	}
}

func (s *ConfigDriftScenario) run() {
	defer s.wg.Done()
	cfg := config.Get().Scenarios.ConfigDrift
	ticker := time.NewTicker(time.Duration(cfg.DriftIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			keys := make([]string, 0, len(s.configs))
			for k := range s.configs {
				keys = append(keys, k)
			}

			if len(keys) == 0 {
				continue
			}

			chosenKey := keys[rand.Intn(len(keys))]
			s.introduceDrift(chosenKey)

			s.checkConsistency()
		}
	}
}

func (s *ConfigDriftScenario) introduceDrift(key string) {
	cfg, exists := s.configs[key]
	if !exists {
		return
	}

	originalVal := cfg.Original
	var newVal interface{}

	switch originalVal.(type) {
	case int:
		orig := originalVal.(int)
		change := rand.Intn(orig/2 + 1)
		if rand.Float32() < 0.5 {
			newVal = orig + change + 1
		} else {
			newVal = max(1, orig-change-1)
		}
	case float64:
		orig := originalVal.(float64)
		newVal = orig * (0.8 + rand.Float64()*0.4)
	case string:
		suffixes := []string{"_dev", "_staging", "_prod", "_backup", ""}
		newVal = originalVal.(string) + suffixes[rand.Intn(len(suffixes))]
	default:
		return
	}

	if !reflect.DeepEqual(originalVal, newVal) {
		cfg.Current = newVal
		cfg.Drifted = true
		atomic.AddInt64(&s.driftCount, 1)

		s.AddEvent(newEvent(s.Name(), models.LevelWarn, "Config DRIFT detected", map[string]interface{}{
			"key":        key,
			"original":   originalVal,
			"current":    newVal,
			"drifted":    true,
			"drift_count": atomic.LoadInt64(&s.driftCount),
		}))

		s.recordDriftInDB(key, originalVal, newVal)
	}
}

func (s *ConfigDriftScenario) recordDriftInDB(key string, oldVal, newVal interface{}) {
	if s.db == nil {
		return
	}

	oldJSON, _ := json.Marshal(oldVal)
	newJSON, _ := json.Marshal(newVal)

	_, err := s.db.Exec(
		"INSERT INTO config_history (key_name, old_value, new_value) VALUES (?, ?, ?)",
		key, string(oldJSON), string(newJSON),
	)
	if err != nil {
		s.AddEvent(newEvent(s.Name(), models.LevelError, "Failed to record drift history: "+err.Error(), nil))
	}
}

func (s *ConfigDriftScenario) checkConsistency() {
	driftedCount := 0
	for _, cfg := range s.configs {
		if cfg.Drifted {
			driftedCount++
		}
	}

	if driftedCount >= 5 {
		driftedKeys := make([]string, 0)
		for k, v := range s.configs {
			if v.Drifted {
				driftedKeys = append(driftedKeys, k)
			}
		}

		s.AddEvent(newEvent(s.Name(), models.LevelError, "Config DRIFT CRITICAL - multiple configs out of sync", map[string]interface{}{
			"drifted_count": driftedCount,
			"total_configs": len(s.configs),
			"drifted_keys":  driftedKeys,
		}))
	}
}

func (s *ConfigDriftScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.wg.Wait()
		s.SetStatus(models.StatusReady)

		driftedCount := 0
		for _, v := range s.configs {
			if v.Drifted {
				driftedCount++
			}
		}

		s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Config drift scenario stopped", map[string]interface{}{
			"total_drift_events": atomic.LoadInt64(&s.driftCount),
			"drifted_configs":    driftedCount,
		}))
	}
	return nil
}

func (s *ConfigDriftScenario) Recover() error {
	s.Stop()

	recoveredCount := 0
	for key, cfg := range s.configs {
		if cfg.Drifted {
			s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Restoring config to baseline", map[string]interface{}{
				"key":        key,
				"from":       cfg.Current,
				"to":         cfg.Original,
			}))

			cfg.Current = cfg.Original
			cfg.Drifted = false
			recoveredCount++
		}
	}

	atomic.StoreInt64(&s.driftCount, 0)

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Config drift recovered", map[string]interface{}{
		"configs_restored": recoveredCount,
	}))

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *ConfigDriftScenario) CurrentState() models.SystemState {
	driftedCount := 0
	driftedConfigs := make(map[string]map[string]interface{})

	for key, cfg := range s.configs {
		if cfg.Drifted {
			driftedCount++
			driftedConfigs[key] = map[string]interface{}{
				"original": cfg.Original,
				"current":  cfg.Current,
			}
		}
	}

	return models.SystemState{
		Timestamp: time.Now(),
		Metrics: map[string]interface{}{
			"total_configs":    len(s.configs),
			"drifted_count":    driftedCount,
			"drift_events":     atomic.LoadInt64(&s.driftCount),
			"drifted_configs":  driftedConfigs,
			"consistency_ratio": fmt.Sprintf("%.1f%%",
				float64(len(s.configs)-driftedCount)/float64(len(s.configs)+1)*100),
		},
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
