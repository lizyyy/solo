package database

import (
	"fmt"
	"log"
	"os"
	"path/filepath"

	"go-quality-scanner/internal/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// DB 全局数据库连接
var DB *gorm.DB

// InitDB 初始化数据库连接
func InitDB() error {
	// 确保数据库目录存在
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "./data/scanner.db"
	}
	
	// 创建目录
	dbDir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		return fmt.Errorf("failed to create database directory: %w", err)
	}

	// 连接 SQLite 数据库
	var err error
	DB, err = gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// 自动迁移模型
	if err := autoMigrate(); err != nil {
		return fmt.Errorf("failed to migrate database: %w", err)
	}

	log.Println("Database initialized successfully")
	return nil
}

// autoMigrate 自动迁移数据库模型
func autoMigrate() error {
	return DB.AutoMigrate(
		&models.ScanRecord{},
		&models.ScanResult{},
		&models.Issue{},
		&models.GoModInfo{},
		&models.Dependency{},
	)
}

// GetDB 获取数据库连接
func GetDB() *gorm.DB {
	return DB
}

// CloseDB 关闭数据库连接
func CloseDB() error {
	sqlDB, err := DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
