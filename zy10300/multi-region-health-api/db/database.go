package db

import (
	"multi-region-health-api/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("health_api.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&models.Region{},
		&models.Service{},
		&models.ProbeResult{},
		&models.Dependency{},
		&models.DegradeAction{},
		&models.RecoveryRecord{},
	)
	if err != nil {
		return err
	}

	return nil
}

func GetDB() *gorm.DB {
	return DB
}
