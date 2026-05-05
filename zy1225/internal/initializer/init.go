package initializer

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

type ProjectInitializer struct {
	TargetDir string
}

func NewProjectInitializer(targetDir string) *ProjectInitializer {
	return &ProjectInitializer{
		TargetDir: targetDir,
	}
}

func (i *ProjectInitializer) Initialize() error {
	fmt.Printf("Initializing chanalyzer project in: %s\n", i.TargetDir)

	dirs := []string{
		"snippets",
		"reports",
	}

	for _, dir := range dirs {
		dirPath := filepath.Join(i.TargetDir, dir)
		if err := os.MkdirAll(dirPath, 0755); err != nil {
			return fmt.Errorf("failed to create directory %s: %w", dirPath, err)
		}
		fmt.Printf("Created directory: %s\n", dirPath)
	}

	if err := i.createChannelCasesYAML(); err != nil {
		return err
	}

	if err := i.createEventsJSONL(); err != nil {
		return err
	}

	if err := i.createGoSnippets(); err != nil {
		return err
	}

	fmt.Println("\nProject initialized successfully!")
	fmt.Println("\nNext steps:")
	fmt.Println("  1. Review and modify channel-cases.yaml to define your channel scenarios")
	fmt.Println("  2. Use 'chanalyzer replay' to replay the events")
	fmt.Println("  3. Use 'chanalyzer analyze' to detect deadlocks and leaks")
	fmt.Println("  4. Use 'chanalyzer export' to generate reports")

	return nil
}

