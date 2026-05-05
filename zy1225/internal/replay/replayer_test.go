package replay

import (
	"os"
	"testing"

	"github.com/zy1225/chanalyzer/internal/analyzer"
	"github.com/zy1225/chanalyzer/internal/models"
	"github.com/zy1225/chanalyzer/internal/storage"
)

func TestReplayUnbufferedDeadlock(t *testing.T) {
	testCase := &models.ChannelCase{
		ID:          "test-unbuffered-deadlock",
		Name:        "Test Unbuffered Deadlock",
		Description: "Test case for unbuffered channel deadlock",
		Category:    "deadlock",
		Difficulty:  "beginner",
		Channels: []models.ChannelDef{
			{
				ID:          "ch1",
				Name:        "main channel",
				BufferSize: 0,
				IsNil:      false,
			},
		},
		Goroutines: []models.GoroutineDef{
			{
				ID:   "g1",
				Name: "main",
				Role: "sender",
			},
		},
		Steps: []models.StepDef{
			{
				Step:      1,
				Action:    "send",
				Goroutine: "g1",
				Channel:   "ch1",
				Value:     42,
				Comment:   "Main tries to send on unbuffered channel",
			},
		},
	}

	dbPath := "test_unbuffered_deadlock.db"
	defer os.Remove(dbPath)

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	replayer := NewReplayer(store)
	if err := replayer.LoadCase(testCase); err != nil {
		t.Fatalf("Failed to load case: %v", err)
	}

	timeline := replayer.GetTimeline()

	if len(timeline.Events) == 0 {
		t.Error("Expected events to be generated")
	}

	if len(timeline.Channels) != 1 {
		t.Errorf("Expected 1 channel, got %d", len(timeline.Channels))
	}

	if len(timeline.Goroutines) != 1 {
		t.Errorf("Expected 1 goroutine, got %d", len(timeline.Goroutines))
	}

	ch := timeline.GetChannel("ch1")
	if ch == nil {
		t.Error("Expected channel ch1 to exist")
	}

	g := timeline.GetGoroutine("g1")
	if g == nil {
		t.Error("Expected goroutine g1 to exist")
	}

	if g.State != models.GoroutineStateBlocked {
		t.Errorf("Expected goroutine g1 to be blocked, got state: %v", g.State)
	}

	if ch.SendqLength() != 1 {
		t.Errorf("Expected sendq length 1, got %d", ch.SendqLength())
	}

	analyzer := analyzer.NewAnalyzer(store)
	analyzer.SetTimeline(timeline)

	result, err := analyzer.Analyze()
	if err != nil {
		t.Fatalf("Failed to analyze: %v", err)
	}

	if !result.Deadlock {
		t.Error("Expected deadlock to be detected")
	}

	if result.RiskLevel != string(models.RiskLevelHigh) {
		t.Errorf("Expected HIGH risk level, got %s", result.RiskLevel)
	}

	if result.Stats.BlockedCount != 1 {
		t.Errorf("Expected 1 blocked goroutine, got %d", result.Stats.BlockedCount)
	}

	if len(result.Suggestions) == 0 {
		t.Error("Expected suggestions to be generated")
	}
}

func TestReplayNilChannel(t *testing.T) {
	testCase := &models.ChannelCase{
		ID:          "test-nil-channel",
		Name:        "Test Nil Channel",
		Description: "Test case for nil channel operation",
		Category:    "deadlock",
		Difficulty:  "intermediate",
		Channels: []models.ChannelDef{
			{
				ID:          "ch1",
				Name:        "nil channel",
				BufferSize: 0,
				IsNil:      true,
			},
		},
		Goroutines: []models.GoroutineDef{
			{
				ID:   "g1",
				Name: "main",
				Role: "sender",
			},
		},
		Steps: []models.StepDef{
			{
				Step:      1,
				Action:    "send",
				Goroutine: "g1",
				Channel:   "ch1",
				Value:     "hello",
				Comment:   "Send to nil channel",
			},
		},
	}

	dbPath := "test_nil_channel.db"
	defer os.Remove(dbPath)

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	replayer := NewReplayer(store)
	if err := replayer.LoadCase(testCase); err != nil {
		t.Fatalf("Failed to load case: %v", err)
	}

	timeline := replayer.GetTimeline()
	ch := timeline.GetChannel("ch1")

	if ch.State != models.ChannelStateNil {
		t.Errorf("Expected channel state nil, got %v", ch.State)
	}

	analyzer := analyzer.NewAnalyzer(store)
	analyzer.SetTimeline(timeline)

	result, err := analyzer.Analyze()
	if err != nil {
		t.Fatalf("Failed to analyze: %v", err)
	}

	if result.Stats.NilChannels != 1 {
		t.Errorf("Expected 1 nil channel, got %d", result.Stats.NilChannels)
	}

	if result.RiskLevel != string(models.RiskLevelHigh) {
		t.Errorf("Expected HIGH risk level, got %s", result.RiskLevel)
	}
}

