package service

import (
	"database/sql"
	"fmt"
	"time"

	"gpu-queue-api/models"
	"gpu-queue-api/storage"
)

type QueueService struct {
	store *storage.SQLiteStore
}

func NewQueueService(store *storage.SQLiteStore) *QueueService {
	return &QueueService{store: store}
}

func (s *QueueService) CreateJob(req *models.CreateJobRequest) (*models.Job, error) {
	existingJob, err := s.store.GetJobByRequestID(req.RequestID)
	if err == nil && existingJob != nil {
		return existingJob, nil
	}
	if err != nil && err != sql.ErrNoRows {
		return nil, err
	}

	gpuRes, err := s.store.GetGPUResource(req.GPUModel)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("unsupported GPU model: %s", req.GPUModel)
		}
		return nil, err
	}

	job := &models.Job{
		Name:        req.Name,
		GPUModel:    req.GPUModel,
		GPUCount:    req.GPUCount,
		UserID:      req.UserID,
		Priority:    req.Priority,
		DurationMin: req.DurationMin,
		RequestID:   req.RequestID,
	}

	if gpuRes.UsedCount+req.GPUCount <= gpuRes.TotalCount {
		job.Status = models.StatusRunning
		now := time.Now()
		job.StartedAt = &now

		tx, err := s.store.GetDB().Begin()
		if err != nil {
			return nil, err
		}

		if err := s.store.CreateJob(job); err != nil {
			tx.Rollback()
			return nil, err
		}

		gpuRes.UsedCount += req.GPUCount
		if err := s.store.UpdateGPUResource(gpuRes); err != nil {
			tx.Rollback()
			return nil, err
		}

		tx.Commit()
	} else {
		job.Status = models.StatusQueued

		tx, err := s.store.GetDB().Begin()
		if err != nil {
			return nil, err
		}

		if err := s.store.CreateJob(job); err != nil {
			tx.Rollback()
			return nil, err
		}

		queuedJobs, err := s.store.GetQueuedJobs(req.GPUModel)
		if err != nil {
			tx.Rollback()
			return nil, err
		}

		position := len(queuedJobs) + 1
		queueRecord := &models.QueueRecord{
			JobID:       job.ID,
			Position:    position,
			QueueStatus: "queued",
		}
		if err := s.store.CreateQueueRecord(queueRecord); err != nil {
			tx.Rollback()
			return nil, err
		}

		tx.Commit()
	}

	return job, nil
}

func (s *QueueService) GetJob(id string) (*models.Job, error) {
	return s.store.GetJobByID(id)
}

func (s *QueueService) ListJobs(status, gpuModel string, offset, limit int) (*models.JobListResponse, error) {
	jobs, total, err := s.store.ListJobs(status, gpuModel, offset, limit)
	if err != nil {
		return nil, err
	}
	return &models.JobListResponse{Total: total, Jobs: jobs}, nil
}

func (s *QueueService) UpdateJobStatus(jobID string, req *models.UpdateJobStatusRequest) (*models.Job, error) {
	job, err := s.store.GetJobByID(jobID)
	if err != nil {
		return nil, err
	}

	if job.Status == req.Status {
		return job, nil
	}

	oldStatus := job.Status
	job.Status = req.Status

	tx, err := s.store.GetDB().Begin()
	if err != nil {
		return nil, err
	}

	if req.Status == models.StatusRunning && oldStatus != models.StatusRunning {
		now := time.Now()
		job.StartedAt = &now

		gpuRes, err := s.store.GetGPUResource(job.GPUModel)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		gpuRes.UsedCount += job.GPUCount
		if err := s.store.UpdateGPUResource(gpuRes); err != nil {
			tx.Rollback()
			return nil, err
		}

		queueRecord, err := s.store.GetQueueRecordByJobID(jobID)
		if err == nil && queueRecord != nil {
			now := time.Now()
			queueRecord.QueueStatus = "dequeued"
			queueRecord.DequeuedAt = &now
			if err := s.store.UpdateQueueRecord(queueRecord); err != nil {
				tx.Rollback()
				return nil, err
			}
		}
	}

	if (req.Status == models.StatusCompleted || req.Status == models.StatusFailed ||
		req.Status == models.StatusCancelled || req.Status == models.StatusTimeout) &&
		oldStatus == models.StatusRunning {

		now := time.Now()
		job.EndedAt = &now

		gpuRes, err := s.store.GetGPUResource(job.GPUModel)
		if err != nil {
			tx.Rollback()
			return nil, err
		}
		gpuRes.UsedCount -= job.GPUCount
		if gpuRes.UsedCount < 0 {
			gpuRes.UsedCount = 0
		}
		if err := s.store.UpdateGPUResource(gpuRes); err != nil {
			tx.Rollback()
			return nil, err
		}

		releaseEvent := &models.ReleaseEvent{
			JobID:       job.ID,
			GPUModel:    job.GPUModel,
			GPUCount:    job.GPUCount,
			ReleaseType: string(req.Status),
			Remark:      req.Remark,
		}
		if err := s.store.CreateReleaseEvent(releaseEvent); err != nil {
			tx.Rollback()
			return nil, err
		}

		if err := s.tryProcessQueue(job.GPUModel); err != nil {
			fmt.Printf("Warning: failed to process queue: %v\n", err)
		}
	}

	if err := s.store.UpdateJob(job); err != nil {
		tx.Rollback()
		return nil, err
	}

	tx.Commit()
	return job, nil
}

