package dao

import (
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateProductionReport(report *model.ProductionReport) error {
	report.ID = uuid.New().String()
	report.GeneratedAt = time.Now()

	query := `INSERT INTO production_reports (id, order_id, proof_version_id, report_no,
	          production_date, actual_quantity, result, generated_by, generated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, report.ID, report.OrderID, report.ProofVersionID,
		report.ReportNo, report.ProductionDate, report.ActualQuantity, report.Result,
		report.GeneratedBy, report.GeneratedAt)
	return err
}

func GetProductionReportByID(id string) (*model.ProductionReport, error) {
	query := `SELECT id, order_id, proof_version_id, report_no, production_date,
	          actual_quantity, result, generated_by, generated_at
	          FROM production_reports WHERE id = ?`

	var r model.ProductionReport
	err := database.DB.QueryRow(query, id).Scan(&r.ID, &r.OrderID, &r.ProofVersionID,
		&r.ReportNo, &r.ProductionDate, &r.ActualQuantity, &r.Result,
		&r.GeneratedBy, &r.GeneratedAt)
	return &r, err
}

func GetProductionReportsByOrder(orderID string) ([]*model.ProductionReport, error) {
	query := `SELECT id, order_id, proof_version_id, report_no, production_date,
	          actual_quantity, result, generated_by, generated_at
	          FROM production_reports WHERE order_id = ? ORDER BY generated_at DESC`

	rows, err := database.DB.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*model.ProductionReport
	for rows.Next() {
		var r model.ProductionReport
		err := rows.Scan(&r.ID, &r.OrderID, &r.ProofVersionID, &r.ReportNo,
			&r.ProductionDate, &r.ActualQuantity, &r.Result, &r.GeneratedBy, &r.GeneratedAt)
		if err != nil {
			return nil, err
		}
		reports = append(reports, &r)
	}
	return reports, nil
}

func HasProductionReport(versionID string) (bool, error) {
	query := `SELECT COUNT(*) FROM production_reports WHERE proof_version_id = ?`
	var count int
	err := database.DB.QueryRow(query, versionID).Scan(&count)
	return count > 0, err
}
