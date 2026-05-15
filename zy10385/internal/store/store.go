package store

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"
	_ "github.com/mattn/go-sqlite3"

	"api-admission-check/internal/model"
)

type Store interface {
	CreateApplication(app *model.ServiceApplication) error
	GetApplication(id string) (*model.ServiceApplication, error)
	UpdateApplication(app *model.ServiceApplication) error
	ListApplications() ([]*model.ServiceApplication, error)
	AddHistoryRecord(record *model.HistoryRecord) error
	GetHistoryRecords(appID string) ([]*model.HistoryRecord, error)
	Close() error
}

type SQLiteStore struct {
	db *sql.DB
}

func ensureDataDir() string {
	dataDir := "./data"
	if _, err := os.Stat(dataDir); os.IsNotExist(err) {
		os.MkdirAll(dataDir, 0755)
	}
	return dataDir
}

func NewSQLiteStore(dbPath ...string) (*SQLiteStore, error) {
	path := filepath.Join(ensureDataDir(), "admission.db")
	if len(dbPath) > 0 {
		path = dbPath[0]
	}

	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	store := &SQLiteStore{db: db}
	if err := store.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to init schema: %w", err)
	}

	log.Printf("Database initialized at: %s", path)
	return store, nil
}

func (s *SQLiteStore) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS applications (
		id TEXT PRIMARY KEY,
		service_name TEXT NOT NULL,
		service_owner TEXT NOT NULL,
		description TEXT,
		status TEXT NOT NULL,
		dependencies_json TEXT,
		permission_creds_json TEXT,
		quota_requirements_json TEXT,
		alerts_json TEXT,
		admission_result_json TEXT,
		version INTEGER NOT NULL DEFAULT 1,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS history (
		id TEXT PRIMARY KEY,
		app_id TEXT NOT NULL,
		old_status TEXT,
		new_status TEXT,
		operator TEXT NOT NULL,
		remark TEXT NOT NULL,
		action_type TEXT NOT NULL DEFAULT 'status_change',
		details_json TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (app_id) REFERENCES applications(id)
	);

	CREATE INDEX IF NOT EXISTS idx_history_app_id ON history(app_id);
	`
	_, err := s.db.Exec(schema)
	return err
}

func (s *SQLiteStore) CreateApplication(app *model.ServiceApplication) error {
	depsJSON, _ := json.Marshal(app.Dependencies)
	credsJSON, _ := json.Marshal(app.PermissionCreds)
	quotasJSON, _ := json.Marshal(app.QuotaRequirements)
	alertsJSON, _ := json.Marshal(app.Alerts)
	resultJSON, _ := json.Marshal(app.AdmissionResult)

	now := time.Now()
	app.CreatedAt = now
	app.UpdatedAt = now
	app.Version = 1

	query := `
	INSERT INTO applications (
		id, service_name, service_owner, description, status,
		dependencies_json, permission_creds_json, quota_requirements_json,
		alerts_json, admission_result_json, version, created_at, updated_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		app.ID, app.ServiceName, app.ServiceOwner, app.Description, app.Status,
		string(depsJSON), string(credsJSON), string(quotasJSON),
		string(alertsJSON), string(resultJSON), app.Version, app.CreatedAt, app.UpdatedAt,
	)

	if err != nil {
		if err.Error() == "UNIQUE constraint failed: applications.id" {
			return model.ErrDuplicateSubmission
		}
		return err
	}
	return nil
}

func (s *SQLiteStore) GetApplication(id string) (*model.ServiceApplication, error) {
	query := `
	SELECT id, service_name, service_owner, description, status,
		dependencies_json, permission_creds_json, quota_requirements_json,
		alerts_json, admission_result_json, version, created_at, updated_at
	FROM applications WHERE id = ?
	`

	var app model.ServiceApplication
	var depsJSON, credsJSON, quotasJSON, alertsJSON, resultJSON sql.NullString
	var createdAt, updatedAt string

	err := s.db.QueryRow(query, id).Scan(
		&app.ID, &app.ServiceName, &app.ServiceOwner, &app.Description, &app.Status,
		&depsJSON, &credsJSON, &quotasJSON, &alertsJSON, &resultJSON,
		&app.Version, &createdAt, &updatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, model.ErrApplicationNotFound
	}
	if err != nil {
		return nil, err
	}

	app.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
	app.UpdatedAt, _ = time.Parse(time.RFC3339Nano, updatedAt)

	if depsJSON.Valid {
		json.Unmarshal([]byte(depsJSON.String), &app.Dependencies)
	}
	if credsJSON.Valid {
		json.Unmarshal([]byte(credsJSON.String), &app.PermissionCreds)
	}
	if quotasJSON.Valid {
		json.Unmarshal([]byte(quotasJSON.String), &app.QuotaRequirements)
	}
	if alertsJSON.Valid {
		json.Unmarshal([]byte(alertsJSON.String), &app.Alerts)
	}
	if resultJSON.Valid {
		json.Unmarshal([]byte(resultJSON.String), &app.AdmissionResult)
	}

	return &app, nil
}

