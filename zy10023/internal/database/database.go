package database

import (
	"context"
	"fmt"
	"time"

	"github.com/api-guardian/api-guardian/internal/config"
	"github.com/api-guardian/api-guardian/internal/models"
	"go.uber.org/zap"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var db *gorm.DB

func Init(cfg config.DatabaseConfig) error {
	var l logger.Interface
	if zlogger, err := zap.NewProduction(); err == nil {
		l = NewZapGormLogger(zlogger)
	} else {
		l = logger.Default.LogMode(logger.Info)
	}

	dsn := cfg.DSN()
	var err error
	db, err = gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: l,
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		return fmt.Errorf("failed to get sql.DB: %w", err)
	}

	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	return nil
}

func AutoMigrate() error {
	if db == nil {
		return fmt.Errorf("database not initialized")
	}

	return db.AutoMigrate(
		&models.APIDefinition{},
		&models.MockResponse{},
		&models.TrafficTest{},
		&models.TrafficTestResult{},
		&models.MessageQueueSimulation{},
		&models.TraceRecord{},
		&models.IssueReport{},
		&models.ConsistencyCheck{},
	)
}

func GetDB() *gorm.DB {
	return db
}

func Close() error {
	if db == nil {
		return nil
	}
	sqlDB, err := db.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

type ZapGormLogger struct {
	logger *zap.Logger
}

func NewZapGormLogger(l *zap.Logger) logger.Interface {
	return &ZapGormLogger{logger: l}
}

func (z *ZapGormLogger) LogMode(level logger.LogLevel) logger.Interface {
	return z
}

func (z *ZapGormLogger) Info(ctx context.Context, msg string, data ...interface{}) {
	z.logger.Info(msg, zap.Any("data", data))
}

func (z *ZapGormLogger) Warn(ctx context.Context, msg string, data ...interface{}) {
	z.logger.Warn(msg, zap.Any("data", data))
}

func (z *ZapGormLogger) Error(ctx context.Context, msg string, data ...interface{}) {
	z.logger.Error(msg, zap.Any("data", data))
}

func (z *ZapGormLogger) Trace(ctx context.Context, begin time.Time, fc func() (string, int64), err error) {
	sql, rows := fc()
	elapsed := time.Since(begin)

	if err != nil {
		z.logger.Error("SQL query",
			zap.Error(err),
			zap.Duration("elapsed", elapsed),
			zap.String("sql", sql),
			zap.Int64("rows", rows),
		)
	} else {
		z.logger.Info("SQL query",
			zap.Duration("elapsed", elapsed),
			zap.String("sql", sql),
			zap.Int64("rows", rows),
		)
	}
}
