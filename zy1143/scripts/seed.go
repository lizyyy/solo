package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	fmt.Println("=== Seeding LocalMQ with test data ===")

	createQueue("default", "Default queue for general tasks", "fixed", 10, 300, 60)
	createQueue("emails", "Email sending queue", "exponential", 5, 60, 30)
	createQueue("notifications", "Push notifications queue", "fixed", 30, 120, 120)

	enqueue("default", "Process order #1001", 5, 0, 3, nil, `{"user_id": 123, "order_id": 1001}`)
	enqueue("default", "Generate report for Q4", 3, 0, 5, ptr("report-q4-2024"), `{"report_type": "quarterly", "year": 2024}`)
	enqueue("default", "Sync inventory", 1, 60, 3, nil, `{"source": "external_api"}`)

	enqueue("emails", "Send welcome email to user@example.com", 10, 0, 5, nil, `{"template": "welcome", "to": "user@example.com"}`)
	enqueue("emails", "Send password reset to admin@example.com", 10, 0, 3, nil, `{"template": "password_reset", "to": "admin@example.com"}`)

	enqueue("notifications", "New order alert", 5, 0, 3, nil, `{"type": "order", "sound": "ding"}`)

	fmt.Println("\n=== Seed data created successfully ===")
	fmt.Println("\nYou can now:")
	fmt.Println("  - Check stats: curl 'http://localhost:8080/api/v1/queues/stats?queue=default'")
	fmt.Println("  - Peek messages: curl 'http://localhost:8080/api/v1/messages/peek?queue=default'")
	fmt.Println("  - Reserve messages: curl -X POST http://localhost:8080/api/v1/messages/reserve -H 'Content-Type: application/json' -d '{\"queue_name\":\"default\",\"worker_id\":\"worker-1\",\"limit\":2}'")
}

func createQueue(name, desc, strategy string, retryDelay, maxDelay, visibility int) {
	fmt.Printf("Creating queue: %s... ", name)

	req := map[string]interface{}{
		"name":                        name,
		"description":                 desc,
		"retry_strategy":              strategy,
		"retry_delay_seconds":         retryDelay,
		"max_delay_seconds":           maxDelay,
		"visibility_timeout_seconds":  visibility,
	}

	body, _ := json.Marshal(req)
	resp, err := http.Post(baseURL+"/queues", "application/json", bytes.NewReader(body))
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 409 {
		fmt.Println("SKIPPED (already exists)")
	} else if resp.StatusCode == 200 {
		fmt.Println("OK")
	} else {
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		fmt.Printf("FAILED: %v\n", result)
	}
}

func enqueue(queue, body string, priority, delay, maxAttempts int, idempKey *string, metadata string) {
	fmt.Printf("Enqueuing to %s: %s... ", queue, body)

	req := map[string]interface{}{
		"queue_name":      queue,
		"body":            body,
		"priority":        priority,
		"delay_seconds":   delay,
		"max_attempts":    maxAttempts,
		"idempotency_key": idempKey,
		"metadata":        json.RawMessage(metadata),
	}

	reqBody, _ := json.Marshal(req)
	resp, err := http.Post(baseURL+"/messages/enqueue", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		fmt.Printf("FAILED: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode == 409 {
		fmt.Println("SKIPPED (idempotency key exists)")
	} else if resp.StatusCode == 200 {
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		fmt.Printf("OK (id: %v)\n", result["message_id"])
	} else {
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		fmt.Printf("FAILED: %v\n", result)
	}
}

func ptr(s string) *string {
	return &s
}
