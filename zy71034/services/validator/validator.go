package validator

import (
	"fmt"
	"prescription-timeline/config"
	"prescription-timeline/database"
	"prescription-timeline/models"
	"time"
)

type ValidatorService struct {
	cfg *config.Config
}

func New(cfg *config.Config) *ValidatorService {
	return &ValidatorService{cfg: cfg}
}

func (v *ValidatorService) ValidatePrescription(prescriptionID string) (*models.ValidationResult, error) {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return nil, err
	}

	result := &models.ValidationResult{
		PrescriptionID: prescriptionID,
		IsValid:        true,
		Suggestions:    []string{},
	}

	timeoutCheck := v.checkTimeout(prescription)
	result.TimeoutCheck = timeoutCheck
	if !timeoutCheck.Passed {
		result.IsValid = false
		result.TotalIssues++
		result.Suggestions = append(result.Suggestions, timeoutCheck.Message)
	}

	patientConfirmCheck := v.checkPatientConfirmation(prescription)
	result.PatientConfirmCheck = patientConfirmCheck
	if !patientConfirmCheck.Passed {
		result.IsValid = false
		result.TotalIssues++
		result.Suggestions = append(result.Suggestions, patientConfirmCheck.Message)
	}

	duplicateCheck := v.checkDuplicateDispensation(prescriptionID)
	result.DuplicateCheck = duplicateCheck
	if !duplicateCheck.Passed {
		result.IsValid = false
		result.TotalIssues++
		result.Suggestions = append(result.Suggestions, duplicateCheck.Message)
	}

	return result, nil
}

func (v *ValidatorService) CheckReviewStatus(prescriptionID string) models.CheckResult {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return models.CheckResult{
			Passed:  false,
			Message: "无法查询处方信息",
			Level:   "error",
		}
	}

	if prescription.Status == models.PrescriptionStatusReviewed ||
		prescription.Status == models.PrescriptionStatusConfirmed ||
		prescription.Status == models.PrescriptionStatusDispensed ||
		prescription.Status == models.PrescriptionStatusClosed {
		return models.CheckResult{
			Passed:  true,
			Message: "处方已通过药师审核",
			Level:   "info",
		}
	}

	if prescription.Status == models.PrescriptionStatusRejected {
		return models.CheckResult{
			Passed:  false,
			Message: "处方已被药师驳回，无法继续处理",
			Level:   "error",
		}
	}

	return models.CheckResult{
		Passed:  false,
		Message: "处方尚未经过药师审核，请先完成审核流程",
		Level:   "error",
	}
}

func (v *ValidatorService) CanConfirm(prescriptionID string) (bool, string) {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return false, "无法查询处方信息"
	}

	if prescription.Status == models.PrescriptionStatusConfirmed {
		return false, "处方已确认，无需重复确认"
	}

	if prescription.Status == models.PrescriptionStatusDispensed {
		return false, "处方已发药，无法再次确认"
	}

	if prescription.Status == models.PrescriptionStatusClosed {
		return false, "处方已结案，无法进行确认"
	}

	if prescription.Status == models.PrescriptionStatusRejected {
		return false, "处方已被驳回，无法确认"
	}

	if prescription.Status != models.PrescriptionStatusReviewed {
		return false, "处方尚未通过药师审核，无法进行患者确认"
	}

	return true, "可以进行患者确认"
}

func (v *ValidatorService) checkTimeout(prescription *models.Prescription) models.CheckResult {
	validityHours := v.cfg.DefaultValidityHours
	if prescription.ValidityHours > 0 {
		validityHours = prescription.ValidityHours
	}

	deadline := prescription.PrescriptionTime.Add(time.Hour * time.Duration(validityHours))
	now := time.Now()

	if now.After(deadline) {
		hoursOverdue := now.Sub(deadline).Hours()
		return models.CheckResult{
			Passed:  false,
			Message: fmt.Sprintf("处方已超时 %.1f 小时，有效期为开方后 %d 小时（截止时间：%s）", hoursOverdue, validityHours, deadline.Format("2006-01-02 15:04:05")),
			Level:   "error",
		}
	}

	hoursRemaining := deadline.Sub(now).Hours()
	if hoursRemaining < 6 {
		return models.CheckResult{
			Passed:  true,
			Message: fmt.Sprintf("处方即将超时，剩余 %.1f 小时", hoursRemaining),
			Level:   "warning",
		}
	}

	return models.CheckResult{
		Passed:  true,
		Message: fmt.Sprintf("处方有效，剩余 %.1f 小时", hoursRemaining),
		Level:   "info",
	}
}

