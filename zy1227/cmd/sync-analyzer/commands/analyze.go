package commands

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"

	"github.com/yourteam/sync-analyzer/internal/analyzer"
	"github.com/yourteam/sync-analyzer/internal/models"
	"github.com/yourteam/sync-analyzer/internal/parser"
	"github.com/yourteam/sync-analyzer/internal/storage"
)

var analyzeCmd = &cobra.Command{
	Use:   "analyze",
	Short: "Analyze sync package usage and detect issues",
	Long: `Analyze the usage of Go sync package primitives from the provided input files
(sync-cases.yaml, events.jsonl, and snippets/*.go). The analysis will detect
common issues such as lock order inversion, read-write lock starvation,
WaitGroup count errors, and more. Results are stored in the SQLite database.`,
	Run: func(cmd *cobra.Command, args []string) {
		workspace, _ := cmd.Flags().GetString("workspace")
		dbPath, _ := cmd.Flags().GetString("db")
		runName, _ := cmd.Flags().GetString("name")
		casesFile, _ := cmd.Flags().GetString("cases")
		eventsFile, _ := cmd.Flags().GetString("events")
		snippetsDir, _ := cmd.Flags().GetString("snippets")

		// 设置默认路径
		if workspace == "" {
			workspace = "."
		}
		if dbPath == "" {
			dbPath = filepath.Join(workspace, "sync-analyzer.db")
		}
		if casesFile == "" {
			casesFile = filepath.Join(workspace, "sync-cases.yaml")
		}
		if eventsFile == "" {
			eventsFile = filepath.Join(workspace, "events.jsonl")
		}
		if snippetsDir == "" {
			snippetsDir = filepath.Join(workspace, "snippets")
		}

		// 生成默认运行名称
		if runName == "" {
			runName = fmt.Sprintf("analysis-%s", time.Now().Format("20060102-150405"))
		}

		// 打开数据库
		fmt.Printf("Opening database at %s...\n", dbPath)
		store, err := storage.NewSQLiteStore(dbPath)
		if err != nil {
			fmt.Printf("Error opening database: %v\n", err)
			os.Exit(1)
		}
		defer store.Close()

		// 创建新的分析运行
		fmt.Printf("Creating analysis run: %s\n", runName)
		tx, err := store.BeginTransaction()
		if err != nil {
			fmt.Printf("Error beginning transaction: %v\n", err)
			os.Exit(1)
		}

		run := &models.AnalysisRun{
			Name:      runName,
			StartTime: time.Now(),
			Status:    "running",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		runID, err := store.CreateAnalysisRun(tx, run)
		if err != nil {
			tx.Rollback()
			fmt.Printf("Error creating analysis run: %v\n", err)
			os.Exit(1)
		}

		if err := tx.Commit(); err != nil {
			fmt.Printf("Error committing transaction: %v\n", err)
			os.Exit(1)
		}

		// 解析输入文件
		fmt.Println("Parsing input files...")

		var cases []models.SyncCase
		var events []models.SyncEvent
		var snippets []*models.CodeSnippet

		// 解析 cases 文件
		if _, err := os.Stat(casesFile); err == nil {
			fmt.Printf("  Parsing %s...\n", casesFile)
			yamlParser := parser.NewYAMLParser()
			cases, err = yamlParser.ParseSyncCases(casesFile)
			if err != nil {
				fmt.Printf("  Warning: Error parsing cases file: %v\n", err)
			} else {
				fmt.Printf("  ✓ Parsed %d cases\n", len(cases))
			}
		} else {
			fmt.Printf("  Cases file not found: %s (skipping)\n", casesFile)
		}

		// 解析 events 文件
		if _, err := os.Stat(eventsFile); err == nil {
			fmt.Printf("  Parsing %s...\n", eventsFile)
			jsonlParser := parser.NewJSONLParser()
			events, err = jsonlParser.ParseEvents(eventsFile)
			if err != nil {
				fmt.Printf("  Warning: Error parsing events file: %v\n", err)
			} else {
				fmt.Printf("  ✓ Parsed %d events\n", len(events))
			}
		} else {
			fmt.Printf("  Events file not found: %s (skipping)\n", eventsFile)
		}

		// 解析 snippets 目录
		if _, err := os.Stat(snippetsDir); err == nil {
			fmt.Printf("  Parsing snippets in %s...\n", snippetsDir)
			goParser := parser.NewGoParser()
			snippets, err = goParser.ParseSnippets(snippetsDir)
			if err != nil {
				fmt.Printf("  Warning: Error parsing snippets: %v\n", err)
			} else {
				fmt.Printf("  ✓ Parsed %d snippets\n", len(snippets))
			}
		} else {
			fmt.Printf("  Snippets directory not found: %s (skipping)\n", snippetsDir)
		}

		// 执行分析
		fmt.Println("Performing analysis...")
		syncAnalyzer := analyzer.NewSyncAnalyzer()
		result, err := syncAnalyzer.Analyze(cases, events, snippets)
		if err != nil {
			fmt.Printf("Error during analysis: %v\n", err)
			os.Exit(1)
		}

		// 设置运行 ID
		result.RunID = runID
		result.RunName = runName

		// 保存结果
		fmt.Println("Saving results to database...")
		if err := store.SaveAnalysisResult(result); err != nil {
			fmt.Printf("Error saving results: %v\n", err)
			os.Exit(1)
		}

		// 输出摘要
		fmt.Println()
		fmt.Println("=== Analysis Summary ===")
		fmt.Printf("Run Name: %s\n", runName)
		fmt.Printf("Run ID: %d\n", runID)
		fmt.Printf("Total Primitives: %d\n", result.Summary.TotalPrimitives)
		fmt.Printf("Total Events: %d\n", result.Summary.TotalEvents)
		fmt.Printf("Total Issues: %d\n", result.Summary.TotalIssues)

		if result.Summary.TotalIssues > 0 {
			fmt.Println()
			fmt.Println("Issues by Type:")
			for issueType, count := range result.Summary.IssuesByType {
				fmt.Printf("  %s: %d\n", issueType, count)
			}

			fmt.Println()
			fmt.Println("Issues by Severity:")
			for severity, count := range result.Summary.IssuesBySeverity {
				fmt.Printf("  %s: %d\n", severity, count)
			}

			fmt.Println()
			fmt.Println("Top Issues:")
			for i, issue := range result.Issues {
				if i >= 5 {
					break
				}
				fmt.Printf("  [%s] %s: %s\n", issue.Severity, issue.Title, issue.Description)
			}
		}

		fmt.Println()
		fmt.Println("✓ Analysis completed successfully")
		fmt.Printf("Run saved with ID: %d\n", runID)
		fmt.Println()
		fmt.Println("Next steps:")
		fmt.Printf("  - View details: sync-analyzer export --run-id %d --format markdown\n", runID)
		fmt.Printf("  - Compare with another run: sync-analyzer compare --base-run-id <old-id> --compare-run-id %d\n", runID)
	},
}

func init() {
	analyzeCmd.Flags().StringP("workspace", "w", ".", "Path to the workspace directory")
	analyzeCmd.Flags().StringP("db", "d", "", "Path to the SQLite database file (default: workspace/sync-analyzer.db)")
	analyzeCmd.Flags().StringP("name", "n", "", "Name for this analysis run (default: generated timestamp)")
	analyzeCmd.Flags().StringP("cases", "c", "", "Path to sync-cases.yaml file (default: workspace/sync-cases.yaml)")
	analyzeCmd.Flags().StringP("events", "e", "", "Path to events.jsonl file (default: workspace/events.jsonl)")
	analyzeCmd.Flags().StringP("snippets", "s", "", "Path to snippets directory (default: workspace/snippets)")
}
