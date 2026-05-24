package services

import (
"dialysis-recall-api/database"
"dialysis-recall-api/models"
"time"
)

func ExecuteTrace(noticeID uint, operator string) (int, int, error) {
db := database.GetDB()
var notice models.RecallNotice
if err := db.First(&notice, noticeID).Error; err != nil {
return 0, 0, err
}
return 0, 0, nil
}

func ReviewTraceResult(traceResultID uint, newStatus models.RecallStatus, reviewer, reason string) error {
db := database.GetDB()
var traceResult models.TraceResult
if err := db.First(&traceResult, traceResultID).Error; err != nil {
return err
}
oldStatus := traceResult.Status
reviewRecord := models.ReviewRecord{
TraceResultID: traceResultID,
OldStatus: oldStatus,
NewStatus: newStatus,
Reviewer: reviewer,
ReviewTime: time.Now(),
Reason: reason,
}
db.Create(&reviewRecord)
return nil
}

func GetTraceResultsByNotice(noticeID uint, status *string) ([]models.TraceResult, error) {
db := database.GetDB()
var results []models.TraceResult
db.Where("recall_notice_id = ?", noticeID).Find(&results)
return results, nil
}

func UpdateNoticeStatus(noticeID uint, newStatus models.RecallStatus) error {
db := database.GetDB()
db.Model(&models.RecallNotice{}).Where("id = ?", noticeID).Update("status", newStatus)
return nil
}

func GetTraceHistory(noticeID uint) ([]models.TraceHistory, error) {
db := database.GetDB()
var history []models.TraceHistory
db.Where("recall_notice_id = ?", noticeID).Find(&history)
return history, nil
}

func GetReviewRecords(traceResultID uint) ([]models.ReviewRecord, error) {
db := database.GetDB()
var records []models.ReviewRecord
db.Where("trace_result_id = ?", traceResultID).Find(&records)
return records, nil
}
func GetReviewRecords(traceResultID uint) ([]models.ReviewRecord, error) {
	db := database.GetDB()
	var records []models.ReviewRecord
	db.Where("trace_result_id = ?", traceResultID).Find(&records)
	return records, nil
}
		RecallNoticeID: noticeID,
		Operator:       operator,
		TraceTime:      time.Now(),
		AffectedCount:  affectedCount,
		NewRecordCount: newRecordCount,
	}
	if err := db.Create(&traceHistory).Error; err != nil {
		return 0, 0, err
	}

	if err := db.Model(&notice).Update("traced_count", affectedCount).Error; err != nil {
		return 0, 0, err
	}

	return affectedCount, newRecordCount, nil
}

func generateTraceKey(noticeID, recordID uint) string {
	data := fmt.Sprintf("%d-%d", noticeID, recordID)
	hash := md5.Sum([]byte(data))
	return fmt.Sprintf("%x", hash)
}

func ReviewTraceResult(traceResultID uint, newStatus models.RecallStatus, reviewer, reason string) error {
	db := database.GetDB()

	var traceResult models.TraceResult
	if err := db.First(&traceResult, traceResultID).Error; err != nil {
		return err
	}

	oldStatus := traceResult.Status

	reviewRecord := models.ReviewRecord{
		TraceResultID: traceResultID,
		OldStatus:     oldStatus,
		NewStatus:     newStatus,
		Reviewer:      reviewer,
		ReviewTime:    time.Now(),
		Reason:        reason,
	}
	if err := db.Create(&reviewRecord).Error; err != nil {
		return err
	}

	now := time.Now()
	updates := map[string]interface{}{
		"status":        newStatus,
		"reviewed_by":   reviewer,
		"reviewed_at":   &now,
		"review_remark": reason,
	}
	if err := db.Model(&traceResult).Updates(updates).Error; err != nil {
		return err
	}

	if newStatus == models.StatusConfirmed {
		var notice models.RecallNotice
		if err := db.First(&notice, traceResult.RecallNoticeID).Error; err == nil {
			db.Model(&notice).UpdateColumn("confirmed_count", db.Model(&models.TraceResult{}).
				Where("recall_notice_id = ? AND status = ?", traceResult.RecallNoticeID, models.StatusConfirmed).
				Select("COUNT(*)"))
		}
	}

	return nil
}

