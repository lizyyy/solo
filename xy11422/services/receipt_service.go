package services

import (
	"errors"
	"fmt"
	"time"
	"used-car-retry-queue/config"
	"used-car-retry-queue/database"
	"used-car-retry-queue/models"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type ReceiptService struct {
	cfg *config.QueueConfig
}

func NewReceiptService(cfg *config.QueueConfig) *ReceiptService {
	return &ReceiptService{cfg: cfg}
}

type SubmitReceiptRequest struct {
	CarVin            string                `json:"car_vin" binding:"required"`
	CarPlate          string                `json:"car_plate"`
	Source            models.ReceiptSource  `json:"source" binding:"required"`
	SourceFile        string                `json:"source_file"`
	SourceLine        int                   `json:"source_line"`
	RawData           string                `json:"raw_data" binding:"required"`
	StandardData      string                `json:"standard_data"`
	Amount            float64               `json:"amount"`
	ResponsiblePerson string                `json:"responsible_person"`
	Operator          string                `json:"operator" binding:"required"`
}

func (s *ReceiptService) SubmitReceipt(req *SubmitReceiptRequest) (*models.Receipt, error) {
	receiptNo := generateReceiptNo(req.Source)

	receipt := &models.Receipt{
		ReceiptNo:         receiptNo,
		CarVin:            req.CarVin,
		CarPlate:          req.CarPlate,
		Source:            req.Source,
		SourceFile:        req.SourceFile,
		SourceLine:        req.SourceLine,
		RawData:           req.RawData,
		StandardData:      req.StandardData,
		Amount:            req.Amount,
		ResponsiblePerson: req.ResponsiblePerson,
		CurrentStatus:     models.StatusSubmitted,
		RetryCount:        0,
		MaxRetries:        s.cfg.MaxRetries,
	}

	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(receipt).Error; err != nil {
			return err
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: "",
			ToStatus:   models.StatusSubmitted,
			Operator:   req.Operator,
			Reason:     "回执提交",
			ChangeTime: time.Now(),
		}
		return tx.Create(history).Error
	})

	if err != nil {
		return nil, err
	}

	return receipt, nil
}

func (s *ReceiptService) QueueReceipt(receiptID uint, operator string) error {
	return s.changeStatus(receiptID, models.StatusQueued, operator, "加入处理队列", nil)
}

func (s *ReceiptService) StartProcessing(receiptID uint) error {
	return s.changeStatus(receiptID, models.StatusProcessing, "system", "开始处理", nil)
}

func (s *ReceiptService) HandleProcessingSuccess(receiptID uint) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: receipt.CurrentStatus,
			ToStatus:   models.StatusClosed,
			Operator:   "system",
			Reason:     "处理成功，自动关闭",
			ChangeTime: time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		now := time.Now()
		return tx.Model(&receipt).Updates(map[string]interface{}{
			"current_status": models.StatusClosed,
			"closed_by":      "system",
			"closed_at":      now,
			"updated_at":     now,
		}).Error
	})
}

func (s *ReceiptService) HandleProcessingFailure(receiptID uint, errMsg string, failureType models.FailureType) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		receipt.RetryCount++
		receipt.LastError = errMsg
		receipt.FailureType = failureType

		var newStatus models.ReceiptStatus
		var reason string

		switch failureType {
		case models.FailureRetryable:
			if receipt.RetryCount >= receipt.MaxRetries {
				newStatus = models.StatusDeadLetter
				reason = fmt.Sprintf("重试次数已达上限(%d次)，进入死信队列", receipt.MaxRetries)
			} else {
				newStatus = models.StatusRetryWait
				reason = fmt.Sprintf("处理失败，等待第%d次重试", receipt.RetryCount)
				s.scheduleRetry(tx, &receipt)
			}
		case models.FailureManual:
			newStatus = models.StatusManualWait
			reason = "需要人工介入处理"
		case models.FailurePermanent:
			newStatus = models.StatusDeadLetter
			reason = "永久失败，进入死信队列"
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: receipt.CurrentStatus,
			ToStatus:   newStatus,
			Operator:   "system",
			Reason:     reason,
			AdditionalInfo: fmt.Sprintf("错误信息: %s, 重试次数: %d/%d",
				errMsg, receipt.RetryCount, receipt.MaxRetries),
			ChangeTime: time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		return tx.Model(&receipt).Updates(map[string]interface{}{
			"current_status": newStatus,
			"retry_count":    receipt.RetryCount,
			"last_error":     errMsg,
			"failure_type":   failureType,
			"updated_at":     time.Now(),
		}).Error
	})
}

