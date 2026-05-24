package database

import (
	"database/sql"
	"encoding/json"
	"time"

	"fireworks-humidity-api/internal/models"
)

type Repository struct {
	DB *DB
}

func NewRepository(db *DB) *Repository {
	return &Repository{DB: db}
}

func (r *Repository) GetAreaByCode(code string) (*models.WarehouseArea, error) {
	var area models.WarehouseArea
	var createdAt, updatedAt string

	err := r.DB.QueryRow(`
		SELECT id, code, name, capacity, humidity_min, humidity_max, status, created_at, updated_at
		FROM warehouse_areas WHERE code = ?
	`, code).Scan(&area.ID, &area.Code, &area.Name, &area.Capacity, &area.HumidityMin, &area.HumidityMax, &area.Status, &createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrAreaNotFound
	}
	if err != nil {
		return nil, err
	}

	area.CreatedAt, _ = ParseTime(createdAt)
	area.UpdatedAt, _ = ParseTime(updatedAt)
	return &area, nil
}

func (r *Repository) GetAreaByID(id int64) (*models.WarehouseArea, error) {
	var area models.WarehouseArea
	var createdAt, updatedAt string

	err := r.DB.QueryRow(`
		SELECT id, code, name, capacity, humidity_min, humidity_max, status, created_at, updated_at
		FROM warehouse_areas WHERE id = ?
	`, id).Scan(&area.ID, &area.Code, &area.Name, &area.Capacity, &area.HumidityMin, &area.HumidityMax, &area.Status, &createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrAreaNotFound
	}
	if err != nil {
		return nil, err
	}

	area.CreatedAt, _ = ParseTime(createdAt)
	area.UpdatedAt, _ = ParseTime(updatedAt)
	return &area, nil
}

