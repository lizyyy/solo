package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

func main() {
	fmt.Println("=== 开始创建样例数据 ===")
	
	time.Sleep(2 * time.Second)
	
	taskID1 := createNormalTask()
	fmt.Printf("\n正常任务ID: %s\n", taskID1)
	
	progressTask(taskID1)
	
	testDuplicateStatusUpdate(taskID1)
	
	taskID2 := createTaskWithAnomaly()
	fmt.Printf("\n异常任务ID: %s\n", taskID2)
	
	createManualFixTask(taskID2)
	
	fmt.Println("\n=== 样例数据创建完成 ===")
	fmt.Printf("查看报告: curl %s/tasks/%s/report\n", baseURL, taskID1)
	fmt.Printf("导出报告: curl -O %s/tasks/%s/export\n", baseURL, taskID1)
}

func createNormalTask() string {
	fmt.Println("\n1. 创建正常漏跑任务 - 财务日结批处理")
	
	body := map[string]interface{}{
		"task_name":      "FINANCE_DAILY_BATCH",
		"scheduled_time": "2024-05-15 02:00:00",
		"miss_reason":    "SCHEDULER_DOWN",
		"recovery_action": "RETRY",
		"remarks":        "调度服务凌晨宕机导致日结批处理未执行",
		"created_by":     "admin",
		"original_input": "{\"alert_time\":\"2024-05-15 08:30:00\",\"monitor\":\"scheduler_health\"}",
		"impacts": []map[string]interface{}{
			{
				"impact_type":   "ACCOUNTING",
				"impact_scope":  "ALL_BRANCHES",
				"impact_desc":   "所有分支账务日结延迟",
				"affected_count": 1256,
				"business_date": "2024-05-15",
			},
			{
				"impact_type":   "REPORT",
				"impact_scope":  "MANAGEMENT_REPORT",
				"impact_desc":   "管理层日报无法生成",
				"affected_count": 1,
				"business_date": "2024-05-15",
			},
		},
	}
	
	result := sendRequest("POST", "/tasks", body)
	return extractTaskID(result)
}

func progressTask(taskID string) {
	fmt.Println("\n2. 推进任务状态")
	
	statuses := []struct {
		toStatus string
		action   string
		note     string
	}{
		{"DETECTED", "DETECT", "运维人员确认漏跑"},
		{"ANALYZING", "ANALYZE", "开发人员分析影响范围"},
		{"RECOVERING", "START_RECOVERY", "开始执行补跑脚本"},
		{"COMPLETED", "FINISH", "补跑成功，所有数据处理完成"},
	}
	
	for _, s := range statuses {
		fmt.Printf("  -> %s\n", s.toStatus)
		body := map[string]interface{}{
			"id":              taskID,
			"to_status":       s.toStatus,
			"operator":        "operator_" + s.toStatus,
			"processing_note": s.note,
			"action":          s.action,
		}
		sendRequest("POST", "/tasks/status", body)
	}
}

func testDuplicateStatusUpdate(taskID string) {
	fmt.Println("\n3. 测试重复提交同一动作（状态不应推进两次）")
	
	body := map[string]interface{}{
		"id":              taskID,
		"to_status":       "COMPLETED",
		"operator":        "test_user",
		"processing_note": "测试重复提交",
		"action":          "TEST",
	}
	
	fmt.Println("  再次提交到COMPLETED状态...")
	result := sendRequest("POST", "/tasks/status", body)
	
	var resp map[string]interface{}
	json.Unmarshal([]byte(result), &resp)
	if code, ok := resp["code"].(float64); ok && code != 200 {
		fmt.Printf("  ✓ 预期行为: %s\n", resp["message"])
	} else {
		fmt.Println("  ✗ 不应该成功")
	}
}

