package services

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"
	"time"
	"used-car-retry-queue/database"
	"used-car-retry-queue/models"

	"gorm.io/gorm"
)

type ImportService struct {
	receiptService *ReceiptService
}

func NewImportService(receiptService *ReceiptService) *ImportService {
	return &ImportService{receiptService: receiptService}
}

type ImportResult struct {
	TotalRows   int      `json:"total_rows"`
	SuccessRows int      `json:"success_rows"`
	FailedRows  int      `json:"failed_rows"`
	Errors      []string `json:"errors"`
	ReceiptNos  []string `json:"receipt_nos"`
}

func (is *ImportService) ImportFromCSV(filePath string, source models.ReceiptSource, operator string) (*ImportResult, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	reader := csv.NewReader(file)
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("failed to read headers: %w", err)
	}

	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.ToLower(strings.TrimSpace(h))] = i
	}

	result := &ImportResult{
		Errors:     make([]string, 0),
		ReceiptNos: make([]string, 0),
	}

	importRecord := &models.ImportRecord{
		SourceFile: filePath,
		Source:     source,
		Operator:   operator,
		ImportTime: time.Now(),
	}

	lineNum := 1
	for {
		record, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Line %d: read error: %v", lineNum+1, err))
			result.FailedRows++
			continue
		}

		lineNum++
		result.TotalRows++

		receiptNo, err := is.importRow(record, headerMap, source, filePath, lineNum, operator)
		if err != nil {
			result.Errors = append(result.Errors, fmt.Sprintf("Line %d: %v", lineNum, err))
			result.FailedRows++
			continue
		}

		result.SuccessRows++
		result.ReceiptNos = append(result.ReceiptNos, receiptNo)
	}

	importRecord.TotalRows = result.TotalRows
	importRecord.SuccessRows = result.SuccessRows
	importRecord.FailedRows = result.FailedRows
	if len(result.Errors) > 0 {
		errorLog, _ := json.Marshal(result.Errors)
		importRecord.ErrorLog = string(errorLog)
	}

	database.GetDB().Create(importRecord)

	return result, nil
}

func (is *ImportService) importRow(record []string, headerMap map[string]int, source models.ReceiptSource,
	sourceFile string, sourceLine int, operator string) (string, error) {

	getValue := func(key string) string {
		if idx, ok := headerMap[key]; ok && idx < len(record) {
			return strings.TrimSpace(record[idx])
		}
		return ""
	}

	carVin := getValue("vin")
	if carVin == "" {
		carVin = getValue("carvin")
	}
	if carVin == "" {
		return "", fmt.Errorf("VIN is required")
	}

	amount := 0.0
	if amountStr := getValue("amount"); amountStr != "" {
		amount, _ = strconv.ParseFloat(amountStr, 64)
	}

	rawData, _ := json.Marshal(record)
	standardData := is.buildStandardData(record, headerMap, source)

	req := &SubmitReceiptRequest{
		CarVin:            carVin,
		CarPlate:          getValue("plate"),
		Source:            source,
		SourceFile:        sourceFile,
		SourceLine:        sourceLine,
		RawData:           string(rawData),
		StandardData:      standardData,
		Amount:            amount,
		ResponsiblePerson: getValue("responsible"),
		Operator:          operator,
	}

	receipt, err := is.receiptService.SubmitReceipt(req)
	if err != nil {
		return "", fmt.Errorf("failed to create receipt: %w", err)
	}

	is.receiptService.QueueReceipt(receipt.ID, operator)

	return receipt.ReceiptNo, nil
}

func (is *ImportService) buildStandardData(record []string, headerMap map[string]int, source models.ReceiptSource) string {
	data := make(map[string]interface{})

	getValue := func(key string) string {
		if idx, ok := headerMap[key]; ok && idx < len(record) {
			return strings.TrimSpace(record[idx])
		}
		return ""
	}

	data["source"] = source

	switch source {
	case models.SourceInspection:
		data["type"] = "inspection"
		data["items"] = getValue("items")
		data["inspector"] = getValue("inspector")
		data["inspection_date"] = getValue("date")

	case models.SourceRepairQuote:
		data["type"] = "repair_quote"
		data["repair_items"] = getValue("items")
		data["workshop"] = getValue("workshop")
		data["quote_date"] = getValue("date")

	case models.SourcePhotoList:
		data["type"] = "photo_list"
		data["photo_count"] = getValue("count")
		data["photographer"] = getValue("photographer")
		data["shoot_date"] = getValue("date")

	case models.SourceSupplier:
		data["type"] = "supplier_statement"
		data["supplier"] = getValue("supplier")
		data["invoice_no"] = getValue("invoice")
		data["statement_date"] = getValue("date")
	}

	result, _ := json.Marshal(data)
	return string(result)
}

func (is *ImportService) GetImportHistory(page int, pageSize int) ([]models.ImportRecord, int64, error) {
	var records []models.ImportRecord
	var total int64

	database.GetDB().Model(&models.ImportRecord{}).Count(&total)
	offset := (page - 1) * pageSize
	err := database.GetDB().Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&records).Error
	return records, total, err
}

func (is *ImportService) GetReceiptEvidence(receiptID uint) (map[string]interface{}, error) {
	var receipt models.Receipt
	err := database.GetDB().Preload("StatusHistory").First(&receipt, receiptID).Error
	if err != nil {
		return nil, err
	}

	evidence := map[string]interface{}{
		"receipt_no":      receipt.ReceiptNo,
		"source":          receipt.Source,
		"source_file":     receipt.SourceFile,
		"source_line":     receipt.SourceLine,
		"raw_data":        receipt.RawData,
		"standard_data":   receipt.StandardData,
		"original_amount": receipt.Amount,
		"created_at":      receipt.CreatedAt,
	}

	var rawRecord []interface{}
	json.Unmarshal([]byte(receipt.RawData), &rawRecord)
	evidence["raw_parsed"] = rawRecord

	var standardParsed map[string]interface{}
	json.Unmarshal([]byte(receipt.StandardData), &standardParsed)
	evidence["standard_parsed"] = standardParsed

	return evidence, nil
}

func (is *ImportService) UpdateStandardData(receiptID uint, operator string, newStandardData string, reason string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: receipt.CurrentStatus,
			ToStatus:   receipt.CurrentStatus,
			Operator:   operator,
			Reason:     fmt.Sprintf("修改标准数据: %s", reason),
			AdditionalInfo: fmt.Sprintf("原标准数据: %s\n新标准数据: %s",
				receipt.StandardData, newStandardData),
			ChangeTime: time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		return tx.Model(&receipt).Update("standard_data", newStandardData).Error
	})
}
