package cmd

import (
	"github.com/spf13/cobra"
)

var rootCmd = &cobra.Command{
	Use:   "pcheck",
	Short: "JSON to Protobuf/MessagePack migration checker",
	Long: `A CLI tool for evaluating risks and performance when migrating 
from JSON to Protobuf or MessagePack for API responses and message queue payloads.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringP("output", "o", "", "Output file path (default: stdout)")
	rootCmd.PersistentFlags().StringP("format", "f", "json", "Output format: json, markdown, csv")
}
