package repository

import (
	"database/sql"
	"encoding/json"
	"time"

	"vet-vaccine-cold-chain/database"
	"vet-vaccine-cold-chain/models"

	"github.com/google/uuid"
)

func CreateRefrigerator(r *models.Refrigerator) error {
	r.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO refrigerators (id, name, location) VALUES (?, ?, ?)",
		r.ID, r.Name, r.Location,
	)
	return err
}

func CreateVaccine(v *models.Vaccine) error {
	_, err := database.DB.Exec(
		"INSERT INTO vaccines (batch_number, name, manufacturer, expiry_date, total_doses) VALUES (?, ?, ?, ?, ?)",
		v.BatchNumber, v.Name, v.Manufacturer, v.ExpiryDate, v.TotalDoses,
	)
	return err
}

func CreateVaccineInventory(inv *models.VaccineInventory) error {
	inv.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO vaccine_inventory (id, batch_number, refrigerator_id, doses_count, status) VALUES (?, ?, ?, ?, ?)",
		inv.ID, inv.BatchNumber, inv.RefrigeratorID, inv.DosesCount, inv.Status,
	)
	return err
}

func CreateTemperatureRecord(tr *models.TemperatureRecord) error {
	tr.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO temperature_records (id, refrigerator_id, temperature, recorded_at, recorded_by, evidence_id) VALUES (?, ?, ?, ?, ?, ?)",
		tr.ID, tr.RefrigeratorID, tr.Temperature, tr.RecordedAt, tr.RecordedBy, tr.EvidenceID,
	)
	return err
}

func CreateOpenRecord(or *models.OpenRecord) error {
	or.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO open_records (id, inventory_id, batch_number, opened_at, opened_by, doses_used, status, evidence_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		or.ID, or.InventoryID, or.BatchNumber, or.OpenedAt, or.OpenedBy, or.DosesUsed, or.Status, or.EvidenceID,
	)
	return err
}

func UpdateOpenRecord(or *models.OpenRecord) error {
	_, err := database.DB.Exec(
		"UPDATE open_records SET doses_used = ?, status = ?, closed_at = ?, closed_by = ? WHERE id = ?",
		or.DosesUsed, or.Status, or.ClosedAt, or.ClosedBy, or.ID,
	)
	return err
}

func GetOpenRecordByID(id string) (*models.OpenRecord, error) {
	var or models.OpenRecord
	err := database.DB.QueryRow(
		"SELECT id, inventory_id, batch_number, opened_at, opened_by, doses_used, status, closed_at, closed_by, evidence_id FROM open_records WHERE id = ?",
		id,
	).Scan(&or.ID, &or.InventoryID, &or.BatchNumber, &or.OpenedAt, &or.OpenedBy, &or.DosesUsed, &or.Status, &or.ClosedAt, &or.ClosedBy, &or.EvidenceID)
	if err != nil {
		return nil, err
	}
	return &or, nil
}

func CreateTransferRecord(tr *models.TransferRecord) error {
	tr.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO transfer_records (id, batch_number, from_refrigerator_id, to_refrigerator_id, doses_count, transferred_by, reason, evidence_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		tr.ID, tr.BatchNumber, tr.FromRefrigeratorID, tr.ToRefrigeratorID, tr.DosesCount, tr.TransferredBy, tr.Reason, tr.EvidenceID,
	)
	return err
}

