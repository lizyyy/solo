package service

import (
	"errors"
	"fmt"
	"time"
	"watermeter-api/models"
	"watermeter-api/utils"

	"gorm.io/gorm"
)

type AppealService struct {
	db *gorm.DB
}

func NewAppealService(db *gorm.DB) *AppealService {
	return &AppealService{db: db}
}

var validTransitions = map[string][]string{
	models.AppealStatusPending:    {models.AppealStatusProcessing, models.AppealStatusWithdrawn, models.AppealStatusRejected},
	models.AppealStatusProcessing: {models.AppealStatusReviewing, models.AppealStatusWithdrawn, models.AppealStatusRejected},
	models.AppealStatusReviewing:  {models.AppealStatusApproved, models.AppealStatusRejected, models.AppealStatusWithdrawn},
	models.AppealStatusApproved:   {models.AppealStatusClosed, models.AppealStatusWithdrawn},
	models.AppealStatusRejected:   {models.AppealStatusClosed},
	models.AppealStatusWithdrawn:  {models.AppealStatusClosed},
	models.AppealStatusClosed:     {models.AppealStatusArchived},
	models.AppealStatusArchived:   {},
}

func (s *AppealService) CanTransition(currentStatus, newStatus string) bool {
	validNext, exists := validTransitions[currentStatus]
	if !exists {
		return false
	}
	for _, s := range validNext {
		if s == newStatus {
			return true
		}
	}
	return false
}

func (s *AppealService) TransitionStatus(appealNo, newStatus, handlerID, handlerName, comment string) error {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", appealNo).First(&appeal).Error
	if err != nil {
		return err
	}

	if !s.CanTransition(appeal.Status, newStatus) {
		return errors.New("invalid status transition from " + appeal.Status + " to " + newStatus)
	}

	updates := map[string]interface{}{
		"status":        newStatus,
		"handler_id":    handlerID,
		"handler_name":  handlerName,
		"handle_time":   time.Now(),
	}

	if comment != "" {
		updates["handle_comment"] = comment
	}

	if newStatus == models.AppealStatusClosed {
		updates["close_time"] = time.Now()
	}

	return s.db.Model(&appeal).Updates(updates).Error
}

func (s *AppealService) CheckDuplicateAppeal(meterNo, startCycle, endCycle string, excludeAppealNo string) (bool, *models.Appeal) {
	var existing models.Appeal
	query := s.db.Where("meter_no = ? AND status NOT IN (?, ?, ?) AND is_duplicate = ?",
		meterNo,
		models.AppealStatusClosed,
		models.AppealStatusWithdrawn,
		models.AppealStatusRejected,
		false)

	if excludeAppealNo != "" {
		query = query.Where("appeal_no != ?", excludeAppealNo)
	}

	cycleOverlap := "(start_bill_cycle <= ? AND end_bill_cycle >= ?) OR " +
		"(start_bill_cycle <= ? AND end_bill_cycle >= ?) OR " +
		"(start_bill_cycle >= ? AND end_bill_cycle <= ?)"

	query = query.Where(cycleOverlap, startCycle, startCycle, endCycle, endCycle, startCycle, endCycle)

	err := query.First(&existing).Error
	if err != nil {
		return false, nil
	}
	return true, &existing
}

func (s *AppealService) SubmitAppeal(appeal *models.Appeal) (*models.SubmitResult, error) {
	if appeal.AppealNo == "" {
		appeal.AppealNo = utils.GenerateAppealNo()
	}
	appeal.Status = models.AppealStatusPending
	appeal.CreatedAt = time.Now()
	appeal.UpdatedAt = time.Now()

	isDuplicate, existing := s.CheckDuplicateAppeal(appeal.MeterNo, appeal.StartBillCycle, appeal.EndBillCycle, "")
	if isDuplicate {
		appeal.IsDuplicate = true
		appeal.ParentAppealNo = existing.AppealNo
		appeal.Status = models.AppealStatusRejected

		err := s.db.Create(appeal).Error
		if err != nil {
			return nil, err
		}

		return &models.SubmitResult{
			AppealNo: appeal.AppealNo,
			Success:  false,
			Message:  "重复申诉: 已存在同周期未结案申诉 " + existing.AppealNo,
			Status:   appeal.Status,
		}, nil
	}

	err := s.db.Create(appeal).Error
	if err != nil {
		return nil, err
	}

	return &models.SubmitResult{
		AppealNo: appeal.AppealNo,
		Success:  true,
		Message:  "申诉提交成功",
		Status:   appeal.Status,
	}, nil
}