func GetTraceResultsByNotice(noticeID uint, status *string) ([]models.TraceResult, error) {
	db := database.GetDB()

	var results []models.TraceResult
	query := db.Where("recall_notice_id = ?", noticeID).
		Preload("Patient").
		Preload("ConsumptionRecord.Material").
		Preload("ConsumptionRecord.DialysisShift")

	if status != nil && *status != "" {
		query = query.Where("status = ?", *status)
	}

	if err := query.Find(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}

func UpdateNoticeStatus(noticeID uint, newStatus models.RecallStatus) error {
	db := database.GetDB()
	return db.Model(&models.RecallNotice{}).
		Where("id = ?", noticeID).
		Update("status", newStatus).Error
}

func GetTraceHistory(noticeID uint) ([]models.TraceHistory, error) {
	db := database.GetDB()
	var history []models.TraceHistory
	err := db.Where("recall_notice_id = ?", noticeID).
		Order("trace_time DESC").
		Find(&history).Error
	return history, err
}

func GetReviewRecords(traceResultID uint) ([]models.ReviewRecord, error) {
	db := database.GetDB()
	var records []models.ReviewRecord
	err := db.Where("trace_result_id = ?", traceResultID).
		Order("review_time DESC").
		Find(&records).Error
	return records, err
}

	var existingResults []models.TraceResult
	database.DB.Where("recall_id = ? AND manual_override = ?", recallID, false).Find(&existingResults)
	if len(existingResults) > 0 {
		return existingResults, nil
	}

	affectedBatches := s.parseAffectedBatches(notice.AffectedBatchs)
	if len(affectedBatches) == 0 {
		return nil, errors.New("no affected batches specified")
	}

	var consumptionRecords []models.ConsumptionRecord
	query := database.DB.Where("batch_number IN ?", affectedBatches).
		Preload("Patient").
		Preload("Shift").
		Preload("Material")

	if err := query.Find(&consumptionRecords).Error; err != nil {
		return nil, err
	}

	var results []models.TraceResult
	for _, cr := range consumptionRecords {
		result := models.TraceResult{
			RecallID:      recallID,
			ConsumptionID: cr.ID,
			PatientID:     cr.PatientID,
			BatchNumber:   cr.BatchNumber,
			ShiftID:       cr.ShiftID,
			Status:        models.RecallStatusPending,
		}

		if cr.IsAlternative {
			result.IsConflict = true
			result.ConflictReason = "该批次为替代耗材，需人工复核"
		}

		if err := database.DB.FirstOrCreate(&result, models.TraceResult{
			RecallID:      recallID,
			ConsumptionID: cr.ID,
		}).Error; err != nil {
			continue
		}

		var loadedResult models.TraceResult
		database.DB.Where("id = ?", result.ID).
			Preload("Patient").
			Preload("Shift").
			Preload("Consumption").
			First(&loadedResult)

		results = append(results, loadedResult)
	}

	history := models.TraceHistory{
		RecallID:      recallID,
		ActionType:    "trace_execution",
		Operator:      operator,
		ActionTime:    time.Now(),
		Description:   "执行召回追溯",
		AffectedCount: len(results),
	}
	database.DB.Create(&history)

	return results, nil
}

func (s *RecallService) parseAffectedBatches(batchStr string) []string {
	var batches []string
	if strings.HasPrefix(batchStr, "[") {
		json.Unmarshal([]byte(batchStr), &batches)
	} else {
		parts := strings.Split(batchStr, ",")
		for _, p := range parts {
			if trimmed := strings.TrimSpace(p); trimmed != "" {
				batches = append(batches, trimmed)
			}
		}
	}
	return batches
}

