package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/yourname/pcheck/internal/benchmark"
	"github.com/yourname/pcheck/internal/compatibility"
	"github.com/yourname/pcheck/internal/payload"
	"github.com/yourname/pcheck/internal/report"
	"github.com/yourname/pcheck/internal/schema"
	"github.com/yourname/pcheck/pkg/types"
)

var reportCmd = &cobra.Command{
	Use:   "report",
	Short: "Generate comprehensive migration assessment report",
	Long: `Run full migration assessment including compatibility checks and 
performance benchmarks, then generate a comprehensive report in 
Markdown, JSON, or CSV format.`,
	RunE: runReport,
}

func init() {
	rootCmd.AddCommand(reportCmd)

	reportCmd.Flags().String("old-schema", "", "Old schema file (yaml or proto)")
	reportCmd.Flags().StringP("new-schema", "n", "", "New schema file (yaml or proto)")
	reportCmd.Flags().StringP("payloads", "p", "", "Historical payloads file (jsonl)")
	reportCmd.Flags().StringP("rules", "r", "", "Rules configuration file (yaml)")
	reportCmd.Flags().StringP("project", "j", "Migration Assessment", "Project name for report")
	reportCmd.Flags().IntP("iterations", "i", 5, "Number of iterations for benchmark")
	reportCmd.Flags().IntP("sample-size", "s", 50, "Sample size for benchmark (0 = all)")
	reportCmd.Flags().Bool("skip-benchmark", false, "Skip performance benchmark")

	reportCmd.MarkFlagRequired("new-schema")
	reportCmd.MarkFlagRequired("payloads")
}

