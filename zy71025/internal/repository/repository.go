package repository

import (
	"encoding/json"
	"time"

	"irrigation-water-rights/internal/models"

	"gorm.io/gorm"
)

type Repository struct {
	db *gorm.DB
}

func NewRepository(db *gorm.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) Migrate() error {
	return r.db.AutoMigrate(
		&models.Farmer{},
		&models.Plot{},
		&models.WaterRight{},
		&models.TransferApplication{},
		&models.IrrigationRecord{},
		&models.BalanceReport{},
		&models.ChangeHistory{},
	)
}

func (r *Repository) CreateFarmer(farmer *models.Farmer) error {
	return r.db.Create(farmer).Error
}

func (r *Repository) GetFarmerByID(id uint) (*models.Farmer, error) {
	var farmer models.Farmer
	err := r.db.First(&farmer, id).Error
	if err != nil {
		return nil, err
	}
	return &farmer, nil
}

func (r *Repository) ListFarmers() ([]models.Farmer, error) {
	var farmers []models.Farmer
	err := r.db.Find(&farmers).Error
	return farmers, err
}

func (r *Repository) CreatePlot(plot *models.Plot) error {
	return r.db.Create(plot).Error
}

func (r *Repository) GetPlotByID(id uint) (*models.Plot, error) {
	var plot models.Plot
	err := r.db.First(&plot, id).Error
	if err != nil {
		return nil, err
	}
	return &plot, nil
}

func (r *Repository) ListPlotsByFarmer(farmerID uint) ([]models.Plot, error) {
	var plots []models.Plot
	err := r.db.Where("farmer_id = ?", farmerID).Find(&plots).Error
	return plots, err
}

func (r *Repository) CreateWaterRight(waterRight *models.WaterRight) error {
	return r.db.Create(waterRight).Error
}

func (r *Repository) GetWaterRight(farmerID uint, year, week int) (*models.WaterRight, error) {
	var waterRight models.WaterRight
	err := r.db.Where("farmer_id = ? AND year = ? AND week = ?", farmerID, year, week).First(&waterRight).Error
	if err != nil {
		return nil, err
	}
	return &waterRight, nil
}

func (r *Repository) UpdateWaterRight(waterRight *models.WaterRight) error {
	return r.db.Save(waterRight).Error
}

func (r *Repository) CreateTransferApplication(transfer *models.TransferApplication) error {
	return r.db.Create(transfer).Error
}

func (r *Repository) GetTransferByID(id uint) (*models.TransferApplication, error) {
	var transfer models.TransferApplication
	err := r.db.First(&transfer, id).Error
	if err != nil {
		return nil, err
	}
	return &transfer, nil
}

func (r *Repository) GetTransferByNo(transferNo string) (*models.TransferApplication, error) {
	var transfer models.TransferApplication
	err := r.db.Where("transfer_no = ?", transferNo).First(&transfer).Error
	if err != nil {
		return nil, err
	}
	return &transfer, nil
}

func (r *Repository) UpdateTransferApplication(transfer *models.TransferApplication) error {
	return r.db.Save(transfer).Error
}

func (r *Repository) ListTransfers(filters map[string]interface{}) ([]models.TransferApplication, error) {
	var transfers []models.TransferApplication
	query := r.db.Model(&models.TransferApplication{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	err := query.Find(&transfers).Error
	return transfers, err
}

func (r *Repository) CreateIrrigationRecord(record *models.IrrigationRecord) error {
	return r.db.Create(record).Error
}

func (r *Repository) GetIrrigationByNo(recordNo string) (*models.IrrigationRecord, error) {
	var record models.IrrigationRecord
	err := r.db.Where("record_no = ?", recordNo).First(&record).Error
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (r *Repository) CheckDuplicateIrrigation(plotID uint, date time.Time) (bool, error) {
	start := time.Date(date.Year(), date.Month(), date.Day(), 0, 0, 0, 0, date.Location())
	end := start.Add(24 * time.Hour)
	var count int64
	err := r.db.Model(&models.IrrigationRecord{}).Where("plot_id = ? AND irrigation_date >= ? AND irrigation_date < ?", plotID, start, end).Count(&count).Error
	return count > 0, err
}

func (r *Repository) ListIrrigationRecords(filters map[string]interface{}) ([]models.IrrigationRecord, error) {
	var records []models.IrrigationRecord
	query := r.db.Model(&models.IrrigationRecord{})
	for k, v := range filters {
		query = query.Where(k+" = ?", v)
	}
	err := query.Find(&records).Error
	return records, err
}

func (r *Repository) CreateBalanceReport(report *models.BalanceReport) error {
	return r.db.Create(report).Error
}

func (r *Repository) GetBalanceReport(farmerID uint, year, week int) (*models.BalanceReport, error) {
	var report models.BalanceReport
	err := r.db.Where("farmer_id = ? AND year = ? AND week = ?", farmerID, year, week).First(&report).Error
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func (r *Repository) ListBalanceReports(year, week int) ([]models.BalanceReport, error) {
	var reports []models.BalanceReport
	err := r.db.Where("year = ? AND week = ?", year, week).Find(&reports).Error
	return reports, err
}

func (r *Repository) RecordChangeHistory(resourceType string, resourceID uint, before, after interface{}, reason, operator string) error {
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	history := &models.ChangeHistory{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		BeforeValue:  string(beforeJSON),
		AfterValue:   string(afterJSON),
		ChangeReason: reason,
		Operator:     operator,
	}
	return r.db.Create(history).Error
}

func (r *Repository) GetChangeHistory(resourceType string, resourceID uint) ([]models.ChangeHistory, error) {
	var history []models.ChangeHistory
	err := r.db.Where("resource_type = ? AND resource_id = ?", resourceType, resourceID).Order("created_at desc").Find(&history).Error
	return history, err
}

func (r *Repository) DB() *gorm.DB {
	return r.db
}
