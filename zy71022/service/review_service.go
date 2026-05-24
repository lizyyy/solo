package service

import (
	"encoding/json"
	"errors"
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
	AppealNo          string  `json:"appeal_no"`
	ReviewerID        string  `json:"reviewer_id"`
	ReviewerName      string  `json:"reviewer_name"`
	IsReadingValid    bool    `json:"is_reading_valid"`
	ReadingAnomaly    string  `json:"reading_anomaly"`
	LeakConfirmed     bool    `json:"leak_confirmed"`
	LeakDays          int     `json:"leak_days"`
	LeakAmount        float64 `json:"leak_amount"`
	ReviewConclusion  string  `json:"review_conclusion"`
	ReviewSuggestion  string  `json:"review_suggestion"`
	IsManualCorrected bool    `json:"is_manual_corrected"`
	CorrectionReason  string  `json:"correction_reason"`
}

func (s *ReviewService) CreateReviewReport(req ReviewRequest) (*models.ReviewReport, error) {
	var appeal models.Appeal
	err := s.db.Where("appeal_no = ?", req.AppealNo).First(&appeal).Error
	if err != nil {
		return nil, err
	}

	var existingReport models.ReviewReport
	err = s.db.Where("appeal_no = ? AND is_final = ?", req.AppealNo, false).Order("created_at DESC").First(&existingReport).Error
	if err == nil {
		return &existingReport, nil
	}

	billingService := NewBillingService(s.db)
	recalcResult, err := billingService.RecalculateAppealBills(req.AppealNo)
	if err != nil {
		return nil, err
	}

	originalAmount := recalcResult.OriginalTotal
	adjustedAmount := recalcResult.AdjustedTotal

	originalUsage := 0.0
	adjustedUsage := 0.0
	totalLeakDeduction := 0.0
	for _, bd := range recalcResult.BillDetails {
		originalUsage += bd.OriginalUsage
		adjustedUsage += bd.AdjustedUsage
		totalLeakDeduction += bd.LeakDeduction
	}

	tierAdjustments := s.calculateTierAdjustmentsFromBills(recalcResult.BillDetails)
	tierAdjustmentsJSON, _ := json.Marshal(tierAdjustments)

	if !req.LeakConfirmed {
		adjustedAmount = originalAmount
		adjustedUsage = originalUsage
		totalLeakDeduction = 0
	}

	if req.LeakAmount == 0 {
		req.LeakAmount = totalLeakDeduction
	}

	report := &models.ReviewReport{
		ReportNo:          utils.GenerateReportNo(),
		AppealNo:          req.AppealNo,
		MeterNo:           appeal.MeterNo,
		ReviewerID:        req.ReviewerID,
		ReviewerName:      req.ReviewerName,
		ReviewDate:        time.Now(),
		IsReadingValid:    req.IsReadingValid,
		ReadingAnomaly:    req.ReadingAnomaly,
		LeakConfirmed:     req.LeakConfirmed,
		LeakDays:          req.LeakDays,
		LeakAmount:        utils.RoundToTwoDecimals(req.LeakAmount),
		OriginalUsage:     utils.RoundToTwoDecimals(originalUsage),
		AdjustedUsage:     utils.RoundToTwoDecimals(adjustedUsage),
		OriginalAmount:    utils.RoundToTwoDecimals(originalAmount),
		AdjustedAmount:    utils.RoundToTwoDecimals(adjustedAmount),
		TierAdjustments:   string(tierAdjustmentsJSON),
		ReviewConclusion:  req.ReviewConclusion,
		ReviewSuggestion:  req.ReviewSuggestion,
		IsManualCorrected: req.IsManualCorrected,
		CorrectionReason:  req.CorrectionReason,
		IsFinal:           false,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	err = s.db.Create(report).Error
	if err != nil {
		return nil, err
	}

	appealService := NewAppealService(s.db)
	if appeal.Status == models.AppealStatusPending || appeal.Status == models.AppealStatusProcessing {
		err = appealService.TransitionStatus(req.AppealNo, models.AppealStatusReviewing, req.ReviewerID, req.ReviewerName, "复核报告已生成")
		if err != nil {
			return nil, err
		}
	}

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

func (s *ReviewService) calculateTierAdjustmentsFromBills(billDetails []models.BillAdjustDetail) []map[string]interface{} {
	tierSummary := map[int]map[string]float64{
		1: {"original_usage": 0, "adjusted_usage": 0, "original_amount": 0, "adjusted_amount": 0},
		2: {"original_usage": 0, "adjusted_usage": 0, "original_amount": 0, "adjusted_amount": 0},
		3: {"original_usage": 0, "adjusted_usage": 0, "original_amount": 0, "adjusted_amount": 0},
	}

	tierNames := map[int]string{
		1: "第一阶梯",
		2: "第二阶梯",
		3: "第三阶梯",
	}

	for _, bd := range billDetails {
		originalRemaining := bd.OriginalUsage
		adjustedRemaining := bd.AdjustedUsage

		tier1Limit := 15.0
		tier2Limit := 15.0

		origTier1 := min(originalRemaining, tier1Limit)
		originalRemaining -= origTier1
		origTier2 := min(originalRemaining, tier2Limit)
		originalRemaining -= origTier2
		origTier3 := originalRemaining

		adjTier1 := min(adjustedRemaining, tier1Limit)
		adjustedRemaining -= adjTier1
		adjTier2 := min(adjustedRemaining, tier2Limit)
		adjustedRemaining -= adjTier2
		adjTier3 := adjustedRemaining

		priceTier1 := 2.80
		priceTier2 := 4.20
		priceTier3 := 8.40

		tierSummary[1]["original_usage"] += origTier1
		tierSummary[1]["adjusted_usage"] += adjTier1
		tierSummary[1]["original_amount"] += origTier1 * priceTier1
		tierSummary[1]["adjusted_amount"] += adjTier1 * priceTier1

		tierSummary[2]["original_usage"] += origTier2
		tierSummary[2]["adjusted_usage"] += adjTier2
		tierSummary[2]["original_amount"] += origTier2 * priceTier2
		tierSummary[2]["adjusted_amount"] += adjTier2 * priceTier2

		tierSummary[3]["original_usage"] += origTier3
		tierSummary[3]["adjusted_usage"] += adjTier3
		tierSummary[3]["original_amount"] += origTier3 * priceTier3
		tierSummary[3]["adjusted_amount"] += adjTier3 * priceTier3
	}

	adjustments := make([]map[string]interface{}, 0)
	for tier := 1; tier <= 3; tier++ {
		summary := tierSummary[tier]
		if summary["original_usage"] > 0 || summary["adjusted_usage"] > 0 {
			adjustments = append(adjustments, map[string]interface{}{
				"tier_level":      tier,
				"tier_name":       tierNames[tier],
				"original_usage":  utils.RoundToTwoDecimals(summary["original_usage"]),
				"adjusted_usage":  utils.RoundToTwoDecimals(summary["adjusted_usage"]),
				"original_amount": utils.RoundToTwoDecimals(summary["original_amount"]),
				"adjusted_amount": utils.RoundToTwoDecimals(summary["adjusted_amount"]),
				"difference":      utils.RoundToTwoDecimals(summary["original_amount"] - summary["adjusted_amount"]),
			})
		}
	}
	return adjustments
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func (s *ReviewService) FinalizeReview(reportNo string, isApproved bool) error {
	var report models.ReviewReport
	err := s.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return err
	}

	if report.IsFinal {
		return nil
	}

	report.IsFinal = true
	report.UpdatedAt = time.Now()
	err = s.db.Save(&report).Error
	if err != nil {
		return err
	}

	appealService := NewAppealService(s.db)
	if isApproved {
		var appeal models.Appeal
		err = s.db.Where("appeal_no = ?", report.AppealNo).First(&appeal).Error
		if err != nil {
			return err
		}

		refundAmount := utils.RoundToTwoDecimals(report.OriginalAmount - report.AdjustedAmount)
		if refundAmount < 0 {
			refundAmount = 0
		}

		adjustedBalance := utils.RoundToTwoDecimals(appeal.OriginalBalance + refundAmount)

		err = s.db.Model(&appeal).Updates(map[string]interface{}{
			"adjusted_balance": adjustedBalance,
			"refund_amount":    refundAmount,
			"updated_at":       time.Now(),
		}).Error
		if err != nil {
			return err
		}

		err = appealService.TransitionStatus(report.AppealNo, models.AppealStatusApproved, report.ReviewerID, report.ReviewerName, "复核通过")
		if err != nil {
			return err
		}
	} else {
		err = appealService.TransitionStatus(report.AppealNo, models.AppealStatusRejected, report.ReviewerID, report.ReviewerName, "复核驳回")
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *ReviewService) ManualCorrect(reportNo string, adjustedAmount float64, reason string) error {
	var report models.ReviewReport
	err := s.db.Where("report_no = ?", reportNo).First(&report).Error
	if err != nil {
		return err
	}

	if report.IsFinal {
		return errors.New("报告已定稿，无法修改")
	}

	report.AdjustedAmount = utils.RoundToTwoDecimals(adjustedAmount)
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
		AppealNo         string
		MeterNo          string
		UserName         string
		Address          string
		AppealType       string
		AppealDate       time.Time
		Status           string
		DisputedAmount   float64
		RefundAmount     float64
		ReviewConclusion string
		CloseTime        *time.Time
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
