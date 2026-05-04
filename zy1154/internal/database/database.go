package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"saga-demo/internal/models"
)

var DB *gorm.DB

type Config struct {
	DBPath     string
	LogLevel   logger.LogLevel
	AutoMigrate bool
}

func DefaultConfig() *Config {
	return &Config{
		DBPath:      "./data/saga.db",
		LogLevel:    logger.Info,
		AutoMigrate: true,
	}
}

func Init(cfg *Config) error {
	if cfg == nil {
		cfg = DefaultConfig()
	}

	dir := filepath.Dir(cfg.DBPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	newLogger := logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             time.Second,
			LogLevel:                  cfg.LogLevel,
			IgnoreRecordNotFoundError: true,
			Colorful:                  true,
		},
	)

	var err error
	DB, err = gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{
		Logger: newLogger,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	if cfg.AutoMigrate {
		if err := migrate(); err != nil {
			return fmt.Errorf("failed to migrate database: %w", err)
		}
	}

	log.Println("Database initialized successfully")
	return nil
}

func migrate() error {
	return DB.AutoMigrate(
		&models.Order{},
		&models.Inventory{},
		&models.InventoryLog{},
		&models.Balance{},
		&models.BalanceLog{},
		&models.Coupon{},
		&models.SagaInstance{},
		&models.SagaStep{},
		&models.OutboxEvent{},
		&models.CompensationTask{},
		&models.ManualHandling{},
		&models.FailureInjection{},
	)
}

func GetDB() *gorm.DB {
	return DB
}

func BeginTransaction() *gorm.DB {
	return DB.Begin()
}