func (i *ProjectInitializer) createChannelCasesYAML() error {
	filePath := filepath.Join(i.TargetDir, "channel-cases.yaml")

	cases := map[string]interface{}{
		"cases": []map[string]interface{}{
			{
				"id":          "unbuffered-deadlock",
				"name":        "Unbuffered Channel Deadlock",
				"description": "A classic deadlock where main goroutine sends on unbuffered channel without receiver",
				"category":    "deadlock",
				"difficulty":  "beginner",
				"tags":        []string{"unbuffered", "deadlock", "beginner"},
				"channels": []map[string]interface{}{
					{
						"id":          "ch1",
						"name":        "main channel",
						"buffer_size": 0,
						"is_nil":      false,
					},
				},
				"goroutines": []map[string]interface{}{
					{
						"id":   "g1",
						"name": "main",
						"role": "sender",
					},
				},
				"steps": []map[string]interface{}{
					{
						"step":      1,
						"action":    "send",
						"goroutine": "g1",
						"channel":   "ch1",
						"value":     42,
						"comment":   "Main tries to send on unbuffered channel - will block forever",
					},
				},
				"expected": map[string]interface{}{
					"deadlock":            true,
					"blocked_goroutines":  []string{"g1"},
					"final_channels": map[string]interface{}{
						"ch1": map[string]interface{}{
							"state":      "active",
							"buffer_len": 0,
							"sendq_len":  1,
							"recvq_len":  0,
						},
					},
				},
				"hints": []string{
					"Unbuffered channels require both sender and receiver to be ready at the same time",
					"The send operation blocks until someone receives",
				},
				"solution": "Start a goroutine to receive before sending, or use a buffered channel",
			},
			{
				"id":          "nil-channel-send",
				"name":        "Nil Channel Send",
				"description": "Sending to a nil channel blocks forever",
				"category":    "deadlock",
				"difficulty":  "intermediate",
				"tags":        []string{"nil-channel", "deadlock", "intermediate"},
				"channels": []map[string]interface{}{
					{
						"id":          "ch1",
						"name":        "nil channel",
						"buffer_size": 0,
						"is_nil":      true,
					},
				},
				"goroutines": []map[string]interface{}{
					{
						"id":   "g1",
						"name": "main",
						"role": "sender",
					},
				},
				"steps": []map[string]interface{}{
					{
						"step":      1,
						"action":    "send",
						"goroutine": "g1",
						"channel":   "ch1",
						"value":     "hello",
						"comment":   "Sending to nil channel - blocks forever",
					},
				},
				"expected": map[string]interface{}{
					"deadlock":           true,
					"blocked_goroutines": []string{"g1"},
					"errors": []map[string]interface{}{
						{
							"type":    "nil_channel_operation",
							"message": "Send operation on nil channel blocks permanently",
							"step":    1,
						},
					},
				},
				"hints": []string{
					"Always initialize channels before use",
					"A nil channel is not the same as an empty channel",
				},
				"solution": "Initialize the channel with make() before using it",
			},
			{
				"id":          "closed-channel-send",
				"name":        "Send on Closed Channel",
				"description": "Sending to a closed channel causes a panic",
				"category":    "panic",
				"difficulty":  "intermediate",
				"tags":        []string{"closed-channel", "panic", "intermediate"},
				"channels": []map[string]interface{}{
					{
						"id":          "ch1",
						"name":        "data channel",
						"buffer_size": 2,
						"is_nil":      false,
					},
				},
				"goroutines": []map[string]interface{}{
					{
						"id":   "g1",
						"name": "main",
						"role": "sender",
					},
				},
				"steps": []map[string]interface{}{
					{
						"step":      1,
						"action":    "close",
						"goroutine": "g1",
						"channel":   "ch1",
						"comment":   "Close the channel first",
					},
					{
						"step":      2,
						"action":    "send",
						"goroutine": "g1",
						"channel":   "ch1",
						"value":     100,
						"comment":   "Try to send after close - will panic",
					},
				},
				"expected": map[string]interface{}{
					"deadlock": false,
					"errors": []map[string]interface{}{
						{
							"type":    "closed_channel_send",
							"message": "Send on closed channel causes panic",
							"step":    2,
						},
					},
				},
				"hints": []string{
					"Only the sender should close a channel",
					"Use the comma-ok idiom to check if a channel is closed",
				},
				"solution": "Never send on a closed channel. Use sync patterns to coordinate sender/receiver lifecycle",
			},
			{
				"id":          "select-with-timeout",
				"name":        "Select with Timeout",
				"description": "Using select with time.After to prevent blocking",
				"category":    "timeout",
				"difficulty":  "intermediate",
				"tags":        []string{"select", "timeout", "intermediate"},
				"channels": []map[string]interface{}{
					{
						"id":          "ch1",
						"name":        "data channel",
						"buffer_size": 0,
						"is_nil":      false,
					},
				},
				"goroutines": []map[string]interface{}{
					{
						"id":   "g1",
						"name": "main",
						"role": "receiver",
					},
				},
				"steps": []map[string]interface{}{
					{
						"step":   1,
						"action": "select",
						"goroutine": "g1",
						"select_case": []map[string]interface{}{
							{
								"type":      "recv",
								"channel":   "ch1",
								"direction": "recv",
								"description": "Receive from ch1",
							},
							{
								"type":      "timeout",
								"is_default": false,
								"description": "Timeout case",
							},
						},
						"timeout": "1s",
						"comment": "Select with timeout - timeout case will be selected",
					},
				},
				"expected": map[string]interface{}{
					"deadlock":           false,
					"blocked_goroutines": []string{},
				},
				"hints": []string{
					"time.After creates a channel that sends after the duration",
					"Select picks the first ready case randomly if multiple are ready",
				},
				"solution": "Use select with time.After to prevent indefinite blocking",
			},
			{
				"id":          "goroutine-leak",
				"name":        "Goroutine Leak",
				"description": "A goroutine blocked on channel that never gets unblocked",
				"category":    "leak",
				"difficulty":  "advanced",
				"tags":        []string{"goroutine-leak", "advanced", "memory"},
				"channels": []map[string]interface{}{
					{
						"id":          "ch1",
						"name":        "work channel",
						"buffer_size": 0,
						"is_nil":      false,
					},
					{
						"id":          "done",
						"name":        "done signal",
						"buffer_size": 0,
						"is_nil":      false,
					},
				},
				"goroutines": []map[string]interface{}{
					{
						"id":   "g1",
						"name": "worker",
						"role": "receiver",
					},
					{
						"id":   "g2",
						"name": "main",
						"role": "controller",
					},
				},
				"steps": []map[string]interface{}{
					{
						"step":      1,
						"action":    "recv",
						"goroutine": "g1",
						"channel":   "ch1",
						"comment":   "Worker waits for work - will block",
					},
					{
						"step":      2,
						"action":    "close",
						"goroutine": "g2",
						"channel":   "done",
						"comment":   "Main closes done channel but worker is waiting on ch1",
					},
				},
				"expected": map[string]interface{}{
					"deadlock":           false,
					"blocked_goroutines": []string{"g1"},
					"final_channels": map[string]interface{}{
						"ch1": map[string]interface{}{
							"state":      "active",
							"buffer_len": 0,
							"sendq_len":  0,
							"recvq_len":  1,
						},
					},
				},
				"hints": []string{
					"The worker is blocked on ch1 but main only signals on done channel",
					"Use context or done channel pattern properly",
				},
				"solution": "Use select with done channel in worker to receive cancellation signal",
			},
		},
	}

	data, err := yaml.Marshal(cases)
	if err != nil {
		return fmt.Errorf("failed to marshal cases: %w", err)
	}

	if err := os.WriteFile(filePath, data, 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", filePath, err)
	}

	fmt.Printf("Created file: %s\n", filePath)
	return nil
}

