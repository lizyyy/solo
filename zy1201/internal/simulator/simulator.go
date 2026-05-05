package simulator

import (
	"db-audit/internal/config"
	"db-audit/internal/storage"
	"fmt"
	"math/rand"
	"sync"
	"sync/atomic"
	"time"
)

type Simulator struct {
	profile *config.AnalysisProfile
	storage *storage.Storage
}

type SimulationConfig struct {
	Duration           time.Duration
	ConcurrentClients  int
	QueryPerSecond     int
	EnableConnectionPool bool
	PoolSize           int
	WriteRatio         float64
}

type SimulationResult struct {
	ConnectionPool *ConnectionPoolSimulationResult
	WritePerformance *WritePerformanceSimulationResult
}

type ConnectionPoolSimulationResult struct {
	TotalRequests        int64
	SuccessfulRequests   int64
	FailedRequests       int64
	TimeoutRequests      int64
	WaitTimeAvg          time.Duration
	WaitTimeMax          time.Duration
	WaitTimeP95          time.Duration
	ConnectionsUsedMax   int
	ConnectionWaitQueue  int64
	PoolExhaustionEvents int64
}

type WritePerformanceSimulationResult struct {
	SingleRowAvgTime   time.Duration
	SingleRowP95Time   time.Duration
	SingleRowTotalTime time.Duration
	SingleRowCount     int64
	BatchRowAvgTime    time.Duration
	BatchRowP95Time    time.Duration
	BatchRowTotalTime  time.Duration
	BatchRowCount       int64
	PerformanceRatio   float64
	BatchSizes          map[int]int64
}

func NewSimulator(profile *config.AnalysisProfile, store *storage.Storage) *Simulator {
	return &Simulator{
		profile: profile,
		storage: store,
	}
}

func (s *Simulator) SimulateConnectionPoolExhaustion(cfg *SimulationConfig) (*ConnectionPoolSimulationResult, error) {
	result := &ConnectionPoolSimulationResult{
		BatchSizes: make(map[int]int64),
	}

	var poolSize int
	if s.profile.Profile != nil && s.profile.Profile.ConnectionPool.MaxOpenConns > 0 {
		poolSize = s.profile.Profile.ConnectionPool.MaxOpenConns
	} else {
		poolSize = cfg.PoolSize
	}

	if poolSize <= 0 {
		poolSize = 10
	}

	var concurrentClients int
	if cfg.ConcurrentClients > 0 {
		concurrentClients = cfg.ConcurrentClients
	} else {
		concurrentClients = poolSize * 3
	}

	var activeConnections int64
	var waitQueue int64
	var totalWaitTime int64
	var maxWaitTime int64
	var poolExhaustionCount int64
	var timeoutCount int64
	var successCount int64
	var failCount int64

	waitTimes := make([]int64, 0, concurrentClients*100)
	var mu sync.Mutex

	var acquireTimeout time.Duration
	if s.profile.Profile != nil && s.profile.Profile.ConnectionPool.AcquireTimeout > 0 {
		acquireTimeout = s.profile.Profile.ConnectionPool.AcquireTimeout
	} else {
		acquireTimeout = 5 * time.Second
	}

	var wg sync.WaitGroup
	duration := cfg.Duration
	if duration <= 0 {
		duration = 10 * time.Second
	}

	startTime := time.Now()
	stopTime := startTime.Add(duration)

	for i := 0; i < concurrentClients; i++ {
		wg.Add(1)
		go func(clientID int) {
			defer wg.Done()

			for time.Now().Before(stopTime) {
				requestStartTime := time.Now()

				atomic.AddInt64(&waitQueue, 1)

				acquired := false
				waitStart := time.Now()

				for !acquired && time.Since(waitStart) < acquireTimeout {
					currentActive := atomic.LoadInt64(&activeConnections)
					if currentActive < int64(poolSize) {
						if atomic.CompareAndSwapInt64(&activeConnections, currentActive, currentActive+1) {
							acquired = true
						}
					} else {
						atomic.AddInt64(&poolExhaustionCount, 1)
						time.Sleep(time.Millisecond * time.Duration(rand.Intn(50)+10))
					}
				}

				waitTime := time.Since(waitStart)
				atomic.AddInt64(&waitQueue, -1)

				mu.Lock()
				waitTimes = append(waitTimes, waitTime.Nanoseconds())
				if waitTime.Nanoseconds() > maxWaitTime {
					maxWaitTime = waitTime.Nanoseconds()
				}
				mu.Unlock()

				atomic.AddInt64(&totalWaitTime, waitTime.Nanoseconds())

				if !acquired {
					atomic.AddInt64(&timeoutCount, 1)
					atomic.AddInt64(&failCount, 1)
					continue
				}

				queryTime := time.Millisecond * time.Duration(rand.Intn(100)+10)
				time.Sleep(queryTime)

				atomic.AddInt64(&activeConnections, -1)
				atomic.AddInt64(&successCount, 1)

				time.Sleep(time.Millisecond * time.Duration(rand.Intn(20)))
			}
		}(i)
	}

	wg.Wait()

	result.TotalRequests = successCount + failCount
	result.SuccessfulRequests = successCount
	result.FailedRequests = failCount
	result.TimeoutRequests = timeoutCount
	result.PoolExhaustionEvents = poolExhaustionCount

	if len(waitTimes) > 0 {
		result.WaitTimeAvg = time.Duration(totalWaitTime / int64(len(waitTimes)))
		result.WaitTimeMax = time.Duration(maxWaitTime)
		result.WaitTimeP95 = calculateP95(waitTimes)
	}

	result.ConnectionsUsedMax = poolSize
	result.ConnectionWaitQueue = atomic.LoadInt64(&waitQueue)

	return result, nil
}

