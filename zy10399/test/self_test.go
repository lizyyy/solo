package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8080/api"

type TestResult struct {
	Name    string
	Passed  bool
	Message string
}

func main() {
	fmt.Println("=== 异常配置回滚判定 API 自检测试 ===")
	fmt.Println()

	tests := []struct {
		name string
		test func() TestResult
	}{
		{"1. 健康检查", testHealthCheck},
		{"2. 创建发布", testCreateRelease},
		{"3. 幂等性测试 - 重复调用", testIdempotency},
		{"4. 状态流转测试", testStateTransition},
		{"5. 脏数据测试 - 缺少必填字段", testDirtyData},
		{"6. 状态不允许跳转测试", testInvalidStateTransition},
		{"7. 基线和阈值配置测试", testBaselineAndThreshold},
		{"8. 指标观察和自动回滚测试", testObservationAndRollback},
		{"9. 手动回滚测试", testManualRollback},
		{"10. 判定历史审计测试", testDecisionHistory},
	}

	var results []TestResult
	for _, t := range tests {
		fmt.Printf("运行测试: %s... ", t.name)
		result := t.test()
		if result.Passed {
			fmt.Println("✅ 通过")
		} else {
			fmt.Printf("❌ 失败: %s\n", result.Message)
		}
		results = append(results, result)
	}

	fmt.Println()
	fmt.Println("=== 测试总结 ===")
	passed := 0
	for _, r := range results {
		if r.Passed {
			passed++
		}
	}
	fmt.Printf("通过: %d/%d\n", passed, len(results))
	if passed == len(results) {
		fmt.Println("🎉 所有测试通过!")
	} else {
		fmt.Println("⚠️  部分测试失败")
	}
}

func testHealthCheck() TestResult {
	resp, err := http.Get("http://localhost:8080/health")
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return TestResult{Passed: false, Message: fmt.Sprintf("状态码: %d", resp.StatusCode)}
	}
	return TestResult{Passed: true}
}

func testCreateRelease() TestResult {
	reqBody := map[string]string{
		"config_name":    "test-config",
		"version":        "v1.0.0",
		"content":        "key=value",
		"idempotent_key": "test-create-" + time.Now().String(),
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusCreated {
		return TestResult{Passed: false, Message: fmt.Sprintf("状态码: %d", resp.StatusCode)}
	}
	return TestResult{Passed: true}
}

func testIdempotency() TestResult {
	idempotentKey := "test-idempotent-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-2",
		"version":        "v1.0.1",
		"content":        "key=value2",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)

	var firstID, secondID string

	resp1, err := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	var result1 map[string]interface{}
	json.NewDecoder(resp1.Body).Decode(&result1)
	firstID = result1["id"].(string)
	resp1.Body.Close()

	resp2, err := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	var result2 map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&result2)
	secondID = result2["id"].(string)
	resp2.Body.Close()

	if firstID != secondID {
		return TestResult{Passed: false, Message: fmt.Sprintf("幂等性失败: %s != %s", firstID, secondID)}
	}
	return TestResult{Passed: true}
}

func testStateTransition() TestResult {
	idempotentKey := "test-state-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-3",
		"version":        "v1.0.2",
		"content":        "key=value3",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	startResp, err := http.Post(fmt.Sprintf("%s/releases/%s/start", baseURL, releaseID), "application/json", nil)
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer startResp.Body.Close()
	if startResp.StatusCode != http.StatusOK {
		return TestResult{Passed: false, Message: fmt.Sprintf("启动失败，状态码: %d", startResp.StatusCode)}
	}

	return TestResult{Passed: true}
}

func testDirtyData() TestResult {
	reqBody := map[string]string{
		"config_name": "",
		"version":     "v1.0.0",
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, err := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		return TestResult{Passed: false, Message: fmt.Sprintf("应该返回400，实际: %d", resp.StatusCode)}
	}
	return TestResult{Passed: true}
}

func testInvalidStateTransition() TestResult {
	idempotentKey := "test-invalid-state-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-4",
		"version":        "v1.0.3",
		"content":        "key=value4",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	successResp, _ := http.Post(fmt.Sprintf("%s/releases/%s/success", baseURL, releaseID), "application/json", nil)
	defer successResp.Body.Close()
	if successResp.StatusCode != http.StatusBadRequest {
		return TestResult{Passed: false, Message: "PENDING状态直接跳转到SUCCESS应该失败"}
	}
	return TestResult{Passed: true}
}

