package service

import (
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"lease-api/model"
	"lease-api/repository"
	"time"
)

var (
	ErrTaskNotFound           = errors.New("task not found")
	ErrTaskAlreadyCompleted   = errors.New("task already completed")
	ErrLeaseAlreadyHeld       = errors.New("task already leased by another holder")
	ErrLeaseExpired           = errors.New("lease has expired")
	ErrInvalidLeaseHolder     = errors.New("invalid lease holder")
	ErrResultAlreadySubmitted = errors.New("result already submitted for this task")
	ErrNoActiveLease          = errors.New("no active lease for this task")
	ErrMaxRetriesExceeded     = errors.New("max retries exceeded")
)

type LeaseService struct {
	repo     *repository.Repository
	timeline *TimelineService
}

func NewLeaseService(repo *repository.Repository, timeline *TimelineService) *LeaseService {
	return &LeaseService{repo: repo, timeline: timeline}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *LeaseService) CreateTask(name, payload string, priority, leaseTimeout, maxRetries int) (*model.Task, error) {
	now := time.Now().UTC()
	task := &model.Task{
		ID:           generateID(),
		Name:         name,
		Payload:      payload,
		Status:       model.TaskStatusPending,
		Priority:     priority,
		CreatedAt:    now,
		UpdatedAt:    now,
		MaxRetries:   maxRetries,
		RetryCount:   0,
		LeaseTimeout: leaseTimeout,
	}
	if err := s.repo.CreateTask(task); err != nil {
		return nil, err
	}
	s.timeline.RecordEvent(task.ID, "", "TASK_CREATED", "", fmt.Sprintf("Task created: %s", name), "")
	return task, nil
}

func (s *LeaseService) GetTask(taskID string) (*model.Task, error) {
	return s.repo.GetTask(taskID)
}

func (s *LeaseService) ListTasks(status *model.TaskStatus) ([]model.Task, error) {
	return s.repo.ListTasks(status)
}

func (s *LeaseService) AcquireLease(taskID, holderID, holderName string) (*model.Lease, error) {
	task, err := s.repo.GetTask(taskID)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, ErrTaskNotFound
		}
		return nil, err
	}

	if task.Status == model.TaskStatusCompleted {
		return nil, ErrTaskAlreadyCompleted
	}

	hasResult, err := s.repo.HasExecutionResult(taskID)
	if err != nil {
		return nil, err
	}
	if hasResult {
		s.timeline.RecordEvent(taskID, "", "DUPLICATE_ATTEMPT", holderID, "Attempt to acquire lease on completed task", "")
		return nil, ErrResultAlreadySubmitted
	}

	activeLease, err := s.repo.GetActiveLease(taskID)
	if err != nil {
		return nil, err
	}

	now := time.Now().UTC()

	if activeLease != nil {
		if now.Before(activeLease.ExpiresAt) {
			if activeLease.HolderID == holderID {
				return activeLease, nil
			}
			s.timeline.RecordEvent(taskID, activeLease.ID, "ACQUIRE_DENIED", holderID,
				fmt.Sprintf("Lease held by %s, expires at %v", activeLease.HolderID, activeLease.ExpiresAt), "")
			return nil, ErrLeaseAlreadyHeld
		}

		releaseRecord := &model.ReleaseRecord{
			ID:          generateID(),
			TaskID:      taskID,
			LeaseID:     activeLease.ID,
			HolderID:    activeLease.HolderID,
			ReleasedAt:  now,
			ReleaseType: "PREEMPTION",
			Reason:      "Lease timeout",
			PreemptedBy: holderID,
		}
		if err := s.repo.CreateReleaseRecord(releaseRecord); err != nil {
			return nil, err
		}
		if err := s.repo.DeactivateLease(activeLease.ID); err != nil {
			return nil, err
		}
		s.timeline.RecordEvent(taskID, activeLease.ID, "LEASE_PREEMPTED", activeLease.HolderID,
			fmt.Sprintf("Lease preempted by %s due to timeout", holderID),
			fmt.Sprintf("Original expires: %v, Preempt time: %v", activeLease.ExpiresAt, now))
	}

	leaseTimeout := time.Duration(task.LeaseTimeout) * time.Second
	lease := &model.Lease{
		ID:         generateID(),
		TaskID:     taskID,
		HolderID:   holderID,
		HolderName: holderName,
		AcquiredAt: now,
		ExpiresAt:  now.Add(leaseTimeout),
		RenewCount: 0,
		IsActive:   true,
	}

	if err := s.repo.CreateLease(lease); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateTaskStatus(taskID, model.TaskStatusLeased); err != nil {
		return nil, err
	}

	s.timeline.RecordEvent(taskID, lease.ID, "LEASE_ACQUIRED", holderID,
		fmt.Sprintf("Lease acquired by %s", holderName),
		fmt.Sprintf("Expires at: %v, Timeout: %ds", lease.ExpiresAt, task.LeaseTimeout))

	return lease, nil
}

