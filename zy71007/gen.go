package main

import (
	"os"
)

func main() {
	os.WriteFile("test1.txt", []byte("test content"), 0644)
	println("OK")
}
