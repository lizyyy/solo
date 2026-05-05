package cmd

import (
	"fmt"
	"os"

	"gcinsight/errors"

	"github.com/spf13/cobra"
)

var (
	rootCmd = &cobra.Command{
		Use:   "gcinsight",
		Short: "Go GC 问题复盘工具",
		Long:  `GCInsight 是一个专门帮助 Go 后端同学复盘 GC 问题的本地命令行工具。`,
	}
)

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.CompletionOptions.DisableDefaultCmd = true
}

func exitWithError(message string, err error) {
	if err != nil {
		fmt.Fprintln(os.Stderr, errors.FormatParseError(err))
	} else {
		fmt.Fprintf(os.Stderr, "Error: %s\n", message)
	}
	os.Exit(1)
}