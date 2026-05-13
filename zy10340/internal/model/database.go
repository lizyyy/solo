package model

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB(dbPath string) error {
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return err
	}

	return DB.AutoMigrate(
		&Tenant{},
		&TrafficSample{},
		&ThrottleRule{},
		&ReplayPlan{},
		&PausePoint{},
		&ReplayResult{},
		&IdempotencyRecord{},
	)
}
