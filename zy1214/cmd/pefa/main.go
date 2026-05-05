package main

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	"github.com/zy1214/pefa/pkg/engine"
	"github.com/zy1214/pefa/pkg/evidence"
	"github.com/zy1214/pefa/pkg/parser"
	"github.com/zy1214/pefa/pkg/report"
	"github.com/zy1214/pefa/pkg/samples"
	"github.com/zy1214/pefa/pkg/storage"
)

var (
	rootCmd = &cobra.Command{
		Use:   "pefa",
		Short: "Linux Performance Evidence Analysis CLI",
		Long: `PEFA - A Linux performance troubleshooting evidence package analyzer.

Analyzes performance data from multiple sources: top, vmstat, iostat, ss,
strace, perf script, and folded stack for flamegraphs.`,
		SilenceUsage: true,
	}

	analyzeCmd = &cobra.Command{
		Use:   "analyze [flags] <evidence-files...>",
		Short: "Analyze performance evidence and identify bottlenecks",
		Long: `Analyze one or more evidence files to identify performance bottlenecks.

This command parses various evidence types, aligns their timelines,
and correlates findings across multiple data sources to provide
a comprehensive performance analysis.

Examples:
  pefa analyze top.txt vmstat.txt iostat.txt
  pefa analyze --session-id "prod-2024-01-15" *.txt
  pefa analyze --save --format json top.txt vmstat.txt`,
		RunE: runAnalyze,
	}

	auditCmd = &cobra.Command{
		Use:   "audit [flags] <evidence-files...>",
		Short: "Audit evidence quality and identify gaps",
		Long: `Audit the quality of collected evidence and identify missing data types.

This command checks for:
- Missing evidence types recommended for comprehensive analysis
- Insufficient sample counts
- Missing timestamp information
- Format issues

Examples:
  pefa audit top.txt vmstat.txt
  pefa audit --session-id "test-001" *.txt`,
		RunE: runAudit,
	}

	compareCmd = &cobra.Command{
		Use:   "compare [flags] <session-ids...>",
		Short: "Compare multiple analysis sessions",
		Long: `Compare two or more analysis sessions to identify trends.

This command compares bottlenecks, recommendations, and metrics
across different sessions to help identify patterns or regressions.

Examples:
  pefa compare session-001 session-002
  pefa compare --format markdown prod-001 prod-002 prod-003`,
		RunE: runCompare,
	}

	exportCmd = &cobra.Command{
		Use:   "export [flags] <session-id>",
		Short: "Export analysis results to file",
		Long: `Export analysis or audit results from a saved session.

Examples:
  pefa export session-001
  pefa export --format markdown session-001
  pefa export --output report.json session-001`,
		RunE: runExport,
	}

	listCmd = &cobra.Command{
		Use:   "list [flags]",
		Short: "List saved analysis sessions",
		RunE:  runList,
	}

	samplesCmd = &cobra.Command{
		Use:   "samples [flags]",
		Short: "List and manage built-in sample data",
		Long: `List built-in sample datasets and export them for testing.

Examples:
  pefa samples --list
  pefa samples --export normal
  pefa samples --export abnormal --output-dir ./test-data`,
		RunE: runSamples,
	}
)

var (
	sessionID    string
	outputFormat string
	outputFile   string
	saveSession  bool
	noSQLite     bool
	dbPath       string

	sampleList      bool
	sampleExport    string
	sampleOutputDir string
)

