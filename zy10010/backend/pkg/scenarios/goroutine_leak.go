package scenarios

import (
	"math/rand"
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"
)

type GoroutineLeakScenario struct {
	mu           sync.Mutex
	sm           *statemanager.StateManager
	eb           *eventbus.EventBus
	goroutines   map[int64]*simGoroutine
	stopCh       chan struct{}
	running      bool
}

type simGoroutine struct {
	ID          int64
	Name        string
	CreatedAt   time.Time
	ExpectedEnd time.Time
	DoneCh      chan struct{}
	IsLeaked    bool
}

func NewGoroutineLeakScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *GoroutineLeakScenario {
	return &GoroutineLeakScenario{
		sm:         sm,
		eb:         eb,
		goroutines: make(map[int64]*simGoroutine),
		stopCh:     make(chan struct{}),
	}
}

func (s *GoroutineLeakScenario) Start(leakRate float64, duration time.Duration) {
	s.mu.Lock()
	s.running = true
	s.mu.Unlock()

	go s.simulateGoroutines(leakRate, duration)
	go s.checkLeakedGoroutines()
}

func (s *GoroutineLeakScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
		for _, g := range s.goroutines {
			close(g.DoneCh)
		}
		s.goroutines = make(map[int64]*simGoroutine)
	}
}

func (s *GoroutineLeakScenario) simulateGoroutines(leakRate float64, duration time.Duration) {
	endTime := time.Now().Add(duration)
	for time.Now().Before(endTime) {
		select {
		case <-s.stopCh:
			return
		default:
			if rand.Float64() < 0.6 {
				shouldLeak := rand.Float64() < leakRate
				s.createGoroutine(shouldLeak)
			}
			time.Sleep(time.Duration(rand.Intn(200)) * time.Millisecond)
		}
	}
}

func (s *GoroutineLeakScenario) createGoroutine(shouldLeak bool) {
	s.mu.Lock()

	goroutineName := "worker"
	if shouldLeak {
		goroutineName = "leaking-worker"
	}

	id := s.sm.AddGoroutine(types.GoroutineState{
		Name: goroutineName,
	})

	expectedDuration := time.Duration(rand.Intn(500)+100) * time.Millisecond
	g := &simGoroutine{
		ID:          id,
		Name:        goroutineName,
		CreatedAt:   time.Now(),
		ExpectedEnd: time.Now().Add(expectedDuration),
		DoneCh:      make(chan struct{}),
		IsLeaked:    shouldLeak,
	}

	s.goroutines[id] = g
	s.mu.Unlock()

	go func(gID int64, leak bool, done chan struct{}) {
		select {
		case <-done:
			s.mu.Lock()
			delete(s.goroutines, gID)
			s.mu.Unlock()
			s.sm.RemoveGoroutine(gID)
		case <-time.After(expectedDuration):
			if !leak {
				s.mu.Lock()
				delete(s.goroutines, gID)
				s.mu.Unlock()
				s.sm.RemoveGoroutine(gID)
			}
		}
	}(id, shouldLeak, g.DoneCh)
}

func (s *GoroutineLeakScenario) checkLeakedGoroutines() {
	ticker := time.NewTicker(500 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.stopCh:
			return
		case <-ticker.C:
			s.mu.Lock()
			for id, g := range s.goroutines {
				if g.IsLeaked && time.Now().After(g.ExpectedEnd) {
					s.sm.MarkGoroutineLeaked(id)
					delete(s.goroutines, id)
				}
			}
			s.mu.Unlock()
		}
	}
}
