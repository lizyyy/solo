package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

type TestCase struct {
	Name     string
	TestFunc func() error
}

func main() {
	fmt.Println("=== Push Token Lifecycle API Self-Check ===")
	fmt.Println()

	time.Sleep(2 * time.Second)

	tests := []TestCase{
		{"Health Check", testHealthCheck},
		{"Normal Flow - Bind Token", testBindToken},
		{"Normal Flow - Record Success Push", testRecordSuccessPush},
		{"Normal Flow - Record Failure Push (Invalid Token)", testRecordFailurePush},
		{"Token Rebind (Device Change)", testTokenRebindDeviceChange},
		{"Token Rebind (User Change)", testTokenRebindUserChange},
		{"Unsubscribe Flow", testUnsubscribe},
		{"Manual Correction", testManualCorrection},
		{"Generate Lifecycle Report", testGenerateReport},
		{"Dirty Data - Empty Request", testDirtyDataEmpty},
		{"Dirty Data - Invalid Token", testDirtyDataInvalidToken},
		{"Duplicate Bind Request", testDuplicateBind},
	}

	passed := 0
	failed := 0

	for _, test := range tests {
		fmt.Printf("Testing: %s... ", test.Name)
		err := test.TestFunc()
		if err != nil {
			fmt.Printf("FAILED\n  Error: %v\n", err)
			failed++
		} else {
			fmt.Println("PASSED")
			passed++
		}
		time.Sleep(100 * time.Millisecond)
	}

	fmt.Println()
	fmt.Println("=== Summary ===")
	fmt.Printf("Passed: %d\n", passed)
	fmt.Printf("Failed: %d\n", failed)
	fmt.Printf("Total:  %d\n", len(tests))

	if failed > 0 {
		fmt.Println("\n❌ Some tests failed!")
	} else {
		fmt.Println("\n✅ All tests passed!")
	}
}

func testHealthCheck() error {
	resp, err := http.Get("http://localhost:8080/health")
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status 200, got %d", resp.StatusCode)
	}
	return nil
}

var testToken = "test_token_" + fmt.Sprintf("%d", time.Now().Unix())
var testTokenID string

func testBindToken() error {
	reqBody := map[string]interface{}{
		"token":      testToken,
		"user_id":    "user_123",
		"device_id":  "device_456",
		"platform":   "iOS",
		"device_name": "iPhone 15",
		"app_version": "1.0.0",
		"os_version":  "17.0",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/bind", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	testTokenID = result["id"].(string)
	return nil
}

func testRecordSuccessPush() error {
	reqBody := map[string]interface{}{
		"push_id":  "push_001",
		"token":    testToken,
		"success":  true,
		"sent_at":  time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/push-receipts", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}
	return nil
}

func testRecordFailurePush() error {
	reqBody := map[string]interface{}{
		"push_id":        "push_002",
		"token":          testToken,
		"success":        false,
		"failure_reason": "INVALID_TOKEN",
		"error_message":  "Token is no longer valid",
		"raw_response":   "{'error': 'InvalidRegistration'}",
		"sent_at":        time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/push-receipts", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}
	return nil
}

func testTokenRebindDeviceChange() error {
	reqBody := map[string]interface{}{
		"token":      testToken,
		"user_id":    "user_123",
		"device_id":  "device_789",
		"platform":   "Android",
		"device_name": "Samsung Galaxy",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/bind", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["device_id"] != "device_789" {
		return fmt.Errorf("device_id not updated correctly")
	}
	return nil
}

func testTokenRebindUserChange() error {
	reqBody := map[string]interface{}{
		"token":      testToken,
		"user_id":    "user_456",
		"device_id":  "device_789",
		"platform":   "Android",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/bind", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["user_id"] != "user_456" {
		return fmt.Errorf("user_id not updated correctly")
	}
	if result["status"] != "REBOUND" {
		return fmt.Errorf("status should be REBOUND after user change")
	}
	return nil
}

func testUnsubscribe() error {
	reqBody := map[string]interface{}{
		"reason":  "User requested opt-out",
		"channel": "in_app",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/"+testTokenID+"/unsubscribe", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201, got %d", resp.StatusCode)
	}

	resp2, err := http.Get(baseURL + "/tokens/" + testTokenID)
	if err != nil {
		return err
	}
	defer resp2.Body.Close()

	var token map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&token)
	if token["status"] != "UNSUBSCRIBED" {
		return fmt.Errorf("token status should be UNSUBSCRIBED")
	}
	return nil
}

func testManualCorrection() error {
	reqBody := map[string]interface{}{
		"token_id":   testTokenID,
		"new_status": "ACTIVE",
		"reason":     "User resubscribed",
		"operator_id": "admin_001",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/correction", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if result["status"] != "ACTIVE" {
		return fmt.Errorf("token status should be ACTIVE after correction")
	}
	return nil
}

func testGenerateReport() error {
	resp, err := http.Post(baseURL+"/tokens/"+testTokenID+"/report", "application/json", nil)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("expected status 200, got %d", resp.StatusCode)
	}

	var report map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&report)

	if report["token_id"] != testTokenID {
		return fmt.Errorf("report token_id mismatch")
	}
	if report["total_binds"] == nil {
		return fmt.Errorf("report should contain total_binds")
	}
	return nil
}

func testDirtyDataEmpty() error {
	resp, err := http.Post(baseURL+"/tokens/bind", "application/json", bytes.NewBuffer([]byte("{}")))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		return fmt.Errorf("expected error status for empty request, got %d", resp.StatusCode)
	}
	return nil
}

func testDirtyDataInvalidToken() error {
	reqBody := map[string]interface{}{
		"push_id": "push_003",
		"token":   "non_existent_token_12345",
		"success": true,
		"sent_at": time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/push-receipts", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusInternalServerError {
		return fmt.Errorf("expected error status for non-existent token, got %d", resp.StatusCode)
	}
	return nil
}

func testDuplicateBind() error {
	reqBody := map[string]interface{}{
		"token":     testToken,
		"user_id":   "user_456",
		"device_id": "device_789",
		"platform":  "Android",
	}

	body, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/tokens/bind", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		return fmt.Errorf("expected status 201 for duplicate bind (should be idempotent), got %d", resp.StatusCode)
	}
	return nil
}
