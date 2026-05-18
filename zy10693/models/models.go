package models

import (
	"time"

	"github.com/google/uuid"
)

type BatchStatus string

const (
	BatchStatusRunning  BatchStatus = "RUNNING"
	BatchStatusPaused   BatchStatus = "PAUSED"
	BatchStatusFrozen   BatchStatus = "FROZEN"
	BatchStatusResumed  BatchStatus = "RESUMED"
	BatchStatusRollback BatchStatus = "ROLLBACK"
	BatchStatusCompleted BatchStatus = "COMPLETED"
)

type MachineStatus string

const (
	MachineStatusPending   MachineStatus = "PENDING"
	MachineStatusRunning   MachineStatus = "RUNNING"
	MachineStatusSuccess   MachineStatus = "SUCCESS"
	MachineStatusFailed    MachineStatus = "FAILED"
	MachineStatusRollback  MachineStatus = "ROLLBACK"
)

type ConflictReason string

const (
	ConflictReasonMachineProgress ConflictReason = "MACHINE_PROGRESS"
	ConflictReasonInvalidStatus   ConflictReason = "INVALID_STATUS"
)

type Batch struct {
	ID             string       `json:"id"`
	AppName        string       `json:"app_name"`
	BatchNo        int          `json:"batch_no"`
	Status         BatchStatus  `json:"status"`
	PauseReason    string       `json:"pause_reason,omitempty"`
	ResumeCondition string      `json:"resume_condition,omitempty"`
	ConflictReason string       `json:"conflict_reason,omitempty"`
	CreatedAt      time.Time    `json:"created_at"`
	PausedAt       *time.Time   `json:"paused_at,omitempty"`
	ResumedAt      *time.Time   `json:"resumed_at,omitempty"`
	FrozenAt       *time.Time   `json:"frozen_at,omitempty"`
	Machines       []Machine    `json:"machines"`
}

type Machine struct {
	ID         string        `json:"id"`
	Hostname   string        `json:"hostname"`
	Status     MachineStatus `json:"status"`
	Progress   int           `json:"progress"`
	StartedAt  *time.Time    `json:"started_at,omitempty"`
	FinishedAt *time.Time    `json:"finished_at,omitempty"`
}

type PauseRequest struct {
	AppName        string `json:"app_name" binding:"required"`
	BatchNo        int    `json:"batch_no" binding:"required,min=1"`
	PauseReason    string `json:"pause_reason" binding:"required"`
	ResumeCondition string `json:"resume_condition"`
}

type ResumeRequest struct {
	AppName string `json:"app_name" binding:"required"`
	BatchNo int    `json:"batch_no" binding:"required,min=1"`
}

type RollbackRequest struct {
	AppName string `json:"app_name" binding:"required"`
	BatchNo int    `json:"batch_no" binding:"required,min=1"`
	Reason  string `json:"reason"`
}

type MachineProgressRequest struct {
	AppName   string `json:"app_name" binding:"required"`
	BatchNo   int    `json:"batch_no" binding:"required,min=1"`
	Hostname  string `json:"hostname" binding:"required"`
	Progress  int    `json:"progress" binding:"min=0,max=100"`
	Completed bool   `json:"completed"`
	Failed    bool   `json:"failed"`
}

type BatchResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message,omitempty"`
	Data    *Batch `json:"data,omitempty"`
}

func NewBatch(appName string, batchNo int, machines []string) *Batch {
	now := time.Now()
	batch := &Batch{
		ID:        uuid.New().String(),
		AppName:   appName,
		BatchNo:   batchNo,
		Status:    BatchStatusRunning,
		CreatedAt: now,
		Machines:  make([]Machine, len(machines)),
	}

	for i, hostname := range machines {
		batch.Machines[i] = Machine{
			ID:       uuid.New().String(),
			Hostname: hostname,
			Status:   MachineStatusPending,
			Progress: 0,
		}
	}

	return batch
}

func (b *Batch) CanPause() bool {
	return b.Status == BatchStatusRunning
}

func (b *Batch) CanResume() bool {
	return b.Status == BatchStatusPaused || b.Status == BatchStatusFrozen
}

func (b *Batch) CanRollback() bool {
	return b.Status == BatchStatusRunning || 
		   b.Status == BatchStatusPaused || 
		   b.Status == BatchStatusResumed ||
		   b.Status == BatchStatusFrozen
}

func (b *Batch) IsPausedOrFrozen() bool {
	return b.Status == BatchStatusPaused || b.Status == BatchStatusFrozen
}