func (s *Simulator) SimulateWritePerformance(cfg *SimulationConfig) (*WritePerformanceSimulationResult, error) {
	result := &WritePerformanceSimulationResult{
		BatchSizes: make(map[int]int64),
	}

	batchSizes := []int{1, 10, 50, 100, 500, 1000}

	for _, batchSize := range batchSizes {
		runResult := s.runWriteBenchmark(batchSize, 100)

		result.BatchSizes[batchSize] = int64(runResult.totalOps)

		if batchSize == 1 {
			result.SingleRowAvgTime = runResult.avgTime
			result.SingleRowP95Time = runResult.p95Time
			result.SingleRowTotalTime = runResult.totalTime
			result.SingleRowCount = int64(runResult.totalOps)
		} else {
			result.BatchRowAvgTime = runResult.avgTime
			result.BatchRowP95Time = runResult.p95Time
			result.BatchRowTotalTime = runResult.totalTime
			result.BatchRowCount = int64(runResult.totalOps)
		}
	}

	if result.SingleRowAvgTime > 0 && result.BatchRowAvgTime > 0 {
		result.PerformanceRatio = float64(result.SingleRowAvgTime) / float64(result.BatchRowAvgTime)
	}

	return result, nil
}

type writeBenchmarkResult struct {
	totalOps  int
	avgTime   time.Duration
	p95Time   time.Duration
	totalTime time.Duration
}

func (s *Simulator) runWriteBenchmark(batchSize int, iterations int) writeBenchmarkResult {
	latencies := make([]time.Duration, 0, iterations)
	var totalTime time.Duration

	for i := 0; i < iterations; i++ {
		start := time.Now()

		baseLatency := time.Duration(float64(batchSize)*0.1 + 5)
		overhead := time.Duration(rand.Intn(10))
		latency := baseLatency*time.Millisecond + overhead*time.Millisecond

		time.Sleep(latency)

		elapsed := time.Since(start)
		latencies = append(latencies, elapsed)
		totalTime += elapsed
	}

	var avgTime time.Duration
	if len(latencies) > 0 {
		avgTime = totalTime / time.Duration(len(latencies))
	}

	p95Time := calculateP95Duration(latencies)

	return writeBenchmarkResult{
		totalOps:  iterations,
		avgTime:   avgTime,
		p95Time:   p95Time,
		totalTime: totalTime,
	}
}

