package service

import (
	"compliance-exemption-api/internal/model"
	"compliance-exemption-api/internal/repository"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"os"
	"path/filepath"
	"time"

	"github.com/google/uuid"
)

type ExemptionService interface {
	CreateExemption(req *model.ExemptionRequest) (*model.Exemption, *model.IdempotentResponse, error)
	GetExemption(id string) (*model.Exemption, error)
	ApproveExemption(id string, req *model.ApprovalRequest) (*model.Exemption, error)
	QueryExemptions(req *model.QueryRequest) (*model.PaginatedResponse, error)
	UploadSample(exemptionID string, file *multipart.FileHeader, uploadedBy string, sampleType string) (*model.Sample, error)
	CheckExpiredExemptions() ([]model.Exemption, error)
	GetStatistics() (*model.StatisticsSummary, error)
	CheckRuleMatch(scriptVersion string, callID string) (*model.Exemption, bool, error)
	CreateQualityReport(req *model.QualityReportRequest) (*model.QualityReport, error)
	GetQualityReportsByExemption(exemptionID string) ([]model.QualityReport, error)
	UpdateQualityReportResult(reportID string, result string, reviewer string) (*model.QualityReport, error)
}

type exemptionService struct {
	exemptionRepo     repository.ExemptionRepository
	sampleRepo        repository.SampleRepository
	approvalLogRepo   repository.ApprovalLogRepository
	operationLogRepo  repository.OperationLogRepository
	qualityReportRepo repository.QualityReportRepository
	uploadPath        string
}

func NewExemptionService(
	exemptionRepo repository.ExemptionRepository,
	sampleRepo repository.SampleRepository,
	approvalLogRepo repository.ApprovalLogRepository,
	operationLogRepo repository.OperationLogRepository,
	qualityReportRepo repository.QualityReportRepository,
	uploadPath string,
) ExemptionService {
	return &exemptionService{
		exemptionRepo:     exemptionRepo,
		sampleRepo:        sampleRepo,
		approvalLogRepo:   approvalLogRepo,
		operationLogRepo:  operationLogRepo,
		qualityReportRepo: qualityReportRepo,
		uploadPath:        uploadPath,
	}
}

func generateIdempotencyKey(req *model.ExemptionRequest) string {
	if req.IdempotencyKey != "" {
		return req.IdempotencyKey
	}
	data := fmt.Sprintf("%s:%s:%s:%s", req.ScriptVersion, req.CallID, req.AgentID, req.ExemptionReason)
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *exemptionService) CreateExemption(req *model.ExemptionRequest) (*model.Exemption, *model.IdempotentResponse, error) {
	idempotencyKey := generateIdempotencyKey(req)

	existing, err := s.exemptionRepo.GetByIdempotencyKey(idempotencyKey)
	if err == nil && existing != nil {
		return nil, &model.IdempotentResponse{
			IsDuplicate:  true,
			ProcessedBy:  existing.SupervisorName,
			ProcessedAt:  existing.ApprovedAt,
			OriginalData: existing,
		}, nil
	}

	exemption := &model.Exemption{
		ScriptVersion:   req.ScriptVersion,
		ScriptContent:   req.ScriptContent,
		CallID:          req.CallID,
		AgentID:         req.AgentID,
		ExemptionReason: req.ExemptionReason,
		ExpireAt:        req.ExpireAt,
		Status:          model.StatusPending,
		CreatedBy:       req.CreatedBy,
		IdempotencyKey:  idempotencyKey,
	}

	if err := s.exemptionRepo.Create(exemption); err != nil {
		return nil, nil, err
	}

	s.logOperation(exemption.ID, req.CreatedBy, req.CreatedByName, "CREATE", "", string(exemption.Status), "创建豁免申请")

	return exemption, nil, nil
}

func (s *exemptionService) GetExemption(id string) (*model.Exemption, error) {
	return s.exemptionRepo.GetByID(id)
}