func (s *LeaseService) RenewLease(leaseID, holderID string) (*model.Lease, error) {
	lease, err := s.getLeaseByID(leaseID)
	if err != nil {
		return nil, err
	}

	if !lease.IsActive {
		return nil, ErrNoActiveLease
	}

	if lease.HolderID != holderID {
		s.timeline.RecordEvent(lease.TaskID, leaseID, "RENEW_DENIED", holderID,
			"Renew attempt by wrong holder", fmt.Sprintf("Expected holder: %s", lease.HolderID))
		return nil, ErrInvalidLeaseHolder
	}

	now := time.Now().UTC()
	if now.After(lease.ExpiresAt) {
		s.timeline.RecordEvent(lease.TaskID, leaseID, "RENEW_FAILED", holderID,
			"Lease already expired", fmt.Sprintf("Expired at: %v", lease.ExpiresAt))
		return nil, ErrLeaseExpired
	}

	task, err := s.repo.GetTask(lease.TaskID)
	if err != nil {
		return nil, err
	}

	leaseTimeout := time.Duration(task.LeaseTimeout) * time.Second
	newExpiresAt := now.Add(leaseTimeout)

	if err := s.repo.RenewLease(leaseID, newExpiresAt); err != nil {
		return nil, err
	}

	lease.ExpiresAt = newExpiresAt
	lease.RenewCount++

	s.timeline.RecordEvent(lease.TaskID, leaseID, "LEASE_RENEWED", holderID,
		fmt.Sprintf("Lease renewed, renew count: %d", lease.RenewCount),
		fmt.Sprintf("New expires: %v", newExpiresAt))

	return lease, nil
}

func (s *LeaseService) ReleaseLease(leaseID, holderID, reason string) error {
	lease, err := s.getLeaseByID(leaseID)
	if err != nil {
		return err
	}

	if lease.HolderID != holderID {
		return ErrInvalidLeaseHolder
	}

	now := time.Now().UTC()

	releaseRecord := &model.ReleaseRecord{
		ID:          generateID(),
		TaskID:      lease.TaskID,
		LeaseID:     leaseID,
		HolderID:    holderID,
		ReleasedAt:  now,
		ReleaseType: "VOLUNTARY",
		Reason:      reason,
	}

	if err := s.repo.CreateReleaseRecord(releaseRecord); err != nil {
		return err
	}

	if err := s.repo.DeactivateLease(leaseID); err != nil {
		return err
	}

	task, err := s.repo.GetTask(lease.TaskID)
	if err != nil {
		return err
	}

	if task.Status != model.TaskStatusCompleted && task.Status != model.TaskStatusFailed {
		if err := s.repo.UpdateTaskStatus(lease.TaskID, model.TaskStatusPending); err != nil {
			return err
		}
	}

	s.timeline.RecordEvent(lease.TaskID, leaseID, "LEASE_RELEASED", holderID,
		fmt.Sprintf("Lease released: %s", reason), "")

	return nil
}