func calculateP95(values []int64) time.Duration {
	if len(values) == 0 {
		return 0
	}

	index := int(float64(len(values)) * 0.95)
	if index >= len(values) {
		index = len(values) - 1
	}

	valuesCopy := make([]int64, len(values))
	copy(valuesCopy, values)

	for i := 0; i < len(valuesCopy)-1; i++ {
		for j := 0; j < len(valuesCopy)-i-1; j++ {
			if valuesCopy[j] > valuesCopy[j+1] {
				valuesCopy[j], valuesCopy[j+1] = valuesCopy[j+1], valuesCopy[j]
			}
		}
	}

	return time.Duration(valuesCopy[index])
}

func calculateP95Duration(values []time.Duration) time.Duration {
	if len(values) == 0 {
		return 0
	}

	nanos := make([]int64, len(values))
	for i, v := range values {
		nanos[i] = v.Nanoseconds()
	}

	return calculateP95(nanos)
}

func (s *Simulator) SaveSimulationResult(sessionID int64, result *SimulationResult) error {
	if result.WritePerformance != nil {
		wp := result.WritePerformance
		analyses := []storage.WritePerformanceAnalysis{
			{
				TableName:        "simulation",
				Operation:        "INSERT",
				AvgSingleRowTime: wp.SingleRowAvgTime,
				AvgBatchRowTime:  wp.BatchRowAvgTime,
				BatchSize:        100,
				PerformanceRatio: wp.PerformanceRatio,
				Recommendation:   s.generateWriteRecommendation(wp),
			},
		}

		if err := s.storage.SaveWritePerformanceAnalysis(sessionID, analyses); err != nil {
			return err
		}
	}

	if result.ConnectionPool != nil {
		cp := result.ConnectionPool
		var issues []string
		var suggestions []string

		if cp.TimeoutRequests > 0 {
			issues = append(issues, fmt.Sprintf("存在 %d 个连接超时请求", cp.TimeoutRequests))
			suggestions = append(suggestions, "建议增加连接池大小或优化查询速度")
		}

		if cp.PoolExhaustionEvents > 100 {
			issues = append(issues, fmt.Sprintf("连接池耗尽事件频繁: %d 次", cp.PoolExhaustionEvents))
			suggestions = append(suggestions, "建议增大 max_open_conns")
		}

		if cp.WaitTimeAvg > time.Second {
			issues = append(issues, fmt.Sprintf("平均等待时间过长: %v", cp.WaitTimeAvg))
			suggestions = append(suggestions, "建议优化连接池配置或增加从库")
		}

		rating := "GOOD"
		if cp.TimeoutRequests > 0 {
			rating = "CRITICAL"
		} else if cp.PoolExhaustionEvents > 100 {
			rating = "HIGH"
		} else if cp.WaitTimeAvg > 500*time.Millisecond {
			rating = "MEDIUM"
		}

		analysis := &storage.ConnectionPoolAnalysis{
			MaxOpenConns:     cp.ConnectionsUsedMax,
			MaxIdleConns:     cp.ConnectionsUsedMax / 2,
			ConnectionRating: rating,
			Issues:           joinStrings(issues),
			Suggestions:      joinStrings(suggestions),
		}

		if err := s.storage.SaveConnectionPoolAnalysis(sessionID, analysis); err != nil {
			return err
		}
	}

	return nil
}

func (s *Simulator) generateWriteRecommendation(wp *WritePerformanceSimulationResult) string {
	if wp.PerformanceRatio > 10 {
		return fmt.Sprintf("批量写入性能优势显著（%.2fx），建议将单条写入改为批量写入，推荐批量大小 50-100", wp.PerformanceRatio)
	} else if wp.PerformanceRatio > 3 {
		return fmt.Sprintf("批量写入有一定优势（%.2fx），可考虑在高并发场景使用批量写入", wp.PerformanceRatio)
	}
	return "单条写入与批量写入性能差异不大，可根据业务需求选择"
}

func joinStrings(strs []string) string {
	if len(strs) == 0 {
		return ""
	}
	return joinStringsWithSeparator(strs, "; ")
}

func joinStringsWithSeparator(strs []string, sep string) string {
	if len(strs) == 0 {
		return ""
	}
	result := strs[0]
	for i := 1; i < len(strs); i++ {
		result += sep + strs[i]
	}
	return result
}
