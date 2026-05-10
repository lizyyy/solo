package engine

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"runtime"
	"sync"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/internal/storage"
	"chaos-simulator/pkg/models"

	_ "github.com/go-sql-driver/mysql"
	"github.com/redis/go-redis/v9"
)

type Engine struct {
	mu          sync.RWMutex
	timeline    *models.Timeline
	scenarios   map[string]models.Scenario
	snapshots   []models.Snapshot
	db          *sql.DB
	redisClient *redis.Client
	running     bool
}

func New() *Engine {
	return &Engine{
		timeline:  models.NewTimeline(),
		scenarios: make(map[string]models.Scenario),
		snapshots: make([]models.Snapshot, 0),
	}
}

func (e *Engine) Init() error {
	cfg := config.Get()

	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?parseTime=true",
		cfg.DB.User, cfg.DB.Password, cfg.DB.Host, cfg.DB.Port, cfg.DB.DBName)
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to MySQL: %w", err)
	}
	db.SetMaxOpenConns(cfg.DB.MaxOpenConns)
	db.SetMaxIdleConns(cfg.DB.MaxIdleConns)
	db.SetConnMaxLifetime(cfg.DB.ConnMaxLifetime)
	e.db = db

	if err := storage.InitMySQL(db); err != nil {
		log.Printf("Warning: MySQL init error: %v", err)
	}

	e.redisClient = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%d", cfg.Redis.Host, cfg.Redis.Port),
		Password:     cfg.Redis.Password,
		DB:           cfg.Redis.DB,
		PoolSize:     cfg.Redis.PoolSize,
		MinIdleConns: cfg.Redis.MinIdleConns,
	})

	if _, err := e.redisClient.Ping(context.Background()).Result(); err != nil {
		log.Printf("Warning: Redis connection error: %v", err)
	}

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  "system",
		Level:     models.LevelInfo,
		Message:   "Engine initialized",
	})

	e.running = true
	go e.stateCollector()

	return nil
}

func (e *Engine) Close() {
	e.running = false
	if e.db != nil {
		e.db.Close()
	}
	if e.redisClient != nil {
		e.redisClient.Close()
	}
}

func (e *Engine) stateCollector() {
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if !e.running {
			return
		}
		e.TakeSnapshot()
	}
}

func (e *Engine) RegisterScenario(scenario models.Scenario) {
	e.mu.Lock()
	defer e.mu.Unlock()
	scenario.SetEventEmitter(e.addEvent)
	e.scenarios[scenario.Name()] = scenario
}

func (e *Engine) GetScenario(name string) (models.Scenario, bool) {
	e.mu.RLock()
	defer e.mu.RUnlock()
	s, ok := e.scenarios[name]
	return s, ok
}

func (e *Engine) ListScenarios() []string {
	e.mu.RLock()
	defer e.mu.RUnlock()
	names := make([]string, 0, len(e.scenarios))
	for name := range e.scenarios {
		names = append(names, name)
	}
	return names
}

func (e *Engine) StartScenario(name string) error {
	scenario, ok := e.GetScenario(name)
	if !ok {
		return fmt.Errorf("scenario not found: %s", name)
	}

	if scenario.Status() == models.StatusRunning {
		return fmt.Errorf("scenario %s is already running", name)
	}

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  name,
		Level:     models.LevelInfo,
		Message:   fmt.Sprintf("Starting scenario: %s", name),
	})

	return scenario.Start()
}

func (e *Engine) StopScenario(name string) error {
	scenario, ok := e.GetScenario(name)
	if !ok {
		return fmt.Errorf("scenario not found: %s", name)
	}

	err := scenario.Stop()

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  name,
		Level:     models.LevelInfo,
		Message:   fmt.Sprintf("Stopped scenario: %s", name),
	})

	return err
}

func (e *Engine) RecoverScenario(name string) error {
	scenario, ok := e.GetScenario(name)
	if !ok {
		return fmt.Errorf("scenario not found: %s", name)
	}

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  name,
		Level:     models.LevelInfo,
		Message:   fmt.Sprintf("Starting recovery for scenario: %s", name),
	})

	err := scenario.Recover()
	if err != nil {
		return err
	}

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  name,
		Level:     models.LevelInfo,
		Message:   fmt.Sprintf("Recovery completed for scenario: %s", name),
	})

	return nil
}