func (r *Repository) ListAreas() ([]models.WarehouseArea, error) {
	rows, err := r.DB.Query(`
		SELECT id, code, name, capacity, humidity_min, humidity_max, status, created_at, updated_at
		FROM warehouse_areas ORDER BY code
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var areas []models.WarehouseArea
	for rows.Next() {
		var area models.WarehouseArea
		var createdAt, updatedAt string
		err := rows.Scan(&area.ID, &area.Code, &area.Name, &area.Capacity, &area.HumidityMin, &area.HumidityMax, &area.Status, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}
		area.CreatedAt, _ = ParseTime(createdAt)
		area.UpdatedAt, _ = ParseTime(updatedAt)
		areas = append(areas, area)
	}
	return areas, nil
}

func (r *Repository) GetBatchByNo(batchNo string) (*models.FireworksBatch, error) {
	var batch models.FireworksBatch
	var createdAt, updatedAt, manuDate, expiryDate string

	err := r.DB.QueryRow(`
		SELECT id, batch_no, product_name, quantity, current_area_id, current_area_code, status, manufacture_date, expiry_date, created_at, updated_at
		FROM fireworks_batches WHERE batch_no = ?
	`, batchNo).Scan(&batch.ID, &batch.BatchNo, &batch.ProductName, &batch.Quantity, &batch.CurrentAreaID, &batch.CurrentAreaCode, &batch.Status, &manuDate, &expiryDate, &createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrBatchNotFound
	}
	if err != nil {
		return nil, err
	}

	batch.ManufactureDate, _ = ParseTime(manuDate)
	batch.ExpiryDate, _ = ParseTime(expiryDate)
	batch.CreatedAt, _ = ParseTime(createdAt)
	batch.UpdatedAt, _ = ParseTime(updatedAt)
	return &batch, nil
}

func (r *Repository) GetBatchByID(id int64) (*models.FireworksBatch, error) {
	var batch models.FireworksBatch
	var createdAt, updatedAt, manuDate, expiryDate string

	err := r.DB.QueryRow(`
		SELECT id, batch_no, product_name, quantity, current_area_id, current_area_code, status, manufacture_date, expiry_date, created_at, updated_at
		FROM fireworks_batches WHERE id = ?
	`, id).Scan(&batch.ID, &batch.BatchNo, &batch.ProductName, &batch.Quantity, &batch.CurrentAreaID, &batch.CurrentAreaCode, &batch.Status, &manuDate, &expiryDate, &createdAt, &updatedAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrBatchNotFound
	}
	if err != nil {
		return nil, err
	}

	batch.ManufactureDate, _ = ParseTime(manuDate)
	batch.ExpiryDate, _ = ParseTime(expiryDate)
	batch.CreatedAt, _ = ParseTime(createdAt)
	batch.UpdatedAt, _ = ParseTime(updatedAt)
	return &batch, nil
}

func (r *Repository) GetBatchesByArea(areaID int64) ([]models.FireworksBatch, error) {
	rows, err := r.DB.Query(`
		SELECT id, batch_no, product_name, quantity, current_area_id, current_area_code, status, manufacture_date, expiry_date, created_at, updated_at
		FROM fireworks_batches WHERE current_area_id = ? ORDER BY batch_no
	`, areaID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var batches []models.FireworksBatch
	for rows.Next() {
		var batch models.FireworksBatch
		var createdAt, updatedAt, manuDate, expiryDate string
		err := rows.Scan(&batch.ID, &batch.BatchNo, &batch.ProductName, &batch.Quantity, &batch.CurrentAreaID, &batch.CurrentAreaCode, &batch.Status, &manuDate, &expiryDate, &createdAt, &updatedAt)
		if err != nil {
			return nil, err
		}
		batch.ManufactureDate, _ = ParseTime(manuDate)
		batch.ExpiryDate, _ = ParseTime(expiryDate)
		batch.CreatedAt, _ = ParseTime(createdAt)
		batch.UpdatedAt, _ = ParseTime(updatedAt)
		batches = append(batches, batch)
	}
	return batches, nil
}

func (r *Repository) CreateSample(tx *sql.Tx, sample *models.HumiditySample) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO humidity_samples (request_id, area_id, area_code, humidity, temperature, sampled_at, sampled_by, status, window_start, window_end, risk_level)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, sample.RequestID, sample.AreaID, sample.AreaCode, sample.Humidity, sample.Temperature, FormatTime(sample.SampledAt), sample.SampledBy, sample.Status, FormatTime(sample.WindowStart), FormatTime(sample.WindowEnd), sample.RiskLevel)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetSampleByRequestID(requestID string) (*models.HumiditySample, error) {
	var sample models.HumiditySample
	var sampledAt, windowStart, windowEnd, createdAt string
	var reviewedBy *string
	var reviewedAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, area_id, area_code, humidity, temperature, sampled_at, sampled_by, status, window_start, window_end, risk_level, disposal_id, reviewed_by, reviewed_at, created_at
		FROM humidity_samples WHERE request_id = ?
	`, requestID).Scan(&sample.ID, &sample.RequestID, &sample.AreaID, &sample.AreaCode, &sample.Humidity, &sample.Temperature, &sampledAt, &sample.SampledBy, &sample.Status, &windowStart, &windowEnd, &sample.RiskLevel, &sample.DisposalID, &reviewedBy, &reviewedAt, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrSampleNotFound
	}
	if err != nil {
		return nil, err
	}

	sample.SampledAt, _ = ParseTime(sampledAt)
	sample.WindowStart, _ = ParseTime(windowStart)
	sample.WindowEnd, _ = ParseTime(windowEnd)
	sample.CreatedAt, _ = ParseTime(createdAt)
	sample.ReviewedBy = reviewedBy
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		sample.ReviewedAt = &t
	}
	return &sample, nil
}

