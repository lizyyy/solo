package scenarios

import (
	"context"
	"database/sql"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/pkg/models"

	"github.com/redis/go-redis/v9"
)

type CacheDirtyScenario struct {
	*BaseScenario
	db           *sql.DB
	redisClient  *redis.Client
	wg           sync.WaitGroup
	dirtyCount   int64
	cacheHits    int64
	cacheMisses  int64
	updates      int64
}

func NewCacheDirtyScenario(db *sql.DB, redisClient *redis.Client) *CacheDirtyScenario {
	return &CacheDirtyScenario{
		BaseScenario: NewBaseScenario("cache_dirty_data", models.ScenarioCacheDirty),
		db:           db,
		redisClient:  redisClient,
	}
}

func (s *CacheDirtyScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.CacheDirty
	return map[string]interface{}{
		"update_interval_ms": cfg.UpdateIntervalMs,
	}
}

func (s *CacheDirtyScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	atomic.StoreInt64(&s.dirtyCount, 0)
	atomic.StoreInt64(&s.cacheHits, 0)
	atomic.StoreInt64(&s.cacheMisses, 0)
	atomic.StoreInt64(&s.updates, 0)

	s.wg.Add(2)
	go s.writerWorker()
	go s.readerWorker()

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Cache dirty data scenario started", map[string]interface{}{
		"update_interval": config.Get().Scenarios.CacheDirty.UpdateIntervalMs,
	}))

	return nil
}

func (s *CacheDirtyScenario) writerWorker() {
	defer s.wg.Done()
	cfg := config.Get().Scenarios.CacheDirty
	ticker := time.NewTicker(time.Duration(cfg.UpdateIntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			userID := rand.Intn(100) + 1
			newBalance := rand.Float64() * 10000

			if err := s.updateDB(userID, newBalance); err != nil {
				continue
			}

			atomic.AddInt64(&s.updates, 1)

			if rand.Float32() < 0.3 {
				atomic.AddInt64(&s.dirtyCount, 1)
				s.AddEvent(newEvent(s.Name(), models.LevelWarn, "Cache DIRTY data introduced", map[string]interface{}{
					"user_id":       userID,
					"db_balance":    fmt.Sprintf("%.2f", newBalance),
					"dirty_count":   atomic.LoadInt64(&s.dirtyCount),
				}))
			} else {
				s.updateCache(userID, newBalance)
			}
		}
	}
}

func (s *CacheDirtyScenario) readerWorker() {
	defer s.wg.Done()
	ticker := time.NewTicker(200 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			userID := rand.Intn(100) + 1
			cacheVal, err := s.readFromCache(userID)

			if err != nil {
				atomic.AddInt64(&s.cacheMisses, 1)
				dbVal, _ := s.readFromDB(userID)
				s.updateCache(userID, dbVal)
			} else {
				atomic.AddInt64(&s.cacheHits, 1)
				dbVal, _ := s.readFromDB(userID)

				if dbVal > 0 && cacheVal != dbVal {
					atomic.AddInt64(&s.dirtyCount, 1)
					s.AddEvent(newEvent(s.Name(), models.LevelError, "Dirty cache DETECTED!", map[string]interface{}{
						"user_id":    userID,
						"cache_val":  fmt.Sprintf("%.2f", cacheVal),
						"db_val":     fmt.Sprintf("%.2f", dbVal),
						"delta":      fmt.Sprintf("%.2f", dbVal-cacheVal),
					}))
				}
			}
		}
	}
}

func (s *CacheDirtyScenario) updateDB(userID int, balance float64) error {
	if s.db == nil {
		return nil
	}
	_, err := s.db.Exec("UPDATE test_users SET balance = ? WHERE id = ?", balance, userID)
	return err
}

func (s *CacheDirtyScenario) readFromDB(userID int) (float64, error) {
	if s.db == nil {
		return 0, nil
	}
	var balance float64
	err := s.db.QueryRow("SELECT balance FROM test_users WHERE id = ?", userID).Scan(&balance)
	return balance, err
}

func (s *CacheDirtyScenario) updateCache(userID int, balance float64) error {
	if s.redisClient == nil {
		return nil
	}
	key := fmt.Sprintf("user:%d:balance", userID)
	return s.redisClient.Set(context.Background(), key, balance, 5*time.Minute).Err()
}

func (s *CacheDirtyScenario) readFromCache(userID int) (float64, error) {
	if s.redisClient == nil {
		return 0, fmt.Errorf("redis not available")
	}
	key := fmt.Sprintf("user:%d:balance", userID)
	return s.redisClient.Get(context.Background(), key).Float64()
}

func (s *CacheDirtyScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.wg.Wait()
		s.SetStatus(models.StatusReady)

		s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Cache dirty scenario stopped", map[string]interface{}{
			"dirty_count":  atomic.LoadInt64(&s.dirtyCount),
			"cache_hits":   atomic.LoadInt64(&s.cacheHits),
			"cache_misses": atomic.LoadInt64(&s.cacheMisses),
			"updates":      atomic.LoadInt64(&s.updates),
		}))
	}
	return nil
}

func (s *CacheDirtyScenario) Recover() error {
	s.Stop()

	if s.redisClient != nil {
		keys, err := s.redisClient.Keys(context.Background(), "user:*:balance").Result()
		if err == nil {
			for _, key := range keys {
				s.redisClient.Del(context.Background(), key)
			}
			s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Cache cleared for recovery", map[string]interface{}{
				"keys_cleared": len(keys),
			}))
		}
	}

	atomic.StoreInt64(&s.dirtyCount, 0)

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *CacheDirtyScenario) CurrentState() models.SystemState {
	return models.SystemState{
		Timestamp: time.Now(),
		Metrics: map[string]interface{}{
			"dirty_count":    atomic.LoadInt64(&s.dirtyCount),
			"cache_hits":     atomic.LoadInt64(&s.cacheHits),
			"cache_misses":   atomic.LoadInt64(&s.cacheMisses),
			"updates":        atomic.LoadInt64(&s.updates),
			"hit_ratio":      float64(atomic.LoadInt64(&s.cacheHits)) /
				float64(atomic.LoadInt64(&s.cacheHits)+atomic.LoadInt64(&s.cacheMisses)+1) * 100,
		},
	}
}
