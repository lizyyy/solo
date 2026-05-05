package cmd

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
	"github.com/zy1225/chanalyzer/internal/initializer"
)

var initCmd = &cobra.Command{
	Use:   "init",
	Short: "Initialize a new chanalyzer project",
	Long: `Initialize a new chanalyzer project with sample files.

This command creates the following structure:
- channel-cases.yaml: Sample channel operation scenarios
- events.jsonl: Sample event log file
- snippets/: Sample Go code snippets demonstrating channel issues
- reports/: Directory for generated reports

Examples:
  # Initialize in current directory
  chanalyzer init

  # Initialize in a specific directory
  chanalyzer init --dir ./my-project`,
	RunE: runInit,
}

var initDir string

func init() {
	initCmd.Flags().StringVarP(&initDir, "dir", "d", "", "Directory to initialize (default: current directory)")
	rootCmd.AddCommand(initCmd)
}

func runInit(cmd *cobra.Command, args []string) error {
	targetDir := initDir
	if targetDir == "" {
		var err error
		targetDir, err = os.Getwd()
		if err != nil {
			return fmt.Errorf("failed to get current directory: %w", err)
		}
	}

	absDir, err := filepath.Abs(targetDir)
	if err != nil {
		return fmt.Errorf("failed to get absolute path: %w", err)
	}

	if err := os.MkdirAll(absDir, 0755); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", absDir, err)
	}

	initializer := initializer.NewProjectInitializer(absDir)
	if err := initializer.Initialize(); err != nil {
		return fmt.Errorf("initialization failed: %w", err)
	}

	return nil
}
