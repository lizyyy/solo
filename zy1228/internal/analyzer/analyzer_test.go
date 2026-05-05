package analyzer

import (
	"testing"

	"concurrency-inspector/internal/models"
)

func TestAnalyzer_Analyze_GoodConfig(t *testing.T) {
	goodConfig := &models.DesignConfig{
		Name:        "test-good",
		Version:     "1.0.0",
		Concurrency: models.ConcurrencySpec{
			Patterns:   []string{"worker-pool"},
			MaxWorkers: 10,
		},
		Queues: []models.QueueSpec{
			{Name: "task-queue", Type: "channel", Capacity: 100, Priority: false},
			{Name: "result-queue", Type: "channel", Capacity: 100, Priority: false},
			{Name: "error-queue", Type: "channel", Capacity: 50, Priority: false},
		},
		Goroutines: []models.GoroutineSpec{
			{Name: "dispatcher", Type: "dispatcher", OutputQueues: []string{"task-queue"}, Workers: 1},
			{Name: "worker", Type: "worker", InputQueues: []string{"task-queue"}, OutputQueues: []string{"result-queue", "error-queue"}, Workers: 8},
			{Name: "result-collector", Type: "collector", InputQueues: []string{"result-queue"}, Workers: 2},
			{Name: "error-handler", Type: "handler", InputQueues: []string{"error-queue"}, Workers: 1},
		},
		Timeout: models.TimeoutSpec{
			Default:         "30s",
			Startup:         "10s",
			Shutdown:        "15s",
			Operation:       "30s",
			CancelPropagate: true,
		},
		Error: models.ErrorSpec{
			Strategy:     "continue-on-error",
			MaxRetries:   3,
			RetryBackoff: "1s",
			ErrorQueue:   "error-queue",
			PanicHandler: true,
		},
		Shutdown: models.ShutdownSpec{
			Graceful:    true,
			Order:       []string{"dispatcher", "worker", "result-collector", "error-handler"},
			WaitTimeout: "10s",
			ForceKill:   true,
		},
	}

	analyzer := NewAnalyzer(goodConfig, []models.Event{}, []models.CodeSnippet{})
	result, err := analyzer.Analyze()

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if result.OverallScore < 70 {
		t.Errorf("Expected good score for good config, got: %d", result.OverallScore)
	}

	if len(result.GoroutineTopology.Cycles) > 0 {
		t.Errorf("Expected no cycles in good config, got: %v", result.GoroutineTopology.Cycles)
	}
}

func TestAnalyzer_Analyze_BadConfig(t *testing.T) {
	badConfig := &models.DesignConfig{
		Name:        "test-bad",
		Version:     "1.0.0",
		Concurrency: models.ConcurrencySpec{
			Patterns:   []string{"worker-pool"},
			MaxWorkers: 100,
		},
		Queues: []models.QueueSpec{
			{Name: "task-queue", Type: "channel", Capacity: 0, Priority: false},
			{Name: "result-queue", Type: "channel", Capacity: 0, Priority: false},
		},
		Goroutines: []models.GoroutineSpec{
			{Name: "dispatcher", Type: "dispatcher", OutputQueues: []string{"task-queue"}, Workers: 10},
			{Name: "worker", Type: "worker", InputQueues: []string{"task-queue"}, OutputQueues: []string{"result-queue"}, Workers: 100},
		},
		Timeout: models.TimeoutSpec{
			Default:         "",
			CancelPropagate: false,
		},
		Error: models.ErrorSpec{
			Strategy:     "fail-fast",
			PanicHandler: false,
		},
		Shutdown: models.ShutdownSpec{
			Graceful:    false,
			Order:       []string{},
			WaitTimeout: "",
			ForceKill:   false,
		},
	}

	analyzer := NewAnalyzer(badConfig, []models.Event{}, []models.CodeSnippet{})
	result, err := analyzer.Analyze()

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	var hasUnboundedQueue bool
	var hasNoCancelPropagate bool
	var hasNoGracefulShutdown bool
	var hasNoPanicHandler bool

	for _, issue := range result.Issues {
		if issue.Category == "queue" && issue.Severity == "critical" {
			hasUnboundedQueue = true
		}
		if issue.Category == "timeout" {
			hasNoCancelPropagate = true
		}
		if issue.Category == "shutdown" && issue.Severity == "critical" {
			hasNoGracefulShutdown = true
		}
		if issue.Category == "error" {
			hasNoPanicHandler = true
		}
	}

	if !hasUnboundedQueue {
		t.Error("Expected to detect unbounded queue issue")
	}
	if !hasNoCancelPropagate {
		t.Error("Expected to detect no cancel propagate issue")
	}
	if !hasNoGracefulShutdown {
		t.Error("Expected to detect no graceful shutdown issue")
	}
	if !hasNoPanicHandler {
		t.Error("Expected to detect no panic handler issue")
	}
}

