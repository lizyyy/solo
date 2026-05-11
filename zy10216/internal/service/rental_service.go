package service

import (
	"fmt"
	"math"
	"strings"
	"time"

	"lensrent/internal/models"
	"lensrent/internal/store"
)

type RentalService struct {
	store *store.Store
}

func NewRentalService(s *store.Store) *RentalService {
	return &RentalService{store: s}
}

func GenerateID(prefix string) string {
	now := time.Now()
	return fmt.Sprintf("%s%s%03d", prefix, now.Format("20060102150405"), now.Nanosecond()%1000)
}

func (s *RentalService) CalculateRentalDays(start, end string) int {
	startTime, _ := time.Parse("2006-01-02", start)
	endTime, _ := time.Parse("2006-01-02", end)
	duration := endTime.Sub(startTime)
	days := int(math.Ceil(duration.Hours() / 24))
	if days < 1 {
		days = 1
	}
	return days
}

func (s *RentalService) CalculateOverdue(rentalEnd, actualReturn string, dailyRate float64) (int, float64) {
	endTime, _ := time.Parse("2006-01-02", rentalEnd)
	actualTime, _ := time.Parse("2006-01-02", actualReturn)

	if actualTime.Before(endTime) || actualTime.Equal(endTime) {
		return 0, 0
	}

	duration := actualTime.Sub(endTime)
	days := int(math.Ceil(duration.Hours() / 24))
	overdueRate := s.store.GetOverdueRate()
	fee := float64(days) * dailyRate * overdueRate
	return days, fee
}

func (s *RentalService) CalculateMissingFee(missingAccessories []string) (float64, map[string]float64) {
	feePerItem := s.store.GetAccessoryFee()
	itemFees := make(map[string]float64)
	total := 0.0

	for _, acc := range missingAccessories {
		itemFees[acc] = feePerItem
		total += feePerItem
	}

	return total, itemFees
}

func (s *RentalService) GetOrCreateEquipment(db *models.Database, id, name, eqType string, deposit, dailyRate float64, accessories []string) (*models.Equipment, bool, error) {
	if id != "" {
		for i := range db.Equipments {
			if db.Equipments[i].ID == id {
				return &db.Equipments[i], false, nil
			}
		}
	}

	for i := range db.Equipments {
		if db.Equipments[i].Name == name && db.Equipments[i].Type == eqType {
			return &db.Equipments[i], false, nil
		}
	}

	if name == "" {
		return nil, false, fmt.Errorf("需要提供器材名称")
	}

	newID := id
	if newID == "" {
		newID = GenerateID("EQ")
	}

	now := time.Now().Format(time.RFC3339)
	eq := models.Equipment{
		ID:          newID,
		Name:        name,
		Type:        eqType,
		Deposit:     deposit,
		DailyRate:   dailyRate,
		Accessories: accessories,
		IsAvailable: true,
		CreatedAt:   now,
		UpdatedAt:   now,
	}
	db.Equipments = append(db.Equipments, eq)

	for i := range db.Equipments {
		if db.Equipments[i].ID == newID {
			return &db.Equipments[i], true, nil
		}
	}

	return nil, false, fmt.Errorf("器材创建失败")
}

func (s *RentalService) GetOrCreateRenter(db *models.Database, id, name, phone, email, notes string) (*models.Renter, bool, error) {
	if id != "" {
		for i := range db.Renters {
			if db.Renters[i].ID == id {
				return &db.Renters[i], false, nil
			}
		}
	}

	if phone != "" {
		for i := range db.Renters {
			if db.Renters[i].Phone == phone {
				return &db.Renters[i], false, nil
			}
		}
	}

	if name == "" {
		return nil, false, fmt.Errorf("需要提供租客姓名")
	}

	newID := id
	if newID == "" {
		newID = GenerateID("RT")
	}

	now := time.Now().Format(time.RFC3339)
	r := models.Renter{
		ID:        newID,
		Name:      name,
		Phone:     phone,
		Email:     email,
		Notes:     notes,
		CreatedAt: now,
	}
	db.Renters = append(db.Renters, r)

	for i := range db.Renters {
		if db.Renters[i].ID == newID {
			return &db.Renters[i], true, nil
		}
	}

	return nil, false, fmt.Errorf("租客创建失败")
}

