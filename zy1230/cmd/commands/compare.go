package commands

import (
	"fmt"

	"go-policy-scanner/internal/reporter"
	"go-policy-scanner/internal/storage"
	"go-policy-scanner/pkg/model"

	"github.com/spf13/cobra"
)

var compareCmd = &cobra.Command{
	Use:   "compare <base-scan-id> <target-scan-id>",
	Short: "比较两次扫描结果",
	Long: `比较两次扫描结果，生成趋势对比报告。

示例:
  go-policy-scanner compare 1 2
  go-policy-scanner compare --output diff.md 1 2
  go-policy-scanner compare --format json 1 2`,
	Args: cobra.ExactArgs(2),
	RunE: runCompare,
}

func init() {
	rootCmd.AddCommand(compareCmd)
	compareCmd.Flags().StringP("output", "o", "", "输出报告文件路径")
	compareCmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown|json")
}

func runCompare(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	outputPath, _ := cmd.Flags().GetString("output")
	format, _ := cmd.Flags().GetString("format")
	verbose, _ := cmd.Flags().GetBool("verbose")

	var baseID, targetID int64
	fmt.Sscanf(args[0], "%d", &baseID)
	fmt.Sscanf(args[1], "%d", &targetID)

	if verbose {
		fmt.Printf("Comparing scan %d with scan %d\n", baseID, targetID)
		fmt.Printf("Using database: %s\n", dbPath)
	}

	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	baseResult, err := store.GetScanResult(baseID)
	if err != nil {
		return fmt.Errorf("failed to get base scan result: %w", err)
	}

	targetResult, err := store.GetScanResult(targetID)
	if err != nil {
		return fmt.Errorf("failed to get target scan result: %w", err)
	}

	baseViolations, err := store.GetViolations(baseID)
	if err != nil {
		return fmt.Errorf("failed to get base violations: %w", err)
	}

	targetViolations, err := store.GetViolations(targetID)
	if err != nil {
		return fmt.Errorf("failed to get target violations: %w", err)
	}

	compareResult := analyzeDifferences(baseResult, targetResult, baseViolations, targetViolations)

	printCompareSummary(compareResult)

	if outputPath != "" {
		if err := exportCompareReport(compareResult, outputPath, format); err != nil {
			return fmt.Errorf("failed to export compare report: %w", err)
		}
		fmt.Printf("\nCompare report exported to: %s\n", outputPath)
	}

	return nil
}

func analyzeDifferences(
	baseResult, targetResult *model.ScanResult,
	baseViolations, targetViolations []model.Violation,
) *model.CompareResult {
	result := &model.CompareResult{
		BaseScanID:   baseResult.ID,
		TargetScanID: targetResult.ID,
	}

	baseMap := make(map[string]model.Violation)
	for _, v := range baseViolations {
		key := fmt.Sprintf("%s|%s|%s", v.Type, v.Message, v.File)
		baseMap[key] = v
	}

	targetMap := make(map[string]model.Violation)
	for _, v := range targetViolations {
		key := fmt.Sprintf("%s|%s|%s", v.Type, v.Message, v.File)
		targetMap[key] = v
	}

	for key, v := range targetMap {
		if _, exists := baseMap[key]; !exists {
			result.NewViolations = append(result.NewViolations, v)
		}
	}

	for key, v := range baseMap {
		if _, exists := targetMap[key]; !exists {
			result.FixedViolations = append(result.FixedViolations, v)
		}
	}

	result.SummaryDiff = model.SummaryDiff{
		TotalDiff:  targetResult.Summary.TotalChecks - baseResult.Summary.TotalChecks,
		PassedDiff: targetResult.Summary.PassedChecks - baseResult.Summary.PassedChecks,
		FailedDiff: targetResult.Summary.FailedChecks - baseResult.Summary.FailedChecks,
	}

	return result
}

func printCompareSummary(result *model.CompareResult) {
	fmt.Println("\n" + "="*60)
	fmt.Println("Compare Results Summary")
	fmt.Println("=" * 60)
	fmt.Printf("Base Scan ID:    %d\n", result.BaseScanID)
	fmt.Printf("Target Scan ID:  %d\n", result.TargetScanID)
	fmt.Println("-" * 60)

	fmt.Printf("Summary Changes:")
	if result.SummaryDiff.FailedDiff < 0 {
		fmt.Printf("  Failed Checks: %d (Improved!%s\n", result.SummaryDiff.FailedDiff, getSeverityColor("low"), resetColor())
	} else if result.SummaryDiff.FailedDiff > 0 {
		fmt.Printf("  Failed Checks: %s+%d (Worse)%s\n", getSeverityColor("high"), result.SummaryDiff.FailedDiff, resetColor())
	} else {
		fmt.Printf("  Failed Checks: %sNo change%s\n", getSeverityColor("medium"), resetColor())
	}

	fmt.Println("-" * 60)
	fmt.Printf("New Violations:      %d\n", len(result.NewViolations))
	fmt.Printf("Fixed Violations:    %d\n", len(result.FixedViolations))

	if len(result.NewViolations) > 0 {
		fmt.Println("\nNew Violations:")
		for _, v := range result.NewViolations {
			fmt.Printf("  [%s] %s\n", v.Severity, v.Message)
		}
	}

	if len(result.FixedViolations) > 0 {
		fmt.Println("\nFixed Violations:")
		for _, v := range result.FixedViolations {
			fmt.Printf("  [%s] %s\n", v.Severity, v.Message)
		}
	}
}

func exportCompareReport(result *model.CompareResult, outputPath, format string) error {
	var err error

	switch format {
	case "json":
		err = reporter.ExportCompareJSON(result, outputPath)
	case "markdown":
		fallthrough
	default:
		err = reporter.ExportCompareMarkdown(result, outputPath)
	}

	return err
}
