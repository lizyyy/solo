package commands

import (
	"github.com/spf13/cobra"
)

// InitCmd 返回 init 命令
func InitCmd() *cobra.Command {
	return initCmd
}

// AnalyzeCmd 返回 analyze 命令
func AnalyzeCmd() *cobra.Command {
	return analyzeCmd
}

// CompareCmd 返回 compare 命令
func CompareCmd() *cobra.Command {
	return compareCmd
}

// ExportCmd 返回 export 命令
func ExportCmd() *cobra.Command {
	return exportCmd
}