func (s *ReceiptService) scheduleRetry(tx *gorm.DB, receipt *models.Receipt) {
	interval := s.cfg.RetryInterval * time.Duration(
		intPow(s.cfg.BackoffMultiplier, receipt.RetryCount-1),
	)
	if interval > s.cfg.MaxRetryInterval {
		interval = s.cfg.MaxRetryInterval
	}

	retryTask := &models.RetryTask{
		ReceiptID:   receipt.ID,
		RetryNo:     receipt.RetryCount,
		ScheduledAt: time.Now().Add(interval),
		Status:      "scheduled",
	}
	tx.Create(retryTask)
}

func (s *ReceiptService) ManualTakeOver(receiptID uint, operator string, reason string) error {
	return s.changeStatus(receiptID, models.StatusManualWait, operator, reason, nil)
}

func (s *ReceiptService) ManualProcess(receiptID uint, operator string, result string, additionalInfo string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		if receipt.CurrentStatus != models.StatusManualWait &&
			receipt.CurrentStatus != models.StatusDeadLetter {
			return errors.New("只有等待人工处理或死信状态的回执可以人工处理")
		}

		var newStatus models.ReceiptStatus
		var reason string

		if result == "success" {
			newStatus = models.StatusClosed
			reason = "人工处理成功"
		} else if result == "retry" {
			newStatus = models.StatusQueued
			reason = "人工触发重新排队"
			receipt.RetryCount = 0
		} else {
			newStatus = models.StatusDeadLetter
			reason = "人工判定无法处理"
		}

		history := &models.StatusHistory{
			ReceiptID:      receipt.ID,
			FromStatus:     receipt.CurrentStatus,
			ToStatus:       newStatus,
			Operator:       operator,
			Reason:         reason,
			AdditionalInfo: additionalInfo,
			ChangeTime:     time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		updates := map[string]interface{}{
			"current_status": newStatus,
			"updated_at":     time.Now(),
		}
		if result == "retry" {
			updates["retry_count"] = 0
		}
		if newStatus == models.StatusClosed {
			updates["closed_by"] = operator
			updates["closed_at"] = time.Now()
		}

		return tx.Model(&receipt).Updates(updates).Error
	})
}

func (s *ReceiptService) Compensate(receiptID uint, operator string, amount float64, reason string, accountNo string, voucherNo string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		compensation := &models.CompensationRecord{
			ReceiptID:        receipt.ID,
			ReceiptNo:        receipt.ReceiptNo,
			CarVin:           receipt.CarVin,
			Amount:           amount,
			Operator:         operator,
			Reason:           reason,
			CompensationTime: time.Now(),
			AccountNo:        accountNo,
			VoucherNo:        voucherNo,
		}
		if err := tx.Create(compensation).Error; err != nil {
			return err
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: receipt.CurrentStatus,
			ToStatus:   models.StatusCompensated,
			Operator:   operator,
			Reason:     fmt.Sprintf("补偿入账: %.2f元, %s", amount, reason),
			AdditionalInfo: fmt.Sprintf("账号: %s, 凭证号: %s", accountNo, voucherNo),
			ChangeTime: time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		return tx.Model(&receipt).Updates(map[string]interface{}{
			"current_status":      models.StatusCompensated,
			"compensation_amount": amount,
			"updated_at":          time.Now(),
		}).Error
	})
}

