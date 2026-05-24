package service

import (
	"encoding/json"
	"time"
	"watermeter-api/models"
	"watermeter-api/utils"

	"gorm.io/gorm"
)

type ReviewService struct {
	db *gorm.DB
}

func NewReviewService(db *gorm.DB) *ReviewService {
	return &ReviewService{db: db}
}

type ReviewRequest struct {
	AppealNo        string `json:"appeal_no"`
	ReviewerID      string `json:"reviewer_id"`
	ReviewerName    string `json:"reviewer_name"`
	IsReadingValid  bool   `json:"is_reading_valid"`
	ReadingAnomaly  string `json:"reading_anomaly"`
	LeakConfirmed   bool   `json:"leak_confirmed"`
	LeakDays        int    `json:"leak_days"`
	LeakAmount      float64 `json:"leak_amount"`
	ReviewConclusion string `json:"review_conclusion"`
	ReviewSuggestion string `json:"review_suggestion"`
	IsManualCorrected bool `json:"is_manual_corrected"`
	CorrectionReason string `json:"correction_reason"`
}

func (s *ReviewService) CreateReviewReport(req ReviewRequest) (*models.ReviewReport, error) {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", req.AppealNo).First(&appeal).Error
	if err != nil {
		return nil, err
	}

	billingService := NewBillingService(s.db)
	readings := billingService.GetReadingsByBillCycle(appeal.MeterNo, appeal.StartBillCycle, appeal.EndBillCycle)
	
	originalUsage := 0.0
	if len(readings) >= 2 {
		originalUsage = readings[len(readings)-1].Reading - readings[0].Reading
	}

	adjustedUsage := originalUsage
	if req.LeakConfirmed {
		adjustedUsage = originalUsage - req.LeakAmount
		if adjustedUsage < 0 {
			adjustedUsage = 0
		}
	}

	billStart, _ := utils.ParseBillCycle(appeal.StartBillCycle)
	_, originalAmount := billingService.CalculateTieredUsage(originalUsage, billStart)
	_, adjustedAmount := billingService.CalculateTieredUsage(adjustedUsage, billStart)

	tierAdjustments := s.calculateTierAdjustments(originalUsage, adjustedUsage, billStart)
	tierAdjustmentsJSON, _ := json.Marshal(tierAdjustments)

	report := &models.ReviewReport{
		ReportNo:        utils.GenerateReportNo(),
		AppealNo:        req.AppealNo,
		MeterNo:         appeal.MeterNo,
		ReviewerID:      req.ReviewerID,
		ReviewerName:    req.ReviewerName,
		ReviewDate:      time.Now(),
		IsReadingValid:  req.IsReadingValid,
		ReadingAnomaly:  req.ReadingAnomaly,
		LeakConfirmed:   req.LeakConfirmed,
		LeakDays:        req.LeakDays,
		LeakAmount:      req.LeakAmount,
		OriginalUsage:   originalUsage,
		AdjustedUsage:   adjustedUsage,
		OriginalAmount:  originalAmount,
		AdjustedAmount:  adjustedAmount,
		TierAdjustments: string(tierAdjustmentsJSON),
		ReviewConclusion: req.ReviewConclusion,
		ReviewSuggestion: req.ReviewSuggestion,
		IsManualCorrected: req.IsManualCorrected,
		CorrectionReason: req.CorrectionReason,
		IsFinal:         false,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	err = s.db.Create(report).Error
	if err != nil {
		return nil, err
	}

	appealService := NewAppealService(s.db)
	appealService.TransitionStatus(req.AppealNo, models.AppealStatusReviewing, req.ReviewerID, req.ReviewerName, "复核报告已生成")

	return report, nil
}

func (s *ReviewService) calculateTierAdjustments(originalUsage, adjustedUsage float64, billDate time.Time) []map[string]interface{} {
	billingService := NewBillingService(s.db)
	originalTiers, _ := billingService.CalculateTieredUsage(originalUsage, billDate)
	adjustedTiers, _ := billingService.CalculateTieredUsage(adjustedUsage, billDate)

	adjustments := make([]map[string]interface{}, 0)
	for i := range originalTiers {
		if i >= len(adjustedTiers) {
			break
		}
		adjustments = append(adjustments, map[string]interface{}{
			"tier_level":      originalTiers[i].TierLevel,
			"tier_name":       originalTiers[i].TierName,
			"original_usage":  originalTiers[i].Usage,
			"adjusted_usage":  adjustedTiers[i].Usage,
			"original_amount": originalTiers[i].Amount,
			"adjusted_amount": adjustedTiers[i].Amount,
			"difference":      originalTiers[i].Amount - adjustedTiers[i].Amount,
		})
	}
	return adjustments
}

func (s *ReviewService) FinalizeReview(reportNo string, isApproved bool) error {
	var report models.ReviewReport
	err := s.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return err
	}

	report.IsFinal = true
	report.UpdatedAt = time.Now()
	s.db.Save(&report)

	appealService := NewAppealService(s.db)
	if isApproved {
		var appeal models.Appeal
		s.db.Where("appeal_no = ?", report.AppealNo).First(&appeal)
		
		refundAmount := report.OriginalAmount - report.AdjustedAmount
		if refundAmount < 0 {
			refundAmount = 0
		}

		s.db.Model(&appeal).Updates(map[string]interface{}{
			"adjusted_balance": appeal.OriginalBalance + refundAmount,
			"refund_amount":    refundAmount,
		})

		appealService.TransitionStatus(report.AppealNo, models.AppealStatusApproved, report.ReviewerID, report.ReviewerName, "复核通过")
	} else {
		appealService.TransitionStatus(report.AppealNo, models.AppealStatusRejected, report.ReviewerID, report.ReviewerName, "复核驳回")
	}

	return nil
}

