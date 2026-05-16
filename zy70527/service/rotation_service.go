package service

import (
	"cert-rotation/model"
	"cert-rotation/repository"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"runtime/debug"
	"time"
)

type RotationService struct {
	repo *repository.RotationRepository
}

func NewRotationService() *RotationService {
	return &RotationService{
		repo: repository.NewRotationRepository(),
	}
}

type CreateRotationRequest struct {
	TenantID        string    `json:"tenant_id" binding:"required"`
	OldCertContent string    `json:"old_cert_content" binding:"required"`
	NewCertContent string    `json:"new_cert_content" binding:"required"`
	WindowStartTime time.Time `json:"window_start_time" binding:"required"`
	WindowEndTime   time.Time `json:"window_end_time" binding:"required"`
}

func (s *RotationService) CreateRotation(req *CreateRotationRequest) (*model.CertificateRotation, error) {
	if req.WindowEndTime.Before(req.WindowStartTime) {
		return nil, errors.New("window end time must be after start time")
	}

	oldFingerprint := calculateFingerprint(req.OldCertContent)
	newFingerprint := calculateFingerprint(req.NewCertContent)

	existing, err := s.repo.GetActiveRotationByTenantAndCerts(req.TenantID, oldFingerprint, newFingerprint)
	if err == nil && existing != nil {
		return nil, fmt.Errorf("active rotation already exists for this certificate pair: %s", existing.ID)
	}

	rotation := &model.CertificateRotation{
		TenantID:          req.TenantID,
		OldCertFingerprint: oldFingerprint,
		OldCertContent:    req.OldCertContent,
		NewCertFingerprint: newFingerprint,
		NewCertContent:    req.NewCertContent,
		WindowStartTime:   req.WindowStartTime,
		WindowEndTime:     req.WindowEndTime,
		Status:            model.StatusCreated,
		ParallelEnabled:   false,
	}

	if err := s.repo.CreateRotation(rotation); err != nil {
		return nil, err
	}

	return rotation, nil
}

func (s *RotationService) GetRotation(id string) (*model.CertificateRotation, error) {
	return s.repo.GetRotationByID(id)
}

func (s *RotationService) ListRotations(tenantID string, page, pageSize int) ([]model.CertificateRotation, int64, error) {
	if tenantID != "" {
		return s.repo.GetRotationsByTenant(tenantID, page, pageSize)
	}
	return s.repo.GetAllRotations(page, pageSize)
}

func (s *RotationService) StartParallelValidation(rotationID string) error {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return err
	}

	if rotation.Status != model.StatusCreated {
		return fmt.Errorf("invalid status transition: current status %s, expected CREATED", rotation.Status)
	}

	now := time.Now()
	if now.Before(rotation.WindowStartTime) {
		return errors.New("cannot start validation before window start time")
	}
	if now.After(rotation.WindowEndTime) {
		return errors.New("cannot start validation after window end time")
	}

	rotation.ParallelEnabled = true
	rotation.Status = model.StatusParallel
	return s.repo.UpdateRotation(rotation)
}

func (s *RotationService) RecordValidationSample(rotationID, certUsed, endpoint, sourceIP, userAgent, rawRequest string, success bool, errorMsg string) error {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return err
	}

	if !rotation.ParallelEnabled {
		return errors.New("parallel validation is not enabled")
	}

	fingerprint := rotation.OldCertFingerprint
	if certUsed == "NEW" {
		fingerprint = rotation.NewCertFingerprint
	}

	validationRule := fmt.Sprintf("window_check:%s-%s", rotation.WindowStartTime.Format(time.RFC3339), rotation.WindowEndTime.Format(time.RFC3339))

	sample := &model.ValidationSample{
		RotationID:      rotationID,
		Timestamp:       time.Now(),
		CertUsed:        certUsed,
		CertFingerprint: fingerprint,
		Endpoint:        endpoint,
		Success:         success,
		SourceIP:        sourceIP,
		UserAgent:       userAgent,
		RawRequest:      rawRequest,
		ValidationRule:  validationRule,
		ErrorMessage:    errorMsg,
	}

	return s.repo.AddValidationSample(sample)
}

