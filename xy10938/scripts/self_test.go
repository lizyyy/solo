package main

import (
	"bytes"
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/services"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"

	"github.com/gin-gonic/gin"
)

type TestResult struct {
	Name     string
	Passed   bool
	Message  string
	Category string
}

func main() {
	gin.SetMode(gin.TestMode)

	cfg := config.GetConfig()

	if err := database.InitDB(cfg.DatabasePath); err != nil {
		fmt.Printf("❌ 数据库初始化失败: %v\n", err)
		os.Exit(1)
	}
	defer database.CloseDB()

	if err := database.CreateTables(); err != nil {
		fmt.Printf("❌ 创建表失败: %v\n", err)
		os.Exit(1)
	}

	clearTestData()

	fmt.Println("🧪 ========================================")
	fmt.Println("🧪 洗车会员排队API - 自检脚本")
	fmt.Println("🧪 ========================================")

	results := []TestResult{}

	fmt.Println("\n📋 测试分类: 会员管理")
	results = append(results, testCreateMember()...)
	results = append(results, testDuplicateMember()...)
	results = append(results, testGetMemberByPhone()...)

	fmt.Println("\n📋 测试分类: 排队管理")
	results = append(results, testCreateQueue()...)
	results = append(results, testDuplicateQueue()...)
	results = append(results, testCallNext()...)
	results = append(results, testOvernumber()...)
	results = append(results, testRequeue()...)

	fmt.Println("\n📋 测试分类: 预约管理")
	results = append(results, testCreateAppointment()...)
	results = append(results, testLockAppointment()...)

	fmt.Println("\n📋 测试分类: 报告和导出")
	results = append(results, testGenerateReport()...)
	results = append(results, testExportCSV()...)

	fmt.Println("\n📋 测试分类: 异常处理")
	results = append(results, testDirtyData()...)
	results = append(results, testExceptionLogging()...)

	fmt.Println("\n" + strings.Repeat("=", 50))
	printFinalSummary(results)
	fmt.Println(strings.Repeat("=", 50))

	failedCount := 0
	for _, r := range results {
		if !r.Passed {
			failedCount++
		}
	}

	if failedCount > 0 {
		fmt.Printf("\n❌ 有 %d 个测试失败\n", failedCount)
		os.Exit(1)
	}

	fmt.Println("\n✅ 所有测试通过!")
}

func clearTestData() {
	db := database.GetDB()
	db.Exec("DELETE FROM exception_logs")
	db.Exec("DELETE FROM overnight_records")
	db.Exec("DELETE FROM queue_reports")
	db.Exec("DELETE FROM queue_numbers")
	db.Exec("DELETE FROM appointments")
	db.Exec("DELETE FROM stations")
	db.Exec("DELETE FROM members")
}

func testCreateMember() []TestResult {
	results := []TestResult{}

	member, err := services.CreateMember("测试用户", "13900000001")
	if err != nil {
		results = append(results, TestResult{"创建会员", false, err.Error(), "会员管理"})
	} else {
		results = append(results, TestResult{"创建会员", true, fmt.Sprintf("会员ID: %d", member.ID), "会员管理"})
	}

	return results
}

func testDuplicateMember() []TestResult {
	results := []TestResult{}

	_, err := services.CreateMember("重复用户", "13900000002")
	if err != nil {
		results = append(results, TestResult{"重复手机号拦截", false, "第一个用户创建失败", "会员管理"})
		return results
	}

	_, err = services.CreateMember("另一个用户", "13900000002")
	if err != nil && strings.Contains(err.Error(), "已存在") {
		results = append(results, TestResult{"重复手机号拦截", true, "正确拦截重复手机号", "会员管理"})
	} else {
		results = append(results, TestResult{"重复手机号拦截", false, "未拦截重复手机号", "会员管理"})
	}

	return results
}

func testGetMemberByPhone() []TestResult {
	results := []TestResult{}

	member, err := services.GetMemberByPhone("13900000001")
	if err != nil {
		results = append(results, TestResult{"按手机号查询会员", false, err.Error(), "会员管理"})
	} else if member != nil {
		results = append(results, TestResult{"按手机号查询会员", true, "成功查询会员信息", "会员管理"})
	} else {
		results = append(results, TestResult{"按手机号查询会员", false, "未找到会员", "会员管理"})
	}

	return results
}

