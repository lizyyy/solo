package chaos

import (
	"encoding/json"
	"testing"
	"time"
)

func TestChaosExperimentJSONTags(t *testing.T) {
	exp := &ChaosExperiment{
		ID:            "exp-123",
		Name:          "Test Experiment",
		Type:          ChaosTypeHighConcurrency,
		Status:        ChaosStatusRunning,
		TotalRequests: 100,
		ErrorCount:    5,
		SuccessCount:  95,
	}

	data, err := json.Marshal(exp)
	if err != nil {
		t.Fatalf("Failed to marshal experiment: %v", err)
	}

	var m map[string]interface{}
	if err := json.Unmarshal(data, &m); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	expectedFields := map[string]bool{
		"id":             true,
		"name":           true,
		"type":           true,
		"status":         true,
		"total_requests": true,
		"error_count":    true,
		"success_count":  true,
	}

	for field := range expectedFields {
		if _, ok := m[field]; !ok {
			t.Errorf("Missing expected JSON field: %s", field)
		}
	}

	if m["id"] != "exp-123" {
		t.Errorf("Expected id = exp-123, got %v", m["id"])
	}
	if m["total_requests"] != float64(100) {
		t.Errorf("Expected total_requests = 100, got %v", m["total_requests"])
	}
	if m["error_count"] != float64(5) {
		t.Errorf("Expected error_count = 5, got %v", m["error_count"])
	}
	if m["status"] != "running" {
		t.Errorf("Expected status = running, got %v", m["status"])
	}
}

func TestChaosExperimentUnmarshal(t *testing.T) {
	jsonStr := `{
		"id": "exp-456",
		"name": "Test Unmarshal",
		"type": "high_concurrency",
		"status": "completed",
		"total_requests": 200,
		"error_count": 10,
		"success_count": 190,
		"config": {
			"duration": "60s",
			"concurrent_users": 50
		}
	}`

	var exp ChaosExperiment
	if err := json.Unmarshal([]byte(jsonStr), &exp); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	if exp.ID != "exp-456" {
		t.Errorf("Expected ID = exp-456, got %s", exp.ID)
	}
	if exp.Name != "Test Unmarshal" {
		t.Errorf("Expected Name = Test Unmarshal, got %s", exp.Name)
	}
	if exp.Status != ChaosStatusCompleted {
		t.Errorf("Expected Status = completed, got %v", exp.Status)
	}
	if exp.TotalRequests != 200 {
		t.Errorf("Expected TotalRequests = 200, got %d", exp.TotalRequests)
	}
	if exp.ErrorCount != 10 {
		t.Errorf("Expected ErrorCount = 10, got %d", exp.ErrorCount)
	}
	if exp.SuccessCount != 190 {
		t.Errorf("Expected SuccessCount = 190, got %d", exp.SuccessCount)
	}
	if exp.Config.Duration.Duration() != 60*time.Second {
		t.Errorf("Expected Duration = 60s, got %v", exp.Config.Duration.Duration())
	}
	if exp.Config.ConcurrentUsers != 50 {
		t.Errorf("Expected ConcurrentUsers = 50, got %d", exp.Config.ConcurrentUsers)
	}
}
