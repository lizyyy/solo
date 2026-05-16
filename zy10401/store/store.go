package store

import (
	"contract-drift-api/models"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

func InitDB() (*DB, error) {
	db, err := sql.Open("sqlite3", "./contract_drift.db")
	if err != nil {
		return nil, err
	}

	if err := createTables(db); err != nil {
		return nil, err
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS contracts (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			version TEXT NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			schema TEXT,
			description TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name, version)
		)`,
		`CREATE TABLE IF NOT EXISTS samples (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contract_id INTEGER NOT NULL,
			payload TEXT NOT NULL,
			source TEXT,
			hash TEXT UNIQUE,
			status TEXT DEFAULT 'pending',
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			analyzed_at DATETIME,
			FOREIGN KEY (contract_id) REFERENCES contracts(id)
		)`,
		`CREATE TABLE IF NOT EXISTS field_explanations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			contract_id INTEGER NOT NULL,
			field_path TEXT NOT NULL,
			type TEXT NOT NULL,
			required BOOLEAN DEFAULT 0,
			comment TEXT,
			FOREIGN KEY (contract_id) REFERENCES contracts(id),
			UNIQUE(contract_id, field_path)
		)`,
		`CREATE TABLE IF NOT EXISTS consumers (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			version TEXT NOT NULL,
			service TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			UNIQUE(name, version)
		)`,
		`CREATE TABLE IF NOT EXISTS confirmations (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sample_id INTEGER NOT NULL,
			consumer_id INTEGER NOT NULL,
			status TEXT NOT NULL,
			comment TEXT,
			confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (sample_id) REFERENCES samples(id),
			FOREIGN KEY (consumer_id) REFERENCES consumers(id),
			UNIQUE(sample_id, consumer_id)
		)`,
		`CREATE TABLE IF NOT EXISTS drift_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			sample_id INTEGER NOT NULL,
			contract_id INTEGER NOT NULL,
			field_path TEXT NOT NULL,
			drift_type TEXT NOT NULL,
			expected_value TEXT,
			actual_value TEXT,
			severity TEXT DEFAULT 'medium',
			status TEXT DEFAULT 'open',
			resolved_by INTEGER,
			resolved_comment TEXT,
			resolved_at DATETIME,
			detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (sample_id) REFERENCES samples(id),
			FOREIGN KEY (contract_id) REFERENCES contracts(id)
		)`,
		`CREATE TABLE IF NOT EXISTS exception_records (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			operation TEXT NOT NULL,
			raw_input TEXT,
			error_message TEXT,
			conclusion TEXT,
			fixed BOOLEAN DEFAULT 0,
			fixed_by TEXT,
			fixed_comment TEXT,
			fixed_at DATETIME,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}
	return nil
}

func (db *DB) CreateContract(contract *models.Contract) error {
	query := `INSERT INTO contracts (name, version, method, path, schema, description) VALUES (?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, contract.Name, contract.Version, contract.Method, contract.Path, contract.Schema, contract.Description)
	if err != nil {
		return err
	}
	contract.ID, err = result.LastInsertId()
	contract.CreatedAt = time.Now()
	contract.UpdatedAt = time.Now()
	return err
}

func (db *DB) GetContract(id int64) (*models.Contract, error) {
	contract := &models.Contract{}
	query := `SELECT id, name, version, method, path, schema, description, created_at, updated_at FROM contracts WHERE id = ?`
	err := db.QueryRow(query, id).Scan(&contract.ID, &contract.Name, &contract.Version, &contract.Method, &contract.Path, &contract.Schema, &contract.Description, &contract.CreatedAt, &contract.UpdatedAt)
	return contract, err
}

func (db *DB) ListContracts() ([]models.Contract, error) {
	rows, err := db.Query(`SELECT id, name, version, method, path, schema, description, created_at, updated_at FROM contracts ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var contracts []models.Contract
	for rows.Next() {
		var c models.Contract
		err := rows.Scan(&c.ID, &c.Name, &c.Version, &c.Method, &c.Path, &c.Schema, &c.Description, &c.CreatedAt, &c.UpdatedAt)
		if err != nil {
			return nil, err
		}
		contracts = append(contracts, c)
	}
	return contracts, nil
}

