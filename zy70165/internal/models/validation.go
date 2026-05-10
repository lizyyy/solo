package models

import (
	"time"
)

func (task *RenewalTask) IsCompleted() bool {
	return task.Status == TaskStatusCompleted
}

func (task *RenewalTask) IsFailed() bool {
	return task.Status == TaskStatusFailed || task.Status == TaskStatusTimeout
}

func (task *RenewalTask) IsRolledBack() bool {
	return task.Status == TaskStatusRolledBack
}

func (task *RenewalTask) IsCancelled() bool {
	return task.Status == TaskStatusCancelled
}

func (task *RenewalTask) IsProcessing() bool {
	return task.Status == TaskStatusProcessing || task.Status == TaskStatusRetrying || task.Status == TaskStatusRollingBack
}

func (task *RenewalTask) IsPending() bool {
	return task.Status == TaskStatusPending || task.Status == TaskStatusPendingRetry
}

func (task *RenewalTask) IsConflicted() bool {
	return task.Status == TaskStatusConflict
}

func (task *RenewalTask) RequiresManualReview() bool {
	if task.Status == TaskStatusRolledBack {
		return true
	}
	if task.Status == TaskStatusTimeout {
		return true
	}
	if task.Status == TaskStatusFailed && task.RetryCount >= task.MaxRetries {
		return true
	}
	if task.HasUnresolvedConflicts() {
		return true
	}
	if task.Status == TaskStatusFailed && task.SomeHealthChecksFailed() {
		return true
	}
	return false
}

func (task *RenewalTask) HasUnresolvedConflicts() bool {
	for _, c := range task.Conflicts {
		if !c.Resolved {
			return true
		}
	}
	return false
}

func (task *RenewalTask) SomeHealthChecksFailed() bool {
	for _, r := range task.Receipts {
		if r.HealthCheck != nil && !r.HealthCheck.Success {
			return true
		}
	}
	return false
}

func (task *RenewalTask) AllReceiptsVerified() bool {
	if len(task.Receipts) != len(task.Targets) {
		return false
	}
	for _, r := range task.Receipts {
		if r.Status != ReceiptStatusVerified {
			return false
		}
	}
	return true
}

func (task *RenewalTask) AllHealthChecksPassed() bool {
	for _, r := range task.Receipts {
		if r.HealthCheck == nil || !r.HealthCheck.Success {
			return false
		}
	}
	return true
}

func (task *RenewalTask) HasTimedOut() bool {
	if task.TimeoutAt == nil {
		return false
	}
	return time.Now().UTC().After(*task.TimeoutAt)
}

func (task *RenewalTask) CanRetry() bool {
	if task.MaxRetries <= 0 {
		return false
	}
	return task.RetryCount < task.MaxRetries
}

func (task *RenewalTask) IsWithinTimeout(now time.Time) bool {
	if task.TimeoutAt == nil {
		return true
	}
	return now.Before(*task.TimeoutAt)
}

func (task *RenewalTask) MeetsSuccessCriteria() bool {
	if !task.IsCompleted() {
		return false
	}
	if !task.AllReceiptsVerified() {
		return false
	}
	if !task.AllHealthChecksPassed() {
		return false
	}
	if task.HasUnresolvedConflicts() {
		return false
	}
	return true
}

func (receipt *DeploymentReceipt) IsSuccess() bool {
	return receipt.Status == ReceiptStatusVerified
}

func (receipt *DeploymentReceipt) IsFailed() bool {
	return receipt.Status == ReceiptStatusFailed
}

func (cert *Certificate) IsActive() bool {
	return cert.Status == CertStatusActive
}

func (cert *Certificate) IsExpiring(threshold time.Duration) bool {
	return time.Now().UTC().Add(threshold).After(cert.ValidTo)
}

func (cert *Certificate) IsExpired() bool {
	return cert.Status == CertStatusExpired || time.Now().UTC().After(cert.ValidTo)
}

func (cert *Certificate) IsRevoked() bool {
	return cert.Status == CertStatusRevoked
}

func (cert *Certificate) RequiresRenewal(threshold time.Duration) bool {
	if !cert.AutoRenew {
		return false
	}
	if cert.IsRevoked() {
		return false
	}
	if cert.Status == CertStatusRenewing {
		return false
	}
	return cert.IsExpiring(threshold)
}

func (criteria *SuccessCriteria) MeetsAll() bool {
	return criteria.TaskCompleted &&
		criteria.AllReceipts &&
		criteria.HealthChecks &&
		criteria.NoConflicts &&
		criteria.WithinTimeout
}

func (criteria *SuccessCriteria) NeedsReview() bool {
	return !criteria.NoConflicts ||
		(criteria.TaskCompleted && !criteria.AllReceipts) ||
		(criteria.TaskCompleted && !criteria.HealthChecks)
}

func EvaluateSuccessCriteria(task *RenewalTask) *SuccessCriteria {
	now := time.Now().UTC()
	return &SuccessCriteria{
		TaskCompleted: task.IsCompleted(),
		AllReceipts:   task.AllReceiptsVerified(),
		HealthChecks:  task.AllHealthChecksPassed(),
		NoConflicts:   !task.HasUnresolvedConflicts(),
		WithinTimeout: task.IsWithinTimeout(now),
	}
}

func DetermineFinalStatus(task *RenewalTask) TaskStatus {
	criteria := EvaluateSuccessCriteria(task)
	
	if criteria.MeetsAll() {
		return TaskStatusCompleted
	}
	
	if task.HasTimedOut() {
		return TaskStatusTimeout
	}
	
	if task.HasUnresolvedConflicts() {
		return TaskStatusConflict
	}
	
	if !criteria.AllReceipts || !criteria.HealthChecks {
		if task.CanRetry() {
			return TaskStatusPendingRetry
		}
		return TaskStatusFailed
	}
	
	return task.Status
}