func (s *RotationService) AdvanceStatus(rotationID string, targetStatus model.RotationStatus) error {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return err
	}

	if !isValidStatusTransition(rotation.Status, targetStatus) {
		return fmt.Errorf("invalid status transition from %s to %s", rotation.Status, targetStatus)
	}

	if targetStatus == model.StatusValidating {
		oldCount, newCount, oldSuccess, newSuccess, err := s.repo.GetValidationStats(rotationID)
		if err != nil {
			return err
		}
		if oldCount == 0 || newCount == 0 {
			return errors.New("insufficient validation samples for both certificates")
		}

		oldRate := float64(oldSuccess) / float64(oldCount)
		newRate := float64(newSuccess) / float64(newCount)
		if oldRate < 0.95 || newRate < 0.95 {
			return fmt.Errorf("success rate too low: old=%.2f%%, new=%.2f%% (required >=95%%)", oldRate*100, newRate*100)
		}
	}

	return s.repo.UpdateRotationStatus(rotationID, targetStatus)
}

func (s *RotationService) HandleException(rotationID, errorMsg, originalInput string) error {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return err
	}

	rulesJSON, _ := json.Marshal(map[string]interface{}{
		"current_status": rotation.Status,
		"window_start":   rotation.WindowStartTime,
		"window_end":     rotation.WindowEndTime,
	})

	failedRecord := &model.FailedRecord{
		RotationID:      rotationID,
		OriginalInput:   originalInput,
		ProcessingRules: string(rulesJSON),
		FinalConclusion: "EXCEPTION_HANDLING_REQUIRED",
		ErrorMessage:    errorMsg,
		StackTrace:      string(debug.Stack()),
	}

	if err := s.repo.CreateFailedRecord(failedRecord); err != nil {
		return err
	}

	return s.repo.UpdateRotationStatus(rotationID, model.StatusManualFix)
}

type ManualFixRequest struct {
	RotationID string `json:"rotation_id" binding:"required"`
	FixNotes   string `json:"fix_notes" binding:"required"`
	FixedBy    string `json:"fixed_by" binding:"required"`
	NewStatus  string `json:"new_status"`
}

func (s *RotationService) ApplyManualFix(req *ManualFixRequest) error {
	rotation, err := s.repo.GetRotationByID(req.RotationID)
	if err != nil {
		return err
	}

	if rotation.Status != model.StatusManualFix {
		return errors.New("rotation is not in manual fix status")
	}

	failedRecords, err := s.repo.GetFailedRecords(req.RotationID)
	if err != nil {
		return err
	}

	for _, record := range failedRecords {
		if record.FixedAt == nil {
			if err := s.repo.UpdateFailedRecord(record.ID, req.FixedBy, req.FixNotes); err != nil {
				return err
			}
		}
	}

	newStatus := model.StatusCreated
	if req.NewStatus != "" {
		newStatus = model.RotationStatus(req.NewStatus)
	}

	return s.repo.UpdateRotationStatus(req.RotationID, newStatus)
}

func (s *RotationService) GenerateReport(rotationID, createdBy string) (*model.RotationReport, error) {
	oldCount, newCount, oldSuccess, newSuccess, err := s.repo.GetValidationStats(rotationID)
	if err != nil {
		return nil, err
	}

	var oldRate, newRate float64
	if oldCount > 0 {
		oldRate = float64(oldSuccess) / float64(oldCount)
	}
	if newCount > 0 {
		newRate = float64(newSuccess) / float64(newCount)
	}

	conclusion := "IN_PROGRESS"
	recommendation := "Continue monitoring"
	
	if oldRate >= 0.99 && newRate >= 0.99 && newCount >= 100 {
		conclusion = "SUCCESS"
		recommendation = "Ready for switch"
	} else if newRate < 0.90 && newCount >= 50 {
		conclusion = "ISSUE_DETECTED"
		recommendation = "Investigate new certificate failures"
	}

	rawData, _ := json.Marshal(map[string]interface{}{
		"old_count":     oldCount,
		"new_count":     newCount,
		"old_success":   oldSuccess,
		"new_success":   newSuccess,
	})

	report := &model.RotationReport{
		RotationID:         rotationID,
		OldCertSuccessRate: oldRate,
		NewCertSuccessRate: newRate,
		TotalOldSamples:    int(oldCount),
		TotalNewSamples:    int(newCount),
		Conclusion:         conclusion,
		Recommendation:     recommendation,
		RawData:            string(rawData),
		CreatedBy:          createdBy,
	}

	if err := s.repo.CreateReport(report); err != nil {
		return nil, err
	}

	return report, nil
}

