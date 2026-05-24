package service

import (
	"errors"
	"fmt"
	"fuel-subsidy-api/internal/dao"
	"fuel-subsidy-api/internal/models"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ApplicationCreateRequest struct {
	ApplicationYear int      `json:"application_year" binding:"required"`
	ApplicantName   string   `json:"applicant_name" binding:"required"`
	ApplicantIDCard string   `json:"applicant_id_card" binding:"required"`
	VesselNumber    string   `json:"vessel_number" binding:"required"`
	ReceiptNumbers  []string `json:"receipt_numbers"`
	Voyages         []VoyageRequest `json:"voyages"`
}

type VoyageRequest struct {
	VoyageNumber  string    `json:"voyage_number" binding:"required"`
	DepartureDate time.Time `json:"departure_date" binding:"required"`
	ReturnDate    time.Time `json:"return_date" binding:"required"`
	FishingArea   string    `json:"fishing_area" binding:"required"`
	FuelConsumed  float64   `json:"fuel_consumed"`
	CatchWeight   float64   `json:"catch_weight"`
}

type StageTransitionRequest struct {
	ApplicationID string `json:"application_id" binding:"required"`
	Operator      string `json:"operator" binding:"required"`
	Reason        string `json:"reason"`
	Passed        bool   `json:"passed"`
}

type DuplicateCheckResult struct {
	IsDuplicate    bool                         `json:"is_duplicate"`
	OriginalApp    *models.SubsidyApplication   `json:"original_app,omitempty"`
	ProcessedBy    string                       `json:"processed_by,omitempty"`
	ProcessedAt    *time.Time                   `json:"processed_at,omitempty"`
	Logs           []models.AuditLog            `json:"logs,omitempty"`
}

func CheckDuplicateApplication(vesselNumber string, year int, receiptNumbers []string) (*DuplicateCheckResult, error) {
	var result DuplicateCheckResult

	var existingApps []models.SubsidyApplication
	err := dao.DB.Where("vessel_number = ? AND application_year = ? AND status != ?", 
		vesselNumber, year, models.StatusRejected).Find(&existingApps).Error
	if err != nil {
		return nil, err
	}

	for _, app := range existingApps {
		var appReceipts []models.ApplicationReceipt
		dao.DB.Where("application_id = ?", app.ID).Find(&appReceipts)
		
		for _, ar := range appReceipts {
			for _, rn := range receiptNumbers {
				if ar.ReceiptNumber == rn {
					result.IsDuplicate = true
					result.OriginalApp = &app
					
					var auditor models.Auditor
					if app.ProcessedBy != "" {
						dao.DB.Where("username = ?", app.ProcessedBy).First(&auditor)
						result.ProcessedBy = auditor.Name
					} else if app.VerifiedBy != "" {
						dao.DB.Where("username = ?", app.VerifiedBy).First(&auditor)
						result.ProcessedBy = auditor.Name
					}
					
					result.ProcessedAt = app.ProcessedAt
					if result.ProcessedAt == nil {
						result.ProcessedAt = app.VerifiedAt
					}
					
					var logs []models.AuditLog
					dao.DB.Where("application_id = ?", app.ID).Order("created_at desc").Find(&logs)
					result.Logs = logs
					
					return &result, nil
				}
			}
		}
	}

	return &result, nil
}

func CreateApplication(req *ApplicationCreateRequest, operator string) (*models.SubsidyApplication, *DuplicateCheckResult, *FullValidationResult, error) {
	dupCheck, err := CheckDuplicateApplication(req.VesselNumber, req.ApplicationYear, req.ReceiptNumbers)
	if err != nil {
		return nil, nil, nil, err
	}

	var vessel models.FishingVessel
	err = dao.DB.Where("vessel_number = ?", req.VesselNumber).First(&vessel).Error
	if err != nil {
		return nil, nil, nil, errors.New("渔船不存在")
	}

	appNo := generateApplicationNo(req.ApplicationYear)

	app := &models.SubsidyApplication{
		ApplicationNo:   appNo,
		ApplicationYear: req.ApplicationYear,
		ApplicantName:   req.ApplicantName,
		ApplicantIDCard: req.ApplicantIDCard,
		VesselID:        vessel.ID,
		VesselNumber:    req.VesselNumber,
		Status:          models.StatusReceived,
		CurrentStage:    "receive",
	}

	var voyages []models.Voyage
	for _, v := range req.Voyages {
		voyages = append(voyages, models.Voyage{
			VoyageNumber:  v.VoyageNumber,
			DepartureDate: v.DepartureDate,
			ReturnDate:    v.ReturnDate,
			FishingArea:   v.FishingArea,
			FuelConsumed:  v.FuelConsumed,
			CatchWeight:   v.CatchWeight,
		})
	}

	valResult := PerformFullValidation(app, voyages, req.ReceiptNumbers)
	if dupCheck.IsDuplicate {
		return dupCheck.OriginalApp, dupCheck, &valResult, nil
	}

	tx := dao.DB.Begin()

	if err := tx.Create(app).Error; err != nil {
		tx.Rollback()
		return nil, nil, nil, err
	}

	for i := range voyages {
		voyages[i].ApplicationID = app.ID
		if err := tx.Create(&voyages[i]).Error; err != nil {
			tx.Rollback()
			return nil, nil, nil, err
		}
	}

	_, validReceipts := ValidateAllReceipts(req.ReceiptNumbers, req.VesselNumber, nil)
	totalFuel := 0.0
	for _, r := range validReceipts {
		ar := &models.ApplicationReceipt{
			ApplicationID: app.ID,
			ReceiptID:     r.ID,
			ReceiptNumber: r.ReceiptNumber,
			FuelAmount:    r.FuelAmount,
		}
		if err := tx.Create(ar).Error; err != nil {
			tx.Rollback()
			return nil, nil, nil, err
		}
		totalFuel += r.FuelAmount
	}

	app.TotalFuelAmount = totalFuel

	now := time.Now()
	app.ReceivedBy = operator
	app.ReceivedAt = &now

	var auditor models.Auditor
	dao.DB.Where("username = ?", operator).First(&auditor)
	operatorName := auditor.Name
	if operatorName == "" {
		operatorName = operator
	}

	log := &models.AuditLog{
		ApplicationID: app.ID,
		ToStatus:      models.StatusReceived,
		Stage:         "receive",
		Operator:      operator,
		OperatorName:  operatorName,
		Reason:        "申请收件完成",
		Passed:        true,
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, nil, nil, err
	}

	if err := tx.Save(app).Error; err != nil {
		tx.Rollback()
		return nil, nil, nil, err
	}

	tx.Commit()

	return app, nil, &valResult, nil
}

func VerifyApplication(req *StageTransitionRequest) (*models.SubsidyApplication, *FullValidationResult, error) {
	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		return nil, nil, errors.New("无效的申请ID")
	}

	var app models.SubsidyApplication
	err = dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, nil, errors.New("申请不存在")
	}

	if app.Status != models.StatusReceived {
		return nil, nil, fmt.Errorf("当前状态[%s]不允许进行核验操作", app.Status)
	}

	var voyages []models.Voyage
	dao.DB.Where("application_id = ?", appID).Find(&voyages)

	var appReceipts []models.ApplicationReceipt
	dao.DB.Where("application_id = ?", appID).Find(&appReceipts)
	receiptNumbers := make([]string, len(appReceipts))
	for i, ar := range appReceipts {
		receiptNumbers[i] = ar.ReceiptNumber
	}

	valResult := PerformFullValidation(&app, voyages, receiptNumbers)

	tx := dao.DB.Begin()

	var auditor models.Auditor
	tx.Where("username = ?", req.Operator).First(&auditor)
	operatorName := auditor.Name
	if operatorName == "" {
		operatorName = req.Operator
	}

	now := time.Now()

	if valResult.TotalPassed && req.Passed {
		app.Status = models.StatusVerified
		app.CurrentStage = "verify"
		app.VerifiedBy = req.Operator
		app.VerifiedAt = &now
	} else {
		app.Status = models.StatusRejected
		app.CurrentStage = "verify"
		app.VerifiedBy = req.Operator
		app.VerifiedAt = &now
		if req.Reason == "" {
			req.Reason = strings.Join(valResult.AllReasons, "; ")
		}
	}

	log := &models.AuditLog{
		ApplicationID: app.ID,
		FromStatus:    models.StatusReceived,
		ToStatus:      app.Status,
		Stage:         "verify",
		Operator:      req.Operator,
		OperatorName:  operatorName,
		Reason:        req.Reason,
		Passed:        valResult.TotalPassed && req.Passed,
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, nil, err
	}

	for _, v := range voyages {
		tx.Save(&v)
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		return nil, nil, err
	}

	tx.Commit()

	return &app, &valResult, nil
}

