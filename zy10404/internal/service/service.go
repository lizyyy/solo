package service

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"grayscale-backfill/internal/model"
	"grayscale-backfill/internal/repository"
	"time"

	"github.com/google/uuid"
)

type Service struct {
	repo *repository.Repository
}

func NewService(repo *repository.Repository) *Service {
	return &Service{repo: repo}
}

type CreateBackfillRequest struct {
	BatchID       string                 `json:"batch_id" binding:"required"`
	WindowID      string                 `json:"window_id" binding:"required"`
	Title         string                 `json:"title" binding:"required"`
	Description   string                 `json:"description"`
	Creator       string                 `json:"creator" binding:"required"`
	RawInput      map[string]interface{} `json:"raw_input" binding:"required"`
	AllowOverwrite bool                  `json:"allow_overwrite"`
	GapSegments   []*GapSegmentRequest   `json:"gap_segments"`
	Sources       []*SourceRequest        `json:"sources"`
}

type GapSegmentRequest struct {
	StartTime     time.Time `json:"start_time" binding:"required"`
	EndTime       time.Time `json:"end_time" binding:"required"`
	ExpectedCount int64     `json:"expected_count"`
	ActualCount   int64     `json:"actual_count"`
	GapPercent    float64   `json:"gap_percent"`
}

type SourceRequest struct {
	SourceType     model.SourceType       `json:"source_type" binding:"required"`
	SourceConfig   map[string]interface{} `json:"source_config"`
	ConnectionInfo string                 `json:"connection_info"`
}

func (s *Service) CreateBackfillTask(req *CreateBackfillRequest) (*model.BackfillTask, error) {
	backfillID := generateID("BF")

	dedupeKey := generateDeduplicationKey(req.BatchID, req.WindowID, req.RawInput)

	exists, err := s.repo.CheckDuplicate(dedupeKey)
	if err != nil {
		return nil, fmt.Errorf("check duplicate failed: %w", err)
	}
	if exists {
		existingTask, _ := s.repo.GetBackfillTaskByDedupeKey(dedupeKey)
		return existingTask, errors.New("duplicate backfill task detected")
	}

	window, err := s.repo.GetMetricWindow(req.WindowID)
	if err != nil {
		return nil, fmt.Errorf("metric window not found: %w", err)
	}

	if window.IsReadOnly && !req.AllowOverwrite {
		return nil, errors.New("window is read-only, overwrite not allowed")
	}

	task := &model.BackfillTask{
		BackfillID:       backfillID,
		BatchID:          req.BatchID,
		WindowID:         req.WindowID,
		Status:           model.StatusDraft,
		Title:            req.Title,
		Description:      req.Description,
		Creator:          req.Creator,
		RawInput:         model.JSONB(req.RawInput),
		AllowOverwrite:   req.AllowOverwrite,
		OverwriteProtect: true,
		DeduplicationKey: dedupeKey,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	if err := s.repo.CreateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("create task failed: %w", err)
	}

	for i, gs := range req.GapSegments {
		segment := &model.GapSegment{
			SegmentID:     generateID("GS"),
			BackfillID:    backfillID,
			StartTime:     gs.StartTime,
			EndTime:       gs.EndTime,
			ExpectedCount: gs.ExpectedCount,
			ActualCount:   gs.ActualCount,
			GapPercent:    gs.GapPercent,
			DetectedAt:    time.Now(),
			CreatedAt:     time.Now(),
		}
		_ = i
		if err := s.repo.CreateGapSegment(segment); err != nil {
			_ = err
		}
	}

	for _, src := range req.Sources {
		source := &model.BackfillSource{
			SourceID:       generateID("SRC"),
			BackfillID:     backfillID,
			SourceType:     src.SourceType,
			SourceConfig:   model.JSONB(src.SourceConfig),
			ConnectionInfo: src.ConnectionInfo,
			IsAvailable:    true,
			CreatedAt:      time.Now(),
			UpdatedAt:      time.Now(),
		}
		if err := s.repo.CreateBackfillSource(source); err != nil {
			_ = err
		}
	}

	s.createAuditRecord(backfillID, "", model.StatusDraft, req.Creator, "Task created")

	return task, nil
}

