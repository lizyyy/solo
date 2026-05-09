package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"sync/atomic"
	"time"
)

type LoadTestConfig struct {
	BaseURL        string
	Concurrency    int
	Duration       time.Duration
	RequestsPerSec int
}

type TestResult struct {
	TotalRequests   int64
	SuccessRequests int64
	FailedRequests  int64
	TotalDuration   time.Duration
	MinLatency      time.Duration
	MaxLatency      time.Duration
	AvgLatency      time.Duration
	Latencies       []time.Duration
}

var (
	result TestResult
	mu     sync.Mutex
)

func main() {
	config := LoadTestConfig{
		BaseURL:        "http://localhost:8080",
		Concurrency:    50,
		Duration:       30 * time.Second,
		RequestsPerSec: 1000,
	}

	fmt.Println("========================================")
	fmt.Println("MQ Dead Letter Review Load Test")
	fmt.Println("========================================")
	fmt.Printf("Base URL: %s\n", config.BaseURL)
	fmt.Printf("Concurrency: %d\n", config.Concurrency)
	fmt.Printf("Duration: %s\n", config.Duration)
	fmt.Printf("Target QPS: %d\n", config.RequestsPerSec)
	fmt.Println("========================================")

	result = TestResult{
		Latencies:  make([]time.Duration, 0),
		MinLatency: time.Hour,
	}

	var wg sync.WaitGroup
	stopChan := make(chan struct{})

	ticker := time.NewTicker(time.Second / time.Duration(config.RequestsPerSec/config.Concurrency))
	defer ticker.Stop()

	startTime := time.Now()
	timeout := time.After(config.Duration)

	for i := 0; i < config.Concurrency; i++ {
		wg.Add(1)
		go func(workerID int) {
			defer wg.Done()
			for {
				select {
				case <-stopChan:
					return
				case <-ticker.C:
					runTest(config.BaseURL)
				}
			}
		}(i)
	}

	<-timeout
	close(stopChan)
	wg.Wait()

	result.TotalDuration = time.Since(startTime)

	printResults()
}

func runTest(baseURL string) {
	tests := []func(string) error{
		testHealthCheck,
		testGetStatistics,
		testListTrackings,
		testListDeadLetters,
	}

	for _, test := range tests {
		start := time.Now()
		err := test(baseURL)
		latency := time.Since(start)

		mu.Lock()
		atomic.AddInt64(&result.TotalRequests, 1)
		if err != nil {
			atomic.AddInt64(&result.FailedRequests, 1)
			fmt.Printf("Error: %v\n", err)
		} else {
			atomic.AddInt64(&result.SuccessRequests, 1)
		}

		if latency < result.MinLatency {
			result.MinLatency = latency
		}
		if latency > result.MaxLatency {
			result.MaxLatency = latency
		}
		result.Latencies = append(result.Latencies, latency)
		mu.Unlock()
	}
}

func testHealthCheck(baseURL string) error {
	resp, err := http.Get(baseURL + "/api/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func testGetStatistics(baseURL string) error {
	resp, err := http.Get(baseURL + "/api/statistics")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func testListTrackings(baseURL string) error {
	resp, err := http.Get(baseURL + "/api/trackings?status=PROCESSED&page=1&page_size=20")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func testListDeadLetters(baseURL string) error {
	resp, err := http.Get(baseURL + "/api/dead-letters?page=1&page_size=20")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}

func printResults() {
	fmt.Println("\n========================================")
	fmt.Println("Load Test Results")
	fmt.Println("========================================")
	fmt.Printf("Total Requests: %d\n", result.TotalRequests)
	fmt.Printf("Success: %d\n", result.SuccessRequests)
	fmt.Printf("Failed: %d\n", result.FailedRequests)
	
	if result.TotalRequests > 0 {
		successRate := float64(result.SuccessRequests) / float64(result.TotalRequests) * 100
		fmt.Printf("Success Rate: %.2f%%\n", successRate)
	}

	fmt.Printf("Total Duration: %s\n", result.TotalDuration)
	
	if result.TotalDuration > 0 {
		qps := float64(result.TotalRequests) / result.TotalDuration.Seconds()
		fmt.Printf("Actual QPS: %.2f\n", qps)
	}

	fmt.Printf("Min Latency: %s\n", result.MinLatency)
	fmt.Printf("Max Latency: %s\n", result.MaxLatency)

	if len(result.Latencies) > 0 {
		var total time.Duration
		for _, l := range result.Latencies {
			total += l
		}
		avg := total / time.Duration(len(result.Latencies))
		fmt.Printf("Avg Latency: %s\n", avg)

		p50 := percentile(result.Latencies, 50)
		p95 := percentile(result.Latencies, 95)
		p99 := percentile(result.Latencies, 99)
		fmt.Printf("P50 Latency: %s\n", p50)
		fmt.Printf("P95 Latency: %s\n", p95)
		fmt.Printf("P99 Latency: %s\n", p99)
	}

	fmt.Println("========================================")
}

func percentile(latencies []time.Duration, p int) time.Duration {
	if len(latencies) == 0 {
		return 0
	}

	sorted := make([]time.Duration, len(latencies))
	copy(sorted, latencies)

	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j] < sorted[i] {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}

	index := int(float64(len(sorted)-1) * float64(p) / 100.0)
	return sorted[index]
}

func createTracking(baseURL string, messageID string) error {
	payload := map[string]interface{}{
		"message_id":     messageID,
		"topic":          "order_topic",
		"tag":            "create",
		"keys":           messageID,
		"producer_group": "order_producer",
		"consumer_group": "order_consumer",
		"body":           `{"order_id": "12345", "user_id": "67890"}`,
	}

	body, _ := json.Marshal(payload)
	resp, err := http.Post(baseURL+"/api/trackings", "application/json", bytes.NewReader(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("unexpected status code: %d", resp.StatusCode)
	}
	return nil
}
