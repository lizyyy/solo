package chaos

import (
	"context"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"

	"go.uber.org/zap"

	"migration-chaos-simulator/internal/config"
	"migration-chaos-simulator/internal/logger"
	"migration-chaos-simulator/internal/queue"
	"migration-chaos-simulator/internal/storage"
	"migration-chaos-simulator/internal/tracer"
)

type ChaosEngine struct {
	cfg         config.ChaosConfig
	experiments sync.Map
	activeCount int32
	tracer      *tracer.Tracer
	dbPool      *storage.PostgresPool
	mqClient    *queue.RabbitMQClient
	onMetrics   func(*ChaosMetrics)
	mu          sync.Mutex
}

type EngineOptions struct {
	Tracer   *tracer.Tracer
	DBPool   *storage.PostgresPool
	MQClient *queue.RabbitMQClient
}

func NewEngine(cfg config.ChaosConfig, opts EngineOptions) *ChaosEngine {
	return &ChaosEngine{
		cfg:      cfg,
		tracer:   opts.Tracer,
		dbPool:   opts.DBPool,
		mqClient: opts.MQClient,
	}
}

func (e *ChaosEngine) SetMetricsCallback(fn func(*ChaosMetrics)) {
	e.onMetrics = fn
}

func (e *ChaosEngine) ListExperiments() []*ChaosExperiment {
	experiments := make([]*ChaosExperiment, 0)
	e.experiments.Range(func(key, value interface{}) bool {
		exp := value.(*ChaosExperiment)
		experiments = append(experiments, exp)
		return true
	})
	return experiments
}

func (e *ChaosEngine) GetExperiment(id string) (*ChaosExperiment, bool) {
	v, ok := e.experiments.Load(id)
	if !ok {
		return nil, false
	}
	return v.(*ChaosExperiment), true
}

func (e *ChaosEngine) StartExperiment(ctx context.Context, name string, chaosType ChaosType, cfg ExperimentConfig) (*ChaosExperiment, error) {
	if atomic.LoadInt32(&e.activeCount) >= int32(e.cfg.MaxConcurrentExperiments) {
		return nil, fmt.Errorf("max concurrent experiments reached: %d", e.cfg.MaxConcurrentExperiments)
	}

	experiment := &ChaosExperiment{
		ID:        generateExperimentID(),
		Name:      name,
		Type:      chaosType,
		Config:    cfg,
		Status:    ChaosStatusPending,
		StartTime: time.Now(),
		Metadata:  make(map[string]interface{}),
	}

	trace, traceCtx := e.tracer.StartTrace(name, map[string]interface{}{
		"experiment_id": experiment.ID,
		"chaos_type":    string(chaosType),
		"config":        cfg,
	})
	experiment.TraceID = trace.ID

	e.experiments.Store(experiment.ID, experiment)
	atomic.AddInt32(&e.activeCount, 1)

	go e.runExperiment(traceCtx, experiment)

	logger.Info("Chaos experiment started",
		zap.String("experiment_id", experiment.ID),
		zap.String("name", name),
		zap.String("type", string(chaosType)),
	)

	return experiment, nil
}

func (e *ChaosEngine) StopExperiment(id string) error {
	v, ok := e.experiments.Load(id)
	if !ok {
		return fmt.Errorf("experiment not found: %s", id)
	}

	exp := v.(*ChaosExperiment)
	exp.Status = ChaosStatusStopped
	exp.EndTime = time.Now()

	atomic.AddInt32(&e.activeCount, -1)
	e.tracer.EndTrace(exp.TraceID, tracer.SpanStatusCancelled)

	logger.Info("Chaos experiment stopped",
		zap.String("experiment_id", id),
	)

	return nil
}

