package analyzer

import (
	"testing"
	"time"

	"gcinsight/models"
)

func TestAnalyzer_Analyze(t *testing.T) {
	traces := createTestGCTraces()
	samples := createTestHeapSamples()
	events := createTestAllocEvents()

	a := NewAnalyzer()
	result := a.Analyze(traces, samples, events)

	if result == nil {
		t.Fatal("expected non-nil result")
	}

	if result.PauseDistribution.TotalPauses != len(traces) {
		t.Errorf("expected %d total pauses, got %d", len(traces), result.PauseDistribution.TotalPauses)
	}

	if result.RawMetrics.TotalGCs != len(traces) {
		t.Errorf("expected %d total GCs, got %d", len(traces), result.RawMetrics.TotalGCs)
	}
}

func TestAnalyzer_PauseDistribution(t *testing.T) {
	traces := createTestGCTraces()

	a := NewAnalyzer()
	result := a.Analyze(traces, nil, nil)

	if result.PauseDistribution.MeanPause <= 0 {
		t.Error("expected positive mean pause")
	}

	if result.PauseDistribution.MaxPause <= 0 {
		t.Error("expected positive max pause")
	}

	if result.PauseDistribution.MinPause > result.PauseDistribution.MaxPause {
		t.Error("min pause should not be greater than max pause")
	}
}

func TestAnalyzer_HeapGoalDeviation(t *testing.T) {
	traces := createTestGCTraces()

	a := NewAnalyzer()
	result := a.Analyze(traces, nil, nil)

	if result.HeapGoalDeviation.TotalGCs != len(traces) {
		t.Errorf("expected %d total GCs, got %d", len(traces), result.HeapGoalDeviation.TotalGCs)
	}

	if result.HeapGoalDeviation.GoalAchieved+result.HeapGoalDeviation.GoalMissed != len(traces) {
		t.Errorf("sum of achieved and missed should equal total GCs")
	}
}

func TestAnalyzer_AssistPressure(t *testing.T) {
	traces := createTestGCTraces()

	a := NewAnalyzer()
	result := a.Analyze(traces, nil, nil)

	if result.AssistPressure.TotalAssists > 0 {
		if result.AssistPressure.TotalAssistedBytes == 0 {
			t.Error("assisted bytes should be positive when assists exist")
		}
	}
}

func TestAnalyzer_MemoryPeaks(t *testing.T) {
	traces := createTestGCTraces()
	samples := createTestHeapSamples()

	a := NewAnalyzer()
	result := a.Analyze(traces, samples, nil)

	if result.MemoryPeaks.PeakHeapAlloc == 0 {
		t.Error("expected non-zero peak heap alloc")
	}

	if result.MemoryPeaks.PeakHeapInUse == 0 {
		t.Error("expected non-zero peak heap in use")
	}
}

func TestAnalyzer_Recommendations(t *testing.T) {
	traces := createTestGCTraces()

	a := NewAnalyzer()
	result := a.Analyze(traces, nil, nil)

	for _, rec := range result.Recommendations {
		if rec.Title == "" {
			t.Error("recommendation title should not be empty")
		}
		if rec.Description == "" {
			t.Error("recommendation description should not be empty")
		}
		if rec.Action == "" {
			t.Error("recommendation action should not be empty")
		}
	}
}

func TestAnalyzer_RawMetrics(t *testing.T) {
	traces := createTestGCTraces()

	a := NewAnalyzer()
	result := a.Analyze(traces, nil, nil)

	if result.RawMetrics.TotalGCs != len(traces) {
		t.Errorf("expected %d total GCs, got %d", len(traces), result.RawMetrics.TotalGCs)
	}

	if result.RawMetrics.TotalPauseTime <= 0 {
		t.Error("expected positive total pause time")
	}

	if result.RawMetrics.GOGC == 0 {
		t.Error("GOGC should be set")
	}
}

