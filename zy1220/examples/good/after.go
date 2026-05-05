package main

import (
	"fmt"
	"os"
)

type StringProcessor struct{}

func (p *StringProcessor) Process(data []byte) error {
	fmt.Println(string(data))
	return nil
}

func processData(data []byte) *StringProcessor {
	proc := &StringProcessor{}
	proc.Process(data)
	return proc
}

func createUser(name string) User {
	return User{Name: name}
}

type User struct {
	Name string
}

func processItems(items []string) map[string]int {
	result := make(map[string]int, len(items))
	for i, item := range items {
		result[item] = i
	}
	return result
}

func collectItems(count int) []string {
	items := make([]string, 0, count)
	for i := 0; i < count; i++ {
		items = append(items, fmt.Sprintf("item-%d", i))
	}
	return items
}

func processAsync(data []byte) {
	copyData := make([]byte, len(data))
	copy(copyData, data)
	go func(d []byte) {
		fmt.Printf("Processing: %s\n", string(d))
	}(copyData)
}

func main() {
	data := []byte("hello world")
	proc := processData(data)
	fmt.Printf("Processor: %v\n", proc)

	user := createUser("test")
	fmt.Printf("User: %v\n", user)

	items := collectItems(100)
	processed := processItems(items)
	fmt.Printf("Processed %d items\n", len(processed))

	processAsync(data)

	os.Stdout.Write(data)
}
