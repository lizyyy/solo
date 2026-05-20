package services

import (
	"fmt"
	"time"

	"customs-reconciliation/internal/models"
	"customs-reconciliation/internal/repository"

	"github.com/shopspring/decimal"
)

type ReconciliationService struct {
	declarationRepo   *repository.DeclarationRepository
	tariffRepo        *repository.TariffRepository
	returnReceiptRepo *repository.ReturnReceiptRepository
	batchRepo         *repository.ReconciliationBatchRepository
	itemRepo          *repository.ReconciliationItemRepository
	discrepancyRepo   *repository.DiscrepancyRepository
	exchangeRateRepo  *repository.ExchangeRateRepository
}

func NewReconciliationService() *ReconciliationService {
	return &ReconciliationService{
		declarationRepo:   repository.NewDeclarationRepository(),
		tariffRepo:        repository.NewTariffRepository(),
		returnReceiptRepo: repository.NewReturnReceiptRepository(),
		batchRepo:         repository.NewReconciliationBatchRepository(),
		itemRepo:          repository.NewReconciliationItemRepository(),
		discrepancyRepo:   repository.NewDiscrepancyRepository(),
		exchangeRateRepo:  repository.NewExchangeRateRepository(),
	}
}

type ReconciliationResult struct {
	BatchID           string `json:"batch_id"`
	TotalItems        int    `json:"total_items"`
	MatchedItems      int    `json:"matched_items"`
	DiscrepancyItems  int    `json:"discrepancy_items"`
	HasReturnReceipt  int    `json:"has_return_receipt"`
	SupplementTaxCount int   `json:"supplement_tax_count"`
}

func (s *ReconciliationService) ProcessBatch(batchID string) (*ReconciliationResult, error) {
	batch, err := s.batchRepo.GetByID(batchID)
	if err != nil {
		return nil, err
	}

	batch.Status = models.BatchStatusProcessing
	if err := s.batchRepo.Update(batch); err != nil {
		return nil, err
	}

	if err := s.discrepancyRepo.DeleteByBatchID(batchID); err != nil {
		return nil, err
	}
	if err := s.itemRepo.DeleteByBatchID(batchID); err != nil {
		return nil, err
	}

	declarations, err := s.declarationRepo.GetByBatchID(batchID)
	if err != nil {
		return nil, err
	}

	result := &ReconciliationResult{
		BatchID:    batchID,
		TotalItems: len(declarations),
	}

	orderMap := make(map[string][]*models.Declaration)
	for _, d := range declarations {
		orderMap[d.OrderNo] = append(orderMap[d.OrderNo], d)
	}

	type itemWithDiscrepancies struct {
		item         *models.ReconciliationItem
		discrepancies []*models.Discrepancy
	}

	var allItemPairs []itemWithDiscrepancies

	for orderNo, orderDeclarations := range orderMap {
		returnReceipt, _ := s.returnReceiptRepo.GetByOrderNo(orderNo)

		for idx, declaration := range orderDeclarations {
			isDuplicate := idx > 0

			item, discrepancies, err := s.processDeclaration(
				batchID,
				declaration,
				returnReceipt,
				isDuplicate,
			)
			if err != nil {
				continue
			}

			allItemPairs = append(allItemPairs, itemWithDiscrepancies{item, discrepancies})

			if item.Status == models.ItemStatusMatched {
				result.MatchedItems++
			} else {
				result.DiscrepancyItems++
			}

			if item.HasReturnReceipt {
				result.HasReturnReceipt++
			}

			if item.SupplementTaxNeeded.GreaterThan(decimal.Zero) {
				result.SupplementTaxCount++
			}
		}
	}

	var allItems []*models.ReconciliationItem
	for _, pair := range allItemPairs {
		allItems = append(allItems, pair.item)
	}

	if len(allItems) > 0 {
		if err := s.itemRepo.BatchCreate(allItems); err != nil {
			return nil, err
		}
	}

	var allDiscrepancies []*models.Discrepancy
	for _, pair := range allItemPairs {
		for _, d := range pair.discrepancies {
			d.ReconciliationItemID = pair.item.ID
			allDiscrepancies = append(allDiscrepancies, d)
		}
	}

	if len(allDiscrepancies) > 0 {
		if err := s.discrepancyRepo.BatchCreate(allDiscrepancies); err != nil {
			return nil, err
		}
	}

	now := time.Now()
	batch.Status = models.BatchStatusProcessed
	batch.ProcessedAt = &now
	batch.DeclarationCount = result.TotalItems
	if err := s.batchRepo.Update(batch); err != nil {
		return nil, err
	}

	if err := s.itemRepo.UpdateBatchSummary(batchID); err != nil {
		return nil, err
	}

	return result, nil
}