func (s *QueueService) tryProcessQueue(gpuModel string) error {
	gpuRes, err := s.store.GetGPUResource(gpuModel)
	if err != nil {
		return err
	}

	available := gpuRes.TotalCount - gpuRes.UsedCount
	if available <= 0 {
		return nil
	}

	queuedJobs, err := s.store.GetQueuedJobs(gpuModel)
	if err != nil {
		return err
	}

	for _, job := range queuedJobs {
		if job.GPUCount <= available {
			job.Status = models.StatusRunning
			now := time.Now()
			job.StartedAt = &now

			if err := s.store.UpdateJob(&job); err != nil {
				continue
			}

			gpuRes.UsedCount += job.GPUCount
			if err := s.store.UpdateGPUResource(gpuRes); err != nil {
				continue
			}

			queueRecord, err := s.store.GetQueueRecordByJobID(job.ID)
			if err == nil {
				now := time.Now()
				queueRecord.QueueStatus = "dequeued"
				queueRecord.DequeuedAt = &now
				s.store.UpdateQueueRecord(queueRecord)
			}

			available -= job.GPUCount
			if available <= 0 {
				break
			}
		}
	}

	return nil
}

func (s *QueueService) ManualCorrection(req *models.ManualCorrectionRequest) ([]models.GPUResource, error) {
	if req.GPUModel != "" {
		gpuRes, err := s.store.GetGPUResource(req.GPUModel)
		if err != nil {
			return nil, err
		}

		if req.UsedCount != nil {
			gpuRes.UsedCount = *req.UsedCount
		}
		if req.TotalCount != nil {
			gpuRes.TotalCount = *req.TotalCount
		}

		if err := s.store.UpdateGPUResource(gpuRes); err != nil {
			return nil, err
		}

		if err := s.tryProcessQueue(req.GPUModel); err != nil {
			fmt.Printf("Warning: failed to process queue after correction: %v\n", err)
		}
	}

	return s.store.ListGPUResources()
}

func (s *QueueService) CheckTimeoutJobs() error {
	runningJobs, err := s.store.GetRunningJobs()
	if err != nil {
		return err
	}

	now := time.Now()
	for _, job := range runningJobs {
		if job.StartedAt != nil {
			elapsed := now.Sub(*job.StartedAt)
			expectedDuration := time.Duration(job.DurationMin) * time.Minute

			if elapsed > expectedDuration*2 {
				_, err := s.UpdateJobStatus(job.ID, &models.UpdateJobStatusRequest{
					Status: models.StatusTimeout,
					Remark: fmt.Sprintf("Job timed out after %v (expected %v)", elapsed, expectedDuration),
				})
				if err != nil {
					fmt.Printf("Warning: failed to timeout job %s: %v\n", job.ID, err)
				}
			}
		}
	}
	return nil
}

func (s *QueueService) GetQueueSummary() (*models.QueueSummary, error) {
	gpus, err := s.store.ListGPUResources()
	if err != nil {
		return nil, err
	}

	summary := &models.QueueSummary{
		GeneratedAt: time.Now(),
		Items:       make([]models.QueueSummaryItem, 0),
	}

	for _, gpu := range gpus {
		queuedJobs, _ := s.store.GetQueuedJobs(gpu.Model)
		runningJobs, _, _ := s.store.ListJobs(string(models.StatusRunning), gpu.Model, 0, 0)

		item := models.QueueSummaryItem{
			GPUModel:      gpu.Model,
			TotalCapacity: gpu.TotalCount,
			UsedCapacity:  gpu.UsedCount,
			QueuedJobs:    len(queuedJobs),
			RunningJobs:   len(runningJobs),
			AvgWaitTime:   "N/A",
		}
		summary.Items = append(summary.Items, item)
	}

	return summary, nil
}

func (s *QueueService) GetExceptionLogs(requestID string, offset, limit int) (*models.ExceptionLogListResponse, error) {
	logs, total, err := s.store.ListExceptionLogs(requestID, offset, limit)
	if err != nil {
		return nil, err
	}
	return &models.ExceptionLogListResponse{Total: total, Records: logs}, nil
}

func (s *QueueService) LogException(requestID, operation, rawInput, errorType, errorMessage, conclusion string) error {
	log := &models.ExceptionLog{
		RequestID:    requestID,
		Operation:    operation,
		RawInput:     rawInput,
		ErrorType:    errorType,
		ErrorMessage: errorMessage,
		Conclusion:   conclusion,
	}
	return s.store.CreateExceptionLog(log)
}

func (s *QueueService) GetGPUResources() ([]models.GPUResource, error) {
	return s.store.ListGPUResources()
}

func (s *QueueService) GetReleaseEvents(jobID string, limit int) ([]models.ReleaseEvent, error) {
	return s.store.ListReleaseEvents(jobID, limit)
}

func (s *QueueService) ExportQueueReport() (map[string]interface{}, error) {
	summary, err := s.GetQueueSummary()
	if err != nil {
		return nil, err
	}

	jobs, _, err := s.store.ListJobs("", "", 0, 1000)
	if err != nil {
		return nil, err
	}

	_, totalExceptions, err := s.store.ListExceptionLogs("", 0, 0)
	if err != nil {
		return nil, err
	}

	report := map[string]interface{}{
		"generated_at":    summary.GeneratedAt,
		"queue_summary":   summary.Items,
		"total_jobs":      len(jobs),
		"total_exceptions": totalExceptions,
		"jobs":            jobs,
	}

	return report, nil
}
