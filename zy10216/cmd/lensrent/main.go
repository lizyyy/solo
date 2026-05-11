package main

import (
	"fmt"
	"os"

	"lensrent/internal/cli"
)

func main() {
	c := cli.New()
	rootCmd := c.NewRootCmd()

	if err := rootCmd.Execute(); err != nil {
		fmt.Fprintf(os.Stderr, "❌ 错误: %v\n", err)
		os.Exit(1)
	}
}