func (s *RecallService) ManualOverride(traceResultID string, newStatus models.RecallStatus, overrideBy string, reason string) (*models.TraceResult, error) {
	var result models.TraceResult
	if err := database.DB.Where("id = ?", traceResultID).First(&result).Error; err != nil {
		return nil, err
	}

	oldStatus := result.Status

	result.Status = newStatus
	result.ManualOverride = true
	result.OverrideBy = overrideBy
	result.OverrideAt = time.Now()
	result.OverrideReason = reason

	if err := database.DB.Save(&result).Error; err != nil {
		return nil, err
	}

	review := models.ReviewRecord{
		TraceResultID: traceResultID,
		Reviewer:      overrideBy,
		ReviewAction:  "manual_override",
		OldStatus:     string(oldStatus),
		NewStatus:     string(newStatus),
		ReviewTime:    time.Now(),
		Comments:      reason,
	}
	database.DB.Create(&review)

	return &result, nil
}

func (s *RecallService) ConfirmRecallResult(traceResultID string, reviewer string) (*models.TraceResult, error) {
	return s.ManualOverride(traceResultID, models.RecallStatusConfirmed, reviewer, "复核确认")
}

func (s *RecallService) RejectRecallResult(traceResultID string, reviewer string, reason string) (*models.TraceResult, error) {
	return s.ManualOverride(traceResultID, models.RecallStatusRejected, reviewer, reason)
}

func (s *RecallService) ResolveRecallResult(traceResultID string, reviewer string, remarks string) (*models.TraceResult, error) {
	return s.ManualOverride(traceResultID, models.RecallStatusResolved, reviewer, remarks)
}

func (s *RecallService) WithdrawRecall(recallID string, operator string, reason string) error {
	var notice models.RecallNotice
	if err := database.DB.Where("id = ?", recallID).First(&notice).Error; err != nil {
		return err
	}

	notice.Status = models.RecallStatusWithdrawn
	database.DB.Save(&notice)

	database.DB.Model(&models.TraceResult{}).
		Where("recall_id = ?", recallID).
		Update("status", models.RecallStatusWithdrawn)

	history := models.TraceHistory{
		RecallID:    recallID,
		ActionType:  "recall_withdrawn",
		Operator:    operator,
		ActionTime:  time.Now(),
		Description: reason,
	}
	return database.DB.Create(&history).Error
}

func (s *RecallService) GetTraceResults(recallID string) ([]models.TraceResult, error) {
	var results []models.TraceResult
	err := database.DB.Where("recall_id = ?", recallID).
		Preload("Patient").
		Preload("Shift").
		Preload("Consumption").
		Preload("Recall").
		Find(&results).Error
	return results, err
}

func (s *RecallService) GetReviewRecords(traceResultID string) ([]models.ReviewRecord, error) {
	var records []models.ReviewRecord
	err := database.DB.Where("trace_result_id = ?", traceResultID).
		Order("review_time DESC").
		Find(&records).Error
	return records, err
}

func (s *RecallService) GetTraceHistory(recallID string) ([]models.TraceHistory, error) {
	var history []models.TraceHistory
	err := database.DB.Where("recall_id = ?", recallID).
		Order("action_time DESC").
		Find(&history).Error
	return history, err
}

func (s *RecallService) GetAllRecalls() ([]models.RecallNotice, error) {
	var notices []models.RecallNotice
	err := database.DB.Order("issue_date DESC").Find(&notices).Error
	return notices, err
}

func (s *RecallService) GetAllConsumptions() ([]models.ConsumptionRecord, error) {
	var records []models.ConsumptionRecord
	err := database.DB.Preload("Patient").Preload("Shift").Preload("Material").Find(&records).Error
	return records, err
}

func (s *RecallService) GetAllMaterials() ([]models.Material, error) {
	var materials []models.Material
	err := database.DB.Find(&materials).Error
	return materials, err
}

func (s *RecallService) GetAllPatients() ([]models.Patient, error) {
	var patients []models.Patient
	err := database.DB.Find(&patients).Error
	return patients, err
}

func (s *RecallService) GetAllShifts() ([]models.DialysisShift, error) {
	var shifts []models.DialysisShift
	err := database.DB.Find(&shifts).Error
	return shifts, err
}
