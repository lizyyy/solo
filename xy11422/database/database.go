package database

import (
	"used-car-retry-queue/config"
	"used-car-retry-queue/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init(cfg *config.DatabaseConfig) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.Path), &gorm.Config{})
	if err != nil {
		return err
	}

	return DB.AutoMigrate(
		&models.Receipt{},
		&models.StatusHistory{},
		&models.RetryTask{},
		&models.CompensationRecord{},
		&models.ImportRecord{},
	)
}

func GetDB() *gorm.DB {
	return DB
}
