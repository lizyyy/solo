package analyzer

import (
	"fmt"

	"github.com/zy1225/chanalyzer/internal/models"
	"github.com/zy1225/chanalyzer/internal/storage"
)

type Analyzer struct {
	store      *storage.SQLiteStore
	timeline   *models.Timeline
	result     *models.AnalysisResult
}

func NewAnalyzer(store *storage.SQLiteStore) *Analyzer {
	return &Analyzer{
		store:  store,
		result: &models.AnalysisResult{},
	}
}

func (a *Analyzer) SetTimeline(timeline *models.Timeline) {
	a.timeline = timeline
}

func (a *Analyzer) Analyze() (*models.AnalysisResult, error) {
	if a.timeline == nil {
		return nil, fmt.Errorf("timeline not set")
	}

	a.result = &models.AnalysisResult{
		ChannelStates: make(map[string]*models.ChannelSnapshot),
		Suggestions:   make([]models.Suggestion, 0),
		Timeline:      a.timeline,
		Stats: models.AnalysisStats{
			TotalEvents:     len(a.timeline.Events),
			TotalChannels:   len(a.timeline.Channels),
			TotalGoroutines: len(a.timeline.Goroutines),
		},
	}

	a.checkForDeadlock()
	a.checkForBlockedGoroutines()
	a.checkChannelStates()
	a.checkForNilChannelOperations()
	a.checkForClosedChannelOperations()
	a.analyzeSelectPatterns()
	a.determineRiskLevel()
	a.generateSuggestions()

	return a.result, nil
}

func (a *Analyzer) checkForDeadlock() {
	blockedCount := 0
	runningCount := 0

	for _, g := range a.timeline.Goroutines {
		if g.State == models.GoroutineStateBlocked {
			blockedCount++
		} else if g.State == models.GoroutineStateRunning {
			runningCount++
		}
	}

	if runningCount == 0 && blockedCount > 0 {
		a.result.Deadlock = true
		a.result.DeadlockType = "ALL_GOROUTINES_BLOCKED"
		a.result.Description = "All goroutines are blocked - classic deadlock detected"
	}
}

func (a *Analyzer) checkForBlockedGoroutines() {
	for _, g := range a.timeline.Goroutines {
		if g.State == models.GoroutineStateBlocked {
			a.result.BlockedGoroutines = append(a.result.BlockedGoroutines, g.Snapshot())
			a.result.Stats.BlockedCount++
		}
	}
}

func (a *Analyzer) checkChannelStates() {
	for id, ch := range a.timeline.Channels {
		snapshot := ch.Snapshot()
		a.result.ChannelStates[id] = snapshot

		if ch.State == models.ChannelStateClosed {
			a.result.Stats.ClosedChannels++
		}
		if ch.State == models.ChannelStateNil {
			a.result.Stats.NilChannels++
		}
	}
}

func (a *Analyzer) checkForNilChannelOperations() {
	for _, event := range a.timeline.Events {
		if event.Metadata.BlockReason == "send_on_nil_channel" ||
		   event.Metadata.BlockReason == "recv_on_nil_channel" ||
		   event.Metadata.BlockReason == "close_nil_channel" {
			
			if !a.result.Deadlock {
				a.result.Deadlock = true
				a.result.DeadlockType = "NIL_CHANNEL_OPERATION"
				a.result.Description = fmt.Sprintf("Operation on nil channel: %s", event.Metadata.BlockReason)
			}
		}
	}
}

func (a *Analyzer) checkForClosedChannelOperations() {
	for _, event := range a.timeline.Events {
		if event.Metadata.BlockReason == "send_on_closed_channel" ||
		   event.Metadata.BlockReason == "close_closed_channel" {
			
			a.result.Description = fmt.Sprintf("Invalid operation on closed channel: %s", event.Metadata.BlockReason)
		}
	}
}

func (a *Analyzer) analyzeSelectPatterns() {
	for _, event := range a.timeline.Events {
		if event.Type == models.EventTypeSelect {
			if event.Metadata.SelectedCase < 0 {
				for _, sc := range event.Metadata.SelectCases {
					if sc.IsDefault {
						continue
					}
					ch := a.timeline.GetChannel(sc.Channel)
					if ch != nil && ch.State == models.ChannelStateNil {
						a.result.Description = "Select statement includes nil channel case"
					}
				}
			}
		}
	}
}

func (a *Analyzer) determineRiskLevel() {
	if a.result.Deadlock || a.result.Stats.NilChannels > 0 {
		a.result.RiskLevel = string(models.RiskLevelHigh)
	} else if a.result.Stats.BlockedCount > 0 || a.result.Stats.ClosedChannels > 0 {
		a.result.RiskLevel = string(models.RiskLevelMedium)
	} else {
		a.result.RiskLevel = string(models.RiskLevelLow)
	}
}

