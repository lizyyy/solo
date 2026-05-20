package services

import (
	"qa-tracking-system/config"
	"qa-tracking-system/models"
	"time"
)

func ProcessBatch(batchID uint, handler string, remark *string) (*models.Batch, error) {
	var batch models.Batch
	if err := config.DB.First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	fromStatus := string(batch.Status)
	batch.Status = models.BatchStatusProcessing
	batch.Handler = &handler
	if remark != nil {
		batch.Remark = remark
	}
	batch.UpdatedAt = time.Now()

	if err := config.DB.Save(&batch).Error; err != nil {
		return nil, err
	}

	if err := AddTrackingLog(batchID, "process", &fromStatus, string(models.BatchStatusProcessing), handler, "标记处理"); err != nil {
		return nil, err
	}

	return &batch, nil
}

func ReturnBatch(batchID uint, handler string, reason string) (*models.Batch, error) {
	var batch models.Batch
	if err := config.DB.First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	fromStatus := string(batch.Status)
	batch.Status = models.BatchStatusReturned
	batch.UpdatedAt = time.Now()

	if err := config.DB.Save(&batch).Error; err != nil {
		return nil, err
	}

	if err := AddTrackingLog(batchID, "return", &fromStatus, string(models.BatchStatusReturned), handler, reason); err != nil {
		return nil, err
	}

	return &batch, nil
}

func ApproveBatch(batchID uint, handler string, remark *string) (*models.Batch, error) {
	var batch models.Batch
	if err := config.DB.First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	fromStatus := string(batch.Status)
	batch.Status = models.BatchStatusApproved
	batch.UpdatedAt = time.Now()

	if err := config.DB.Save(&batch).Error; err != nil {
		return nil, err
	}

	reason := "审核通过"
	if remark != nil {
		reason = *remark
	}
	if err := AddTrackingLog(batchID, "approve", &fromStatus, string(models.BatchStatusApproved), handler, reason); err != nil {
		return nil, err
	}

	return &batch, nil
}

func RejectBatch(batchID uint, handler string, reason string) (*models.Batch, error) {
	var batch models.Batch
	if err := config.DB.First(&batch, batchID).Error; err != nil {
		return nil, err
	}

	fromStatus := string(batch.Status)
	batch.Status = models.BatchStatusRejected
	batch.UpdatedAt = time.Now()

	if err := config.DB.Save(&batch).Error; err != nil {
		return nil, err
	}

	if err := AddTrackingLog(batchID, "reject", &fromStatus, string(models.BatchStatusRejected), handler, reason); err != nil {
		return nil, err
	}

	return &batch, nil
}

func GetBatch(batchID uint) (*models.Batch, error) {
	var batch models.Batch
	err := config.DB.Preload("Samples").
		Preload("TestProtocols").
		Preload("TrackingLogs").
		First(&batch, batchID).Error
	if err != nil {
		return nil, err
	}
	return &batch, nil
}

func ListBatches(batchNo, status string, offset, limit int) ([]models.Batch, int64, error) {
	var batches []models.Batch
	var total int64

	query := config.DB.Model(&models.Batch{})

	if batchNo != "" {
		query = query.Where("batch_no LIKE ?", "%"+batchNo+"%")
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if err := query.Offset(offset).Limit(limit).
		Order("created_at DESC").
		Find(&batches).Error; err != nil {
		return nil, 0, err
	}

	return batches, total, nil
}
