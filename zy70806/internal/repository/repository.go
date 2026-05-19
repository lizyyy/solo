package repository

import (
	"customs-reconciliation/config"
	"customs-reconciliation/internal/models"
	"time"

	"github.com/shopspring/decimal"
	"gorm.io/gorm"
)

type DeclarationRepository struct{}

func NewDeclarationRepository() *DeclarationRepository {
	return &DeclarationRepository{}
}

func (r *DeclarationRepository) Create(declaration *models.Declaration) error {
	return config.DB.Create(declaration).Error
}

func (r *DeclarationRepository) BatchCreate(declarations []*models.Declaration) error {
	return config.DB.Create(declarations).Error
}

func (r *DeclarationRepository) GetByBatchID(batchID string) ([]*models.Declaration, error) {
	var declarations []*models.Declaration
	err := config.DB.Where("batch_id = ?", batchID).Find(&declarations).Error
	return declarations, err
}

func (r *DeclarationRepository) GetByOrderNo(orderNo string) (*models.Declaration, error) {
	var declaration models.Declaration
	err := config.DB.Where("order_no = ?", orderNo).First(&declaration).Error
	if err != nil {
		return nil, err
	}
	return &declaration, nil
}

type TariffRepository struct{}

func NewTariffRepository() *TariffRepository {
	return &TariffRepository{}
}

func (r *TariffRepository) Create(tariff *models.Tariff) error {
	return config.DB.Create(tariff).Error
}

func (r *TariffRepository) BatchCreate(tariffs []*models.Tariff) error {
	return config.DB.Create(tariffs).Error
}

func (r *TariffRepository) GetByHSCode(hsCode string, effectiveDate time.Time) (*models.Tariff, error) {
	var tariff models.Tariff
	query := config.DB.Where("hs_code = ? AND is_active = ?", hsCode, true)
	query = query.Where("effective_date <= ?", effectiveDate)
	query = query.Where("expiry_date IS NULL OR expiry_date > ?", effectiveDate)
	err := query.First(&tariff).Error
	if err != nil {
		return nil, err
	}
	return &tariff, nil
}

func (r *TariffRepository) GetByBatchID(batchID string) ([]*models.Tariff, error) {
	var tariffs []*models.Tariff
	err := config.DB.Where("batch_id = ?", batchID).Find(&tariffs).Error
	return tariffs, err
}

type ReturnReceiptRepository struct{}

func NewReturnReceiptRepository() *ReturnReceiptRepository {
	return &ReturnReceiptRepository{}
}

func (r *ReturnReceiptRepository) Create(receipt *models.ReturnReceipt) error {
	return config.DB.Create(receipt).Error
}

func (r *ReturnReceiptRepository) BatchCreate(receipts []*models.ReturnReceipt) error {
	return config.DB.Create(receipts).Error
}

func (r *ReturnReceiptRepository) GetByBatchID(batchID string) ([]*models.ReturnReceipt, error) {
	var receipts []*models.ReturnReceipt
	err := config.DB.Where("batch_id = ?", batchID).Find(&receipts).Error
	return receipts, err
}

func (r *ReturnReceiptRepository) GetByOrderNo(orderNo string) (*models.ReturnReceipt, error) {
	var receipt models.ReturnReceipt
	err := config.DB.Where("order_no = ?", orderNo).First(&receipt).Error
	if err != nil {
		return nil, err
	}
	return &receipt, nil
}

type ReconciliationBatchRepository struct{}

func NewReconciliationBatchRepository() *ReconciliationBatchRepository {
	return &ReconciliationBatchRepository{}
}

func (r *ReconciliationBatchRepository) Create(batch *models.ReconciliationBatch) error {
	return config.DB.Create(batch).Error
}

func (r *ReconciliationBatchRepository) Update(batch *models.ReconciliationBatch) error {
	return config.DB.Save(batch).Error
}