func testCreateQueue() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("排队用户1", "13900000010")

	queue, err := services.CreateQueueNumber(&member.ID, nil, "标准洗")
	if err != nil {
		results = append(results, TestResult{"创建排队号", false, err.Error(), "排队管理"})
	} else {
		results = append(results, TestResult{"创建排队号", true, fmt.Sprintf("排队号: %s", queue.QueueNo), "排队管理"})
	}

	return results
}

func testDuplicateQueue() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("排队用户2", "13900000011")

	_, err := services.CreateQueueNumber(&member.ID, nil, "标准洗")
	if err != nil {
		results = append(results, TestResult{"重复取号拦截", false, "第一个排队号创建失败", "排队管理"})
		return results
	}

	_, err = services.CreateQueueNumber(&member.ID, nil, "标准洗")
	if err != nil && strings.Contains(err.Error(), "已有正在等待或服务中") {
		results = append(results, TestResult{"重复取号拦截", true, "正确拦截重复取号", "排队管理"})
	} else {
		results = append(results, TestResult{"重复取号拦截", false, "未拦截重复取号", "排队管理"})
	}

	return results
}

func testCallNext() []TestResult {
	results := []TestResult{}

	member1, _ := services.CreateMember("叫号用户1", "13900000012")
	member2, _ := services.CreateMember("叫号用户2", "13900000013")
	station, _ := services.CreateStation("测试工位")

	services.CreateQueueNumber(&member1.ID, nil, "标准洗")
	services.CreateQueueNumber(&member2.ID, nil, "标准洗")

	err := services.UpdateStationStatus(station.ID, "忙碌")
	if err != nil {
		results = append(results, TestResult{"叫号功能", false, "更新工位状态失败", "排队管理"})
		return results
	}

	queue, err := services.CallNextQueue()
	if err != nil {
		results = append(results, TestResult{"叫号功能", false, err.Error(), "排队管理"})
	} else {
		results = append(results, TestResult{"叫号功能", true, fmt.Sprintf("叫号成功: %s", queue.QueueNo), "排队管理"})
	}

	return results
}

func testOvernumber() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("过号用户", "13900000014")
	queue, _ := services.CreateQueueNumber(&member.ID, nil, "标准洗")

	_, err := services.MarkOvernumber(queue.ID, "测试过号")
	if err != nil {
		results = append(results, TestResult{"标记过号", false, err.Error(), "排队管理"})
	} else {
		results = append(results, TestResult{"标记过号", true, "成功标记过号", "排队管理"})
	}

	return results
}

func testRequeue() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("补排用户", "13900000015")
	queue, _ := services.CreateQueueNumber(&member.ID, nil, "标准洗")
	services.MarkOvernumber(queue.ID, "测试过号")

	requeued, err := services.RequeueOvernumber(queue.ID)
	if err != nil {
		results = append(results, TestResult{"过号补排", false, err.Error(), "排队管理"})
	} else {
		results = append(results, TestResult{"过号补排", true, fmt.Sprintf("补排成功: %s", requeued.QueueNo), "排队管理"})
	}

	return results
}

func testCreateAppointment() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("预约用户", "13900000020")

	appointment, err := services.CreateAppointment(member.ID, "标准洗", "2024-01-16", "14:00")
	if err != nil {
		results = append(results, TestResult{"创建预约", false, err.Error(), "预约管理"})
	} else {
		results = append(results, TestResult{"创建预约", true, fmt.Sprintf("预约ID: %d", appointment.ID), "预约管理"})
	}

	return results
}

func testLockAppointment() []TestResult {
	results := []TestResult{}

	member, _ := services.CreateMember("锁位用户", "13900000021")
	station, _ := services.CreateStation("锁位工位")

	appointment, _ := services.CreateAppointment(member.ID, "标准洗", "2024-01-17", "15:00")

	locked, err := services.LockAppointment(appointment.ID, station.ID)
	if err != nil {
		results = append(results, TestResult{"预约锁位", false, err.Error(), "预约管理"})
	} else {
		results = append(results, TestResult{"预约锁位", true, fmt.Sprintf("锁位成功: %s", locked.Status), "预约管理"})
	}

	return results
}

