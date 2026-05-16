package service

import (
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/data-contract-exception-api/models"
	"github.com/data-contract-exception-api/store"
	"os"
	"strings"
	"time"
)

var (
	ErrInvalidStateTransition = errors.New("invalid state transition")
	ErrExceptionNotFound      = errors.New("exception not found")
	ErrExceptionExpired       = errors.New("exception already expired")
)

type Service struct {
	store *store.Store
}

func NewService(s *store.Store) *Service {
	return &Service{store: s}
}

func (s *Service) CreateException(req *models.CreateExceptionRequest) (*models.ExceptionRecord, error) {
	exception := &models.ExceptionRecord{
		ContractID:      req.ContractID,
		FieldPath:       req.FieldPath,
		ExceptionReason: req.ExceptionReason,
		CreatedBy:       req.CreatedBy,
		ExpireDate:      req.ExpireDate,
	}

	err := s.store.CreateException(exception)
	if err != nil {
		s.createAnomaly("", "CREATE_EXCEPTION", marshalJSON(req), "", err.Error())
		return nil, err
	}

	return exception, nil
}

func (s *Service) GetException(id string) (*models.ExceptionRecord, error) {
	return s.store.GetExceptionByID(id)
}

func (s *Service) GetAllExceptions() ([]models.ExceptionRecord, error) {
	return s.store.GetAllExceptions()
}

func (s *Service) ApproveException(id string, approvedBy string) (*models.ExceptionRecord, error) {
	exception, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	if exception.Status != models.StatusPending {
		s.createAnomaly(id, "APPROVE_EXCEPTION",
			fmt.Sprintf("approved_by=%s", approvedBy),
			"", ErrInvalidStateTransition.Error())
		return nil, ErrInvalidStateTransition
	}

	err = s.store.UpdateExceptionStatus(id, models.StatusActive, approvedBy)
	if err != nil {
		s.createAnomaly(id, "APPROVE_EXCEPTION",
			fmt.Sprintf("approved_by=%s", approvedBy),
			"", err.Error())
		return nil, err
	}

	return s.store.GetExceptionByID(id)
}

func (s *Service) RejectException(id string, rejectedBy string) (*models.ExceptionRecord, error) {
	exception, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	if exception.Status != models.StatusPending {
		s.createAnomaly(id, "REJECT_EXCEPTION",
			fmt.Sprintf("rejected_by=%s", rejectedBy),
			"", ErrInvalidStateTransition.Error())
		return nil, ErrInvalidStateTransition
	}

	err = s.store.UpdateExceptionStatus(id, models.StatusRejected, rejectedBy)
	if err != nil {
		s.createAnomaly(id, "REJECT_EXCEPTION",
			fmt.Sprintf("rejected_by=%s", rejectedBy),
			"", err.Error())
		return nil, err
	}

	return s.store.GetExceptionByID(id)
}

func (s *Service) RecordHit(req *models.RecordHitRequest) (*models.HitRecord, error) {
	exceptions, err := s.store.GetExceptionsByFieldPath(req.FieldPath)
	if err != nil {
		s.createAnomaly("", "RECORD_HIT", marshalJSON(req), "", err.Error())
		return nil, err
	}

	if len(exceptions) == 0 {
		return nil, errors.New("no active exception found for field path")
	}

	var targetException *models.ExceptionRecord
	for _, e := range exceptions {
		if e.Status == models.StatusActive {
			now := time.Now()
			if now.After(e.ExpireDate) {
				s.store.UpdateExceptionStatus(e.ID, models.StatusExpired, "")
				continue
			}
			targetException = &e
			break
		}
	}

	if targetException == nil {
		return nil, errors.New("no active and not expired exception found")
	}

	hit := &models.HitRecord{
		ExceptionID:   targetException.ID,
		FieldPath:     req.FieldPath,
		ActualValue:   req.ActualValue,
		ExpectedValue: req.ExpectedValue,
		SourceSystem:  req.SourceSystem,
		RequestID:     req.RequestID,
	}

	err = s.store.RecordHit(hit)
	if err != nil {
		s.createAnomaly(targetException.ID, "RECORD_HIT", marshalJSON(req), "", err.Error())
		return nil, err
	}

	return hit, nil
}

