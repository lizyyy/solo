package replay

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"concurrency-detector/internal/models"
)

type Replayer struct {
	activeTasks sync.Map
}

type ReplayResult struct {
	Success         bool
	DetectedRaces   int
	GoroutineLeaked int
	Deadlock        bool
	Timeout         bool
	Cancelled       bool
	Message         string
	Metrics         map[string]interface{}
}

func NewReplayer() *Replayer {
	return &Replayer{}
}

func (r *Replayer) RunReplay(ctx context.Context, category models.RiskCategory, config map[string]interface{}) (*ReplayResult, error) {
	switch category {
	case models.RiskCategoryConcurrentMap:
		return r.replayConcurrentMap(ctx, config)
	case models.RiskCategoryHotKeyWrite:
		return r.replayHotKey(ctx, config)
	case models.RiskCategoryGoroutineLeak:
		return r.replayGoroutineLeak(ctx, config)
	case models.RiskCategoryChannelBlocked:
		return r.replayChannelBlocked(ctx, config)
	case models.RiskCategoryWorkerBacklog:
		return r.replayWorkerBacklog(ctx, config)
	default:
		return &ReplayResult{
			Success: true,
			Message: fmt.Sprintf("Category %s does not support replay simulation", category),
		}, nil
	}
}

func (r *Replayer) replayConcurrentMap(ctx context.Context, config map[string]interface{}) (*ReplayResult, error) {
	concurrency := getIntConfig(config, "concurrency", 10)
	duration := getDurationConfig(config, "duration", 2*time.Second)
	useLock := getBoolConfig(config, "use_lock", false)

	var raceCount int32
	testMap := make(map[string]int)
	var mu sync.RWMutex

	ctx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	var wg sync.WaitGroup
	startTime := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			key := fmt.Sprintf("key_%d", id%3)

			for {
				select {
				case <-ctx.Done():
					return
				default:
				}

				if useLock {
					if id%2 == 0 {
						mu.RLock()
						_ = testMap[key]
						mu.RUnlock()
					} else {
						mu.Lock()
						testMap[key] = id
						mu.Unlock()
					}
				} else {
					if id%2 == 0 {
						_ = testMap[key]
					} else {
						testMap[key] = id
					}
					atomic.AddInt32(&raceCount, 1)
				}

				time.Sleep(1 * time.Millisecond)
			}
		}(i)
	}

	wg.Wait()

	result := &ReplayResult{
		Success:       true,
		DetectedRaces: int(atomic.LoadInt32(&raceCount)),
		Metrics: map[string]interface{}{
			"concurrency": concurrency,
			"duration":    time.Since(startTime).String(),
			"use_lock":    useLock,
			"map_size":    len(testMap),
		},
	}

	if !useLock && result.DetectedRaces > 0 {
		result.Message = fmt.Sprintf("Successfully simulated concurrent map access without locks. %d unsynchronized operations detected.", result.DetectedRaces)
	} else if useLock {
		result.Message = "Simulation completed with proper locking - no data races would occur."
	}

	return result, nil
}

func (r *Replayer) replayHotKey(ctx context.Context, config map[string]interface{}) (*ReplayResult, error) {
	concurrency := getIntConfig(config, "concurrency", 20)
	duration := getDurationConfig(config, "duration", 3*time.Second)
	hotKeyRatio := getFloatConfig(config, "hot_key_ratio", 0.8)

	var totalOps int64
	var hotKeyOps int64
	var mu sync.Mutex
	testMap := make(map[string]int)

	ctx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	var wg sync.WaitGroup
	startTime := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			counter := 0

			for {
				select {
				case <-ctx.Done():
					return
				default:
				}

				var key string
				isHotKey := false
				if float64(counter%100)/100.0 < hotKeyRatio {
					key = "hot_key_0"
					isHotKey = true
				} else {
					key = fmt.Sprintf("cold_key_%d", (counter/10)%100)
				}

				mu.Lock()
				testMap[key] = counter
				mu.Unlock()

				atomic.AddInt64(&totalOps, 1)
				if isHotKey {
					atomic.AddInt64(&hotKeyOps, 1)
				}

				counter++
			}
		}(i)
	}

	wg.Wait()

	elapsed := time.Since(startTime)
	total := atomic.LoadInt64(&totalOps)
	hotOps := atomic.LoadInt64(&hotKeyOps)
	hotRatio := float64(hotOps) / float64(total) * 100

	result := &ReplayResult{
		Success: true,
		Metrics: map[string]interface{}{
			"concurrency":        concurrency,
			"duration":           elapsed.String(),
			"total_operations":   total,
			"hot_key_operations": hotOps,
			"hot_key_ratio_actual": fmt.Sprintf("%.1f%%", hotRatio),
			"hot_key_ratio_config": fmt.Sprintf("%.1f%%", hotKeyRatio*100),
			"ops_per_second":     int64(float64(total) / elapsed.Seconds()),
		},
	}

	result.Message = fmt.Sprintf("Hot key simulation completed. Hot key received %.1f%% of %d total operations. This demonstrates how a single key can become a bottleneck under concurrent access.", hotRatio, total)

	return result, nil
}