func (e *ChaosEngine) runExperiment(ctx context.Context, exp *ChaosExperiment) {
	exp.Status = ChaosStatusRunning

	defer func() {
		exp.EndTime = time.Now()
		atomic.AddInt32(&e.activeCount, -1)
		if r := recover(); r != nil {
			exp.Status = ChaosStatusFailed
			logger.Error("Experiment panicked",
				zap.String("experiment_id", exp.ID),
				zap.Any("panic", r),
			)
		}
	}()

	duration := exp.Config.Duration.Duration()
	if duration == 0 {
		duration = e.cfg.DefaultExperimentDuration
	}

	ctx, cancel := context.WithTimeout(ctx, duration)
	defer cancel()

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	result := &ChaosResult{
		ExperimentID:   exp.ID,
		StartTimestamp: time.Now(),
	}

	switch exp.Type {
	case ChaosTypeHighConcurrency:
		e.runHighConcurrency(ctx, exp, result)
	case ChaosTypeTimeout:
		e.runTimeoutInjection(ctx, exp, result)
	case ChaosTypeNetworkDrop:
		e.runNetworkDrop(ctx, exp, result)
	case ChaosTypeDuplicateRequest:
		e.runDuplicateRequest(ctx, exp, result)
	case ChaosTypeDuplicateMessage:
		e.runDuplicateMessage(ctx, exp, result)
	case ChaosTypeSlowQuery:
		e.runSlowQuery(ctx, exp, result)
	case ChaosTypeConnectionDrop:
		e.runConnectionDrop(ctx, exp, result)
	case ChaosTypeLockContention:
		e.runLockContention(ctx, exp, result)
	default:
		exp.Status = ChaosStatusFailed
		return
	}

	result.EndTimestamp = time.Now()
	if ctx.Err() == context.DeadlineExceeded {
		exp.Status = ChaosStatusCompleted
	} else if ctx.Err() == context.Canceled {
		exp.Status = ChaosStatusStopped
	} else {
		exp.Status = ChaosStatusCompleted
	}

	exp.TotalRequests = result.TotalRequests
	exp.SuccessCount = result.SuccessCount
	exp.ErrorCount = result.ErrorCount

	e.tracer.EndTrace(exp.TraceID, tracer.SpanStatusOk)
}

func (e *ChaosEngine) runHighConcurrency(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	concurrentUsers := exp.Config.ConcurrentUsers
	if concurrentUsers == 0 {
		concurrentUsers = 100
	}

	requestsPerSecond := exp.Config.RequestsPerSecond
	if requestsPerSecond == 0 {
		requestsPerSecond = 1000
	}

	var wg sync.WaitGroup
	sem := make(chan struct{}, concurrentUsers)
	rateLimiter := time.NewTicker(time.Second / time.Duration(requestsPerSecond))
	defer rateLimiter.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-rateLimiter.C:
			sem <- struct{}{}
			wg.Add(1)

			go func() {
				defer wg.Done()
				defer func() { <-sem }()

				start := time.Now()
				atomic.AddInt64(&result.TotalRequests, 1)

				err := e.simulateDatabaseOperation(ctx, exp.Config)

				latency := time.Since(start)

				if err != nil {
					atomic.AddInt64(&result.ErrorCount, 1)
					e.tracer.AddEvent(ctx, tracer.EventLevelError, "High concurrency request failed", map[string]interface{}{
						"error":   err.Error(),
						"latency": latency.String(),
					})
				} else {
					atomic.AddInt64(&result.SuccessCount, 1)
				}
			}()
		}
	}
}

func (e *ChaosEngine) runTimeoutInjection(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	timeoutRate := 0.3
	if exp.Config.NetworkDropRate > 0 {
		timeoutRate = exp.Config.NetworkDropRate
	}

	timeoutDuration := time.Duration(exp.Config.TimeoutMs) * time.Millisecond
	if timeoutDuration == 0 {
		timeoutDuration = 5 * time.Second
	}

	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			atomic.AddInt64(&result.TotalRequests, 1)

			if rand.Float64() < timeoutRate {
				atomic.AddInt64(&result.ErrorCount, 1)
				e.tracer.AddEvent(ctx, tracer.EventLevelWarn, "Timeout injected", map[string]interface{}{
					"timeout_ms": exp.Config.TimeoutMs,
				})

				select {
				case <-time.After(timeoutDuration):
				case <-ctx.Done():
					return
				}
			} else {
				atomic.AddInt64(&result.SuccessCount, 1)
			}
		}
	}
}

func (e *ChaosEngine) runNetworkDrop(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	dropRate := exp.Config.NetworkDropRate
	if dropRate == 0 {
		dropRate = 0.5
	}

	ticker := time.NewTicker(5 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			atomic.AddInt64(&result.TotalRequests, 1)

			if rand.Float64() < dropRate {
				atomic.AddInt64(&result.ErrorCount, 1)
				e.tracer.AddEvent(ctx, tracer.EventLevelWarn, "Network connection dropped", map[string]interface{}{
					"drop_rate": dropRate,
				})

				retryCount := exp.Config.RetryCount
				if retryCount == 0 {
					retryCount = 3
				}

				for i := 0; i < retryCount; i++ {
					select {
					case <-time.After(time.Duration(100*(i+1)) * time.Millisecond):
						e.tracer.AddEvent(ctx, tracer.EventLevelInfo, "Retry attempt", map[string]interface{}{
							"attempt": i + 1,
							"total":   retryCount,
						})
					case <-ctx.Done():
						return
					}
				}
			} else {
				atomic.AddInt64(&result.SuccessCount, 1)
			}
		}
	}
}

