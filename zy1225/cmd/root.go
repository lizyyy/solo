package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	rootCmd = &cobra.Command{
		Use:   "chanalyzer",
		Short: "Go Channel Deadlock & Throughput Analyzer",
		Long: `A CLI tool to analyze Go channel operations, simulate execution,
and detect deadlocks, goroutine leaks, and throughput issues.

Key features:
- init: Initialize project structure with sample files
- replay: Replay channel operations from event logs
- analyze: Analyze for deadlocks, leaks, and provide fix suggestions
- export: Export analysis reports in Markdown or JSON format`,
		PersistentPreRun: func(cmd *cobra.Command, args []string) {
			viper.SetConfigName("chanalyzer")
			viper.SetConfigType("yaml")
			viper.AddConfigPath(".")
			viper.AutomaticEnv()

			if err := viper.ReadInConfig(); err != nil {
				if _, ok := err.(viper.ConfigFileNotFoundError); ok {
				} else {
					fmt.Fprintf(os.Stderr, "Error reading config: %v\n", err)
					os.Exit(1)
				}
			}
		},
	}
)

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringP("db", "d", "chanalyzer.db", "SQLite database file path")
	rootCmd.PersistentFlags().StringP("config", "c", "", "Config file path")
	viper.BindPFlag("db", rootCmd.PersistentFlags().Lookup("db"))
	viper.BindPFlag("config", rootCmd.PersistentFlags().Lookup("config"))
}
