package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"read-write-split-api/internal/model"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	fmt.Println("=== Read-Write Split API Demo Data Setup ===")
	fmt.Println()

	time.Sleep(2 * time.Second)

	fmt.Println("1. Creating demo strategies...")
	createDemoStrategies()
	fmt.Println()

	fmt.Println("2. Simulating normal requests...")
	simulateNormalRequests()
	fmt.Println()

	fmt.Println("3. Simulating abnormal/mismatched requests...")
	simulateAbnormalRequests()
	fmt.Println()

	fmt.Println("4. Simulating duplicate requests...")
	simulateDuplicateRequests()
	fmt.Println()

	fmt.Println("5. Simulating manual correction workflow...")
	simulateManualCorrection()
	fmt.Println()

	fmt.Println("6. Generating report...")
	generateReport()
	fmt.Println()

	fmt.Println("=== Demo Data Setup Complete ===")
	fmt.Println()
	fmt.Println("Key Intercepted Path: /api/v1/orders (POST method with action=create)")
	fmt.Println("This path will be matched and routed to writer role.")
}

func createDemoStrategies() {
	strategies := []model.CreateStrategyRequest{
		{
			Path:          "/api/v1/users",
			Method:        "GET",
			QueryParams:   map[string]string{},
			OperationType: "read",
			DBRole:        "reader",
			Description:   "User list query - read only",
			Priority:      10,
		},
		{
			Path:          "/api/v1/orders",
			Method:        "POST",
			QueryParams:   map[string]string{"action": "create"},
			OperationType: "write",
			DBRole:        "writer",
			Description:   "Order creation - write operation",
			Priority:      20,
		},
		{
			Path:          "/api/v1/products",
			Method:        "GET",
			QueryParams:   map[string]string{},
			OperationType: "read",
			DBRole:        "reader",
			Description:   "Product query - read only",
			Priority:      10,
		},
		{
			Path:          "/api/v1/admin",
			Method:        "POST",
			QueryParams:   map[string]string{},
			OperationType: "write",
			DBRole:        "admin_writer",
			Description:   "Admin operations - write with elevated role",
			Priority:      30,
		},
	}

	for i, strategy := range strategies {
		body, _ := json.Marshal(strategy)
		resp, err := http.Post(baseURL+"/strategies", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  Strategy %d failed: %v\n", i+1, err)
			continue
		}
		defer resp.Body.Close()

		if resp.StatusCode == http.StatusCreated || resp.StatusCode == http.StatusConflict {
			fmt.Printf("  Strategy %d: %s %s - OK\n", i+1, strategy.Method, strategy.Path)
		} else {
			fmt.Printf("  Strategy %d: Status %d\n", i+1, resp.StatusCode)
		}
	}
}