func (s *ReconciliationService) processDeclaration(
	batchID string,
	declaration *models.Declaration,
	returnReceipt *models.ReturnReceipt,
	isDuplicate bool,
) (*models.ReconciliationItem, []*models.Discrepancy, error) {

	var discrepancies []*models.Discrepancy

	exchangeRate, err := s.exchangeRateRepo.GetRate(declaration.Currency, "CNY", declaration.DeclareDate)
	if err != nil {
		exchangeRate = decimal.NewFromFloat(7.2)
		discrepancies = append(discrepancies, s.createDiscrepancy(
			batchID, "", declaration.OrderNo,
			models.DiscrepancyTypeCurrency, "exchange_rate",
			decimal.Zero, exchangeRate,
			fmt.Sprintf("使用默认汇率 %.4f，未找到%s对CNY的汇率数据", exchangeRate.InexactFloat64(), declaration.Currency),
			"system_default",
		))
	}

	declaredAmountCNY := declaration.TotalAmount.Mul(exchangeRate)

	tariff, err := s.tariffRepo.GetByHSCode(declaration.HSCode, declaration.DeclareDate)
	var applicableTaxRate decimal.Decimal
	if err != nil || tariff == nil {
		applicableTaxRate = decimal.NewFromFloat(0.13)
		discrepancies = append(discrepancies, s.createDiscrepancy(
			batchID, "", declaration.OrderNo,
			models.DiscrepancyTypeHSCode, "tax_rate",
			decimal.Zero, applicableTaxRate,
			fmt.Sprintf("HS编码 %s 未找到对应税则，使用默认税率13%%", declaration.HSCode),
			"hs_code_not_found",
		))
	} else {
		applicableTaxRate = tariff.TaxRate.Add(tariff.ConsumptionTax).Add(tariff.VATRate)
	}

	expectedTaxAmount := declaredAmountCNY.Mul(applicableTaxRate)

	declaredTaxAmountCNY := declaration.DeclaredTaxAmount
	if declaration.Currency != "CNY" {
		declaredTaxAmountCNY = declaration.DeclaredTaxAmount.Mul(exchangeRate)
	}

	taxDifference := expectedTaxAmount.Sub(declaredTaxAmountCNY)

	var returnAdjustedTax decimal.Decimal
	var supplementTaxNeeded decimal.Decimal
	var hasReturnReceipt bool

	if returnReceipt != nil {
		hasReturnReceipt = true
		returnAdjustedTax = returnReceipt.AdjustedTax
		if returnReceipt.RequireSupplement {
			if taxDifference.GreaterThan(decimal.Zero) {
				supplementTaxNeeded = taxDifference
			} else {
				supplementTaxNeeded = decimal.Zero
			}
		}

		if returnAdjustedTax.GreaterThan(decimal.Zero) {
			discrepancies = append(discrepancies, s.createDiscrepancy(
				batchID, "", declaration.OrderNo,
				models.DiscrepancyTypeReturn, "return_adjusted_tax",
				decimal.Zero, returnAdjustedTax,
				fmt.Sprintf("海关退单调整：%s - %s", returnReceipt.ReturnCode, returnReceipt.ReturnReason),
				"customs_return",
			))
		}
	}

	if isDuplicate {
		supplementTaxNeeded = supplementTaxNeeded.Add(expectedTaxAmount)
		discrepancies = append(discrepancies, s.createDiscrepancy(
			batchID, "", declaration.OrderNo,
			models.DiscrepancyTypeDuplicate, "duplicate_order",
			decimal.Zero, expectedTaxAmount,
			fmt.Sprintf("订单 %s 重复申报，需补缴税款", declaration.OrderNo),
			"duplicate_declaration",
		))
	}

	if taxDifference.Abs().GreaterThan(decimal.NewFromFloat(0.01)) {
		discrepancies = append(discrepancies, s.createDiscrepancy(
			batchID, "", declaration.OrderNo,
			models.DiscrepancyTypeAmount, "tax_difference",
			expectedTaxAmount, declaredTaxAmountCNY,
			fmt.Sprintf("税款差异：预期%.2f，申报%.2f，差异%.2f",
				expectedTaxAmount.InexactFloat64(),
				declaredTaxAmountCNY.InexactFloat64(),
				taxDifference.InexactFloat64()),
			"tax_calculation",
		))
	}

	status := models.ItemStatusMatched
	if len(discrepancies) > 0 {
		status = models.ItemStatusDiscrepancy
	}

	finalTaxAmount := declaredTaxAmountCNY.Add(returnAdjustedTax).Add(supplementTaxNeeded)

	item := &models.ReconciliationItem{
		BatchID:            batchID,
		OrderNo:            declaration.OrderNo,
		TrackingNo:         declaration.TrackingNo,
		DeclarationID:      declaration.ID,
		HSCode:             declaration.HSCode,
		ProductName:        declaration.ProductName,
		Category:           declaration.Category,
		Quantity:           declaration.Quantity,
		DeclaredAmount:     declaration.TotalAmount,
		DeclaredCurrency:   declaration.Currency,
		DeclaredAmountCNY:  declaredAmountCNY,
		ExchangeRate:       exchangeRate,
		ApplicableTaxRate:  applicableTaxRate,
		ExpectedTaxAmount:  expectedTaxAmount,
		DeclaredTaxAmount:  declaredTaxAmountCNY,
		TaxDifference:      taxDifference,
		HasReturnReceipt:   hasReturnReceipt,
		ReturnAdjustedTax:  returnAdjustedTax,
		SupplementTaxNeeded: supplementTaxNeeded,
		FinalTaxAmount:     finalTaxAmount,
		Status:             status,
		IsReviewed:         false,
	}

	if returnReceipt != nil {
		item.ReturnReceiptID = returnReceipt.ID
	}
	if tariff != nil {
		item.TariffID = tariff.ID
	}

	for i := range discrepancies {
		discrepancies[i].ReconciliationItemID = item.ID
	}

	return item, discrepancies, nil
}

