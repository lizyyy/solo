package services

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"io"
	"strconv"
	"strings"
	"time"

	"customs-reconciliation/internal/models"
	"customs-reconciliation/internal/repository"

	"github.com/shopspring/decimal"
)

type ImportService struct {
	declarationRepo   *repository.DeclarationRepository
	tariffRepo        *repository.TariffRepository
	returnReceiptRepo *repository.ReturnReceiptRepository
	batchRepo         *repository.ReconciliationBatchRepository
}

func NewImportService() *ImportService {
	return &ImportService{
		declarationRepo:   repository.NewDeclarationRepository(),
		tariffRepo:        repository.NewTariffRepository(),
		returnReceiptRepo: repository.NewReturnReceiptRepository(),
		batchRepo:         repository.NewReconciliationBatchRepository(),
	}
}

type ImportResult struct {
	BatchID    string `json:"batch_id"`
	BatchName  string `json:"batch_name"`
	TotalRows  int    `json:"total_rows"`
	Imported   int    `json:"imported"`
	FailedRows int    `json:"failed_rows"`
}

func (s *ImportService) CreateBatch(name string) (*models.ReconciliationBatch, error) {
	batch := &models.ReconciliationBatch{
		Name:   name,
		Status: models.BatchStatusPending,
	}
	err := s.batchRepo.Create(batch)
	return batch, err
}

func (s *ImportService) ImportDeclarationsFromCSV(reader io.Reader, batchID string) (*ImportResult, error) {
	csvReader := csv.NewReader(reader)
	records, err := csvReader.ReadAll()
	if err != nil {
		return nil, err
	}

	if len(records) < 2 {
		return nil, errors.New("CSV file is empty or has no data rows")
	}

	headers := records[0]
	headerIndex := make(map[string]int)
	for i, h := range headers {
		headerIndex[strings.TrimSpace(strings.ToLower(h))] = i
	}

	result := &ImportResult{
		BatchID:   batchID,
		TotalRows: len(records) - 1,
	}

	var declarations []*models.Declaration

	for i := 1; i < len(records); i++ {
		row := records[i]
		declaration, err := s.parseDeclarationRow(row, headerIndex, batchID)
		if err != nil {
			result.FailedRows++
			continue
		}
		declarations = append(declarations, declaration)
		result.Imported++
	}

	if len(declarations) > 0 {
		if err := s.declarationRepo.BatchCreate(declarations); err != nil {
			return nil, err
		}
	}

	return result, nil
}

func (s *ImportService) parseDeclarationRow(row []string, headerIndex map[string]int, batchID string) (*models.Declaration, error) {
	getField := func(name string) string {
		if idx, ok := headerIndex[name]; ok && idx < len(row) {
			return strings.TrimSpace(row[idx])
		}
		return ""
	}

	parseDecimal := func(name string) decimal.Decimal {
		val := getField(name)
		if val == "" {
			return decimal.Zero
		}
		d, _ := decimal.NewFromString(val)
		return d
	}

	parseInt := func(name string) int {
		val := getField(name)
		if val == "" {
			return 0
		}
		i, _ := strconv.Atoi(val)
		return i
	}

	parseDate := func(name string) time.Time {
		val := getField(name)
		if val == "" {
			return time.Now()
		}
		t, err := time.Parse("2006-01-02", val)
		if err != nil {
			t, err = time.Parse(time.RFC3339, val)
			if err != nil {
				return time.Now()
			}
		}
		return t
	}

	rawData, _ := json.Marshal(row)

	return &models.Declaration{
		BatchID:           batchID,
		OrderNo:           getField("order_no"),
		TrackingNo:        getField("tracking_no"),
		Declarant:         getField("declarant"),
		DeclareDate:       parseDate("declare_date"),
		HSCode:            getField("hs_code"),
		ProductName:       getField("product_name"),
		Category:          getField("category"),
		Quantity:          parseInt("quantity"),
		UnitPrice:         parseDecimal("unit_price"),
		TotalAmount:       parseDecimal("total_amount"),
		Currency:          getField("currency"),
		DeclaredTaxAmount: parseDecimal("declared_tax_amount"),
		Status:            getField("status"),
		RawData:           string(rawData),
	}, nil
}

func (s *ImportService) ImportTariffsFromJSON(reader io.Reader, batchID string) (*ImportResult, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var tariffList []map[string]interface{}
	if err := json.Unmarshal(data, &tariffList); err != nil {
		return nil, err
	}

	result := &ImportResult{
		BatchID:   batchID,
		TotalRows: len(tariffList),
	}

	var tariffs []*models.Tariff

	for _, item := range tariffList {
		tariff, err := s.parseTariffItem(item, batchID)
		if err != nil {
			result.FailedRows++
			continue
		}
		tariffs = append(tariffs, tariff)
		result.Imported++
	}

	if len(tariffs) > 0 {
		if err := s.tariffRepo.BatchCreate(tariffs); err != nil {
			return nil, err
		}
	}

	return result, nil
}