func init() {
	rootCmd.PersistentFlags().StringVar(&sessionID, "session-id", "", "Session ID for tracking (default: auto-generated)")
	rootCmd.PersistentFlags().StringVarP(&outputFormat, "format", "f", "markdown", "Output format: markdown|json")
	rootCmd.PersistentFlags().StringVarP(&outputFile, "output", "o", "", "Output file path (default: stdout)")
	rootCmd.PersistentFlags().BoolVar(&noSQLite, "no-sqlite", false, "Don't use SQLite for persistence")
	rootCmd.PersistentFlags().StringVar(&dbPath, "db-path", "", "Path to SQLite database file")

	analyzeCmd.Flags().BoolVar(&saveSession, "save", true, "Save analysis to database")

	samplesCmd.Flags().BoolVar(&sampleList, "list", false, "List available sample datasets")
	samplesCmd.Flags().StringVar(&sampleExport, "export", "", "Export named sample dataset")
	samplesCmd.Flags().StringVar(&sampleOutputDir, "output-dir", ".", "Output directory for exported samples")

	rootCmd.AddCommand(analyzeCmd)
	rootCmd.AddCommand(auditCmd)
	rootCmd.AddCommand(compareCmd)
	rootCmd.AddCommand(exportCmd)
	rootCmd.AddCommand(listCmd)
	rootCmd.AddCommand(samplesCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func getStore() (*storage.SQLiteStore, error) {
	if noSQLite {
		return nil, nil
	}
	return storage.NewSQLiteStore(dbPath)
}

func generateSessionID() string {
	return fmt.Sprintf("session-%d", time.Now().Unix())
}

func parseEvidenceFiles(files []string) ([]evidence.Evidence, error) {
	registry := parser.NewDefaultRegistry()
	var evidences []evidence.Evidence

	for _, file := range files {
		content, err := os.ReadFile(file)
		if err != nil {
			return nil, fmt.Errorf("failed to read %s: %w", file, err)
		}

		contentStr := string(content)

		p, detected := registry.Detect(contentStr)
		if !detected {
			fmt.Fprintf(os.Stderr, "Warning: Could not detect format for %s, skipping\n", file)
			continue
		}

		ev, err := p.Parse(contentStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse %s: %w", file, err)
		}

		evidences = append(evidences, ev)
		fmt.Fprintf(os.Stderr, "Parsed %s as %s (%d samples)\n", file, ev.Type(), ev.GetSampleCount())
	}

	return evidences, nil
}

func runAnalyze(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("at least one evidence file required")
	}

	evidences, err := parseEvidenceFiles(args)
	if err != nil {
		return err
	}

	if len(evidences) == 0 {
		return fmt.Errorf("no valid evidence files parsed")
	}

	if sessionID == "" {
		sessionID = generateSessionID()
	}

	analysisEngine := engine.NewAnalysisEngine()
	result, err := analysisEngine.Analyze(sessionID, evidences)
	if err != nil {
		return fmt.Errorf("analysis failed: %w", err)
	}

	if saveSession && !noSQLite {
		store, err := getStore()
		if err != nil {
			return fmt.Errorf("failed to open database: %w", err)
		}
		defer store.Close()

		session := &storage.Session{
			ID:          sessionID,
			CreatedAt:   result.Timestamp,
			UpdatedAt:   result.Timestamp,
			Description: fmt.Sprintf("Analysis of %d evidence files", len(args)),
			Tags:        []string{"analysis"},
		}

		if err := store.CreateSession(session); err != nil {
			return fmt.Errorf("failed to save session: %w", err)
		}

		if err := store.SaveAnalysisResult(sessionID, result); err != nil {
			return fmt.Errorf("failed to save analysis: %w", err)
		}

		fmt.Fprintf(os.Stderr, "Session saved: %s\n", sessionID)
	}

	format := report.OutputFormat(outputFormat)
	if outputFile != "" {
		return report.ExportToFile(result, outputFile, format)
	}

	exporter := report.NewExporter(format)
	return exporter.Export(result, os.Stdout)
}

func runAudit(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("at least one evidence file required")
	}

	evidences, err := parseEvidenceFiles(args)
	if err != nil {
		return err
	}

	if sessionID == "" {
		sessionID = generateSessionID()
	}

	auditEngine := engine.NewAuditEngine()
	result, err := auditEngine.Audit(sessionID, evidences)
	if err != nil {
		return fmt.Errorf("audit failed: %w", err)
	}

	if saveSession && !noSQLite {
		store, err := getStore()
		if err != nil {
			return fmt.Errorf("failed to open database: %w", err)
		}
		defer store.Close()

		session := &storage.Session{
			ID:          sessionID,
			CreatedAt:   result.Timestamp,
			UpdatedAt:   result.Timestamp,
			Description: fmt.Sprintf("Audit of %d evidence files", len(args)),
			Tags:        []string{"audit"},
		}

		if err := store.CreateSession(session); err != nil {
			return fmt.Errorf("failed to save session: %w", err)
		}

		if err := store.SaveAuditResult(sessionID, result); err != nil {
			return fmt.Errorf("failed to save audit: %w", err)
		}

		fmt.Fprintf(os.Stderr, "Session saved: %s\n", sessionID)
	}

	format := report.OutputFormat(outputFormat)
	if outputFile != "" {
		return report.ExportAuditToFile(result, outputFile, format)
	}

	exporter := report.NewExporter(format)
	return exporter.ExportAudit(result, os.Stdout)
}

