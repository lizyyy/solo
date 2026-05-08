package database

import (
	"fmt"
	"sync"
	"time"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"

	"chaos-payment/internal/config"
	"chaos-payment/internal/models"
)

var (
	dbInstance *gorm.DB
	once       sync.Once
	dbMu       sync.Mutex
)

func InitDB(cfg *config.DatabaseConfig) (*gorm.DB, error) {
	dbMu.Lock()
	defer dbMu.Unlock()

	var initErr error
	once.Do(func() {
		dsn := cfg.DSN()
		db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
			Logger: logger.Default.LogMode(logger.Info),
		})
		if err != nil {
			initErr = fmt.Errorf("failed to connect to database: %w", err)
			return
		}

		sqlDB, err := db.DB()
		if err != nil {
			initErr = fmt.Errorf("failed to get sql.DB: %w", err)
			return
		}

		sqlDB.SetMaxOpenConns(cfg.MaxOpenConns)
		sqlDB.SetMaxIdleConns(cfg.MaxIdleConns)
		sqlDB.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

		if err := runMigrations(db); err != nil {
			initErr = fmt.Errorf("failed to run migrations: %w", err)
			return
		}

		dbInstance = db
	})

	return dbInstance, initErr
}

func GetDB() *gorm.DB {
	return dbInstance
}

func runMigrations(db *gorm.DB) error {
	return db.AutoMigrate(
		&models.Order{},
		&models.PaymentCallback{},
		&models.Event{},
		&models.StateSnapshot{},
		&models.ChaosMetric{},
	)
}
