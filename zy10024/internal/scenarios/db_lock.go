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

type DBLockWaitScenario struct {
	*BaseScenario
	db              *sql.DB
	workers         int
	lockedRows      int64
	waitingWorkers  int64
	lockTimeouts    int64
	wg              sync.WaitGroup
}

func NewDBLockWaitScenario(db *sql.DB) *DBLockWaitScenario {
	return &DBLockWaitScenario{
		BaseScenario: NewBaseScenario("db_lock_wait", models.ScenarioDBLockWait),
		db:           db,
	}
}

func (s *DBLockWaitScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.DBLockWait
	return map[string]interface{}{
		"num_workers": cfg.NumWorkers,
		"hold_time_ms": cfg.HoldTimeMs,
	}
}

func (s *DBLockWaitScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	atomic.StoreInt64(&s.lockedRows, 0)
	atomic.StoreInt64(&s.waitingWorkers, 0)
	atomic.StoreInt64(&s.lockTimeouts, 0)

	cfg := config.Get().Scenarios.DBLockWait
	s.workers = cfg.NumWorkers

	s.wg.Add(s.workers)
	for i := 0; i < s.workers; i++ {
		go s.lockWorker(i)
	}

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "DB lock wait scenario started", map[string]interface{}{
		"num_workers": s.workers,
		"hold_time":   cfg.HoldTimeMs,
	}))

	return nil
}

func (s *DBLockWaitScenario) lockWorker(workerID int) {
	defer s.wg.Done()

	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			if s.db == nil {
				continue
			}

			userID := (workerID % 10) + 1
			atomic.AddInt64(&s.waitingWorkers, 1)

			ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			err := s.acquireAndHoldLock(ctx, userID)
			cancel()

			atomic.AddInt64(&s.waitingWorkers, -1)

			if err != nil {
				atomic.AddInt64(&s.lockTimeouts, 1)
				if ctx.Err() == context.DeadlineExceeded {
					s.AddEvent(newEvent(s.Name(), models.LevelError, "Lock acquisition TIMEOUT", map[string]interface{}{
						"worker_id": workerID,
						"user_id":   userID,
						"waiting":   atomic.LoadInt64(&s.waitingWorkers),
					}))
				}
			}

			currentLocked := atomic.LoadInt64(&s.lockedRows)
			if currentLocked >= 5 {
				s.AddEvent(newEvent(s.Name(), models.LevelWarn, "High lock contention detected", map[string]interface{}{
					"locked_rows":      currentLocked,
					"waiting_workers":  atomic.LoadInt64(&s.waitingWorkers),
					"lock_timeouts":    atomic.LoadInt64(&s.lockTimeouts),
				}))
			}
		}
	}
}

func (s *DBLockWaitScenario) acquireAndHoldLock(ctx context.Context, userID int) error {
	tx, err := s.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelSerializable,
	})
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.ExecContext(ctx, "SELECT balance FROM test_users WHERE id = ? FOR UPDATE", userID)
	if err != nil {
		return err
	}

	atomic.AddInt64(&s.lockedRows, 1)
	defer atomic.AddInt64(&s.lockedRows, -1)

	_, err = tx.ExecContext(ctx, "UPDATE test_users SET balance = balance + 1 WHERE id = ?", userID)
	if err != nil {
		return err
	}

	holdTime := time.Duration(config.Get().Scenarios.DBLockWait.HoldTimeMs) * time.Millisecond
	select {
	case <-time.After(holdTime):
	case <-ctx.Done():
		return ctx.Err()
	}

	return tx.Commit()
}

func (s *DBLockWaitScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.wg.Wait()
		s.SetStatus(models.StatusReady)

		s.AddEvent(newEvent(s.Name(), models.LevelInfo, "DB lock wait scenario stopped", map[string]interface{}{
			"final_locked_rows":  atomic.LoadInt64(&s.lockedRows),
			"lock_timeouts":      atomic.LoadInt64(&s.lockTimeouts),
		}))
	}
	return nil
}

func (s *DBLockWaitScenario) Recover() error {
	s.Stop()

	if s.db != nil {
		_, err := s.db.Exec("KILL QUERY CONNECTION_ID()")
		if err != nil {
		}
	}

	atomic.StoreInt64(&s.lockedRows, 0)
	atomic.StoreInt64(&s.waitingWorkers, 0)

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "DB lock scenario recovered", map[string]interface{}{
		"total_timeouts": atomic.LoadInt64(&s.lockTimeouts),
	}))

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *DBLockWaitScenario) CurrentState() models.SystemState {
	var stats sql.DBStats
	if s.db != nil {
		stats = s.db.Stats()
	}

	return models.SystemState{
		Timestamp:     time.Now(),
		DBConnections: stats.OpenConnections,
		DBInUse:       stats.InUse,
		Metrics: map[string]interface{}{
			"locked_rows":      atomic.LoadInt64(&s.lockedRows),
			"waiting_workers":  atomic.LoadInt64(&s.waitingWorkers),
			"lock_timeouts":    atomic.LoadInt64(&s.lockTimeouts),
			"workers":          s.workers,
		},
	}
}
