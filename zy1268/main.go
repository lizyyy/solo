package main

import (
	"fmt"
	"os"

	"go-runtime-analyzer/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		fmt.Println(err)
		os.Exit(1)
	}
}
