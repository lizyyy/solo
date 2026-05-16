//go:build ignore

package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

const baseURL = "http://localhost:8080/api/v1"

type CreateJobRequest struct {
	Name        string `json:"name"`
	GPUModel    string `json:"gpu_model"`
	GPUCount    int    `json:"gpu_count"`
	UserID      string `json:"user_id"`
	Priority    int    `json:"priority"`
	DurationMin int    `json:"duration_min"`
	RequestID   string `json:"request_id"`
}

func main() {
	fmt.Println("=== GPU 作业排队系统 - 样例数据生成 ===")
	fmt.Println()

	fmt.Println("1. 创建正常作业 (RTX-3090)...")
	createJobs()

	fmt.Println("\n2. 测试重复提交 (幂等性验证)...")
	testIdempotency()

	fmt.Println("\n3. 创建排队作业 (模拟资源紧张)...")
	createQueuedJobs()

	fmt.Println("\n4. 查询作业列表...")
	listJobs()

	fmt.Println("\n5. 查询 GPU 资源状态...")
	getGPUResources()

	fmt.Println("\n6. 查询排队摘要...")
	getQueueSummary()

	fmt.Println("\n7. 完成一个作业并观察排队调度...")
	completeFirstJob()

	fmt.Println("\n8. 导出完整报告...")
	exportReport()

	fmt.Println("\n=== 样例数据生成完成 ===")
	fmt.Println("API 文档:")
	fmt.Println("  POST /api/v1/jobs          - 创建作业")
	fmt.Println("  GET  /api/v1/jobs          - 查询作业列表")
	fmt.Println("  GET  /api/v1/jobs/:id      - 查询单个作业")
	fmt.Println("  PUT  /api/v1/jobs/:id/status - 更新作业状态")
	fmt.Println("  GET  /api/v1/gpu-resources - 查询GPU资源")
	fmt.Println("  PUT  /api/v1/gpu-resources/correction - 人工修正")
	fmt.Println("  GET  /api/v1/queue-summary - 查询排队摘要")
	fmt.Println("  GET  /api/v1/exception-logs - 查询异常日志")
	fmt.Println("  GET  /api/v1/report/export - 导出报告")
}

func createJobs() {
	jobs := []CreateJobRequest{
		{
			Name:        "模型训练-ResNet50",
			GPUModel:    "RTX-3090",
			GPUCount:    2,
			UserID:      "user_001",
			Priority:    5,
			DurationMin: 120,
			RequestID:   fmt.Sprintf("req_%d_001", time.Now().Unix()),
		},
		{
			Name:        "模型训练-BERT",
			GPUModel:    "RTX-3090",
			GPUCount:    2,
			UserID:      "user_002",
			Priority:    8,
			DurationMin: 180,
			RequestID:   fmt.Sprintf("req_%d_002", time.Now().Unix()),
		},
		{
			Name:        "图像生成任务",
			GPUModel:    "A100",
			GPUCount:    1,
			UserID:      "user_003",
			Priority:    3,
			DurationMin: 60,
			RequestID:   fmt.Sprintf("req_%d_003", time.Now().Unix()),
		},
	}

	for _, job := range jobs {
		body, _ := json.Marshal(job)
		resp, err := http.Post(baseURL+"/jobs", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  创建失败: %v\n", err)
			continue
		}
		defer resp.Body.Close()
		fmt.Printf("  ✓ %s (request_id: %s)\n", job.Name, job.RequestID)
	}
}

func testIdempotency() {
	req := CreateJobRequest{
		Name:        "幂等性测试作业",
		GPUModel:    "RTX-4090",
		GPUCount:    1,
		UserID:      "user_test",
		Priority:    5,
		DurationMin: 30,
		RequestID:   fmt.Sprintf("req_idempotent_%d", time.Now().Unix()),
	}

	body, _ := json.Marshal(req)

	fmt.Println("  第一次提交...")
	resp1, _ := http.Post(baseURL+"/jobs", "application/json", bytes.NewBuffer(body))
	var result1 map[string]interface{}
	json.NewDecoder(resp1.Body).Decode(&result1)
	job1 := result1["data"].(map[string]interface{})
	fmt.Printf("    Job ID: %s, Status: %s\n", job1["id"], job1["status"])
	resp1.Body.Close()

	fmt.Println("  第二次提交 (相同 request_id)...")
	resp2, _ := http.Post(baseURL+"/jobs", "application/json", bytes.NewBuffer(body))
	var result2 map[string]interface{}
	json.NewDecoder(resp2.Body).Decode(&result2)
	job2 := result2["data"].(map[string]interface{})
	fmt.Printf("    Job ID: %s, Status: %s\n", job2["id"], job2["status"])
	resp2.Body.Close()

	if job1["id"] == job2["id"] {
		fmt.Println("  ✓ 幂等性验证通过: 两次提交返回同一个作业")
	} else {
		fmt.Println("  ✗ 幂等性验证失败")
	}
}

