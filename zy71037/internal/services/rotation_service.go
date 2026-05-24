package services

import (
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"os"
	"sort"
	"strconv"
	"time"

	"night-market-api/internal/database"
	"night-market-api/internal/models"
	"night-market-api/pkg/utils"
)

type RotationService struct {
	validationService *ValidationService
	complaintService  *ComplaintService
	swapService       *SwapService
}

func NewRotationService() *RotationService {
	return &RotationService{
		validationService: NewValidationService(),
		complaintService:  NewComplaintService(),
		swapService:       NewSwapService(),
	}
}

func (s *RotationService) CreateCycle(name, startDate, endDate, createdBy string) (*models.RotationCycle, error) {
	id := utils.GenerateID()
	now := time.Now()

	_, err := database.DB.Exec(
		`INSERT INTO rotation_cycles (id, name, start_date, end_date, status, created_at, created_by)
		 VALUES (?, ?, ?, ?, 'draft', ?, ?)`,
		id, name, startDate, endDate, now, createdBy,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("rotation_cycle", id, "create", "", "draft", createdBy)

	return s.GetCycle(id)
}

func (s *RotationService) GetCycle(id string) (*models.RotationCycle, error) {
	var c models.RotationCycle
	err := database.DB.QueryRow(
		`SELECT id, name, start_date, end_date, status, created_at, created_by
		 FROM rotation_cycles WHERE id = ?`, id,
	).Scan(&c.ID, &c.Name, &c.StartDate, &c.EndDate, &c.Status, &c.CreatedAt, &c.CreatedBy)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *RotationService) ListCycles() ([]models.RotationCycle, error) {
	rows, err := database.DB.Query(
		`SELECT id, name, start_date, end_date, status, created_at, created_by
		 FROM rotation_cycles ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var cycles []models.RotationCycle
	for rows.Next() {
		var c models.RotationCycle
		err := rows.Scan(&c.ID, &c.Name, &c.StartDate, &c.EndDate, &c.Status, &c.CreatedAt, &c.CreatedBy)
		if err != nil {
			return nil, err
		}
		cycles = append(cycles, c)
	}
	return cycles, nil
}

func (s *RotationService) CreateAssignment(cycleID, vendorID, stallID, operator string) (*models.StallAssignment, error) {
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
	if cycleStatus == "finalized" {
		return nil, errors.New("轮换周期已定稿，无法修改分配")
	}

	if !s.validationService.CheckStallAvailable(cycleID, stallID) {
		return nil, errors.New("该摊位已被分配")
	}

	if s.validationService.CheckVendorAssigned(cycleID, vendorID) {
		return nil, errors.New("该摊主已分配其他摊位")
	}

	validation := s.validationService.ValidateAssignment(vendorID, stallID)
	validationResult := "pass"
	if !validation.Valid {
		validationResult = "fail"
	}

	id := utils.GenerateID()
	now := time.Now()

	_, err = tx.Exec(
		`INSERT INTO stall_assignments (
			id, cycle_id, vendor_id, stall_id, status, assigned_at, validated_at, validation_result
		) VALUES (?, ?, ?, ?, 'assigned', ?, ?, ?)`,
		id, cycleID, vendorID, stallID, now, now, validationResult,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("stall_assignment", id, "create", "", "assigned", operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetAssignment(id)
}

func (s *RotationService) RemoveAssignment(assignmentID, operator string) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var cycleID, status string
	err = tx.QueryRow(
		`SELECT cycle_id, status FROM stall_assignments WHERE id = ?`, assignmentID,
	).Scan(&cycleID, &status)
	if err == sql.ErrNoRows {
		return errors.New("分配记录不存在")
	}
	if err != nil {
		return err
	}

	var cycleStatus string
	err = tx.QueryRow(`SELECT status FROM rotation_cycles WHERE id = ?`, cycleID).Scan(&cycleStatus)
	if err != nil {
		return err
	}
	if cycleStatus == "finalized" {
		return errors.New("轮换周期已定稿，无法删除分配")
	}

	_, err = tx.Exec(`DELETE FROM stall_assignments WHERE id = ?`, assignmentID)
	if err != nil {
		return err
	}

	_ = database.AuditLog("stall_assignment", assignmentID, "delete", status, "", operator)

	return tx.Commit()
}

func (s *RotationService) GetAssignment(id string) (*models.StallAssignment, error) {
	var a models.StallAssignment
	err := database.DB.QueryRow(
		`SELECT id, cycle_id, vendor_id, stall_id, status, assigned_at, validated_at, validation_result, notes
		 FROM stall_assignments WHERE id = ?`, id,
	).Scan(&a.ID, &a.CycleID, &a.VendorID, &a.StallID, &a.Status, &a.AssignedAt, &a.ValidatedAt, &a.ValidationResult, &a.Notes)
	if err != nil {
		return nil, err
	}
	return &a, nil
}

func (s *RotationService) GetCycleAssignments(cycleID string) ([]models.StallAssignmentDetail, error) {
	rows, err := database.DB.Query(
		`SELECT a.id, a.cycle_id, a.vendor_id, a.stall_id, a.status, a.assigned_at, 
		        a.validated_at, a.validation_result, a.notes,
		        v.name, v.category, s.code, s.name, s.zone
		 FROM stall_assignments a
		 JOIN vendors v ON a.vendor_id = v.id
		 JOIN stalls s ON a.stall_id = s.id
		 WHERE a.cycle_id = ?
		 ORDER BY s.code`, cycleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var assignments []models.StallAssignmentDetail
	for rows.Next() {
		var d models.StallAssignmentDetail
		err := rows.Scan(
			&d.ID, &d.CycleID, &d.VendorID, &d.StallID, &d.Status, &d.AssignedAt,
			&d.ValidatedAt, &d.ValidationResult, &d.Notes,
			&d.VendorName, &d.VendorCategory, &d.StallCode, &d.StallName, &d.StallZone,
		)
		if err != nil {
			return nil, err
		}
		assignments = append(assignments, d)
	}
	return assignments, nil
}

func (s *RotationService) ValidateCycle(cycleID, operator string) (*models.ValidationResult, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var cycleStatus string
	err = tx.QueryRow(`SELECT status FROM rotation_cycles WHERE id = ?`, cycleID).Scan(&cycleStatus)
	if err != nil {
		return nil, err
	}
	if cycleStatus == "finalized" {
		return nil, errors.New("轮换周期已定稿")
	}

	result := s.validationService.ValidateCycle(cycleID)
	now := time.Now()

	_, err = tx.Exec(
		`UPDATE stall_assignments SET validated_at = ?, validation_result = ? WHERE cycle_id = ?`,
		now, map[bool]string{true: "pass", false: "fail"}[result.Valid], cycleID,
	)
	if err != nil {
		return nil, err
	}

	newStatus := "validated"
	_, err = tx.Exec(`UPDATE rotation_cycles SET status = ? WHERE id = ?`, newStatus, cycleID)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("rotation_cycle", cycleID, "validate", cycleStatus, newStatus, operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &result, nil
}

func (s *RotationService) FinalizeCycle(cycleID, operator string) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var cycleStatus string
	err = tx.QueryRow(`SELECT status FROM rotation_cycles WHERE id = ?`, cycleID).Scan(&cycleStatus)
	if err != nil {
		return err
	}
	if cycleStatus != "validated" {
		return errors.New("轮换周期必须先通过校验才能定稿")
	}

	validation := s.validationService.ValidateCycle(cycleID)
	if !validation.Valid {
		return errors.New("轮换周期校验未通过，请先修复问题")
	}

	_, err = tx.Exec(`UPDATE rotation_cycles SET status = 'finalized' WHERE id = ?`, cycleID)
	if err != nil {
		return err
	}

	_ = database.AuditLog("rotation_cycle", cycleID, "finalize", cycleStatus, "finalized", operator)

	return tx.Commit()
}

func (s *RotationService) ReopenCycle(cycleID, operator string) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var cycleStatus string
	err = tx.QueryRow(`SELECT status FROM rotation_cycles WHERE id = ?`, cycleID).Scan(&cycleStatus)
	if err != nil {
		return err
	}
	if cycleStatus != "finalized" {
		return errors.New("只有已定稿的周期才能重新打开")
	}

	_, err = tx.Exec(`UPDATE rotation_cycles SET status = 'validated' WHERE id = ?`, cycleID)
	if err != nil {
		return err
	}

	_ = database.AuditLog("rotation_cycle", cycleID, "reopen", cycleStatus, "validated", operator)

	return tx.Commit()
}

func (s *RotationService) GenerateReport(cycleID string) (*models.RotationReport, error) {
	cycle, err := s.GetCycle(cycleID)
	if err != nil {
		return nil, err
	}

	assignments, err := s.GetCycleAssignments(cycleID)
	if err != nil {
		return nil, err
	}

	complaints, err := s.GetCycleComplaints(cycleID)
	if err != nil {
		return nil, err
	}

	swaps, err := s.GetCycleSwapSummaries(cycleID)
	if err != nil {
		return nil, err
	}

	validation := s.validationService.ValidateCycle(cycleID)

	report := &models.RotationReport{
		CycleID:      cycle.ID,
		CycleName:    cycle.Name,
		TotalVendors: len(assignments),
		TotalStalls:  len(assignments),
		Assignments:  assignments,
		Complaints:   complaints,
		SwapRequests: swaps,
		Validation:   validation,
		GeneratedAt:  time.Now(),
	}

	return report, nil
}

func (s *RotationService) GetCycleComplaints(cycleID string) ([]models.ComplaintSummary, error) {
	var cycle models.RotationCycle
	err := database.DB.QueryRow(
		`SELECT start_date, end_date FROM rotation_cycles WHERE id = ?`, cycleID,
	).Scan(&cycle.StartDate, &cycle.EndDate)
	if err != nil {
		return nil, err
	}

	rows, err := database.DB.Query(
		`SELECT c.id, c.vendor_id, c.type, c.description, c.severity, 
		        c.points_deducted, c.status, c.reported_by, c.reported_at, c.resolved_at,
		        v.name
		 FROM complaints c
		 JOIN vendors v ON c.vendor_id = v.id
		 WHERE c.reported_at >= ? AND c.reported_at <= ?
		 ORDER BY c.reported_at DESC`,
		cycle.StartDate, cycle.EndDate,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []models.ComplaintSummary
	for rows.Next() {
		var s models.ComplaintSummary
		err := rows.Scan(
			&s.ID, &s.VendorID, &s.Type, &s.Description, &s.Severity,
			&s.PointsDeducted, &s.Status, &s.ReportedBy, &s.ReportedAt, &s.ResolvedAt,
			&s.VendorName,
		)
		if err != nil {
			return nil, err
		}
		complaints = append(complaints, s)
	}
	return complaints, nil
}

func (s *RotationService) GetCycleSwapSummaries(cycleID string) ([]models.SwapRequestSummary, error) {
	rows, err := database.DB.Query(
		`SELECT sr.id, sr.cycle_id, sr.requesting_vendor_id, sr.target_vendor_id, 
		        sr.requesting_stall_id, sr.target_stall_id, sr.status, sr.reason, 
		        sr.created_at, sr.approved_at, sr.approved_by, sr.resolved_at,
		        rv.name, tv.name, rs.code, ts.code
		 FROM swap_requests sr
		 JOIN vendors rv ON sr.requesting_vendor_id = rv.id
		 JOIN vendors tv ON sr.target_vendor_id = tv.id
		 JOIN stalls rs ON sr.requesting_stall_id = rs.id
		 JOIN stalls ts ON sr.target_stall_id = ts.id
		 WHERE sr.cycle_id = ?
		 ORDER BY sr.created_at DESC`, cycleID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var swaps []models.SwapRequestSummary
	for rows.Next() {
		var s models.SwapRequestSummary
		err := rows.Scan(
			&s.ID, &s.CycleID, &s.RequestingVendorID, &s.TargetVendorID,
			&s.RequestingStallID, &s.TargetStallID, &s.Status, &s.Reason,
			&s.CreatedAt, &s.ApprovedAt, &s.ApprovedBy, &s.ResolvedAt,
			&s.RequestingVendorName, &s.TargetVendorName, &s.RequestingStallCode, &s.TargetStallCode,
		)
		if err != nil {
			return nil, err
		}
		swaps = append(swaps, s)
	}
	return swaps, nil
}

func (s *RotationService) ExportReportCSV(cycleID, outputPath string) error {
	report, err := s.GenerateReport(cycleID)
	if err != nil {
		return err
	}

	file, err := os.Create(outputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"# 夜市摊位轮换报告"})
	writer.Write([]string{"周期名称", report.CycleName})
	writer.Write([]string{"生成时间", report.GeneratedAt.Format("2006-01-02 15:04:05")})
	writer.Write([]string{""})

	writer.Write([]string{"## 摊位分配表"})
	writer.Write([]string{"摊位编号", "摊位名称", "区域", "摊主名称", "经营品类", "状态", "校验结果"})
	for _, a := range report.Assignments {
		writer.Write([]string{
			a.StallCode,
			a.StallName,
			a.StallZone,
			a.VendorName,
			a.VendorCategory,
			a.Status,
			a.ValidationResult,
		})
	}
	writer.Write([]string{""})

	writer.Write([]string{"## 投诉记录"})
	writer.Write([]string{"摊主名称", "投诉类型", "严重程度", "扣分", "状态", "投诉时间"})
	for _, c := range report.Complaints {
		writer.Write([]string{
			c.VendorName,
			c.Type,
			c.Severity,
			strconv.Itoa(c.PointsDeducted),
			c.Status,
			c.ReportedAt.Format("2006-01-02 15:04:05"),
		})
	}
	writer.Write([]string{""})

	writer.Write([]string{"## 换位申请记录"})
	writer.Write([]string{"申请摊主", "目标摊主", "原摊位", "新摊位", "状态", "申请时间"})
	for _, sr := range report.SwapRequests {
		writer.Write([]string{
			sr.RequestingVendorName,
			sr.TargetVendorName,
			sr.RequestingStallCode,
			sr.TargetStallCode,
			sr.Status,
			sr.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}
	writer.Write([]string{""})

	writer.Write([]string{"## 校验结果"})
	if report.Validation.Valid {
		writer.Write([]string{"整体校验", "通过"})
	} else {
		writer.Write([]string{"整体校验", "未通过"})
	}
	if len(report.Validation.Errors) > 0 {
		writer.Write([]string{"错误列表"})
		for _, e := range report.Validation.Errors {
			writer.Write([]string{fmt.Sprintf("[%s] %s: %s", e.Code, e.Field, e.Message)})
		}
	}
	if len(report.Validation.Warnings) > 0 {
		writer.Write([]string{"警告列表"})
		for _, w := range report.Validation.Warnings {
			writer.Write([]string{fmt.Sprintf("[%s] %s: %s", w.Code, w.Field, w.Message)})
		}
	}

	return nil
}

func (s *RotationService) SuggestAssignment(cycleID string) ([]models.StallAssignmentDetail, error) {
	var vendors []models.Vendor
	var stalls []models.Stall

	vendorRows, err := database.DB.Query(`SELECT id, name, category, power_usage, requires_exhaust, score FROM vendors WHERE status = 'active'`)
	if err != nil {
		return nil, err
	}
	defer vendorRows.Close()

	for vendorRows.Next() {
		var v models.Vendor
		err := vendorRows.Scan(&v.ID, &v.Name, &v.Category, &v.PowerUsage, &v.RequiresExhaust, &v.Score)
		if err != nil {
			return nil, err
		}
		vendors = append(vendors, v)
	}

	stallRows, err := database.DB.Query(`SELECT id, code, name, power_capacity, has_exhaust, zone FROM stalls WHERE status = 'active'`)
	if err != nil {
		return nil, err
	}
	defer stallRows.Close()

	for stallRows.Next() {
		var st models.Stall
		err := stallRows.Scan(&st.ID, &st.Code, &st.Name, &st.PowerCapacity, &st.HasExhaust, &st.Zone)
		if err != nil {
			return nil, err
		}
		stalls = append(stalls, st)
	}

	sort.Slice(vendors, func(i, j int) bool {
		return vendors[i].Score > vendors[j].Score
	})

	assigned := make(map[string]bool)
	var result []models.StallAssignmentDetail

	for _, v := range vendors {
		for _, st := range stalls {
			if assigned[st.ID] {
				continue
			}
			if v.PowerUsage <= st.PowerCapacity {
				if v.RequiresExhaust && !st.HasExhaust {
					continue
				}
				assigned[st.ID] = true
				result = append(result, models.StallAssignmentDetail{
					StallAssignment: models.StallAssignment{
						VendorID: v.ID,
						StallID:  st.ID,
					},
					VendorName:     v.Name,
					VendorCategory: v.Category,
					StallCode:      st.Code,
					StallName:      st.Name,
					StallZone:      st.Zone,
				})
				break
			}
		}
	}

	return result, nil
}
