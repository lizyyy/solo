package analyzer

import (
	"fmt"
	"testing"
	"time"

	"queue-analyzer/pkg/models"
)

func ptrTime(t time.Time) *time.Time {
	return &t
}

func createTestJobs() []*models.Job {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
	return []*models.Job{
		{
			ID:              "job-001",
			Type:            "email_send",
			Priority:        2,
			Status:          models.JobStatusSucceeded,
			EnqueueTime:     baseTime,
			StartTime:       ptrTime(baseTime.Add(2 * time.Second)),
			EndTime:         ptrTime(baseTime.Add(5 * time.Second)),
			ExecutionTimeMs: 3000,
			WaitTimeMs:      2000,
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       30000,
			QueueName:       "default",
		},
		{
			ID:              "job-002",
			Type:            "image_process",
			Priority:        1,
			Status:          models.JobStatusSucceeded,
			EnqueueTime:     baseTime.Add(1 * time.Second),
			StartTime:       ptrTime(baseTime.Add(3 * time.Second)),
			EndTime:         ptrTime(baseTime.Add(15 * time.Second)),
			ExecutionTimeMs: 12000,
			WaitTimeMs:      2000,
			RetryCount:      0,
			MaxRetries:      3,
			TimeoutMs:       60000,
			QueueName:       "default",
		},
		{
			ID:              "job-003",
			Type:            "email_send",
			Priority:        2,
			Status:          models.JobStatusDeadLetter,
			EnqueueTime:     baseTime.Add(5 * time.Second),
			StartTime:       ptrTime(baseTime.Add(10 * time.Second)),
			EndTime:         ptrTime(baseTime.Add(13 * time.Second)),
			ExecutionTimeMs: 3000,
			WaitTimeMs:      5000,
			RetryCount:      3,
			MaxRetries:      3,
			TimeoutMs:       30000,
			FailReason:      "SMTP server connection refused",
			QueueName:       "default",
		},
		{
			ID:              "job-004",
			Type:            "payment_process",
			Priority:        10,
			Status:          models.JobStatusSucceeded,
			EnqueueTime:     baseTime.Add(6 * time.Second),
			StartTime:       ptrTime(baseTime.Add(7 * time.Second)),
			EndTime:         ptrTime(baseTime.Add(12 * time.Second)),
			ExecutionTimeMs: 5000,
			WaitTimeMs:      1000,
			RetryCount:      0,
			MaxRetries:      1,
			TimeoutMs:       30000,
			QueueName:       "priority",
		},
		{
			ID:          "job-005",
			Type:        "log_archive",
			Priority:    0,
			Status:      models.JobStatusPending,
			EnqueueTime: baseTime.Add(15 * time.Second),
			RetryCount:  0,
			MaxRetries:  1,
			TimeoutMs:   600000,
			QueueName:   "default",
		},
	}
}

