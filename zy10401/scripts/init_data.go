package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	fmt.Println("=== 初始化契约样例漂移 API 数据 ===")

	fmt.Println("\n1. 创建接口契约...")
	contractID := createContract()

	fmt.Println("\n2. 注册消费方...")
	consumerID := registerConsumer()

	fmt.Println("\n3. 导入符合契约的样例...")
	importValidSample(contractID)

	fmt.Println("\n4. 导入漂移的样例（包含类型不匹配和额外字段）...")
	driftedSampleID := importDriftedSample(contractID)

	fmt.Println("\n5. 分析漂移样例...")
	analyzeSample(driftedSampleID)

	fmt.Println("\n6. 消费方确认样例...")
	confirmSample(consumerID, driftedSampleID)

	fmt.Println("\n7. 演示被规则拦截的路径 - 重复导入相同样例...")
	importDuplicateSample(contractID)

	fmt.Println("\n8. 导出漂移报告...")
	exportReport(contractID)

	fmt.Println("\n=== 初始化完成 ===")
	fmt.Println("\n可执行以下命令验证：")
	fmt.Println("  curl " + baseURL + "/contracts")
	fmt.Println("  curl " + baseURL + "/samples?contract_id=" + fmt.Sprint(contractID))
	fmt.Println("  curl " + baseURL + "/drifts?contract_id=" + fmt.Sprint(contractID))
	fmt.Println("  curl " + baseURL + "/exceptions")
}

func createContract() int64 {
	schema := map[string]interface{}{
		"type": "object",
		"properties": map[string]interface{}{
			"user_id": map[string]interface{}{
				"type":        "string",
				"description": "用户唯一标识",
			},
			"order_id": map[string]interface{}{
				"type":        "string",
				"description": "订单号",
			},
			"amount": map[string]interface{}{
				"type":        "number",
				"description": "订单金额",
			},
			"status": map[string]interface{}{
				"type": "string",
				"enum": []string{"pending", "paid", "shipped", "completed", "cancelled"},
			},
			"items": map[string]interface{}{
				"type": "array",
				"items": map[string]interface{}{
					"type": "object",
				},
			},
		},
		"required": []string{"user_id", "order_id", "amount"},
	}

	contract := map[string]interface{}{
		"name":        "order_create",
		"version":     "v1.0.0",
		"method":      "POST",
		"path":        "/api/v1/orders",
		"schema":      schema,
		"description": "订单创建接口",
	}

	resp, err := post(baseURL+"/contracts", contract)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return 0
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	id := int64(result["id"].(float64))
	fmt.Printf("  成功: 契约 ID = %d\n", id)
	return id
}

func registerConsumer() int64 {
	consumer := map[string]interface{}{
		"name":    "payment_service",
		"version": "v2.3.1",
		"service": "payment",
	}

	resp, err := post(baseURL+"/consumers", consumer)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return 0
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	id := int64(result["id"].(float64))
	fmt.Printf("  成功: 消费方 ID = %d\n", id)
	return id
}

func importValidSample(contractID int64) int64 {
	payload := map[string]interface{}{
		"user_id":  "U12345",
		"order_id": "ORD20240515001",
		"amount":   999.99,
		"status":   "pending",
		"items": []interface{}{
			map[string]interface{}{"sku": "PROD001", "qty": 2},
		},
	}

	sample := map[string]interface{}{
		"contract_id": contractID,
		"payload":     payload,
		"source":      "test_case_001",
	}

	resp, err := post(baseURL+"/samples", sample)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return 0
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	id := int64(result["id"].(float64))
	fmt.Printf("  成功: 合规样例 ID = %d\n", id)
	return id
}

func importDriftedSample(contractID int64) int64 {
	payload := map[string]interface{}{
		"user_id":     "U67890",
		"order_id":    "ORD20240515002",
		"amount":      "1999.99",
		"status":      "unknown_status",
		"extra_field": "this_should_not_be_here",
		"items": []interface{}{
			"not_an_object",
		},
	}

	sample := map[string]interface{}{
		"contract_id": contractID,
		"payload":     payload,
		"source":      "production_log_20240515",
	}

	resp, err := post(baseURL+"/samples", sample)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return 0
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	id := int64(result["id"].(float64))
	fmt.Printf("  成功: 漂移样例 ID = %d\n", id)
	return id
}

func analyzeSample(sampleID int64) {
	url := fmt.Sprintf("%s/samples/%d/analyze", baseURL, sampleID)
	req, _ := http.NewRequest("POST", url, nil)
	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	hasDrift := result["hasDrift"].(bool)
	driftCount := int(result["driftCount"].(float64))
	fmt.Printf("  分析完成: 检测到漂移 = %v, 漂移项数量 = %d\n", hasDrift, driftCount)
}

func confirmSample(consumerID, sampleID int64) {
	url := fmt.Sprintf("%s/consumers/%d/confirm", baseURL, consumerID)
	data := map[string]interface{}{
		"sample_id": sampleID,
		"status":    "acknowledged",
		"comment":   "已确认此样例漂移，将在下周修复",
	}

	_, err := post(url, data)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return
	}
	fmt.Println("  成功: 消费方已确认样例")
}

func importDuplicateSample(contractID int64) {
	payload := map[string]interface{}{
		"user_id":  "U12345",
		"order_id": "ORD20240515001",
		"amount":   999.99,
		"status":   "pending",
	}

	sample := map[string]interface{}{
		"contract_id": contractID,
		"payload":     payload,
		"source":      "duplicate_test",
	}

	resp, err := post(baseURL+"/samples", sample)
	if err != nil {
		fmt.Printf("  拦截成功: %v\n", err)
		return
	}

	var result map[string]interface{}
	json.Unmarshal(resp, &result)
	msg := result["message"]
	fmt.Printf("  幂等拦截成功: 返回消息 = %s\n", msg)
}

func exportReport(contractID int64) {
	url := fmt.Sprintf("%s/reports/drift/%d", baseURL, contractID)
	resp, err := http.Get(url)
	if err != nil {
		fmt.Printf("  失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)

	totalSamples := int(result["TotalSamples"].(float64))
	driftedSamples := int(result["DriftedSamples"].(float64))
	fmt.Printf("  报告生成: 总样例数 = %d, 漂移样例数 = %d\n", totalSamples, driftedSamples)
}

func post(url string, data interface{}) ([]byte, error) {
	jsonData, _ := json.Marshal(data)
	req, _ := http.NewRequest("POST", url, bytes.NewBuffer(jsonData))
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		buf := new(bytes.Buffer)
		buf.ReadFrom(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, buf.String())
	}

	buf := new(bytes.Buffer)
	buf.ReadFrom(resp.Body)
	return buf.Bytes(), nil
}
