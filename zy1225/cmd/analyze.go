package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/zy1225/chanalyzer/internal/analyzer"
	"github.com/zy1225/chanalyzer/internal/models"
	"github.com/zy1225/chanalyzer/internal/replay"
	"github.com/zy1225/chanalyzer/internal/storage"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze channel operations for deadlocks and leaks",
	Long: `Analyze channel operations to detect deadlocks, goroutine leaks, and other issues.

This command analyzes the replayed events from SQLite and provides:
- Deadlock detection
- Blocked goroutine identification
- Channel state analysis
- Risk level assessment
- Fix suggestions with code examples

Examples:
  # Analyze after replay
  chanalyzer analyze

  # Replay and analyze in one step
  chanalyzer analyze --replay

  # Analyze specific case
  chanalyzer analyze --case unbuffered-deadlock --replay`,
	RunE: runAnalyze,
}

var (
	doReplay     bool
	analyzeCases string
	analyzeCaseID string
)

func init() {
	analyzeCmd.Flags().BoolVarP(&doReplay, "replay", "r", false, "Replay events before analyzing")
	analyzeCmd.Flags().StringVarP(&analyzeCases, "cases", "c", "", "YAML cases file for replay")
	analyzeCmd.Flags().StringVarP(&analyzeCaseID, "case", "i", "", "Specific case ID to analyze")

	rootCmd.AddCommand(analyzeCmd)
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	dbPath := viper.GetString("db")

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	var timeline *models.Timeline

	if doReplay {
		replayer := replay.NewReplayer(store)

		if err := replayer.LoadAndReplay(analyzeCases, "", analyzeCaseID); err != nil {
			return fmt.Errorf("replay failed: %w", err)
		}

		if err := replayer.SaveToDatabase(); err != nil {
			return fmt.Errorf("failed to save to database: %w", err)
		}

		timeline = replayer.GetTimeline()
	} else {
		events, err := store.GetAllEvents()
		if err != nil {
			return fmt.Errorf("failed to load events: %w", err)
		}

		if len(events) == 0 {
			return fmt.Errorf("no events found in database. Use --replay flag to replay first")
		}

		timeline = models.NewTimeline()
		for _, e := range events {
			timeline.AddEvent(e)
		}

		snapshots, err := store.GetChannelSnapshots("", 1000)
		if err == nil {
			for _, s := range snapshots {
				timeline.AddSnapshot(s)
			}
		}
	}

	analyzer := analyzer.NewAnalyzer(store)
	analyzer.SetTimeline(timeline)

	result, err := analyzer.Analyze()
	if err != nil {
		return fmt.Errorf("analysis failed: %w", err)
	}

	analyzer.PrintAnalysisResult()

	if err := analyzer.SaveResultToDatabase(); err != nil {
		fmt.Printf("Warning: failed to save result to database: %v\n", err)
	}

	return nil
}