func TestAnalyzer_Compare(t *testing.T) {
	tracesA := createTestGCTraces()
	tracesB := createTestGCTraces()

	a := NewAnalyzer()
	resultA := a.Analyze(tracesA, nil, nil)
	resultB := a.Analyze(tracesB, nil, nil)

	resultA.SessionID = 1
	resultB.SessionID = 2

	comparison := a.Compare(resultA, resultB)

	if comparison.SessionAID != 1 {
		t.Errorf("expected session A ID 1, got %d", comparison.SessionAID)
	}

	if comparison.SessionBID != 2 {
		t.Errorf("expected session B ID 2, got %d", comparison.SessionBID)
	}
}

func createTestGCTraces() []models.GCTraceEntry {
	baseTime := time.Now()
	return []models.GCTraceEntry{
		{
			Timestamp:     baseTime.Add(1 * time.Second),
			GCNumber:      1,
			Phase:         "mark",
			PauseDuration: 500 * time.Microsecond,
			HeapInUse:     100 * 1024 * 1024,
			HeapGoal:      150 * 1024 * 1024,
			HeapMarked:    80 * 1024 * 1024,
			AssistedBytes: 0,
			AssistedG:     0,
			CPUFraction:   0.05,
			GOGC:          100,
			GOMEMLIMIT:    0,
		},
		{
			Timestamp:     baseTime.Add(2 * time.Second),
			GCNumber:      2,
			Phase:         "mark",
			PauseDuration: 800 * time.Microsecond,
			HeapInUse:     180 * 1024 * 1024,
			HeapGoal:      200 * 1024 * 1024,
			HeapMarked:    150 * 1024 * 1024,
			AssistedBytes: 50 * 1024 * 1024,
			AssistedG:     10,
			CPUFraction:   0.08,
			GOGC:          100,
			GOMEMLIMIT:    0,
		},
		{
			Timestamp:     baseTime.Add(3 * time.Second),
			GCNumber:      3,
			Phase:         "mark",
			PauseDuration: 15 * time.Millisecond,
			HeapInUse:     300 * 1024 * 1024,
			HeapGoal:      250 * 1024 * 1024,
			HeapMarked:    200 * 1024 * 1024,
			AssistedBytes: 200 * 1024 * 1024,
			AssistedG:     25,
			CPUFraction:   0.15,
			GOGC:          100,
			GOMEMLIMIT:    0,
		},
	}
}

func createTestHeapSamples() []models.HeapSample {
	baseTime := time.Now()
	return []models.HeapSample{
		{
			Timestamp:     baseTime.Add(1 * time.Second),
			HeapAlloc:     100 * 1024 * 1024,
			HeapSys:       150 * 1024 * 1024,
			HeapInUse:     80 * 1024 * 1024,
			HeapIdle:      70 * 1024 * 1024,
			HeapObjects:   10000,
			Mallocs:       50000,
			Frees:         40000,
			NextGC:        150 * 1024 * 1024,
			NumGC:         1,
			GCCPUFraction: 0.05,
		},
		{
			Timestamp:     baseTime.Add(2 * time.Second),
			HeapAlloc:     200 * 1024 * 1024,
			HeapSys:       280 * 1024 * 1024,
			HeapInUse:     180 * 1024 * 1024,
			HeapIdle:      100 * 1024 * 1024,
			HeapObjects:   20000,
			Mallocs:       100000,
			Frees:         80000,
			NextGC:        250 * 1024 * 1024,
			NumGC:         2,
			GCCPUFraction: 0.08,
		},
	}
}

func createTestAllocEvents() []models.AllocEvent {
	baseTime := time.Now()
	return []models.AllocEvent{
		{
			Timestamp: baseTime.Add(100 * time.Millisecond),
			Type:      "alloc",
			Size:      8192,
			Goroutine: 1,
		},
		{
			Timestamp: baseTime.Add(200 * time.Millisecond),
			Type:      "alloc",
			Size:      32768,
			Goroutine: 5,
		},
		{
			Timestamp: baseTime.Add(500 * time.Millisecond),
			Type:      "free",
			Size:      8192,
			Goroutine: 1,
		},
	}
}
