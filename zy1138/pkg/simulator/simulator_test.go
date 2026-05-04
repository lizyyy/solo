package simulator

import (
	"fmt"
	"testing"
	"time"

	"queue-analyzer/pkg/models"
)

func ptrTime(t time.Time) *time.Time {
	return &t
}

func createSimulationJobs() []*models.Job {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
	return []*models.Job{
		{
			ID:              "job-001",
			Type:            "quick_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime,
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 2000,
		},
		{
			ID:              "job-002",
			Type:            "quick_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(1 * time.Second),
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 2000,
		},
		{
			ID:              "job-003",
			Type:            "quick_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(2 * time.Second),
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 2000,
		},
		{
			ID:              "job-004",
			Type:            "slow_task",
			Priority:        1,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(3 * time.Second),
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       60000,
			QueueName:       "default",
			ExecutionTimeMs: 10000,
		},
		{
			ID:              "job-005",
			Type:            "high_priority_task",
			Priority:        10,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(5 * time.Second),
			RetryCount:      0,
			MaxRetries:      1,
			TimeoutMs:       30000,
			QueueName:       "priority",
			ExecutionTimeMs: 3000,
		},
	}
}

func createBasicSimConfig() *models.SimulationConfig {
	return &models.SimulationConfig{
		Name:        "test-config",
		Description: "Test simulation config",
		WorkerPools: []models.WorkerPoolConfig{
			{
				Name:                "default-pool",
				WorkerCount:         2,
				QueueNames:          []string{"default"},
				ConcurrencyPerWorker: 1,
				BatchSize:           1,
				PollInterval:        1 * time.Second,
			},
			{
				Name:                "priority-pool",
				WorkerCount:         1,
				QueueNames:          []string{"priority"},
				ConcurrencyPerWorker: 1,
				BatchSize:           1,
				PollInterval:        500 * time.Millisecond,
			},
		},
		DefaultRetryPolicy: &models.RetryPolicy{
			Strategy:     "exponential",
			InitialDelay: 1 * time.Second,
			MaxDelay:     5 * time.Minute,
			Multiplier:   2.0,
			Jitter:       0.1,
		},
		Queues: []models.QueueConfig{
			{
				Name:               "default",
				WorkerConcurrency: 2,
				BatchSize:          1,
				PollInterval:       1 * time.Second,
				DefaultTimeout:     30 * time.Second,
				MaxRetries:         3,
			},
			{
				Name:               "priority",
				WorkerConcurrency: 1,
				BatchSize:          1,
				PollInterval:       500 * time.Millisecond,
				DefaultTimeout:     30 * time.Second,
				MaxRetries:         1,
			},
		},
	}
}

func TestSimulateBasic(t *testing.T) {
	jobs := createSimulationJobs()
	config := createBasicSimConfig()

	sim := NewSimulator()
	result, err := sim.Simulate(jobs, config)
	if err != nil {
		t.Fatalf("Simulate failed: %v", err)
	}

	if result.Summary.TotalJobs != 5 {
		t.Errorf("Expected 5 total jobs, got %d", result.Summary.TotalJobs)
	}

	if result.Summary.ProcessedJobs != 5 {
		t.Errorf("Expected 5 processed jobs, got %d", result.Summary.ProcessedJobs)
	}

	if result.Summary.SuccessRate != 1.0 {
		t.Errorf("Expected 100%% success rate, got %.2f", result.Summary.SuccessRate)
	}

	if len(result.Issues) != 0 {
		t.Errorf("Expected 0 issues, got %d", len(result.Issues))
	}
}

