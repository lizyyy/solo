package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"device-evidence-api/model"
	"github.com/google/uuid"
)

var db *sql.DB

func InitDB(dbPath string) error {
	var err error
	db, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	if err := createTables(); err != nil {
		return fmt.Errorf("failed to create tables: %w", err)
	}

	return nil
}

func createTables() error {
	schema := `
	CREATE TABLE IF NOT EXISTS device_evidences (
		id TEXT PRIMARY KEY,
		device_id TEXT NOT NULL,
		firmware_version TEXT NOT NULL,
		proof_material_raw TEXT NOT NULL,
		strategy_result_raw TEXT,
		isolation_action TEXT NOT NULL DEFAULT 'none',
		status TEXT NOT NULL,
		raw_input TEXT,
		conclusion TEXT,
		remark TEXT,
		operator TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_device_id ON device_evidences(device_id);
	CREATE INDEX IF NOT EXISTS idx_status ON device_evidences(status);
	CREATE INDEX IF NOT EXISTS idx_created_at ON device_evidences(created_at);

	CREATE TABLE IF NOT EXISTS evidence_reports (
		id TEXT PRIMARY KEY,
		evidence_id TEXT NOT NULL,
		device_id TEXT NOT NULL,
		report_type TEXT NOT NULL,
		content TEXT NOT NULL,
		generated_at DATETIME NOT NULL,
		FOREIGN KEY (evidence_id) REFERENCES device_evidences(id)
	);

	CREATE INDEX IF NOT EXISTS idx_report_evidence_id ON evidence_reports(evidence_id);

	CREATE TABLE IF NOT EXISTS idempotent_records (
		idempotent_key TEXT PRIMARY KEY,
		evidence_id TEXT NOT NULL,
		created_at DATETIME NOT NULL
	);
	`

	_, err := db.Exec(schema)
	return err
}

func CloseDB() {
	if db != nil {
		db.Close()
	}
}