func (s *ImportService) parseTariffItem(item map[string]interface{}, batchID string) (*models.Tariff, error) {
	getString := func(key string) string {
		if v, ok := item[key]; ok {
			if s, ok := v.(string); ok {
				return s
			}
		}
		return ""
	}

	getDecimal := func(key string) decimal.Decimal {
		if v, ok := item[key]; ok {
			switch val := v.(type) {
			case float64:
				return decimal.NewFromFloat(val)
			case string:
				d, _ := decimal.NewFromString(val)
				return d
			}
		}
		return decimal.Zero
	}

	getBool := func(key string) bool {
		if v, ok := item[key]; ok {
			if b, ok := v.(bool); ok {
				return b
			}
		}
		return true
	}

	parseDate := func(key string) time.Time {
		if v, ok := item[key]; ok {
			if s, ok := v.(string); ok {
				t, err := time.Parse("2006-01-02", s)
				if err != nil {
					t, err = time.Parse(time.RFC3339, s)
					if err == nil {
						return t
					}
				} else {
					return t
				}
			}
		}
		return time.Now()
	}

	rawData, _ := json.Marshal(item)

	return &models.Tariff{
		BatchID:       batchID,
		HSCode:        getString("hs_code"),
		ProductName:   getString("product_name"),
		Category:      getString("category"),
		ParentHSCode:  getString("parent_hs_code"),
		TaxRate:       getDecimal("tax_rate"),
		ConsumptionTax: getDecimal("consumption_tax"),
		VATRate:       getDecimal("vat_rate"),
		EffectiveDate: parseDate("effective_date"),
		IsActive:      getBool("is_active"),
		RawData:       string(rawData),
	}, nil
}

func (s *ImportService) ImportReturnReceiptsFromJSON(reader io.Reader, batchID string) (*ImportResult, error) {
	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	var receiptList []map[string]interface{}
	if err := json.Unmarshal(data, &receiptList); err != nil {
		return nil, err
	}

	result := &ImportResult{
		BatchID:   batchID,
		TotalRows: len(receiptList),
	}

	var receipts []*models.ReturnReceipt

	for _, item := range receiptList {
		receipt, err := s.parseReturnReceiptItem(item, batchID)
		if err != nil {
			result.FailedRows++
			continue
		}
		receipts = append(receipts, receipt)
		result.Imported++
	}

	if len(receipts) > 0 {
		if err := s.returnReceiptRepo.BatchCreate(receipts); err != nil {
			return nil, err
		}
	}

	return result, nil
}

func (s *ImportService) parseReturnReceiptItem(item map[string]interface{}, batchID string) (*models.ReturnReceipt, error) {
	getString := func(key string) string {
		if v, ok := item[key]; ok {
			if s, ok := v.(string); ok {
				return s
			}
		}
		return ""
	}

	getDecimal := func(key string) decimal.Decimal {
		if v, ok := item[key]; ok {
			switch val := v.(type) {
			case float64:
				return decimal.NewFromFloat(val)
			case string:
				d, _ := decimal.NewFromString(val)
				return d
			}
		}
		return decimal.Zero
	}

	getBool := func(key string) bool {
		if v, ok := item[key]; ok {
			if b, ok := v.(bool); ok {
				return b
			}
		}
		return false
	}

	parseDate := func(key string) time.Time {
		if v, ok := item[key]; ok {
			if s, ok := v.(string); ok {
				t, err := time.Parse("2006-01-02", s)
				if err != nil {
					t, err = time.Parse(time.RFC3339, s)
					if err == nil {
						return t
					}
				} else {
					return t
				}
			}
		}
		return time.Now()
	}

	rawData, _ := json.Marshal(item)

	return &models.ReturnReceipt{
		BatchID:         batchID,
		ReceiptNo:       getString("receipt_no"),
		OrderNo:         getString("order_no"),
		TrackingNo:      getString("tracking_no"),
		ReturnDate:      parseDate("return_date"),
		ReturnCode:      getString("return_code"),
		ReturnReason:    getString("return_reason"),
		ReturnCategory:  getString("return_category"),
		AdjustedAmount:  getDecimal("adjusted_amount"),
		AdjustedTax:     getDecimal("adjusted_tax"),
		RequireSupplement: getBool("require_supplement"),
		Status:          getString("status"),
		RawData:         string(rawData),
	}, nil
}