func (s *Service) RequestRecovery(id string, requestedBy string, notes string) (*models.ExceptionRecord, error) {
	exception, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	if exception.Status != models.StatusActive && exception.Status != models.StatusExpired {
		s.createAnomaly(id, "REQUEST_RECOVERY",
			fmt.Sprintf("requested_by=%s,notes=%s", requestedBy, notes),
			"", ErrInvalidStateTransition.Error())
		return nil, ErrInvalidStateTransition
	}

	err = s.store.UpdateExceptionStatus(id, models.StatusRecoveryRequested, "")
	if err != nil {
		s.createAnomaly(id, "REQUEST_RECOVERY",
			fmt.Sprintf("requested_by=%s,notes=%s", requestedBy, notes),
			"", err.Error())
		return nil, err
	}

	return s.store.GetExceptionByID(id)
}

func (s *Service) ApproveRecovery(id string, approvedBy string) (*models.ExceptionRecord, error) {
	exception, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	if exception.Status != models.StatusRecoveryRequested {
		s.createAnomaly(id, "APPROVE_RECOVERY",
			fmt.Sprintf("approved_by=%s", approvedBy),
			"", ErrInvalidStateTransition.Error())
		return nil, ErrInvalidStateTransition
	}

	err = s.store.UpdateExceptionForRecovery(id, models.StatusRecoveryApproved, approvedBy)
	if err != nil {
		s.createAnomaly(id, "APPROVE_RECOVERY",
			fmt.Sprintf("approved_by=%s", approvedBy),
			"", err.Error())
		return nil, err
	}

	return s.store.GetExceptionByID(id)
}

func (s *Service) CompleteRecovery(id string) (*models.ExceptionRecord, error) {
	exception, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	if exception.Status != models.StatusRecoveryApproved {
		s.createAnomaly(id, "COMPLETE_RECOVERY", "", "", ErrInvalidStateTransition.Error())
		return nil, ErrInvalidStateTransition
	}

	err = s.store.UpdateExceptionStatus(id, models.StatusRecovered, "")
	if err != nil {
		s.createAnomaly(id, "COMPLETE_RECOVERY", "", "", err.Error())
		return nil, err
	}

	report := &models.RecoveryReport{
		ExceptionID:     exception.ID,
		TotalHits:       exception.HitCount,
		FieldPath:       exception.FieldPath,
		ExceptionReason: exception.ExceptionReason,
		CreatedBy:       exception.CreatedBy,
		ExpireDate:      exception.ExpireDate,
		ApprovedBy:      exception.RecoveryApprovedBy,
	}
	s.store.CreateRecoveryReport(report)

	return s.store.GetExceptionByID(id)
}

func (s *Service) ManualCorrection(id string, newStatus models.ExceptionStatus, correctedBy string, note string) (*models.ExceptionRecord, error) {
	_, err := s.store.GetExceptionByID(id)
	if err != nil {
		return nil, ErrExceptionNotFound
	}

	err = s.store.ManualUpdateExceptionStatus(id, newStatus)
	if err != nil {
		s.createAnomaly(id, "MANUAL_CORRECTION",
			fmt.Sprintf("new_status=%s,corrected_by=%s,note=%s", newStatus, correctedBy, note),
			"", err.Error())
		return nil, err
	}

	s.createAnomaly(id, "MANUAL_CORRECTION",
		fmt.Sprintf("new_status=%s,corrected_by=%s,note=%s", newStatus, correctedBy, note),
		"Status manually updated", "")

	return s.store.GetExceptionByID(id)
}

func (s *Service) GetHitRecords(exceptionID string) ([]models.HitRecord, error) {
	return s.store.GetHitRecordsByExceptionID(exceptionID)
}

func (s *Service) GetAllAnomalies() ([]models.AnomalyRecord, error) {
	return s.store.GetAllAnomalies()
}

func (s *Service) ResolveAnomaly(id string, handledBy string, notes string) (*models.AnomalyRecord, error) {
	err := s.store.ResolveAnomaly(id, handledBy, notes)
	if err != nil {
		return nil, err
	}
	return s.store.GetAnomalyByID(id)
}

func (s *Service) ExportRecoveryReport(exceptionID string, filePath string) error {
	report, err := s.store.GetRecoveryReportByExceptionID(exceptionID)
	if err != nil {
		return err
	}

	hits, err := s.store.GetHitRecordsByExceptionID(exceptionID)
	if err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"Recovery Report Summary"})
	writer.Write([]string{"Exception ID", report.ExceptionID})
	writer.Write([]string{"Field Path", report.FieldPath})
	writer.Write([]string{"Exception Reason", report.ExceptionReason})
	writer.Write([]string{"Created By", report.CreatedBy})
	writer.Write([]string{"Expire Date", report.ExpireDate.Format(time.RFC3339)})
	writer.Write([]string{"Total Hits", fmt.Sprintf("%d", report.TotalHits)})
	writer.Write([]string{"Approved By", report.ApprovedBy})
	writer.Write([]string{"Generated At", report.GeneratedAt.Format(time.RFC3339)})
	writer.Write([]string{""})

	writer.Write([]string{"Hit Records Detail"})
	writer.Write([]string{"Hit ID", "Timestamp", "Field Path", "Actual Value", "Expected Value", "Source System", "Request ID"})

	for _, hit := range hits {
		writer.Write([]string{
			hit.ID,
			hit.HitTimestamp.Format(time.RFC3339),
			hit.FieldPath,
			hit.ActualValue,
			hit.ExpectedValue,
			hit.SourceSystem,
			hit.RequestID,
		})
	}

	return nil
}

