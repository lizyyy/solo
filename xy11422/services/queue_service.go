package services

import (
	"context"
	"fmt"
	"log"
	"time"
	"used-car-retry-queue/config"
	"used-car-retry-queue/database"
	"used-car-retry-queue/models"

	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type QueueService struct {
	cfg            *config.QueueConfig
	receiptService *ReceiptService
	cron           *cron.Cron
	processor      func(*models.Receipt) error
}

func NewQueueService(cfg *config.QueueConfig, receiptService *ReceiptService) *QueueService {
	return &QueueService{
		cfg:            cfg,
		receiptService: receiptService,
		cron:           cron.New(),
		processor:      defaultProcessor,
	}
}

func (qs *QueueService) SetProcessor(processor func(*models.Receipt) error) {
	qs.processor = processor
}

func (qs *QueueService) Start(ctx context.Context) error {
	_, err := qs.cron.AddFunc(qs.cfg.CronSchedule, func() {
		qs.ProcessQueue()
	})
	if err != nil {
		return err
	}

	_, err = qs.cron.AddFunc(qs.cfg.CronSchedule, func() {
		qs.ProcessRetryTasks()
	})
	if err != nil {
		return err
	}

	qs.cron.Start()
	log.Println("Queue service started")

	<-ctx.Done()
	qs.cron.Stop()
	log.Println("Queue service stopped")
	return nil
}

func (qs *QueueService) ProcessQueue() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("ProcessQueue panic recovered: %v", r)
		}
	}()

	var receipts []models.Receipt
	err := database.GetDB().
		Where("current_status IN ?", []models.ReceiptStatus{
			models.StatusSubmitted,
			models.StatusQueued,
		}).
		Limit(qs.cfg.BatchSize).
		Order("created_at ASC").
		Find(&receipts).Error

	if err != nil {
		log.Printf("Failed to fetch queue: %v", err)
		return
	}

	log.Printf("Processing %d receipts from queue", len(receipts))

	for _, receipt := range receipts {
		qs.processReceipt(&receipt)
	}
}

func (qs *QueueService) ProcessRetryTasks() {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("ProcessRetryTasks panic recovered: %v", r)
		}
	}()

	now := time.Now()
	var retryTasks []models.RetryTask
	err := database.GetDB().
		Where("status = ? AND scheduled_at <= ?", "scheduled", now).
		Limit(qs.cfg.BatchSize).
		Order("scheduled_at ASC").
		Find(&retryTasks).Error

	if err != nil {
		log.Printf("Failed to fetch retry tasks: %v", err)
		return
	}

	if len(retryTasks) == 0 {
		return
	}

	log.Printf("Processing %d retry tasks", len(retryTasks))

	for _, task := range retryTasks {
		qs.processRetryTask(&task)
	}
}

func (qs *QueueService) processReceipt(receipt *models.Receipt) {
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var r models.Receipt
		if err := tx.First(&r, receipt.ID).Error; err != nil {
			return err
		}

		if r.CurrentStatus != models.StatusSubmitted && r.CurrentStatus != models.StatusQueued {
			return fmt.Errorf("receipt %s not in queueable state: %s", r.ReceiptNo, r.CurrentStatus)
		}

		return tx.Model(&r).Update("current_status", models.StatusProcessing).Error
	})

	if err != nil {
		log.Printf("Failed to lock receipt %d: %v", receipt.ID, err)
		return
	}

	qs.executeProcessing(receipt)
}

func (qs *QueueService) processRetryTask(task *models.RetryTask) {
	err := database.GetDB().Transaction(func(tx *gorm.DB) error {
		var t models.RetryTask
		if err := tx.First(&t, task.ID).Error; err != nil {
			return err
		}

		if t.Status != "scheduled" {
			return fmt.Errorf("retry task %d already processed: %s", t.ID, t.Status)
		}

		now := time.Now()
		return tx.Model(&t).Updates(map[string]interface{}{
			"status":     "processing",
			"executed_at": now,
		}).Error
	})

	if err != nil {
		log.Printf("Failed to lock retry task %d: %v", task.ID, err)
		return
	}

	var receipt models.Receipt
	if err := database.GetDB().First(&receipt, task.ReceiptID).Error; err != nil {
		log.Printf("Failed to find receipt for retry task %d: %v", task.ID, err)
		return
	}

	qs.executeRetryProcessing(&receipt, task)
}