func testBaselineAndThreshold() TestResult {
	idempotentKey := "test-baseline-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-5",
		"version":        "v1.0.4",
		"content":        "key=value5",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	http.Post(fmt.Sprintf("%s/releases/%s/start", baseURL, releaseID), "application/json", nil)

	now := time.Now()
	baselineReq := map[string]interface{}{
		"metrics": []map[string]interface{}{
			{"timestamp": now.Add(-10 * time.Minute), "value": 100.0, "metric": "error_rate"},
			{"timestamp": now.Add(-5 * time.Minute), "value": 95.0, "metric": "error_rate"},
			{"timestamp": now, "value": 105.0, "metric": "error_rate"},
		},
		"window_start": now.Add(-10 * time.Minute),
		"window_end":   now,
	}
	baselineData, _ := json.Marshal(baselineReq)
	baselineResp, err := http.Post(fmt.Sprintf("%s/releases/%s/baseline", baseURL, releaseID), "application/json", bytes.NewBuffer(baselineData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer baselineResp.Body.Close()
	if baselineResp.StatusCode != http.StatusOK {
		return TestResult{Passed: false, Message: fmt.Sprintf("基线设置失败，状态码: %d", baselineResp.StatusCode)}
	}

	thresholdReq := map[string]interface{}{
		"metric_name":       "error_rate",
		"max_deviation":     20.0,
		"min_threshold":     50.0,
		"max_threshold":     150.0,
		"consecutive_count": 3,
	}
	thresholdData, _ := json.Marshal(thresholdReq)
	thresholdResp, err := http.Post(fmt.Sprintf("%s/releases/%s/threshold", baseURL, releaseID), "application/json", bytes.NewBuffer(thresholdData))
	if err != nil {
		return TestResult{Passed: false, Message: err.Error()}
	}
	defer thresholdResp.Body.Close()
	if thresholdResp.StatusCode != http.StatusOK {
		return TestResult{Passed: false, Message: fmt.Sprintf("阈值设置失败，状态码: %d", thresholdResp.StatusCode)}
	}

	return TestResult{Passed: true}
}

func testObservationAndRollback() TestResult {
	idempotentKey := "test-rollback-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-6",
		"version":        "v1.0.5",
		"content":        "key=value6",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	http.Post(fmt.Sprintf("%s/releases/%s/start", baseURL, releaseID), "application/json", nil)

	now := time.Now()
	baselineReq := map[string]interface{}{
		"metrics": []map[string]interface{}{
			{"timestamp": now.Add(-10 * time.Minute), "value": 100.0, "metric": "error_rate"},
			{"timestamp": now.Add(-5 * time.Minute), "value": 100.0, "metric": "error_rate"},
		},
		"window_start": now.Add(-10 * time.Minute),
		"window_end":   now,
	}
	baselineData, _ := json.Marshal(baselineReq)
	http.Post(fmt.Sprintf("%s/releases/%s/baseline", baseURL, releaseID), "application/json", bytes.NewBuffer(baselineData))

	thresholdReq := map[string]interface{}{
		"metric_name":       "error_rate",
		"max_deviation":     20.0,
		"min_threshold":     0.0,
		"max_threshold":     200.0,
		"consecutive_count": 3,
	}
	thresholdData, _ := json.Marshal(thresholdReq)
	http.Post(fmt.Sprintf("%s/releases/%s/threshold", baseURL, releaseID), "application/json", bytes.NewBuffer(thresholdData))

	http.Post(fmt.Sprintf("%s/releases/%s/observe/start", baseURL, releaseID), "application/json", nil)

	observeReq := map[string]interface{}{
		"metrics": []map[string]interface{}{
			{"timestamp": time.Now(), "value": 150.0, "metric": "error_rate"},
		},
	}
	observeData, _ := json.Marshal(observeReq)
	observeResp, _ := http.Post(fmt.Sprintf("%s/releases/%s/observe", baseURL, releaseID), "application/json", bytes.NewBuffer(observeData))
	var observeResult map[string]interface{}
	json.NewDecoder(observeResp.Body).Decode(&observeResult)
	observeResp.Body.Close()

	getResp, _ := http.Get(fmt.Sprintf("%s/releases/%s", baseURL, releaseID))
	var release map[string]interface{}
	json.NewDecoder(getResp.Body).Decode(&release)
	getResp.Body.Close()

	if release["status"] != "ROLLBACK" {
		return TestResult{Passed: false, Message: fmt.Sprintf("应该自动回滚，状态: %s", release["status"])}
	}

	return TestResult{Passed: true}
}

func testManualRollback() TestResult {
	idempotentKey := "test-manual-rollback-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-7",
		"version":        "v1.0.6",
		"content":        "key=value7",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	http.Post(fmt.Sprintf("%s/releases/%s/start", baseURL, releaseID), "application/json", nil)

	rollbackReq := map[string]string{"reason": "手动回滚测试"}
	rollbackData, _ := json.Marshal(rollbackReq)
	rollbackResp, _ := http.Post(fmt.Sprintf("%s/releases/%s/rollback", baseURL, releaseID), "application/json", bytes.NewBuffer(rollbackData))
	defer rollbackResp.Body.Close()

	if rollbackResp.StatusCode != http.StatusOK {
		return TestResult{Passed: false, Message: fmt.Sprintf("手动回滚失败，状态码: %d", rollbackResp.StatusCode)}
	}

	return TestResult{Passed: true}
}

func testDecisionHistory() TestResult {
	idempotentKey := "test-decision-" + time.Now().String()
	reqBody := map[string]string{
		"config_name":    "test-config-8",
		"version":        "v1.0.7",
		"content":        "key=value8",
		"idempotent_key": idempotentKey,
	}
	jsonData, _ := json.Marshal(reqBody)
	resp, _ := http.Post(baseURL+"/releases", "application/json", bytes.NewBuffer(jsonData))
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	releaseID := result["id"].(string)
	resp.Body.Close()

	http.Post(fmt.Sprintf("%s/releases/%s/start", baseURL, releaseID), "application/json", nil)

	historyResp, _ := http.Get(fmt.Sprintf("%s/releases/%s/decisions", baseURL, releaseID))
	var history []map[string]interface{}
	json.NewDecoder(historyResp.Body).Decode(&history)
	historyResp.Body.Close()

	if len(history) < 2 {
		return TestResult{Passed: false, Message: fmt.Sprintf("应该至少有2条判定记录，实际: %d", len(history))}
	}

	return TestResult{Passed: true}
}
