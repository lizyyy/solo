package database

import (
	"customer-probe-api/internal/models"
	"log"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func InitDB() error {
	dbDir := "./data"
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return err
	}

	dbPath := filepath.Join(dbDir, "probe.db")
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	err = db.AutoMigrate(
		&models.CustomerEnvironment{},
		&models.ProbeTask{},
		&models.NetworkResult{},
		&models.DNSRecord{},
		&models.ProxySetting{},
		&models.DiagnosisConclusion{},
	)
	if err != nil {
		return err
	}

	DB = db
	log.Println("Database initialized successfully")
	return nil
}

func GetDB() *gorm.DB {
	return DB
}
