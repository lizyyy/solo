package services

import (
	"fmt"

	"night-market-api/internal/database"
	"night-market-api/internal/models"
)

type ValidationService struct{}

func NewValidationService() *ValidationService {
	return &ValidationService{}
}

func (s *ValidationService) ValidateAssignment(vendorID, stallID string) models.ValidationResult {
	var result models.ValidationResult
	result.Valid = true

	vendor, err := s.getVendor(vendorID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, models.ValidationError{
			Field:   "vendor_id",
			Message: "摊主不存在",
			Code:    "VENDOR_NOT_FOUND",
		})
		return result
	}

	stall, err := s.getStall(stallID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, models.ValidationError{
			Field:   "stall_id",
			Message: "摊位不存在",
			Code:    "STALL_NOT_FOUND",
		})
		return result
	}

	if vendor.PowerUsage > stall.PowerCapacity {
		result.Valid = false
		result.Errors = append(result.Errors, models.ValidationError{
			Field:   "power_capacity",
			Message: fmt.Sprintf("摊主用电需求(%dW)超过摊位容量(%dW)", vendor.PowerUsage, stall.PowerCapacity),
			Code:    "POWER_MISMATCH",
		})
	}

	if vendor.RequiresExhaust && !stall.HasExhaust {
		result.Valid = false
		result.Errors = append(result.Errors, models.ValidationError{
			Field:   "exhaust",
			Message: "该品类需要油烟设备，但摊位未配备",
			Code:    "EXHAUST_REQUIRED",
		})
	}

	if !vendor.RequiresExhaust && stall.HasExhaust {
		result.Warnings = append(result.Warnings, models.ValidationError{
			Field:   "exhaust",
			Message: "摊主不需要油烟设备，可考虑将摊位留给有需要的商户",
			Code:    "EXHAUST_UNUSED",
		})
	}

	if vendor.Score < 60 {
		result.Warnings = append(result.Warnings, models.ValidationError{
			Field:   "vendor_score",
			Message: fmt.Sprintf("摊主信用分较低(%d分)，需重点关注", vendor.Score),
			Code:    "LOW_VENDOR_SCORE",
		})
	}

	return result
}

func (s *ValidationService) ValidateCycle(cycleID string) models.ValidationResult {
	var result models.ValidationResult
	result.Valid = true

	assignments, err := s.getCycleAssignments(cycleID)
	if err != nil {
		result.Valid = false
		result.Errors = append(result.Errors, models.ValidationError{
			Field:   "cycle_id",
			Message: "无法获取轮换周期数据",
			Code:    "CYCLE_NOT_FOUND",
		})
		return result
	}

	stallMap := make(map[string]bool)
	vendorMap := make(map[string]bool)

	for _, a := range assignments {
		assignResult := s.ValidateAssignment(a.VendorID, a.StallID)
		if !assignResult.Valid {
			result.Valid = false
			for _, e := range assignResult.Errors {
				e.Field = fmt.Sprintf("assignment[%s].%s", a.VendorID, e.Field)
				result.Errors = append(result.Errors, e)
			}
		}
		for _, w := range assignResult.Warnings {
			w.Field = fmt.Sprintf("assignment[%s].%s", a.VendorID, w.Field)
			result.Warnings = append(result.Warnings, w)
		}

		if stallMap[a.StallID] {
			result.Valid = false
			result.Errors = append(result.Errors, models.ValidationError{
				Field:   fmt.Sprintf("assignment[%s].stall_id", a.VendorID),
				Message: "摊位已被其他摊主占用",
				Code:    "DUPLICATE_STALL",
			})
		}
		stallMap[a.StallID] = true

		if vendorMap[a.VendorID] {
			result.Valid = false
			result.Errors = append(result.Errors, models.ValidationError{
				Field:   fmt.Sprintf("assignment[%s].vendor_id", a.VendorID),
				Message: "摊主已分配其他摊位",
				Code:    "DUPLICATE_VENDOR",
			})
		}
		vendorMap[a.VendorID] = true
	}

	return result
}

func (s *ValidationService) getVendor(id string) (*models.Vendor, error) {
	var v models.Vendor
	err := database.DB.QueryRow(
		`SELECT id, name, category, power_usage, requires_exhaust, score, status 
		 FROM vendors WHERE id = ?`, id,
	).Scan(&v.ID, &v.Name, &v.Category, &v.PowerUsage, &v.RequiresExhaust, &v.Score, &v.Status)
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func (s *ValidationService) getStall(id string) (*models.Stall, error) {
	var s2 models.Stall
	err := database.DB.QueryRow(
		`SELECT id, code, name, power_capacity, has_exhaust, zone, status 
		 FROM stalls WHERE id = ?`, id,
	).Scan(&s2.ID, &s2.Code, &s2.Name, &s2.PowerCapacity, &s2.HasExhaust, &s2.Zone, &s2.Status)
	if err != nil {
		return nil, err
	}
	return &s2, nil
}

func (s *ValidationService) getCycleAssignments(cycleID string) ([]models.StallAssignment, error) {
	rows, err := database.DB.Query(
		`SELECT id, cycle_id, vendor_id, stall_id, status 
		 FROM stall_assignments WHERE cycle_id = ?`, cycleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []models.StallAssignment
	for rows.Next() {
		var a models.StallAssignment
		err := rows.Scan(&a.ID, &a.CycleID, &a.VendorID, &a.StallID, &a.Status)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, a)
	}
	return assignments, nil
}

func (s *ValidationService) CheckStallAvailable(cycleID, stallID string) bool {
	var count int
	err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM stall_assignments 
		 WHERE cycle_id = ? AND stall_id = ? AND status IN ('assigned', 'validated')`,
		cycleID, stallID,
	).Scan(&count)
	return err == nil && count == 0
}

func (s *ValidationService) CheckVendorAssigned(cycleID, vendorID string) bool {
	var count int
	err := database.DB.QueryRow(
		`SELECT COUNT(*) FROM stall_assignments 
		 WHERE cycle_id = ? AND vendor_id = ? AND status IN ('assigned', 'validated')`,
		cycleID, vendorID,
	).Scan(&count)
	return err == nil && count > 0
}
