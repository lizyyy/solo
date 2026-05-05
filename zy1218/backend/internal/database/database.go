package database

import (
	"github.com/gmp-simulator/backend/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// Init 初始化数据库连接并自动迁移
func Init(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	// 自动迁移数据库表
	err = db.AutoMigrate(
		&model.Experiment{},
		&model.Event{},
		&model.QueueSnapshot{},
		&model.TraceImport{},
		&model.Report{},
	)
	if err != nil {
		return nil, err
	}

	return db, nil
}