func (s *RentalService) CreateRental(
	db *models.Database,
	equipmentID, renterID,
	rentalStart, rentalEnd string,
	depositPaid, dailyRate float64,
	accessoriesOut []string,
	outChecklist []models.CheckItem,
	customID string,
) (*models.Rental, *ValidationResult, error) {

	overallResult := NewValidationResult()

	dateValidation := ValidateRentalDates(rentalStart, rentalEnd)
	if !dateValidation.IsValid {
		return nil, dateValidation, fmt.Errorf("日期校验失败")
	}
	overallResult.Errors = append(overallResult.Errors, dateValidation.Errors...)
	overallResult.Warnings = append(overallResult.Warnings, dateValidation.Warnings...)

	var eq *models.Equipment
	for i := range db.Equipments {
		if db.Equipments[i].ID == equipmentID {
			eq = &db.Equipments[i]
			break
		}
	}
	if eq == nil {
		return nil, overallResult, fmt.Errorf("未找到器材: %s", equipmentID)
	}

	availabilityResult := ValidateEquipmentAvailability(db.Rentals, equipmentID, "", rentalStart, rentalEnd)
	if !availabilityResult.IsValid {
		overallResult.Conflicts = append(overallResult.Conflicts, availabilityResult.Conflicts...)
		return nil, overallResult, fmt.Errorf("器材档期冲突")
	}

	var renter *models.Renter
	for i := range db.Renters {
		if db.Renters[i].ID == renterID {
			renter = &db.Renters[i]
			break
		}
	}
	if renter == nil {
		return nil, overallResult, fmt.Errorf("未找到租客: %s", renterID)
	}

	rentalID := customID
	if rentalID == "" {
		rentalID = GenerateID("RN")
	}

	duplicateResult := ValidateDuplicateOperation(db, "rental_create", rentalID)
	if !duplicateResult.IsValid {
		overallResult.Conflicts = append(overallResult.Conflicts, duplicateResult.Conflicts...)
		return nil, overallResult, fmt.Errorf("重复创建")
	}

	effectiveRate := dailyRate
	if effectiveRate <= 0 {
		effectiveRate = eq.DailyRate
	}

	effectiveDeposit := depositPaid
	if effectiveDeposit <= 0 {
		effectiveDeposit = eq.Deposit
	}

	checklistResult := ValidateChecklist(outChecklist, "out")
	overallResult.Warnings = append(overallResult.Warnings, checklistResult.Warnings...)

	now := time.Now().Format(time.RFC3339)
	rental := models.Rental{
		ID:               rentalID,
		EquipmentID:      eq.ID,
		EquipmentName:    eq.Name,
		RenterID:         renter.ID,
		RenterName:       renter.Name,
		RenterPhone:      renter.Phone,
		RentalStart:      rentalStart,
		RentalEnd:        rentalEnd,
		DepositPaid:      effectiveDeposit,
		DailyRate:        effectiveRate,
		AccessoriesOut:   accessoriesOut,
		OutChecklist:     outChecklist,
		OutVerified:      len(outChecklist) > 0,
		IsReturned:       false,
		IsCompensated:    false,
		Status:           "OUT",
		CreatedAt:        now,
		UpdatedAt:        now,
	}

	db.Rentals = append(db.Rentals, rental)
	eq.IsAvailable = false
	eq.UpdatedAt = now

	return &rental, overallResult, nil
}