func ProcessApplication(req *StageTransitionRequest, subsidyRate float64) (*models.SubsidyApplication, error) {
	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		return nil, errors.New("无效的申请ID")
	}

	var app models.SubsidyApplication
	err = dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, errors.New("申请不存在")
	}

	if app.Status != models.StatusVerified {
		return nil, fmt.Errorf("当前状态[%s]不允许进行处理操作", app.Status)
	}

	tx := dao.DB.Begin()

	var auditor models.Auditor
	tx.Where("username = ?", req.Operator).First(&auditor)
	operatorName := auditor.Name
	if operatorName == "" {
		operatorName = req.Operator
	}

	now := time.Now()

	app.SubsidyRate = subsidyRate
	app.SubsidyAmount = app.TotalFuelAmount * subsidyRate
	app.Status = models.StatusProcessed
	app.CurrentStage = "process"
	app.ProcessedBy = req.Operator
	app.ProcessedAt = &now

	var appReceipts []models.ApplicationReceipt
	tx.Where("application_id = ?", appID).Find(&appReceipts)
	for _, ar := range appReceipts {
		tx.Model(&models.FuelReceipt{}).Where("id = ?", ar.ReceiptID).
			Updates(map[string]interface{}{
				"is_used":       true,
				"used_by_app_id": app.ID,
				"used_at":        &now,
			})
	}

	log := &models.AuditLog{
		ApplicationID: app.ID,
		FromStatus:    models.StatusVerified,
		ToStatus:      app.Status,
		Stage:         "process",
		Operator:      req.Operator,
		OperatorName:  operatorName,
		Reason:        req.Reason,
		Passed:        true,
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return &app, nil
}

