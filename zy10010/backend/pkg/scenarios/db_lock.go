package scenarios

import (
	"fmt"
	"math/rand"
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"
)

type DbLockScenario struct {
	mu           sync.Mutex
	sm           *statemanager.StateManager
	eb           *eventbus.EventBus
	resources    []string
	stopCh       chan struct{}
	running      bool
}

func NewDbLockScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *DbLockScenario {
	return &DbLockScenario{
		sm:        sm,
		eb:        eb,
		resources: []string{"table_users", "table_orders", "table_products"},
		stopCh:    make(chan struct{}),
	}
}

func (s *DbLockScenario) Start(contentionRate float64, duration time.Duration) {
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	go s.simulateLocks(contentionRate, duration)
}

func (s *DbLockScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
		for _, res := range s.resources {
			s.sm.ReleaseLock(res)
		}
	}
}

func (s *DbLockScenario) simulateLocks(contentionRate float64, duration time.Duration) {
	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		default:
			if rand.Float64() < 0.8 {
				s.acquireAndReleaseLock(contentionRate)
			}
			time.Sleep(time.Duration(rand.Intn(100)) * time.Millisecond)
		}
	}
}

func (s *DbLockScenario) acquireAndReleaseLock(contentionRate float64) {
	resource := s.resources[rand.Intn(len(s.resources))]
	holderID := fmt.Sprintf("worker-%d", rand.Intn(100))

	if rand.Float64() < contentionRate {
		go func(res string, hID string) {
			s.sm.AcquireLock(res, hID)
			holdTime := time.Duration(rand.Intn(2000)+500) * time.Millisecond
			select {
			case <-s.stopCh:
				s.sm.ReleaseLock(res)
				return
			case <-time.After(holdTime):
				s.sm.ReleaseLock(res)
			}
		}(resource, holderID)

		time.Sleep(time.Duration(rand.Intn(50)) * time.Millisecond)

		waiterID := fmt.Sprintf("worker-%d", rand.Intn(100)+100)
		acquired := s.sm.AcquireLock(resource, waiterID)
		if !acquired {
			waitTime := time.Duration(rand.Intn(3000)+1000) * time.Millisecond
			s.eb.Publish(types.Event{
				Type:     types.EventTypeDbLockWait,
				Severity: types.SeverityWarning,
				Source:   "db_lock",
				Message:  "Worker waiting for lock",
				Data: map[string]interface{}{
					"waiter_id":   waiterID,
					"resource":    resource,
					"wait_time_ms": waitTime.Milliseconds(),
				},
			})
			s.sm.UpdateMetrics(func(m *types.SystemMetrics) {
				m.DbLockWaitTimeMs += waitTime.Milliseconds()
			})
		}
	} else {
		acquired := s.sm.AcquireLock(resource, holderID)
		if acquired {
			holdTime := time.Duration(rand.Intn(500)+100) * time.Millisecond
			go func(res string, hold time.Duration) {
				select {
				case <-s.stopCh:
					s.sm.ReleaseLock(res)
					return
				case <-time.After(hold):
					s.sm.ReleaseLock(res)
				}
			}(resource, holdTime)
		}
	}
}