func (r *Repository) GetSampleByID(id int64) (*models.HumiditySample, error) {
	var sample models.HumiditySample
	var sampledAt, windowStart, windowEnd, createdAt string
	var reviewedBy *string
	var reviewedAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, area_id, area_code, humidity, temperature, sampled_at, sampled_by, status, window_start, window_end, risk_level, disposal_id, reviewed_by, reviewed_at, created_at
		FROM humidity_samples WHERE id = ?
	`, id).Scan(&sample.ID, &sample.RequestID, &sample.AreaID, &sample.AreaCode, &sample.Humidity, &sample.Temperature, &sampledAt, &sample.SampledBy, &sample.Status, &windowStart, &windowEnd, &sample.RiskLevel, &sample.DisposalID, &reviewedBy, &reviewedAt, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrSampleNotFound
	}
	if err != nil {
		return nil, err
	}

	sample.SampledAt, _ = ParseTime(sampledAt)
	sample.WindowStart, _ = ParseTime(windowStart)
	sample.WindowEnd, _ = ParseTime(windowEnd)
	sample.CreatedAt, _ = ParseTime(createdAt)
	sample.ReviewedBy = reviewedBy
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		sample.ReviewedAt = &t
	}
	return &sample, nil
}

func (r *Repository) UpdateSampleStatus(tx *sql.Tx, id int64, status string, disposalID *int64) error {
	_, err := tx.Exec(`
		UPDATE humidity_samples SET status = ?, disposal_id = COALESCE(?, disposal_id) WHERE id = ?
	`, status, disposalID, id)
	return err
}

func (r *Repository) CreateVentilation(tx *sql.Tx, vent *models.VentilationAction) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO ventilation_actions (request_id, area_id, area_code, sample_id, started_at, operator, before_humidity, status, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)
	`, vent.RequestID, vent.AreaID, vent.AreaCode, vent.SampleID, FormatTime(vent.StartedAt), vent.Operator, vent.BeforeHumidity, vent.Remark)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetVentilationByRequestID(requestID string) (*models.VentilationAction, error) {
	var vent models.VentilationAction
	var startedAt, createdAt string
	var endedAt *string
	var reviewedBy *string
	var reviewedAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, area_id, area_code, sample_id, started_at, ended_at, duration_minutes, operator, before_humidity, after_humidity, status, reviewed_by, reviewed_at, remark, created_at
		FROM ventilation_actions WHERE request_id = ?
	`, requestID).Scan(&vent.ID, &vent.RequestID, &vent.AreaID, &vent.AreaCode, &vent.SampleID, &startedAt, &endedAt, &vent.Duration, &vent.Operator, &vent.BeforeHumidity, &vent.AfterHumidity, &vent.Status, &reviewedBy, &reviewedAt, &vent.Remark, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	vent.StartedAt, _ = ParseTime(startedAt)
	vent.CreatedAt, _ = ParseTime(createdAt)
	vent.ReviewedBy = reviewedBy
	if endedAt != nil {
		t, _ := ParseTime(*endedAt)
		vent.EndedAt = &t
	}
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		vent.ReviewedAt = &t
	}
	return &vent, nil
}

func (r *Repository) CompleteVentilation(tx *sql.Tx, id int64, endedAt time.Time, duration int, afterHumidity float64) error {
	_, err := tx.Exec(`
		UPDATE ventilation_actions SET ended_at = ?, duration_minutes = ?, after_humidity = ?, status = 'completed' WHERE id = ?
	`, FormatTime(endedAt), duration, afterHumidity, id)
	return err
}

func (r *Repository) CreateTransfer(tx *sql.Tx, transfer *models.TransferRecord) (int64, error) {
	result, err := tx.Exec(`
		INSERT INTO transfer_records (request_id, batch_id, batch_no, from_area_id, from_area_code, to_area_id, to_area_code, quantity, operator, transferred_at, status, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed', ?)
	`, transfer.RequestID, transfer.BatchID, transfer.BatchNo, transfer.FromAreaID, transfer.FromAreaCode, transfer.ToAreaID, transfer.ToAreaCode, transfer.Quantity, transfer.Operator, FormatTime(transfer.TransferredAt), transfer.Remark)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetTransferByRequestID(requestID string) (*models.TransferRecord, error) {
	var transfer models.TransferRecord
	var transferredAt, createdAt string
	var reviewedBy *string
	var reviewedAt *string
	var undoneBy *string
	var undoneAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, batch_id, batch_no, from_area_id, from_area_code, to_area_id, to_area_code, quantity, operator, transferred_at, status, reviewed_by, reviewed_at, remark, undone, undone_by, undone_at, created_at
		FROM transfer_records WHERE request_id = ?
	`, requestID).Scan(&transfer.ID, &transfer.RequestID, &transfer.BatchID, &transfer.BatchNo, &transfer.FromAreaID, &transfer.FromAreaCode, &transfer.ToAreaID, &transfer.ToAreaCode, &transfer.Quantity, &transfer.Operator, &transferredAt, &transfer.Status, &reviewedBy, &reviewedAt, &transfer.Remark, &transfer.Undone, &undoneBy, &undoneAt, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	transfer.TransferredAt, _ = ParseTime(transferredAt)
	transfer.CreatedAt, _ = ParseTime(createdAt)
	transfer.ReviewedBy = reviewedBy
	transfer.UndoneBy = undoneBy
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		transfer.ReviewedAt = &t
	}
	if undoneAt != nil {
		t, _ := ParseTime(*undoneAt)
		transfer.UndoneAt = &t
	}
	return &transfer, nil
}

