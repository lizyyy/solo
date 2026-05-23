package cmd

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/spf13/cobra"
)

var gendataCmd = &cobra.Command{
	Use:   "gendata",
	Short: "生成测试数据并执行完整流程演示",
	Long: `生成包含跨日边界的测试数据，演示：
1. 导入访客预约表（含正常和跨日数据）
2. 导入闸机记录
3. 导入临时车牌截图
4. 执行对账
5. 冻结数据后尝试修改（验证冻结机制）`,
	RunE: func(cmd *cobra.Command, args []string) error {
		baseURL := "http://localhost:8080"

		fmt.Println("=== 步骤1: 登录获取Token (主管账号) ===")
		token, err := login(baseURL, "supervisor", "supervisor")
		if err != nil {
			return fmt.Errorf("登录失败: %v", err)
		}
		fmt.Println("登录成功, Token已获取")

		fmt.Println("\n=== 步骤2: 导入访客预约表 (含跨日边界) ===")
		today := time.Now().Format("2006-01-02")
		yesterday := time.Now().AddDate(0, 0, -1).Format("2006-01-02")
		twoDaysAgo := time.Now().AddDate(0, 0, -2).Format("2006-01-02")

		appointments := []map[string]string{
			{
				"visitor_name":    "张三",
				"visitor_id_card": "110101199001011234",
				"visitor_phone":   "13800138001",
				"license_plate":   "京A12345",
				"visit_date":      yesterday,
				"visit_end_date":  today,
				"visit_reason":    "商务洽谈",
				"visitor_company": "某某科技公司",
				"host_name":       "李经理",
				"host_department": "销售部",
				"access_area":     "A栋,B栋",
			},
			{
				"visitor_name":    "李四",
				"visitor_id_card": "110101199002025678",
				"visitor_phone":   "13800138002",
				"license_plate":   "京B67890",
				"visit_date":      twoDaysAgo,
				"visit_end_date":  yesterday,
				"visit_reason":    "设备维护",
				"visitor_company": "设备厂商",
				"host_name":       "王工",
				"host_department": "工程部",
				"access_area":     "机房",
			},
			{
				"visitor_name":    "王五",
				"visitor_id_card": "110101199003039012",
				"visitor_phone":   "13800138003",
				"license_plate":   "京C11111",
				"visit_date":      today,
				"visit_end_date":  today,
				"visit_reason":    "面试",
				"visitor_company": "",
				"host_name":       "赵HR",
				"host_department": "人力资源部",
				"access_area":     "会议室",
			},
			{
				"visitor_name":    "坏数据测试",
				"visitor_id_card": "12345",
				"license_plate":   "",
				"visit_date":      "",
			},
		}

		apptBatch, err := importData(baseURL, token, "/api/import/appointments", "预约数据批次-跨日测试", appointments)
		if err != nil {
			return fmt.Errorf("导入预约表失败: %v", err)
		}
		fmt.Printf("导入成功! 批次ID: %s, 总数: %d, 失败: %d\n", apptBatch.BatchID, apptBatch.Total, apptBatch.Failed)

		fmt.Println("\n=== 步骤3: 查看导入失败记录 ===")
		failures, err := listFailures(baseURL, token, apptBatch.BatchID)
		if err != nil {
			return fmt.Errorf("获取失败记录失败: %v", err)
		}
		for _, f := range failures {
			fmt.Printf("  行%d: %s - %s\n", f.RowNumber, f.FailureReason, f.FieldErrors)
		}

		fmt.Println("\n=== 步骤4: 导入闸机记录 ===")
		yesterdayIn := time.Now().AddDate(0, 0, -1).Add(9 * time.Hour).Format(time.RFC3339)
		yesterdayOut := time.Now().AddDate(0, 0, -1).Add(18 * time.Hour).Format(time.RFC3339)
		todayIn := time.Now().Add(9 * time.Hour).Format(time.RFC3339)

		gateRecords := []map[string]string{
			{
				"gate_name":      "东门",
				"pass_direction": "in",
				"pass_time":      yesterdayIn,
				"license_plate":  "京A12345",
				"visitor_name":   "张三",
				"temperature":    "36.5",
				"staff_name":     "保安甲",
			},
			{
				"gate_name":      "东门",
				"pass_direction": "out",
				"pass_time":      yesterdayOut,
				"license_plate":  "京A12345",
				"visitor_name":   "张三",
				"temperature":    "36.3",
				"staff_name":     "保安甲",
			},
			{
				"gate_name":      "北门",
				"pass_direction": "in",
				"pass_time":      todayIn,
				"license_plate":  "京C11111",
				"visitor_name":   "王五",
				"temperature":    "36.7",
				"staff_name":     "保安乙",
			},
			{
				"gate_name":      "西门",
				"pass_direction": "in",
				"pass_time":      todayIn,
				"license_plate":  "京X99999",
				"visitor_name":   "未知人员",
				"temperature":    "36.8",
				"staff_name":     "保安丙",
			},
		}

		gateBatch, err := importData(baseURL, token, "/api/import/gate-records", "闸机记录批次", gateRecords)
		if err != nil {
			return fmt.Errorf("导入闸机记录失败: %v", err)
		}
		fmt.Printf("导入成功! 批次ID: %s, 总数: %d, 失败: %d\n", gateBatch.BatchID, gateBatch.Total, gateBatch.Failed)

		fmt.Println("\n=== 步骤5: 导入临时车牌截图 ===")
		plateImages := []map[string]string{
			{
				"image_file_name":        "capture_001.jpg",
				"image_hash":             "hash1234567890abcdef",
				"license_plate":          "京A12345",
				"recognized_plate":       "京A12345",
				"recognition_confidence": "0.98",
				"capture_time":           yesterdayIn,
				"capture_gate":           "东门",
			},
			{
				"image_file_name":        "capture_002.jpg",
				"image_hash":             "hash0987654321fedcba",
				"license_plate":          "京C11111",
				"recognized_plate":       "京C11111",
				"recognition_confidence": "0.95",
				"capture_time":           todayIn,
				"capture_gate":           "北门",
			},
		}

		plateBatch, err := importData(baseURL, token, "/api/import/plate-images", "车牌截图批次", plateImages)
		if err != nil {
			return fmt.Errorf("导入车牌截图失败: %v", err)
		}
		fmt.Printf("导入成功! 批次ID: %s, 总数: %d, 失败: %d\n", plateBatch.BatchID, plateBatch.Total, plateBatch.Failed)

		fmt.Println("\n=== 步骤6: 执行对账 (检查跨日权限回收) ===")
		result, err := runReconciliation(baseURL, token, apptBatch.BatchID)
		if err != nil {
			return fmt.Errorf("执行对账失败: %v", err)
		}
		fmt.Printf("对账结果ID: %s\n", result.ID)
		fmt.Printf("  预约总数: %d\n", result.TotalAppointments)
		fmt.Printf("  闸机记录总数: %d\n", result.TotalGateRecords)
		fmt.Printf("  匹配成功: %d\n", result.MatchedCount)
		fmt.Printf("  未匹配: %d\n", result.UnmatchedCount)
		fmt.Printf("  跨日风险数: %d\n", result.CrossDayRiskCount)
		fmt.Printf("  过期未收回数: %d\n", result.ExpiredNotRevoked)
		if len(result.Details) > 0 {
			fmt.Println("  异常详情:")
			for _, d := range result.Details {
				fmt.Printf("    - [%s] %s: %s\n", d.Type, d.RecordInfo, d.Issue)
			}
		}

		fmt.Println("\n=== 步骤7: 导出对账报表 ===")
		reportPath, err := exportReport(baseURL, token, result.ID)
		if err != nil {
			return fmt.Errorf("导出报表失败: %v", err)
		}
		fmt.Printf("报表已导出至: %s\n", reportPath)

		fmt.Println("\n=== 步骤8: 冻结预约批次 ===")
		if err := freezeBatch(baseURL, token, apptBatch.BatchID); err != nil {
			return fmt.Errorf("冻结批次失败: %v", err)
		}
		fmt.Println("批次冻结成功!")

		fmt.Println("\n=== 步骤9: 尝试修改已冻结记录 (验证冻结机制) ===")
		appointments2, _ := listAppointments(baseURL, token, apptBatch.BatchID)
		if len(appointments2) > 0 {
			firstApptID := appointments2[0].(map[string]interface{})["id"].(string)
			err := tryUpdateAppointment(baseURL, token, firstApptID)
			if err != nil {
				fmt.Printf("验证通过! 已冻结记录无法修改: %v\n", err)
			} else {
				fmt.Println("警告: 冻结机制失效!")
			}
		}

		fmt.Println("\n=== 测试完成! ===")
		fmt.Println("\n重点说明 (安保主管视角):")
		fmt.Println("1. HTTP接口: 所有操作都通过REST API进行，支持脚本自动化")
		fmt.Println("2. 本地持久化: SQLite数据库存储在 ~/.visitor-pass/visitor.db")
		fmt.Println("3. 状态冻结: 冻结后的数据无法修改，保证数据完整性")
		fmt.Println("4. 权限控制: 四种角色有不同的可见字段和操作权限")
		fmt.Println("5. 坏数据隔离: 导入失败记录单独存储，不影响汇总")
		fmt.Println("6. 跨日检查: 自动检测过期未收回权限和跨日未出场风险")
		fmt.Println("7. 审计日志: 所有操作都有记录，可追溯")

		return nil
	},
}