func (s *ReviewService) ManualCorrect(reportNo string, adjustedAmount float64, reason string) error {
	var report models.ReviewReport
	err := s.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return err
	}

	report.AdjustedAmount = adjustedAmount
	report.IsManualCorrected = true
	report.CorrectionReason = reason
	report.UpdatedAt = time.Now()

	return s.db.Save(&report).Error
}

func (s *ReviewService) CloseAppeal(appealNo, handlerID, handlerName string) error {
	appealService := NewAppealService(s.db)
	return appealService.TransitionStatus(appealNo, models.AppealStatusClosed, handlerID, handlerName, "申诉已结案")
}

func (s *ReviewService) ArchiveAppeal(appealNo string) error {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", appealNo).First(&appeal).Error
	if err != nil {
		return err
	}

	if appeal.Status != models.AppealStatusClosed {
		return nil
	}

	appeal.IsArchived = true
	appeal.Status = models.AppealStatusArchived
	appeal.UpdatedAt = time.Now()

	return s.db.Save(&appeal).Error
}

func (s *ReviewService) WithdrawAppeal(appealNo, handlerID, handlerName, reason string) error {
	appealService := NewAppealService(s.db)
	return appealService.TransitionStatus(appealNo, models.AppealStatusWithdrawn, handlerID, handlerName, reason)
}

func (s *ReviewService) ExportAppeals(req models.ExportRequest) ([]models.ExportRecord, error) {
	query := s.db.Model(&models.Appeal{}).
		Select("appeals.appeal_no, appeals.meter_no, water_meters.user_name, water_meters.address, " +
			"appeals.appeal_type, appeals.appeal_date, appeals.status, appeals.disputed_amount, " +
			"appeals.refund_amount, review_reports.review_conclusion, appeals.close_time").
		Joins("LEFT JOIN water_meters ON water_meters.meter_no = appeals.meter_no").
		Joins("LEFT JOIN review_reports ON review_reports.appeal_no = appeals.appeal_no AND review_reports.is_final = 1")

	if len(req.AppealNos) > 0 {
		query = query.Where("appeals.appeal_no IN ?", req.AppealNos)
	}
	if req.StartDate != "" {
		query = query.Where("appeals.appeal_date >= ?", req.StartDate)
	}
	if req.EndDate != "" {
		query = query.Where("appeals.appeal_date <= ?", req.EndDate)
	}
	if req.Status != "" {
		query = query.Where("appeals.status = ?", req.Status)
	}

	var results []struct {
		AppealNo       string
		MeterNo        string
		UserName       string
		Address        string
		AppealType     string
		AppealDate     time.Time
		Status         string
		DisputedAmount float64
		RefundAmount   float64
		ReviewConclusion string
		CloseTime      *time.Time
	}

	query.Scan(&results)

	exportRecords := make([]models.ExportRecord, 0)
	for _, r := range results {
		closeDate := ""
		if r.CloseTime != nil {
			closeDate = r.CloseTime.Format("2006-01-02")
		}
		exportRecords = append(exportRecords, models.ExportRecord{
			AppealNo:       r.AppealNo,
			MeterNo:        r.MeterNo,
			UserName:       r.UserName,
			Address:        r.Address,
			AppealType:     r.AppealType,
			AppealDate:     r.AppealDate.Format("2006-01-02"),
			Status:         r.Status,
			DisputedAmount: r.DisputedAmount,
			RefundAmount:   r.RefundAmount,
			ReviewResult:   r.ReviewConclusion,
			CloseDate:      closeDate,
		})
	}

	return exportRecords, nil
}