func (qs *QueueService) executeProcessing(receipt *models.Receipt) {
	err := qs.processor(receipt)

	if err != nil {
		failureType := classifyError(err)
		log.Printf("Receipt %s processing failed: %v (type: %s)", receipt.ReceiptNo, err, failureType)
		qs.receiptService.HandleProcessingFailure(receipt.ID, err.Error(), failureType)
	} else {
		log.Printf("Receipt %s processed successfully", receipt.ReceiptNo)
		qs.receiptService.HandleProcessingSuccess(receipt.ID)
	}
}

func (qs *QueueService) executeRetryProcessing(receipt *models.Receipt, task *models.RetryTask) {
	err := qs.processor(receipt)

	database.GetDB().Transaction(func(tx *gorm.DB) error {
		var t models.RetryTask
		if err := tx.First(&t, task.ID).Error; err != nil {
			return err
		}

		status := "success"
		errorMsg := ""
		if err != nil {
			status = "failed"
			errorMsg = err.Error()
		}

		return tx.Model(&t).Updates(map[string]interface{}{
			"status":      status,
			"error_msg":   errorMsg,
			"updated_at":  time.Now(),
		}).Error
	})

	if err != nil {
		failureType := classifyError(err)
		log.Printf("Retry %d for receipt %s failed: %v (type: %s)",
			task.RetryNo, receipt.ReceiptNo, err, failureType)
		qs.receiptService.HandleProcessingFailure(receipt.ID, err.Error(), failureType)
	} else {
		log.Printf("Retry %d for receipt %s succeeded", task.RetryNo, receipt.ReceiptNo)
		qs.receiptService.HandleProcessingSuccess(receipt.ID)
	}
}

func (qs *QueueService) RecoverUnfinishedTasks() error {
	log.Println("Recovering unfinished tasks after service restart...")

	result := database.GetDB().
		Model(&models.RetryTask{}).
		Where("status = ?", "processing").
		Update("status", "scheduled")

	if result.Error != nil {
		log.Printf("Failed to recover retry tasks: %v", result.Error)
		return result.Error
	}

	result = database.GetDB().
		Model(&models.Receipt{}).
		Where("current_status = ?", models.StatusProcessing).
		Update("current_status", models.StatusQueued)

	if result.Error != nil {
		log.Printf("Failed to recover processing receipts: %v", result.Error)
		return result.Error
	}

	log.Println("Unfinished tasks recovered successfully")
	return nil
}

func (qs *QueueService) TriggerManualProcess() {
	log.Println("Manual process trigger received")
	qs.ProcessQueue()
	qs.ProcessRetryTasks()
}

func defaultProcessor(receipt *models.Receipt) error {
	log.Printf("Default processor: simulating processing for receipt %s (source: %s)",
		receipt.ReceiptNo, receipt.Source)

	time.Sleep(100 * time.Millisecond)
	return nil
}

func classifyError(err error) models.FailureType {
	errStr := err.Error()

	retryableKeywords := []string{
		"timeout", "connection", "network", "temporary",
		"busy", "rate limit", "throttled",
	}
	for _, kw := range retryableKeywords {
		if containsIgnoreCase(errStr, kw) {
			return models.FailureRetryable
		}
	}

	manualKeywords := []string{
		"invalid data", "validation", "missing", "format",
		"mismatch", "conflict", "duplicate",
	}
	for _, kw := range manualKeywords {
		if containsIgnoreCase(errStr, kw) {
			return models.FailureManual
		}
	}

	return models.FailurePermanent
}

func containsIgnoreCase(s, substr string) bool {
	return len(s) >= len(substr) &&
		(len(s) == 0 || len(substr) == 0 ||
			containsLower(toLower(s), toLower(substr)))
}

func toLower(s string) string {
	result := make([]byte, len(s))
	for i := 0; i < len(s); i++ {
		c := s[i]
		if c >= 'A' && c <= 'Z' {
			c += 'a' - 'A'
		}
		result[i] = c
	}
	return string(result)
}

func containsLower(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
