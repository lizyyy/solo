package main

import (
	"fmt"
	"io"
	"os"
)

type Processor interface {
	Process(data []byte) error
}

type StringProcessor struct{}

func (p *StringProcessor) Process(data []byte) error {
	fmt.Println(string(data))
	return nil
}

func processData(data []byte) Processor {
	proc := &StringProcessor{}
	proc.Process(data)
	return proc
}

func createUser(name string) *User {
	user := &User{Name: name}
	return user
}

type User struct {
	Name string
}

func processItems(items []string) map[string]int {
	result := make(map[string]int)
	for i, item := range items {
		result[item] = i
	}
	return result
}

func collectItems(count int) []string {
	var items []string
	for i := 0; i < count; i++ {
		items = append(items, fmt.Sprintf("item-%d", i))
	}
	return items
}

func processAsync(data []byte) {
	go func() {
		fmt.Printf("Processing: %s\n", string(data))
	}()
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

	var w io.Writer = os.Stdout
	w.Write(data)
}
