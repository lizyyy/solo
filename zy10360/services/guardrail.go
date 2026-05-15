package services

import (
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"regexp"
	"runtime-guardrail/database"
	"runtime-guardrail/models"
	"strconv"
	"strings"
	"time"

	"gorm.io/gorm"
)

type CreateChangeRequestRequest struct {
	RequestID         string `json:"request_id"`
	ServiceName       string `json:"service_name" binding:"required"`
	ParamKey          string `json:"param_key" binding:"required"`
	OldValue          string `json:"old_value"`
	NewValue          string `json:"new_value" binding:"required"`
	RequestedBy       string `json:"requested_by" binding:"required"`
	AutoRollbackHours int    `json:"auto_rollback_hours"`
}

type ValidateChangeRequestRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Validator       string `json:"validator" binding:"required"`
}

type ApproveChangeRequestRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Approver        string `json:"approver" binding:"required"`
}

type ActivateChangeRequestRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Operator        string `json:"operator" binding:"required"`
}

type RollbackChangeRequestRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Operator        string `json:"operator" binding:"required"`
	Reason          string `json:"reason" binding:"required"`
}

type RejectChangeRequestRequest struct {
	ChangeRequestID string `json:"change_request_id" binding:"required"`
	Rejector        string `json:"rejector" binding:"required"`
	Reason          string `json:"reason" binding:"required"`
}

type ValidationResult struct {
	Passed  bool   `json:"passed"`
	Message string `json:"message"`
}

func CreateChangeRequest(req *CreateChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var existingCR models.ChangeRequest
	if req.RequestID != "" {
		if err := db.Where("request_id = ?", req.RequestID).First(&existingCR).Error; err == nil {
			return &existingCR, errors.New("duplicate request: change request already exists with this request_id")
		}
	}

	var callingService models.CallingService
	if err := db.Where("service_name = ? AND is_active = ?", req.ServiceName, true).First(&callingService).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("service '%s' is not registered or inactive", req.ServiceName)
		}
		return nil, err
	}

	var paramItem models.ParameterItem
	if err := db.Where("service_name = ? AND param_key = ?", req.ServiceName, req.ParamKey).First(&paramItem).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			paramItem = models.ParameterItem{
				ServiceName: req.ServiceName,
				ParamKey:    req.ParamKey,
				ParamType:   "string",
				Description: fmt.Sprintf("Auto-created parameter for %s.%s", req.ServiceName, req.ParamKey),
			}
			if err := db.Create(&paramItem).Error; err != nil {
				return nil, err
			}
		} else {
			return nil, err
		}
	}

	riskLevel, err := CalculateRiskLevel(req.ServiceName, req.ParamKey, req.OldValue, req.NewValue)
	if err != nil {
		return nil, err
	}

	changeRequest := models.ChangeRequest{
		RequestID:   req.RequestID,
		ServiceName: req.ServiceName,
		ParamKey:    req.ParamKey,
		OldValue:    req.OldValue,
		NewValue:    req.NewValue,
		RequestedBy: req.RequestedBy,
		RiskLevel:   riskLevel,
		Status:      models.StatusPending,
	}

	if req.AutoRollbackHours > 0 {
		autoRollbackAt := time.Now().Add(time.Duration(req.AutoRollbackHours) * time.Hour)
		changeRequest.AutoRollbackAt = &autoRollbackAt
	}

	if err := db.Create(&changeRequest).Error; err != nil {
		return nil, err
	}

	if err := CreateAuditLog(changeRequest.ID, "CREATED", "", string(changeRequest.Status), req.RequestedBy, "Change request created"); err != nil {
		return nil, err
	}

	return &changeRequest, nil
}

func CalculateRiskLevel(serviceName, paramKey, oldValue, newValue string) (models.RiskLevel, error) {
	db := database.GetDB()

	var paramItem models.ParameterItem
	if err := db.Where("service_name = ? AND param_key = ?", serviceName, paramKey).First(&paramItem).Error; err != nil {
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return "", err
		}
	}

	changeMagnitude := calculateChangeMagnitude(oldValue, newValue)

	if strings.Contains(strings.ToLower(paramKey), "password") ||
		strings.Contains(strings.ToLower(paramKey), "secret") ||
		strings.Contains(strings.ToLower(paramKey), "key") ||
		strings.Contains(strings.ToLower(paramKey), "token") {
		return models.RiskCritical, nil
	}

	if strings.Contains(strings.ToLower(paramKey), "timeout") ||
		strings.Contains(strings.ToLower(paramKey), "retry") ||
		strings.Contains(strings.ToLower(paramKey), "threshold") {
		if changeMagnitude > 2.0 {
			return models.RiskHigh, nil
		}
		return models.RiskMedium, nil
	}

	if changeMagnitude > 3.0 {
		return models.RiskHigh, nil
	}
	if changeMagnitude > 1.5 {
		return models.RiskMedium, nil
	}
	return models.RiskLow, nil
}