func simulateNormalRequests() {
	requests := []model.ProcessRequest{
		{
			Path:        "/api/v1/users",
			Method:      "GET",
			QueryParams: map[string]string{},
		},
		{
			Path:        "/api/v1/products",
			Method:      "GET",
			QueryParams: map[string]string{"category": "electronics"},
		},
		{
			Path:        "/api/v1/orders",
			Method:      "POST",
			QueryParams: map[string]string{"action": "create"},
		},
	}

	for i, req := range requests {
		body, _ := json.Marshal(req)
		resp, err := http.Post(baseURL+"/process", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  Request %d failed: %v\n", i+1, err)
			continue
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(respBody, &result)

		if data, ok := result["data"].(map[string]interface{}); ok {
			matched := data["matched"].(bool)
			dbRole := data["db_role"].(string)
			fmt.Printf("  Request %d: %s %s - matched=%v, role=%s\n", i+1, req.Method, req.Path, matched, dbRole)
		}
	}
}

func simulateAbnormalRequests() {
	requests := []model.ProcessRequest{
		{
			Path:        "/api/v1/unknown",
			Method:      "GET",
			QueryParams: map[string]string{},
		},
		{
			Path:        "/api/v1/orders",
			Method:      "POST",
			QueryParams: map[string]string{"action": "update"},
		},
		{
			Path:        "/api/v1/users",
			Method:      "POST",
			QueryParams: map[string]string{},
		},
	}

	for i, req := range requests {
		body, _ := json.Marshal(req)
		resp, err := http.Post(baseURL+"/process", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  Request %d failed: %v\n", i+1, err)
			continue
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(respBody, &result)

		if data, ok := result["data"].(map[string]interface{}); ok {
			matched := data["matched"].(bool)
			dbRole := data["db_role"].(string)
			needCorrection := data["need_correction"].(bool)
			fmt.Printf("  Request %d: %s %s - matched=%v, role=%s, need_correction=%v\n", i+1, req.Method, req.Path, matched, dbRole, needCorrection)
		}
	}
}

func simulateDuplicateRequests() {
	req := model.ProcessRequest{
		Path:        "/api/v1/orders",
		Method:      "POST",
		QueryParams: map[string]string{"action": "create"},
		RequestID:   "req_duplicate_test_001",
	}

	for i := 0; i < 3; i++ {
		body, _ := json.Marshal(req)
		resp, err := http.Post(baseURL+"/process", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  Duplicate attempt %d failed: %v\n", i+1, err)
			continue
		}
		defer resp.Body.Close()

		respBody, _ := io.ReadAll(resp.Body)
		var result map[string]interface{}
		json.Unmarshal(respBody, &result)

		msg := result["message"].(string)
		fmt.Printf("  Attempt %d: %s\n", i+1, msg)
	}
}

func simulateManualCorrection() {
	req := model.ProcessRequest{
		Path:        "/api/v1/orders",
		Method:      "POST",
		QueryParams: map[string]string{"action": "create"},
	}
	body, _ := json.Marshal(req)
	resp, err := http.Post(baseURL+"/process", "application/json", bytes.NewBuffer(body))
	if err != nil {
		fmt.Printf("  Failed to create record: %v\n", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)

	data := result["data"].(map[string]interface{})
	recordID := data["hit_record_id"].(string)
	fmt.Printf("  Created record: %s\n", recordID)

	correctionReq := map[string]interface{}{
		"action": "adjust",
		"note":   "Manual correction: This request should have been routed to reader role for validation first",
		"user_id": "admin_001",
	}
	correctionBody, _ := json.Marshal(correctionReq)

	httpReq, _ := http.NewRequest("PUT", baseURL+"/records/"+recordID+"/correction", bytes.NewBuffer(correctionBody))
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("X-User-ID", "admin_001")

	client := &http.Client{}
	resp2, err := client.Do(httpReq)
	if err != nil {
		fmt.Printf("  Correction failed: %v\n", err)
		return
	}
	defer resp2.Body.Close()

	if resp2.StatusCode == http.StatusOK {
		fmt.Printf("  Applied manual correction to record: %s\n", recordID)
	} else {
		fmt.Printf("  Correction status: %d\n", resp2.StatusCode)
	}

	advanceReq := map[string]interface{}{
		"status":  "incorrect",
		"user_id": "admin_001",
		"note":    "Marked as incorrect after review",
	}
	advanceBody, _ := json.Marshal(advanceReq)

	httpReq2, _ := http.NewRequest("PUT", baseURL+"/records/"+recordID+"/status", bytes.NewBuffer(advanceBody))
	httpReq2.Header.Set("Content-Type", "application/json")

	resp3, err := client.Do(httpReq2)
	if err != nil {
		fmt.Printf("  Status advance failed: %v\n", err)
		return
	}
	defer resp3.Body.Close()

	if resp3.StatusCode == http.StatusOK {
		fmt.Printf("  Advanced status to: incorrect\n")
	}
}

func generateReport() {
	resp, err := http.Get(baseURL + "/report")
	if err != nil {
		fmt.Printf("  Failed to generate report: %v\n", err)
		return
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	var result map[string]interface{}
	json.Unmarshal(respBody, &result)

	data := result["data"].(map[string]interface{})
	fmt.Printf("  Total Hits: %.0f\n", data["total_hits"].(float64))
	fmt.Printf("  Correct Hits: %.0f\n", data["correct_hits"].(float64))
	fmt.Printf("  Incorrect Hits: %.0f\n", data["incorrect_hits"].(float64))
	fmt.Printf("  Pending Hits: %.0f\n", data["pending_hits"].(float64))
	fmt.Printf("  Accuracy Rate: %.2f%%\n", data["accuracy_rate"].(float64))
}
