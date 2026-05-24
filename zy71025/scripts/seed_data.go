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

type Farmer struct {
	Name    string `json:"name"`
	IDCard  string `json:"id_card"`
	Phone   string `json:"phone"`
	Village string `json:"village"`
}

type Plot struct {
	FarmerID   uint    `json:"farmer_id"`
	PlotNumber string  `json:"plot_number"`
	Area       float64 `json:"area"`
	Location   string  `json:"location"`
	CropType   string  `json:"crop_type"`
}

type WaterRight struct {
	FarmerID   uint    `json:"farmer_id"`
	Year       int     `json:"year"`
	Week       int     `json:"week"`
	TotalQuota float64 `json:"total_quota"`
	Remarks    string  `json:"remarks"`
}

type Response struct {
	Success bool        `json:"success"`
	Message string      `json:"message"`
	Data    interface{} `json:"data"`
}

func post(endpoint string, body interface{}) (*http.Response, error) {
	jsonBody, _ := json.Marshal(body)
	return http.Post(baseURL+endpoint, "application/json", bytes.NewBuffer(jsonBody))
}

func get(endpoint string) (*http.Response, error) {
	return http.Get(baseURL + endpoint)
}

func printResponse(resp *http.Response, label string) {
	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("=== %s ===\n", label)
	fmt.Printf("Status: %d\n", resp.StatusCode)
	fmt.Printf("Response: %s\n\n", string(body))
}

func main() {
	fmt.Println("开始生成测试数据...\n")
	time.Sleep(2 * time.Second)

	farmers := []Farmer{
		{Name: "张三", IDCard: "110101199001010001", Phone: "13800138001", Village: "东村村"},
		{Name: "李四", IDCard: "110101199001010002", Phone: "13800138002", Village: "东村村"},
		{Name: "王五", IDCard: "110101199001010003", Phone: "13800138003", Village: "西村村"},
	}

	farmerIDs := []uint{}
	for i, f := range farmers {
		resp, _ := post("/farmers", f)
		var result map[string]interface{}
		body, _ := io.ReadAll(resp.Body)
		json.Unmarshal(body, &result)
		if data, ok := result["data"].(map[string]interface{}); ok {
			farmerIDs = append(farmerIDs, uint(data["id"].(float64)))
		}
		fmt.Printf("创建农户: %s, ID: %d\n", f.Name, farmerIDs[i])
	}
	fmt.Println()

	plots := []Plot{
		{FarmerID: 1, PlotNumber: "P001", Area: 5.5, Location: "村东头一号地", CropType: "水稻"},
		{FarmerID: 1, PlotNumber: "P002", Area: 3.0, Location: "村东头二号地", CropType: "小麦"},
		{FarmerID: 2, PlotNumber: "P003", Area: 4.0, Location: "村西头一号地", CropType: "水稻"},
		{FarmerID: 3, PlotNumber: "P004", Area: 6.0, Location: "村南头一号地", CropType: "玉米"},
	}

	for _, p := range plots {
		post("/plots", p)
		fmt.Printf("创建地块: %s, 农户ID: %d\n", p.PlotNumber, p.FarmerID)
	}
	fmt.Println()

	waterRights := []WaterRight{
		{FarmerID: 1, Year: 2024, Week: 20, TotalQuota: 500, Remarks: "每周配额"},
		{FarmerID: 2, Year: 2024, Week: 20, TotalQuota: 400, Remarks: "每周配额"},
		{FarmerID: 3, Year: 2024, Week: 20, TotalQuota: 600, Remarks: "每周配额"},
	}

	for _, wr := range waterRights {
		post("/water-rights", wr)
		fmt.Printf("创建水权: 农户%d, 2024年第20周, 配额%.0f立方米\n", wr.FarmerID, wr.TotalQuota)
	}
	fmt.Println()

	fmt.Println("测试数据生成完成!")
	fmt.Println("\n=== 执行业务流程测试 ===")

	fmt.Println("\n1. 张三转让100立方米给李四")
	transferReq := map[string]interface{}{
		"from_farmer_id": 1,
		"to_farmer_id":   2,
		"amount":         100,
		"reason":         "李四农田干旱急需用水",
		"week":           20,
		"year":           2024,
		"operator":       "管理员小王",
	}
	resp, _ := post("/transfers", transferReq)
	var transferResult map[string]interface{}
	body, _ := io.ReadAll(resp.Body)
	json.Unmarshal(body, &transferResult)
	transferNo := transferResult["transfer_no"].(string)
	fmt.Printf("  创建转让申请: %s\n", transferNo)
	fmt.Printf("  结果: %s\n", transferResult["message"])

	fmt.Println("\n2. 审批转让申请")
	approveReq := map[string]string{
		"operator": "管理员小王",
		"opinion":  "情况属实，同意转让",
	}
	resp, _ = post("/transfers/1/approve", approveReq)
	printResponse(resp, "转让审批结果")

	fmt.Println("3. 张三灌溉200立方米")
	irrigationReq := map[string]interface{}{
		"farmer_id":       1,
		"plot_id":         1,
		"water_amount":    200,
		"irrigation_date": time.Now().Format(time.RFC3339),
		"week":            20,
		"year":            2024,
		"operator":        "管理员小王",
		"remarks":         "水稻灌溉",
	}
	resp, _ = post("/irrigation", irrigationReq)
	printResponse(resp, "灌溉记录结果")

	fmt.Println("4. 查看张三当前余额")
	resp, _ = get("/farmers/1/balance?year=2024&week=20")
	printResponse(resp, "张三余额")

	fmt.Println("5. 生成周度报告")
	reportReq := map[string]interface{}{}
	resp, _ = post("/reports/generate?year=2024&week=20&operator=管理员小王", reportReq)
	printResponse(resp, "周度报告")

	fmt.Println("6. 执行自检")
	resp, _ = get("/self-check?year=2024&week=20")
	printResponse(resp, "自检结果")

	fmt.Println("\n=== 测试失败场景 ===")
	fmt.Println("7. 张三尝试超额转让500立方米给王五")
	overTransferReq := map[string]interface{}{
		"from_farmer_id": 1,
		"to_farmer_id":   3,
		"amount":         500,
		"reason":         "测试超额转让",
		"week":           20,
		"year":           2024,
		"operator":       "管理员小王",
	}
	resp, _ = post("/transfers", overTransferReq)
	printResponse(resp, "超额转让结果")

	fmt.Println("\n测试完成!")
}
