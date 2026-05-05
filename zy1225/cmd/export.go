package cmd

import (
	"fmt"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/zy1225/chanalyzer/internal/analyzer"
	"github.com/zy1225/chanalyzer/internal/exporter"
	"github.com/zy1225/chanalyzer/internal/models"
	"github.com/zy1225/chanalyzer/internal/replay"
	"github.com/zy1225/chanalyzer/internal/storage"
)

var exportCmd = &cobra.Command{
	Use:   "export",
	Short: "Export analysis reports in Markdown or JSON format",
	Long: `Export analysis results to Markdown or JSON reports.

This command generates comprehensive reports including:
- Summary of findings
- Deadlock detection results
- Blocked goroutine details
- Channel state snapshots
- Event timeline
- Fix suggestions with code examples

Examples:
  # Export analysis report in Markdown format
  chanalyzer export --format markdown --output report.md

  # Export analysis report in JSON format
  chanalyzer export --format json --output report.json

  # Export in both formats
  chanalyzer export --format all --output report

  # Replay, analyze, and export in one command
  chanalyzer export --replay --case unbuffered-deadlock --format markdown`,
	RunE: runExport,
}

var (
	exportFormat     string
	exportOutput     string
	exportDoReplay   bool
	exportCases      string
	exportCaseID     string
)

func init() {
	exportCmd.Flags().StringVarP(&exportFormat, "format", "f", "markdown", "Output format: markdown, json, or all")
	exportCmd.Flags().StringVarP(&exportOutput, "output", "o", "", "Output file path (default: reports/analysis-<timestamp>)")
	exportCmd.Flags().BoolVarP(&exportDoReplay, "replay", "r", false, "Replay events before exporting")
	exportCmd.Flags().StringVarP(&exportCases, "cases", "c", "", "YAML cases file for replay")
	exportCmd.Flags().StringVarP(&exportCaseID, "case", "i", "", "Specific case ID to analyze and export")

	rootCmd.AddCommand(exportCmd)
}

func runExport(cmd *cobra.Command, args []string) error {
	dbPath := viper.GetString("db")

	store, err := storage.NewSQLiteStore(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	var timeline *models.Timeline
	var result *models.AnalysisResult

	if exportDoReplay {
		replayer := replay.NewReplayer(store)

		if err := replayer.LoadAndReplay(exportCases, "", exportCaseID); err != nil {
			return fmt.Errorf("replay failed: %w", err)
		}

		if err := replayer.SaveToDatabase(); err != nil {
			return fmt.Errorf("failed to save to database: %w", err)
		}

		timeline = replayer.GetTimeline()

		analyzer := analyzer.NewAnalyzer(store)
		analyzer.SetTimeline(timeline)

		result, err = analyzer.Analyze()
		if err != nil {
			return fmt.Errorf("analysis failed: %w", err)
		}

		analyzer.PrintAnalysisResult()

		if err := analyzer.SaveResultToDatabase(); err != nil {
			fmt.Printf("Warning: failed to save result to database: %v\n", err)
		}
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

		analyzer := analyzer.NewAnalyzer(store)
		analyzer.SetTimeline(timeline)

		result, err = analyzer.Analyze()
		if err != nil {
			return fmt.Errorf("analysis failed: %w", err)
		}
	}

	if exportOutput == "" {
		timestamp := time.Now().Format("20060102-150405")
		exportOutput = filepath.Join("reports", fmt.Sprintf("analysis-%s", timestamp))
	}

	config := &exporter.ExportConfig{
		OutputPath:       exportOutput,
		Format:           exportFormat,
		IncludeTimeline:  true,
	}

	if err := exporter.Export(result, timeline, config); err != nil {
		return fmt.Errorf("export failed: %w", err)
	}

	fmt.Println("\n✅ Export completed successfully!")

	return nil
}
