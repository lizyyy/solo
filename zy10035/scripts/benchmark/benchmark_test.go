package main

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"mq-deadletter-review/internal/config"
	"mq-deadletter-review/internal/domain/model"
	"mq-deadletter-review/internal/domain/service"
	"mq-deadletter-review/internal/infrastructure/cache"
	"mq-deadletter-review/pkg/utils"
)

type BenchmarkResult struct {
	Name          string
	Iterations    int
	TotalDuration time.Duration
	OpsPerSec     float64
	MinLatency    time.Duration
	MaxLatency    time.Duration
	AvgLatency    time.Duration
}

func main() {
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	if err != nil {
		panic(err)
	}

	db.AutoMigrate(
		&model.MessageTracking{},
		&model.DeadLetterMessage{},
		&model.MessageEventLog{},
		&model.ReplayRequest{},
		&model.ReplayTask{},
	)

	cacheMgr := cache.NewCacheManager(nil, nil)

	cfg := &config.TrackingConfig{
		MaxRetryTimes:       3,
		EnableDetailedLog:   true,
		RetryInterval:       1 * time.Second,
		PowerfulConsistency: true,
	}

	trackingSvc := service.NewTrackingService(
		&DBWrapper{db: db},
		cacheMgr,
		nil,
		cfg,
		nil,
	)

	benchmarks := []struct {
		name  string
		count int
		fn    func() error
	}{
		{"CreateTracking_Single", 1000, func() error {
			_, err := trackingSvc.CreateTracking(context.Background(), &service.CreateTrackingRequest{
				MessageID:     utils.GenerateID(),
				Topic:         "order_topic",
				Tag:           "create",
				Keys:          "order_123",
				ProducerGroup: "order_producer",
				ConsumerGroup: "order_consumer",
				Body:          `{"order_id": "12345", "user_id": "67890", "amount": 100.00}`,
			})
			return err
		}},
	}

	for _, bm := range benchmarks {
		result := runBenchmark(bm.name, bm.count, bm.fn)
		printResult(result)
	}

	concurrentBenchmarks := []struct {
		name        string
		concurrency int
		iterations  int
	}{
		{"Concurrent_Create_10", 10, 100},
		{"Concurrent_Create_50", 50, 50},
		{"Concurrent_Create_100", 100, 20},
	}

	for _, bm := range concurrentBenchmarks {
		result := runConcurrentBenchmark(
			bm.name,
			bm.concurrency,
			bm.iterations,
			trackingSvc,
		)
		printResult(result)
	}
}

func runBenchmark(name string, count int, fn func() error) BenchmarkResult {
	fmt.Printf("\nRunning benchmark: %s (%d iterations)...\n", name, count)

	latencies := make([]time.Duration, 0, count)
	var errors int64

	start := time.Now()
	for i := 0; i < count; i++ {
		iterStart := time.Now()
		if err := fn(); err != nil {
			atomic.AddInt64(&errors, 1)
		}
		latencies = append(latencies, time.Since(iterStart))
	}

	total := time.Since(start)

	var min, max, sum time.Duration
	if len(latencies) > 0 {
		min = latencies[0]
		max = latencies[0]
		for _, l := range latencies {
			if l < min {
				min = l
			}
			if l > max {
				max = l
			}
			sum += l
		}
	}

	return BenchmarkResult{
		Name:          name,
		Iterations:    count,
		TotalDuration: total,
		OpsPerSec:     float64(count) / total.Seconds(),
		MinLatency:    min,
		MaxLatency:    max,
		AvgLatency:    sum / time.Duration(len(latencies)),
	}
}

func runConcurrentBenchmark(
	name string,
	concurrency int,
	iterationsPerWorker int,
	trackingSvc *service.TrackingService,
) BenchmarkResult {
	fmt.Printf("\nRunning concurrent benchmark: %s (concurrency=%d, total=%d)...\n",
		name, concurrency, concurrency*iterationsPerWorker)

	var wg sync.WaitGroup
	latencies := make(chan time.Duration, concurrency*iterationsPerWorker)

	start := time.Now()

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for j := 0; j < iterationsPerWorker; j++ {
				iterStart := time.Now()
				_, err := trackingSvc.CreateTracking(context.Background(), &service.CreateTrackingRequest{
					MessageID:     fmt.Sprintf("msg-%d-%d-%d", workerID, j, time.Now().UnixNano()),
					Topic:         "order_topic",
					Tag:           "create",
					Keys:          fmt.Sprintf("key-%d-%d", workerID, j),
					ProducerGroup: "order_producer",
					ConsumerGroup: "order_consumer",
					Body:          `{"test": "data"}`,
				})
				if err != nil {
					fmt.Printf("Error: %v\n", err)
				}
				latencies <- time.Since(iterStart)
			}
		}(i)
	}

	wg.Wait()
	close(latencies)

	total := time.Since(start)

	var min, max, sum time.Duration
	count := 0
	first := true
	for l := range latencies {
		if first {
			min = l
			max = l
			first = false
		}
		if l < min {
			min = l
		}
		if l > max {
			max = l
		}
		sum += l
		count++
	}

	return BenchmarkResult{
		Name:          name,
		Iterations:    count,
		TotalDuration: total,
		OpsPerSec:     float64(count) / total.Seconds(),
		MinLatency:    min,
		MaxLatency:    max,
		AvgLatency:    sum / time.Duration(count),
	}
}

func printResult(r BenchmarkResult) {
	fmt.Println("========================================")
	fmt.Printf("Benchmark: %s\n", r.Name)
	fmt.Println("========================================")
	fmt.Printf("Iterations: %d\n", r.Iterations)
	fmt.Printf("Total Duration: %s\n", r.TotalDuration)
	fmt.Printf("Throughput: %.2f ops/sec\n", r.OpsPerSec)
	fmt.Printf("Latency Min: %s\n", r.MinLatency)
	fmt.Printf("Latency Max: %s\n", r.MaxLatency)
	fmt.Printf("Latency Avg: %s\n", r.AvgLatency)
	fmt.Println("========================================")
}

type DBWrapper struct {
	db *gorm.DB
}

func (w *DBWrapper) GetDB() *gorm.DB {
	return w.db
}

func (w *DBWrapper) Close() error {
	return nil
}

func (w *DBWrapper) Transaction(fn func(tx *gorm.DB) error) error {
	return w.db.Transaction(fn)
}

func (w *DBWrapper) AutoMigrate(models ...interface{}) error {
	return w.db.AutoMigrate(models...)
}
