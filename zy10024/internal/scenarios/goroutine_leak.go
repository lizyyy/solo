package scenarios

import (
	"runtime"
	"sync"
	"sync/atomic"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/pkg/models"
)

type GoroutineLeakScenario struct {
	*BaseScenario
	leakedCount int64
	leakCh      chan struct{}
	wg          sync.WaitGroup
	initialG    int
}

func NewGoroutineLeakScenario() *GoroutineLeakScenario {
	return &GoroutineLeakScenario{
		BaseScenario: NewBaseScenario("goroutine_leak", models.ScenarioGoroutineLeak),
	}
}

func (s *GoroutineLeakScenario) Config() map[string]interface{} {
	cfg := config.Get().Scenarios.GoroutineLeak
	return map[string]interface{}{
		"leak_rate":          cfg.LeakRate,
		"interval_ms":        cfg.IntervalMs,
		"max_leaked_goroutines": cfg.MaxLeakedGoroutines,
	}
}

func (s *GoroutineLeakScenario) Start() error {
	s.SetStatus(models.StatusRunning)
	s.ResetStopChannel()
	s.ClearEvents()
	s.initialG = runtime.NumGoroutine()
	atomic.StoreInt64(&s.leakedCount, 0)
	s.leakCh = make(chan struct{})
	s.wg.Add(1)

	go s.run()

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Goroutine leak scenario started", map[string]interface{}{
		"initial_goroutines": s.initialG,
		"leak_rate":          config.Get().Scenarios.GoroutineLeak.LeakRate,
	}))

	return nil
}

func (s *GoroutineLeakScenario) run() {
	defer s.wg.Done()
	cfg := config.Get().Scenarios.GoroutineLeak
	ticker := time.NewTicker(time.Duration(cfg.IntervalMs) * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-s.StopChannel():
			return
		case <-ticker.C:
			currentLeaked := atomic.LoadInt64(&s.leakedCount)
			currentTotal := runtime.NumGoroutine()

			if currentLeaked >= int64(cfg.MaxLeakedGoroutines) || currentTotal >= 5000 {
				s.AddEvent(newEvent(s.Name(), models.LevelError, "Goroutine LEAK CRITICAL!", map[string]interface{}{
					"leaked_count":  currentLeaked,
					"total_goroutines": currentTotal,
					"initial_goroutines": s.initialG,
					"growth_rate":   float64(currentTotal-s.initialG) / float64(s.initialG) * 100,
				}))
				continue
			}

			for i := 0; i < cfg.LeakRate; i++ {
				go s.leakGoroutine()
			}

			if currentLeaked%25 == 0 && currentLeaked > 0 {
				s.AddEvent(newEvent(s.Name(), models.LevelWarn, "Goroutine leak detected", map[string]interface{}{
					"leaked_count":  currentLeaked,
					"total_goroutines": currentTotal,
					"growth":        currentTotal - s.initialG,
				}))
			}
		}
	}
}

func (s *GoroutineLeakScenario) leakGoroutine() {
	atomic.AddInt64(&s.leakedCount, 1)

	data := make([]byte, 1024*100)
	for i := range data {
		data[i] = byte(i % 255)
	}

	<-s.leakCh
}

func (s *GoroutineLeakScenario) Stop() error {
	if s.Status() == models.StatusRunning {
		close(s.StopChannel())
		s.wg.Wait()
		s.SetStatus(models.StatusReady)

		s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Goroutine leak scenario stopped", map[string]interface{}{
			"final_leaked_count": atomic.LoadInt64(&s.leakedCount),
			"final_total":        runtime.NumGoroutine(),
		}))
	}
	return nil
}

func (s *GoroutineLeakScenario) Recover() error {
	s.Stop()

	close(s.leakCh)

	time.Sleep(200 * time.Millisecond)
	runtime.GC()
	runtime.Gosched()

	recoveredCount := atomic.LoadInt64(&s.leakedCount)
	atomic.StoreInt64(&s.leakedCount, 0)

	s.AddEvent(newEvent(s.Name(), models.LevelInfo, "Goroutines recovered", map[string]interface{}{
		"recovered_count": recoveredCount,
		"final_goroutines": runtime.NumGoroutine(),
	}))

	s.SetStatus(models.StatusRecovered)
	time.Sleep(100 * time.Millisecond)
	s.SetStatus(models.StatusReady)
	return nil
}

func (s *GoroutineLeakScenario) CurrentState() models.SystemState {
	currentTotal := runtime.NumGoroutine()
	return models.SystemState{
		Timestamp:        time.Now(),
		ActiveGoroutines: currentTotal,
		Metrics: map[string]interface{}{
			"leaked_count":  atomic.LoadInt64(&s.leakedCount),
			"initial_count": s.initialG,
			"growth_rate":   float64(currentTotal-s.initialG) / float64(s.initialG) * 100,
		},
	}
}