func (e *ChaosEngine) runDuplicateRequest(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	duplicateRate := exp.Config.DuplicateRate
	if duplicateRate == 0 {
		duplicateRate = 0.4
	}

	duplicateCount := 2

	ticker := time.NewTicker(20 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			atomic.AddInt64(&result.TotalRequests, 1)
			atomic.AddInt64(&result.SuccessCount, 1)

			if rand.Float64() < duplicateRate {
				for i := 0; i < duplicateCount; i++ {
					atomic.AddInt64(&result.TotalRequests, 1)
					e.tracer.AddEvent(ctx, tracer.EventLevelWarn, "Duplicate request detected", map[string]interface{}{
						"duplicate_index": i,
					})
				}
			}
		}
	}
}

func (e *ChaosEngine) runDuplicateMessage(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	duplicateRate := exp.Config.DuplicateRate
	if duplicateRate == 0 {
		duplicateRate = 0.3
	}

	ticker := time.NewTicker(100 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			atomic.AddInt64(&result.TotalRequests, 1)
			atomic.AddInt64(&result.SuccessCount, 1)

			if rand.Float64() < duplicateRate {
				e.tracer.AddEvent(ctx, tracer.EventLevelWarn, "Duplicate message delivered", map[string]interface{}{
					"queue_target": exp.Config.MessageQueueTarget,
				})
				atomic.AddInt64(&result.TotalRequests, 1)
			}
		}
	}
}

func (e *ChaosEngine) runSlowQuery(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	delay := time.Duration(exp.Config.SlowQueryDelayMs) * time.Millisecond
	if delay == 0 {
		delay = 2 * time.Second
	}

	ticker := time.NewTicker(50 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			start := time.Now()
			atomic.AddInt64((*int64)(&result.TotalRequests), 1)

			select {
			case <-time.After(delay):
				atomic.AddInt64((*int64)(&result.SuccessCount), 1)
				e.tracer.AddEvent(ctx, tracer.EventLevelInfo, "Slow query completed", map[string]interface{}{
					"duration_ms": time.Since(start).Milliseconds(),
				})
			case <-ctx.Done():
				return
			}
		}
	}
}

func (e *ChaosEngine) runConnectionDrop(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	dropInterval := 10 * time.Second

	ticker := time.NewTicker(dropInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			atomic.AddInt64(&result.ErrorCount, 1)
			atomic.AddInt64(&result.TotalRequests, 1)
			e.tracer.AddEvent(ctx, tracer.EventLevelCritical, "Database connection dropped", map[string]interface{}{
				"reconnect_delay_ms": 5000,
			})

			select {
			case <-time.After(5 * time.Second):
				e.tracer.AddEvent(ctx, tracer.EventLevelInfo, "Connection restored", nil)
			case <-ctx.Done():
				return
			}
		}
	}
}

func (e *ChaosEngine) runLockContention(ctx context.Context, exp *ChaosExperiment, result *ChaosResult) {
	var lock sync.Mutex
	holdTime := time.Duration(exp.Config.LockHoldTimeMs) * time.Millisecond
	if holdTime == 0 {
		holdTime = 500 * time.Millisecond
	}

	for i := 0; i < 50; i++ {
		go func() {
			for {
				select {
				case <-ctx.Done():
					return
				default:
					lock.Lock()
					atomic.AddInt64((*int64)(&result.TotalRequests), 1)

					time.Sleep(holdTime)

					atomic.AddInt64((*int64)(&result.SuccessCount), 1)
					lock.Unlock()
				}
			}
		}()
	}

	<-ctx.Done()
}

func (e *ChaosEngine) simulateDatabaseOperation(ctx context.Context, cfg ExperimentConfig) error {
	delay := time.Duration(rand.Intn(100)) * time.Millisecond

	select {
	case <-time.After(delay):
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func generateExperimentID() string {
	return fmt.Sprintf("exp-%d-%s", time.Now().UnixNano(), randomString(8))
}

func randomString(n int) string {
	const letters = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, n)
	for i := range b {
		b[i] = letters[rand.Intn(len(letters))]
	}
	return string(b)
}

func (e *ChaosEngine) GetActiveCount() int {
	return int(atomic.LoadInt32(&e.activeCount))
}