func (s *exemptionService) ApproveExemption(id string, req *model.ApprovalRequest) (*model.Exemption, error) {
	exemption, err := s.exemptionRepo.GetByID(id)
	if err != nil {
		return nil, err
	}

	if req.Action != model.StatusApproved && req.Action != model.StatusRejected && req.Action != model.StatusRevoked {
		return nil, errors.New("invalid action")
	}

	allApprovals, err := s.approvalLogRepo.GetByExemptionID(id)
	if err != nil {
		return nil, err
	}

	isConflict := false
	conflictedWith := ""
	conflictingActions := make(map[string]string)

	for _, approval := range allApprovals {
		conflictingActions[approval.SupervisorID] = string(approval.Action)
		if approval.Action != req.Action {
			isConflict = true
			if conflictedWith == "" {
				conflictedWith = approval.SupervisorName
			} else {
				conflictedWith += ", " + approval.SupervisorName
			}
		}
	}

	selfApproved := false
	var selfExistingLog *model.ApprovalLog
	for _, approval := range allApprovals {
		if approval.SupervisorID == req.SupervisorID {
			selfApproved = true
			log := approval
			selfExistingLog = &log
			break
		}
	}
	if selfApproved && selfExistingLog.Action != req.Action {
		isConflict = true
	}

	approvalLog := &model.ApprovalLog{
		ExemptionID:    id,
		SupervisorID:   req.SupervisorID,
		SupervisorName: req.SupervisorName,
		Action:         req.Action,
		Comment:        req.Comment,
		IsConflict:     isConflict,
		ConflictedWith: conflictedWith,
	}
	if err := s.approvalLogRepo.Create(approvalLog); err != nil {
		return nil, err
	}

	oldStatus := string(exemption.Status)

	if isConflict {
		exemption.Status = model.StatusConflict
	} else {
		exemption.Status = req.Action
	}
	exemption.SupervisorID = req.SupervisorID
	exemption.SupervisorName = req.SupervisorName
	exemption.ApprovalComment = req.Comment
	now := time.Now()
	exemption.ApprovedAt = &now

	if err := s.exemptionRepo.Update(exemption); err != nil {
		return nil, err
	}

	operationDetail := req.Comment
	if isConflict {
		operationDetail = fmt.Sprintf("[冲突] 与 %s 意见冲突。%s", conflictedWith, req.Comment)
	}
	s.logOperation(id, req.SupervisorID, req.SupervisorName, "APPROVE", oldStatus, string(exemption.Status), operationDetail)

	return exemption, nil
}

func (s *exemptionService) QueryExemptions(req *model.QueryRequest) (*model.PaginatedResponse, error) {
	data, total, err := s.exemptionRepo.Query(req)
	if err != nil {
		return nil, err
	}

	return &model.PaginatedResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Data:     data,
	}, nil
}

func (s *exemptionService) UploadSample(exemptionID string, file *multipart.FileHeader, uploadedBy string, sampleType string) (*model.Sample, error) {
	_, err := s.exemptionRepo.GetByID(exemptionID)
	if err != nil {
		return nil, err
	}

	if err := os.MkdirAll(s.uploadPath, 0755); err != nil {
		return nil, err
	}

	ext := filepath.Ext(file.Filename)
	newFileName := fmt.Sprintf("%s_%s%s", uuid.NewString()[:8], file.Filename, ext)
	storagePath := filepath.Join(s.uploadPath, newFileName)

	src, err := file.Open()
	if err != nil {
		return nil, err
	}
	defer src.Close()

	dst, err := os.Create(storagePath)
	if err != nil {
		return nil, err
	}
	defer dst.Close()

	hash := sha256.New()
	tee := io.TeeReader(src, hash)

	fileSize, err := io.Copy(dst, tee)
	if err != nil {
		return nil, err
	}

	fileHash := hex.EncodeToString(hash.Sum(nil))

	sample := &model.Sample{
		ExemptionID: exemptionID,
		SampleType:  sampleType,
		FileName:    file.Filename,
		FileSize:    fileSize,
		FileHash:    fileHash,
		StoragePath: storagePath,
		UploadedBy:  uploadedBy,
	}

	if err := s.sampleRepo.Create(sample); err != nil {
		return nil, err
	}

	s.logOperation(exemptionID, uploadedBy, uploadedBy, "UPLOAD_SAMPLE", "", "", fmt.Sprintf("上传样本: %s", file.Filename))

	return sample, nil
}