func (r *Repository) GetTransferByID(id int64) (*models.TransferRecord, error) {
	var transfer models.TransferRecord
	var transferredAt, createdAt string
	var reviewedBy *string
	var reviewedAt *string
	var undoneBy *string
	var undoneAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, batch_id, batch_no, from_area_id, from_area_code, to_area_id, to_area_code, quantity, operator, transferred_at, status, reviewed_by, reviewed_at, remark, undone, undone_by, undone_at, created_at
		FROM transfer_records WHERE id = ?
	`, id).Scan(&transfer.ID, &transfer.RequestID, &transfer.BatchID, &transfer.BatchNo, &transfer.FromAreaID, &transfer.FromAreaCode, &transfer.ToAreaID, &transfer.ToAreaCode, &transfer.Quantity, &transfer.Operator, &transferredAt, &transfer.Status, &reviewedBy, &reviewedAt, &transfer.Remark, &transfer.Undone, &undoneBy, &undoneAt, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrTransferNotFound
	}
	if err != nil {
		return nil, err
	}

	transfer.TransferredAt, _ = ParseTime(transferredAt)
	transfer.CreatedAt, _ = ParseTime(createdAt)
	transfer.ReviewedBy = reviewedBy
	transfer.UndoneBy = undoneBy
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		transfer.ReviewedAt = &t
	}
	if undoneAt != nil {
		t, _ := ParseTime(*undoneAt)
		transfer.UndoneAt = &t
	}
	return &transfer, nil
}

func (r *Repository) UpdateBatchArea(tx *sql.Tx, batchID int64, areaID int64, areaCode string, quantity int) error {
	_, err := tx.Exec(`
		UPDATE fireworks_batches SET current_area_id = ?, current_area_code = ?, quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
	`, areaID, areaCode, quantity, batchID)
	return err
}

func (r *Repository) UndoTransfer(tx *sql.Tx, transferID int64, undoneBy string, undoneAt time.Time) error {
	_, err := tx.Exec(`
		UPDATE transfer_records SET undone = 1, undone_by = ?, undone_at = ?, status = 'undone' WHERE id = ?
	`, undoneBy, FormatTime(undoneAt), transferID)
	return err
}

func (r *Repository) GetBatchTransferHistory(batchID int64) ([]models.TransferRecord, error) {
	rows, err := r.DB.Query(`
		SELECT id, request_id, batch_id, batch_no, from_area_id, from_area_code, to_area_id, to_area_code, quantity, operator, transferred_at, status, undone, created_at
		FROM transfer_records WHERE batch_id = ? ORDER BY transferred_at DESC
	`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.TransferRecord
	for rows.Next() {
		var tr models.TransferRecord
		var transferredAt, createdAt string
		err := rows.Scan(&tr.ID, &tr.RequestID, &tr.BatchID, &tr.BatchNo, &tr.FromAreaID, &tr.FromAreaCode, &tr.ToAreaID, &tr.ToAreaCode, &tr.Quantity, &tr.Operator, &transferredAt, &tr.Status, &tr.Undone, &createdAt)
		if err != nil {
			return nil, err
		}
		tr.TransferredAt, _ = ParseTime(transferredAt)
		tr.CreatedAt, _ = ParseTime(createdAt)
		records = append(records, tr)
	}
	return records, nil
}

func (r *Repository) CreateInspection(tx *sql.Tx, inspection *models.InspectionRecord) (int64, error) {
	photos := JoinStrings(inspection.Photos)
	result, err := tx.Exec(`
		INSERT INTO inspection_records (request_id, batch_id, batch_no, area_id, area_code, inspected_at, inspector, package_check, humidity_check, quality_status, photos, remark, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed')
	`, inspection.RequestID, inspection.BatchID, inspection.BatchNo, inspection.AreaID, inspection.AreaCode, FormatTime(inspection.InspectedAt), inspection.Inspector, inspection.PackageCheck, inspection.HumidityCheck, inspection.QualityStatus, photos, inspection.Remark)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetInspectionByRequestID(requestID string) (*models.InspectionRecord, error) {
	var inspection models.InspectionRecord
	var inspectedAt, createdAt, photos string
	var reviewedBy *string
	var reviewedAt *string

	err := r.DB.QueryRow(`
		SELECT id, request_id, batch_id, batch_no, area_id, area_code, inspected_at, inspector, package_check, humidity_check, quality_status, photos, remark, status, reviewed_by, reviewed_at, created_at
		FROM inspection_records WHERE request_id = ?
	`, requestID).Scan(&inspection.ID, &inspection.RequestID, &inspection.BatchID, &inspection.BatchNo, &inspection.AreaID, &inspection.AreaCode, &inspectedAt, &inspection.Inspector, &inspection.PackageCheck, &inspection.HumidityCheck, &inspection.QualityStatus, &photos, &inspection.Remark, &inspection.Status, &reviewedBy, &reviewedAt, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	inspection.InspectedAt, _ = ParseTime(inspectedAt)
	inspection.CreatedAt, _ = ParseTime(createdAt)
	inspection.Photos = SplitStrings(photos)
	inspection.ReviewedBy = reviewedBy
	if reviewedAt != nil {
		t, _ := ParseTime(*reviewedAt)
		inspection.ReviewedAt = &t
	}
	return &inspection, nil
}

func (r *Repository) GetBatchInspectionHistory(batchID int64) ([]models.InspectionRecord, error) {
	rows, err := r.DB.Query(`
		SELECT id, request_id, batch_id, batch_no, area_id, area_code, inspected_at, inspector, quality_status, status, created_at
		FROM inspection_records WHERE batch_id = ? ORDER BY inspected_at DESC
	`, batchID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.InspectionRecord
	for rows.Next() {
		var ir models.InspectionRecord
		var inspectedAt, createdAt string
		err := rows.Scan(&ir.ID, &ir.RequestID, &ir.BatchID, &ir.BatchNo, &ir.AreaID, &ir.AreaCode, &inspectedAt, &ir.Inspector, &ir.QualityStatus, &ir.Status, &createdAt)
		if err != nil {
			return nil, err
		}
		ir.InspectedAt, _ = ParseTime(inspectedAt)
		ir.CreatedAt, _ = ParseTime(createdAt)
		records = append(records, ir)
	}
	return records, nil
}

func (r *Repository) ReviewSample(tx *sql.Tx, id int64, reviewedBy string, reviewedAt time.Time) error {
	_, err := tx.Exec(`
		UPDATE humidity_samples SET reviewed_by = ?, reviewed_at = ?, status = 'reviewed' WHERE id = ?
	`, reviewedBy, FormatTime(reviewedAt), id)
	return err
}

func (r *Repository) ReviewVentilation(tx *sql.Tx, id int64, reviewedBy string, reviewedAt time.Time) error {
	_, err := tx.Exec(`
		UPDATE ventilation_actions SET reviewed_by = ?, reviewed_at = ?, status = 'reviewed' WHERE id = ?
	`, reviewedBy, FormatTime(reviewedAt), id)
	return err
}

func (r *Repository) ReviewTransfer(tx *sql.Tx, id int64, reviewedBy string, reviewedAt time.Time) error {
	_, err := tx.Exec(`
		UPDATE transfer_records SET reviewed_by = ?, reviewed_at = ?, status = 'reviewed' WHERE id = ?
	`, reviewedBy, FormatTime(reviewedAt), id)
	return err
}

func (r *Repository) ReviewInspection(tx *sql.Tx, id int64, reviewedBy string, reviewedAt time.Time) error {
	_, err := tx.Exec(`
		UPDATE inspection_records SET reviewed_by = ?, reviewed_at = ?, status = 'reviewed' WHERE id = ?
	`, reviewedBy, FormatTime(reviewedAt), id)
	return err
}

func (r *Repository) CheckIdempotentRequest(requestID string) (*models.IdempotentRequest, error) {
	var req models.IdempotentRequest
	var createdAt string

	err := r.DB.QueryRow(`
		SELECT id, request_id, request_type, resource_type, resource_id, response_body, created_at
		FROM idempotent_requests WHERE request_id = ?
	`, requestID).Scan(&req.ID, &req.RequestID, &req.RequestType, &req.ResourceType, &req.ResourceID, &req.ResponseBody, &createdAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	req.CreatedAt, _ = ParseTime(createdAt)
	return &req, nil
}

func (r *Repository) SaveIdempotentRequest(tx *sql.Tx, req *models.IdempotentRequest) error {
	_, err := tx.Exec(`
		INSERT INTO idempotent_requests (request_id, request_type, resource_type, resource_id, response_body)
		VALUES (?, ?, ?, ?, ?)
	`, req.RequestID, req.RequestType, req.ResourceType, req.ResourceID, req.ResponseBody)
	return err
}

func (r *Repository) CreateReport(report *models.RiskReport) (int64, error) {
	recommendations := JoinStrings(report.Recommendations)
	result, err := r.DB.Exec(`
		INSERT INTO risk_reports (report_no, report_type, period_start, period_end, generated_at, generated_by, total_samples, over_limit_count, transfer_count, inspection_count, ventilation_count, risk_level, summary, recommendations, status)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'generated')
	`, report.ReportNo, report.ReportType, FormatTime(report.PeriodStart), FormatTime(report.PeriodEnd), FormatTime(report.GeneratedAt), report.GeneratedBy, report.TotalSamples, report.OverLimitCount, report.TransferCount, report.InspectionCount, report.VentilationCount, report.RiskLevel, report.Summary, recommendations)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (r *Repository) GetReportByNo(reportNo string) (*models.RiskReport, error) {
	var report models.RiskReport
	var periodStart, periodEnd, generatedAt, createdAt, recommendations string

	err := r.DB.QueryRow(`
		SELECT id, report_no, report_type, period_start, period_end, generated_at, generated_by, total_samples, over_limit_count, transfer_count, inspection_count, ventilation_count, risk_level, summary, recommendations, status, created_at
		FROM risk_reports WHERE report_no = ?
	`, reportNo).Scan(&report.ID, &report.ReportNo, &report.ReportType, &periodStart, &periodEnd, &generatedAt, &report.GeneratedBy, &report.TotalSamples, &report.OverLimitCount, &report.TransferCount, &report.InspectionCount, &report.VentilationCount, &report.RiskLevel, &report.Summary, &recommendations, &report.Status, &createdAt)

	if err == sql.ErrNoRows {
		return nil, models.ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	report.PeriodStart, _ = ParseTime(periodStart)
	report.PeriodEnd, _ = ParseTime(periodEnd)
	report.GeneratedAt, _ = ParseTime(generatedAt)
	report.CreatedAt, _ = ParseTime(createdAt)
	report.Recommendations = SplitStrings(recommendations)
	return &report, nil
}

func (r *Repository) GetSamplesForReport(periodStart, periodEnd time.Time) ([]models.HumiditySample, error) {
	rows, err := r.DB.Query(`
		SELECT id, area_id, area_code, humidity, sampled_at, status, risk_level
		FROM humidity_samples WHERE sampled_at >= ? AND sampled_at <= ? ORDER BY sampled_at
	`, FormatTime(periodStart), FormatTime(periodEnd))
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []models.HumiditySample
	for rows.Next() {
		var s models.HumiditySample
		var sampledAt string
		err := rows.Scan(&s.ID, &s.AreaID, &s.AreaCode, &s.Humidity, &sampledAt, &s.Status, &s.RiskLevel)
		if err != nil {
			return nil, err
		}
		s.SampledAt, _ = ParseTime(sampledAt)
		samples = append(samples, s)
	}
	return samples, nil
}

func (r *Repository) CountActionsForReport(periodStart, periodEnd time.Time) (ventCount int, transferCount int, inspectionCount int, err error) {
	err = r.DB.QueryRow(`
		SELECT COUNT(*) FROM ventilation_actions WHERE created_at >= ? AND created_at <= ?
	`, FormatTime(periodStart), FormatTime(periodEnd)).Scan(&ventCount)
	if err != nil {
		return
	}

	err = r.DB.QueryRow(`
		SELECT COUNT(*) FROM transfer_records WHERE created_at >= ? AND created_at <= ? AND undone = 0
	`, FormatTime(periodStart), FormatTime(periodEnd)).Scan(&transferCount)
	if err != nil {
		return
	}

	err = r.DB.QueryRow(`
		SELECT COUNT(*) FROM inspection_records WHERE created_at >= ? AND created_at <= ?
	`, FormatTime(periodStart), FormatTime(periodEnd)).Scan(&inspectionCount)
	return
}

func (r *Repository) CreateAuditLog(tx *sql.Tx, action, resourceType string, resourceID int64, operator string, oldValue, newValue interface{}) error {
	oldJSON, _ := json.Marshal(oldValue)
	newJSON, _ := json.Marshal(newValue)
	_, err := tx.Exec(`
		INSERT INTO audit_logs (action, resource_type, resource_id, operator, old_value, new_value)
		VALUES (?, ?, ?, ?, ?, ?)
	`, action, resourceType, resourceID, operator, string(oldJSON), string(newJSON))
	return err
}

func (r *Repository) ListPendingReviews() (map[string]interface{}, error) {
	result := make(map[string]interface{})

	var samples []models.HumiditySample
	rows, err := r.DB.Query(`
		SELECT id, request_id, area_code, humidity, sampled_at, status, risk_level
		FROM humidity_samples WHERE status IN ('over_limit', 'resolved') AND reviewed_by IS NULL
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var s models.HumiditySample
			var sampledAt string
			rows.Scan(&s.ID, &s.RequestID, &s.AreaCode, &s.Humidity, &sampledAt, &s.Status, &s.RiskLevel)
			s.SampledAt, _ = ParseTime(sampledAt)
			samples = append(samples, s)
		}
	}
	result["samples"] = samples

	var vents []models.VentilationAction
	rows, err = r.DB.Query(`
		SELECT id, request_id, area_code, started_at, status
		FROM ventilation_actions WHERE status = 'completed' AND reviewed_by IS NULL
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var v models.VentilationAction
			var startedAt string
			rows.Scan(&v.ID, &v.RequestID, &v.AreaCode, &startedAt, &v.Status)
			v.StartedAt, _ = ParseTime(startedAt)
			vents = append(vents, v)
		}
	}
	result["ventilations"] = vents

	var transfers []models.TransferRecord
	rows, err = r.DB.Query(`
		SELECT id, request_id, batch_no, from_area_code, to_area_code, quantity, transferred_at, status
		FROM transfer_records WHERE status = 'completed' AND reviewed_by IS NULL AND undone = 0
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var t models.TransferRecord
			var transferredAt string
			rows.Scan(&t.ID, &t.RequestID, &t.BatchNo, &t.FromAreaCode, &t.ToAreaCode, &t.Quantity, &transferredAt, &t.Status)
			t.TransferredAt, _ = ParseTime(transferredAt)
			transfers = append(transfers, t)
		}
	}
	result["transfers"] = transfers

	var inspections []models.InspectionRecord
	rows, err = r.DB.Query(`
		SELECT id, request_id, batch_no, area_code, inspected_at, quality_status, status
		FROM inspection_records WHERE status = 'completed' AND reviewed_by IS NULL
	`)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var i models.InspectionRecord
			var inspectedAt string
			rows.Scan(&i.ID, &i.RequestID, &i.BatchNo, &i.AreaCode, &inspectedAt, &i.QualityStatus, &i.Status)
			i.InspectedAt, _ = ParseTime(inspectedAt)
			inspections = append(inspections, i)
		}
	}
	result["inspections"] = inspections

	return result, nil
}