func TestSimulateWithFailure(t *testing.T) {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	jobs := []*models.Job{
		{
			ID:              "job-fail-001",
			Type:            "failing_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime,
			RetryCount:      0,
			MaxRetries:      2,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 2000,
			FailReason:      "simulated failure",
		},
	}

	config := &models.SimulationConfig{
		Name:        "failure-test-config",
		Description: "Test failure handling",
		WorkerPools: []models.WorkerPoolConfig{
			{
				Name:                "default-pool",
				WorkerCount:         1,
				QueueNames:          []string{"default"},
				ConcurrencyPerWorker: 1,
				BatchSize:           1,
				PollInterval:        500 * time.Millisecond,
			},
		},
		DefaultRetryPolicy: &models.RetryPolicy{
			Strategy:     "fixed",
			InitialDelay: 1 * time.Second,
			MaxDelay:     10 * time.Second,
			Multiplier:   1.0,
			Jitter:       0.0,
		},
		Queues: []models.QueueConfig{
			{
				Name:               "default",
				WorkerConcurrency: 1,
				BatchSize:          1,
				PollInterval:       500 * time.Millisecond,
				DefaultTimeout:     30 * time.Second,
				MaxRetries:         2,
			},
		},
	}

	sim := NewSimulator()
	result, err := sim.Simulate(jobs, config)
	if err != nil {
		t.Fatalf("Simulate failed: %v", err)
	}

	if result.Summary.SuccessRate != 0.0 {
		t.Errorf("Expected 0%% success rate for failing task, got %.2f", result.Summary.SuccessRate)
	}

	if result.Summary.DeadLetterJobs != 1 {
		t.Errorf("Expected 1 dead letter job, got %d", result.Summary.DeadLetterJobs)
	}

	if result.Summary.TotalRetries < 2 {
		t.Errorf("Expected at least 2 retries, got %d", result.Summary.TotalRetries)
	}
}

func TestConfigScore(t *testing.T) {
	baseResult := &models.SimulationResult{
		ConfigName: "base",
		Summary: models.SimulationSummary{
			TotalJobs:         100,
			ProcessedJobs:     100,
			SuccessRate:       0.95,
			ThroughputPerSecond: 10.0,
			AvgWaitTimeMs:     1000,
			P95WaitTimeMs:     2000,
			P99WaitTimeMs:     5000,
			PeakBacklog:       50,
			MaxBacklog:        50,
			TotalRetries:      10,
			DeadLetterJobs:    2,
			WorkerUtilization: 0.8,
		},
	}

	betterResult := &models.SimulationResult{
		ConfigName: "better",
		Summary: models.SimulationSummary{
			TotalJobs:         100,
			ProcessedJobs:     100,
			SuccessRate:       0.99,
			ThroughputPerSecond: 15.0,
			AvgWaitTimeMs:     500,
			P95WaitTimeMs:     1000,
			P99WaitTimeMs:     2000,
			PeakBacklog:       20,
			MaxBacklog:        20,
			TotalRetries:      3,
			DeadLetterJobs:    0,
			WorkerUtilization: 0.9,
		},
	}

	sim := NewSimulator()
	compareResult, err := sim.Compare(baseResult, []*models.SimulationResult{betterResult})
	if err != nil {
		t.Fatalf("Compare failed: %v", err)
	}

	if compareResult.Summary.BestConfigName != "better" {
		t.Errorf("Expected best config to be 'better', got '%s'", compareResult.Summary.BestConfigName)
	}

	if compareResult.Summary.WorstConfigName != "base" {
		t.Errorf("Expected worst config to be 'base', got '%s'", compareResult.Summary.WorstConfigName)
	}
}

func TestPriorityQueue(t *testing.T) {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	jobs := []*models.Job{
		{
			ID:              "job-low-1",
			Type:            "low_priority",
			Priority:        0,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime,
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 1000,
		},
		{
			ID:              "job-low-2",
			Type:            "low_priority",
			Priority:        0,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(100 * time.Millisecond),
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 1000,
		},
		{
			ID:              "job-high-1",
			Type:            "high_priority",
			Priority:        10,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(200 * time.Millisecond),
			RetryCount:      0,
			MaxRetries:      1,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 1000,
		},
	}

	config := &models.SimulationConfig{
		Name:        "priority-test",
		Description: "Test priority scheduling",
		WorkerPools: []models.WorkerPoolConfig{
			{
				Name:                "default-pool",
				WorkerCount:         1,
				QueueNames:          []string{"default"},
				ConcurrencyPerWorker: 1,
				BatchSize:           1,
				PollInterval:        100 * time.Millisecond,
			},
		},
		DefaultRetryPolicy: &models.RetryPolicy{
			Strategy:     "fixed",
			InitialDelay: 1 * time.Second,
			MaxDelay:     5 * time.Second,
			Multiplier:   1.0,
			Jitter:       0.0,
		},
		Queues: []models.QueueConfig{
			{
				Name:               "default",
				WorkerConcurrency: 1,
				BatchSize:          1,
				PollInterval:       100 * time.Millisecond,
				DefaultTimeout:     30 * time.Second,
				MaxRetries:         3,
			},
		},
	}

	sim := NewSimulator()
	result, err := sim.Simulate(jobs, config)
	if err != nil {
		t.Fatalf("Simulate failed: %v", err)
	}

	if result.Summary.SuccessRate != 1.0 {
		t.Errorf("Expected 100%% success rate, got %.2f", result.Summary.SuccessRate)
	}
}