func calculateChangeMagnitude(oldVal, newVal string) float64 {
	if oldVal == "" {
		return 2.0
	}

	oldFloat, oldErr := strconv.ParseFloat(oldVal, 64)
	newFloat, newErr := strconv.ParseFloat(newVal, 64)

	if oldErr == nil && newErr == nil && oldFloat != 0 {
		return math.Abs((newFloat - oldFloat) / oldFloat)
	}

	oldLen := len(oldVal)
	newLen := len(newVal)
	if oldLen == 0 {
		return 1.0
	}
	return math.Abs(float64(newLen-oldLen)) / float64(oldLen)
}

func ValidateChangeRequest(req *ValidateChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", req.ChangeRequestID, req.ChangeRequestID).First(&cr).Error; err != nil {
		return nil, errors.New("change request not found")
	}

	if cr.Status != models.StatusPending && cr.Status != models.StatusValidated {
		return nil, fmt.Errorf("cannot validate change request with status: %s", cr.Status)
	}

	validationResult, err := ValidateAgainstAllowedRange(cr.ServiceName, cr.ParamKey, cr.NewValue)
	if err != nil {
		return nil, err
	}

	cr.ValidationResult = validationResult.Message
	cr.ValidationPassed = &validationResult.Passed

	if !validationResult.Passed {
		cr.Status = models.StatusFailed
		cr.FailureReason = validationResult.Message
	} else {
		cr.Status = models.StatusValidated
	}

	if err := db.Save(&cr).Error; err != nil {
		return nil, err
	}

	action := "VALIDATED"
	if !validationResult.Passed {
		action = "VALIDATION_FAILED"
	}
	if err := CreateAuditLog(cr.ID, action, string(models.StatusPending), string(cr.Status), req.Validator, validationResult.Message); err != nil {
		return nil, err
	}

	return &cr, nil
}

func ValidateAgainstAllowedRange(serviceName, paramKey, value string) (*ValidationResult, error) {
	db := database.GetDB()

	var paramItem models.ParameterItem
	if err := db.Where("service_name = ? AND param_key = ?", serviceName, paramKey).First(&paramItem).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &ValidationResult{
				Passed:  true,
				Message: "No allowed range defined, validation passed by default",
			}, nil
		}
		return nil, err
	}

	var allowedRanges []models.AllowedRange
	if err := db.Where("parameter_item_id = ? AND is_active = ?", paramItem.ID, true).Find(&allowedRanges).Error; err != nil {
		return nil, err
	}

	if len(allowedRanges) == 0 {
		return &ValidationResult{
			Passed:  true,
			Message: "No active allowed ranges, validation passed",
		}, nil
	}

	for _, ar := range allowedRanges {
		if result := validateSingleRange(ar, value); result.Passed {
			return &ValidationResult{
				Passed:  true,
				Message: fmt.Sprintf("Value matches allowed range criteria: %s", result.Message),
			}, nil
		}
	}

	return &ValidationResult{
		Passed:  false,
		Message: "Value does not match any allowed range criteria",
	}, nil
}

func validateSingleRange(ar models.AllowedRange, value string) *ValidationResult {
	if ar.EnumValues != "" {
		var enums []string
		if err := json.Unmarshal([]byte(ar.EnumValues), &enums); err == nil {
			found := false
			for _, e := range enums {
				if e == value {
					found = true
					break
				}
			}
			if !found {
				return &ValidationResult{Passed: false, Message: "Value not in allowed enum values"}
			}
			return &ValidationResult{Passed: true, Message: "Matches enum values"}
		}
	}

	if ar.Pattern != "" {
		if matched, _ := regexp.MatchString(ar.Pattern, value); !matched {
			return &ValidationResult{Passed: false, Message: "Value does not match required pattern"}
		}
		return &ValidationResult{Passed: true, Message: "Matches pattern"}
	}

	if ar.MinValue != "" || ar.MaxValue != "" {
		val, err := strconv.ParseFloat(value, 64)
		if err != nil {
			return &ValidationResult{Passed: false, Message: "Value is not a valid number for range comparison"}
		}

		if ar.MinValue != "" {
			minVal, _ := strconv.ParseFloat(ar.MinValue, 64)
			if val < minVal {
				return &ValidationResult{Passed: false, Message: fmt.Sprintf("Value %.2f is below minimum %.2f", val, minVal)}
			}
		}

		if ar.MaxValue != "" {
			maxVal, _ := strconv.ParseFloat(ar.MaxValue, 64)
			if val > maxVal {
				return &ValidationResult{Passed: false, Message: fmt.Sprintf("Value %.2f is above maximum %.2f", val, maxVal)}
			}
		}
		return &ValidationResult{Passed: true, Message: "Within numeric range"}
	}

	return &ValidationResult{Passed: true, Message: "No specific constraints defined"}
}