func createTaskWithAnomaly() string {
	fmt.Println("\n4. 创建包含异常的任务 - 月末关账")
	
	body := map[string]interface{}{
		"task_name":      "FINANCE_MONTHEND_CLOSE",
		"scheduled_time": "2024-05-01 20:00:00",
		"miss_reason":    "TIMEOUT",
		"recovery_action": "RETRY",
		"remarks":        "月末关账超时，需要人工介入",
		"created_by":     "finance_manager",
		"original_input": "{\"batch_id\":\"ME20240501\",\"timeout\":3600}",
		"impacts": []map[string]interface{}{
			{
				"impact_type":   "LEDGER",
				"impact_scope":  "GL_LEDGER",
				"impact_desc":   "总账关账失败",
				"affected_count": 50000,
				"business_date": "2024-04-30",
			},
		},
	}
	
	result := sendRequest("POST", "/tasks", body)
	taskID := extractTaskID(result)
	
	fmt.Println("\n5. 模拟异常过程")
	progressions := []struct {
		toStatus string
		action   string
		note     string
	}{
		{"DETECTED", "DETECT", "自动检测到月末关账超时"},
		{"ANALYZING", "ANALYZE", "分析问题：数据量过大导致超时"},
		{"RECOVERING", "START_RECOVERY", "第一次尝试补跑"},
		{"FAILED", "FAIL", "补跑失败：数据库锁冲突，原始参数：{\"retry_count\":1}"},
	}
	
	for _, p := range progressions {
		fmt.Printf("  -> %s\n", p.toStatus)
		body := map[string]interface{}{
			"id":              taskID,
			"to_status":       p.toStatus,
			"operator":        "system_" + p.action,
			"processing_note": p.note,
			"action":          p.action,
			"original_input":  fmt.Sprintf("{\"step\":\"%s\",\"time\":\"%s\"}", p.action, time.Now().Format(time.RFC3339)),
		}
		sendRequest("POST", "/tasks/status", body)
	}
	
	return taskID
}

func createManualFixTask(taskID string) {
	fmt.Println("\n6. 人工修正")
	
	body := map[string]interface{}{
		"id":              taskID,
		"remarks":         "已手动清理数据库锁，准备重新执行",
		"operator":        "dba_admin",
		"recovery_action": "MANUAL",
		"processing_note": "DBA介入，杀掉阻塞会话: session_id=12345",
		"original_input":  "{\"session_id\":12345,\"action\":\"KILL\",\"operator\":\"dba_admin\"}",
	}
	
	sendRequest("POST", "/tasks/manual-fix", body)
	
	fmt.Println("\n7. 人工修正后重新补跑成功")
	finalBody := map[string]interface{}{
		"id":              taskID,
		"to_status":       "RECOVERING",
		"operator":        "dba_admin",
		"processing_note": "开始第二次补跑",
		"action":          "RETRY_AFTER_FIX",
	}
	sendRequest("POST", "/tasks/status", finalBody)
	
	finalBody2 := map[string]interface{}{
		"id":              taskID,
		"to_status":       "COMPLETED",
		"operator":        "dba_admin",
		"processing_note": "补跑成功，共处理50000条记录",
		"action":          "FINISH",
	}
	sendRequest("POST", "/tasks/status", finalBody2)
}

func sendRequest(method, path string, body map[string]interface{}) string {
	jsonBody, _ := json.Marshal(body)
	req, _ := http.NewRequest(method, baseURL+path, bytes.NewBuffer(jsonBody))
	req.Header.Set("Content-Type", "application/json")
	
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		fmt.Printf("  请求失败: %v\n", err)
		return ""
	}
	defer resp.Body.Close()
	
	result, _ := io.ReadAll(resp.Body)
	return string(result)
}

func extractTaskID(result string) string {
	var resp map[string]interface{}
	json.Unmarshal([]byte(result), &resp)
	if data, ok := resp["data"].(map[string]interface{}); ok {
		if id, ok := data["id"].(string); ok {
			return id
		}
	}
	return ""
}
