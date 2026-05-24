package repository

import (
	"compliance-exemption-api/internal/model"
	"os"
	"path/filepath"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Database struct {
	DB *gorm.DB
}

func NewDatabase(dbPath string) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, err
	}

	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	if err := autoMigrate(db); err != nil {
		return nil, err
	}

	return &Database{DB: db}, nil
}

func autoMigrate(db *gorm.DB) error {
	return db.AutoMigrate(
		&model.Exemption{},
		&model.Sample{},
		&model.ApprovalLog{},
		&model.OperationLog{},
		&model.QualityReport{},
	)
}

func (d *Database) Begin() *gorm.DB {
	return d.DB.Begin()
}
