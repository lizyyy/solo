package models

import (
	"time"
)

type GCTraceEntry struct {
	Timestamp      time.Time
	GCNumber       int
	Phase          string
	StartTimestamp float64
	PauseDuration  time.Duration
	HeapInUse      uint64
	HeapGoal       uint64
	HeapMarked     uint64
	StackMarked    uint64
	AssistedBytes  uint64
	AssistedG      int
	CPUFraction    float64
	GOGC           int
	GOMEMLIMIT     uint64
}

type HeapSample struct {
	Timestamp     time.Time
	HeapAlloc     uint64
	HeapSys       uint64
	HeapInUse     uint64
	HeapIdle      uint64
	HeapReleased  uint64
	HeapObjects   uint64
	Mallocs       uint64
	Frees         uint64
	NextGC        uint64
	LastGC        uint64
	NumGC         uint32
	NumForcedGC   uint32
	GCCPUFraction float64
}

type AllocEvent struct {
	Timestamp time.Time
	Type      string
	Size      uint64
	Address   uint64
	Stack     string
	Goroutine int64
}

type AnalysisSession struct {
	ID          int64
	Name        string
	Description string
	CreatedAt   time.Time
	GCTracePath string
	HeapSamplePath string
	AllocEventPath string
}

type AnalysisResult struct {
	ID               int64
	SessionID        int64
	CreatedAt        time.Time
	PauseDistribution PauseDistribution
	HeapGoalDeviation HeapGoalDeviation
	AssistPressure   AssistPressure
	MemoryPeaks      MemoryPeaks
	Recommendations  []Recommendation
	RawMetrics       RawMetrics
}

type PauseDistribution struct {
	TotalPauses    int
	MeanPause      time.Duration
	MedianPause    time.Duration
	P95Pause       time.Duration
	P99Pause       time.Duration
	MaxPause       time.Duration
	MinPause       time.Duration
	STWPauses      []PauseInfo
	ConcurrentPauses []PauseInfo
}

type PauseInfo struct {
	Timestamp   time.Time
	Duration    time.Duration
	Type        string
	GCPhase     string
	GCNumber    int
}

type HeapGoalDeviation struct {
	TotalGCs        int
	MeanDeviation   float64
	MaxDeviation    float64
	MinDeviation    float64
	GoalAchieved    int
	GoalMissed      int
	GoalDetails     []GoalDetail
}

type GoalDetail struct {
	GCNumber    int
	Timestamp   time.Time
	HeapGoal    uint64
	ActualHeap  uint64
	Deviation   float64
	Achieved    bool
}

type AssistPressure struct {
	TotalAssists      int
	TotalAssistedBytes uint64
	MeanAssistBytes   uint64
	MaxAssistBytes    uint64
	AssistPerGC       []AssistPerGC
	HighPressureGCs   []int
}

type AssistPerGC struct {
	GCNumber    int
	AssistedG   int
	AssistedBytes uint64
	PressureLevel string
}

type MemoryPeaks struct {
	PeakHeapAlloc   uint64
	PeakHeapInUse   uint64
	PeakHeapSys     uint64
	PeakObjects     uint64
	PeakTimestamp   time.Time
}

type Recommendation struct {
	Category    string
	Severity    string
	Title       string
	Description string
	Action      string
}

type RawMetrics struct {
	TotalGCs          int
	TotalPauseTime    time.Duration
	MeanGCCPUFraction float64
	GOGC              int
	GOMEMLIMIT        uint64
	StartTime         time.Time
	EndTime           time.Time
	TotalDuration     time.Duration
}

type ComparisonResult struct {
	SessionAID   int64
	SessionBID   int64
	CreatedAt    time.Time
	Differences  []Difference
	OverallTrend string
	KeyInsights   []KeyInsight
}

type Difference struct {
	Metric        string
	ValueA        interface{}
	ValueB        interface{}
	ChangePercent float64
	Significance  string
}

type KeyInsight struct {
	Title       string
	Description string
	Impact      string
}