func TestAnalyzer_DetectCycles(t *testing.T) {
	config := &models.DesignConfig{
		Name:    "test-cycle",
		Version: "1.0.0",
		Concurrency: models.ConcurrencySpec{
			Patterns: []string{"pipeline"},
		},
		Queues: []models.QueueSpec{
			{Name: "queue-a", Type: "channel", Capacity: 10, Priority: false},
			{Name: "queue-b", Type: "channel", Capacity: 10, Priority: false},
			{Name: "queue-c", Type: "channel", Capacity: 10, Priority: false},
		},
		Goroutines: []models.GoroutineSpec{
			{Name: "goroutine-a", Type: "worker", InputQueues: []string{"queue-c"}, OutputQueues: []string{"queue-a"}, Workers: 1},
			{Name: "goroutine-b", Type: "worker", InputQueues: []string{"queue-a"}, OutputQueues: []string{"queue-b"}, Workers: 1},
			{Name: "goroutine-c", Type: "worker", InputQueues: []string{"queue-b"}, OutputQueues: []string{"queue-c"}, Workers: 1},
		},
		Timeout: models.TimeoutSpec{
			Default:         "30s",
			CancelPropagate: true,
		},
		Error: models.ErrorSpec{
			Strategy:     "fail-fast",
			PanicHandler: true,
		},
		Shutdown: models.ShutdownSpec{
			Graceful:    true,
			WaitTimeout: "10s",
		},
	}

	analyzer := NewAnalyzer(config, []models.Event{}, []models.CodeSnippet{})
	result, err := analyzer.Analyze()

	if err != nil {
		t.Fatalf("Expected no error, got: %v", err)
	}

	if len(result.GoroutineTopology.Cycles) == 0 {
		t.Error("Expected to detect cycles in cyclic topology")
	}
}

func TestAnalyzer_CalculateScore(t *testing.T) {
	tests := []struct {
		name           string
		issues         []models.Issue
		expectedMinScore int
		expectedMaxScore int
	}{
		{
			name:           "no issues",
			issues:         []models.Issue{},
			expectedMinScore: 100,
			expectedMaxScore: 100,
		},
		{
			name: "one critical issue",
			issues: []models.Issue{
				{Severity: "critical", Category: "test", Description: "test"},
			},
			expectedMinScore: 70,
			expectedMaxScore: 80,
		},
		{
			name: "multiple issues",
			issues: []models.Issue{
				{Severity: "critical", Category: "test", Description: "test1"},
				{Severity: "high", Category: "test", Description: "test2"},
				{Severity: "warning", Category: "test", Description: "test3"},
			},
			expectedMinScore: 50,
			expectedMaxScore: 70,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			config := &models.DesignConfig{
				Name:    "test-score",
				Version: "1.0.0",
				Concurrency: models.ConcurrencySpec{
					Patterns: []string{"worker-pool"},
				},
				Queues: []models.QueueSpec{
					{Name: "queue", Type: "channel", Capacity: 100, Priority: false},
				},
				Goroutines: []models.GoroutineSpec{
					{Name: "worker", Type: "worker", InputQueues: []string{"queue"}, Workers: 1},
				},
				Timeout: models.TimeoutSpec{
					Default:         "30s",
					CancelPropagate: true,
				},
				Error: models.ErrorSpec{
					Strategy:     "fail-fast",
					PanicHandler: true,
				},
				Shutdown: models.ShutdownSpec{
					Graceful:    true,
					WaitTimeout: "10s",
				},
			}

			analyzer := NewAnalyzer(config, []models.Event{}, []models.CodeSnippet{})
			result, err := analyzer.Analyze()
			if err != nil {
				t.Fatalf("Expected no error, got: %v", err)
			}

			if result.OverallScore < tt.expectedMinScore || result.OverallScore > tt.expectedMaxScore {
				t.Errorf("Expected score between %d and %d, got: %d", 
					tt.expectedMinScore, tt.expectedMaxScore, result.OverallScore)
			}
		})
	}
}

