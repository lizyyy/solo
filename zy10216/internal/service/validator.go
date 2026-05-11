package service

import (
	"fmt"
	"time"

	"lensrent/internal/models"
)

type ValidationError struct {
	Field   string
	Message string
}

func (e *ValidationError) Error() string {
	return fmt.Sprintf("[%s] %s", e.Field, e.Message)
}

type ValidationResult struct {
	Errors     []*ValidationError
	Warnings   []*ValidationError
	IsValid    bool
	Conflicts  []string
}

func NewValidationResult() *ValidationResult {
	return &ValidationResult{
		Errors:    []*ValidationError{},
		Warnings:  []*ValidationError{},
		IsValid:   true,
		Conflicts: []string{},
	}
}

func (r *ValidationResult) AddError(field, msg string) {
	r.Errors = append(r.Errors, &ValidationError{Field: field, Message: msg})
	r.IsValid = false
}

func (r *ValidationResult) AddWarning(field, msg string) {
	r.Warnings = append(r.Warnings, &ValidationError{Field: field, Message: msg})
}

func (r *ValidationResult) AddConflict(msg string) {
	r.Conflicts = append(r.Conflicts, msg)
}

func ValidateRentalDates(start, end string) *ValidationResult {
	result := NewValidationResult()

	if start == "" {
		result.AddError("rental_start", "借出日期不能为空")
		return result
	}

	if end == "" {
		result.AddError("rental_end", "归还日期不能为空")
		return result
	}

	startTime, err := time.Parse("2006-01-02", start)
	if err != nil {
		result.AddError("rental_start", fmt.Sprintf("借出日期格式错误，应为 YYYY-MM-DD: %s", start))
	}

	endTime, err := time.Parse("2006-01-02", end)
	if err != nil {
		result.AddError("rental_end", fmt.Sprintf("归还日期格式错误，应为 YYYY-MM-DD: %s", end))
	}

	if !startTime.IsZero() && !endTime.IsZero() {
		if endTime.Before(startTime) {
			result.AddError("rental_dates", fmt.Sprintf("归还日期(%s)不能早于借出日期(%s)", end, start))
		}
		if endTime.Equal(startTime) {
			result.AddWarning("rental_dates", "借出和归还为同一天，请确认")
		}
	}

	return result
}

func ValidateActualReturn(rentalStart, rentalEnd, actualReturn string) *ValidationResult {
	result := NewValidationResult()

	if actualReturn == "" {
		return result
	}

	rStart, _ := time.Parse("2006-01-02", rentalStart)
	actual, err := time.Parse("2006-01-02", actualReturn)
	if err != nil {
		result.AddError("actual_return", fmt.Sprintf("实际归还日期格式错误: %s", actualReturn))
		return result
	}

	if actual.Before(rStart) {
		result.AddError("actual_return", fmt.Sprintf("实际归还日期(%s)不能早于借出日期(%s)", actualReturn, rentalStart))
	}

	return result
}

func ValidateEquipmentAvailability(rentals []models.Rental, eqID string, newRentalID string, start, end string) *ValidationResult {
	result := NewValidationResult()

	startTime, _ := time.Parse("2006-01-02", start)
	endTime, _ := time.Parse("2006-01-02", end)

	for _, r := range rentals {
		if r.EquipmentID != eqID {
			continue
		}
		if r.IsReturned {
			continue
		}
		if newRentalID != "" && r.ID == newRentalID {
			continue
		}

		rStart, _ := time.Parse("2006-01-02", r.RentalStart)
		rEnd, _ := time.Parse("2006-01-02", r.RentalEnd)

		if !(endTime.Before(rStart) || startTime.After(rEnd)) {
			result.AddConflict(fmt.Sprintf("器材ID %s 在 %s 至 %s 已被订单 %s 占用", eqID, r.RentalStart, r.RentalEnd, r.ID))
			result.IsValid = false
		}
	}

	return result
}

func ValidateMissingAccessories(accessoriesOut, accessoriesBack []string) (missing []string, result *ValidationResult) {
	result = NewValidationResult()
	missing = []string{}

	outMap := make(map[string]int)
	for _, acc := range accessoriesOut {
		outMap[acc]++
	}

	backMap := make(map[string]int)
	for _, acc := range accessoriesBack {
		backMap[acc]++
	}

	for acc, outCount := range outMap {
		backCount := backMap[acc]
		diff := outCount - backCount
		for i := 0; i < diff; i++ {
			missing = append(missing, acc)
		}
	}

	for acc, backCount := range backMap {
		if _, exists := outMap[acc]; !exists {
			result.AddWarning("accessories_back", fmt.Sprintf("归还时有额外配件: %s (出库时没有记录)", acc))
		}
		if backCount > outMap[acc] {
			result.AddWarning("accessories_back", fmt.Sprintf("归还时配件数量多于出库: %s", acc))
		}
	}

	if len(missing) > 0 {
		result.AddWarning("missing_accessories", fmt.Sprintf("检测到缺失配件: %v，请确认是否需要扣款", missing))
	}

	return missing, result
}

func ValidateDuplicateOperation(db *models.Database, opType, id string) *ValidationResult {
	result := NewValidationResult()

	switch opType {
	case "rental_create":
		for _, r := range db.Rentals {
			if r.ID == id {
				result.AddConflict(fmt.Sprintf("订单ID已存在: %s，避免重复创建", id))
				result.IsValid = false
			}
		}
	case "rental_return":
		for _, r := range db.Rentals {
			if r.ID == id && r.IsReturned {
				result.AddConflict(fmt.Sprintf("订单 %s 已完成归还，禁止重复操作", id))
				result.IsValid = false
			}
		}
	case "rental_compensate":
		for _, r := range db.Rentals {
			if r.ID == id && r.IsCompensated {
				result.AddConflict(fmt.Sprintf("订单 %s 已做过赔付处理，禁止重复修改", id))
				result.IsValid = false
			}
		}
	case "verify_out":
		for _, r := range db.Rentals {
			if r.ID == id && r.OutVerified {
				result.AddConflict(fmt.Sprintf("订单 %s 出库验机已完成，禁止重复操作", id))
				result.IsValid = false
			}
		}
	case "verify_in":
		for _, r := range db.Rentals {
			if r.ID == id && r.InVerified {
				result.AddConflict(fmt.Sprintf("订单 %s 归还验机已完成，禁止重复操作", id))
				result.IsValid = false
			}
		}
	}

	return result
}

func ValidateChecklist(checklist []models.CheckItem, stage string) *ValidationResult {
	result := NewValidationResult()

	if len(checklist) == 0 {
		result.AddWarning(fmt.Sprintf("%s_checklist", stage), "未提供验机清单，建议补充以避免争议")
		return result
	}

	hasIssue := false
	for _, item := range checklist {
		if !item.IsGood {
			hasIssue = true
			result.AddWarning(fmt.Sprintf("%s_checklist:%s", stage, item.Name), fmt.Sprintf("【%s】存在问题: %s", item.Name, item.Comment))
		}
	}

	if hasIssue {
		result.AddWarning(fmt.Sprintf("%s_checklist", stage), "验机清单中有问题项，请在确认前仔细核对")
	}

	return result
}
