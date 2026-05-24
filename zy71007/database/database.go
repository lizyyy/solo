package database

import (
	"dialysis-recall-api/models"
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() {
	var err error
	DB, err = gorm.Open(sqlite.Open("dialysis_recall.db"), &gorm.Config{})
	if err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	err = DB.AutoMigrate(
		&models.Material{},
		&models.Patient{},
		&models.DialysisShift{},
		&models.ConsumptionRecord{},
		&models.RecallNotice{},
		&models.TraceResult{},
		&models.ReviewRecord{},
		&models.TraceHistory{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
	}

	log.Println("Database initialized successfully")
}

func GetDB() *gorm.DB {
	return DB
}