func ApproveChangeRequest(req *ApproveChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", req.ChangeRequestID, req.ChangeRequestID).First(&cr).Error; err != nil {
		return nil, errors.New("change request not found")
	}

	if cr.Status != models.StatusValidated {
		return nil, fmt.Errorf("cannot approve change request with status: %s (must be VALIDATED first)", cr.Status)
	}

	if cr.ValidationPassed == nil || !*cr.ValidationPassed {
		return nil, errors.New("cannot approve change request that failed validation")
	}

	oldStatus := cr.Status
	now := time.Now()
	cr.Status = models.StatusApproved
	cr.ApprovedBy = req.Approver
	cr.ApprovedAt = &now

	if err := db.Save(&cr).Error; err != nil {
		return nil, err
	}

	if err := CreateAuditLog(cr.ID, "APPROVED", string(oldStatus), string(cr.Status), req.Approver, "Change request approved"); err != nil {
		return nil, err
	}

	return &cr, nil
}

func ActivateChangeRequest(req *ActivateChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", req.ChangeRequestID, req.ChangeRequestID).First(&cr).Error; err != nil {
		return nil, errors.New("change request not found")
	}

	if cr.Status != models.StatusApproved {
		return nil, fmt.Errorf("cannot activate change request with status: %s (must be APPROVED first)", cr.Status)
	}

	oldStatus := cr.Status
	now := time.Now()
	cr.Status = models.StatusActive
	cr.EffectiveAt = &now

	if err := db.Save(&cr).Error; err != nil {
		return nil, err
	}

	effectiveResult := models.EffectiveResult{
		ChangeRequestID: cr.ID,
		ServiceName:     cr.ServiceName,
		ParamKey:        cr.ParamKey,
		Value:           cr.NewValue,
		Status:          models.StatusActive,
		EffectiveAt:     now,
	}
	if err := db.Create(&effectiveResult).Error; err != nil {
		return nil, err
	}

	if err := CreateAuditLog(cr.ID, "ACTIVATED", string(oldStatus), string(cr.Status), req.Operator, "Change request activated and effective"); err != nil {
		return nil, err
	}

	return &cr, nil
}

func RollbackChangeRequest(req *RollbackChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", req.ChangeRequestID, req.ChangeRequestID).First(&cr).Error; err != nil {
		return nil, errors.New("change request not found")
	}

	if cr.Status != models.StatusActive {
		return nil, fmt.Errorf("cannot rollback change request with status: %s (must be ACTIVE)", cr.Status)
	}

	oldStatus := cr.Status
	cr.Status = models.StatusRolledBack
	cr.RollbackReason = req.Reason

	if err := db.Save(&cr).Error; err != nil {
		return nil, err
	}

	var er models.EffectiveResult
	if err := db.Where("change_request_id = ?", cr.ID).First(&er).Error; err == nil {
		er.Status = models.StatusRolledBack
		now := time.Now()
		er.ExpiredAt = &now
		db.Save(&er)
	}

	rollbackRecord := models.RollbackRecord{
		ChangeRequestID: cr.ID,
		RollbackType:    "MANUAL",
		PreviousValue:   cr.NewValue,
		RolledBackValue: cr.OldValue,
		RolledBackBy:    req.Operator,
		RollbackReason:  req.Reason,
		IsAutomatic:     false,
		RolledBackAt:    time.Now(),
	}
	if err := db.Create(&rollbackRecord).Error; err != nil {
		return nil, err
	}

	if err := CreateAuditLog(cr.ID, "ROLLED_BACK", string(oldStatus), string(cr.Status), req.Operator, req.Reason); err != nil {
		return nil, err
	}

	return &cr, nil
}

func RejectChangeRequest(req *RejectChangeRequestRequest) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", req.ChangeRequestID, req.ChangeRequestID).First(&cr).Error; err != nil {
		return nil, errors.New("change request not found")
	}

	if cr.Status == models.StatusActive || cr.Status == models.StatusRolledBack {
		return nil, fmt.Errorf("cannot reject change request with status: %s", cr.Status)
	}

	oldStatus := cr.Status
	cr.Status = models.StatusRejected
	cr.RejectionReason = req.Reason

	if err := db.Save(&cr).Error; err != nil {
		return nil, err
	}

	if err := CreateAuditLog(cr.ID, "REJECTED", string(oldStatus), string(cr.Status), req.Rejector, req.Reason); err != nil {
		return nil, err
	}

	return &cr, nil
}

