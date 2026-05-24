package database

import (
	"city-salt-api/internal/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Init() error {
	var err error
	DB, err = gorm.Open(sqlite.Open("city_salt.db"), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return err
	}

	err = DB.AutoMigrate(
		&models.RoadSection{},
		&models.SaltDepot{},
		&models.Vehicle{},
		&models.WeatherLevel{},
		&models.RoadClosure{},
		&models.DispatchBatch{},
		&models.DispatchItem{},
		&models.StockLog{},
		&models.RouteStatusLog{},
		&models.Receipt{},
		&models.DispatchReport{},
		&models.OperationLog{},
	)
	if err != nil {
		return err
	}

	return seedInitialData()
}

func seedInitialData() error {
	var count int64
	DB.Model(&models.WeatherLevel{}).Count(&count)
	if count == 0 {
		weatherLevels := []models.WeatherLevel{
			{Level: 1, Name: "小雪", Description: "降雪量0-2.5毫米", SaltRatio: 0.5},
			{Level: 2, Name: "中雪", Description: "降雪量2.5-5毫米", SaltRatio: 1.0},
			{Level: 3, Name: "大雪", Description: "降雪量5-10毫米", SaltRatio: 1.5},
			{Level: 4, Name: "暴雪", Description: "降雪量10毫米以上", SaltRatio: 2.0},
		}
		DB.Create(&weatherLevels)
	}

	DB.Model(&models.SaltDepot{}).Count(&count)
	if count == 0 {
		depots := []models.SaltDepot{
			{Name: "城东盐库", Code: "DEPOT-001", Location: "城东工业园区A区", Capacity: 500, CurrentStock: 200, LowThreshold: 50},
			{Name: "城西盐库", Code: "DEPOT-002", Location: "城西物流园B区", Capacity: 400, CurrentStock: 150, LowThreshold: 40},
			{Name: "城南盐库", Code: "DEPOT-003", Location: "城南开发区", Capacity: 300, CurrentStock: 100, LowThreshold: 30},
		}
		DB.Create(&depots)
	}

	DB.Model(&models.RoadSection{}).Count(&count)
	if count == 0 {
		roads := []models.RoadSection{
			{Name: "长江路", Code: "ROAD-001", SaltDemand: 20, Status: "normal"},
			{Name: "黄河路", Code: "ROAD-002", SaltDemand: 15, Status: "normal"},
			{Name: "珠江路", Code: "ROAD-003", SaltDemand: 25, Status: "normal"},
			{Name: "松花江路", Code: "ROAD-004", SaltDemand: 18, Status: "normal"},
			{Name: "牡丹江路", Code: "ROAD-005", SaltDemand: 22, Status: "normal"},
		}
		DB.Create(&roads)
	}

	DB.Model(&models.Vehicle{}).Count(&count)
	if count == 0 {
		vehicles := []models.Vehicle{
			{PlateNumber: "京A12345", Capacity: 10, DriverName: "张三", Status: "idle"},
			{PlateNumber: "京A23456", Capacity: 10, DriverName: "李四", Status: "idle"},
			{PlateNumber: "京A34567", Capacity: 12, DriverName: "王五", Status: "idle"},
			{PlateNumber: "京A45678", Capacity: 8, DriverName: "赵六", Status: "idle"},
		}
		DB.Create(&vehicles)
	}

	return nil
}

func LogOperation(operator, action, module, refType string, refID uint, beforeData, afterData, ip string) error {
	return LogOperationWithTx(DB, operator, action, module, refType, refID, beforeData, afterData, ip)
}

func LogOperationWithTx(tx *gorm.DB, operator, action, module, refType string, refID uint, beforeData, afterData, ip string) error {
	log := models.OperationLog{
		Operator:   operator,
		Action:     action,
		Module:     module,
		RefType:    refType,
		RefID:      refID,
		BeforeData: beforeData,
		AfterData:  afterData,
		IPAddress:  ip,
		CreatedAt:  time.Now(),
	}
	return tx.Create(&log).Error
}

func IsRoadClosed(roadSectionID uint) (bool, *models.RoadClosure, error) {
	var closure models.RoadClosure
	err := DB.Where("road_section_id = ? AND status = 'active' AND (end_time IS NULL OR end_time > ?)", roadSectionID, time.Now()).
		First(&closure).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, &closure, nil
}