func (r *Replayer) replayGoroutineLeak(ctx context.Context, config map[string]interface{}) (*ReplayResult, error) {
	leakCount := getIntConfig(config, "leak_count", 5)
	duration := getDurationConfig(config, "duration", 1*time.Second)
	useContext := getBoolConfig(config, "use_context", false)

	var leakedCount int32
	var wg sync.WaitGroup
	started := time.Now()

	mainCtx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	for i := 0; i < leakCount; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			if useContext {
				select {
				case <-mainCtx.Done():
					return
				case <-time.After(10 * time.Second):
					atomic.AddInt32(&leakedCount, 1)
				}
			} else {
				leakChan := make(chan struct{})
				go func() {
					<-mainCtx.Done()
					close(leakChan)
				}()

				select {
				case <-leakChan:
					return
				case <-time.After(10 * time.Second):
					atomic.AddInt32(&leakedCount, 1)
				}
			}
		}(i)
	}

	wg.Wait()

	elapsed := time.Since(started)
	leaked := int(atomic.LoadInt32(&leakedCount))

	result := &ReplayResult{
		Success:         true,
		GoroutineLeaked: leaked,
		Metrics: map[string]interface{}{
			"config_leak_count": leakCount,
			"actual_leaked":     leaked,
			"duration":          elapsed.String(),
			"use_context":       useContext,
		},
	}

	if useContext {
		result.Message = "Simulation with proper context usage: all goroutines were cancelled properly. No leaks occurred."
	} else {
		result.Message = fmt.Sprintf("Goroutine leak simulation: %d/%d goroutines would have leaked if not for the timeout. This demonstrates how goroutines without proper cancellation mechanisms can accumulate.", leaked, leakCount)
	}

	return result, nil
}

func (r *Replayer) replayChannelBlocked(ctx context.Context, config map[string]interface{}) (*ReplayResult, error) {
	concurrency := getIntConfig(config, "concurrency", 3)
	duration := getDurationConfig(config, "duration", 2*time.Second)
	useTimeout := getBoolConfig(config, "use_timeout", false)

	var blockedCount int32
	var wg sync.WaitGroup

	ctx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	unbufferedChan := make(chan int)

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			if useTimeout {
				select {
				case unbufferedChan <- id:
				case <-time.After(500 * time.Millisecond):
					atomic.AddInt32(&blockedCount, 1)
					return
				case <-ctx.Done():
					return
				}
			} else {
				select {
				case unbufferedChan <- id:
				case <-ctx.Done():
					atomic.AddInt32(&blockedCount, 1)
					return
				}
			}
		}(i)
	}

	time.Sleep(500 * time.Millisecond)

	if useTimeout {
		wg.Wait()
	} else {
		cancel()
		wg.Wait()
	}

	blocked := int(atomic.LoadInt32(&blockedCount))

	result := &ReplayResult{
		Success: true,
		Metrics: map[string]interface{}{
			"concurrency":       concurrency,
			"blocked_goroutines": blocked,
			"use_timeout":       useTimeout,
		},
	}

	if useTimeout {
		result.Message = fmt.Sprintf("Channel simulation with timeout: %d goroutines timed out safely. This demonstrates proper channel usage with select+timeout.", blocked)
	} else {
		result.Message = fmt.Sprintf("Channel block simulation: %d/%d goroutines were blocked on channel send (no receiver). This is a common pattern leading to goroutine leaks or deadlocks.", blocked, concurrency)
	}

	return result, nil
}