func (e *Engine) TakeSnapshot() {
	e.mu.Lock()
	defer e.mu.Unlock()

	var dbStats sql.DBStats
	if e.db != nil {
		dbStats = e.db.Stats()
	}

	state := models.SystemState{
		Timestamp:        time.Now(),
		ActiveGoroutines: runtime.NumGoroutine(),
		DBConnections:    dbStats.OpenConnections,
		DBIdle:           dbStats.Idle,
		DBInUse:          dbStats.InUse,
		RedisConnections: e.getRedisPoolStats(),
		Metrics:          make(map[string]interface{}),
	}

	for name, s := range e.scenarios {
		if s.Status() == models.StatusRunning {
			scenarioState := s.CurrentState()
			state.Metrics[name] = scenarioState.Metrics
			if scenarioState.QueueLength > 0 {
				state.QueueLength = scenarioState.QueueLength
			}
		}
	}

	snapshot := models.Snapshot{
		Timestamp: state.Timestamp,
		State:     state,
		Events:    e.timeline.GetAll(),
	}

	e.snapshots = append(e.snapshots, snapshot)

	maxSnapshots := 300
	if len(e.snapshots) > maxSnapshots {
		e.snapshots = e.snapshots[len(e.snapshots)-maxSnapshots:]
	}
}

func (e *Engine) getRedisPoolStats() int {
	if e.redisClient == nil {
		return 0
	}
	poolStats := e.redisClient.PoolStats()
	if poolStats != nil {
		return int(poolStats.TotalConns)
	}
	return 0
}

func (e *Engine) GetLatestState() models.SystemState {
	e.mu.RLock()
	defer e.mu.RUnlock()

	if len(e.snapshots) == 0 {
		return models.SystemState{Timestamp: time.Now()}
	}
	return e.snapshots[len(e.snapshots)-1].State
}

func (e *Engine) GetTimeline() *models.Timeline {
	return e.timeline
}

func (e *Engine) GetSnapshots() []models.Snapshot {
	e.mu.RLock()
	defer e.mu.RUnlock()
	result := make([]models.Snapshot, len(e.snapshots))
	copy(result, e.snapshots)
	return result
}

type ReplayResult struct {
	FromTime  time.Time
	ToTime    time.Time
	Events    []models.Event
	Snapshots []models.Snapshot
}

func (e *Engine) Replay(from time.Time, to time.Time) (*ReplayResult, error) {
	e.mu.RLock()
	snapshots := make([]models.Snapshot, len(e.snapshots))
	copy(snapshots, e.snapshots)
	e.mu.RUnlock()

	var filteredSnapshots []models.Snapshot
	for _, s := range snapshots {
		if (s.Timestamp.Equal(from) || s.Timestamp.After(from)) &&
			(s.Timestamp.Equal(to) || s.Timestamp.Before(to)) {
			filteredSnapshots = append(filteredSnapshots, s)
		}
	}

	events := e.timeline.GetAll()
	var filteredEvents []models.Event
	for _, ev := range events {
		if (ev.Timestamp.Equal(from) || ev.Timestamp.After(from)) &&
			(ev.Timestamp.Equal(to) || ev.Timestamp.Before(to)) {
			filteredEvents = append(filteredEvents, ev)
		}
	}

	result := &ReplayResult{
		FromTime:  from,
		ToTime:    to,
		Events:    filteredEvents,
		Snapshots: filteredSnapshots,
	}

	e.addEvent(models.Event{
		ID:        generateID(),
		Timestamp: time.Now(),
		Scenario:  "system",
		Level:     models.LevelInfo,
		Message:   fmt.Sprintf("Replay completed: %v snapshots, %v events in range", len(filteredSnapshots), len(filteredEvents)),
	})

	return result, nil
}

func (e *Engine) addEvent(event models.Event) {
	e.timeline.Add(event)
}

func (e *Engine) DB() *sql.DB {
	return e.db
}

func (e *Engine) Redis() *redis.Client {
	return e.redisClient
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