func CheckAndExecuteAutoRollback() error {
	db := database.GetDB()
	now := time.Now()

	var crs []models.ChangeRequest
	if err := db.Where("status = ? AND auto_rollback_at <= ?", models.StatusActive, now).Find(&crs).Error; err != nil {
		return err
	}

	for _, cr := range crs {
		oldStatus := cr.Status
		cr.Status = models.StatusRolledBack
		cr.RollbackReason = "Automatic rollback triggered after timeout"

		if err := db.Save(&cr).Error; err != nil {
			continue
		}

		var er models.EffectiveResult
		if err := db.Where("change_request_id = ?", cr.ID).First(&er).Error; err == nil {
			er.Status = models.StatusRolledBack
			er.ExpiredAt = &now
			db.Save(&er)
		}

		rollbackRecord := models.RollbackRecord{
			ChangeRequestID: cr.ID,
			RollbackType:    "AUTO",
			PreviousValue:   cr.NewValue,
			RolledBackValue: cr.OldValue,
			RolledBackBy:    "SYSTEM",
			RollbackReason:  "Automatic rollback after timeout",
			IsAutomatic:     true,
			RolledBackAt:    now,
		}
		db.Create(&rollbackRecord)

		CreateAuditLog(cr.ID, "AUTO_ROLLED_BACK", string(oldStatus), string(cr.Status), "SYSTEM", "Automatic rollback")
	}

	return nil
}

func CreateAuditLog(changeRequestID, action, oldStatus, newStatus, performedBy, details string) error {
	db := database.GetDB()

	auditLog := models.AuditLog{
		ChangeRequestID: changeRequestID,
		Action:          action,
		OldStatus:       oldStatus,
		NewStatus:       newStatus,
		PerformedBy:     performedBy,
		Details:         details,
	}

	return db.Create(&auditLog).Error
}

func GetChangeRequest(id string) (*models.ChangeRequest, error) {
	db := database.GetDB()

	var cr models.ChangeRequest
	if err := db.Where("id = ? OR request_id = ?", id, id).First(&cr).Error; err != nil {
		return nil, err
	}

	return &cr, nil
}

func ListChangeRequests(serviceName, paramKey, status string, page, pageSize int) ([]models.ChangeRequest, int64, error) {
	db := database.GetDB()

	query := db.Model(&models.ChangeRequest{})

	if serviceName != "" {
		query = query.Where("service_name = ?", serviceName)
	}
	if paramKey != "" {
		query = query.Where("param_key = ?", paramKey)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var crs []models.ChangeRequest
	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&crs).Error; err != nil {
		return nil, 0, err
	}

	return crs, total, nil
}

func GetAuditLogs(changeRequestID string) ([]models.AuditLog, error) {
	db := database.GetDB()

	var logs []models.AuditLog
	if err := db.Where("change_request_id = ?", changeRequestID).Order("created_at DESC").Find(&logs).Error; err != nil {
		return nil, err
	}

	return logs, nil
}

func GetRollbackRecords(changeRequestID string) ([]models.RollbackRecord, error) {
	db := database.GetDB()

	var records []models.RollbackRecord
	if err := db.Where("change_request_id = ?", changeRequestID).Order("created_at DESC").Find(&records).Error; err != nil {
		return nil, err
	}

	return records, nil
}

func CreateParameterItem(serviceName, paramKey, paramType, description string) (*models.ParameterItem, error) {
	db := database.GetDB()

	paramItem := models.ParameterItem{
		ServiceName: serviceName,
		ParamKey:    paramKey,
		ParamType:   paramType,
		Description: description,
	}

	if err := db.Create(&paramItem).Error; err != nil {
		return nil, err
	}

	return &paramItem, nil
}

func CreateAllowedRange(parameterItemID, minValue, maxValue, enumValues, pattern string) (*models.AllowedRange, error) {
	db := database.GetDB()

	allowedRange := models.AllowedRange{
		ParameterItemID: parameterItemID,
		MinValue:        minValue,
		MaxValue:        maxValue,
		EnumValues:      enumValues,
		Pattern:         pattern,
	}

	if err := db.Create(&allowedRange).Error; err != nil {
		return nil, err
	}

	return &allowedRange, nil
}

func CreateCallingService(serviceName, description string) (*models.CallingService, error) {
	db := database.GetDB()

	callingService := models.CallingService{
		ServiceName: serviceName,
		Description: description,
	}

	if err := db.Create(&callingService).Error; err != nil {
		return nil, err
	}

	return &callingService, nil
}

func GetEffectiveResults(serviceName, paramKey string) ([]models.EffectiveResult, error) {
	db := database.GetDB()

	query := db.Model(&models.EffectiveResult{})

	if serviceName != "" {
		query = query.Where("service_name = ?", serviceName)
	}
	if paramKey != "" {
		query = query.Where("param_key = ?", paramKey)
	}

	var results []models.EffectiveResult
	if err := query.Order("effective_at DESC").Find(&results).Error; err != nil {
		return nil, err
	}

	return results, nil
}
