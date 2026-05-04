package models

import (
	"time"

	"gorm.io/gorm"
)

func SeedDatabase(db *gorm.DB) error {
	if err := seedUsers(db); err != nil {
		return err
	}

	if err := seedWalletConfig(db); err != nil {
		return err
	}

	if err := seedRechargeAddresses(db); err != nil {
		return err
	}

	if err := seedBlocks(db); err != nil {
		return err
	}

	if err := seedTransactions(db); err != nil {
		return err
	}

	if err := seedUTXOs(db); err != nil {
		return err
	}

	return nil
}

func seedUsers(db *gorm.DB) error {
	var count int64
	db.Model(&User{}).Count(&count)
	if count > 0 {
		return nil
	}

	users := []User{
		{UserID: "user_001", Username: "alice"},
		{UserID: "user_002", Username: "bob"},
		{UserID: "user_003", Username: "charlie"},
		{UserID: "user_004", Username: "david"},
	}

	return db.Create(&users).Error
}

func seedWalletConfig(db *gorm.DB) error {
	var count int64
	db.Model(&WalletConfig{}).Count(&count)
	if count > 0 {
		return nil
	}

	config := WalletConfig{
		HotWalletAddress:  "bc1qhotwalletaddress000000000000000000000000",
		ColdWalletAddress: "bc1qcoldwalletaddress00000000000000000000000",
		MaxHotBalance:     1000000000,
		MinColdBalance:    100000000,
		ConfirmedBlocks:   6,
		DustThreshold:     546,
		FeeRate:           20,
		EnableZeroConf:    false,
	}

	return db.Create(&config).Error
}

func seedRechargeAddresses(db *gorm.DB) error {
	var count int64
	db.Model(&RechargeAddress{}).Count(&count)
	if count > 0 {
		return nil
	}

	addresses := []RechargeAddress{
		{UserID: "user_001", Address: "bc1quser001address00000000000000000000000", Index: 0, Status: "active"},
		{UserID: "user_001", Address: "bc1quser001address00000000000000000000001", Index: 1, Status: "active"},
		{UserID: "user_002", Address: "bc1quser002address00000000000000000000000", Index: 0, Status: "active"},
		{UserID: "user_002", Address: "bc1quser002address00000000000000000000001", Index: 1, Status: "active"},
		{UserID: "user_003", Address: "bc1quser003address00000000000000000000000", Index: 0, Status: "active"},
		{UserID: "user_004", Address: "bc1quser004address00000000000000000000000", Index: 0, Status: "active"},
	}

	return db.Create(&addresses).Error
}

func seedBlocks(db *gorm.DB) error {
	var count int64
	db.Model(&Block{}).Count(&count)
	if count > 0 {
		return nil
	}

	blocks := []Block{
		{Height: 800000, Hash: "000000000000000000000000000000000000000000000000000000000000001", PrevHash: "000000000000000000000000000000000000000000000000000000000000000", Timestamp: time.Now().AddDate(0, 0, -3), TxCount: 1000},
		{Height: 800001, Hash: "000000000000000000000000000000000000000000000000000000000000002", PrevHash: "000000000000000000000000000000000000000000000000000000000000001", Timestamp: time.Now().AddDate(0, 0, -2), TxCount: 1200},
		{Height: 800002, Hash: "000000000000000000000000000000000000000000000000000000000000003", PrevHash: "000000000000000000000000000000000000000000000000000000000000002", Timestamp: time.Now().AddDate(0, 0, -1), TxCount: 1500},
		{Height: 800003, Hash: "000000000000000000000000000000000000000000000000000000000000004", PrevHash: "000000000000000000000000000000000000000000000000000000000000003", Timestamp: time.Now().AddDate(0, 0, 0), TxCount: 800},
	}

	return db.Create(&blocks).Error
}

func seedTransactions(db *gorm.DB) error {
	var count int64
	db.Model(&Transaction{}).Count(&count)
	if count > 0 {
		return nil
	}

	transactions := []Transaction{
		{
			TxID:          "tx_001_confirmed_6_blocks",
			BlockHeight:   800000,
			BlockHash:     "000000000000000000000000000000000000000000000000000000000000001",
			Confirmations: 6,
			IsConfirmed:   true,
			IsRBF:         false,
			HasDoubleSpend: false,
			Status:        "confirmed",
			Fee:           2000,
		},
		{
			TxID:          "tx_002_confirmed_3_blocks",
			BlockHeight:   800001,
			BlockHash:     "000000000000000000000000000000000000000000000000000000000000002",
			Confirmations: 3,
			IsConfirmed:   false,
			IsRBF:         false,
			HasDoubleSpend: false,
			Status:        "pending",
			Fee:           1500,
		},
		{
			TxID:          "tx_003_mempool_zero_conf",
			BlockHeight:   0,
			Confirmations: 0,
			IsConfirmed:   false,
			IsRBF:         true,
			HasDoubleSpend: false,
			Status:        "pending",
			Fee:           3000,
		},
		{
			TxID:          "tx_004_double_spend_risk",
			BlockHeight:   0,
			Confirmations: 0,
			IsConfirmed:   false,
			IsRBF:         false,
			HasDoubleSpend: true,
			Status:        "suspicious",
			Fee:           1000,
		},
		{
			TxID:          "tx_005_dust_output",
			BlockHeight:   800002,
			BlockHash:     "000000000000000000000000000000000000000000000000000000000000003",
			Confirmations: 2,
			IsConfirmed:   false,
			IsRBF:         false,
			HasDoubleSpend: false,
			Status:        "pending",
			Fee:           500,
		},
	}

	return db.Create(&transactions).Error
}

func seedUTXOs(db *gorm.DB) error {
	var count int64
	db.Model(&UTXO{}).Count(&count)
	if count > 0 {
		return nil
	}

	utxos := []UTXO{
		{
			TxID:          "tx_001_confirmed_6_blocks",
			OutputIndex:   0,
			Address:       "bc1quser001address00000000000000000000000",
			Amount:        100000000,
			Confirmations: 6,
			BlockHeight:   800000,
			Status:        "unspent",
			IsDust:        false,
		},
		{
			TxID:          "tx_002_confirmed_3_blocks",
			OutputIndex:   0,
			Address:       "bc1quser002address00000000000000000000000",
			Amount:        50000000,
			Confirmations: 3,
			BlockHeight:   800001,
			Status:        "unspent",
			IsDust:        false,
		},
		{
			TxID:          "tx_003_mempool_zero_conf",
			OutputIndex:   0,
			Address:       "bc1quser003address00000000000000000000000",
			Amount:        20000000,
			Confirmations: 0,
			BlockHeight:   0,
			Status:        "unspent",
			IsDust:        false,
		},
		{
			TxID:          "tx_004_double_spend_risk",
			OutputIndex:   0,
			Address:       "bc1quser004address00000000000000000000000",
			Amount:        10000000,
			Confirmations: 0,
			BlockHeight:   0,
			Status:        "suspicious",
			IsDust:        false,
		},
		{
			TxID:          "tx_005_dust_output",
			OutputIndex:   0,
			Address:       "bc1quser001address00000000000000000000001",
			Amount:        500,
			Confirmations: 2,
			BlockHeight:   800002,
			Status:        "unspent",
			IsDust:        true,
		},
	}

	return db.Create(&utxos).Error
}