func (r *ReconciliationBatchRepository) GetByID(id string) (*models.ReconciliationBatch, error) {
	var batch models.ReconciliationBatch
	err := config.DB.First(&batch, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func (r *ReconciliationBatchRepository) List(page, pageSize int) ([]*models.ReconciliationBatch, int64, error) {
	var batches []*models.ReconciliationBatch
	var total int64
	
	config.DB.Model(&models.ReconciliationBatch{}).Count(&total)
	err := config.DB.Offset((page - 1) * pageSize).Limit(pageSize).
		Order("created_at DESC").Find(&batches).Error
	
	return batches, total, err
}

type ReconciliationItemRepository struct{}

func NewReconciliationItemRepository() *ReconciliationItemRepository {
	return &ReconciliationItemRepository{}
}

func (r *ReconciliationItemRepository) Create(item *models.ReconciliationItem) error {
	return config.DB.Create(item).Error
}

func (r *ReconciliationItemRepository) Update(item *models.ReconciliationItem) error {
	return config.DB.Save(item).Error
}

func (r *ReconciliationItemRepository) BatchCreate(items []*models.ReconciliationItem) error {
	return config.DB.Create(items).Error
}

func (r *ReconciliationItemRepository) GetByBatchID(batchID string) ([]*models.ReconciliationItem, error) {
	var items []*models.ReconciliationItem
	err := config.DB.Where("batch_id = ?", batchID).Find(&items).Error
	return items, err
}

func (r *ReconciliationItemRepository) GetByID(id string) (*models.ReconciliationItem, error) {
	var item models.ReconciliationItem
	err := config.DB.First(&item, "id = ?", id).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ReconciliationItemRepository) GetByOrderNo(orderNo string) (*models.ReconciliationItem, error) {
	var item models.ReconciliationItem
	err := config.DB.Where("order_no = ?", orderNo).First(&item).Error
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *ReconciliationItemRepository) UpdateBatchSummary(batchID string) error {
	type Result struct {
		MatchedCount     int
		DiscrepancyCount int
		ReviewedCount    int
		TotalExpected    decimal.Decimal
		TotalDeclared    decimal.Decimal
		TotalDifference  decimal.Decimal
	}
	var result Result
	
	err := config.DB.Model(&models.ReconciliationItem{}).
		Select(`
			COUNT(CASE WHEN status = 'matched' THEN 1 END) as matched_count,
			COUNT(CASE WHEN status = 'discrepancy' THEN 1 END) as discrepancy_count,
			COUNT(CASE WHEN is_reviewed = 1 THEN 1 END) as reviewed_count,
			COALESCE(SUM(expected_tax_amount), 0) as total_expected,
			COALESCE(SUM(declared_tax_amount), 0) as total_declared,
			COALESCE(SUM(tax_difference), 0) as total_difference
		`).
		Where("batch_id = ?", batchID).
		Scan(&result).Error
	
	if err != nil {
		return err
	}
	
	return config.DB.Model(&models.ReconciliationBatch{}).
		Where("id = ?", batchID).
		Updates(map[string]interface{}{
			"matched_count":      result.MatchedCount,
			"discrepancy_count":  result.DiscrepancyCount,
			"reviewed_count":     result.ReviewedCount,
			"total_tax_expected": result.TotalExpected,
			"total_tax_declared": result.TotalDeclared,
			"total_tax_difference": result.TotalDifference,
		}).Error
}

type DiscrepancyRepository struct{}

func NewDiscrepancyRepository() *DiscrepancyRepository {
	return &DiscrepancyRepository{}
}

func (r *DiscrepancyRepository) Create(discrepancy *models.Discrepancy) error {
	return config.DB.Create(discrepancy).Error
}

func (r *DiscrepancyRepository) BatchCreate(discrepancies []*models.Discrepancy) error {
	return config.DB.Create(discrepancies).Error
}

func (r *DiscrepancyRepository) GetByItemID(itemID string) ([]*models.Discrepancy, error) {
	var discrepancies []*models.Discrepancy
	err := config.DB.Where("reconciliation_item_id = ?", itemID).Find(&discrepancies).Error
	return discrepancies, err
}

func (r *DiscrepancyRepository) GetByBatchID(batchID string) ([]*models.Discrepancy, error) {
	var discrepancies []*models.Discrepancy
	err := config.DB.Where("batch_id = ?", batchID).Find(&discrepancies).Error
	return discrepancies, err
}

type ReviewRecordRepository struct{}

func NewReviewRecordRepository() *ReviewRecordRepository {
	return &ReviewRecordRepository{}
}

func (r *ReviewRecordRepository) Create(record *models.ReviewRecord) error {
	return config.DB.Create(record).Error
}

func (r *ReviewRecordRepository) GetByItemID(itemID string) ([]*models.ReviewRecord, error) {
	var records []*models.ReviewRecord
	err := config.DB.Where("reconciliation_item_id = ?", itemID).
		Order("created_at DESC").Find(&records).Error
	return records, err
}

type ExchangeRateRepository struct{}

func NewExchangeRateRepository() *ExchangeRateRepository {
	return &ExchangeRateRepository{}
}

func (r *ExchangeRateRepository) GetRate(fromCurrency, toCurrency string, rateDate time.Time) (decimal.Decimal, error) {
	var rate models.ExchangeRate
	err := config.DB.Where("from_currency = ? AND to_currency = ? AND rate_date <= ?", 
		fromCurrency, toCurrency, rateDate).
		Order("rate_date DESC").First(&rate).Error
	if err != nil {
		if err == gorm.ErrRecordNotFound && fromCurrency == "CNY" {
			return decimal.NewFromInt(1), nil
		}
		return decimal.Zero, err
	}
	return rate.Rate, nil
}

func (r *ExchangeRateRepository) Create(rate *models.ExchangeRate) error {
	return config.DB.Create(rate).Error
}

type ReportRepository struct{}

func NewReportRepository() *ReportRepository {
	return &ReportRepository{}
}

func (r *ReportRepository) Create(report *models.Report) error {
	return config.DB.Create(report).Error
}

func (r *ReportRepository) GetByBatchID(batchID string) ([]*models.Report, error) {
	var reports []*models.Report
	err := config.DB.Where("batch_id = ?", batchID).Order("created_at DESC").Find(&reports).Error
	return reports, err
}