func (db *DB) ImportSample(sample *models.Sample) error {
	payloadBytes, _ := json.Marshal(sample.Payload)
	hash := sha256.Sum256(payloadBytes)
	sample.Hash = hex.EncodeToString(hash[:])

	var existingID int64
	err := db.QueryRow(`SELECT id FROM samples WHERE hash = ?`, sample.Hash).Scan(&existingID)
	if err == nil {
		sample.ID = existingID
		return fmt.Errorf("duplicate sample")
	}

	query := `INSERT INTO samples (contract_id, payload, source, hash, status) VALUES (?, ?, ?, ?, ?)`
	result, err := db.Exec(query, sample.ContractID, sample.Payload, sample.Source, sample.Hash, "pending")
	if err != nil {
		return err
	}
	sample.ID, err = result.LastInsertId()
	sample.CreatedAt = time.Now()
	return err
}

func (db *DB) GetSample(id int64) (*models.Sample, error) {
	sample := &models.Sample{}
	query := `SELECT id, contract_id, payload, source, hash, status, created_at, analyzed_at FROM samples WHERE id = ?`
	err := db.QueryRow(query, id).Scan(&sample.ID, &sample.ContractID, &sample.Payload, &sample.Source, &sample.Hash, &sample.Status, &sample.CreatedAt, &sample.AnalyzedAt)
	return sample, err
}

