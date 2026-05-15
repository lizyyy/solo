package repository

import (
	"cert-renewal/internal/model"
	"fmt"
	"time"

	"go.uber.org/zap"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var db *gorm.DB

func Init(dsn string, logger *zap.Logger) error {
	gormDB, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{
		NowFunc: func() time.Time {
			return time.Now().UTC()
		},
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	sqlDB, err := gormDB.DB()
	if err != nil {
		return fmt.Errorf("failed to get database instance: %w", err)
	}

	sqlDB.SetMaxOpenConns(25)
	sqlDB.SetMaxIdleConns(5)
	sqlDB.SetConnMaxLifetime(5 * time.Minute)

	db = gormDB

	if err := autoMigrate(); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	logger.Info("Database initialized successfully")
	return nil
}

func autoMigrate() error {
	return db.AutoMigrate(
		&model.Partner{},
		&model.ClientCertificate{},
		&model.RenewalWindow{},
		&model.VerificationRequest{},
		&model.RollbackRecord{},
		&model.EnablementRecord{},
		&model.IdempotentRequest{},
		&model.RenewalReminder{},
	)
}

func GetDB() *gorm.DB {
	return db
}

func WithTransaction(fn func(tx *gorm.DB) error) error {
	tx := db.Begin()
	if tx.Error != nil {
		return tx.Error
	}

	if err := fn(tx); err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}
