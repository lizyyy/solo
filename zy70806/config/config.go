package config

import (
	"log"
	"customs-reconciliation/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("customs_reconciliation.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	
	err = DB.AutoMigrate(
		&models.Declaration{},
		&models.Tariff{},
		&models.ReturnReceipt{},
		&models.ReconciliationBatch{},
		&models.ReconciliationItem{},
		&models.Discrepancy{},
		&models.ReviewRecord{},
		&models.ExchangeRate{},
		&models.Report{},
	)
	if err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	
	log.Println("Database connected and migrated successfully")
}