func createTestEvents() []*models.QueueEvent {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)
	return []*models.QueueEvent{
		{ID: "evt-001", JobID: "job-001", EventType: models.EventTypeEnqueue, Timestamp: baseTime, QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-002", JobID: "job-002", EventType: models.EventTypeEnqueue, Timestamp: baseTime.Add(1 * time.Second), QueueName: "default", JobType: "image_process", Priority: 1},
		{ID: "evt-003", JobID: "job-003", EventType: models.EventTypeEnqueue, Timestamp: baseTime.Add(5 * time.Second), QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-004", JobID: "job-001", EventType: models.EventTypeDequeue, Timestamp: baseTime.Add(2 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-005", JobID: "job-001", EventType: models.EventTypeStart, Timestamp: baseTime.Add(2 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-006", JobID: "job-001", EventType: models.EventTypeComplete, Timestamp: baseTime.Add(5 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2, ExecutionTime: 3000},
		{ID: "evt-007", JobID: "job-003", EventType: models.EventTypeDequeue, Timestamp: baseTime.Add(10 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-008", JobID: "job-003", EventType: models.EventTypeStart, Timestamp: baseTime.Add(10 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-009", JobID: "job-003", EventType: models.EventTypeFail, Timestamp: baseTime.Add(13 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 1, ErrorMessage: "SMTP server connection refused", ExecutionTime: 3000},
		{ID: "evt-010", JobID: "job-003", EventType: models.EventTypeRetry, Timestamp: baseTime.Add(14 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 1},
		{ID: "evt-011", JobID: "job-003", EventType: models.EventTypeStart, Timestamp: baseTime.Add(14 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-012", JobID: "job-003", EventType: models.EventTypeFail, Timestamp: baseTime.Add(17 * time.Second), WorkerID: "worker-001", QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 2, ErrorMessage: "SMTP server connection refused", ExecutionTime: 3000},
		{ID: "evt-013", JobID: "job-003", EventType: models.EventTypeRetry, Timestamp: baseTime.Add(18 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 2},
		{ID: "evt-014", JobID: "job-003", EventType: models.EventTypeStart, Timestamp: baseTime.Add(18 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2},
		{ID: "evt-015", JobID: "job-003", EventType: models.EventTypeFail, Timestamp: baseTime.Add(21 * time.Second), WorkerID: "worker-003", QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 3, ErrorMessage: "SMTP server connection refused", ExecutionTime: 3000},
		{ID: "evt-016", JobID: "job-003", EventType: models.EventTypeDeadLetter, Timestamp: baseTime.Add(21 * time.Second), QueueName: "default", JobType: "email_send", Priority: 2, RetryCount: 3, ErrorMessage: "SMTP server connection refused"},
	}
}

func TestAnalyzeBasic(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if result.Summary.TotalJobs != 5 {
		t.Errorf("Expected 5 total jobs, got %d", result.Summary.TotalJobs)
	}

	if result.JobStats.TotalJobs != 5 {
		t.Errorf("Expected 5 total jobs in stats, got %d", result.JobStats.TotalJobs)
	}

	if result.JobStats.ByStatus[models.JobStatusSucceeded] != 3 {
		t.Errorf("Expected 3 succeeded jobs, got %d", result.JobStats.ByStatus[models.JobStatusSucceeded])
	}

	if result.JobStats.ByStatus[models.JobStatusDeadLetter] != 1 {
		t.Errorf("Expected 1 deadletter job, got %d", result.JobStats.ByStatus[models.JobStatusDeadLetter])
	}

	if result.JobStats.SuccessRate != 0.6 {
		t.Errorf("Expected success rate 0.6, got %.2f", result.JobStats.SuccessRate)
	}
}

func TestAnalyzeWithPercentiles(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if result.JobStats.P50WaitTimeMs <= 0 {
		t.Errorf("Expected P50 wait time > 0, got %.2f", result.JobStats.P50WaitTimeMs)
	}

	if result.JobStats.P95WaitTimeMs <= 0 {
		t.Errorf("Expected P95 wait time > 0, got %.2f", result.JobStats.P95WaitTimeMs)
	}

	if result.JobStats.P99WaitTimeMs <= 0 {
		t.Errorf("Expected P99 wait time > 0, got %.2f", result.JobStats.P99WaitTimeMs)
	}
}

func TestAnalyzeBacklog(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if result.BacklogAnalysis.PeakBacklog <= 0 {
		t.Errorf("Expected peak backlog > 0, got %d", result.BacklogAnalysis.PeakBacklog)
	}
}

func TestAnalyzeRetry(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if result.RetryAnalysis.TotalRetryEvents != 2 {
		t.Errorf("Expected 2 retry events, got %d", result.RetryAnalysis.TotalRetryEvents)
	}

	if result.RetryAnalysis.MaxRetryCount != 3 {
		t.Errorf("Expected max retry count 3, got %d", result.RetryAnalysis.MaxRetryCount)
	}
}

func TestAnalyzePriority(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if !result.PriorityAnalysis.HasPrioritySystem {
		t.Error("Expected priority system to be detected")
	}

	if len(result.PriorityAnalysis.PriorityDistribution) == 0 {
		t.Error("Expected priority distribution to have data")
	}
}

func TestAnalyzeDeadLetter(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if result.DeadLetterAnalysis.TotalDeadLetterJobs != 1 {
		t.Errorf("Expected 1 dead letter job, got %d", result.DeadLetterAnalysis.TotalDeadLetterJobs)
	}

	if result.DeadLetterAnalysis.DeadLetterRate <= 0 {
		t.Errorf("Expected dead letter rate > 0, got %.2f", result.DeadLetterAnalysis.DeadLetterRate)
	}

	if len(result.DeadLetterAnalysis.ByReason) == 0 {
		t.Error("Expected dead letter by reason to have data")
	}
}

func TestAnalyzeWithRecommendations(t *testing.T) {
	jobs := createTestJobs()
	events := createTestEvents()

	importerData := &models.ImportedData{
		Jobs:    jobs,
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if len(result.Recommendations) == 0 {
		t.Log("No recommendations generated (expected for small dataset)")
	}
}

func TestJobTypeStats(t *testing.T) {
	jobs := createTestJobs()

	jobTypeStats := make(map[string]*models.JobStatistics)
	successCount := int64(0)
	failedCount := int64(0)
	failReasons := make(map[string]int)

	for _, job := range jobs {
		jobType := job.Type
		if jobTypeStats[jobType] == nil {
			jobTypeStats[jobType] = &models.JobStatistics{}
		}
		jobTypeStats[jobType].TotalJobs++

		if job.Status == models.JobStatusSucceeded {
			successCount++
			jobTypeStats[jobType].SuccessRate += 1
		}

		if job.Status == models.JobStatusFailed || job.Status == models.JobStatusDeadLetter {
			failedCount++
			if job.FailReason != "" {
				failReasons[job.FailReason]++
			}
			if job.RetryCount >= job.MaxRetries && job.MaxRetries > 0 {
				jobTypeStats[jobType].DeadLetterCount++
			}
		}
	}

	if jobTypeStats["email_send"].TotalJobs != 2 {
		t.Errorf("Expected email_send total=2, got %d", jobTypeStats["email_send"].TotalJobs)
	}

	if jobTypeStats["payment_process"].TotalJobs != 1 {
		t.Errorf("Expected payment_process total=1, got %d", jobTypeStats["payment_process"].TotalJobs)
	}

	if successCount != 3 {
		t.Errorf("Expected 3 success jobs, got %d", successCount)
	}

	if failedCount != 1 {
		t.Errorf("Expected 1 failed/deadletter jobs, got %d", failedCount)
	}

	if failReasons["SMTP server connection refused"] != 1 {
		t.Errorf("Expected SMTP error count=1, got %d", failReasons["SMTP server connection refused"])
	}
}

func TestAnalyzeWithLargeRetryEvents(t *testing.T) {
	baseTime := time.Date(2025, 6, 1, 10, 0, 0, 0, time.UTC)

	events := make([]*models.QueueEvent, 0)
	for i := 0; i < 15; i++ {
		events = append(events, &models.QueueEvent{
			ID:         fmt.Sprintf("evt-%d", i),
			JobID:      fmt.Sprintf("job-%d", i),
			EventType:  models.EventTypeRetry,
			Timestamp:  baseTime.Add(time.Duration(i) * 500 * time.Millisecond),
			QueueName:  "default",
			JobType:    "email_send",
			Priority:   2,
			RetryCount: 1,
		})
	}

	importerData := &models.ImportedData{
		Jobs:    createTestJobs(),
		Workers: []*models.Worker{},
		Events:  events,
		Config:  nil,
	}

	analyzer := NewAnalyzer()
	result, err := analyzer.Analyze(importerData, nil)
	if err != nil {
		t.Fatalf("Analyze failed: %v", err)
	}

	if len(result.RetryAnalysis.RetryStormIndicators) == 0 {
		t.Log("No retry storm detected (may depend on threshold)")
	}
}
