package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type Config struct {
	DBPath     string
	ServerPort string
	LogLevel  logger.LogLevel
}

func DefaultConfig() *Config {
	workDir, _ := os.Getwd()
	return &Config{
		DBPath:     filepath.Join(workDir, "data", "grayscale_backfill.db"),
		ServerPort: "8080",
		LogLevel:  logger.Info,
	}
}

func (c *Config) GetDSN() string {
	return fmt.Sprintf("%s?_journal=WAL&_fk=1", c.DBPath)
}

func (c *Config) EnsureDataDir() error {
	dir := filepath.Dir(c.DBPath)
	return os.MkdirAll(dir, 0755)
}

func InitDB(cfg *Config) (*gorm.DB, error) {
	if err := cfg.EnsureDataDir(); err != nil {
		return nil, err
	}

	db, err := gorm.Open(sqlite.Open(cfg.GetDSN()), &gorm.Config{
		Logger: logger.Default.LogMode(cfg.LogLevel),
	})
	if err != nil {
		return nil, err
	}

	return db, nil
}
