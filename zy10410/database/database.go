package database

import (
	"task-recovery-api/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var DB *gorm.DB

func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("task_recovery.db"), &gorm.Config{})
	if err != nil {
		return err
	}
	
	return DB.AutoMigrate(
		&models.TaskRecovery{},
		&models.TaskImpact{},
		&models.TaskLog{},
	)
}

func GetDB() *gorm.DB {
	return DB
}