func createQueuedJobs() {
	for i := 1; i <= 6; i++ {
		req := CreateJobRequest{
			Name:        fmt.Sprintf("排队作业-%d", i),
			GPUModel:    "RTX-3090",
			GPUCount:    2,
			UserID:      fmt.Sprintf("user_queue_%d", i),
			Priority:    i,
			DurationMin: 60 + i*10,
			RequestID:   fmt.Sprintf("req_queue_%d_%d", time.Now().Unix(), i),
		}
		body, _ := json.Marshal(req)
		resp, err := http.Post(baseURL+"/jobs", "application/json", bytes.NewBuffer(body))
		if err != nil {
			fmt.Printf("  创建失败: %v\n", err)
			continue
		}
		var result map[string]interface{}
		json.NewDecoder(resp.Body).Decode(&result)
		job := result["data"].(map[string]interface{})
		fmt.Printf("  %s - Status: %s\n", req.Name, job["status"])
		resp.Body.Close()
	}
}

func listJobs() {
	resp, err := http.Get(baseURL + "/jobs")
	if err != nil {
		fmt.Printf("  查询失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	data := result["data"].(map[string]interface{})
	fmt.Printf("  总作业数: %.0f\n", data["total"])
}

func getGPUResources() {
	resp, err := http.Get(baseURL + "/gpu-resources")
	if err != nil {
		fmt.Printf("  查询失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	resources := result["data"].([]interface{})
	for _, r := range resources {
		res := r.(map[string]interface{})
		fmt.Printf("  %s: %d/%d 已使用\n", res["model"], int(res["used_count"].(float64)), int(res["total_count"].(float64)))
	}
}

func getQueueSummary() {
	resp, err := http.Get(baseURL + "/queue-summary")
	if err != nil {
		fmt.Printf("  查询失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	summary := result["data"].(map[string]interface{})
	items := summary["Items"].([]interface{})
	for _, item := range items {
		i := item.(map[string]interface{})
		fmt.Printf("  %s: 运行中=%d, 排队中=%d\n", i["GPUModel"], int(i["RunningJobs"].(float64)), int(i["QueuedJobs"].(float64)))
	}
}

func completeFirstJob() {
	resp, _ := http.Get(baseURL + "/jobs?status=running&limit=1")
	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	data := result["data"].(map[string]interface{})
	jobs := data["jobs"].([]interface{})
	resp.Body.Close()

	if len(jobs) > 0 {
		job := jobs[0].(map[string]interface{})
		jobID := job["id"].(string)
		fmt.Printf("  完成作业: %s (ID: %s)\n", job["name"], jobID)

		updateReq := map[string]string{"status": "completed", "remark": "正常完成"}
		body, _ := json.Marshal(updateReq)

		httpReq, _ := http.NewRequest("PUT", baseURL+"/jobs/"+jobID+"/status", bytes.NewBuffer(body))
		httpReq.Header.Set("Content-Type", "application/json")
		client := &http.Client{}
		resp, _ := client.Do(httpReq)
		resp.Body.Close()

		fmt.Println("  ✓ 作业已完成，排队调度已触发")

		fmt.Println("\n  调度后 GPU 状态:")
		getGPUResources()
	}
}

func exportReport() {
	resp, err := http.Get(baseURL + "/report/export")
	if err != nil {
		fmt.Printf("  导出失败: %v\n", err)
		return
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	fmt.Printf("  ✓ 报告导出成功 (总作业数: %.0f, 异常记录: %.0f)\n",
		result["total_jobs"].(float64), result["total_exceptions"].(float64))
}
