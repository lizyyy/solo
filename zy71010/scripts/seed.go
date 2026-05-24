package main

import (
	"fmt"
	"log"
	"math/rand"
	"time"

	"vet-vaccine-cold-chain/database"
	"vet-vaccine-cold-chain/models"
	"vet-vaccine-cold-chain/repository"
	"vet-vaccine-cold-chain/service"
)

func main() {
	if err := database.Init("./cold_chain.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

	fmt.Println("开始生成测试数据...")

	fridges := []models.Refrigerator{
		{Name: "疫苗冰箱A", Location: "门诊一楼药房"},
		{Name: "疫苗冰箱B", Location: "门诊二楼接种室"},
		{Name: "备用疫苗冰箱C", Location: "地下仓库"},
	}

	for i := range fridges {
		if err := repository.CreateRefrigerator(&fridges[i]); err != nil {
			log.Printf("创建冰箱失败: %v", err)
		} else {
			fmt.Printf("创建冰箱: %s (ID: %s)\n", fridges[i].Name, fridges[i].ID)
		}
	}

	vaccines := []models.Vaccine{
		{
			BatchNumber:  "CV2024001",
			Name:         "犬四联疫苗",
			Manufacturer: "某生物制药公司",
			ExpiryDate:   time.Now().AddDate(0, 6, 0),
			TotalDoses:   100,
		},
		{
			BatchNumber:  "CV2024002",
			Name:         "猫三联疫苗",
			Manufacturer: "某生物制药公司",
			ExpiryDate:   time.Now().AddDate(0, 8, 0),
			TotalDoses:   80,
		},
		{
			BatchNumber:  "RV2024001",
			Name:         "狂犬病疫苗",
			Manufacturer: "另一家生物公司",
			ExpiryDate:   time.Now().AddDate(1, 0, 0),
			TotalDoses:   50,
		},
	}

	for i := range vaccines {
		if err := repository.CreateVaccine(&vaccines[i]); err != nil {
			log.Printf("创建疫苗失败: %v", err)
		} else {
			fmt.Printf("创建疫苗: %s (批号: %s)\n", vaccines[i].Name, vaccines[i].BatchNumber)
		}
	}

	inventories := []models.VaccineInventory{
		{
			BatchNumber:    "CV2024001",
			RefrigeratorID: fridges[0].ID,
			DosesCount:     50,
			Status:         "in_stock",
		},
		{
			BatchNumber:    "CV2024002",
			RefrigeratorID: fridges[0].ID,
			DosesCount:     40,
			Status:         "in_stock",
		},
		{
			BatchNumber:    "RV2024001",
			RefrigeratorID: fridges[1].ID,
			DosesCount:     50,
			Status:         "in_stock",
		},
	}

	for i := range inventories {
		if err := repository.CreateVaccineInventory(&inventories[i]); err != nil {
			log.Printf("创建库存失败: %v", err)
		} else {
			fmt.Printf("创建库存: %s @ 冰箱ID: %s\n", inventories[i].BatchNumber, inventories[i].RefrigeratorID)
		}
	}

	fmt.Println("\n生成温度记录...")
	now := time.Now()
	for _, fridge := range fridges {
		for h := 24; h >= 0; h-- {
			temp := 4.0 + rand.Float64()*3.0 - 1.5
			if rand.Float64() < 0.05 {
				temp = 9.0 + rand.Float64()*2.0
			}
			if rand.Float64() < 0.03 {
				temp = 1.0 - rand.Float64()*1.0
			}

			tr := models.TemperatureRecord{
				RefrigeratorID: fridge.ID,
				Temperature:    temp,
				RecordedAt:     now.Add(-time.Duration(h) * time.Hour),
				RecordedBy:     "系统自动记录",
			}
			if err := repository.CreateTemperatureRecord(&tr); err != nil {
				log.Printf("创建温度记录失败: %v", err)
			}
		}
	}
	fmt.Println("温度记录生成完成")

	fmt.Println("\n创建开瓶记录...")
	openRecords := []models.OpenRecord{
		{
			InventoryID: inventories[0].ID,
			BatchNumber: "CV2024001",
			OpenedAt:    now.Add(-3 * time.Hour),
			OpenedBy:    "张医生",
			DosesUsed:   3,
			Status:      "opened",
		},
		{
			InventoryID: inventories[2].ID,
			BatchNumber: "RV2024001",
			OpenedAt:    now.Add(-7 * time.Hour),
			OpenedBy:    "李医生",
			DosesUsed:   2,
			Status:      "opened",
		},
	}

	for i := range openRecords {
		if err := repository.CreateOpenRecord(&openRecords[i]); err != nil {
			log.Printf("创建开瓶记录失败: %v", err)
		} else {
			fmt.Printf("创建开瓶记录: 批号 %s, 开瓶人 %s\n", openRecords[i].BatchNumber, openRecords[i].OpenedBy)
		}
	}

	fmt.Println("\n创建调拨记录...")
	if err := service.ProcessVaccineTransfer("CV2024001", fridges[0].ID, fridges[1].ID, 20, "王管理员", "接种高峰调配"); err != nil {
		log.Printf("创建调拨记录失败: %v", err)
	} else {
		fmt.Printf("创建调拨: CV2024001 从 %s 调拨到 %s, 20剂\n", fridges[0].Name, fridges[1].Name)
	}

	fmt.Println("\n创建废弃记录...")
	discard := models.DiscardRecord{
		BatchNumber: "CV2024002",
		DosesCount:  5,
		Reason:      "瓶身破损",
		DiscardedBy: "赵护士",
		Confirmed:   false,
	}
	if err := repository.CreateDiscardRecord(&discard); err != nil {
		log.Printf("创建废弃记录失败: %v", err)
	} else {
		fmt.Printf("创建废弃记录: 批号 %s, 原因: %s\n", discard.BatchNumber, discard.Reason)
	}

	fmt.Println("\n创建接种记录...")
	vaccinations := []models.VaccinationRecord{
		{
			BatchNumber:     "CV2024001",
			OpenRecordID:    openRecords[0].ID,
			PatientID:       "PET001",
			DoctorSignature: "张医生",
		},
		{
			BatchNumber:     "CV2024001",
			OpenRecordID:    openRecords[0].ID,
			PatientID:       "PET002",
			DoctorSignature: "张医生",
		},
		{
			BatchNumber:     "RV2024001",
			OpenRecordID:    openRecords[1].ID,
			PatientID:       "PET003",
			DoctorSignature: "李医生",
		},
	}

	for i := range vaccinations {
		if err := repository.CreateVaccinationRecord(&vaccinations[i]); err != nil {
			log.Printf("创建接种记录失败: %v", err)
		} else {
			fmt.Printf("创建接种记录: 患者 %s, 批号 %s\n", vaccinations[i].PatientID, vaccinations[i].BatchNumber)
		}
	}

	fmt.Println("\n=== 测试数据生成完成 ===")
	fmt.Printf("冰箱数量: %d\n", len(fridges))
	fmt.Printf("疫苗种类: %d\n", len(vaccines))
	fmt.Println("冰箱ID列表:")
	for _, f := range fridges {
		fmt.Printf("  - %s: %s\n", f.Name, f.ID)
	}
	fmt.Println("开瓶记录ID列表:")
	for _, o := range openRecords {
		fmt.Printf("  - %s (批号: %s)\n", o.ID, o.BatchNumber)
	}
}