func GetTransfersByBatch(batchNumber string) ([]models.TransferRecord, error) {
	rows, err := database.DB.Query(
		"SELECT id, batch_number, from_refrigerator_id, to_refrigerator_id, doses_count, transferred_at, transferred_by, reason, evidence_id FROM transfer_records WHERE batch_number = ? ORDER BY transferred_at",
		batchNumber,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var transfers []models.TransferRecord
	for rows.Next() {
		var t models.TransferRecord
		err := rows.Scan(&t.ID, &t.BatchNumber, &t.FromRefrigeratorID, &t.ToRefrigeratorID, &t.DosesCount, &t.TransferredAt, &t.TransferredBy, &t.Reason, &t.EvidenceID)
		if err != nil {
			return nil, err
		}
		transfers = append(transfers, t)
	}
	return transfers, nil
}

func CreateDiscardRecord(dr *models.DiscardRecord) error {
	dr.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO discard_records (id, batch_number, inventory_id, open_record_id, doses_count, reason, discarded_by, evidence_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		dr.ID, dr.BatchNumber, dr.InventoryID, dr.OpenRecordID, dr.DosesCount, dr.Reason, dr.DiscardedBy, dr.EvidenceID,
	)
	return err
}

func ConfirmDiscard(id, confirmedBy string) error {
	now := time.Now()
	_, err := database.DB.Exec(
		"UPDATE discard_records SET confirmed = 1, confirmed_at = ?, confirmed_by = ? WHERE id = ?",
		now, confirmedBy, id,
	)
	return err
}

func CreateVaccinationRecord(vr *models.VaccinationRecord) error {
	vr.ID = uuid.NewString()
	_, err := database.DB.Exec(
		"INSERT INTO vaccination_records (id, batch_number, open_record_id, patient_id, doctor_signature, evidence_id) VALUES (?, ?, ?, ?, ?, ?)",
		vr.ID, vr.BatchNumber, vr.OpenRecordID, vr.PatientID, vr.DoctorSignature, vr.EvidenceID,
	)
	return err
}

func AddEvidenceChain(ec *models.EvidenceChain) (int, error) {
	var maxVersion int
	err := database.DB.QueryRow(
		"SELECT COALESCE(MAX(version), 0) FROM evidence_chains WHERE business_key = ? AND business_type = ?",
		ec.BusinessKey, ec.BusinessType,
	).Scan(&maxVersion)
	if err != nil && err != sql.ErrNoRows {
		return 0, err
	}

	ec.ID = uuid.NewString()
	ec.Version = maxVersion + 1
	ec.SubmittedAt = time.Now()

	_, err = database.DB.Exec(
		"INSERT INTO evidence_chains (id, business_key, business_type, evidence_type, evidence_data, submitted_by, submitted_at, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		ec.ID, ec.BusinessKey, ec.BusinessType, ec.EvidenceType, ec.EvidenceData, ec.SubmittedBy, ec.SubmittedAt, ec.Version,
	)
	return ec.Version, err
}

func GetEvidenceChain(businessKey, businessType string) ([]models.EvidenceChain, error) {
	rows, err := database.DB.Query(
		"SELECT id, business_key, business_type, evidence_type, evidence_data, submitted_by, submitted_at, version FROM evidence_chains WHERE business_key = ? AND business_type = ? ORDER BY version DESC",
		businessKey, businessType,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var chains []models.EvidenceChain
	for rows.Next() {
		var ec models.EvidenceChain
		err := rows.Scan(&ec.ID, &ec.BusinessKey, &ec.BusinessType, &ec.EvidenceType, &ec.EvidenceData, &ec.SubmittedBy, &ec.SubmittedAt, &ec.Version)
		if err != nil {
			return nil, err
		}
		chains = append(chains, ec)
	}
	return chains, nil
}

func GetBusinessResult(businessKey, businessType string) (*models.BusinessResult, error) {
	var br models.BusinessResult
	err := database.DB.QueryRow(
		"SELECT id, business_key, business_type, result_status, result_data, calculated_at, recalculated_count, last_recalculated_at FROM business_results WHERE business_key = ? AND business_type = ?",
		businessKey, businessType,
	).Scan(&br.ID, &br.BusinessKey, &br.BusinessType, &br.ResultStatus, &br.ResultData, &br.CalculatedAt, &br.RecalculatedCount, &br.LastRecalculatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &br, nil
}

func SaveBusinessResult(br *models.BusinessResult, isRecalculation bool) error {
	if isRecalculation {
		br.RecalculatedCount++
		now := time.Now()
		br.LastRecalculatedAt = &now
		_, err := database.DB.Exec(
			"UPDATE business_results SET result_status = ?, result_data = ?, recalculated_count = ?, last_recalculated_at = ? WHERE business_key = ? AND business_type = ?",
			br.ResultStatus, br.ResultData, br.RecalculatedCount, br.LastRecalculatedAt, br.BusinessKey, br.BusinessType,
		)
		return err
	}

	br.ID = uuid.NewString()
	br.CalculatedAt = time.Now()
	br.RecalculatedCount = 0
	_, err := database.DB.Exec(
		"INSERT INTO business_results (id, business_key, business_type, result_status, result_data, calculated_at, recalculated_count) VALUES (?, ?, ?, ?, ?, ?, ?)",
		br.ID, br.BusinessKey, br.BusinessType, br.ResultStatus, br.ResultData, br.CalculatedAt, br.RecalculatedCount,
	)
	return err
}

func GetTemperatureRecords(refrigeratorID string, startTime, endTime time.Time) ([]models.TemperatureRecord, error) {
	rows, err := database.DB.Query(
		"SELECT id, refrigerator_id, temperature, recorded_at, recorded_by, evidence_id FROM temperature_records WHERE refrigerator_id = ? AND recorded_at >= ? AND recorded_at <= ? ORDER BY recorded_at",
		refrigeratorID, startTime, endTime,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.TemperatureRecord
	for rows.Next() {
		var tr models.TemperatureRecord
		err := rows.Scan(&tr.ID, &tr.RefrigeratorID, &tr.Temperature, &tr.RecordedAt, &tr.RecordedBy, &tr.EvidenceID)
		if err != nil {
			return nil, err
		}
		records = append(records, tr)
	}
	return records, nil
}

func GetInventoryByBatchAndFridge(batchNumber, refrigeratorID string) (*models.VaccineInventory, error) {
	var inv models.VaccineInventory
	err := database.DB.QueryRow(
		"SELECT id, batch_number, refrigerator_id, doses_count, status, received_at FROM vaccine_inventory WHERE batch_number = ? AND refrigerator_id = ?",
		batchNumber, refrigeratorID,
	).Scan(&inv.ID, &inv.BatchNumber, &inv.RefrigeratorID, &inv.DosesCount, &inv.Status, &inv.ReceivedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func UpdateVaccineInventory(inv *models.VaccineInventory) error {
	_, err := database.DB.Exec(
		"UPDATE vaccine_inventory SET doses_count = ?, status = ? WHERE id = ?",
		inv.DosesCount, inv.Status, inv.ID,
	)
	return err
}

func GetAllInventory() ([]models.VaccineInventory, error) {
	rows, err := database.DB.Query("SELECT id, batch_number, refrigerator_id, doses_count, status, received_at FROM vaccine_inventory")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var inventories []models.VaccineInventory
	for rows.Next() {
		var inv models.VaccineInventory
		err := rows.Scan(&inv.ID, &inv.BatchNumber, &inv.RefrigeratorID, &inv.DosesCount, &inv.Status, &inv.ReceivedAt)
		if err != nil {
			return nil, err
		}
		inventories = append(inventories, inv)
	}
	return inventories, nil
}

func GetAllOpenRecords() ([]models.OpenRecord, error) {
	rows, err := database.DB.Query("SELECT id, inventory_id, batch_number, opened_at, opened_by, doses_used, status, closed_at, closed_by, evidence_id FROM open_records")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.OpenRecord
	for rows.Next() {
		var or models.OpenRecord
		err := rows.Scan(&or.ID, &or.InventoryID, &or.BatchNumber, &or.OpenedAt, &or.OpenedBy, &or.DosesUsed, &or.Status, &or.ClosedAt, &or.ClosedBy, &or.EvidenceID)
		if err != nil {
			return nil, err
		}
		records = append(records, or)
	}
	return records, nil
}

func GetAllDiscardRecords() ([]models.DiscardRecord, error) {
	rows, err := database.DB.Query("SELECT id, batch_number, inventory_id, open_record_id, doses_count, reason, discarded_at, discarded_by, confirmed, confirmed_at, confirmed_by, evidence_id FROM discard_records")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.DiscardRecord
	for rows.Next() {
		var dr models.DiscardRecord
		err := rows.Scan(&dr.ID, &dr.BatchNumber, &dr.InventoryID, &dr.OpenRecordID, &dr.DosesCount, &dr.Reason, &dr.DiscardedAt, &dr.DiscardedBy, &dr.Confirmed, &dr.ConfirmedAt, &dr.ConfirmedBy, &dr.EvidenceID)
		if err != nil {
			return nil, err
		}
		records = append(records, dr)
	}
	return records, nil
}

func GetAllVaccines() ([]models.Vaccine, error) {
	rows, err := database.DB.Query("SELECT batch_number, name, manufacturer, expiry_date, total_doses, created_at FROM vaccines")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var vaccines []models.Vaccine
	for rows.Next() {
		var v models.Vaccine
		err := rows.Scan(&v.BatchNumber, &v.Name, &v.Manufacturer, &v.ExpiryDate, &v.TotalDoses, &v.CreatedAt)
		if err != nil {
			return nil, err
		}
		vaccines = append(vaccines, v)
	}
	return vaccines, nil
}

func CreateColdChainReport(report *models.ColdChainReport) error {
	report.ID = uuid.NewString()
	report.GeneratedAt = time.Now()
	_, err := database.DB.Exec(
		"INSERT INTO cold_chain_reports (id, report_type, batch_number, refrigerator_id, start_date, end_date, report_data, generated_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		report.ID, report.ReportType, report.BatchNumber, report.RefrigeratorID, report.StartDate, report.EndDate, report.ReportData, report.GeneratedBy,
	)
	return err
}

func GetColdChainReport(id string) (*models.ColdChainReport, error) {
	var report models.ColdChainReport
	err := database.DB.QueryRow(
		"SELECT id, report_type, batch_number, refrigerator_id, start_date, end_date, report_data, generated_at, generated_by FROM cold_chain_reports WHERE id = ?",
		id,
	).Scan(&report.ID, &report.ReportType, &report.BatchNumber, &report.RefrigeratorID, &report.StartDate, &report.EndDate, &report.ReportData, &report.GeneratedAt, &report.GeneratedBy)
	if err != nil {
		return nil, err
	}
	return &report, nil
}

func GetAllRefrigerators() ([]models.Refrigerator, error) {
	rows, err := database.DB.Query("SELECT id, name, location, created_at FROM refrigerators")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fridges []models.Refrigerator
	for rows.Next() {
		var r models.Refrigerator
		err := rows.Scan(&r.ID, &r.Name, &r.Location, &r.CreatedAt)
		if err != nil {
			return nil, err
		}
		fridges = append(fridges, r)
	}
	return fridges, nil
}

func GetVaccineByBatch(batchNumber string) (*models.Vaccine, error) {
	var v models.Vaccine
	err := database.DB.QueryRow(
		"SELECT batch_number, name, manufacturer, expiry_date, total_doses, created_at FROM vaccines WHERE batch_number = ?",
		batchNumber,
	).Scan(&v.BatchNumber, &v.Name, &v.Manufacturer, &v.ExpiryDate, &v.TotalDoses, &v.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &v, nil
}

func GetRefrigeratorByID(id string) (*models.Refrigerator, error) {
	var r models.Refrigerator
	err := database.DB.QueryRow(
		"SELECT id, name, location, created_at FROM refrigerators WHERE id = ?",
		id,
	).Scan(&r.ID, &r.Name, &r.Location, &r.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func SerializeData(data interface{}) string {
	bytes, _ := json.Marshal(data)
	return string(bytes)
}

func DeserializeData(data string, v interface{}) error {
	return json.Unmarshal([]byte(data), v)
}
