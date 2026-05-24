package services

import (
	"database/sql"
	"errors"
	"fmt"
	"time"

	"night-market-api/internal/database"
	"night-market-api/internal/models"
	"night-market-api/pkg/utils"
)

type SwapService struct {
	validationService *ValidationService
}

func NewSwapService() *SwapService {
	return &SwapService{
		validationService: NewValidationService(),
	}
}

var validTransitions = map[string][]string{
	"pending":   {"approved", "rejected", "cancelled"},
	"approved":  {"completed", "cancelled"},
	"rejected":  {},
	"cancelled": {},
	"completed": {},
}

func (s *SwapService) isValidTransition(current, next string) bool {
	validNext, ok := validTransitions[current]
	if !ok {
		return false
	}
	for _, s := range validNext {
		if s == next {
			return true
		}
	}
	return false
}

func (s *SwapService) CreateSwapRequest(cycleID, requestingVendorID, targetVendorID, reason string) (*models.SwapRequest, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var cycleStatus string
	err = tx.QueryRow(`SELECT status FROM rotation_cycles WHERE id = ?`, cycleID).Scan(&cycleStatus)
	if err == sql.ErrNoRows {
		return nil, errors.New("轮换周期不存在")
	}
	if err != nil {
		return nil, err
	}
	if cycleStatus != "draft" && cycleStatus != "active" {
		return nil, errors.New("轮换周期状态不允许换位申请")
	}

	var reqStallID, reqStatus string
	err = tx.QueryRow(
		`SELECT stall_id, status FROM stall_assignments WHERE cycle_id = ? AND vendor_id = ?`,
		cycleID, requestingVendorID,
	).Scan(&reqStallID, &reqStatus)
	if err == sql.ErrNoRows {
		return nil, errors.New("申请摊主未分配摊位")
	}
	if err != nil {
		return nil, err
	}
	if reqStatus != "assigned" && reqStatus != "validated" {
		return nil, errors.New("申请摊主摊位状态无效")
	}

	var targetStallID, targetStatus string
	err = tx.QueryRow(
		`SELECT stall_id, status FROM stall_assignments WHERE cycle_id = ? AND vendor_id = ?`,
		cycleID, targetVendorID,
	).Scan(&targetStallID, &targetStatus)
	if err == sql.ErrNoRows {
		return nil, errors.New("目标摊主未分配摊位")
	}
	if err != nil {
		return nil, err
	}
	if targetStatus != "assigned" && targetStatus != "validated" {
		return nil, errors.New("目标摊主摊位状态无效")
	}

	var pendingCount int
	err = tx.QueryRow(
		`SELECT COUNT(*) FROM swap_requests 
		 WHERE cycle_id = ? 
		 AND status = 'pending'
		 AND (requesting_vendor_id = ? OR target_vendor_id = ? OR requesting_vendor_id = ? OR target_vendor_id = ?)`,
		cycleID, requestingVendorID, requestingVendorID, targetVendorID, targetVendorID,
	).Scan(&pendingCount)
	if err != nil {
		return nil, err
	}
	if pendingCount > 0 {
		return nil, errors.New("存在待处理的换位申请，请先处理")
	}

	id := utils.GenerateID()
	now := time.Now()

	_, err = tx.Exec(
		`INSERT INTO swap_requests (
			id, cycle_id, requesting_vendor_id, target_vendor_id, 
			requesting_stall_id, target_stall_id, status, reason, created_at
		) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
		id, cycleID, requestingVendorID, targetVendorID, reqStallID, targetStallID, reason, now,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("swap_request", id, "create", "", "pending", "system")

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetSwapRequest(id)
}

func (s *SwapService) ApproveSwap(swapID, operator string) (*models.SwapRequest, error) {
	return s.transitionState(swapID, "approved", operator)
}

func (s *SwapService) RejectSwap(swapID, operator string) (*models.SwapRequest, error) {
	return s.transitionState(swapID, "rejected", operator)
}

func (s *SwapService) CancelSwap(swapID, operator string) (*models.SwapRequest, error) {
	return s.transitionState(swapID, "cancelled", operator)
}

func (s *SwapService) CompleteSwap(swapID, operator string) (*models.SwapRequest, error) {
	swap, err := s.transitionState(swapID, "completed", operator)
	if err != nil {
		return nil, err
	}

	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	now := time.Now()

	_, err = tx.Exec(
		`UPDATE stall_assignments SET stall_id = ?, status = 'assigned', validated_at = NULL, validation_result = NULL 
		 WHERE cycle_id = ? AND vendor_id = ?`,
		swap.TargetStallID, swap.CycleID, swap.RequestingVendorID,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`UPDATE stall_assignments SET stall_id = ?, status = 'assigned', validated_at = NULL, validation_result = NULL 
		 WHERE cycle_id = ? AND vendor_id = ?`,
		swap.RequestingStallID, swap.CycleID, swap.TargetVendorID,
	)
	if err != nil {
		return nil, err
	}

	_, err = tx.Exec(
		`UPDATE swap_requests SET resolved_at = ? WHERE id = ?`,
		now, swapID,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("stall_assignment", swap.RequestingVendorID, "swap",
		swap.RequestingStallID, swap.TargetStallID, operator)
	_ = database.AuditLog("stall_assignment", swap.TargetVendorID, "swap",
		swap.TargetStallID, swap.RequestingStallID, operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetSwapRequest(swapID)
}

func (s *SwapService) transitionState(swapID, newState, operator string) (*models.SwapRequest, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var currentState string
	err = tx.QueryRow(`SELECT status FROM swap_requests WHERE id = ?`, swapID).Scan(&currentState)
	if err == sql.ErrNoRows {
		return nil, errors.New("换位申请不存在")
	}
	if err != nil {
		return nil, err
	}

	if !s.isValidTransition(currentState, newState) {
		return nil, fmt.Errorf("无法从状态 '%s' 转换到 '%s'", currentState, newState)
	}

	now := time.Now()
	_, err = tx.Exec(
		`UPDATE swap_requests SET status = ?, approved_at = ?, approved_by = ? WHERE id = ?`,
		newState, now, operator, swapID,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("swap_request", swapID, newState, currentState, newState, operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetSwapRequest(swapID)
}

func (s *SwapService) GetSwapRequest(id string) (*models.SwapRequest, error) {
	var s2 models.SwapRequest
	err := database.DB.QueryRow(
		`SELECT id, cycle_id, requesting_vendor_id, target_vendor_id, requesting_stall_id, 
		 target_stall_id, status, reason, created_at, approved_at, approved_by, resolved_at
		 FROM swap_requests WHERE id = ?`, id,
	).Scan(&s2.ID, &s2.CycleID, &s2.RequestingVendorID, &s2.TargetVendorID, &s2.RequestingStallID,
		&s2.TargetStallID, &s2.Status, &s2.Reason, &s2.CreatedAt, &s2.ApprovedAt, &s2.ApprovedBy, &s2.ResolvedAt)
	if err != nil {
		return nil, err
	}
	return &s2, nil
}

func (s *SwapService) GetCycleSwaps(cycleID string) ([]models.SwapRequest, error) {
	rows, err := database.DB.Query(
		`SELECT id, cycle_id, requesting_vendor_id, target_vendor_id, requesting_stall_id, 
		 target_stall_id, status, reason, created_at, approved_at, approved_by, resolved_at
		 FROM swap_requests WHERE cycle_id = ? ORDER BY created_at DESC`, cycleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var swaps []models.SwapRequest
	for rows.Next() {
		var s2 models.SwapRequest
		err := rows.Scan(&s2.ID, &s2.CycleID, &s2.RequestingVendorID, &s2.TargetVendorID, &s2.RequestingStallID,
			&s2.TargetStallID, &s2.Status, &s2.Reason, &s2.CreatedAt, &s2.ApprovedAt, &s2.ApprovedBy, &s2.ResolvedAt)
		if err != nil {
			return nil, err
		}
		swaps = append(swaps, s2)
	}
	return swaps, nil
}
