package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

const baseURL = "http://localhost:8080/api"

type Batch struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

func main() {
	fmt.Println("=== Initializing Sample Data ===")

	batch1ID := createBatch("order-service", "v2.1.0", "灰度发布-正常情况", "engineer@example.com")
	fmt.Printf("Created batch 1 (normal): %s\n", batch1ID)

	addNormalMetrics(batch1ID)
	addNormalRules(batch1ID)

	batch2ID := createBatch("payment-service", "v1.5.0", "灰度发布-触发回滚", "sre@example.com")
	fmt.Printf("Created batch 2 (rollback case): %s\n", batch2ID)

	addRollbackMetrics(batch2ID)
	addRollbackRules(batch2ID)

	fmt.Println("\n=== Sample Data Initialized Successfully ===")
	fmt.Println("Batch 1 ID (normal case):", batch1ID)
	fmt.Println("Batch 2 ID (rollback case):", batch2ID)
}

func createBatch(name, version, desc, createdBy string) string {
	reqBody := map[string]string{
		"name":        name,
		"version":     version,
		"description": desc,
		"created_by":  createdBy,
	}

	var batch Batch
	makeRequest("POST", "/batches", reqBody, &batch)
	return batch.ID
}

func addNormalMetrics(batchID string) {
	metrics := map[string]interface{}{
		"core_metrics": []map[string]interface{}{
			{
				"name":        "error_rate",
				"metric_type": "ERROR_RATE",
				"value":       0.008,
				"baseline":    0.01,
				"raw_data":    "{\"5xx\": 8, \"total\": 1000, \"period\": \"5m\"}",
			},
			{
				"name":        "latency_p99",
				"metric_type": "LATENCY",
				"value":       180.5,
				"baseline":    150.0,
				"raw_data":    "{\"p50\": 45, \"p95\": 120, \"p99\": 180.5}",
			},
			{
				"name":        "success_rate",
				"metric_type": "SUCCESS_RATE",
				"value":       0.992,
				"baseline":    0.99,
				"raw_data":    "{\"success\": 992, \"total\": 1000}",
			},
		},
		"auxiliary_metrics": []map[string]interface{}{
			{
				"name":        "cpu_usage",
				"value":       45.2,
				"description": "Pod CPU usage percentage",
			},
			{
				"name":        "memory_usage",
				"value":       62.8,
				"description": "Pod memory usage percentage",
			},
		},
	}

	makeRequest("POST", "/batches/"+batchID+"/metrics", metrics, nil)
	fmt.Println("Added normal metrics")
}

func addNormalRules(batchID string) {
	rules := map[string]interface{}{
		"rules": []map[string]interface{}{
			{
				"metric_name":  "error_rate",
				"metric_type":  "ERROR_RATE",
				"operator":     "GT",
				"threshold":    0.02,
				"severity":     "CRITICAL",
				"description":  "Error rate exceeds 2%",
			},
			{
				"metric_name":  "latency_p99",
				"metric_type":  "LATENCY",
				"operator":     "GT",
				"threshold":    300.0,
				"severity":     "WARNING",
				"description":  "P99 latency exceeds 300ms",
			},
			{
				"metric_name":  "success_rate",
				"metric_type":  "SUCCESS_RATE",
				"operator":     "LT",
				"threshold":    0.98,
				"severity":     "CRITICAL",
				"description":  "Success rate below 98%",
			},
		},
	}

	makeRequest("POST", "/batches/"+batchID+"/rules", rules, nil)
	fmt.Println("Added normal rules")
}

func addRollbackMetrics(batchID string) {
	metrics := map[string]interface{}{
		"core_metrics": []map[string]interface{}{
			{
				"name":        "error_rate",
				"metric_type": "ERROR_RATE",
				"value":       0.055,
				"baseline":    0.01,
				"raw_data":    "{\"5xx\": 55, \"total\": 1000, \"period\": \"5m\"}",
			},
			{
				"name":        "latency_p99",
				"metric_type": "LATENCY",
				"value":       450.0,
				"baseline":    150.0,
				"raw_data":    "{\"p50\": 120, \"p95\": 350, \"p99\": 450}",
			},
			{
				"name":        "success_rate",
				"metric_type": "SUCCESS_RATE",
				"value":       0.945,
				"baseline":    0.99,
				"raw_data":    "{\"success\": 945, \"total\": 1000}",
			},
		},
		"auxiliary_metrics": []map[string]interface{}{
			{
				"name":        "cpu_usage",
				"value":       88.5,
				"description": "Pod CPU usage percentage",
			},
		},
	}

	makeRequest("POST", "/batches/"+batchID+"/metrics", metrics, nil)
	fmt.Println("Added rollback metrics")
}

func addRollbackRules(batchID string) {
	rules := map[string]interface{}{
		"rules": []map[string]interface{}{
			{
				"metric_name":  "error_rate",
				"metric_type":  "ERROR_RATE",
				"operator":     "GT",
				"threshold":    0.02,
				"severity":     "CRITICAL",
				"description":  "Error rate exceeds 2%",
			},
			{
				"metric_name":  "latency_p99",
				"metric_type":  "LATENCY",
				"operator":     "GT",
				"threshold":    300.0,
				"severity":     "WARNING",
				"description":  "P99 latency exceeds 300ms",
			},
			{
				"metric_name":  "success_rate",
				"metric_type":  "SUCCESS_RATE",
				"operator":     "LT",
				"threshold":    0.98,
				"severity":     "CRITICAL",
				"description":  "Success rate below 98%",
			},
		},
	}

	makeRequest("POST", "/batches/"+batchID+"/rules", rules, nil)
	fmt.Println("Added rollback rules")
}

func makeRequest(method, path string, body interface{}, result interface{}) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, _ := json.Marshal(body)
		reqBody = bytes.NewBuffer(jsonBody)
	}

	req, _ := http.NewRequest(method, baseURL+path, reqBody)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("Request failed: %v\n", err)
		return
	}
	defer resp.Body.Close()

	if result != nil {
		json.NewDecoder(resp.Body).Decode(result)
	}
}
