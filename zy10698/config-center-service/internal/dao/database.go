package dao

import (
	"config-center-service/internal/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	db, err := gorm.Open(sqlite.Open("config_center.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&model.RollbackConfirmation{},
		&model.ConfigRelease{},
		&model.InstancePullLog{},
		&model.GrayGroup{},
	)
	if err != nil {
		return err
	}

	DB = db
	return nil
}
