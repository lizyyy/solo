package main

import (
	"fmt"
	"log"
	"time"
	"watermeter-api/database"
	"watermeter-api/handlers"
	"watermeter-api/models"
	"watermeter-api/utils"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

func main() {
	db, err := database.InitDB()
	if err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	if err := seedTestData(db); err != nil {
		log.Println("Warning: Failed to seed test data:", err)
	}

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handler := handlers.NewAppealHandler()

	api := r.Group("/api")
	{
		api.POST("/appeals", handler.SubmitAppeal)
		api.POST("/appeals/batch", handler.BatchSubmit)
		api.GET("/appeals", handler.ListAppeals)
		api.GET("/appeals/:appealNo", handler.GetAppeal)
		api.POST("/appeals/:appealNo/split", handler.SplitAnomalies)
		api.GET("/appeals/:appealNo/recalculate", handler.RecalculateBills)
		api.POST("/appeals/:appealNo/close", handler.CloseAppeal)
		api.POST("/appeals/:appealNo/archive", handler.ArchiveAppeal)
		api.POST("/appeals/:appealNo/withdraw", handler.WithdrawAppeal)
		api.GET("/appeals/check/duplicate", handler.CheckDuplicate)

		api.POST("/reviews", handler.CreateReviewReport)
		api.POST("/reviews/:reportNo/finalize", handler.FinalizeReview)
		api.POST("/reviews/:reportNo/manual-correct", handler.ManualCorrect)

		api.POST("/export/appeals", handler.ExportAppeals)
	}

	go func() {
		time.Sleep(2 * time.Second)
		fmt.Println("\n========================================")
		fmt.Println("水表异常申诉 API 服务已启动")
		fmt.Println("服务地址: http://localhost:8080")
		fmt.Println("API 文档:")
		fmt.Println("  POST /api/appeals          - 提交申诉")
		fmt.Println("  POST /api/appeals/batch    - 批次提交")
		fmt.Println("  GET  /api/appeals          - 申诉列表")
		fmt.Println("  GET  /api/appeals/:id      - 申诉详情")
		fmt.Println("  POST /api/appeals/:id/split   - 异常拆分")
		fmt.Println("  GET  /api/appeals/:id/recalculate - 账单重算")
		fmt.Println("  POST /api/appeals/:id/close - 结案")
		fmt.Println("  POST /api/appeals/:id/archive - 归档")
		fmt.Println("  POST /api/appeals/:id/withdraw - 撤回")
		fmt.Println("  POST /api/reviews          - 创建复核报告")
		fmt.Println("  POST /api/reviews/:id/finalize - 定稿复核")
		fmt.Println("  POST /api/reviews/:id/manual-correct - 人工修正")
		fmt.Println("  POST /api/export/appeals   - 导出结果")
		fmt.Println("========================================\n")
	}()

	r.Run(":8080")
}

func seedTestData(db *gorm.DB) error {
	var count int64
	db.Model(&models.WaterMeter{}).Count(&count)
	if count > 0 {
		return nil
	}

	meters := []models.WaterMeter{
		{
			MeterNo:     "WM001",
			UserID:      "U001",
			UserName:    "张三",
			Address:     "北京市朝阳区小区1号楼101室",
			InstallDate: time.Date(2020, 1, 15, 0, 0, 0, 0, time.UTC),
			Status:      "active",
		},
		{
			MeterNo:     "WM002",
			UserID:      "U002",
			UserName:    "李四",
			Address:     "北京市海淀区小区2号楼202室",
			InstallDate: time.Date(2020, 2, 20, 0, 0, 0, 0, time.UTC),
			Status:      "active",
		},
		{
			MeterNo:     "WM003",
			UserID:      "U003",
			UserName:    "王五",
			Address:     "北京市西城区小区3号楼303室",
			InstallDate: time.Date(2020, 3, 10, 0, 0, 0, 0, time.UTC),
			Status:      "active",
		},
	}
	for i := range meters {
		db.Create(&meters[i])
	}

	readings := []models.MeterReading{
		{MeterNo: "WM001", ReadingDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Reading: 100.0, BillCycle: "2024-01", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM001", ReadingDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), Reading: 112.0, BillCycle: "2024-02", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM001", ReadingDate: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), Reading: 125.5, BillCycle: "2024-03", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM001", ReadingDate: time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC), Reading: 140.0, BillCycle: "2024-04", Operator: "系统", ReadingType: "auto"},

		{MeterNo: "WM002", ReadingDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Reading: 200.0, BillCycle: "2024-01", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM002", ReadingDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), Reading: 195.0, BillCycle: "2024-02", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM002", ReadingDate: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), Reading: 210.0, BillCycle: "2024-03", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM002", ReadingDate: time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC), Reading: 280.0, BillCycle: "2024-04", Operator: "系统", ReadingType: "auto"},

		{MeterNo: "WM003", ReadingDate: time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC), Reading: 150.0, BillCycle: "2024-01", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM003", ReadingDate: time.Date(2024, 2, 1, 0, 0, 0, 0, time.UTC), Reading: 165.0, BillCycle: "2024-02", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM003", ReadingDate: time.Date(2024, 3, 1, 0, 0, 0, 0, time.UTC), Reading: 182.0, BillCycle: "2024-03", Operator: "系统", ReadingType: "auto"},
		{MeterNo: "WM003", ReadingDate: time.Date(2024, 4, 1, 0, 0, 0, 0, time.UTC), Reading: 200.0, BillCycle: "2024-04", Operator: "系统", ReadingType: "auto"},
	}
	for i := range readings {
		db.Create(&readings[i])
	}

	leaks := []models.LeakRecord{
		{
			MeterNo:         "WM002",
			LeakStartDate:   time.Date(2024, 2, 15, 0, 0, 0, 0, time.UTC),
			LeakEndDate:     time.Date(2024, 3, 20, 0, 0, 0, 0, time.UTC),
			DailyLeakAmount: 1.5,
			LeakLocation:    "厨房地下水管",
			LeakCause:       "水管老化破裂",
			RepairDate:      time.Date(2024, 3, 21, 0, 0, 0, 0, time.UTC),
			IsConfirmed:     true,
		},
		{
			MeterNo:         "WM003",
			LeakStartDate:   time.Date(2024, 1, 20, 0, 0, 0, 0, time.UTC),
			LeakEndDate:     time.Date(2024, 2, 5, 0, 0, 0, 0, time.UTC),
			DailyLeakAmount: 0.8,
			LeakLocation:    "卫生间马桶",
			LeakCause:       "密封垫损坏",
			RepairDate:      time.Date(2024, 2, 6, 0, 0, 0, 0, time.UTC),
			IsConfirmed:     true,
		},
	}
	for i := range leaks {
		db.Create(&leaks[i])
	}

	tiers := []models.TierPrice{
		{TierLevel: 1, TierName: "第一阶梯", MinUsage: 0, MaxUsage: 15, PricePerTon: 2.80, EffectiveDate: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC), ExpireDate: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC), IsActive: true},
		{TierLevel: 2, TierName: "第二阶梯", MinUsage: 15, MaxUsage: 30, PricePerTon: 4.20, EffectiveDate: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC), ExpireDate: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC), IsActive: true},
		{TierLevel: 3, TierName: "第三阶梯", MinUsage: 30, MaxUsage: 0, PricePerTon: 8.40, EffectiveDate: time.Date(2023, 1, 1, 0, 0, 0, 0, time.UTC), ExpireDate: time.Date(2025, 12, 31, 0, 0, 0, 0, time.UTC), IsActive: true},
	}
	for i := range tiers {
		db.Create(&tiers[i])
	}

	bills := []models.BillRecord{
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM001", BillCycle: "2024-01", StartReading: 100.0, EndReading: 112.0, Usage: 12.0, Tier1Usage: 12.0, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 33.60, BillDate: time.Date(2024, 1, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 1, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM001", BillCycle: "2024-02", StartReading: 112.0, EndReading: 125.5, Usage: 13.5, Tier1Usage: 13.5, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 37.80, BillDate: time.Date(2024, 2, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 2, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM001", BillCycle: "2024-03", StartReading: 125.5, EndReading: 140.0, Usage: 14.5, Tier1Usage: 14.5, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 40.60, BillDate: time.Date(2024, 3, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 3, 25, 0, 0, 0, 0, time.UTC)},

		{BillNo: utils.GenerateBillNo(), MeterNo: "WM002", BillCycle: "2024-01", StartReading: 200.0, EndReading: 195.0, Usage: 0, Tier1Usage: 0, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 0.00, BillDate: time.Date(2024, 1, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 1, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM002", BillCycle: "2024-02", StartReading: 195.0, EndReading: 210.0, Usage: 15.0, Tier1Usage: 15.0, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 42.00, BillDate: time.Date(2024, 2, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 2, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM002", BillCycle: "2024-03", StartReading: 210.0, EndReading: 280.0, Usage: 70.0, Tier1Usage: 15.0, Tier2Usage: 15.0, Tier3Usage: 40.0, TotalAmount: 441.00, BillDate: time.Date(2024, 3, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 3, 25, 0, 0, 0, 0, time.UTC)},

		{BillNo: utils.GenerateBillNo(), MeterNo: "WM003", BillCycle: "2024-01", StartReading: 150.0, EndReading: 165.0, Usage: 15.0, Tier1Usage: 15.0, Tier2Usage: 0, Tier3Usage: 0, TotalAmount: 42.00, BillDate: time.Date(2024, 1, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 1, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM003", BillCycle: "2024-02", StartReading: 165.0, EndReading: 182.0, Usage: 17.0, Tier1Usage: 15.0, Tier2Usage: 2.0, Tier3Usage: 0, TotalAmount: 50.40, BillDate: time.Date(2024, 2, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 2, 25, 0, 0, 0, 0, time.UTC)},
		{BillNo: utils.GenerateBillNo(), MeterNo: "WM003", BillCycle: "2024-03", StartReading: 182.0, EndReading: 200.0, Usage: 18.0, Tier1Usage: 15.0, Tier2Usage: 3.0, Tier3Usage: 0, TotalAmount: 54.60, BillDate: time.Date(2024, 3, 5, 0, 0, 0, 0, time.UTC), DueDate: time.Date(2024, 3, 25, 0, 0, 0, 0, time.UTC)},
	}
	for i := range bills {
		db.Create(&bills[i])
	}

	log.Println("测试数据已初始化")
	return nil
}
