package commands

import (
	"fmt"

	"go-policy-scanner/internal/reporter"
	"go-policy-scanner/internal/storage"

	"github.com/spf13/cobra"
)

var exportCmd = &cobra.Command{
	Use:   "export <scan-id>",
	Short: "导出扫描报告",
	Long: `导出指定扫描结果的详细报告。

示例:
  go-policy-scanner export 1
  go-policy-scanner export --output report.md --format markdown 1
  go-policy-scanner export --output report.json --format json 1`,
	Args: cobra.ExactArgs(1),
	RunE: runExport,
}

func init() {
	rootCmd.AddCommand(exportCmd)
	exportCmd.Flags().StringP("output", "o", "", "输出报告文件路径 (默认: stdout)")
	exportCmd.Flags().StringP("format", "f", "markdown", "输出格式: markdown|json")
}

func runExport(cmd *cobra.Command, args []string) error {
	dbPath, _ := cmd.Flags().GetString("db")
	outputPath, _ := cmd.Flags().GetString("output")
	format, _ := cmd.Flags().GetString("format")
	verbose, _ := cmd.Flags().GetBool("verbose")

	var scanID int64
	fmt.Sscanf(args[0], "%d", &scanID)

	if verbose {
		fmt.Printf("Exporting scan %d\n", scanID)
		fmt.Printf("Using database: %s\n", dbPath)
		if outputPath != "" {
			fmt.Printf("Output file: %s\n", outputPath)
		} else {
			fmt.Printf("Output format: %s\n", format)
		}
	}

	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer store.Close()

	result, err := store.GetScanResult(scanID)
	if err != nil {
		return fmt.Errorf("failed to get scan result: %w", err)
	}

	violations, err := store.GetViolations(scanID)
	if err != nil {
		return fmt.Errorf("failed to get violations: %w", err)
	}

	if outputPath != "" {
		if err := exportReport(result, violations, outputPath, format); err != nil {
			return fmt.Errorf("failed to export report: %w", err)
		}
		fmt.Printf("Report exported to: %s\n", outputPath)
	} else {
		if format == "json" {
			jsonStr, err := reporter.GenerateJSON(result, violations)
			if err != nil {
				return fmt.Errorf("failed to generate JSON: %w", err)
			}
			fmt.Println(jsonStr)
		} else {
			mdStr, err := reporter.GenerateMarkdown(result, violations)
			if err != nil {
				return fmt.Errorf("failed to generate Markdown: %w", err)
			}
			fmt.Println(mdStr)
		}
	}

	return nil
}
