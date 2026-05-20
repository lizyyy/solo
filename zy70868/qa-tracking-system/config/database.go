package config

import (
	"qa-tracking-system/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	db, err := gorm.Open(sqlite.Open("qa_tracking.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&models.Batch{},
		&models.Sample{},
		&models.TestProtocol{},
		&models.ChamberRecord{},
		&models.SampleNode{},
		&models.TrackingLog{},
		&models.ExceptionEvent{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}