func runReport(cmd *cobra.Command, args []string) error {
	oldSchemaPath, _ := cmd.Flags().GetString("old-schema")
	newSchemaPath, _ := cmd.Flags().GetString("new-schema")
	payloadsPath, _ := cmd.Flags().GetString("payloads")
	rulesPath, _ := cmd.Flags().GetString("rules")
	projectName, _ := cmd.Flags().GetString("project")
	iterations, _ := cmd.Flags().GetInt("iterations")
	sampleSize, _ := cmd.Flags().GetInt("sample-size")
	skipBenchmark, _ := cmd.Flags().GetBool("skip-benchmark")
	outputFormat, _ := cmd.Flags().GetString("format")
	outputPath, _ := cmd.Flags().GetString("output")

	var rules *types.Rules
	if rulesPath != "" {
		var err error
		rules, err = payload.LoadRulesFromYAML(rulesPath)
		if err != nil {
			return fmt.Errorf("failed to parse rules: %w", err)
		}
	} else {
		rules = &types.Rules{}
	}

	fmt.Fprintf(os.Stderr, "Loading new schema: %s\n", newSchemaPath)
	newSchema, err := schema.ParseSchemaFile(newSchemaPath)
	if err != nil {
		return fmt.Errorf("failed to parse new schema: %w", err)
	}

	var oldSchema *types.Schema
	if oldSchemaPath != "" {
		fmt.Fprintf(os.Stderr, "Loading old schema: %s\n", oldSchemaPath)
		oldSchema, err = schema.ParseSchemaFile(oldSchemaPath)
		if err != nil {
			return fmt.Errorf("failed to parse old schema: %w", err)
		}
	} else {
		oldSchema = newSchema
	}

	fmt.Fprintf(os.Stderr, "Loading payloads: %s\n", payloadsPath)
	allPayloads, err := payload.LoadPayloadsFromJSONL(payloadsPath)
	if err != nil {
		return fmt.Errorf("failed to load payloads: %w", err)
	}

	fmt.Fprintln(os.Stderr, "Running compatibility checks...")
	checker := compatibility.NewChecker(oldSchema, newSchema, rules)

	schemaIssues := checker.CheckSchemaCompatibility()

	var selectedPayloads []types.Payload
	if sampleSize > 0 && sampleSize < allPayloads.TotalCount {
		fmt.Fprintf(os.Stderr, "Sampling %d out of %d payloads for validation...\n",
			sampleSize, allPayloads.TotalCount)
		sampled := payload.SamplePayloads(allPayloads, sampleSize)
		selectedPayloads = sampled.Payloads
	} else {
		selectedPayloads = allPayloads.Payloads
	}

	payloadIssues := &types.IssueCollection{
		Issues:     []types.Issue{},
		ByType:     make(map[types.IssueType][]types.Issue),
		BySeverity: make(map[types.IssueSeverity][]types.Issue),
	}

	if len(newSchema.Messages) > 0 {
		msgToCheck := &newSchema.Messages[0]
		for _, p := range selectedPayloads {
			issues := checker.CheckPayloadAgainstSchema(&p, msgToCheck)
			for _, issue := range issues.Issues {
				payloadIssues.Issues = append(payloadIssues.Issues, issue)
				payloadIssues.ByType[issue.Type] = append(payloadIssues.ByType[issue.Type], issue)
				payloadIssues.BySeverity[issue.Severity] = append(payloadIssues.BySeverity[issue.Severity], issue)
			}
		}
		calculateIssueStats(payloadIssues)
	}

	totalIssues := mergeIssues(schemaIssues, payloadIssues)

	var benchResults *types.BenchmarkCollection
	var comparisons *types.ComparisonReport

	if !skipBenchmark {
		fmt.Fprintf(os.Stderr, "Running performance benchmark (%d iterations)...\n", iterations)

		rules.PerformanceChecks.CompareJSON = true
		rules.PerformanceChecks.CompareProtobuf = true
		rules.PerformanceChecks.CompareMessagePack = true

		comparer := benchmark.NewComparer(rules)
		benchResults = comparer.CompareAll(selectedPayloads, iterations)
		comparisons = comparer.GenerateComparisonReport(benchResults)

		fmt.Fprintln(os.Stderr, "Benchmark complete.")
	} else {
		benchResults = &types.BenchmarkCollection{
			FormatStats: make(map[types.EncodingFormat]types.FormatStats),
		}
		comparisons = &types.ComparisonReport{}
	}

	fmt.Fprintln(os.Stderr, "Generating report...")
	generator := report.NewGenerator()

	fullReport := generator.BuildReport(
		newSchema,
		allPayloads,
		totalIssues,
		benchResults,
		comparisons,
		projectName,
	)

	var reportFormat report.ReportFormat
	switch outputFormat {
	case "markdown", "md":
		reportFormat = report.FormatMarkdown
	case "csv":
		reportFormat = report.FormatCSV
	default:
		reportFormat = report.FormatJSON
	}

	output, err := generator.Generate(fullReport, reportFormat)
	if err != nil {
		return fmt.Errorf("failed to generate report: %w", err)
	}

	if outputPath != "" {
		dir := filepath.Dir(outputPath)
		if dir != "." && dir != "" {
			if err := os.MkdirAll(dir, 0755); err != nil {
				return fmt.Errorf("failed to create output directory: %w", err)
			}
		}
		if err := os.WriteFile(outputPath, output, 0644); err != nil {
			return fmt.Errorf("failed to write output file: %w", err)
		}
		fmt.Fprintf(os.Stderr, "Report written to: %s\n", outputPath)
	} else {
		fmt.Println(string(output))
	}

	fmt.Fprintf(os.Stderr, "\n=== Report Summary ===\n")
	fmt.Fprintf(os.Stderr, "Project: %s\n", projectName)
	fmt.Fprintf(os.Stderr, "Risk Level: %s\n", fullReport.Summary.OverallRiskLevel)
	fmt.Fprintf(os.Stderr, "Total Issues: %d (Critical: %d, High: %d)\n",
		fullReport.Summary.TotalIssues,
		fullReport.Summary.CriticalIssues,
		fullReport.Summary.HighIssues)

	if !skipBenchmark {
		fmt.Fprintf(os.Stderr, "\n=== Performance Summary ===\n")
		fmt.Fprintf(os.Stderr, "Protobuf vs JSON - Size: %.1f%% reduction, Encode: %.1fx faster\n",
			(1-fullReport.Summary.ProtobufSizeReduction)*100,
			fullReport.Summary.ProtobufSpeedup)
		fmt.Fprintf(os.Stderr, "MessagePack vs JSON - Size: %.1f%% reduction, Encode: %.1fx faster\n",
			(1-fullReport.Summary.MsgpackSizeReduction)*100,
			fullReport.Summary.MsgpackSpeedup)
	}

	if fullReport.Summary.CriticalIssues > 0 || fullReport.Summary.HighIssues > 0 {
		os.Exit(1)
	}

	return nil
}
