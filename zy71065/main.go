package main

import (
	"os"

	"proto-enum-lint/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