func (db *DB) ListSamples(contractID int64) ([]models.Sample, error) {
	var rows *sql.Rows
	var err error
	if contractID > 0 {
		rows, err = db.Query(`SELECT id, contract_id, payload, source, hash, status, created_at, analyzed_at FROM samples WHERE contract_id = ? ORDER BY created_at DESC`, contractID)
	} else {
		rows, err = db.Query(`SELECT id, contract_id, payload, source, hash, status, created_at, analyzed_at FROM samples ORDER BY created_at DESC`)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []models.Sample
	for rows.Next() {
		var s models.Sample
		err := rows.Scan(&s.ID, &s.ContractID, &s.Payload, &s.Source, &s.Hash, &s.Status, &s.CreatedAt, &s.AnalyzedAt)
		if err != nil {
			return nil, err
		}
		samples = append(samples, s)
	}
	return samples, nil
}

func (db *DB) UpdateSampleStatus(id int64, status string) error {
	query := `UPDATE samples SET status = ?, analyzed_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, status, id)
	return err
}

func (db *DB) CreateDriftRecord(drift *models.DriftRecord) error {
	query := `INSERT INTO drift_records (sample_id, contract_id, field_path, drift_type, expected_value, actual_value, severity, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	result, err := db.Exec(query, drift.SampleID, drift.ContractID, drift.FieldPath, drift.DriftType, drift.ExpectedValue, drift.ActualValue, drift.Severity, "open")
	if err != nil {
		return err
	}
	drift.ID, err = result.LastInsertId()
	drift.DetectedAt = time.Now()
	drift.Status = "open"
	return err
}

func (db *DB) GetDriftRecord(id int64) (*models.DriftRecord, error) {
	drift := &models.DriftRecord{}
	query := `SELECT id, sample_id, contract_id, field_path, drift_type, expected_value, actual_value, severity, status, resolved_by, resolved_comment, resolved_at, detected_at FROM drift_records WHERE id = ?`
	err := db.QueryRow(query, id).Scan(&drift.ID, &drift.SampleID, &drift.ContractID, &drift.FieldPath, &drift.DriftType, &drift.ExpectedValue, &drift.ActualValue, &drift.Severity, &drift.Status, &drift.ResolvedBy, &drift.ResolvedComment, &drift.ResolvedAt, &drift.DetectedAt)
	return drift, err
}

func (db *DB) ListDriftRecords(contractID int64, status string) ([]models.DriftRecord, error) {
	var rows *sql.Rows
	var err error
	baseQuery := `SELECT id, sample_id, contract_id, field_path, drift_type, expected_value, actual_value, severity, status, resolved_by, resolved_comment, resolved_at, detected_at FROM drift_records WHERE 1=1`
	args := []interface{}{}

	if contractID > 0 {
		baseQuery += ` AND contract_id = ?`
		args = append(args, contractID)
	}
	if status != "" {
		baseQuery += ` AND status = ?`
		args = append(args, status)
	}
	baseQuery += ` ORDER BY detected_at DESC`

	rows, err = db.Query(baseQuery, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var drifts []models.DriftRecord
	for rows.Next() {
		var d models.DriftRecord
		err := rows.Scan(&d.ID, &d.SampleID, &d.ContractID, &d.FieldPath, &d.DriftType, &d.ExpectedValue, &d.ActualValue, &d.Severity, &d.Status, &d.ResolvedBy, &d.ResolvedComment, &d.ResolvedAt, &d.DetectedAt)
		if err != nil {
			return nil, err
		}
		drifts = append(drifts, d)
	}
	return drifts, nil
}

func (db *DB) ResolveDriftRecord(id int64, comment string) error {
	query := `UPDATE drift_records SET status = 'resolved', resolved_comment = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, comment, id)
	return err
}

func (db *DB) RegisterConsumer(consumer *models.Consumer) error {
	query := `INSERT INTO consumers (name, version, service) VALUES (?, ?, ?)`
	result, err := db.Exec(query, consumer.Name, consumer.Version, consumer.Service)
	if err != nil {
		return err
	}
	consumer.ID, err = result.LastInsertId()
	consumer.CreatedAt = time.Now()
	return err
}

func (db *DB) ListConsumers() ([]models.Consumer, error) {
	rows, err := db.Query(`SELECT id, name, version, service, created_at FROM consumers ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var consumers []models.Consumer
	for rows.Next() {
		var c models.Consumer
		err := rows.Scan(&c.ID, &c.Name, &c.Version, &c.Service, &c.CreatedAt)
		if err != nil {
			return nil, err
		}
		consumers = append(consumers, c)
	}
	return consumers, nil
}

func (db *DB) ConfirmSample(sampleID, consumerID int64, status, comment string) error {
	query := `INSERT INTO confirmations (sample_id, consumer_id, status, comment) VALUES (?, ?, ?, ?)`
	_, err := db.Exec(query, sampleID, consumerID, status, comment)
	return err
}

func (db *DB) CreateExceptionRecord(exception *models.ExceptionRecord) error {
	query := `INSERT INTO exception_records (operation, raw_input, error_message, conclusion, fixed) VALUES (?, ?, ?, ?, ?)`
	result, err := db.Exec(query, exception.Operation, exception.RawInput, exception.ErrorMessage, exception.Conclusion, false)
	if err != nil {
		return err
	}
	exception.ID, err = result.LastInsertId()
	exception.CreatedAt = time.Now()
	return err
}

func (db *DB) GetExceptionRecord(id int64) (*models.ExceptionRecord, error) {
	exception := &models.ExceptionRecord{}
	query := `SELECT id, operation, raw_input, error_message, conclusion, fixed, fixed_by, fixed_comment, fixed_at, created_at FROM exception_records WHERE id = ?`
	err := db.QueryRow(query, id).Scan(&exception.ID, &exception.Operation, &exception.RawInput, &exception.ErrorMessage, &exception.Conclusion, &exception.Fixed, &exception.FixedBy, &exception.FixedComment, &exception.FixedAt, &exception.CreatedAt)
	return exception, err
}

func (db *DB) ListExceptionRecords() ([]models.ExceptionRecord, error) {
	rows, err := db.Query(`SELECT id, operation, raw_input, error_message, conclusion, fixed, fixed_by, fixed_comment, fixed_at, created_at FROM exception_records ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exceptions []models.ExceptionRecord
	for rows.Next() {
		var e models.ExceptionRecord
		err := rows.Scan(&e.ID, &e.Operation, &e.RawInput, &e.ErrorMessage, &e.Conclusion, &e.Fixed, &e.FixedBy, &e.FixedComment, &e.FixedAt, &e.CreatedAt)
		if err != nil {
			return nil, err
		}
		exceptions = append(exceptions, e)
	}
	return exceptions, nil
}

func (db *DB) FixExceptionRecord(id int64, fixedBy, comment string) error {
	query := `UPDATE exception_records SET fixed = 1, fixed_by = ?, fixed_comment = ?, fixed_at = CURRENT_TIMESTAMP WHERE id = ?`
	_, err := db.Exec(query, fixedBy, comment, id)
	return err
}

func (db *DB) GetFieldExplanations(contractID int64) ([]models.FieldExplanation, error) {
	rows, err := db.Query(`SELECT id, contract_id, field_path, type, required, comment FROM field_explanations WHERE contract_id = ?`, contractID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var fields []models.FieldExplanation
	for rows.Next() {
		var f models.FieldExplanation
		err := rows.Scan(&f.ID, &f.ContractID, &f.FieldPath, &f.Type, &f.Required, &f.Comment)
		if err != nil {
			return nil, err
		}
		fields = append(fields, f)
	}
	return fields, nil
}

func (db *DB) CreateFieldExplanation(field *models.FieldExplanation) error {
	query := `INSERT INTO field_explanations (contract_id, field_path, type, required, comment) VALUES (?, ?, ?, ?, ?)`
	result, err := db.Exec(query, field.ContractID, field.FieldPath, field.Type, field.Required, field.Comment)
	if err != nil {
		return err
	}
	field.ID, err = result.LastInsertId()
	return err
}
