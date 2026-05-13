package repository

import (
	"tenant-migration-api/internal/models"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type Database struct {
	DB *gorm.DB
}

func NewDatabase(dsn string) (*Database, error) {
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		return nil, err
	}

	err = db.AutoMigrate(
		&models.Tenant{},
		&models.Cluster{},
		&models.MigrationTask{},
		&models.CheckItem{},
		&models.RollbackPoint{},
		&models.MigrationHistory{},
		&models.ValidationReport{},
		&models.DualWriteRecord{},
	)
	if err != nil {
		return nil, err
	}

	return &Database{DB: db}, nil
}

func (d *Database) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}