func (s *Service) SubmitForReview(backfillID, operator, comment string) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusDraft {
		return nil, fmt.Errorf("invalid status transition: %s -> %s", task.Status, model.StatusPendingReview)
	}

	if err := s.repo.UpdateBackfillTaskStatus(backfillID, model.StatusDraft, model.StatusPendingReview); err != nil {
		return nil, fmt.Errorf("update status failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusDraft, model.StatusPendingReview, operator, comment)

	return s.repo.GetBackfillTaskByID(backfillID)
}

func (s *Service) ApproveTask(backfillID, operator, comment string) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusPendingReview {
		return nil, fmt.Errorf("invalid status transition: %s -> %s", task.Status, model.StatusApproved)
	}

	if err := s.repo.UpdateBackfillTaskStatus(backfillID, model.StatusPendingReview, model.StatusApproved); err != nil {
		return nil, fmt.Errorf("update status failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusPendingReview, model.StatusApproved, operator, comment)

	return s.repo.GetBackfillTaskByID(backfillID)
}

func (s *Service) RejectTask(backfillID, operator, comment string) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusPendingReview {
		return nil, fmt.Errorf("invalid status transition: %s -> %s", task.Status, model.StatusRejected)
	}

	if err := s.repo.UpdateBackfillTaskStatus(backfillID, model.StatusPendingReview, model.StatusRejected); err != nil {
		return nil, fmt.Errorf("update status failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusPendingReview, model.StatusRejected, operator, comment)

	return s.repo.GetBackfillTaskByID(backfillID)
}

func (s *Service) StartProcessing(backfillID, operator string) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusApproved {
		return nil, fmt.Errorf("invalid status transition: %s -> %s", task.Status, model.StatusProcessing)
	}

	task.Status = model.StatusProcessing
	task.StartTime = time.Now()
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("update status failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusApproved, model.StatusProcessing, operator, "Start processing")

	return task, nil
}

func (s *Service) CompleteTask(backfillID string, successRecords, failedRecords int64, result map[string]interface{}) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusProcessing {
		return nil, fmt.Errorf("invalid status: expected PROCESSING, got %s", task.Status)
	}

	task.Status = model.StatusCompleted
	task.EndTime = time.Now()
	task.SuccessRecords = successRecords
	task.FailedRecords = failedRecords
	task.ProcessedRecords = successRecords + failedRecords
	task.TotalRecords = successRecords + failedRecords
	task.ProcessingResult = model.JSONB(result)
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("update task failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusProcessing, model.StatusCompleted, "system", "Processing completed")

	return task, nil
}

func (s *Service) FailTask(backfillID, failureReason string, errorDetails map[string]interface{}) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusProcessing {
		return nil, fmt.Errorf("invalid status: expected PROCESSING, got %s", task.Status)
	}

	task.Status = model.StatusFailed
	task.EndTime = time.Now()
	task.FailureReason = failureReason
	task.ErrorDetails = model.JSONB(errorDetails)
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("update task failed: %w", err)
	}

	s.createAuditRecord(backfillID, model.StatusProcessing, model.StatusFailed, "system", failureReason)

	return task, nil
}

func (s *Service) CancelTask(backfillID, operator, comment string) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status == model.StatusCompleted || task.Status == model.StatusFailed || task.Status == model.StatusCancelled {
		return nil, fmt.Errorf("cannot cancel task in status: %s", task.Status)
	}

	oldStatus := task.Status
	task.Status = model.StatusCancelled
	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("update task failed: %w", err)
	}

	s.createAuditRecord(backfillID, oldStatus, model.StatusCancelled, operator, comment)

	return task, nil
}

func (s *Service) ManualCorrect(backfillID, operator string, updates map[string]interface{}) (*model.BackfillTask, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, fmt.Errorf("task not found: %w", err)
	}

	if task.Status != model.StatusFailed && task.Status != model.StatusDraft {
		return nil, fmt.Errorf("can only correct tasks in DRAFT or FAILED status")
	}

	if title, ok := updates["title"].(string); ok {
		task.Title = title
	}
	if desc, ok := updates["description"].(string); ok {
		task.Description = desc
	}
	if allow, ok := updates["allow_overwrite"].(bool); ok {
		task.AllowOverwrite = allow
	}

	task.UpdatedAt = time.Now()

	if err := s.repo.UpdateBackfillTask(task); err != nil {
		return nil, fmt.Errorf("update task failed: %w", err)
	}

	s.createAuditRecord(backfillID, task.Status, task.Status, operator, "Manual correction applied")

	return task, nil
}

func (s *Service) CreateSnapshot(backfillID, snapshotType string, content map[string]interface{}, recordCount int64) (*model.ResultSnapshot, error) {
	snapshot := &model.ResultSnapshot{
		SnapshotID:  generateID("SNAP"),
		BackfillID:  backfillID,
		SnapshotType: snapshotType,
		Content:     model.JSONB(content),
		RecordCount: recordCount,
		FileHash:    generateContentHash(content),
		ExportedAt:  time.Now(),
		CreatedAt:   time.Now(),
	}

	if err := s.repo.CreateResultSnapshot(snapshot); err != nil {
		return nil, fmt.Errorf("create snapshot failed: %w", err)
	}

	return snapshot, nil
}

