package services

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
)

const (
	StatusPending            = "pending"
	StatusLeaderApproved     = "leader_approved"
	StatusSupervisorApproved = "supervisor_approved"
	StatusApproved           = "approved"
	StatusRejected           = "rejected"
)

var validTransitions = map[string][]string{
	StatusPending:            {StatusLeaderApproved, StatusRejected},
	StatusLeaderApproved:     {StatusSupervisorApproved, StatusRejected},
	StatusSupervisorApproved: {StatusApproved, StatusRejected},
	StatusApproved:           {},
	StatusRejected:           {},
}

type StatusService struct {
	db *sql.DB
}

func NewStatusService(db *sql.DB) *StatusService {
	return &StatusService{db: db}
}

func (s *StatusService) CanTransition(fromStatus, toStatus string) bool {
	validNext, exists := validTransitions[fromStatus]
	if !exists {
		return false
	}
	for _, next := range validNext {
		if next == toStatus {
			return true
		}
	}
	return false
}

func (s *StatusService) TransitionStatus(applicationID, newStatus, operatorID, operatorName, details, ipAddress string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var oldStatus string
	err = tx.QueryRow("SELECT status FROM applications WHERE id = ? LIMIT 1", applicationID).Scan(&oldStatus)
	if err != nil {
		return err
	}

	if !s.CanTransition(oldStatus, newStatus) {
		return fmt.Errorf("invalid status transition from %s to %s", oldStatus, newStatus)
	}

	now := time.Now()
	_, err = tx.Exec("UPDATE applications SET status = ?, updated_at = ? WHERE id = ?", newStatus, now, applicationID)
	if err != nil {
		return err
	}

	logID := uuid.New().String()
	_, err = tx.Exec("INSERT INTO processing_logs (id, application_id, action, old_status, new_status, operator_id, operator_name, details, ip_address, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
		logID, applicationID, "status_change", oldStatus, newStatus, operatorID, operatorName, details, ipAddress, now)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *StatusService) ApproveByLeader(applicationID, approverID, approverName, ipAddress string) error {
	return s.TransitionStatus(applicationID, StatusLeaderApproved, approverID, approverName, "leader approval", ipAddress)
}

func (s *StatusService) ApproveBySupervisor(applicationID, approverID, approverName, ipAddress string) error {
	return s.TransitionStatus(applicationID, StatusSupervisorApproved, approverID, approverName, "supervisor approval", ipAddress)
}

func (s *StatusService) FinalApprove(applicationID, approverID, approverName, ipAddress string) error {
	return s.TransitionStatus(applicationID, StatusApproved, approverID, approverName, "final approval", ipAddress)
}

func (s *StatusService) Reject(applicationID, rejectorID, rejectorName, reason, ipAddress string) error {
	return s.TransitionStatus(applicationID, StatusRejected, rejectorID, rejectorName, reason, ipAddress)
}