func (s *LeaseService) SubmitResult(taskID, leaseID, holderID, status, resultData, errorMessage string, startedAt time.Time) (*model.ExecutionResult, error) {
	hasResult, err := s.repo.HasExecutionResult(taskID)
	if err != nil {
		return nil, err
	}
	if hasResult {
		s.timeline.RecordEvent(taskID, leaseID, "DUPLICATE_SUBMIT", holderID,
			"Duplicate result submission attempt blocked", "")
		return nil, ErrResultAlreadySubmitted
	}

	lease, err := s.getLeaseByID(leaseID)
	if err != nil {
		return nil, err
	}

	if lease.HolderID != holderID {
		return nil, ErrInvalidLeaseHolder
	}

	if lease.TaskID != taskID {
		s.timeline.RecordEvent(taskID, leaseID, "INVALID_TASK_ID", holderID,
			"Lease does not belong to the specified task",
			fmt.Sprintf("Lease task: %s, Provided task: %s", lease.TaskID, taskID))
		return nil, errors.New("lease does not belong to the specified task")
	}

	if !lease.IsActive {
		s.timeline.RecordEvent(taskID, leaseID, "LEASE_INACTIVE", holderID,
			"Lease is no longer active (released or preempted)",
			fmt.Sprintf("Lease acquired at: %v", lease.AcquiredAt))
		return nil, errors.New("lease is no longer active")
	}

	now := time.Now().UTC()
	if now.After(lease.ExpiresAt) {
		s.timeline.RecordEvent(taskID, leaseID, "LEASE_EXPIRED", holderID,
			"Lease has expired",
			fmt.Sprintf("Expired at: %v, Current time: %v", lease.ExpiresAt, now))
		return nil, ErrLeaseExpired
	}
	durationMs := now.Sub(startedAt).Milliseconds()

	result := &model.ExecutionResult{
		ID:           generateID(),
		TaskID:       taskID,
		LeaseID:      leaseID,
		HolderID:     holderID,
		Status:       status,
		ResultData:   resultData,
		ErrorMessage: errorMessage,
		StartedAt:    startedAt,
		CompletedAt:  now,
		DurationMs:   durationMs,
	}

	if err := s.repo.CreateExecutionResult(result); err != nil {
		return nil, err
	}

	var taskStatus model.TaskStatus
	if status == "success" {
		taskStatus = model.TaskStatusCompleted
	} else {
		taskStatus = model.TaskStatusFailed
	}

	if err := s.repo.UpdateTaskStatus(taskID, taskStatus); err != nil {
		return nil, err
	}

	if err := s.repo.DeactivateLease(leaseID); err != nil {
		return nil, err
	}

	releaseRecord := &model.ReleaseRecord{
		ID:          generateID(),
		TaskID:      taskID,
		LeaseID:     leaseID,
		HolderID:    holderID,
		ReleasedAt:  now,
		ReleaseType: "COMPLETION",
		Reason:      fmt.Sprintf("Task %s", status),
	}
	if err := s.repo.CreateReleaseRecord(releaseRecord); err != nil {
		return nil, err
	}

	s.timeline.RecordEvent(taskID, leaseID, "RESULT_SUBMITTED", holderID,
		fmt.Sprintf("Result submitted with status: %s, duration: %dms", status, durationMs),
		fmt.Sprintf("Result: %s, Error: %s", resultData, errorMessage))

	return result, nil
}

func (s *LeaseService) getLeaseByID(leaseID string) (*model.Lease, error) {
	query := `
	SELECT id, task_id, holder_id, holder_name, acquired_at, expires_at, renew_count, is_active
	FROM leases WHERE id = ?
	`
	var lease model.Lease
	err := s.repo.DB.QueryRow(query, leaseID).Scan(&lease.ID, &lease.TaskID, &lease.HolderID, &lease.HolderName,
		&lease.AcquiredAt, &lease.ExpiresAt, &lease.RenewCount, &lease.IsActive)
	if err == sql.ErrNoRows {
		return nil, ErrNoActiveLease
	}
	if err != nil {
		return nil, err
	}
	return &lease, nil
}
