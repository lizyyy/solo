package utils

import (
	"third-party-api-circuit-breaker/config"
	"third-party-api-circuit-breaker/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() error {
	db, err := gorm.Open(sqlite.Open(config.AppConfig.Database.Path), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&models.ExternalAPI{},
		&models.BusinessCaller{},
		&models.CircuitThreshold{},
		&models.CircuitBreaker{},
		&models.ProbeResult{},
		&models.HalfOpenRequest{},
		&models.RecoveryConclusion{},
		&models.ArbitrationLog{},
		&models.RequestDeduplication{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}
