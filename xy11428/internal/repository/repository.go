package repository

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"visitor-pass/internal/config"
	"visitor-pass/internal/model"
)

func CreateBatch(batch *model.Batch) error {
	now := time.Now()
	if batch.CreatedAt.IsZero() {
		batch.CreatedAt = now
		batch.UpdatedAt = now
	}
	_, err := config.DB.Exec(
		`INSERT INTO batches (id, name, source, status, is_frozen, total_records, failed_records, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		batch.ID, batch.Name, batch.Source, batch.Status, batch.IsFrozen,
		batch.TotalRecords, batch.FailedRecords, batch.CreatedBy, batch.CreatedAt, batch.UpdatedAt,
	)
	return err
}

func GetBatch(id string) (*model.Batch, error) {
	var batch model.Batch
	err := config.DB.QueryRow(
		`SELECT id, name, source, status, is_frozen, frozen_at, frozen_by, total_records, failed_records, created_by, created_at, updated_at
		 FROM batches WHERE id = ?`,
		id,
	).Scan(&batch.ID, &batch.Name, &batch.Source, &batch.Status, &batch.IsFrozen,
		&batch.FrozenAt, &batch.FrozenBy, &batch.TotalRecords, &batch.FailedRecords,
		&batch.CreatedBy, &batch.CreatedAt, &batch.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &batch, err
}

func ListBatches(offset, limit int) ([]model.Batch, int, error) {
	var batches []model.Batch
	var total int

	err := config.DB.QueryRow(`SELECT COUNT(*) FROM batches`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	rows, err := config.DB.Query(
		`SELECT id, name, source, status, is_frozen, total_records, failed_records, created_by, created_at, updated_at
		 FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var b model.Batch
		err := rows.Scan(&b.ID, &b.Name, &b.Source, &b.Status, &b.IsFrozen,
			&b.TotalRecords, &b.FailedRecords, &b.CreatedBy, &b.CreatedAt, &b.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		batches = append(batches, b)
	}
	return batches, total, nil
}

func FreezeBatch(batchID, userID string) error {
	now := time.Now()
	_, err := config.DB.Exec(
		`UPDATE batches SET is_frozen = 1, frozen_at = ?, frozen_by = ?, updated_at = ? WHERE id = ?`,
		now, userID, now, batchID,
	)
	return err
}

func CreateAppointment(appt *model.VisitorAppointment) error {
	now := time.Now()
	if appt.CreatedAt.IsZero() {
		appt.CreatedAt = now
		appt.UpdatedAt = now
	}
	_, err := config.DB.Exec(
		`INSERT INTO visitor_appointments (id, batch_id, visitor_name, visitor_id_card, visitor_phone, license_plate,
		 visit_date, visit_end_date, visit_reason, visitor_company, host_name, host_department, access_area,
		 status, is_frozen, created_by, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		appt.ID, appt.BatchID, appt.VisitorName, appt.VisitorIDCard, appt.VisitorPhone, appt.LicensePlate,
		appt.VisitDate, appt.VisitEndDate, appt.VisitReason, appt.VisitorCompany, appt.HostName,
		appt.HostDepartment, appt.AccessArea, appt.Status, appt.IsFrozen, appt.CreatedBy, appt.CreatedAt, appt.UpdatedAt,
	)
	return err
}

func GetAppointment(id string) (*model.VisitorAppointment, error) {
	var a model.VisitorAppointment
	err := config.DB.QueryRow(
		`SELECT id, batch_id, visitor_name, visitor_id_card, visitor_phone, license_plate,
		 visit_date, visit_end_date, visit_reason, visitor_company, host_name, host_department, access_area,
		 status, is_frozen, created_by, reviewed_by, reviewed_at, created_at, updated_at
		 FROM visitor_appointments WHERE id = ?`,
		id,
	).Scan(&a.ID, &a.BatchID, &a.VisitorName, &a.VisitorIDCard, &a.VisitorPhone, &a.LicensePlate,
		&a.VisitDate, &a.VisitEndDate, &a.VisitReason, &a.VisitorCompany, &a.HostName,
		&a.HostDepartment, &a.AccessArea, &a.Status, &a.IsFrozen, &a.CreatedBy, &a.ReviewedBy,
		&a.ReviewedAt, &a.CreatedAt, &a.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &a, err
}

func UpdateAppointment(appt *model.VisitorAppointment) error {
	appt.UpdatedAt = time.Now()
	_, err := config.DB.Exec(
		`UPDATE visitor_appointments SET visitor_name=?, visitor_id_card=?, visitor_phone=?, license_plate=?,
		 visit_date=?, visit_end_date=?, visit_reason=?, visitor_company=?, host_name=?, host_department=?,
		 access_area=?, status=?, reviewed_by=?, reviewed_at=?, updated_at=? WHERE id=?`,
		appt.VisitorName, appt.VisitorIDCard, appt.VisitorPhone, appt.LicensePlate,
		appt.VisitDate, appt.VisitEndDate, appt.VisitReason, appt.VisitorCompany, appt.HostName,
		appt.HostDepartment, appt.AccessArea, appt.Status, appt.ReviewedBy, appt.ReviewedAt, appt.UpdatedAt, appt.ID,
	)
	return err
}

func FreezeAppointment(id, userID string) error {
	now := time.Now()
	_, err := config.DB.Exec(
		`UPDATE visitor_appointments SET is_frozen = 1, frozen_at = ?, frozen_by = ?, updated_at = ? WHERE id = ?`,
		now, userID, now, id,
	)
	return err
}

func ListAppointments(batchID string, offset, limit int) ([]model.VisitorAppointment, int, error) {
	var appts []model.VisitorAppointment
	var total int

	countSQL := `SELECT COUNT(*) FROM visitor_appointments`
	querySQL := `SELECT id, batch_id, visitor_name, visitor_id_card, visitor_phone, license_plate,
		visit_date, visit_end_date, status, is_frozen, created_by, created_at FROM visitor_appointments`
	args := []interface{}{}

	if batchID != "" {
		countSQL += ` WHERE batch_id = ?`
		querySQL += ` WHERE batch_id = ?`
		args = append(args, batchID)
	}

	err := config.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	querySQL += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := config.DB.Query(querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var a model.VisitorAppointment
		err := rows.Scan(&a.ID, &a.BatchID, &a.VisitorName, &a.VisitorIDCard, &a.VisitorPhone, &a.LicensePlate,
			&a.VisitDate, &a.VisitEndDate, &a.Status, &a.IsFrozen, &a.CreatedBy, &a.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		appts = append(appts, a)
	}
	return appts, total, nil
}

func CreateGateRecord(gr *model.GateRecord) error {
	now := time.Now()
	if gr.CreatedAt.IsZero() {
		gr.CreatedAt = now
	}
	_, err := config.DB.Exec(
		`INSERT INTO gate_records (id, batch_id, gate_name, pass_direction, pass_time, license_plate,
		 visitor_name, visitor_id_card, temperature, staff_name, image_path, status,
		 matched_appt_id, match_status, reconciled, created_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		gr.ID, gr.BatchID, gr.GateName, gr.PassDirection, gr.PassTime, gr.LicensePlate,
		gr.VisitorName, gr.VisitorIDCard, gr.Temperature, gr.StaffName, gr.ImagePath, gr.Status,
		gr.MatchedApptID, gr.MatchStatus, gr.Reconciled, gr.CreatedBy, gr.CreatedAt,
	)
	return err
}

func GetGateRecord(id string) (*model.GateRecord, error) {
	var g model.GateRecord
	err := config.DB.QueryRow(
		`SELECT id, batch_id, gate_name, pass_direction, pass_time, license_plate,
		 visitor_name, visitor_id_card, temperature, staff_name, status, matched_appt_id, match_status, reconciled, created_by, created_at
		 FROM gate_records WHERE id = ?`,
		id,
	).Scan(&g.ID, &g.BatchID, &g.GateName, &g.PassDirection, &g.PassTime, &g.LicensePlate,
		&g.VisitorName, &g.VisitorIDCard, &g.Temperature, &g.StaffName, &g.Status,
		&g.MatchedApptID, &g.MatchStatus, &g.Reconciled, &g.CreatedBy, &g.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &g, err
}

func ListGateRecords(batchID string, offset, limit int) ([]model.GateRecord, int, error) {
	var records []model.GateRecord
	var total int

	countSQL := `SELECT COUNT(*) FROM gate_records`
	querySQL := `SELECT id, batch_id, gate_name, pass_direction, pass_time, license_plate,
		visitor_name, status, matched_appt_id, match_status, reconciled, created_at FROM gate_records`
	args := []interface{}{}

	if batchID != "" {
		countSQL += ` WHERE batch_id = ?`
		querySQL += ` WHERE batch_id = ?`
		args = append(args, batchID)
	}

	err := config.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	querySQL += ` ORDER BY pass_time DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := config.DB.Query(querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var g model.GateRecord
		err := rows.Scan(&g.ID, &g.BatchID, &g.GateName, &g.PassDirection, &g.PassTime, &g.LicensePlate,
			&g.VisitorName, &g.Status, &g.MatchedApptID, &g.MatchStatus, &g.Reconciled, &g.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		records = append(records, g)
	}
	return records, total, nil
}

func CreatePlateImage(pi *model.TempPlateImage) error {
	now := time.Now()
	if pi.CreatedAt.IsZero() {
		pi.CreatedAt = now
	}
	_, err := config.DB.Exec(
		`INSERT INTO temp_plate_images (id, batch_id, image_file_name, image_hash, license_plate,
		 recognized_plate, recognition_confidence, capture_time, capture_gate, status,
		 matched_gate_id, match_status, reconciled, created_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		pi.ID, pi.BatchID, pi.ImageFileName, pi.ImageHash, pi.LicensePlate,
		pi.RecognizedPlate, pi.RecognitionConf, pi.CaptureTime, pi.CaptureGate, pi.Status,
		pi.MatchedGateID, pi.MatchStatus, pi.Reconciled, pi.CreatedBy, pi.CreatedAt,
	)
	return err
}

func ListPlateImages(batchID string, offset, limit int) ([]model.TempPlateImage, int, error) {
	var images []model.TempPlateImage
	var total int

	countSQL := `SELECT COUNT(*) FROM temp_plate_images`
	querySQL := `SELECT id, batch_id, image_file_name, license_plate, recognized_plate,
		capture_time, capture_gate, match_status, reconciled, created_at FROM temp_plate_images`
	args := []interface{}{}

	if batchID != "" {
		countSQL += ` WHERE batch_id = ?`
		querySQL += ` WHERE batch_id = ?`
		args = append(args, batchID)
	}

	err := config.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	querySQL += ` ORDER BY capture_time DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := config.DB.Query(querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var p model.TempPlateImage
		err := rows.Scan(&p.ID, &p.BatchID, &p.ImageFileName, &p.LicensePlate, &p.RecognizedPlate,
			&p.CaptureTime, &p.CaptureGate, &p.MatchStatus, &p.Reconciled, &p.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		images = append(images, p)
	}
	return images, total, nil
}

func CreateImportFailure(f *model.ImportFailure) error {
	if f.CreatedAt.IsZero() {
		f.CreatedAt = time.Now()
	}
	_, err := config.DB.Exec(
		`INSERT INTO import_failures (id, batch_id, source_type, row_number, raw_data, failure_reason, field_errors, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		uuid.NewString(), f.BatchID, f.SourceType, f.RowNumber, f.RawData, f.FailureReason, f.FieldErrors, f.CreatedAt,
	)
	return err
}

func ListImportFailures(batchID string, offset, limit int) ([]model.ImportFailure, int, error) {
	var failures []model.ImportFailure
	var total int

	countSQL := `SELECT COUNT(*) FROM import_failures`
	querySQL := `SELECT id, batch_id, source_type, row_number, raw_data, failure_reason, field_errors, created_at FROM import_failures`
	args := []interface{}{}

	if batchID != "" {
		countSQL += ` WHERE batch_id = ?`
		querySQL += ` WHERE batch_id = ?`
		args = append(args, batchID)
	}

	err := config.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	querySQL += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := config.DB.Query(querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var f model.ImportFailure
		err := rows.Scan(&f.ID, &f.BatchID, &f.SourceType, &f.RowNumber, &f.RawData, &f.FailureReason, &f.FieldErrors, &f.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		failures = append(failures, f)
	}
	return failures, total, nil
}

func CreateReconciliationResult(r *model.ReconciliationResult) error {
	if r.CreatedAt.IsZero() {
		r.CreatedAt = time.Now()
	}
	_, err := config.DB.Exec(
		`INSERT INTO reconciliation_results (id, batch_id, reconcile_date, total_appointments, total_gate_records,
		 total_plate_images, matched_count, unmatched_count, cross_day_risk_count, expired_not_revoked,
		 status, report_path, created_by, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.BatchID, r.ReconcileDate, r.TotalAppointments, r.TotalGateRecords,
		r.TotalPlateImages, r.MatchedCount, r.UnmatchedCount, r.CrossDayRiskCount, r.ExpiredNotRevoked,
		r.Status, r.ReportPath, r.CreatedBy, r.CreatedAt,
	)
	return err
}

func ListReconciliationResults(batchID string, offset, limit int) ([]model.ReconciliationResult, int, error) {
	var results []model.ReconciliationResult
	var total int

	countSQL := `SELECT COUNT(*) FROM reconciliation_results`
	querySQL := `SELECT id, batch_id, reconcile_date, total_appointments, total_gate_records,
		total_plate_images, matched_count, unmatched_count, cross_day_risk_count, expired_not_revoked,
		status, created_by, created_at FROM reconciliation_results`
	args := []interface{}{}

	if batchID != "" {
		countSQL += ` WHERE batch_id = ?`
		querySQL += ` WHERE batch_id = ?`
		args = append(args, batchID)
	}

	err := config.DB.QueryRow(countSQL, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	querySQL += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`
	args = append(args, limit, offset)

	rows, err := config.DB.Query(querySQL, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	for rows.Next() {
		var r model.ReconciliationResult
		err := rows.Scan(&r.ID, &r.BatchID, &r.ReconcileDate, &r.TotalAppointments, &r.TotalGateRecords,
			&r.TotalPlateImages, &r.MatchedCount, &r.UnmatchedCount, &r.CrossDayRiskCount, &r.ExpiredNotRevoked,
			&r.Status, &r.CreatedBy, &r.CreatedAt)
		if err != nil {
			return nil, 0, err
		}
		results = append(results, r)
	}
	return results, total, nil
}

func GetDB() *sql.DB {
	return config.DB
}
