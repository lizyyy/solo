package database

import (
	"runtime-guardrail/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("guardrail.db"), &gorm.Config{})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&models.ParameterItem{},
		&models.AllowedRange{},
		&models.CallingService{},
		&models.ChangeRequest{},
		&models.EffectiveResult{},
		&models.RollbackRecord{},
		&models.AuditLog{},
	)
	if err != nil {
		return err
	}

	return nil
}

func GetDB() *gorm.DB {
	return DB
}
