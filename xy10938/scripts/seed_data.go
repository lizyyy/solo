package main

import (
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/services"
	"fmt"
)

func main() {
	cfg := config.GetConfig()

	if err := database.InitDB(cfg.DatabasePath); err != nil {
		panic("Failed to initialize database: " + err.Error())
	}
	defer database.CloseDB()

	if err := database.CreateTables(); err != nil {
		panic("Failed to create tables: " + err.Error())
	}

	fmt.Println("🧹 开始清理旧数据...")
	clearAllData()

	fmt.Println("\n📊 开始插入示例数据...")

	fmt.Println("\n1️⃣ 创建会员...")
	createMembers()

	fmt.Println("\n2️⃣ 创建工位...")
	createStations()

	fmt.Println("\n3️⃣ 创建预约...")
	createAppointments()

	fmt.Println("\n4️⃣ 创建排队号...")
	createQueueNumbers()

	fmt.Println("\n✅ 示例数据初始化完成!")
	fmt.Println("\n📋 数据摘要:")
	printSummary()
}

func clearAllData() {
	db := database.GetDB()
	db.Exec("DELETE FROM exception_logs")
	db.Exec("DELETE FROM overnight_records")
	db.Exec("DELETE FROM queue_reports")
	db.Exec("DELETE FROM queue_numbers")
	db.Exec("DELETE FROM appointments")
	db.Exec("DELETE FROM stations")
	db.Exec("DELETE FROM members")
}

func createMembers() {
	members := []struct {
		name  string
		phone string
	}{
		{"张三", "13800138001"},
		{"李四", "13800138002"},
		{"王五", "13800138003"},
		{"赵六", "13800138004"},
		{"陈七", "13800138005"},
	}

	for _, m := range members {
		_, err := services.CreateMember(m.name, m.phone)
		if err != nil {
			fmt.Printf("  ⚠️  创建会员失败 %s: %v\n", m.name, err)
		} else {
			fmt.Printf("  ✅ %s (%s)\n", m.name, m.phone)
		}
	}
}

func createStations() {
	stations := []struct {
		name        string
		serviceType string
	}{
		{"1号工位", "normal"},
		{"2号工位", "normal"},
		{"3号工位", "detail"},
		{"4号工位", "detailing"},
	}

	for _, s := range stations {
		_, err := services.CreateStation(s.name, s.serviceType)
		if err != nil {
			fmt.Printf("  ⚠️  创建工位失败 %s: %v\n", s.name, err)
		} else {
			fmt.Printf("  ✅ %s (%s)\n", s.name, s.serviceType)
		}
	}
}

func createAppointments() {
	appointments := []struct {
		memberID    int
		serviceType string
		date        string
		time        string
	}{
		{1, "normal", "2024-01-15", "09:00"},
		{2, "detail", "2024-01-15", "10:00"},
		{3, "normal", "2024-01-15", "11:00"},
	}

	for _, a := range appointments {
		_, err := services.CreateAppointment(a.memberID, a.serviceType, a.date, a.time)
		if err != nil {
			fmt.Printf("  ⚠️  创建预约失败: %v\n", err)
		} else {
			fmt.Printf("  ✅ 会员%d - %s %s %s\n", a.memberID, a.serviceType, a.date, a.time)
		}
	}
}

func createQueueNumbers() {
	queues := []struct {
		memberID    int
		serviceType string
	}{
		{1, "normal"},
		{2, "detail"},
		{4, "normal"},
	}

	for _, q := range queues {
		memberID := q.memberID
		_, err := services.CreateQueueNumber(&memberID, nil, q.serviceType)
		if err != nil {
			fmt.Printf("  ⚠️  创建排队号失败: %v\n", err)
		} else {
			fmt.Printf("  ✅ 会员%d - %s\n", q.memberID, q.serviceType)
		}
	}
}

func printSummary() {
	db := database.GetDB()

	var memberCount int
	db.QueryRow("SELECT COUNT(*) FROM members").Scan(&memberCount)

	var stationCount int
	db.QueryRow("SELECT COUNT(*) FROM stations").Scan(&stationCount)

	var appointmentCount int
	db.QueryRow("SELECT COUNT(*) FROM appointments").Scan(&appointmentCount)

	var queueCount int
	db.QueryRow("SELECT COUNT(*) FROM queue_numbers").Scan(&queueCount)

	fmt.Printf("  会员: %d 人\n", memberCount)
	fmt.Printf("  工位: %d 个\n", stationCount)
	fmt.Printf("  预约: %d 个\n", appointmentCount)
	fmt.Printf("  排队号: %d 个\n", queueCount)
}