func (s *ReconciliationService) createDiscrepancy(
	batchID, itemID, orderNo, discrepancyType, fieldName string,
	expectedValue, actualValue decimal.Decimal,
	explanation, source string,
) *models.Discrepancy {
	return &models.Discrepancy{
		BatchID:             batchID,
		ReconciliationItemID: itemID,
		OrderNo:             orderNo,
		DiscrepancyType:     discrepancyType,
		FieldName:           fieldName,
		ExpectedValue:       expectedValue,
		ActualValue:         actualValue,
		Difference:          expectedValue.Sub(actualValue),
		Explanation:         explanation,
		Source:              source,
		IsResolved:          false,
	}
}

func (s *ReconciliationService) GetBatchItems(batchID string) ([]*models.ReconciliationItem, error) {
	return s.itemRepo.GetByBatchID(batchID)
}

func (s *ReconciliationService) GetItemDiscrepancies(itemID string) ([]*models.Discrepancy, error) {
	return s.discrepancyRepo.GetByItemID(itemID)
}

func (s *ReconciliationService) GetBatchDiscrepancies(batchID string) ([]*models.Discrepancy, error) {
	return s.discrepancyRepo.GetByBatchID(batchID)
}

func (s *ReconciliationService) GetCategorySummary(batchID string) (map[string]interface{}, error) {
	items, err := s.itemRepo.GetByBatchID(batchID)
	if err != nil {
		return nil, err
	}

	categoryMap := make(map[string]struct {
		Count         int
		TotalTax      decimal.Decimal
		TotalDiff     decimal.Decimal
		DiscrepancyCount int
	})

	for _, item := range items {
		cat := item.Category
		if cat == "" {
			cat = "未分类"
		}

		data := categoryMap[cat]
		data.Count++
		data.TotalTax = data.TotalTax.Add(item.FinalTaxAmount)
		data.TotalDiff = data.TotalDiff.Add(item.TaxDifference)
		if item.Status == models.ItemStatusDiscrepancy {
			data.DiscrepancyCount++
		}
		categoryMap[cat] = data
	}

	result := make(map[string]interface{})
	for cat, data := range categoryMap {
		result[cat] = map[string]interface{}{
			"count":             data.Count,
			"total_tax":         data.TotalTax,
			"total_difference":  data.TotalDiff,
			"discrepancy_count": data.DiscrepancyCount,
		}
	}

	return result, nil
}

func (s *ReconciliationService) GetCurrencySummary(batchID string) (map[string]interface{}, error) {
	items, err := s.itemRepo.GetByBatchID(batchID)
	if err != nil {
		return nil, err
	}

	currencyMap := make(map[string]struct {
		Count         int
		OriginalTotal decimal.Decimal
		CNYTotal      decimal.Decimal
	})

	for _, item := range items {
		curr := item.DeclaredCurrency
		if curr == "" {
			curr = "UNKNOWN"
		}

		data := currencyMap[curr]
		data.Count++
		data.OriginalTotal = data.OriginalTotal.Add(item.DeclaredAmount)
		data.CNYTotal = data.CNYTotal.Add(item.DeclaredAmountCNY)
		currencyMap[curr] = data
	}

	result := make(map[string]interface{})
	for curr, data := range currencyMap {
		result[curr] = map[string]interface{}{
			"count":          data.Count,
			"original_total": data.OriginalTotal,
			"cny_total":      data.CNYTotal,
		}
	}

	return result, nil
}