func (s *SQLiteStore) UpdateApplication(app *model.ServiceApplication) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var currentVersion int
	err = tx.QueryRow("SELECT version FROM applications WHERE id = ?", app.ID).Scan(&currentVersion)
	if err == sql.ErrNoRows {
		return model.ErrApplicationNotFound
	}
	if err != nil {
		return err
	}

	if currentVersion != app.Version {
		return model.ErrVersionConflict
	}

	depsJSON, _ := json.Marshal(app.Dependencies)
	credsJSON, _ := json.Marshal(app.PermissionCreds)
	quotasJSON, _ := json.Marshal(app.QuotaRequirements)
	alertsJSON, _ := json.Marshal(app.Alerts)
	resultJSON, _ := json.Marshal(app.AdmissionResult)

	app.UpdatedAt = time.Now()
	app.Version++

	query := `
	UPDATE applications SET
		service_name = ?, service_owner = ?, description = ?, status = ?,
		dependencies_json = ?, permission_creds_json = ?, quota_requirements_json = ?,
		alerts_json = ?, admission_result_json = ?, version = ?, updated_at = ?
	WHERE id = ? AND version = ?
	`

	result, err := tx.Exec(query,
		app.ServiceName, app.ServiceOwner, app.Description, app.Status,
		string(depsJSON), string(credsJSON), string(quotasJSON),
		string(alertsJSON), string(resultJSON), app.Version, app.UpdatedAt,
		app.ID, currentVersion,
	)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return model.ErrVersionConflict
	}

	return tx.Commit()
}

func (s *SQLiteStore) ListApplications() ([]*model.ServiceApplication, error) {
	query := `SELECT id FROM applications ORDER BY created_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var apps []*model.ServiceApplication
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		app, err := s.GetApplication(id)
		if err != nil {
			return nil, err
		}
		apps = append(apps, app)
	}
	return apps, nil
}

func (s *SQLiteStore) AddHistoryRecord(record *model.HistoryRecord) error {
	detailsJSON, _ := json.Marshal(record.Details)

	record.CreatedAt = time.Now()

	query := `
	INSERT INTO history (
		id, app_id, old_status, new_status, operator, remark,
		action_type, details_json, created_at
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	actionType := record.ActionType
	if actionType == "" {
		actionType = "status_change"
	}

	_, err := s.db.Exec(query,
		record.ID, record.AppID, record.OldStatus, record.NewStatus,
		record.Operator, record.Remark, actionType, string(detailsJSON), record.CreatedAt,
	)
	return err
}

func (s *SQLiteStore) GetHistoryRecords(appID string) ([]*model.HistoryRecord, error) {
	query := `
	SELECT id, app_id, old_status, new_status, operator, remark,
		action_type, details_json, created_at
	FROM history WHERE app_id = ? ORDER BY created_at DESC
	`

	rows, err := s.db.Query(query, appID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.HistoryRecord
	for rows.Next() {
		var record model.HistoryRecord
		var detailsJSON sql.NullString
		var createdAt string

		err := rows.Scan(
			&record.ID, &record.AppID, &record.OldStatus, &record.NewStatus,
			&record.Operator, &record.Remark, &record.ActionType, &detailsJSON, &createdAt,
		)
		if err != nil {
			return nil, err
		}

		record.CreatedAt, _ = time.Parse(time.RFC3339Nano, createdAt)
		if detailsJSON.Valid {
			json.Unmarshal([]byte(detailsJSON.String), &record.Details)
		}

		records = append(records, &record)
	}
	return records, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func NewMemoryStore() *SQLiteStore {
	store, err := NewSQLiteStore(":memory:")
	if err != nil {
		panic(err)
	}
	return store
}
