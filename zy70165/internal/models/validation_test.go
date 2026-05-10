package models

import (
	"testing"
)

func TestTaskSuccessCriteria(t *testing.T) {
	tests := []struct {
		name           string
		task           *RenewalTask
		expectedResult bool
	}{
		{
			name: "task meets all success criteria",
			task: &RenewalTask{
				Status: TaskStatusCompleted,
				Targets: []DeploymentTarget{
					{ID: "target-1"},
					{ID: "target-2"},
				},
				Receipts: []DeploymentReceipt{
					{TargetID: "target-1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
					{TargetID: "target-2", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts: []ConflictInfo{},
			},
			expectedResult: true,
		},
		{
			name: "task not completed - fails",
			task: &RenewalTask{
				Status: TaskStatusProcessing,
				Targets: []DeploymentTarget{
					{ID: "target-1"},
				},
				Receipts: []DeploymentReceipt{
					{TargetID: "target-1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts: []ConflictInfo{},
			},
			expectedResult: false,
		},
		{
			name: "not all receipts verified - fails",
			task: &RenewalTask{
				Status: TaskStatusCompleted,
				Targets: []DeploymentTarget{
					{ID: "target-1"},
					{ID: "target-2"},
				},
				Receipts: []DeploymentReceipt{
					{TargetID: "target-1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
					{TargetID: "target-2", Status: ReceiptStatusDeployed, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts: []ConflictInfo{},
			},
			expectedResult: false,
		},
		{
			name: "health check failed - fails",
			task: &RenewalTask{
				Status: TaskStatusCompleted,
				Targets: []DeploymentTarget{
					{ID: "target-1"},
				},
				Receipts: []DeploymentReceipt{
					{TargetID: "target-1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: false}},
				},
				Conflicts: []ConflictInfo{},
			},
			expectedResult: false,
		},
		{
			name: "unresolved conflict - fails",
			task: &RenewalTask{
				Status: TaskStatusCompleted,
				Targets: []DeploymentTarget{
					{ID: "target-1"},
				},
				Receipts: []DeploymentReceipt{
					{TargetID: "target-1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts: []ConflictInfo{
					{ConflictID: "c1", Resolved: false},
				},
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.task.MeetsSuccessCriteria()
			if result != tt.expectedResult {
				t.Errorf("MeetsSuccessCriteria() = %v, want %v", result, tt.expectedResult)
			}
		})
	}
}

func TestRequiresManualReview(t *testing.T) {
	tests := []struct {
		name           string
		task           *RenewalTask
		expectedResult bool
	}{
		{
			name: "rolled back task needs review",
			task: &RenewalTask{
				Status:   TaskStatusRolledBack,
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedResult: true,
		},
		{
			name: "timed out task needs review",
			task: &RenewalTask{
				Status:   TaskStatusTimeout,
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedResult: true,
		},
		{
			name: "failed task with max retries needs review",
			task: &RenewalTask{
				Status:   TaskStatusFailed,
				MaxRetries: 3,
				RetryCount: 3,
			},
			expectedResult: true,
		},
		{
			name: "task with unresolved conflicts needs review",
			task: &RenewalTask{
				Status:   TaskStatusProcessing,
				MaxRetries: 3,
				RetryCount: 0,
				Conflicts: []ConflictInfo{
					{Resolved: false},
				},
			},
			expectedResult: true,
		},
		{
			name: "completed task does not need review",
			task: &RenewalTask{
				Status:   TaskStatusCompleted,
				MaxRetries: 3,
				RetryCount: 0,
				Conflicts: []ConflictInfo{},
			},
			expectedResult: false,
		},
		{
			name: "pending retry task does not need review",
			task: &RenewalTask{
				Status:   TaskStatusPendingRetry,
				MaxRetries: 3,
				RetryCount: 1,
				Conflicts: []ConflictInfo{},
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.task.RequiresManualReview()
			if result != tt.expectedResult {
				t.Errorf("RequiresManualReview() = %v, want %v", result, tt.expectedResult)
			}
		})
	}
}

func TestDetermineFinalStatus(t *testing.T) {
	tests := []struct {
		name           string
		task           *RenewalTask
		expectedStatus TaskStatus
	}{
		{
			name: "all criteria met - completed",
			task: &RenewalTask{
				Status: TaskStatusCompleted,
				Targets: []DeploymentTarget{{ID: "t1"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts:  []ConflictInfo{},
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedStatus: TaskStatusCompleted,
		},
		{
			name: "unresolved conflicts - conflict",
			task: &RenewalTask{
				Status: TaskStatusProcessing,
				Targets: []DeploymentTarget{{ID: "t1"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
				},
				Conflicts:  []ConflictInfo{{Resolved: false}},
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedStatus: TaskStatusConflict,
		},
		{
			name: "receipt failed but can retry - pending retry",
			task: &RenewalTask{
				Status: TaskStatusProcessing,
				Targets: []DeploymentTarget{{ID: "t1"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusFailed, HealthCheck: &HealthCheckResult{Success: false}},
				},
				Conflicts:  []ConflictInfo{},
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedStatus: TaskStatusPendingRetry,
		},
		{
			name: "receipt failed and max retries - failed",
			task: &RenewalTask{
				Status: TaskStatusProcessing,
				Targets: []DeploymentTarget{{ID: "t1"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusFailed, HealthCheck: &HealthCheckResult{Success: false}},
				},
				Conflicts:  []ConflictInfo{},
				MaxRetries: 3,
				RetryCount: 3,
			},
			expectedStatus: TaskStatusFailed,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			status := DetermineFinalStatus(tt.task)
			if status != tt.expectedStatus {
				t.Errorf("DetermineFinalStatus() = %v, want %v", status, tt.expectedStatus)
			}
		})
	}
}

func TestAllReceiptsVerified(t *testing.T) {
	tests := []struct {
		name           string
		task           *RenewalTask
		expectedResult bool
	}{
		{
			name: "all receipts verified",
			task: &RenewalTask{
				Targets: []DeploymentTarget{{ID: "t1"}, {ID: "t2"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusVerified},
					{TargetID: "t2", Status: ReceiptStatusVerified},
				},
			},
			expectedResult: true,
		},
		{
			name: "receipt count mismatch",
			task: &RenewalTask{
				Targets: []DeploymentTarget{{ID: "t1"}, {ID: "t2"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusVerified},
				},
			},
			expectedResult: false,
		},
		{
			name: "one receipt not verified",
			task: &RenewalTask{
				Targets: []DeploymentTarget{{ID: "t1"}, {ID: "t2"}},
				Receipts: []DeploymentReceipt{
					{TargetID: "t1", Status: ReceiptStatusVerified},
					{TargetID: "t2", Status: ReceiptStatusDeployed},
				},
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.task.AllReceiptsVerified()
			if result != tt.expectedResult {
				t.Errorf("AllReceiptsVerified() = %v, want %v", result, tt.expectedResult)
			}
		})
	}
}

func TestCanRetry(t *testing.T) {
	tests := []struct {
		name           string
		task           *RenewalTask
		expectedResult bool
	}{
		{
			name: "can retry",
			task: &RenewalTask{
				MaxRetries: 3,
				RetryCount: 0,
			},
			expectedResult: true,
		},
		{
			name: "max retries reached",
			task: &RenewalTask{
				MaxRetries: 3,
				RetryCount: 3,
			},
			expectedResult: false,
		},
		{
			name: "max retries is zero",
			task: &RenewalTask{
				MaxRetries: 0,
				RetryCount: 0,
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.task.CanRetry()
			if result != tt.expectedResult {
				t.Errorf("CanRetry() = %v, want %v", result, tt.expectedResult)
			}
		})
	}
}

func TestEvaluateSuccessCriteria(t *testing.T) {
	task := &RenewalTask{
		Status: TaskStatusCompleted,
		Targets: []DeploymentTarget{{ID: "t1"}},
		Receipts: []DeploymentReceipt{
			{TargetID: "t1", Status: ReceiptStatusVerified, HealthCheck: &HealthCheckResult{Success: true}},
		},
		Conflicts: []ConflictInfo{},
	}
	
	criteria := EvaluateSuccessCriteria(task)
	
	if !criteria.MeetsAll() {
		t.Error("Expected criteria to meet all requirements")
	}
	
	if criteria.NeedsReview() {
		t.Error("Expected no review needed")
	}
}

func TestSuccessCriteriaNeedsReview(t *testing.T) {
	tests := []struct {
		name           string
		criteria       *SuccessCriteria
		expectedResult bool
	}{
		{
			name: "conflicts present - needs review",
			criteria: &SuccessCriteria{
				TaskCompleted: true,
				AllReceipts:   true,
				HealthChecks:  true,
				NoConflicts:   false,
				WithinTimeout: true,
			},
			expectedResult: true,
		},
		{
			name: "completed but receipts failed - needs review",
			criteria: &SuccessCriteria{
				TaskCompleted: true,
				AllReceipts:   false,
				HealthChecks:  true,
				NoConflicts:   true,
				WithinTimeout: true,
			},
			expectedResult: true,
		},
		{
			name: "completed but health checks failed - needs review",
			criteria: &SuccessCriteria{
				TaskCompleted: true,
				AllReceipts:   true,
				HealthChecks:  false,
				NoConflicts:   true,
				WithinTimeout: true,
			},
			expectedResult: true,
		},
		{
			name: "all criteria met - no review needed",
			criteria: &SuccessCriteria{
				TaskCompleted: true,
				AllReceipts:   true,
				HealthChecks:  true,
				NoConflicts:   true,
				WithinTimeout: true,
			},
			expectedResult: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result := tt.criteria.NeedsReview()
			if result != tt.expectedResult {
				t.Errorf("NeedsReview() = %v, want %v", result, tt.expectedResult)
			}
		})
	}
}