func ReviewApplication(req *StageTransitionRequest) (*models.SubsidyApplication, error) {
	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		return nil, errors.New("无效的申请ID")
	}

	var app models.SubsidyApplication
	err = dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, errors.New("申请不存在")
	}

	if app.Status != models.StatusProcessed {
		return nil, fmt.Errorf("当前状态[%s]不允许进行复查操作", app.Status)
	}

	tx := dao.DB.Begin()

	var auditor models.Auditor
	tx.Where("username = ?", req.Operator).First(&auditor)
	operatorName := auditor.Name
	if operatorName == "" {
		operatorName = req.Operator
	}

	now := time.Now()

	if req.Passed {
		app.Status = models.StatusReviewPassed
		app.ReviewedBy = req.Operator
		app.ReviewedAt = &now
	} else {
		app.Status = models.StatusRejected
		app.ReviewedBy = req.Operator
		app.ReviewedAt = &now
	}
	app.CurrentStage = "review"

	log := &models.AuditLog{
		ApplicationID: app.ID,
		FromStatus:    models.StatusProcessed,
		ToStatus:      app.Status,
		Stage:         "review",
		Operator:      req.Operator,
		OperatorName:  operatorName,
		Reason:        req.Reason,
		Passed:        req.Passed,
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return &app, nil
}

func CloseApplication(req *StageTransitionRequest) (*models.SubsidyApplication, error) {
	appID, err := uuid.Parse(req.ApplicationID)
	if err != nil {
		return nil, errors.New("无效的申请ID")
	}

	var app models.SubsidyApplication
	err = dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, errors.New("申请不存在")
	}

	if app.Status != models.StatusReviewPassed {
		return nil, fmt.Errorf("当前状态[%s]不允许进行结案操作", app.Status)
	}

	tx := dao.DB.Begin()

	var auditor models.Auditor
	tx.Where("username = ?", req.Operator).First(&auditor)
	operatorName := auditor.Name
	if operatorName == "" {
		operatorName = req.Operator
	}

	now := time.Now()

	app.Status = models.StatusClosed
	app.CurrentStage = "close"
	app.ClosedBy = req.Operator
	app.ClosedAt = &now

	log := &models.AuditLog{
		ApplicationID: app.ID,
		FromStatus:    models.StatusReviewPassed,
		ToStatus:      app.Status,
		Stage:         "close",
		Operator:      req.Operator,
		OperatorName:  operatorName,
		Reason:        req.Reason,
		Passed:        true,
	}
	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Save(&app).Error; err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()

	return &app, nil
}

func RecalculateSubsidy(appID uuid.UUID, newRate float64) (*models.SubsidyApplication, error) {
	var app models.SubsidyApplication
	err := dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, errors.New("申请不存在")
	}

	app.SubsidyRate = newRate
	app.SubsidyAmount = app.TotalFuelAmount * newRate

	if err := dao.DB.Save(&app).Error; err != nil {
		return nil, err
	}

	return &app, nil
}

func generateApplicationNo(year int) string {
	var count int64
	dao.DB.Model(&models.SubsidyApplication{}).Where("application_year = ?", year).Count(&count)
	return fmt.Sprintf("YZ%04d%06d", year, count+1)
}

func GetApplicationDetail(appID uuid.UUID) (map[string]interface{}, error) {
	var app models.SubsidyApplication
	err := dao.DB.Where("id = ?", appID).First(&app).Error
	if err != nil {
		return nil, err
	}

	var voyages []models.Voyage
	dao.DB.Where("application_id = ?", appID).Find(&voyages)

	var receipts []models.ApplicationReceipt
	dao.DB.Where("application_id = ?", appID).Find(&receipts)

	var logs []models.AuditLog
	dao.DB.Where("application_id = ?", appID).Order("created_at asc").Find(&logs)

	result := map[string]interface{}{
		"application": app,
		"voyages":     voyages,
		"receipts":    receipts,
		"audit_logs":  logs,
	}

	return result, nil
}
