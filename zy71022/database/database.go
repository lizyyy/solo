package database

import (
	"log"
	"watermeter-api/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open("watermeter.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("Failed to connect database:", err)
		return nil, err
	}

	err = db.AutoMigrate(
		&models.WaterMeter{},
		&models.MeterReading{},
		&models.LeakRecord{},
		&models.TierPrice{},
		&models.Appeal{},
		&models.ReviewReport{},
		&models.AppealAnomaly{},
		&models.BillRecord{},
	)
	if err != nil {
		log.Fatal("Failed to migrate database:", err)
		return nil, err
	}

	DB = db
	return db, nil
}

func GetDB() *gorm.DB {
	return DB
}
