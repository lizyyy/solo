package services

import (
	"database/sql"
	"errors"
	"time"

	"night-market-api/internal/database"
	"night-market-api/internal/models"
	"night-market-api/pkg/utils"
)

type ComplaintService struct{}

func NewComplaintService() *ComplaintService {
	return &ComplaintService{}
}

var severityPoints = map[string]int{
	"trivial":  2,
	"minor":    5,
	"moderate": 10,
	"severe":   20,
	"critical": 30,
}

func (s *ComplaintService) GetPointsBySeverity(severity string) int {
	if points, ok := severityPoints[severity]; ok {
		return points
	}
	return 5
}

func (s *ComplaintService) CreateComplaint(vendorID, complaintType, description, severity, reportedBy string) (*models.Complaint, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var vendorStatus string
	err = tx.QueryRow(`SELECT status FROM vendors WHERE id = ?`, vendorID).Scan(&vendorStatus)
	if err == sql.ErrNoRows {
		return nil, errors.New("摊主不存在")
	}
	if err != nil {
		return nil, err
	}
	if vendorStatus != "active" {
		return nil, errors.New("摊主状态非活跃")
	}

	id := utils.GenerateID()
	points := s.GetPointsBySeverity(severity)
	now := time.Now()

	_, err = tx.Exec(
		`INSERT INTO complaints (id, vendor_id, type, description, severity, points_deducted, status, reported_by, reported_at)
		 VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
		id, vendorID, complaintType, description, severity, points, reportedBy, now,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetComplaint(id)
}

func (s *ComplaintService) ResolveComplaint(complaintID, operator string, applyDeduction bool) (*models.Complaint, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var complaint models.Complaint
	err = tx.QueryRow(
		`SELECT id, vendor_id, severity, points_deducted, status 
		 FROM complaints WHERE id = ?`, complaintID,
	).Scan(&complaint.ID, &complaint.VendorID, &complaint.Severity, &complaint.PointsDeducted, &complaint.Status)
	if err == sql.ErrNoRows {
		return nil, errors.New("投诉记录不存在")
	}
	if err != nil {
		return nil, err
	}

	if complaint.Status != "pending" {
		return nil, errors.New("该投诉已处理，无法重复操作")
	}

	now := time.Now()
	newStatus := "resolved"
	pointsDeducted := 0
	if applyDeduction {
		pointsDeducted = complaint.PointsDeducted
	}

	_, err = tx.Exec(
		`UPDATE complaints SET status = ?, points_deducted = ?, resolved_at = ? WHERE id = ?`,
		newStatus, pointsDeducted, now, complaintID,
	)
	if err != nil {
		return nil, err
	}

	if applyDeduction && pointsDeducted > 0 {
		var oldScore int
		err = tx.QueryRow(`SELECT score FROM vendors WHERE id = ?`, complaint.VendorID).Scan(&oldScore)
		if err != nil {
			return nil, err
		}

		newScore := oldScore - pointsDeducted
		if newScore < 0 {
			newScore = 0
		}

		_, err = tx.Exec(`UPDATE vendors SET score = ?, updated_at = ? WHERE id = ?`, newScore, now, complaint.VendorID)
		if err != nil {
			return nil, err
		}

		_ = database.AuditLog("vendor", complaint.VendorID, "score_deduction",
			string(rune(oldScore)), string(rune(newScore)), operator)
	}

	_ = database.AuditLog("complaint", complaintID, "resolve", "pending", newStatus, operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetComplaint(complaintID)
}

func (s *ComplaintService) RejectComplaint(complaintID, operator string) (*models.Complaint, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	var status string
	err = tx.QueryRow(`SELECT status FROM complaints WHERE id = ?`, complaintID).Scan(&status)
	if err == sql.ErrNoRows {
		return nil, errors.New("投诉记录不存在")
	}
	if err != nil {
		return nil, err
	}

	if status != "pending" {
		return nil, errors.New("该投诉已处理，无法重复操作")
	}

	now := time.Now()
	_, err = tx.Exec(
		`UPDATE complaints SET status = 'rejected', points_deducted = 0, resolved_at = ? WHERE id = ?`,
		now, complaintID,
	)
	if err != nil {
		return nil, err
	}

	_ = database.AuditLog("complaint", complaintID, "reject", "pending", "rejected", operator)

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetComplaint(complaintID)
}

func (s *ComplaintService) GetComplaint(id string) (*models.Complaint, error) {
	var c models.Complaint
	err := database.DB.QueryRow(
		`SELECT id, vendor_id, type, description, severity, points_deducted, status, reported_by, reported_at, resolved_at
		 FROM complaints WHERE id = ?`, id,
	).Scan(&c.ID, &c.VendorID, &c.Type, &c.Description, &c.Severity, &c.PointsDeducted, &c.Status, &c.ReportedBy, &c.ReportedAt, &c.ResolvedAt)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *ComplaintService) GetVendorComplaints(vendorID string) ([]models.Complaint, error) {
	rows, err := database.DB.Query(
		`SELECT id, vendor_id, type, description, severity, points_deducted, status, reported_by, reported_at, resolved_at
		 FROM complaints WHERE vendor_id = ? ORDER BY reported_at DESC`, vendorID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []models.Complaint
	for rows.Next() {
		var c models.Complaint
		err := rows.Scan(&c.ID, &c.VendorID, &c.Type, &c.Description, &c.Severity, &c.PointsDeducted, &c.Status, &c.ReportedBy, &c.ReportedAt, &c.ResolvedAt)
		if err != nil {
			return nil, err
		}
		complaints = append(complaints, c)
	}
	return complaints, nil
}

func (s *ComplaintService) GetPendingComplaints() ([]models.Complaint, error) {
	rows, err := database.DB.Query(
		`SELECT id, vendor_id, type, description, severity, points_deducted, status, reported_by, reported_at, resolved_at
		 FROM complaints WHERE status = 'pending' ORDER BY reported_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var complaints []models.Complaint
	for rows.Next() {
		var c models.Complaint
		err := rows.Scan(&c.ID, &c.VendorID, &c.Type, &c.Description, &c.Severity, &c.PointsDeducted, &c.Status, &c.ReportedBy, &c.ReportedAt, &c.ResolvedAt)
		if err != nil {
			return nil, err
		}
		complaints = append(complaints, c)
	}
	return complaints, nil
}
