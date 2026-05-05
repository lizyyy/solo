package main

import (
	"log"
	"os"

	"go-policy-scanner/cmd/commands"
)

func main() {
	if err := commands.Execute(); err != nil {
		log.Println(err)
		os.Exit(1)
	}
}