func (a *Analyzer) generateSuggestions() {
	if a.result.Deadlock {
		switch a.result.DeadlockType {
		case "ALL_GOROUTINES_BLOCKED":
			a.addSuggestion(
				"CRITICAL",
				"Deadlock",
				"All goroutines are blocked. This is a classic deadlock scenario.",
				`// Check for unbuffered channel sends without receivers
ch := make(chan int)
// Bad: will block forever
// ch <- 42

// Good: start receiver first or use buffered channel
go func() {
    fmt.Println(<-ch)
}()
ch <- 42`,
				"https://go.dev/ref/spec#Channel_types",
			)
		case "NIL_CHANNEL_OPERATION":
			a.addSuggestion(
				"CRITICAL",
				"Nil Channel",
				"Operation on nil channel detected. Nil channels block forever.",
				`// Bad: nil channel
var ch chan int
// ch <- 42  // Blocks forever!

// Good: initialize channel first
ch = make(chan int)  // unbuffered
// or
ch = make(chan int, 10)  // buffered`,
				"https://go.dev/ref/spec#Receive_operator",
			)
		}
	}

	for _, chSnapshot := range a.result.ChannelStates {
		if chSnapshot.State == "nil" {
			a.addSuggestion(
				"HIGH",
				"Nil Channel",
				fmt.Sprintf("Channel %s is nil. Any operation on it will block or panic.", chSnapshot.ChannelID),
				`// Always initialize channels before use
ch := make(chan int)  // unbuffered
ch := make(chan int, 5)  // buffered`,
				"https://go.dev/ref/spec#Making_slices_maps_and_channels",
			)
		}
	}

	for _, g := range a.result.BlockedGoroutines {
		if g.WaitingOn != "" && g.WaitingOn != "select" {
			chSnapshot, exists := a.result.ChannelStates[g.WaitingOn]
			if exists {
				if chSnapshot.State == "active" {
					if chSnapshot.SendqLength > 0 {
						a.addSuggestion(
							"MEDIUM",
							"Blocked Sender",
							fmt.Sprintf("Goroutine %s is blocked sending on channel %s. No receiver is ready.", g.Name, g.WaitingOn),
							`// Ensure there's a receiver or use buffered channel
select {
case ch <- value:
    fmt.Println("Sent successfully")
case <-time.After(time.Second):
    fmt.Println("Send timed out")
}`,
							"https://go.dev/ref/spec#Select_statements",
						)
					}
					if chSnapshot.RecvqLength > 0 {
						a.addSuggestion(
							"MEDIUM",
							"Blocked Receiver",
							fmt.Sprintf("Goroutine %s is blocked receiving on channel %s. No sender is ready.", g.Name, g.WaitingOn),
							`// Use select with timeout to avoid indefinite blocking
select {
case val := <-ch:
    fmt.Println("Received:", val)
case <-time.After(time.Second):
    fmt.Println("Receive timed out")
}`,
							"https://go.dev/ref/spec#Select_statements",
						)
					}
				}
			}
		}
	}

	for _, event := range a.timeline.Events {
		if event.Metadata.BlockReason == "send_on_closed_channel" {
			a.addSuggestion(
				"HIGH",
				"Closed Channel Send",
				"Attempted to send on a closed channel. This causes a panic in Go.",
				`// Only send on open channels
// Use comma-ok to check if channel is closed
val, ok := <-ch
if !ok {
    fmt.Println("Channel is closed")
}

// Or use select with done channel pattern
select {
case ch <- value:
    // sent successfully
case <-done:
    // channel is being closed, don't send
}`,
				"https://go.dev/ref/spec#Send_statements",
			)
		}
		if event.Metadata.BlockReason == "close_closed_channel" {
			a.addSuggestion(
				"HIGH",
				"Double Close",
				"Attempted to close an already closed channel. This causes a panic.",
				`// Use sync.Once or a done channel pattern to prevent double close
var once sync.Once
closeCh := func() {
    once.Do(func() {
        close(ch)
    })
}

// Or use context for cancellation
ctx, cancel := context.WithCancel(context.Background())
defer cancel()`,
				"https://go.dev/ref/spec#Close",
			)
		}
	}

	if len(a.result.BlockedGoroutines) > 0 && !a.result.Deadlock {
		a.addSuggestion(
			"MEDIUM",
			"Goroutine Leak",
			"Some goroutines are blocked but not all. This may indicate a goroutine leak.",
			`// Use context or done channel to cancel blocked goroutines
func worker(ctx context.Context, ch <-chan int) {
    for {
        select {
        case val := <-ch:
            fmt.Println("Processing:", val)
        case <-ctx.Done():
            return  // Exit when cancelled
        }
    }
}

ctx, cancel := context.WithCancel(context.Background())
go worker(ctx, ch)
// Later, to cancel the worker:
cancel()`,
			"https://pkg.go.dev/context",
		)
	}

	if len(a.result.Suggestions) == 0 {
		a.addSuggestion(
			"LOW",
			"Best Practices",
			"Your channel usage looks healthy! Here are some best practices to maintain.",
			`// Channel Best Practices:
// 1. Always initialize channels with make()
// 2. Use unbuffered channels for synchronization
// 3. Use buffered channels for throughput
// 4. Only the sender should close a channel
// 5. Use context for cancellation
// 6. Use select with timeout for non-blocking operations`,
			"https://go.dev/doc/effective_go#channels",
		)
	}
}

