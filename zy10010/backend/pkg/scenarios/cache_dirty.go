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

type CacheDirtyScenario struct {
	mu          sync.Mutex
	sm          *statemanager.StateManager
	eb          *eventbus.EventBus
	cacheKeys   []string
	stopCh      chan struct{}
	running     bool
}

func NewCacheDirtyScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *CacheDirtyScenario {
	return &CacheDirtyScenario{
		sm:        sm,
		eb:        eb,
		cacheKeys: []string{"user:1", "user:2", "product:1", "product:2", "order:1"},
		stopCh:    make(chan struct{}),
	}
}

func (s *CacheDirtyScenario) Start(dirtyRate float64, duration time.Duration) {
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	go s.simulateCache(dirtyRate, duration)
}

func (s *CacheDirtyScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
	}
}

func (s *CacheDirtyScenario) simulateCache(dirtyRate float64, duration time.Duration) {
	for _, key := range s.cacheKeys {
		s.sm.SetCache(key, generateValue(), 10*time.Second)
	}

	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		default:
			if rand.Float64() < 0.7 {
				key := s.cacheKeys[rand.Intn(len(s.cacheKeys))]
				if rand.Float64() < dirtyRate {
					s.sm.MarkCacheDirty(key)
					s.eb.Publish(types.Event{
						Type:     types.EventTypeCacheDirty,
						Severity: types.SeverityWarning,
						Source:   "cache_manager",
						Message:  "Cache dirty data detected",
						Data: map[string]interface{}{
							"key": key,
						},
					})
				} else {
					s.sm.SetCache(key, generateValue(), 10*time.Second)
				}
			}
			time.Sleep(time.Duration(rand.Intn(200)) * time.Millisecond)
		}
	}
}

func generateValue() interface{} {
	return map[string]interface{}{
		"id":        rand.Intn(1000),
		"name":      fmt.Sprintf("Item-%d", rand.Intn(100)),
		"value":     rand.Float64() * 1000,
		"timestamp": time.Now().Unix(),
	}
}