func (r *Replayer) replayWorkerBacklog(ctx context.Context, config map[string]interface{}) (*ReplayResult, error) {
	workerCount := getIntConfig(config, "worker_count", 2)
	queueCapacity := getIntConfig(config, "queue_capacity", 10)
	taskCount := getIntConfig(config, "task_count", 50)
	taskDuration := getDurationConfig(config, "task_duration", 100*time.Millisecond)

	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()

	type Task struct {
		ID      int
		Payload string
	}

	taskQueue := make(chan Task, queueCapacity)
	var processedCount int32
	var backloggedCount int32
	var rejectedCount int32

	var wg sync.WaitGroup
	startTime := time.Now()

	for i := 0; i < workerCount; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case task := <-taskQueue:
					_ = task
					time.Sleep(taskDuration)
					atomic.AddInt32(&processedCount, 1)
				case <-ctx.Done():
					return
				}
			}
		}(i)
	}

	for i := 0; i < taskCount; i++ {
		select {
		case taskQueue <- Task{ID: i, Payload: fmt.Sprintf("task_%d", i)}:
		default:
			atomic.AddInt32(&rejectedCount, 1)
			atomic.AddInt32(&backloggedCount, 1)
		}
	}

	queueLength := len(taskQueue)
	if queueLength > queueCapacity/2 {
		atomic.AddInt32(&backloggedCount, int32(queueLength))
	}

	time.Sleep(2 * time.Second)
	cancel()
	wg.Wait()

	elapsed := time.Since(startTime)
	processed := atomic.LoadInt32(&processedCount)
	rejected := atomic.LoadInt32(&rejectedCount)

	result := &ReplayResult{
		Success: true,
		Metrics: map[string]interface{}{
			"worker_count":      workerCount,
			"queue_capacity":    queueCapacity,
			"total_tasks":       taskCount,
			"processed_tasks":   processed,
			"rejected_tasks":    rejected,
			"remaining_queue":   len(taskQueue),
			"task_duration":     taskDuration.String(),
			"elapsed":           elapsed.String(),
			"throughput":        fmt.Sprintf("%.2f tasks/sec", float64(processed)/elapsed.Seconds()),
		},
	}

	if rejected > 0 {
		result.Message = fmt.Sprintf("Worker backlog simulation: %d/%d tasks rejected due to full queue. With %d workers each taking %v, the system couldn't keep up with the incoming rate. This demonstrates backpressure and queue overflow scenarios.", rejected, taskCount, workerCount, taskDuration)
	} else {
		result.Message = fmt.Sprintf("Worker simulation completed: %d/%d tasks processed successfully. System had sufficient capacity for the load.", processed, taskCount)
	}

	return result, nil
}

func getIntConfig(config map[string]interface{}, key string, defaultValue int) int {
	if v, ok := config[key]; ok {
		switch val := v.(type) {
		case int:
			return val
		case float64:
			return int(val)
		}
	}
	return defaultValue
}

func getDurationConfig(config map[string]interface{}, key string, defaultValue time.Duration) time.Duration {
	if v, ok := config[key]; ok {
		switch val := v.(type) {
		case time.Duration:
			return val
		case float64:
			return time.Duration(val) * time.Second
		case int:
			return time.Duration(val) * time.Second
		}
	}
	return defaultValue
}

func getBoolConfig(config map[string]interface{}, key string, defaultValue bool) bool {
	if v, ok := config[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return defaultValue
}

func getFloatConfig(config map[string]interface{}, key string, defaultValue float64) float64 {
	if v, ok := config[key]; ok {
		switch val := v.(type) {
		case float64:
			return val
		case int:
			return float64(val)
		}
	}
	return defaultValue
}
