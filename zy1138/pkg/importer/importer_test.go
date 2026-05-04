package importer

import (
	"os"
	"testing"
	"time"

	"queue-analyzer/pkg/models"
)

func createTempFile(t *testing.T, content string) string {
	file, err := os.CreateTemp("", "test-*.jsonl")
	if err != nil {
		t.Fatalf("Failed to create temp file: %v", err)
	}
	defer file.Close()

	if _, err := file.WriteString(content); err != nil {
		t.Fatalf("Failed to write temp file: %v", err)
	}

	return file.Name()
}

func cleanupTempFile(t *testing.T, path string) {
	if err := os.Remove(path); err != nil {
		t.Logf("Warning: Failed to cleanup temp file %s: %v", path, err)
	}
}

func TestImportJobsBasic(t *testing.T) {
	content := `{"id": "job-001", "type": "email_send", "priority": 2, "status": "completed", "enqueue_time": "2025-06-01T10:00:00Z", "start_time": "2025-06-01T10:00:02Z", "end_time": "2025-06-01T10:00:05Z", "execution_time_ms": 3000, "wait_time_ms": 2000, "retry_count": 0, "max_retries": 3, "timeout_ms": 30000, "queue_name": "default"}
{"id": "job-002", "type": "image_process", "priority": 1, "status": "failed", "enqueue_time": "2025-06-01T10:00:01Z", "retry_count": 3, "max_retries": 3, "timeout_ms": 60000, "fail_reason": "SMTP error", "queue_name": "default"}
`

	path := createTempFile(t, content)
	defer cleanupTempFile(t, path)

	imp := NewImporter()
	jobs, err := imp.ImportJobs(path)
	if err != nil {
		t.Fatalf("ImportJobs failed: %v", err)
	}

	if len(jobs) != 2 {
		t.Errorf("Expected 2 jobs, got %d", len(jobs))
	}

	if jobs[0].ID != "job-001" {
		t.Errorf("Expected job ID job-001, got %s", jobs[0].ID)
	}

	if jobs[0].Type != "email_send" {
		t.Errorf("Expected job type email_send, got %s", jobs[0].Type)
	}

	if jobs[0].Priority != 2 {
		t.Errorf("Expected priority 2, got %d", jobs[0].Priority)
	}

	if jobs[1].Status != models.JobStatusFailed {
		t.Errorf("Expected status failed, got %s", jobs[1].Status)
	}

	if jobs[1].FailReason != "SMTP error" {
		t.Errorf("Expected fail reason SMTP error, got %s", jobs[1].FailReason)
	}
}

func TestImportJobsEmpty(t *testing.T) {
	content := ``

	path := createTempFile(t, content)
	defer cleanupTempFile(t, path)

	imp := NewImporter()
	jobs, err := imp.ImportJobs(path)
	if err != nil {
		t.Fatalf("ImportJobs failed for empty file: %v", err)
	}

	if len(jobs) != 0 {
		t.Errorf("Expected 0 jobs for empty file, got %d", len(jobs))
	}
}

func TestImportJobsInvalidJSON(t *testing.T) {
	content := `{"id": "job-001", "type": "email_send", priority: 2}
invalid json line
`

	path := createTempFile(t, content)
	defer cleanupTempFile(t, path)

	imp := NewImporter()
	_, err := imp.ImportJobs(path)
	if err == nil {
		t.Error("Expected error for invalid JSON, got nil")
	}
}

func TestImportWorkersCSV(t *testing.T) {
	content := `id,name,queue_types,concurrency,batch_size,poll_interval_ms,status
worker-001,email-worker-01,email_send,1,1,1000,active
worker-002,image-worker-01,image_process,1,1,2000,active
`

	path := createTempFile(t, content)
	defer cleanupTempFile(t, path)

	imp := NewImporter()
	workers, err := imp.ImportWorkers(path)
	if err != nil {
		t.Fatalf("ImportWorkers failed: %v", err)
	}

	if len(workers) != 2 {
		t.Errorf("Expected 2 workers, got %d", len(workers))
	}

	if workers[0].ID != "worker-001" {
		t.Errorf("Expected worker ID worker-001, got %s", workers[0].ID)
	}

	if workers[0].Name != "email-worker-01" {
		t.Errorf("Expected worker name email-worker-01, got %s", workers[0].Name)
	}

	if workers[0].Concurrency != 1 {
		t.Errorf("Expected concurrency 1, got %d", workers[0].Concurrency)
	}
}