func TestDifferentRetryStrategies(t *testing.T) {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	jobs := []*models.Job{
		{
			ID:              "job-001",
			Type:            "test_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime,
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 1000,
		},
	}

	strategies := []string{"fixed", "exponential", "linear"}

	for _, strategy := range strategies {
		t.Run(strategy, func(t *testing.T) {
			config := &models.SimulationConfig{
				Name:        "retry-strategy-test-" + strategy,
				Description: "Test " + strategy + " retry strategy",
				WorkerPools: []models.WorkerPoolConfig{
					{
						Name:                "default-pool",
						WorkerCount:         2,
						QueueNames:          []string{"default"},
						ConcurrencyPerWorker: 1,
						BatchSize:           1,
						PollInterval:        100 * time.Millisecond,
					},
				},
				DefaultRetryPolicy: &models.RetryPolicy{
					Strategy:     strategy,
					InitialDelay: 1 * time.Second,
					MaxDelay:     30 * time.Second,
					Multiplier:   2.0,
					Jitter:       0.0,
				},
				Queues: []models.QueueConfig{
					{
						Name:               "default",
						WorkerConcurrency: 2,
						BatchSize:          1,
						PollInterval:       100 * time.Millisecond,
						DefaultTimeout:     30 * time.Second,
						MaxRetries:         3,
					},
				},
			}

			sim := NewSimulator()
			result, err := sim.Simulate(jobs, config)
			if err != nil {
				t.Fatalf("Simulate with strategy %s failed: %v", strategy, err)
			}

			if result.Summary.TotalJobs != 1 {
				t.Errorf("Expected 1 total job, got %d", result.Summary.TotalJobs)
			}
		})
	}
}

func TestBatchSizeConfig(t *testing.T) {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	jobs := make([]*models.Job, 10)
	for i := 0; i < 10; i++ {
		jobs[i] = &models.Job{
			ID:              fmt.Sprintf("job-%03d", i),
			Type:            "batch_task",
			Priority:        2,
			Status:          models.JobStatusPending,
			EnqueueTime:     baseTime.Add(time.Duration(i) * 100 * time.Millisecond),
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
			ExecutionTimeMs: 500,
		}
	}

	config := &models.SimulationConfig{
		Name:        "batch-size-test",
		Description: "Test batch size configuration",
		WorkerPools: []models.WorkerPoolConfig{
			{
				Name:                "default-pool",
				WorkerCount:         2,
				QueueNames:          []string{"default"},
				ConcurrencyPerWorker: 2,
				BatchSize:           3,
				PollInterval:        500 * time.Millisecond,
			},
		},
		DefaultRetryPolicy: &models.RetryPolicy{
			Strategy:     "fixed",
			InitialDelay: 1 * time.Second,
			MaxDelay:     5 * time.Second,
			Multiplier:   1.0,
			Jitter:       0.0,
		},
		Queues: []models.QueueConfig{
			{
				Name:               "default",
				WorkerConcurrency: 4,
				BatchSize:          3,
				PollInterval:       500 * time.Millisecond,
				DefaultTimeout:     30 * time.Second,
				MaxRetries:         3,
			},
		},
	}

	sim := NewSimulator()
	result, err := sim.Simulate(jobs, config)
	if err != nil {
		t.Fatalf("Simulate failed: %v", err)
	}

	if result.Summary.TotalJobs != 10 {
		t.Errorf("Expected 10 total jobs, got %d", result.Summary.TotalJobs)
	}

	if result.Summary.ProcessedJobs != 10 {
		t.Errorf("Expected 10 processed jobs, got %d", result.Summary.ProcessedJobs)
	}

	if result.Summary.SuccessRate != 1.0 {
		t.Errorf("Expected 100%% success rate, got %.2f", result.Summary.SuccessRate)
	}
}