func (s *Service) ExportAllReports(filePath string) error {
	reports, err := s.store.GetAllRecoveryReports()
	if err != nil {
		return err
	}

	file, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"Report ID", "Exception ID", "Field Path", "Total Hits", "Created By", "Expire Date", "Approved By", "Generated At"})

	for _, report := range reports {
		writer.Write([]string{
			report.ID,
			report.ExceptionID,
			report.FieldPath,
			fmt.Sprintf("%d", report.TotalHits),
			report.CreatedBy,
			report.ExpireDate.Format(time.RFC3339),
			report.ApprovedBy,
			report.GeneratedAt.Format(time.RFC3339),
		})
	}

	return nil
}

func (s *Service) CheckAndExpireExceptions() error {
	exceptions, err := s.store.GetExpiredExceptions()
	if err != nil {
		return err
	}

	for _, e := range exceptions {
		err := s.store.UpdateExceptionStatus(e.ID, models.StatusExpired, "")
		if err != nil {
			s.createAnomaly(e.ID, "AUTO_EXPIRE", "", "", err.Error())
			continue
		}
	}

	return nil
}

func (s *Service) createAnomaly(exceptionID string, opType string, rawInput string, result string, errMsg string) {
	anomaly := &models.AnomalyRecord{
		ExceptionID:      exceptionID,
		OperationType:    opType,
		RawInput:         rawInput,
		ProcessingResult: result,
		ErrorMessage:     errMsg,
		IsResolved:       false,
	}
	s.store.CreateAnomalyRecord(anomaly)
}

func (s *Service) CreateSampleData() error {
	contract := &models.DataContract{
		Name:        "用户数据契约 v1.0",
		Description: "定义用户核心数据字段的格式和校验规则",
	}
	err := s.store.CreateContract(contract)
	if err != nil {
		return err
	}

	expireDate1 := time.Now().AddDate(0, 1, 0)
	exception1 := &models.ExceptionRecord{
		ContractID:      contract.ID,
		FieldPath:       "user.profile.email",
		ExceptionReason: "临时允许历史遗留空邮箱数据通过校验",
		CreatedBy:       "admin@example.com",
		ExpireDate:      expireDate1,
		Status:          models.StatusPending,
	}
	err = s.store.CreateException(exception1)
	if err != nil {
		return err
	}

	expireDate2 := time.Now().AddDate(0, 0, 7)
	exception2 := &models.ExceptionRecord{
		ContractID:      contract.ID,
		FieldPath:       "user.payment.card_number",
		ExceptionReason: "上游系统改造期间允许部分脱敏卡号通过",
		CreatedBy:       "dev@example.com",
		ApprovedBy:      "admin@example.com",
		ExpireDate:      expireDate2,
		Status:          models.StatusActive,
	}
	err = s.store.CreateException(exception2)
	if err != nil {
		return err
	}

	expireDate3 := time.Now().AddDate(-1, 0, 0)
	exception3 := &models.ExceptionRecord{
		ContractID:      contract.ID,
		FieldPath:       "user.address.postal_code",
		ExceptionReason: "邮编格式临时放宽（已过期）",
		CreatedBy:       "qa@example.com",
		ApprovedBy:      "admin@example.com",
		ExpireDate:      expireDate3,
		Status:          models.StatusExpired,
	}
	err = s.store.CreateException(exception3)
	if err != nil {
		return err
	}

	return nil
}

func marshalJSON(v interface{}) string {
	data, err := json.Marshal(v)
	if err != nil {
		return fmt.Sprintf("%+v", v)
	}
	return string(data)
}

func MatchFieldPath(pattern, actual string) bool {
	patternParts := strings.Split(pattern, ".")
	actualParts := strings.Split(actual, ".")

	if len(patternParts) != len(actualParts) {
		return false
	}

	for i := range patternParts {
		if patternParts[i] != "*" && patternParts[i] != actualParts[i] {
			return false
		}
	}

	return true
}
