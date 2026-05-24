package service

import (
	"fuel-subsidy-api/internal/dao"
	"fuel-subsidy-api/internal/models"
	"strings"
	"time"

	"github.com/google/uuid"
)

type ValidationResult struct {
	Passed  bool     `json:"passed"`
	Reasons []string `json:"reasons"`
}

type VoyageValidationResult struct {
	VoyageNumber string `json:"voyage_number"`
	ValidationResult
}

type ReceiptValidationResult struct {
	ReceiptNumber string `json:"receipt_number"`
	ValidationResult
}

type FullValidationResult struct {
	OwnerConsistent  bool                      `json:"owner_consistent"`
	OwnerMismatch    string                    `json:"owner_mismatch,omitempty"`
	VoyageResults    []VoyageValidationResult  `json:"voyage_results"`
	ReceiptResults   []ReceiptValidationResult `json:"receipt_results"`
	TotalPassed      bool                      `json:"total_passed"`
	AllReasons       []string                  `json:"all_reasons"`
}

func ValidateVoyageAgainstBanPeriod(voyage *models.Voyage, year int) ValidationResult {
	var result ValidationResult
	result.Passed = true

	var banPeriods []models.FishingBanPeriod
	dao.DB.Where("year = ?", year).Find(&banPeriods)

	if len(banPeriods) == 0 {
		return result
	}

	for _, bp := range banPeriods {
		if (voyage.DepartureDate.After(bp.StartDate) || voyage.DepartureDate.Equal(bp.StartDate)) &&
			(voyage.DepartureDate.Before(bp.EndDate) || voyage.DepartureDate.Equal(bp.EndDate)) {
			voyage.IsInBanPeriod = true
			voyage.CheckResult = "failed"
			voyage.CheckRemark = "航次开始时间在" + bp.Region + "禁渔期内: " + bp.StartDate.Format("2006-01-02") + " 至 " + bp.EndDate.Format("2006-01-02")
			result.Passed = false
			result.Reasons = append(result.Reasons, "航次["+voyage.VoyageNumber+"]: 开始时间在"+bp.Region+"禁渔期内")
			continue
		}

		if (voyage.ReturnDate.After(bp.StartDate) || voyage.ReturnDate.Equal(bp.StartDate)) &&
			(voyage.ReturnDate.Before(bp.EndDate) || voyage.ReturnDate.Equal(bp.EndDate)) {
			voyage.IsInBanPeriod = true
			voyage.CheckResult = "failed"
			voyage.CheckRemark = "航次结束时间在" + bp.Region + "禁渔期内: " + bp.StartDate.Format("2006-01-02") + " 至 " + bp.EndDate.Format("2006-01-02")
			result.Passed = false
			result.Reasons = append(result.Reasons, "航次["+voyage.VoyageNumber+"]: 结束时间在"+bp.Region+"禁渔期内")
			continue
		}

		if voyage.DepartureDate.Before(bp.StartDate) && voyage.ReturnDate.After(bp.EndDate) {
			voyage.IsInBanPeriod = true
			voyage.CheckResult = "failed"
			voyage.CheckRemark = "航次跨越" + bp.Region + "禁渔期"
			result.Passed = false
			result.Reasons = append(result.Reasons, "航次["+voyage.VoyageNumber+"]: 跨越"+bp.Region+"禁渔期")
		}
	}

	if result.Passed {
		voyage.CheckResult = "passed"
		voyage.CheckRemark = "禁渔期校验通过"
	}

	return result
}

func ValidateFuelReceipt(receipt *models.FuelReceipt, excludeAppID *uuid.UUID) ValidationResult {
	var result ValidationResult
	result.Passed = true

	var existingReceipt models.FuelReceipt
	query := dao.DB.Where("receipt_number = ?", receipt.ReceiptNumber)
	if excludeAppID != nil {
		query = query.Where("(is_used = ? AND used_by_app_id != ?) OR (is_used = ? AND used_by_app_id IS NOT NULL)", true, *excludeAppID, true)
	} else {
		query = query.Where("is_used = ?", true)
	}

	err := query.First(&existingReceipt).Error
	if err == nil {
		result.Passed = false
		result.Reasons = append(result.Reasons, "加油票["+receipt.ReceiptNumber+"]已被使用")
		return result
	}

	if receipt.FuelAmount <= 0 {
		result.Passed = false
		result.Reasons = append(result.Reasons, "加油票["+receipt.ReceiptNumber+"]加油量必须大于0")
	}

	return result
}