func (s *RentalService) ProcessReturn(
	db *models.Database,
	rentalID string,
	actualReturn string,
	accessoriesBack []string,
	inChecklist []models.CheckItem,
) (*models.Rental, *ValidationResult, error) {

	overallResult := NewValidationResult()

	var rental *models.Rental
	for i := range db.Rentals {
		if db.Rentals[i].ID == rentalID {
			rental = &db.Rentals[i]
			break
		}
	}
	if rental == nil {
		return nil, overallResult, fmt.Errorf("未找到订单: %s", rentalID)
	}

	returnOpValidation := ValidateDuplicateOperation(db, "rental_return", rentalID)
	if !returnOpValidation.IsValid {
		overallResult.Conflicts = append(overallResult.Conflicts, returnOpValidation.Conflicts...)
		return nil, overallResult, fmt.Errorf("重复归还")
	}

	if actualReturn == "" {
		actualReturn = time.Now().Format("2006-01-02")
	}

	dateValidation := ValidateActualReturn(rental.RentalStart, rental.RentalEnd, actualReturn)
	if !dateValidation.IsValid {
		overallResult.Errors = append(overallResult.Errors, dateValidation.Errors...)
		return nil, overallResult, fmt.Errorf("日期校验失败")
	}
	overallResult.Warnings = append(overallResult.Warnings, dateValidation.Warnings...)

	checklistResult := ValidateChecklist(inChecklist, "in")
	overallResult.Warnings = append(overallResult.Warnings, checklistResult.Warnings...)

	missingAcc, accValidation := ValidateMissingAccessories(rental.AccessoriesOut, accessoriesBack)
	overallResult.Warnings = append(overallResult.Warnings, accValidation.Warnings...)

	overdueDays, overdueFee := s.CalculateOverdue(rental.RentalEnd, actualReturn, rental.DailyRate)
	missingFee, _ := s.CalculateMissingFee(missingAcc)

	totalDeductions := overdueFee + missingFee
	refund := rental.DepositPaid - totalDeductions

	if refund < 0 {
		refund = 0
	}

	now := time.Now().Format(time.RFC3339)

	rental.ActualReturn = actualReturn
	rental.AccessoriesBack = accessoriesBack
	rental.InChecklist = inChecklist
	rental.InVerified = len(inChecklist) > 0
	rental.IsReturned = true
	rental.OverdueDays = overdueDays
	rental.OverdueFee = overdueFee
	rental.MissingAccessories = missingAcc
	rental.MissingFee = missingFee
	rental.RefundAmount = refund
	rental.FinalBalance = refund - totalDeductions
	rental.Status = "RETURNED"
	rental.UpdatedAt = now

	for i := range db.Equipments {
		if db.Equipments[i].ID == rental.EquipmentID {
			db.Equipments[i].IsAvailable = true
			db.Equipments[i].UpdatedAt = now
			break
		}
	}

	return rental, overallResult, nil
}

func (s *RentalService) ApplyCompensation(
	db *models.Database,
	rentalID string,
	amount float64,
	note string,
) (*models.Rental, *ValidationResult, error) {

	result := NewValidationResult()

	var rental *models.Rental
	for i := range db.Rentals {
		if db.Rentals[i].ID == rentalID {
			rental = &db.Rentals[i]
			break
		}
	}
	if rental == nil {
		return nil, result, fmt.Errorf("未找到订单: %s", rentalID)
	}

	compValidation := ValidateDuplicateOperation(db, "rental_compensate", rentalID)
	if !compValidation.IsValid {
		result.Conflicts = append(result.Conflicts, compValidation.Conflicts...)
		return nil, result, fmt.Errorf("重复赔付")
	}

	now := time.Now().Format(time.RFC3339)

	rental.IsCompensated = true
	rental.CompensationAmount = amount
	rental.CompensationNote = note

	newRefund := rental.RefundAmount - amount
	if newRefund < 0 {
		newRefund = 0
	}
	rental.RefundAmount = newRefund
	rental.FinalBalance = newRefund
	rental.UpdatedAt = now

	dispute := models.DisputeRecord{
		ID:            GenerateID("DP"),
		RentalID:      rental.ID,
		EquipmentName: rental.EquipmentName,
		RenterName:    rental.RenterName,
		IssueType:     "COMPENSATION",
		Description:   note,
		Resolution:    fmt.Sprintf("赔付扣款 %.2f 元", amount),
		Amount:        amount,
		Timestamp:     now,
	}
	db.Disputes = append(db.Disputes, dispute)

	return rental, result, nil
}

func (s *RentalService) GetRentalByID(db *models.Database, id string) *models.Rental {
	for i := range db.Rentals {
		if db.Rentals[i].ID == id {
			return &db.Rentals[i]
		}
	}
	return nil
}

func (s *RentalService) ListRentals(db *models.Database, status string) []models.Rental {
	if status == "" || strings.ToUpper(status) == "ALL" {
		return db.Rentals
	}

	target := strings.ToUpper(status)
	result := []models.Rental{}
	for _, r := range db.Rentals {
		if strings.ToUpper(r.Status) == target {
			result = append(result, r)
		}
	}
	return result
}
