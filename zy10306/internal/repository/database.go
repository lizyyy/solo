package repository

import (
	"sampling-rule-api/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDatabase() error {
	db, err := gorm.Open(sqlite.Open("sampling_rules.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	db.AutoMigrate(&models.SamplingRule{}, &models.HitRecord{}, &models.HistoryRecord{})

	DB = db
	return nil
}