func TestReplayClosedChannel(t *testing.T) {
	testCase := &models.ChannelCase{
		ID:          "test-closed-channel",
		Name:        "Test Closed Channel",
		Description: "Test case for closed channel operations",
		Category:    "panic",
		Difficulty:  "intermediate",
		Channels: []models.ChannelDef{
			{
				ID:          "ch1",
				Name:        "data channel",
				BufferSize: 2,
				IsNil:      false,
			},
		},
		Goroutines: []models.GoroutineDef{
			{
				ID:   "g1",
				Name: "main",
				Role: "sender",
			},
		},
		Steps: []models.StepDef{
			{
				Step:      1,
				Action:    "close",
				Goroutine: "g1",
				Channel:   "ch1",
				Comment:   "Close the channel",
			},
		},
	}

	dbPath := "test_closed_channel.db"
	defer os.Remove(dbPath)

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	replayer := NewReplayer(store)
	if err := replayer.LoadCase(testCase); err != nil {
		t.Fatalf("Failed to load case: %v", err)
	}

	timeline := replayer.GetTimeline()
	ch := timeline.GetChannel("ch1")

	if ch.State != models.ChannelStateClosed {
		t.Errorf("Expected channel state closed, got %v", ch.State)
	}

	analyzer := analyzer.NewAnalyzer(store)
	analyzer.SetTimeline(timeline)

	result, err := analyzer.Analyze()
	if err != nil {
		t.Fatalf("Failed to analyze: %v", err)
	}

	if result.Stats.ClosedChannels != 1 {
		t.Errorf("Expected 1 closed channel, got %d", result.Stats.ClosedChannels)
	}
}

func TestReplayBufferedChannel(t *testing.T) {
	testCase := &models.ChannelCase{
		ID:          "test-buffered-channel",
		Name:        "Test Buffered Channel",
		Description: "Test case for buffered channel operations",
		Category:    "normal",
		Difficulty:  "beginner",
		Channels: []models.ChannelDef{
			{
				ID:          "ch1",
				Name:        "buffered channel",
				BufferSize: 3,
				IsNil:      false,
			},
		},
		Goroutines: []models.GoroutineDef{
			{
				ID:   "g1",
				Name: "sender",
				Role: "sender",
			},
			{
				ID:   "g2",
				Name: "receiver",
				Role: "receiver",
			},
		},
		Steps: []models.StepDef{
			{
				Step:      1,
				Action:    "send",
				Goroutine: "g1",
				Channel:   "ch1",
				Value:     1,
				Comment:   "Send first value",
			},
			{
				Step:      2,
				Action:    "send",
				Goroutine: "g1",
				Channel:   "ch1",
				Value:     2,
				Comment:   "Send second value",
			},
			{
				Step:      3,
				Action:    "recv",
				Goroutine: "g2",
				Channel:   "ch1",
				Comment:   "Receive value",
			},
		},
	}

	dbPath := "test_buffered_channel.db"
	defer os.Remove(dbPath)

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	replayer := NewReplayer(store)
	if err := replayer.LoadCase(testCase); err != nil {
		t.Fatalf("Failed to load case: %v", err)
	}

	timeline := replayer.GetTimeline()
	ch := timeline.GetChannel("ch1")

	if !ch.IsBuffered() {
		t.Error("Expected buffered channel")
	}

	if ch.BufferLength() != 1 {
		t.Errorf("Expected buffer length 1, got %d", ch.BufferLength())
	}

	analyzer := analyzer.NewAnalyzer(store)
	analyzer.SetTimeline(timeline)

	result, err := analyzer.Analyze()
	if err != nil {
		t.Fatalf("Failed to analyze: %v", err)
	}

	if result.Deadlock {
		t.Error("Expected no deadlock")
	}

	if result.Stats.BlockedCount != 0 {
		t.Errorf("Expected 0 blocked goroutines, got %d", result.Stats.BlockedCount)
	}
}

func TestReplaySelectWithDefault(t *testing.T) {
	testCase := &models.ChannelCase{
		ID:          "test-select-default",
		Name:        "Test Select with Default",
		Description: "Test case for select statement with default case",
		Category:    "select",
		Difficulty:  "intermediate",
		Channels: []models.ChannelDef{
			{
				ID:          "ch1",
				Name:        "data channel",
				BufferSize: 0,
				IsNil:      false,
			},
		},
		Goroutines: []models.GoroutineDef{
			{
				ID:   "g1",
				Name: "main",
				Role: "receiver",
			},
		},
		Steps: []models.StepDef{
			{
				Step:   1,
				Action: "select",
				Goroutine: "g1",
				SelectCase: []models.SelectDef{
					{
						Type:      "recv",
						Channel:   "ch1",
						Direction: "recv",
						IsDefault: false,
						Description: "Receive from ch1",
					},
					{
						Type:      "default",
						IsDefault: true,
						Description: "Default case",
					},
				},
				Comment: "Select with default case",
			},
		},
	}

	dbPath := "test_select_default.db"
	defer os.Remove(dbPath)

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	replayer := NewReplayer(store)
	if err := replayer.LoadCase(testCase); err != nil {
		t.Fatalf("Failed to load case: %v", err)
	}

	timeline := replayer.GetTimeline()
	g := timeline.GetGoroutine("g1")

	if g.State == models.GoroutineStateBlocked {
		t.Error("Expected goroutine not to be blocked (default case should be selected)")
	}
}
