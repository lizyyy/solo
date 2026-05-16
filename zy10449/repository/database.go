package repository

import (
	"webhook-migration/model"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func InitDB() error {
	db, err := gorm.Open(sqlite.Open("webhook_migration.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&model.Supplier{},
		&model.Migration{},
		&model.EventRecord{},
		&model.StatusTransition{},
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