func (a *Analyzer) addSuggestion(priority, category, description, codeExample, reference string) {
	for _, s := range a.result.Suggestions {
		if s.Description == description {
			return
		}
	}

	a.result.Suggestions = append(a.result.Suggestions, models.Suggestion{
		Priority:    priority,
		Category:    category,
		Description: description,
		CodeExample: codeExample,
		Reference:   reference,
	})
}

func (a *Analyzer) PrintAnalysisResult() {
	fmt.Println("\n" + "="*60)
	fmt.Println("          ANALYSIS RESULT")
	fmt.Println("=" * 60)

	fmt.Printf("\n📊 Case: %s\n", a.result.CaseName)
	if a.result.Deadlock {
		fmt.Printf("⚠️  DEADLOCK DETECTED: %s\n", a.result.DeadlockType)
		fmt.Printf("   Description: %s\n", a.result.Description)
	}

	fmt.Printf("\n📈 Risk Level: ")
	switch a.result.RiskLevel {
	case "HIGH":
		fmt.Printf("🔴 HIGH\n")
	case "MEDIUM":
		fmt.Printf("🟡 MEDIUM\n")
	case "LOW":
		fmt.Printf("🟢 LOW\n")
	default:
		fmt.Printf("%s\n", a.result.RiskLevel)
	}

	fmt.Println("\n📊 Statistics:")
	fmt.Printf("  Total Events: %d\n", a.result.Stats.TotalEvents)
	fmt.Printf("  Total Channels: %d\n", a.result.Stats.TotalChannels)
	fmt.Printf("  Total Goroutines: %d\n", a.result.Stats.TotalGoroutines)
	fmt.Printf("  Blocked Goroutines: %d\n", a.result.Stats.BlockedCount)
	fmt.Printf("  Closed Channels: %d\n", a.result.Stats.ClosedChannels)
	fmt.Printf("  Nil Channels: %d\n", a.result.Stats.NilChannels)

	if len(a.result.BlockedGoroutines) > 0 {
		fmt.Println("\n🚫 Blocked Goroutines:")
		for _, g := range a.result.BlockedGoroutines {
			fmt.Printf("  - %s (%s): blocked on %s since %v\n",
				g.Name, g.ID, g.WaitingOn, g.Since.Format("15:04:05"))
		}
	}

	if len(a.result.ChannelStates) > 0 {
		fmt.Println("\n📦 Channel States:")
		for id, ch := range a.result.ChannelStates {
			fmt.Printf("  - %s: %s\n", id, ch.State)
			fmt.Printf("    Buffer: %d/%d\n", ch.BufferLength, ch.BufferSize)
			fmt.Printf("    Send Queue: %d goroutines\n", ch.SendqLength)
			fmt.Printf("    Recv Queue: %d goroutines\n", ch.RecvqLength)
		}
	}

	if len(a.result.Suggestions) > 0 {
		fmt.Println("\n💡 Suggestions:")
		for i, s := range a.result.Suggestions {
			fmt.Printf("\n[%d] [%s] %s\n", i+1, s.Priority, s.Category)
			fmt.Printf("    %s\n", s.Description)
			if s.CodeExample != "" {
				fmt.Printf("\n    Code Example:\n")
				fmt.Printf("    %s\n", s.CodeExample)
			}
			if s.Reference != "" {
				fmt.Printf("\n    Reference: %s\n", s.Reference)
			}
		}
	}

	fmt.Println("\n" + "="*60)
}

func (a *Analyzer) SaveResultToDatabase() error {
	_, err := a.store.SaveAnalysisResult(a.result)
	return err
}