func TestParseTime(t *testing.T) {
	testCases := []struct {
		name     string
		input    string
		hasError bool
	}{
		{
			name:     "valid RFC3339",
			input:    "2025-06-01T10:00:00Z",
			hasError: false,
		},
		{
			name:     "empty string",
			input:    "",
			hasError: true,
		},
		{
			name:     "invalid format",
			input:    "2025/06/01 10:00:00",
			hasError: false,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result, err := parseTime(tc.input)

			if tc.hasError {
				if err == nil {
					t.Error("Expected error, got nil")
				}
			} else {
				if err != nil && tc.input != "" {
					t.Errorf("Unexpected error: %v", err)
				}
				if tc.input == "2025-06-01T10:00:00Z" {
					expected := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
					if !result.Equal(expected) {
						t.Errorf("Expected %v, got %v", expected, result)
					}
				}
			}
		})
	}
}

func TestImportConfigBasic(t *testing.T) {
	content := `
queues:
  - name: "default"
    worker_concurrency: 10
    batch_size: 1
    poll_interval: "1s"
    default_timeout: "30s"
    max_retries: 3

worker_pools:
  - name: "default-pool"
    worker_count: 10
    queue_names: ["default"]
    concurrency_per_worker: 1
    batch_size: 1
    poll_interval: "1s"

default_retry_policy:
  strategy: "exponential"
  initial_delay: "1s"
  max_delay: "5m"
  multiplier: 2.0
  jitter: 0.1

analysis:
  wait_time_percentiles: [50, 95, 99]
  execution_time_percentiles: [50, 95, 99]
  retry_storm_window: "10s"
  retry_storm_threshold: 5
`

	path := createTempFile(t, content)
	defer cleanupTempFile(t, path)

	imp := NewImporter()
	config, err := imp.ImportConfig(path)
	if err != nil {
		t.Fatalf("ImportConfig failed: %v", err)
	}

	if len(config.Queues) != 1 {
		t.Errorf("Expected 1 queue, got %d", len(config.Queues))
	}

	if config.Queues[0].Name != "default" {
		t.Errorf("Expected queue name default, got %s", config.Queues[0].Name)
	}

	if config.Queues[0].WorkerConcurrency != 10 {
		t.Errorf("Expected worker_concurrency 10, got %d", config.Queues[0].WorkerConcurrency)
	}

	if config.DefaultRetryPolicy == nil {
		t.Error("Expected default_retry_policy to be set")
	} else {
		if config.DefaultRetryPolicy.Strategy != "exponential" {
			t.Errorf("Expected retry strategy exponential, got %s", config.DefaultRetryPolicy.Strategy)
		}

		if config.DefaultRetryPolicy.Multiplier != 2.0 {
			t.Errorf("Expected multiplier 2.0, got %.1f", config.DefaultRetryPolicy.Multiplier)
		}
	}
}

func TestImportAllPartial(t *testing.T) {
	jobsContent := `{"id": "job-001", "type": "email_send", "priority": 2, "status": "completed", "enqueue_time": "2025-06-01T10:00:00Z", "retry_count": 0, "max_retries": 3, "timeout_ms": 30000, "queue_name": "default"}
`
	jobsPath := createTempFile(t, jobsContent)
	defer cleanupTempFile(t, jobsPath)

	workersContent := `id,name,queue_types,concurrency,batch_size,poll_interval_ms,status
worker-001,email-worker-01,email_send,1,1,1000,active
`
	workersPath := createTempFile(t, workersContent)
	defer cleanupTempFile(t, workersPath)

	imp := NewImporter()
	data, err := imp.ImportAll(jobsPath, workersPath, "", "")
	if err != nil {
		t.Fatalf("ImportAll failed: %v", err)
	}

	if len(data.Jobs) != 1 {
		t.Errorf("Expected 1 job, got %d", len(data.Jobs))
	}

	if len(data.Workers) != 1 {
		t.Errorf("Expected 1 worker, got %d", len(data.Workers))
	}

	if len(data.Events) != 0 {
		t.Errorf("Expected 0 events, got %d", len(data.Events))
	}
}
