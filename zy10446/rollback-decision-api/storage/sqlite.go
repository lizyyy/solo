package storage

import (
	"rollback-decision-api/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	db, err := gorm.Open(sqlite.Open("rollback_decision.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&models.ReleaseBatch{},
		&models.CoreMetric{},
		&models.AuxiliaryMetric{},
		&models.ThresholdRule{},
		&models.DecisionRecord{},
		&models.RollbackSummary{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
