package dao

import (
	"fuel-subsidy-api/internal/config"
	"fuel-subsidy-api/internal/models"
	"log"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB(cfg *config.Config) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.DatabasePath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&models.Auditor{},
		&models.FishingVessel{},
		&models.FishingBanPeriod{},
		&models.FuelReceipt{},
		&models.Voyage{},
		&models.SubsidyApplication{},
		&models.ApplicationReceipt{},
		&models.AuditLog{},
		&models.SubsidyReport{},
	)
	if err != nil {
		return err
	}

	if err := seedInitialData(); err != nil {
		log.Printf("Warning: failed to seed initial data: %v", err)
	}

	return nil
}

func seedInitialData() error {
	var count int64
	DB.Model(&models.Auditor{}).Count(&count)
	if count > 0 {
		return nil
	}

	auditors := []models.Auditor{
		{Username: "admin", Name: "系统管理员", Role: "admin"},
		{Username: "auditor1", Name: "张审核", Role: "auditor"},
		{Username: "auditor2", Name: "李审核", Role: "auditor"},
		{Username: "reviewer", Name: "王复核", Role: "reviewer"},
	}

	for _, a := range auditors {
		if err := DB.Create(&a).Error; err != nil {
			return err
		}
	}

	now := time.Now()
	banPeriods := []models.FishingBanPeriod{
		{
			Year:        2024,
			Region:      "东海",
			StartDate:   time.Date(2024, 5, 1, 0, 0, 0, 0, time.Local),
			EndDate:     time.Date(2024, 8, 16, 23, 59, 59, 0, time.Local),
			Description: "东海禁渔期",
		},
		{
			Year:        2025,
			Region:      "东海",
			StartDate:   time.Date(2025, 5, 1, 0, 0, 0, 0, time.Local),
			EndDate:     time.Date(2025, 8, 16, 23, 59, 59, 0, time.Local),
			Description: "东海禁渔期",
		},
	}

	for _, bp := range banPeriods {
		if err := DB.Create(&bp).Error; err != nil {
			return err
		}
	}

	vessels := []models.FishingVessel{
		{
			VesselNumber:    "浙渔00001",
			VesselName:      "丰收一号",
			OwnerName:       "张三",
			OwnerIDCard:     "330101198001010001",
			ContactPhone:    "13800138001",
			Power:           120,
			Tonnage:         50,
			RegistrationOrg: "浙江省海洋与渔业局",
			ValidFrom:       time.Date(2020, 1, 1, 0, 0, 0, 0, time.Local),
			ValidTo:         time.Date(2030, 1, 1, 0, 0, 0, 0, time.Local),
		},
		{
			VesselNumber:    "浙渔00002",
			VesselName:      "丰收二号",
			OwnerName:       "李四",
			OwnerIDCard:     "330101198002020002",
			ContactPhone:    "13800138002",
			Power:           150,
			Tonnage:         60,
			RegistrationOrg: "浙江省海洋与渔业局",
			ValidFrom:       time.Date(2020, 1, 1, 0, 0, 0, 0, time.Local),
			ValidTo:         time.Date(2030, 1, 1, 0, 0, 0, 0, time.Local),
		},
	}

	for _, v := range vessels {
		if err := DB.Create(&v).Error; err != nil {
			return err
		}
	}

	_ = now
	return nil
}