func (s *AppealService) BatchSubmit(request models.BatchSubmitRequest) (*models.BatchSubmitResponse, error) {
	response := &models.BatchSubmitResponse{
		Results: make([]models.SubmitResult, 0),
	}

	for i := range request.Appeals {
		appeal := &request.Appeals[i]
		result, err := s.SubmitAppeal(appeal)
		if err != nil {
			response.FailCount++
			response.Results = append(response.Results, models.SubmitResult{
				AppealNo: appeal.AppealNo,
				Success:  false,
				Message:  err.Error(),
				Status:   "failed",
			})
		} else {
			if result.Success {
				response.SuccessCount++
			} else {
				response.FailCount++
			}
			response.Results = append(response.Results, *result)
		}
	}

	return response, nil
}

func (s *AppealService) SplitAnomalies(appealNo string) ([]models.AppealAnomaly, error) {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", appealNo).First(&appeal).Error
	if err != nil {
		return nil, err
	}

	readings := make([]models.MeterReading, 0)
	s.db.Where("meter_no = ? AND bill_cycle >= ? AND bill_cycle <= ?",
		appeal.MeterNo, appeal.StartBillCycle, appeal.EndBillCycle).
		Order("reading_date ASC").
		Find(&readings)

	anomalies := make([]models.AppealAnomaly, 0)

	validationResult := ValidateReadings(readings)
	for idx, reverse := range validationResult.ReverseInfo {
		anomaly := models.AppealAnomaly{
			AppealNo:    appealNo,
			AnomalyType: "reading_reverse",
			BillCycle:   utils.GetBillCycle(reverse.Date),
			Description: fmt.Sprintf("读数倒挂: 前次%.2f, 当前%.2f, 差额%.2f", reverse.PrevReading, reverse.CurrReading, reverse.Difference),
			IsResolved:  false,
		}
		s.db.Create(&anomaly)
		anomalies = append(anomalies, anomaly)
		_ = idx
	}

	var leakRecords []models.LeakRecord
	s.db.Where("meter_no = ? AND is_confirmed = ?", appeal.MeterNo, true).Find(&leakRecords)
	for _, leak := range leakRecords {
		startCycle := utils.GetBillCycle(leak.LeakStartDate)
		endCycle := utils.GetBillCycle(leak.LeakEndDate)
		if startCycle >= appeal.StartBillCycle && startCycle <= appeal.EndBillCycle {
			anomaly := models.AppealAnomaly{
				AppealNo:    appealNo,
				AnomalyType: "leak_record",
				BillCycle:   startCycle,
				Description: fmt.Sprintf("漏水记录: %s 至 %s, 日漏量%.2f吨", 
					leak.LeakStartDate.Format("2006-01-02"), 
					leak.LeakEndDate.Format("2006-01-02"), 
					leak.DailyLeakAmount),
				IsResolved:  false,
			}
			s.db.Create(&anomaly)
			anomalies = append(anomalies, anomaly)
		}
		if endCycle > startCycle && endCycle >= appeal.StartBillCycle && endCycle <= appeal.EndBillCycle {
			anomaly := models.AppealAnomaly{
				AppealNo:    appealNo,
				AnomalyType: "leak_cross_cycle",
				BillCycle:   endCycle,
				Description: fmt.Sprintf("跨周期漏水: %s 至 %s, 涉及账单周期 %s-%s",
					leak.LeakStartDate.Format("2006-01-02"),
					leak.LeakEndDate.Format("2006-01-02"),
					startCycle, endCycle),
				IsResolved:  false,
			}
			s.db.Create(&anomaly)
			anomalies = append(anomalies, anomaly)
		}
	}

	if len(anomalies) > 0 {
		s.TransitionStatus(appealNo, models.AppealStatusProcessing, "system", "系统", "异常拆分完成")
	}

	return anomalies, nil
}

func (s *AppealService) GetAppealDetail(appealNo string) (*models.AppealDetail, error) {
	var detail models.AppealDetail

	err := s.db.Where("appeal_no = ?", appealNo).First(&detail.Appeal).Error
	if err != nil {
		return nil, err
	}

	s.db.Where("meter_no = ?", detail.Appeal.MeterNo).First(&detail.Meter)
	s.db.Where("meter_no = ?", detail.Appeal.MeterNo).Order("reading_date ASC").Find(&detail.Readings)
	s.db.Where("meter_no = ?", detail.Appeal.MeterNo).Find(&detail.Leaks)
	s.db.Where("appeal_no = ?", appealNo).Order("created_at DESC").First(&detail.Report)
	s.db.Where("meter_no = ? AND bill_cycle >= ? AND bill_cycle <= ?",
		detail.Appeal.MeterNo, detail.Appeal.StartBillCycle, detail.Appeal.EndBillCycle).
		Order("bill_cycle ASC").Find(&detail.Bills)
	s.db.Where("appeal_no = ?", appealNo).Find(&detail.Anomalies)

	return &detail, nil
}
