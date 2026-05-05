package commands

import (
	"fmt"
	"os"
	"path/filepath"

	"go-policy-scanner/internal/reporter"
	"go-policy-scanner/internal/scanner"
	"go-policy-scanner/pkg/model"

	"github.com/spf13/cobra"
)

var scanCmd = &cobra.Command{
	Use:   "scan [directory]",
	Short: "扫描 Go 项目并生成检查报告",
	Long: `扫描指定目录中的 Go 项目，执行所有配置的检查项，并将结果保存到数据库。

示例:
  go-policy-scanner scan ./my-project
  go-policy-scanner scan --policy service-policy.yaml ./my-project
  go-policy-scanner scan --db ./custom.db ./my-project`,
	Args: cobra.MaximumNArgs(1),
	RunE: runScan,
}

func init() {
	rootCmd.AddCommand(scanCmd)
	scanCmd.Flags().StringP("output", "o", "", "输出报告文件路径 (支持 .md 和 .json)")
	scanCmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown|json")
}

func runScan(cmd *cobra.Command, args []string) error {
	rootDir := "."
	if len(args) > 0 {
		rootDir = args[0]
	}

	absRootDir, err := filepath.Abs(rootDir)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	if _, err := os.Stat(absRootDir); os.IsNotExist(err) {
		return fmt.Errorf("directory does not exist: %s", absRootDir)
	}

	goModPath := filepath.Join(absRootDir, "go.mod")
	if _, err := os.Stat(goModPath); os.IsNotExist(err) {
		return fmt.Errorf("go.mod not found in: %s. Please run from a Go module root", absRootDir)
	}

	dbPath, _ := cmd.Flags().GetString("db")
	policyPath, _ := cmd.Flags().GetString("policy")
	outputPath, _ := cmd.Flags().GetString("output")
	format, _ := cmd.Flags().GetString("format")
	verbose, _ := cmd.Flags().GetBool("verbose")

	scanConfig := &scanner.ScanConfig{
		RootDir:    absRootDir,
		PolicyPath: policyPath,
		DBPath:     dbPath,
	}

	if verbose {
		fmt.Printf("Scanning directory: %s\n", absRootDir)
		fmt.Printf("Using database: %s\n", dbPath)
		if policyPath != "" {
			fmt.Printf("Using policy file: %s\n", policyPath)
		} else {
			fmt.Println("Using default policy")
		}
	}

	s, err := scanner.NewScanner(scanConfig)
	if err != nil {
		return fmt.Errorf("failed to create scanner: %w", err)
	}
	defer s.Close()

	result, err := s.Scan()
	if err != nil {
		return fmt.Errorf("scan failed: %w", err)
	}

	violations, err := s.GetStorage().GetViolations(result.ID)
	if err != nil {
		return fmt.Errorf("failed to get violations: %w", err)
	}

	printScanSummary(result, violations)

	if outputPath != "" {
		if err := exportReport(result, violations, outputPath, format); err != nil {
			return fmt.Errorf("failed to export report: %w", err)
		}
		fmt.Printf("\nReport exported to: %s\n", outputPath)
	}

	return nil
}

func printScanSummary(result *model.ScanResult, violations []model.Violation) {
	fmt.Println("\n" + "="*60)
	fmt.Println("Scan Results Summary")
	fmt.Println("=" * 60)
	fmt.Printf("Scan ID:         %d\n", result.ID)
	fmt.Printf("Repository:      %s\n", result.RepoName)
	fmt.Printf("Scan Time:       %s\n", result.ScanTime.Format("2006-01-02 15:04:05"))
	fmt.Println("-" * 60)
	fmt.Printf("Total Checks:    %d\n", result.Summary.TotalChecks)
	fmt.Printf("Passed:          %d\n", result.Summary.PassedChecks)
	fmt.Printf("Failed:          %d\n", result.Summary.FailedChecks)
	fmt.Println("-" * 60)

	if len(violations) > 0 {
		fmt.Println("\nViolations:")
		for _, v := range violations {
			severityColor := getSeverityColor(v.Severity)
			fmt.Printf("  [%s%s%s] %s\n", severityColor, v.Severity, resetColor(), v.Message)
			if v.File != "" {
				fmt.Printf("    File: %s", v.File)
				if v.Line > 0 {
					fmt.Printf(":%d", v.Line)
				}
				fmt.Println()
			}
		}
	} else {
		fmt.Println("\nNo violations found!")
	}
}

func getSeverityColor(severity string) string {
	switch severity {
	case "critical":
		return "\033[31m"
	case "high":
		return "\033[33m"
	case "medium":
		return "\033[35m"
	case "low":
		return "\033[36m"
	default:
		return ""
	}
}

func resetColor() string {
	return "\033[0m"
}

func exportReport(result *model.ScanResult, violations []model.Violation, outputPath, format string) error {
	var err error

	switch format {
	case "json":
		err = reporter.ExportJSON(result, violations, outputPath)
	case "markdown":
		fallthrough
	default:
		err = reporter.ExportMarkdown(result, violations, outputPath)
	}

	return err
}
