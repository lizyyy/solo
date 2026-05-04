package analyzer

import (
	"testing"
	"time"

	"concurrency-detector/internal/models"
)

func TestConcurrentMapRule(t *testing.T) {
	rule := &ConcurrentMapRule{}

	t.Run("should detect concurrent map access without locks", func(t *testing.T) {
		baseTime := time.Now()
		events := []*models.MapEvent{
			{
				MapName:     "user_cache",
				Key:         "user_123",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: 1,
				HasLock:     false,
				Timestamp:   baseTime,
			},
			{
				MapName:     "user_cache",
				Key:         "user_123",
				Operation:   models.MapOperationTypeRead,
				GoroutineID: 2,
				HasLock:     false,
				Timestamp:   baseTime.Add(10 * time.Millisecond),
			},
			{
				MapName:     "user_cache",
				Key:         "user_123",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: 3,
				HasLock:     false,
				Timestamp:   baseTime.Add(20 * time.Millisecond),
			},
		}

		ctx := &AnalysisContext{
			MapEvents: events,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect concurrent map access risk, but got nil")
		}

		if result != nil && result.Confidence == 0 {
			t.Error("expected confidence to be set")
		}
	})

	t.Run("should not detect risk when using locks", func(t *testing.T) {
		baseTime := time.Now()
		events := []*models.MapEvent{
			{
				MapName:     "safe_cache",
				Key:         "item_1",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: 1,
				HasLock:     true,
				LockType:    "RWMutex",
				Timestamp:   baseTime,
			},
			{
				MapName:     "safe_cache",
				Key:         "item_1",
				Operation:   models.MapOperationTypeRead,
				GoroutineID: 2,
				HasLock:     true,
				LockType:    "RWMutex",
				Timestamp:   baseTime.Add(10 * time.Millisecond),
			},
		}

		ctx := &AnalysisContext{
			MapEvents: events,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != nil {
			t.Error("expected no risk when using proper locking, but got result")
		}
	})

	t.Run("should not detect risk with insufficient data", func(t *testing.T) {
		ctx := &AnalysisContext{
			MapEvents: []*models.MapEvent{
				{
					MapName:     "test",
					Key:         "key",
					Operation:   models.MapOperationTypeRead,
					GoroutineID: 1,
					HasLock:     false,
					Timestamp:   time.Now(),
				},
			},
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != nil {
			t.Error("expected no result with single event")
		}
	})
}

func TestHotKeyWriteRule(t *testing.T) {
	rule := &HotKeyWriteRule{}

	t.Run("should detect hot key", func(t *testing.T) {
		baseTime := time.Now()
		var events []*models.MapEvent

		for i := 0; i < 90; i++ {
			events = append(events, &models.MapEvent{
				MapName:     "counter_map",
				Key:         "hot_key",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: int64(i % 10),
				HasLock:     true,
				Timestamp:   baseTime.Add(time.Duration(i) * time.Millisecond),
			})
		}

		for i := 0; i < 10; i++ {
			events = append(events, &models.MapEvent{
				MapName:     "counter_map",
				Key:         "cold_key",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: int64(i),
				HasLock:     true,
				Timestamp:   baseTime.Add(time.Duration(i+90) * time.Millisecond),
			})
		}

		ctx := &AnalysisContext{
			MapEvents: events,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect hot key risk")
		}
	})

	t.Run("should not detect with few writes", func(t *testing.T) {
		baseTime := time.Now()
		var events []*models.MapEvent

		for i := 0; i < 5; i++ {
			events = append(events, &models.MapEvent{
				MapName:     "test",
				Key:         "key",
				Operation:   models.MapOperationTypeWrite,
				GoroutineID: 1,
				HasLock:     true,
				Timestamp:   baseTime.Add(time.Duration(i) * time.Millisecond),
			})
		}

		ctx := &AnalysisContext{
			MapEvents: events,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != nil {
			t.Error("expected no result with few writes")
		}
	})
}

func TestWorkerBacklogRule(t *testing.T) {
	rule := &WorkerBacklogRule{}

	t.Run("should detect worker backlog", func(t *testing.T) {
		workers := []*models.WorkerQueue{
			{
				QueueName:      "overflow_queue",
				WorkerCount:    2,
				QueueCapacity:  100,
				QueueLength:    90,
				PendingTasks:   150,
				FailedTasks:    0,
				CompletedTasks: 100,
				Timestamp:      time.Now(),
			},
		}

		ctx := &AnalysisContext{
			WorkerQueues: workers,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect worker backlog risk")
		}
	})

	t.Run("should detect high failed tasks", func(t *testing.T) {
		workers := []*models.WorkerQueue{
			{
				QueueName:      "error_queue",
				WorkerCount:    4,
				QueueCapacity:  100,
				QueueLength:    10,
				PendingTasks:   5,
				FailedTasks:    25,
				CompletedTasks: 100,
				Timestamp:      time.Now(),
			},
		}

		ctx := &AnalysisContext{
			WorkerQueues: workers,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect high failed tasks risk")
		}
	})

	t.Run("should not detect healthy workers", func(t *testing.T) {
		workers := []*models.WorkerQueue{
			{
				QueueName:      "healthy_queue",
				WorkerCount:    8,
				QueueCapacity:  1000,
				QueueLength:    50,
				PendingTasks:   30,
				FailedTasks:    2,
				CompletedTasks: 1000,
				Timestamp:      time.Now(),
			},
		}

		ctx := &AnalysisContext{
			WorkerQueues: workers,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result != nil {
			t.Error("expected no risk for healthy workers")
		}
	})
}

func TestGoroutineLeakRule(t *testing.T) {
	rule := &GoroutineLeakRule{}

	t.Run("should detect blocked goroutine", func(t *testing.T) {
		snapshots := []*models.GoroutineSnapshot{
			{
				SnapshotID:  "snap_1",
				GoroutineID: 100,
				State:       "blocked",
				Stack:       "goroutine 100 [chan send]:\nmain.(*Worker).process",
				Timestamp:   time.Now(),
			},
		}

		ctx := &AnalysisContext{
			GoroutineSnapshots: snapshots,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect blocked goroutine risk")
		}
	})

	t.Run("should detect time.Sleep without context", func(t *testing.T) {
		snapshots := []*models.GoroutineSnapshot{
			{
				SnapshotID:  "snap_1",
				GoroutineID: 101,
				State:       "waiting",
				Stack:       "goroutine 101 [waiting]:\ntime.Sleep\nmain.loopForever",
				Timestamp:   time.Now(),
			},
		}

		ctx := &AnalysisContext{
			GoroutineSnapshots: snapshots,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect time.Sleep risk")
		}
	})
}

func TestChannelBlockedRule(t *testing.T) {
	rule := &ChannelBlockedRule{}

	t.Run("should detect channel send block", func(t *testing.T) {
		snapshots := []*models.GoroutineSnapshot{
			{
				SnapshotID:  "snap_1",
				GoroutineID: 100,
				State:       "blocked",
				Stack:       "goroutine 100 [chan send]:\nmain.(*Publisher).publish",
				Timestamp:   time.Now(),
			},
		}

		ctx := &AnalysisContext{
			GoroutineSnapshots: snapshots,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect channel send block")
		}
	})

	t.Run("should detect channel receive block", func(t *testing.T) {
		snapshots := []*models.GoroutineSnapshot{
			{
				SnapshotID:  "snap_1",
				GoroutineID: 101,
				State:       "blocked",
				Stack:       "goroutine 101 [chan receive]:\nmain.(*Queue).consume",
				Timestamp:   time.Now(),
			},
		}

		ctx := &AnalysisContext{
			GoroutineSnapshots: snapshots,
		}

		result, err := rule.Check(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if result == nil {
			t.Error("expected to detect channel receive block")
		}
	})
}

func TestAnalyzerAnalyze(t *testing.T) {
	analyzer := NewAnalyzer()

	t.Run("should run all rules concurrently", func(t *testing.T) {
		baseTime := time.Now()
		ctx := &AnalysisContext{
			MapEvents: []*models.MapEvent{
				{
					MapName:     "test",
					Key:         "key",
					Operation:   models.MapOperationTypeWrite,
					GoroutineID: 1,
					HasLock:     false,
					Timestamp:   baseTime,
				},
				{
					MapName:     "test",
					Key:         "key",
					Operation:   models.MapOperationTypeRead,
					GoroutineID: 2,
					HasLock:     false,
					Timestamp:   baseTime.Add(10 * time.Millisecond),
				},
			},
			GoroutineSnapshots: []*models.GoroutineSnapshot{},
			WorkerQueues:       []*models.WorkerQueue{},
		}

		results, err := analyzer.Analyze(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(results) == 0 {
			t.Error("expected at least one analysis result")
		}
	})

	t.Run("should sort by severity", func(t *testing.T) {
		baseTime := time.Now()
		ctx := &AnalysisContext{
			MapEvents: []*models.MapEvent{
				{
					MapName:     "cache",
					Key:         "user_123",
					Operation:   models.MapOperationTypeWrite,
					GoroutineID: 1,
					HasLock:     false,
					Timestamp:   baseTime,
				},
				{
					MapName:     "cache",
					Key:         "user_123",
					Operation:   models.MapOperationTypeRead,
					GoroutineID: 2,
					HasLock:     false,
					Timestamp:   baseTime.Add(10 * time.Millisecond),
				},
			},
			GoroutineSnapshots: []*models.GoroutineSnapshot{},
			WorkerQueues:       []*models.WorkerQueue{},
		}

		results, err := analyzer.Analyze(ctx)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}

		if len(results) > 1 {
			severityOrder := map[models.RiskSeverity]int{
				models.RiskSeverityCritical: 0,
				models.RiskSeverityHigh:     1,
				models.RiskSeverityMedium:   2,
				models.RiskSeverityLow:      3,
			}

			for i := 1; i < len(results); i++ {
				if severityOrder[results[i-1].Severity] > severityOrder[results[i].Severity] {
					t.Error("results should be sorted by severity")
				}
			}
		}
	})
}
