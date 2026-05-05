package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/zy1225/chanalyzer/internal/replay"
	"github.com/zy1225/chanalyzer/internal/storage"
)

var replayCmd = &cobra.Command{
	Use:   "replay",
	Short: "Replay channel operations from cases or events",
	Long: `Replay channel operations from YAML cases or JSONL event files.

This command simulates the execution of channel operations and records:
- Event timeline
- Channel state snapshots (buffer, sendq, recvq)
- Goroutine states

The results are saved to SQLite for later analysis.

Examples:
  # Replay all cases from default channel-cases.yaml
  chanalyzer replay

  # Replay a specific case
  chanalyzer replay --case unbuffered-deadlock

  # Replay from events file
  chanalyzer replay --events events.jsonl

  # Replay and show timeline
  chanalyzer replay --timeline --snapshots`,
	RunE: runReplay,
}

var (
	replayCasesFile  string
	replayEventsFile string
	replayCaseID     string
	showTimeline     bool
	showSnapshots    bool
)

func init() {
	replayCmd.Flags().StringVarP(&replayCasesFile, "cases", "c", "", "YAML cases file path")
	replayCmd.Flags().StringVarP(&replayEventsFile, "events", "e", "", "JSONL events file path")
	replayCmd.Flags().StringVarP(&replayCaseID, "case", "i", "", "Specific case ID to replay")
	replayCmd.Flags().BoolVarP(&showTimeline, "timeline", "t", false, "Show event timeline")
	replayCmd.Flags().BoolVarP(&showSnapshots, "snapshots", "s", false, "Show channel snapshots")

	rootCmd.AddCommand(replayCmd)
}

func runReplay(cmd *cobra.Command, args []string) error {
	dbPath := viper.GetString("db")

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	if err := store.ClearAll(); err != nil {
		fmt.Printf("Warning: failed to clear database: %v\n", err)
	}

	replayer := replay.NewReplayer(store)

	if err := replayer.LoadAndReplay(replayCasesFile, replayEventsFile, replayCaseID); err != nil {
		return fmt.Errorf("replay failed: %w", err)
	}

	if err := replayer.SaveToDatabase(); err != nil {
		return fmt.Errorf("failed to save to database: %w", err)
	}

	if showTimeline {
		replayer.PrintTimeline()
	}

	if showSnapshots {
		replayer.PrintChannelSnapshots()
	}

	timeline := replayer.GetTimeline()
	fmt.Printf("\n=== Replay Summary ===\n")
	fmt.Printf("Total Events: %d\n", len(timeline.Events))
	fmt.Printf("Total Channels: %d\n", len(timeline.Channels))
	fmt.Printf("Total Goroutines: %d\n", len(timeline.Goroutines))
	fmt.Printf("Snapshots Taken: %d\n", len(timeline.Snapshots))

	blockedCount := 0
	for _, g := range timeline.Goroutines {
		if g.State == 2 {
			blockedCount++
		}
	}
	if blockedCount > 0 {
		fmt.Printf("\n⚠️  Blocked Goroutines: %d\n", blockedCount)
	}

	fmt.Printf("\nDatabase saved to: %s\n", dbPath)

	return nil
}