func (s *exemptionService) CheckExpiredExemptions() ([]model.Exemption, error) {
	now := time.Now()
	expiredList, err := s.exemptionRepo.GetExpiredApproved(now)
	if err != nil {
		return nil, err
	}

	var updated []model.Exemption
	for _, exemption := range expiredList {
		oldStatus := string(exemption.Status)
		exemption.Status = model.StatusExpired
		if err := s.exemptionRepo.Update(&exemption); err != nil {
			continue
		}
		s.logOperation(exemption.ID, "SYSTEM", "SYSTEM", "EXPIRE", oldStatus, string(model.StatusExpired), "豁免自动到期")
		updated = append(updated, exemption)
	}

	return updated, nil
}

func (s *exemptionService) GetStatistics() (*model.StatisticsSummary, error) {
	return s.exemptionRepo.GetStatistics()
}

func (s *exemptionService) CheckRuleMatch(scriptVersion string, callID string) (*model.Exemption, bool, error) {
	exemptions, err := s.exemptionRepo.GetByScriptVersion(scriptVersion)
	if err != nil {
		return nil, false, err
	}

	for _, ex := range exemptions {
		if ex.Status == model.StatusApproved {
			if ex.ExpireAt != nil && ex.ExpireAt.Before(time.Now()) {
				continue
			}
			if callID != "" && ex.CallID != "" && ex.CallID != callID {
				continue
			}
			return &ex, true, nil
		}
	}

	return nil, false, nil
}

func (s *exemptionService) logOperation(exemptionID, operatorID, operatorName, operation, oldStatus, newStatus, detail string) {
	log := &model.OperationLog{
		ExemptionID:  exemptionID,
		OperatorID:   operatorID,
		OperatorName: operatorName,
		Operation:    operation,
		OldStatus:    oldStatus,
		NewStatus:    newStatus,
		Detail:       detail,
	}
	s.operationLogRepo.Create(log)
}

func (s *exemptionService) CreateQualityReport(req *model.QualityReportRequest) (*model.QualityReport, error) {
	exemption, err := s.exemptionRepo.GetByID(req.ExemptionID)
	if err != nil {
		return nil, err
	}

	report := &model.QualityReport{
		ExemptionID:   req.ExemptionID,
		ReportNo:      req.ReportNo,
		Score:         req.Score,
		InspectorID:   req.InspectorID,
		InspectorName: req.InspectorName,
		CheckItems:    req.CheckItems,
		IssuesFound:   req.IssuesFound,
		Suggestions:   req.Suggestions,
	}

	if err := s.qualityReportRepo.Create(report); err != nil {
		return nil, err
	}

	exemption.QualityReportID = report.ID
	if err := s.exemptionRepo.Update(exemption); err != nil {
		return nil, err
	}

	s.logOperation(req.ExemptionID, req.InspectorID, req.InspectorName, "CREATE_REPORT", "", "", fmt.Sprintf("创建质检报告: %s, 得分: %.2f", req.ReportNo, req.Score))

	return report, nil
}

func (s *exemptionService) GetQualityReportsByExemption(exemptionID string) ([]model.QualityReport, error) {
	return s.qualityReportRepo.GetByExemptionID(exemptionID)
}

func (s *exemptionService) UpdateQualityReportResult(reportID string, result string, reviewer string) (*model.QualityReport, error) {
	report, err := s.qualityReportRepo.GetByID(reportID)
	if err != nil {
		return nil, err
	}

	report.Suggestions = fmt.Sprintf("%s\n复核结果: %s, 复核人: %s", report.Suggestions, result, reviewer)

	if err := s.qualityReportRepo.Update(report); err != nil {
		return nil, err
	}

	s.logOperation(report.ExemptionID, reviewer, reviewer, "REVIEW_REPORT", "", "", fmt.Sprintf("报告 %s 复核完成: %s", report.ReportNo, result))

	return report, nil
}
