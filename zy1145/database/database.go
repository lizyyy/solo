package database

import (
	"btc-recharge-service/models"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

func Init(dbPath string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return nil, err
	}

	if err := db.AutoMigrate(
		&models.User{},
		&models.RechargeAddress{},
		&models.UTXO{},
		&models.Transaction{},
		&models.Block{},
		&models.CollectionPlan{},
		&models.ManualAudit{},
		&models.AuditLog{},
		&models.WalletConfig{},
	); err != nil {
		return nil, err
	}

	return db, nil
}