func runCompare(cmd *cobra.Command, args []string) error {
	if len(args) < 2 {
		return fmt.Errorf("at least two session IDs required for comparison")
	}

	store, err := getStore()
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	fmt.Fprintf(os.Stderr, "Comparing %d sessions...\n", len(args))

	var results []*evidence.AnalysisResult
	var missingSessions []string

	for _, id := range args {
		result, err := store.GetAnalysisResult(id)
		if err != nil {
			missingSessions = append(missingSessions, id)
			fmt.Fprintf(os.Stderr, "Warning: Could not load analysis for session %s: %v\n", id, err)
			continue
		}
		results = append(results, result)
		fmt.Fprintf(os.Stderr, "Loaded session: %s (%d bottlenecks)\n", id, len(result.Bottlenecks))
	}

	if len(results) == 0 {
		return fmt.Errorf("no valid sessions loaded for comparison")
	}

	if len(missingSessions) > 0 {
		fmt.Fprintf(os.Stderr, "Note: %d sessions could not be loaded and were skipped\n", len(missingSessions))
	}

	format := report.OutputFormat(outputFormat)
	exporter := report.NewExporter(format)

	if outputFile != "" {
		return report.ExportCompareToFile(results, outputFile, format)
	}

	return exporter.ExportCompare(results, os.Stdout)
}

func runExport(cmd *cobra.Command, args []string) error {
	if len(args) == 0 {
		return fmt.Errorf("session ID required")
	}

	targetSessionID := args[0]

	fmt.Fprintf(os.Stderr, "Exporting session: %s\n", targetSessionID)

	store, err := getStore()
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	result, err := store.GetAnalysisResult(targetSessionID)
	if err != nil {
		auditResult, auditErr := store.GetAuditResult(targetSessionID)
		if auditErr != nil {
			return fmt.Errorf("session %s not found: %w", targetSessionID, err)
		}

		fmt.Fprintf(os.Stderr, "Exporting audit result for session: %s\n", targetSessionID)
		format := report.OutputFormat(outputFormat)
		if outputFile != "" {
			return report.ExportAuditToFile(auditResult, outputFile, format)
		}
		exporter := report.NewExporter(format)
		return exporter.ExportAudit(auditResult, os.Stdout)
	}

	fmt.Fprintf(os.Stderr, "Loaded analysis: %d bottlenecks, %d recommendations\n",
		len(result.Bottlenecks), len(result.Recommendations))

	format := report.OutputFormat(outputFormat)
	if outputFile != "" {
		return report.ExportToFile(result, outputFile, format)
	}

	exporter := report.NewExporter(format)
	return exporter.Export(result, os.Stdout)
}

func runList(cmd *cobra.Command, args []string) error {
	store, err := getStore()
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	sessions, err := store.ListSessions(50, 0)
	if err != nil {
		return fmt.Errorf("failed to list sessions: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("No sessions found")
		return nil
	}

	fmt.Printf("Sessions (%d):\n\n", len(sessions))
	for _, s := range sessions {
		fmt.Printf("ID:          %s\n", s.ID)
		fmt.Printf("Created:     %s\n", s.CreatedAt.Format("2006-01-02 15:04:05"))
		if s.Description != "" {
			fmt.Printf("Description: %s\n", s.Description)
		}
		if len(s.Tags) > 0 {
			fmt.Printf("Tags:        %v\n", s.Tags)
		}
		fmt.Println()
	}

	return nil
}

func runSamples(cmd *cobra.Command, args []string) error {
	if sampleList {
		fmt.Println("Available sample datasets:")
		fmt.Println()
		fmt.Println("  normal   - Normal system behavior for baseline")
		fmt.Println("  abnormal - System with various performance issues")
		fmt.Println()
		fmt.Println("Use 'pefa samples --export <name> --output-dir ./dir' to export")
		return nil
	}

	if sampleExport != "" {
		var sampleData map[string]string
		var err error

		switch sampleExport {
		case "normal":
			sampleData, err = samples.GetNormalSample()
		case "abnormal":
			sampleData, err = samples.GetAbnormalSample()
		default:
			return fmt.Errorf("unknown sample: %s. Use 'pefa samples --list' to see available samples", sampleExport)
		}

		if err != nil {
			return fmt.Errorf("failed to get sample: %w", err)
		}

		if err := os.MkdirAll(sampleOutputDir, 0755); err != nil {
			return fmt.Errorf("failed to create output directory: %w", err)
		}

		for filename, content := range sampleData {
			path := filepath.Join(sampleOutputDir, filename)
			if err := os.WriteFile(path, []byte(content), 0644); err != nil {
				return fmt.Errorf("failed to write %s: %w", path, err)
			}
			fmt.Printf("Exported: %s\n", path)
		}

		fmt.Printf("\nSample '%s' exported to %s\n", sampleExport, sampleOutputDir)
		fmt.Printf("\nTo analyze:\n  pefa analyze %s/*.txt\n", sampleOutputDir)
		return nil
	}

	return cmd.Help()
}