func (s *Service) GetTaskWithDetails(backfillID string) (map[string]interface{}, error) {
	task, err := s.repo.GetBackfillTaskByID(backfillID)
	if err != nil {
		return nil, err
	}

	audits, err := s.repo.ListAuditRecords(backfillID)
	if err != nil {
		audits = []*model.AuditRecord{}
	}

	snapshots, err := s.repo.ListResultSnapshots(backfillID)
	if err != nil {
		snapshots = []*model.ResultSnapshot{}
	}

	gaps, err := s.repo.ListGapSegments(backfillID)
	if err != nil {
		gaps = []*model.GapSegment{}
	}

	sources, err := s.repo.GetBackfillSources(backfillID)
	if err != nil {
		sources = []*model.BackfillSource{}
	}

	return map[string]interface{}{
		"task":      task,
		"audits":    audits,
		"snapshots": snapshots,
		"gaps":      gaps,
		"sources":   sources,
	}, nil
}

func (s *Service) GetExportData(backfillID string) (map[string]interface{}, error) {
	details, err := s.GetTaskWithDetails(backfillID)
	if err != nil {
		return nil, err
	}

	task := details["task"].(*model.BackfillTask)

	exportData := map[string]interface{}{
		"export_time":       time.Now(),
		"backfill_id":       task.BackfillID,
		"batch_id":          task.BatchID,
		"window_id":         task.WindowID,
		"title":             task.Title,
		"status":            task.Status,
		"creator":           task.Creator,
		"created_at":        task.CreatedAt,
		"start_time":        task.StartTime,
		"end_time":          task.EndTime,
		"processed_records": task.ProcessedRecords,
		"success_records":   task.SuccessRecords,
		"failed_records":    task.FailedRecords,
		"total_records":     task.TotalRecords,
		"allow_overwrite":   task.AllowOverwrite,
		"raw_input":         task.RawInput,
		"processing_result": task.ProcessingResult,
		"failure_reason":    task.FailureReason,
		"error_details":     task.ErrorDetails,
		"gaps":              details["gaps"],
		"sources":           details["sources"],
		"audit_trail":       details["audits"],
		"snapshots":         details["snapshots"],
	}

	return exportData, nil
}

func (s *Service) createAuditRecord(backfillID string, fromStatus, toStatus model.BackfillStatus, operator, comment string) {
	record := &model.AuditRecord{
		AuditID:   generateID("AUD"),
		BackfillID: backfillID,
		Operator:   operator,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Comment:    comment,
		AuditTime:  time.Now(),
		CreatedAt:  time.Now(),
	}
	_ = s.repo.CreateAuditRecord(record)
}

func (s *Service) CreateBatch(batchID, batchName, description string) (*model.GrayscaleBatch, error) {
	batch := &model.GrayscaleBatch{
		BatchID:     batchID,
		BatchName:   batchName,
		Description: description,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateGrayscaleBatch(batch); err != nil {
		return nil, err
	}
	return batch, nil
}

func (s *Service) CreateWindow(batchID, windowID string, startTime, endTime time.Time, metricTypes []string, granularity string) (*model.MetricWindow, error) {
	overlap, err := s.repo.CheckWindowOverlap(batchID, startTime, endTime)
	if err != nil {
		return nil, err
	}
	if overlap {
		return nil, errors.New("window overlaps with existing window")
	}

	window := &model.MetricWindow{
		WindowID:    windowID,
		BatchID:     batchID,
		StartTime:   startTime,
		EndTime:     endTime,
		MetricTypes: metricTypes,
		Granularity: granularity,
		IsReadOnly:  false,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	if err := s.repo.CreateMetricWindow(window); err != nil {
		return nil, err
	}
	return window, nil
}

func (s *Service) ListTasks(batchID, status string, offset, limit int) ([]*model.BackfillTask, int64, error) {
	return s.repo.ListBackfillTasks(batchID, status, offset, limit)
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s-%s", prefix, uuid.New().String()[:8])
}

func generateDeduplicationKey(batchID, windowID string, rawInput map[string]interface{}) string {
	inputBytes, _ := json.Marshal(rawInput)
	hash := sha256.Sum256(append([]byte(batchID+windowID), inputBytes...))
	return hex.EncodeToString(hash[:])
}

func generateContentHash(content map[string]interface{}) string {
	bytes, _ := json.Marshal(content)
	hash := sha256.Sum256(bytes)
	return hex.EncodeToString(hash[:])
}