func CheckVehicleDuplicateDispatch(vehicleID uint, batchNo string) (bool, *models.DispatchItem, error) {
	var item models.DispatchItem
	var batch models.DispatchBatch

	if err := DB.Where("batch_no = ?", batchNo).First(&batch).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil, nil
		}
		return false, nil, err
	}

	err := DB.Where("vehicle_id = ? AND dispatch_batch_id = ?", vehicleID, batch.ID).
		First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, &item, nil
}

func CheckVehicleActiveDispatch(vehicleID uint) (bool, *models.DispatchItem, error) {
	var item models.DispatchItem
	err := DB.Where("vehicle_id = ? AND status IN ('pending', 'dispatched', 'enroute', 'arrived', 'delivering')", vehicleID).
		First(&item).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return false, nil, nil
	}
	if err != nil {
		return false, nil, err
	}
	return true, &item, nil
}

func DeductStock(depotID uint, amount float64, operator string, refType string, refID uint) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return DeductStockWithTx(tx, depotID, amount, operator, refType, refID)
	})
}

func DeductStockWithTx(tx *gorm.DB, depotID uint, amount float64, operator string, refType string, refID uint) error {
	var depot models.SaltDepot
	if err := tx.First(&depot, depotID).Error; err != nil {
		return err
	}

	if depot.CurrentStock < amount {
		return fmt.Errorf("库存不足，当前库存: %.2f，需要: %.2f", depot.CurrentStock, amount)
	}

	beforeStock := depot.CurrentStock
	depot.CurrentStock -= amount

	if err := tx.Save(&depot).Error; err != nil {
		return err
	}

	stockLog := models.StockLog{
		SaltDepotID: depotID,
		ChangeType:  "out",
		Amount:      amount,
		BeforeStock: beforeStock,
		AfterStock:  depot.CurrentStock,
		RefType:     refType,
		RefID:       refID,
		Remark:      "调拨出库",
		CreatedBy:   operator,
		CreatedAt:   time.Now(),
	}
	if err := tx.Create(&stockLog).Error; err != nil {
		return err
	}

	return nil
}

func AddStock(depotID uint, amount float64, operator string, refType string, refID uint, remark string) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		return AddStockWithTx(tx, depotID, amount, operator, refType, refID, remark)
	})
}

func AddStockWithTx(tx *gorm.DB, depotID uint, amount float64, operator string, refType string, refID uint, remark string) error {
	var depot models.SaltDepot
	if err := tx.First(&depot, depotID).Error; err != nil {
		return err
	}

	beforeStock := depot.CurrentStock
	depot.CurrentStock += amount
	depot.WarningSent = false

	if err := tx.Save(&depot).Error; err != nil {
		return err
	}

	stockLog := models.StockLog{
		SaltDepotID: depotID,
		ChangeType:  "in",
		Amount:      amount,
		BeforeStock: beforeStock,
		AfterStock:  depot.CurrentStock,
		RefType:     refType,
		RefID:       refID,
		Remark:      remark,
		CreatedBy:   operator,
		CreatedAt:   time.Now(),
	}
	if err := tx.Create(&stockLog).Error; err != nil {
		return err
	}

	return nil
}

func AddRouteStatusLog(dispatchItemID uint, status, location, remark, createdBy string) error {
	return AddRouteStatusLogWithTx(DB, dispatchItemID, status, location, remark, createdBy)
}

func AddRouteStatusLogWithTx(tx *gorm.DB, dispatchItemID uint, status, location, remark, createdBy string) error {
	log := models.RouteStatusLog{
		DispatchItemID: dispatchItemID,
		Status:         status,
		Location:       location,
		Remark:         remark,
		CreatedBy:      createdBy,
		CreatedAt:      time.Now(),
	}
	return tx.Create(&log).Error
}

func GetDispatchItemTrajectory(dispatchItemID uint) ([]models.RouteStatusLog, error) {
	var logs []models.RouteStatusLog
	err := DB.Where("dispatch_item_id = ?", dispatchItemID).Order("created_at ASC").Find(&logs).Error
	return logs, err
}

func CheckLowStock() ([]models.SaltDepot, error) {
	var depots []models.SaltDepot
	err := DB.Where("current_stock <= low_threshold").Find(&depots).Error
	return depots, err
}

func GetBatchByNo(batchNo string) (*models.DispatchBatch, error) {
	var batch models.DispatchBatch
	err := DB.Where("batch_no = ?", batchNo).First(&batch).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func GetBatchItems(batchID uint) ([]models.DispatchItem, error) {
	var items []models.DispatchItem
	err := DB.Preload("Vehicle").Preload("SaltDepot").Preload("RoadSection").
		Where("dispatch_batch_id = ?", batchID).Find(&items).Error
	return items, err
}