func (s *ReceiptService) CloseReceipt(receiptID uint, operator string, reason string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		history := &models.StatusHistory{
			ReceiptID:  receipt.ID,
			FromStatus: receipt.CurrentStatus,
			ToStatus:   models.StatusClosed,
			Operator:   operator,
			Reason:     reason,
			ChangeTime: time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		now := time.Now()
		return tx.Model(&receipt).Updates(map[string]interface{}{
			"current_status": models.StatusClosed,
			"closed_by":      operator,
			"closed_at":      now,
			"updated_at":     now,
		}).Error
	})
}

func (s *ReceiptService) GetReceipt(receiptID uint) (*models.Receipt, error) {
	var receipt models.Receipt
	err := database.GetDB().Preload("StatusHistory").Preload("RetryTasks").First(&receipt, receiptID).Error
	return &receipt, err
}

func (s *ReceiptService) GetReceiptByNo(receiptNo string) (*models.Receipt, error) {
	var receipt models.Receipt
	err := database.GetDB().Preload("StatusHistory").Preload("RetryTasks").Where("receipt_no = ?", receiptNo).First(&receipt).Error
	return &receipt, err
}

func (s *ReceiptService) ListReceipts(status models.ReceiptStatus, carVin string, page int, pageSize int) ([]models.Receipt, int64, error) {
	var receipts []models.Receipt
	var total int64

	query := database.GetDB().Model(&models.Receipt{})
	if status != "" {
		query = query.Where("current_status = ?", status)
	}
	if carVin != "" {
		query = query.Where("car_vin = ?", carVin)
	}

	query.Count(&total)
	offset := (page - 1) * pageSize
	err := query.Offset(offset).Limit(pageSize).Order("created_at DESC").Find(&receipts).Error
	return receipts, total, err
}

func (s *ReceiptService) GetRetryCategoryStats() ([]models.RetryCategoryStats, error) {
	var stats []models.RetryCategoryStats
	err := database.GetDB().Model(&models.Receipt{}).
		Select("current_status as category, count(*) as count, sum(amount) as total_amount").
		Where("current_status IN ?", []models.ReceiptStatus{
			models.StatusRetryWait,
			models.StatusManualWait,
			models.StatusDeadLetter,
		}).
		Group("current_status").
		Scan(&stats).Error
	return stats, err
}

func (s *ReceiptService) GetDeadLetterStats() ([]models.DeadLetterStats, error) {
	var stats []models.DeadLetterStats
	err := database.GetDB().Model(&models.Receipt{}).
		Select("last_error as reason, count(*) as count, sum(amount) as total_amount").
		Where("current_status = ?", models.StatusDeadLetter).
		Group("last_error").
		Scan(&stats).Error
	return stats, err
}

func (s *ReceiptService) changeStatus(receiptID uint, newStatus models.ReceiptStatus, operator string, reason string, additionalInfo *string) error {
	return database.GetDB().Transaction(func(tx *gorm.DB) error {
		var receipt models.Receipt
		if err := tx.First(&receipt, receiptID).Error; err != nil {
			return err
		}

		info := ""
		if additionalInfo != nil {
			info = *additionalInfo
		}

		history := &models.StatusHistory{
			ReceiptID:      receipt.ID,
			FromStatus:     receipt.CurrentStatus,
			ToStatus:       newStatus,
			Operator:       operator,
			Reason:         reason,
			AdditionalInfo: info,
			ChangeTime:     time.Now(),
		}
		if err := tx.Create(history).Error; err != nil {
			return err
		}

		return tx.Model(&receipt).Updates(map[string]interface{}{
			"current_status": newStatus,
			"updated_at":     time.Now(),
		}).Error
	})
}

func generateReceiptNo(source models.ReceiptSource) string {
	prefix := map[models.ReceiptSource]string{
		models.SourceInspection:  "INSP",
		models.SourceRepairQuote: "RPRQ",
		models.SourcePhotoList:   "PHOT",
		models.SourceSupplier:    "SUPP",
	}[source]
	if prefix == "" {
		prefix = "RCPT"
	}
	return fmt.Sprintf("%s-%s-%s", prefix, time.Now().Format("20060102"), uuid.New().String()[:8])
}

func intPow(base float64, exp int) int {
	result := 1.0
	for i := 0; i < exp; i++ {
		result *= base
	}
	return int(result)
}
