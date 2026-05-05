package main

import (
	"fmt"
	"os"

	"github.com/zy1225/chanalyzer/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
