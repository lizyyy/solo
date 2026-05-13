package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

type Client struct {
	client *http.Client
}

func NewClient() *Client {
	return &Client{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

func (c *Client) post(path string, body interface{}) ([]byte, error) {
	jsonBody, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}

	resp, err := c.client.Post(baseURL+path, "application/json", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return data, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	return data, nil
}

func (c *Client) get(path string) ([]byte, error) {
	resp, err := c.client.Get(baseURL + path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	if resp.StatusCode >= 400 {
		return data, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(data))
	}

	return data, nil
}

type CreateBudgetRequest struct {
	ServiceID      string `json:"service_id"`
	TotalBudget    int    `json:"total_budget"`
	WindowDuration int64  `json:"window_duration"`
}

type CreateBudgetResponse struct {
	BudgetID       string `json:"budget_id"`
	ServiceID      string `json:"service_id"`
	TotalBudget    int    `json:"total_budget"`
	RemainingBudget int   `json:"remaining_budget"`
	Status         string `json:"status"`
	WindowID       string `json:"window_id"`
}

type DeductBudgetRequest struct {
	RequestID    string `json:"request_id"`
	BudgetID     string `json:"budget_id"`
	Source       string `json:"source"`
	Amount       int    `json:"amount"`
	ErrorMessage string `json:"error_message,omitempty"`
}

func main() {
	client := NewClient()

	fmt.Println("=== API 错误预算账本演示 ===")
	fmt.Println()

	budgetID := demoCreateBudget(client)
	if budgetID == "" {
		log.Fatal("创建预算失败")
	}

	demoGetStatus(client, budgetID)
	demoDeduct(client, budgetID, 5)
	demoGetStatus(client, budgetID)
	demoFreeze(client, budgetID)
	demoUnfreeze(client, budgetID)
	demoGetTimeline(client, budgetID)
	demoExport(client, budgetID)

	fmt.Println()
	fmt.Println("=== 演示完成 ===")
}

func demoCreateBudget(client *Client) string {
	fmt.Println("1️⃣ 创建错误预算")
	fmt.Println("----------------------------------------")

	req := CreateBudgetRequest{
		ServiceID:      "payment-service",
		TotalBudget:    100,
		WindowDuration: int64(time.Hour),
	}

	data, err := client.post("/budgets", req)
	if err != nil {
		fmt.Printf("❌ 创建失败: %v\n", err)
		return ""
	}

	var resp CreateBudgetResponse
	json.Unmarshal(data, &resp)
	
	fmt.Printf("✅ 预算创建成功!\n")
	fmt.Printf("   Budget ID: %s\n", resp.BudgetID)
	fmt.Printf("   总预算: %d, 剩余预算: %d\n", resp.TotalBudget, resp.RemainingBudget)
	fmt.Printf("   状态: %s\n", resp.Status)
	fmt.Println()

	return resp.BudgetID
}

func demoGetStatus(client *Client, budgetID string) {
	fmt.Println("2️⃣ 查询预算状态")
	fmt.Println("----------------------------------------")

	data, err := client.get("/budgets/" + budgetID)
	if err != nil {
		fmt.Printf("❌ 查询失败: %v\n", err)
		return
	}

	var status map[string]interface{}
	json.Unmarshal(data, &status)

	fmt.Printf("✅ 查询成功!\n")
	fmt.Printf("   服务状态: %v\n", status["status"])
	fmt.Printf("   预算使用: %.1f%%\n", status["usage_percent"])
	fmt.Printf("   剩余预算: %.0f\n", status["remaining_budget"])
	fmt.Println()
}

func demoDeduct(client *Client, budgetID string, count int) {
	fmt.Printf("3️⃣ 模拟 %d 次 API 错误扣减\n", count)
	fmt.Println("----------------------------------------")

	for i := 0; i < count; i++ {
		req := DeductBudgetRequest{
			RequestID:    fmt.Sprintf("req_%d_%d", time.Now().Unix(), i),
			BudgetID:     budgetID,
			Source:       "api_error",
			Amount:       10,
			ErrorMessage: fmt.Sprintf("模拟错误 #%d", i+1),
		}

		_, err := client.post("/budgets/"+budgetID+"/deduct", req)
		if err != nil {
			fmt.Printf("   扣减 #%d: ❌ %v\n", i+1, err)
		} else {
			fmt.Printf("   扣减 #%d: ✅ 成功\n", i+1)
		}
		time.Sleep(100 * time.Millisecond)
	}
	fmt.Println()
}

func demoFreeze(client *Client, budgetID string) {
	fmt.Println("4️⃣ 手动冻结服务")
	fmt.Println("----------------------------------------")

	req := map[string]interface{}{
		"budget_id":   budgetID,
		"reason":      "manual",
		"description": "演示手动冻结",
		"frozen_by":   "demo-user",
	}

	_, err := client.post("/freezes", req)
	if err != nil {
		fmt.Printf("❌ 冻结失败: %v\n", err)
	} else {
		fmt.Println("✅ 服务已冻结")
	}
	fmt.Println()
}

func demoUnfreeze(client *Client, budgetID string) {
	fmt.Println("5️⃣ 解冻服务")
	fmt.Println("----------------------------------------")

	req := map[string]interface{}{
		"budget_id":   budgetID,
		"unfrozen_by": "demo-user",
	}

	_, err := client.post("/freezes/unfreeze", req)
	if err != nil {
		fmt.Printf("❌ 解冻失败: %v\n", err)
	} else {
		fmt.Println("✅ 服务已解冻")
	}
	fmt.Println()
}

func demoGetTimeline(client *Client, budgetID string) {
	fmt.Println("6️⃣ 获取时间线")
	fmt.Println("----------------------------------------")

	data, err := client.get("/budgets/" + budgetID + "/timeline?limit=20")
	if err != nil {
		fmt.Printf("❌ 获取失败: %v\n", err)
		return
	}

	var timeline map[string]interface{}
	json.Unmarshal(data, &timeline)

	entries := timeline["entries"].([]interface{})
	fmt.Printf("✅ 共 %d 条记录:\n", len(entries))
	
	actionLabels := map[string]string{
		"budget_created":      "💰 创建预算",
		"deduct_applied":      "➖ 扣减预算",
		"service_frozen":      "❄️ 冻结服务",
		"service_unfrozen":    "☀️ 解冻服务",
	}

	for i, e := range entries {
		entry := e.(map[string]interface{})
		action := entry["action"].(string)
		label := actionLabels[action]
		if label == "" {
			label = action
		}
		fmt.Printf("   %d. %s\n", i+1, label)
	}
	fmt.Println()
}

func demoExport(client *Client, budgetID string) {
	fmt.Println("7️⃣ 导出账本数据")
	fmt.Println("----------------------------------------")

	data, err := client.get("/budgets/" + budgetID + "/export")
	if err != nil {
		fmt.Printf("❌ 导出失败: %v\n", err)
		return
	}

	var export map[string]interface{}
	json.Unmarshal(data, &export)

	summary := export["summary"].(map[string]interface{})
	fmt.Printf("✅ 导出成功!\n")
	fmt.Printf("   总预算: %.0f\n", summary["total_budget"])
	fmt.Printf("   剩余预算: %.0f\n", summary["remaining_budget"])
	fmt.Printf("   净使用: %.0f\n", summary["net_used"])
	fmt.Printf("   冻结次数: %.0f\n", summary["freeze_count"])
	fmt.Printf("   导出时间: %v\n", summary["export_time"])
	fmt.Println()
}
