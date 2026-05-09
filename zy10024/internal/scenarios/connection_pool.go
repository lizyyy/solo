package scenarios

import (
	"context"
	"database/sql"
	"sync"
	"sync/atomic"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/pkg/models"
)

type ConnectionPoolScenario struct {
	*BaseScenario
	db           *sql.DB
	leakedConns  int64
	connections  map[int64]*sql.Conn
	connID       int64
	wg           sync.WaitGroup
	mu           sync.Mutex
}

func NewConnectionPoolScenario(db *sql.DB) *ConnectionPoolScenario {
	return &ConnectionPoolScenario{
		BaseScenario: NewBaseScenario("connection_pool_exhaustion", models.ScenarioConnectionPool),
		db:           db,
		connections:  make(map[int64]*sql.Conn),
	}
}

func (s *ConnectionPoolScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.ConnectionPool
	return map[string]interface{}{
		"leak_rate":        cfg.LeakRate,
		"interval_ms":      cfg.IntervalMs,
		"max_leaked_conns": cfg.MaxLeakedConns,
	}
}

func (s *ConnectionPoolScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	atomic.StoreInt64(&s.leakedConns, 0)
	s.ClearEvents()
	s.wg.Add(1)

	go s.run()
	return nil
}

func (s *ConnectionPoolScenario) run() {
	defer s.wg.Done()
	cfg := config.Get().Scenarios.ConnectionPool
	ticker := time.NewTicker(time.Duration(cfg.IntervalMs) * time.Millisecond)
	defer ticker.Stop()

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Connection pool exhaustion scenario started", map[string]interface{}{
		"max_connections": config.Get().DB.MaxOpenConns,
	}))

	for {
		select {
		case <-s.StopChannel():
			s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Connection pool scenario stopped", map[string]interface{}{
				"leaked_connections": atomic.LoadInt64(&s.leakedConns),
			}))
			return
		case <-ticker.C:
			if s.db == nil {
				s.AddEvent(newEvent(s.Name(), models.LevelWarn, "DB connection not available", nil))
				continue
			}

			stats := s.db.Stats()
			currentLeaked := atomic.LoadInt64(&s.leakedConns)

			if stats.OpenConnections >= config.Get().DB.MaxOpenConns || currentLeaked >= int64(cfg.MaxLeakedConns) {
				s.AddEvent(newEvent(s.Name(), models.LevelError, "Connection pool EXHAUSTED!", map[string]interface{}{
					"open_connections": stats.OpenConnections,
					"in_use":           stats.InUse,
					"idle":             stats.Idle,
					"leaked":           currentLeaked,
					"wait_count":       stats.WaitCount,
					"wait_duration":    stats.WaitDuration.String(),
				}))
			}

			for i := 0; i < cfg.LeakRate; i++ {
				go s.leakConnection()
			}
		}
	}
}

func (s *ConnectionPoolScenario) leakConnection() {
	if s.db == nil {
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	conn, err := s.db.Conn(ctx)
	if err != nil {
		s.AddEvent(newEvent(s.Name(), models.LevelError, "Failed to get connection: "+err.Error(), nil))
		return
	}

	id := atomic.AddInt64(&s.connID, 1)

	s.mu.Lock()
	s.connections[id] = conn
	s.mu.Unlock()

	newLeaked := atomic.AddInt64(&s.leakedConns, 1)

	if newLeaked%10 == 0 {
		s.AddEvent(newEvent(s.Name(), models.LevelWarn, "Connection leaked", map[string]interface{}{
			"connection_id": id,
			"total_leaked":  newLeaked,
		}))
	}
}

func (s *ConnectionPoolScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.wg.Wait()
		s.SetStatus(models.StatusReady)
	}
	return nil
}

func (s *ConnectionPoolScenario) Recover() error {
	s.Stop()

	s.mu.Lock()
	defer s.mu.Unlock()

	recoveredCount := 0
	for id, conn := range s.connections {
		if conn != nil {
			conn.Close()
			recoveredCount++
		}
		delete(s.connections, id)
	}

	atomic.StoreInt64(&s.leakedConns, 0)

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Connection pool recovered", map[string]interface{}{
		"recovered_connections": recoveredCount,
	}))

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *ConnectionPoolScenario) CurrentState() models.SystemState {
	var stats sql.DBStats
	if s.db != nil {
		stats = s.db.Stats()
	}

	return models.SystemState{
		Timestamp:     time.Now(),
		DBConnections: stats.OpenConnections,
		DBIdle:        stats.Idle,
		DBInUse:       stats.InUse,
		Metrics: map[string]interface{}{
			"leaked_connections": atomic.LoadInt64(&s.leakedConns),
			"wait_count":         stats.WaitCount,
		},
	}
}