func CreateEvidence(evidence *model.DeviceEvidence, rawInput string, idempotentKey string) (*model.DeviceEvidence, error) {
	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if idempotentKey != "" {
		var existingEvidenceID string
		err := tx.QueryRow("SELECT evidence_id FROM idempotent_records WHERE idempotent_key = ?", idempotentKey).Scan(&existingEvidenceID)
		if err == nil {
			return GetEvidenceByID(existingEvidenceID)
		}
	}

	evidence.ID = uuid.New().String()
	now := time.Now()
	evidence.CreatedAt = now
	evidence.UpdatedAt = now

	proofMaterialJSON, err := json.Marshal(evidence.ProofMaterial)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal proof material: %w", err)
	}

	var strategyResultJSON []byte
	if evidence.StrategyResult != nil {
		strategyResultJSON, err = json.Marshal(evidence.StrategyResult)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal strategy result: %w", err)
		}
	}

	_, err = tx.Exec(`
		INSERT INTO device_evidences 
		(id, device_id, firmware_version, proof_material_raw, strategy_result_raw, isolation_action, status, raw_input, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, evidence.ID, evidence.DeviceID, evidence.FirmwareVersion, string(proofMaterialJSON), string(strategyResultJSON), evidence.IsolationAction, evidence.Status, rawInput, evidence.CreatedAt, evidence.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if idempotentKey != "" {
		_, err = tx.Exec("INSERT INTO idempotent_records (idempotent_key, evidence_id, created_at) VALUES (?, ?, ?)", idempotentKey, evidence.ID, now)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return evidence, nil
}

func GetEvidenceByID(id string) (*model.DeviceEvidence, error) {
	evidence := &model.DeviceEvidence{}
	var proofMaterialRaw, strategyResultRaw, rawInput, conclusion, remark, operator sql.NullString

	err := db.QueryRow(`
		SELECT id, device_id, firmware_version, proof_material_raw, strategy_result_raw, isolation_action, status, raw_input, conclusion, remark, operator, created_at, updated_at
		FROM device_evidences WHERE id = ?
	`, id).Scan(&evidence.ID, &evidence.DeviceID, &evidence.FirmwareVersion, &proofMaterialRaw, &strategyResultRaw, &evidence.IsolationAction, &evidence.Status, &rawInput, &conclusion, &remark, &operator, &evidence.CreatedAt, &evidence.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if proofMaterialRaw.Valid {
		evidence.ProofMaterialRaw = proofMaterialRaw.String
		json.Unmarshal([]byte(proofMaterialRaw.String), &evidence.ProofMaterial)
	}

	if strategyResultRaw.Valid {
		evidence.StrategyResultRaw = strategyResultRaw.String
		json.Unmarshal([]byte(strategyResultRaw.String), &evidence.StrategyResult)
	}

	if rawInput.Valid {
		evidence.RawInput = rawInput.String
	}
	if conclusion.Valid {
		evidence.Conclusion = conclusion.String
	}
	if remark.Valid {
		evidence.Remark = remark.String
	}
	if operator.Valid {
		evidence.Operator = operator.String
	}

	return evidence, nil
}

func QueryEvidences(req *model.QueryEvidenceRequest) ([]*model.DeviceEvidence, int, error) {
	query := `SELECT id, device_id, firmware_version, proof_material_raw, strategy_result_raw, isolation_action, status, raw_input, conclusion, remark, operator, created_at, updated_at FROM device_evidences WHERE 1=1`
	countQuery := `SELECT COUNT(*) FROM device_evidences WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if req.DeviceID != "" {
		query += fmt.Sprintf(" AND device_id = $%d", argIndex)
		countQuery += fmt.Sprintf(" AND device_id = $%d", argIndex)
		args = append(args, req.DeviceID)
		argIndex++
	}

	if req.Status != "" {
		query += fmt.Sprintf(" AND status = $%d", argIndex)
		countQuery += fmt.Sprintf(" AND status = $%d", argIndex)
		args = append(args, req.Status)
		argIndex++
	}

	if req.StartTime != nil {
		query += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		countQuery += fmt.Sprintf(" AND created_at >= $%d", argIndex)
		args = append(args, *req.StartTime)
		argIndex++
	}

	if req.EndTime != nil {
		query += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		countQuery += fmt.Sprintf(" AND created_at <= $%d", argIndex)
		args = append(args, *req.EndTime)
		argIndex++
	}

	var total int
	err := db.QueryRow(countQuery, args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query += " ORDER BY created_at DESC"

	page := req.Page
	if page < 1 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize < 1 {
		pageSize = 10
	}
	offset := (page - 1) * pageSize
	query += fmt.Sprintf(" LIMIT $%d OFFSET $%d", argIndex, argIndex+1)
	args = append(args, pageSize, offset)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var evidences []*model.DeviceEvidence
	for rows.Next() {
		evidence := &model.DeviceEvidence{}
		var proofMaterialRaw, strategyResultRaw, rawInput, conclusion, remark, operator sql.NullString
		err := rows.Scan(&evidence.ID, &evidence.DeviceID, &evidence.FirmwareVersion, &proofMaterialRaw, &strategyResultRaw, &evidence.IsolationAction, &evidence.Status, &rawInput, &conclusion, &remark, &operator, &evidence.CreatedAt, &evidence.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}

		if proofMaterialRaw.Valid {
			evidence.ProofMaterialRaw = proofMaterialRaw.String
			json.Unmarshal([]byte(proofMaterialRaw.String), &evidence.ProofMaterial)
		}

		if strategyResultRaw.Valid {
			evidence.StrategyResultRaw = strategyResultRaw.String
			json.Unmarshal([]byte(strategyResultRaw.String), &evidence.StrategyResult)
		}

		if rawInput.Valid {
			evidence.RawInput = rawInput.String
		}
		if conclusion.Valid {
			evidence.Conclusion = conclusion.String
		}
		if remark.Valid {
			evidence.Remark = remark.String
		}
		if operator.Valid {
			evidence.Operator = operator.String
		}

		evidences = append(evidences, evidence)
	}

	return evidences, total, nil
}

func UpdateEvidenceStatus(id string, req *model.StatusUpdateRequest) error {
	now := time.Now()
	_, err := db.Exec(`
		UPDATE device_evidences 
		SET status = ?, isolation_action = ?, remark = ?, operator = ?, conclusion = ?, updated_at = ?
		WHERE id = ?
	`, req.NewStatus, req.IsolationAction, req.Remark, req.Operator, req.Conclusion, now, id)
	return err
}

func ManualCorrection(id string, req *model.ManualCorrectionRequest) error {
	now := time.Now()
	status := model.StatusCompensated
	_, err := db.Exec(`
		UPDATE device_evidences 
		SET status = ?, isolation_action = ?, remark = ?, operator = ?, updated_at = ?
		WHERE id = ?
	`, status, req.IsolationAction, req.Remark, req.Operator, now, id)
	return err
}

func GetAllEvidencesForExport() ([]*model.DeviceEvidence, error) {
	rows, err := db.Query(`
		SELECT id, device_id, firmware_version, proof_material_raw, strategy_result_raw, isolation_action, status, raw_input, conclusion, remark, operator, created_at, updated_at
		FROM device_evidences ORDER BY created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var evidences []*model.DeviceEvidence
	for rows.Next() {
		evidence := &model.DeviceEvidence{}
		var proofMaterialRaw, strategyResultRaw, rawInput, conclusion, remark, operator sql.NullString
		err := rows.Scan(&evidence.ID, &evidence.DeviceID, &evidence.FirmwareVersion, &proofMaterialRaw, &strategyResultRaw, &evidence.IsolationAction, &evidence.Status, &rawInput, &conclusion, &remark, &operator, &evidence.CreatedAt, &evidence.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if proofMaterialRaw.Valid {
			evidence.ProofMaterialRaw = proofMaterialRaw.String
			json.Unmarshal([]byte(proofMaterialRaw.String), &evidence.ProofMaterial)
		}

		if strategyResultRaw.Valid {
			evidence.StrategyResultRaw = strategyResultRaw.String
			json.Unmarshal([]byte(strategyResultRaw.String), &evidence.StrategyResult)
		}

		if rawInput.Valid {
			evidence.RawInput = rawInput.String
		}
		if conclusion.Valid {
			evidence.Conclusion = conclusion.String
		}
		if remark.Valid {
			evidence.Remark = remark.String
		}
		if operator.Valid {
			evidence.Operator = operator.String
		}

		evidences = append(evidences, evidence)
	}

	return evidences, nil
}

func CreateReport(report *model.EvidenceReport) error {
	report.ID = uuid.New().String()
	report.GeneratedAt = time.Now()
	_, err := db.Exec(`
		INSERT INTO evidence_reports (id, evidence_id, device_id, report_type, content, generated_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, report.ID, report.EvidenceID, report.DeviceID, report.ReportType, report.Content, report.GeneratedAt)
	return err
}

func GetDeviceIsolationStatus(deviceID string) (model.IsolationAction, error) {
	var action model.IsolationAction
	err := db.QueryRow(`
		SELECT isolation_action FROM device_evidences 
		WHERE device_id = ? ORDER BY created_at DESC LIMIT 1
	`, deviceID).Scan(&action)
	if err == sql.ErrNoRows {
		return model.IsolationNone, nil
	}
	return action, err
}