func (s *RotationService) ExportReport(rotationID string) (string, error) {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return "", err
	}

	reports, err := s.repo.GetReportsByRotation(rotationID)
	if err != nil {
		return "", err
	}

	samples, _, err := s.repo.GetValidationSamples(rotationID, 1, 1000)
	if err != nil {
		return "", err
	}

	failedRecords, err := s.repo.GetFailedRecords(rotationID)
	if err != nil {
		return "", err
	}

	exportData := map[string]interface{}{
		"rotation_id":     rotation.ID,
		"tenant_id":       rotation.TenantID,
		"status":          rotation.Status,
		"window": map[string]string{
			"start": rotation.WindowStartTime.Format(time.RFC3339),
			"end":   rotation.WindowEndTime.Format(time.RFC3339),
		},
		"certificates": map[string]string{
			"old_fingerprint": rotation.OldCertFingerprint,
			"new_fingerprint": rotation.NewCertFingerprint,
		},
		"reports":        reports,
		"sample_count":   len(samples),
		"failed_records": failedRecords,
		"exported_at":    time.Now().Format(time.RFC3339),
	}

	content, err := json.MarshalIndent(exportData, "", "  ")
	if err != nil {
		return "", err
	}

	if len(reports) > 0 {
		reports[0].ExportedContent = string(content)
		s.repo.UpdateRotation(rotation)
	}

	return string(content), nil
}

func (s *RotationService) CompleteSwitch(rotationID string) (*model.SwitchReceipt, error) {
	rotation, err := s.repo.GetRotationByID(rotationID)
	if err != nil {
		return nil, err
	}

	if rotation.Status != model.StatusSwitching {
		return nil, errors.New("rotation must be in SWITCHING status")
	}

	oldCount, newCount, oldSuccess, newSuccess, err := s.repo.GetValidationStats(rotationID)
	if err != nil {
		return nil, err
	}

	successRate := 0.0
	if oldCount+newCount > 0 {
		successRate = float64(oldSuccess+newSuccess) / float64(oldCount+newCount)
	}

	receipt := &model.SwitchReceipt{
		RotationID:   rotationID,
		TenantID:     rotation.TenantID,
		SwitchTime:   time.Now(),
		OldCertCount: int(oldCount),
		NewCertCount: int(newCount),
		SuccessRate:  successRate,
		Acknowledged: false,
	}

	if err := s.repo.CreateSwitchReceipt(receipt); err != nil {
		return nil, err
	}

	now := time.Now()
	rotation.CompletedAt = &now
	rotation.Status = model.StatusCompleted
	if err := s.repo.UpdateRotation(rotation); err != nil {
		return nil, err
	}

	return receipt, nil
}

func (s *RotationService) GetValidationSamples(rotationID string, page, pageSize int) ([]model.ValidationSample, int64, error) {
	return s.repo.GetValidationSamples(rotationID, page, pageSize)
}

func (s *RotationService) GetReports(rotationID string) ([]model.RotationReport, error) {
	return s.repo.GetReportsByRotation(rotationID)
}

func calculateFingerprint(content string) string {
	hash := sha256.Sum256([]byte(content))
	return hex.EncodeToString(hash[:])
}

func isValidStatusTransition(from, to model.RotationStatus) bool {
	transitions := map[model.RotationStatus][]model.RotationStatus{
		model.StatusCreated:   {model.StatusParallel, model.StatusFailed, model.StatusManualFix},
		model.StatusParallel: {model.StatusValidating, model.StatusFailed, model.StatusManualFix},
		model.StatusValidating: {model.StatusSwitching, model.StatusFailed, model.StatusManualFix},
		model.StatusSwitching:  {model.StatusCompleted, model.StatusFailed, model.StatusManualFix},
		model.StatusManualFix:  {model.StatusCreated, model.StatusParallel, model.StatusValidating, model.StatusSwitching},
	}
	for _, valid := range transitions[from] {
		if valid == to {
			return true
		}
	}
	return false
}