func TestAnalyzer_CodeSnippetAnalysis(t *testing.T) {
	goodSnippet := models.CodeSnippet{
		Filename: "good.go",
		Content: `package main

import (
	"context"
	"fmt"
	"sync"
)

func GoodExample(ctx context.Context, wg *sync.WaitGroup) {
	defer wg.Done()
	defer func() {
		if r := recover(); r != nil {
			fmt.Println("Recovered:", r)
		}
	}()

	for {
		select {
		case <-ctx.Done():
			return
		default:
		}
	}
}
`,
	}

	badSnippet := models.CodeSnippet{
		Filename: "bad.go",
		Content: `package main

import (
	"fmt"
)

func BadExample() {
	go func() {
		for {
			fmt.Println("looping")
		}
	}()

	for {
		select {}
	}
}
`,
	}

	config := &models.DesignConfig{
		Name:    "test-snippet",
		Version: "1.0.0",
		Concurrency: models.ConcurrencySpec{
			Patterns: []string{"worker-pool"},
		},
		Queues: []models.QueueSpec{
			{Name: "queue", Type: "channel", Capacity: 100, Priority: false},
		},
		Goroutines: []models.GoroutineSpec{
			{Name: "worker", Type: "worker", InputQueues: []string{"queue"}, Workers: 1},
		},
		Timeout: models.TimeoutSpec{
			Default:         "30s",
			CancelPropagate: true,
		},
		Error: models.ErrorSpec{
			Strategy:     "fail-fast",
			PanicHandler: true,
		},
		Shutdown: models.ShutdownSpec{
			Graceful:    true,
			WaitTimeout: "10s",
		},
	}

	analyzerGood := NewAnalyzer(config, []models.Event{}, []models.CodeSnippet{goodSnippet})
	resultGood, err := analyzerGood.Analyze()
	if err != nil {
		t.Fatalf("Expected no error for good snippet, got: %v", err)
	}

	analyzerBad := NewAnalyzer(config, []models.Event{}, []models.CodeSnippet{badSnippet})
	resultBad, err := analyzerBad.Analyze()
	if err != nil {
		t.Fatalf("Expected no error for bad snippet, got: %v", err)
	}

	var hasGoroutineLeak bool
	var hasInfiniteLoop bool
	var hasNoRecovery bool

	for _, issue := range resultBad.Issues {
		if issue.Location == "bad.go" {
			if issue.Category == "goroutine_leak" || issue.Category == "panic" {
				hasNoRecovery = true
			}
			if issue.Category == "infinite_loop" {
				hasInfiniteLoop = true
			}
			if issue.Severity == "critical" && issue.Category == "code" {
				hasGoroutineLeak = true
			}
		}
	}

	if !hasNoRecovery {
		t.Error("Expected to detect no panic recovery in bad snippet")
	}

	_ = resultGood
}