func testGenerateReport() []TestResult {
	results := []TestResult{}

	report, err := services.GenerateDailyReport("2024-01-15")
	if err != nil {
		results = append(results, TestResult{"生成日报", false, err.Error(), "报告和导出"})
	} else {
		results = append(results, TestResult{"生成日报", true, fmt.Sprintf("总排队数: %d", report.TotalQueue), "报告和导出"})
	}

	return results
}

func testExportCSV() []TestResult {
	results := []TestResult{}

	csv, _, _, err := services.ExportReportToCSV("2024-01-15")
	if err != nil {
		results = append(results, TestResult{"导出CSV", false, err.Error(), "报告和导出"})
	} else if strings.Contains(csv, "排队号") {
		results = append(results, TestResult{"导出CSV", true, "CSV格式正确", "报告和导出"})
	} else {
		results = append(results, TestResult{"导出CSV", false, "CSV格式不正确", "报告和导出"})
	}

	return results
}

func testDirtyData() []TestResult {
	results := []TestResult{}

	_, err := services.CreateMember("", "")
	if err != nil && (strings.Contains(err.Error(), "不能为空") || strings.Contains(err.Error(), "必填")) {
		results = append(results, TestResult{"脏数据-空会员", true, "正确拦截空数据", "异常处理"})
	} else {
		results = append(results, TestResult{"脏数据-空会员", false, "未正确拦截", "异常处理"})
	}

	_, err = services.CreateQueueNumber(nil, nil, "invalid_type")
	if err != nil && (strings.Contains(err.Error(), "无效") || strings.Contains(err.Error(), "service")) {
		results = append(results, TestResult{"脏数据-无效服务类型", true, "正确拦截无效服务类型", "异常处理"})
	} else {
		results = append(results, TestResult{"脏数据-无效服务类型", false, "未正确拦截", "异常处理"})
	}

	return results
}

func testExceptionLogging() []TestResult {
	results := []TestResult{}

	services.LogException("/api/test", "POST", `{"test": "data"}`, "测试错误", "测试结论")

	logs, err := services.GetExceptionLogs(1)
	if err != nil {
		results = append(results, TestResult{"异常日志记录", false, err.Error(), "异常处理"})
	} else if len(logs) > 0 {
		results = append(results, TestResult{"异常日志记录", true, "异常日志已保存", "异常处理"})
	} else {
		results = append(results, TestResult{"异常日志记录", false, "异常日志未保存", "异常处理"})
	}

	return results
}

func printFinalSummary(results []TestResult) {
	categories := make(map[string][]TestResult)
	for _, r := range results {
		categories[r.Category] = append(categories[r.Category], r)
	}

	totalPassed := 0
	totalFailed := 0

	for category, tests := range categories {
		passed := 0
		failed := 0

		fmt.Printf("\n📂 %s:\n", category)
		for _, t := range tests {
			if t.Passed {
				passed++
				fmt.Printf("   ✅ %s - %s\n", t.Name, t.Message)
			} else {
				failed++
				fmt.Printf("   ❌ %s - %s\n", t.Name, t.Message)
			}
		}

		totalPassed += passed
		totalFailed += failed
		fmt.Printf("   %s %d/%d 通过\n", getStatusIcon(passed, failed), passed, passed+failed)
	}

	fmt.Printf("\n📊 总体结果: ")
	if totalFailed == 0 {
		fmt.Printf("✅ 全部通过 (%d/%d)\n", totalPassed, totalPassed+totalFailed)
	} else {
		fmt.Printf("⚠️  部分失败 (%d/%d 通过)\n", totalPassed, totalPassed+totalFailed)
	}
}

func getStatusIcon(passed, failed int) string {
	if failed == 0 {
		return "✅"
	}
	return "⚠️"
}

func performRequest(r *gin.Engine, method, path string, body interface{}) *httptest.ResponseRecorder {
	var reqBody []byte
	if body != nil {
		reqBody, _ = json.Marshal(body)
	}

	req, _ := http.NewRequest(method, path, bytes.NewBuffer(reqBody))
	req.Header.Set("Content-Type", "application/json")

	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	return w
}