type ImportResult struct {
	BatchID string `json:"batch_id"`
	Total   int    `json:"total_records"`
	Failed  int    `json:"failed_records"`
}

type Failure struct {
	RowNumber     int    `json:"row_number"`
	FailureReason string `json:"failure_reason"`
	FieldErrors   string `json:"field_errors"`
}

func login(baseURL, username, password string) (string, error) {
	data := map[string]string{"username": username, "password": password}
	body, _ := json.Marshal(data)
	resp, err := http.Post(baseURL+"/api/auth/login", "application/json", bytes.NewBuffer(body))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	if token, ok := result["token"].(string); ok {
		return token, nil
	}
	return "", fmt.Errorf("登录失败: %v", result)
}

func importData(baseURL, token, path, batchName string, records []map[string]string) (*ImportResult, error) {
	data := map[string]interface{}{
		"batch_name": batchName,
		"records":    records,
	}
	body, _ := json.Marshal(data)
	req, _ := http.NewRequest("POST", baseURL+path, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result ImportResult
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func listFailures(baseURL, token, batchID string) ([]Failure, error) {
	req, _ := http.NewRequest("GET", baseURL+"/api/import/failures?batch_id="+batchID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []Failure `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Data, nil
}

func listAppointments(baseURL, token, batchID string) ([]interface{}, error) {
	req, _ := http.NewRequest("GET", baseURL+"/api/appointments?batch_id="+batchID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result struct {
		Data []interface{} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	return result.Data, nil
}

type ReconcileResult struct {
	ID                string                   `json:"id"`
	TotalAppointments int                      `json:"total_appointments"`
	TotalGateRecords  int                      `json:"total_gate_records"`
	TotalPlateImages  int                      `json:"total_plate_images"`
	MatchedCount      int                      `json:"matched_count"`
	UnmatchedCount    int                      `json:"unmatched_count"`
	CrossDayRiskCount int                      `json:"cross_day_risk_count"`
	ExpiredNotRevoked int                      `json:"expired_not_revoked"`
	Details           []map[string]interface{} `json:"details"`
}

func runReconciliation(baseURL, token, batchID string) (*ReconcileResult, error) {
	req, _ := http.NewRequest("POST", baseURL+"/api/reconciliation/run?batch_id="+batchID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}

	var result ReconcileResult
	json.NewDecoder(resp.Body).Decode(&result)
	return &result, nil
}

func exportReport(baseURL, token, resultID string) (string, error) {
	req, _ := http.NewRequest("GET", baseURL+"/api/reconciliation/export/"+resultID, nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var result map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&result)
	return result["report_path"].(string), nil
}

func freezeBatch(baseURL, token, batchID string) error {
	req, _ := http.NewRequest("POST", baseURL+"/api/batches/"+batchID+"/freeze", nil)
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
	}
	return nil
}

func tryUpdateAppointment(baseURL, token, apptID string) error {
	data := map[string]string{"visitor_name": "试图修改已冻结记录"}
	body, _ := json.Marshal(data)
	req, _ := http.NewRequest("PUT", baseURL+"/api/appointments/"+apptID, bytes.NewBuffer(body))
	req.Header.Set("Authorization", "Bearer "+token)
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode == 200 {
		return nil
	}
	b, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("HTTP %d: %s", resp.StatusCode, string(b))
}

func init() {
	rootCmd.AddCommand(gendataCmd)
}