func (v *ValidatorService) checkPatientConfirmation(prescription *models.Prescription) models.CheckResult {
	if prescription.PatientConfirmTime == nil {
		timeSinceCreation := time.Since(prescription.PrescriptionTime).Hours()
		if timeSinceCreation > 24 {
			return models.CheckResult{
				Passed:  false,
				Message: fmt.Sprintf("患者未确认处方，已等待 %.1f 小时，建议提醒患者或取消处方", timeSinceCreation),
				Level:   "error",
			}
		}
		return models.CheckResult{
			Passed:  true,
			Message: fmt.Sprintf("等待患者确认，已等待 %.1f 小时", timeSinceCreation),
			Level:   "warning",
		}
	}

	confirmDelay := prescription.PatientConfirmTime.Sub(prescription.PrescriptionTime).Hours()
	if confirmDelay > 12 {
		return models.CheckResult{
			Passed:  true,
			Message: fmt.Sprintf("患者已确认，但确认耗时较长（%.1f 小时），请注意时效", confirmDelay),
			Level:   "warning",
		}
	}

	return models.CheckResult{
		Passed:  true,
		Message: fmt.Sprintf("患者已确认，耗时 %.1f 小时", confirmDelay),
		Level:   "info",
	}
}

func (v *ValidatorService) checkDuplicateDispensation(prescriptionID string) models.CheckResult {
	count, err := database.CountDispensations(prescriptionID)
	if err != nil {
		return models.CheckResult{
			Passed:  false,
			Message: "无法查询发药记录",
			Level:   "error",
		}
	}

	if count > 0 {
		return models.CheckResult{
			Passed:  false,
			Message: fmt.Sprintf("该处方已发药 %d 次，存在重复发药风险", count),
			Level:   "error",
		}
	}

	return models.CheckResult{
		Passed:  true,
		Message: "无重复发药记录",
		Level:   "info",
	}
}

func (v *ValidatorService) CanDispense(prescriptionID string) (bool, string, error) {
	reviewCheck := v.CheckReviewStatus(prescriptionID)
	if !reviewCheck.Passed {
		return false, reviewCheck.Message, nil
	}

	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return false, "无法查询处方信息", err
	}

	if prescription.Status == models.PrescriptionStatusClosed {
		return false, "处方已结案，无法发药", nil
	}

	if prescription.Status != models.PrescriptionStatusConfirmed &&
		prescription.Status != models.PrescriptionStatusDispensed {
		return false, "处方尚未经过患者确认，无法发药", nil
	}

	validation, err := v.ValidatePrescription(prescriptionID)
	if err != nil {
		return false, "校验失败", err
	}

	if !validation.TimeoutCheck.Passed {
		return false, validation.TimeoutCheck.Message, nil
	}

	if !validation.PatientConfirmCheck.Passed {
		return false, validation.PatientConfirmCheck.Message, nil
	}

	if !validation.DuplicateCheck.Passed {
		return false, validation.DuplicateCheck.Message, nil
	}

	return true, "可以发药", nil
}

func (v *ValidatorService) GetValidityDeadline(prescription *models.Prescription) time.Time {
	validityHours := v.cfg.DefaultValidityHours
	if prescription.ValidityHours > 0 {
		validityHours = prescription.ValidityHours
	}
	return prescription.PrescriptionTime.Add(time.Hour * time.Duration(validityHours))
}