func (i *ProjectInitializer) createEventsJSONL() error {
	filePath := filepath.Join(i.TargetDir, "events.jsonl")

	events := []string{
		`{"id":"evt_1","type":"channel_create","timestamp":"2024-01-15T10:00:00Z","channel_id":"ch1","metadata":{"buffer_size":0,"is_buffered":false}}`,
		`{"id":"evt_2","type":"goroutine_start","timestamp":"2024-01-15T10:00:01Z","goroutine":"g1"}`,
		`{"id":"evt_3","type":"send","timestamp":"2024-01-15T10:00:02Z","channel_id":"ch1","goroutine":"g1","value":42,"metadata":{"blocked":true}}`,
		`{"id":"evt_4","type":"block","timestamp":"2024-01-15T10:00:02Z","goroutine":"g1","metadata":{"block_reason":"send_on_unbuffered_no_receiver"}}`,
		`{"id":"evt_5","type":"deadlock","timestamp":"2024-01-15T10:00:05Z","metadata":{"description":"All goroutines are asleep - deadlock!"}}`,
	}

	content := ""
	for _, e := range events {
		content += e + "\n"
	}

	if err := os.WriteFile(filePath, []byte(content), 0644); err != nil {
		return fmt.Errorf("failed to write %s: %w", filePath, err)
	}

	fmt.Printf("Created file: %s\n", filePath)
	return nil
}

func (i *ProjectInitializer) createGoSnippets() error {
	snippets := []struct {
		name    string
		content string
	}{
		{
			name: "01_unbuffered_deadlock.go",
			content: `package main

// Problem: Classic deadlock with unbuffered channel
// Main goroutine sends on channel but there's no receiver
func main() {
	ch := make(chan int) // unbuffered channel

	// Deadlock: send blocks forever because no receiver is ready
	ch <- 42

	// This line is never reached
	val := <-ch
	println(val)
}
`,
		},
		{
			name: "02_nil_channel.go",
			content: `package main

// Problem: Nil channel operations block forever
// A nil channel is not the same as an uninitialized channel
func main() {
	var ch chan int // nil channel

	// Sending to nil channel blocks forever
	// ch <- 42

	// Receiving from nil channel also blocks forever
	// val := <-ch

	// Closing nil channel causes panic
	// close(ch)

	// Solution: Always initialize channels with make()
	ch = make(chan int, 1) // buffered channel
	ch <- 42
	val := <-ch
	println(val)
}
`,
		},
		{
			name: "03_closed_channel.go",
			content: `package main

// Problem: Operations on closed channels
// - Send on closed channel: panic
// - Receive from closed channel: returns zero value immediately
// - Close closed channel: panic
func main() {
	ch := make(chan int, 2)

	ch <- 1
	ch <- 2
	close(ch)

	// Receiving from closed channel works
	val1 := <-ch
	println("Received:", val1)

	val2 := <-ch
	println("Received:", val2)

	// Comma-ok idiom to check if channel is closed
	val3, ok := <-ch
	println("Received:", val3, "ok:", ok) // ok is false

	// Danger zone:
	// close(ch)      // PANIC: close of closed channel
	// ch <- 3         // PANIC: send on closed channel
}
`,
		},
		{
			name: "04_select_timeout.go",
			content: `package main

import (
	"fmt"
	"time"
)

// Solution: Using select with timeout to prevent blocking
func main() {
	ch := make(chan int)

	select {
	case val := <-ch:
		fmt.Println("Received:", val)
	case <-time.After(1 * time.Second):
		fmt.Println("Timeout: no value received")
	}

	// Multiple channels with select
	ch1 := make(chan string, 1)
	ch2 := make(chan string, 1)

	ch1 <- "from ch1"
	ch2 <- "from ch2"

	// Select picks one randomly when multiple cases are ready
	select {
	case msg := <-ch1:
		fmt.Println("Got:", msg)
	case msg := <-ch2:
		fmt.Println("Got:", msg)
	}
}
`,
		},
		{
			name: "05_goroutine_leak.go",
			content: `package main

import (
	"fmt"
	"time"
)

// Problem: Goroutine leak - worker blocked on channel that's never used
func badWorker(ch <-chan int, done <-chan struct{}) {
	// This worker only listens on ch, not on done
	// If main exits without sending on ch, this goroutine leaks
	val := <-ch
	fmt.Println("Worker received:", val)
}

// Solution: Use select with done channel to allow cancellation
func goodWorker(ch <-chan int, done <-chan struct{}) {
	select {
	case val := <-ch:
		fmt.Println("Worker received:", val)
	case <-done:
		fmt.Println("Worker cancelled")
		return
	}
}

func main() {
	ch := make(chan int)
	done := make(chan struct{})

	// Start the good worker
	go goodWorker(ch, done)

	// Simulate some work
	time.Sleep(100 * time.Millisecond)

	// Cancel the worker instead of sending on ch
	close(done)

	// Give worker time to exit
	time.Sleep(100 * time.Millisecond)
	fmt.Println("Main done")
}
`,
		},
	}

	for _, s := range snippets {
		filePath := filepath.Join(i.TargetDir, "snippets", s.name)
		if err := os.WriteFile(filePath, []byte(s.content), 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", filePath, err)
		}
		fmt.Printf("Created file: %s\n", filePath)
	}

	return nil
}