func ValidateOwnerConsistency(applicantName, applicantIDCard, vesselNumber string) (bool, string) {
	var vessel models.FishingVessel
	err := dao.DB.Where("vessel_number = ?", vesselNumber).First(&vessel).Error
	if err != nil {
		return false, "渔船不存在"
	}

	if strings.TrimSpace(applicantName) != strings.TrimSpace(vessel.OwnerName) {
		return false, "申请人姓名与渔船船主不一致: 申请人=" + applicantName + ", 船主=" + vessel.OwnerName
	}

	if strings.TrimSpace(applicantIDCard) != strings.TrimSpace(vessel.OwnerIDCard) {
		return false, "申请人身份证与渔船船主不一致"
	}

	return true, ""
}

func ValidateAllVoyages(voyages []models.Voyage, year int) []VoyageValidationResult {
	var results []VoyageValidationResult
	for i := range voyages {
		r := ValidateVoyageAgainstBanPeriod(&voyages[i], year)
		results = append(results, VoyageValidationResult{
			VoyageNumber:     voyages[i].VoyageNumber,
			ValidationResult: r,
		})
	}
	return results
}

func ValidateAllReceipts(receiptNumbers []string, vesselNumber string, excludeAppID *uuid.UUID) ([]ReceiptValidationResult, []models.FuelReceipt) {
	var results []ReceiptValidationResult
	var validReceipts []models.FuelReceipt

	for _, rn := range receiptNumbers {
		var receipt models.FuelReceipt
		err := dao.DB.Where("receipt_number = ?", rn).First(&receipt).Error
		if err != nil {
			results = append(results, ReceiptValidationResult{
				ReceiptNumber: rn,
				ValidationResult: ValidationResult{
					Passed:  false,
					Reasons: []string{"加油票[" + rn + "]不存在"},
				},
			})
			continue
		}

		if receipt.VesselNumber != vesselNumber {
			results = append(results, ReceiptValidationResult{
				ReceiptNumber: rn,
				ValidationResult: ValidationResult{
					Passed:  false,
					Reasons: []string{"加油票[" + rn + "]所属渔船与申请渔船不匹配"},
				},
			})
			continue
		}

		r := ValidateFuelReceipt(&receipt, excludeAppID)
		results = append(results, ReceiptValidationResult{
			ReceiptNumber:    rn,
			ValidationResult: r,
		})
		if r.Passed {
			validReceipts = append(validReceipts, receipt)
		}
	}

	return results, validReceipts
}

func PerformFullValidation(app *models.SubsidyApplication, voyages []models.Voyage, receiptNumbers []string) FullValidationResult {
	var result FullValidationResult
	result.TotalPassed = true

	ownerOk, ownerMsg := ValidateOwnerConsistency(app.ApplicantName, app.ApplicantIDCard, app.VesselNumber)
	result.OwnerConsistent = ownerOk
	if !ownerOk {
		result.OwnerMismatch = ownerMsg
		result.TotalPassed = false
		result.AllReasons = append(result.AllReasons, ownerMsg)
	}

	result.VoyageResults = ValidateAllVoyages(voyages, app.ApplicationYear)
	for _, vr := range result.VoyageResults {
		if !vr.Passed {
			result.TotalPassed = false
			result.AllReasons = append(result.AllReasons, vr.Reasons...)
		}
	}

	result.ReceiptResults, _ = ValidateAllReceipts(receiptNumbers, app.VesselNumber, nil)
	for _, rr := range result.ReceiptResults {
		if !rr.Passed {
			result.TotalPassed = false
			result.AllReasons = append(result.AllReasons, rr.Reasons...)
		}
	}

	return result
}

func IsDateOverlap(start1, end1, start2, end2 time.Time) bool {
	return start1.Before(end2) && end1.After(start2)
}
