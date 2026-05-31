package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"freefall-grading/internal/model"

	_ "modernc.org/sqlite"
)

type Database struct {
	db *sql.DB
}

func NewDB(dbPath string) (*Database, error) {
	dir := filepath.Dir(dbPath)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create db directory: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}

	db.SetMaxOpenConns(1)

	database := &Database{db: db}
	if err := database.initSchema(); err != nil {
		return nil, err
	}

	return database, nil
}

func (d *Database) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS experiment_records (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		student_id TEXT NOT NULL,
		student_name TEXT NOT NULL,
		experiment_no TEXT NOT NULL,
		group_no TEXT,
		source TEXT NOT NULL,
		source_file TEXT,
		status TEXT NOT NULL DEFAULT 'imported',
		sampling_rate REAL,
		data_points INTEGER,
		zero_drift REAL,
		has_gap BOOLEAN DEFAULT 0,
		gap_count INTEGER DEFAULT 0,
		pending_reason TEXT,
		final_gravity REAL,
		gravity_unit TEXT DEFAULT 'm/s²',
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		last_modified_by TEXT,
		remark TEXT,
		UNIQUE(student_id, experiment_no, source_file)
	);

	CREATE TABLE IF NOT EXISTS status_history (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		record_id INTEGER NOT NULL,
		from_status TEXT,
		to_status TEXT NOT NULL,
		modified_by TEXT,
		reason TEXT,
		change_details TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (record_id) REFERENCES experiment_records(id) ON DELETE CASCADE
	);

	CREATE TABLE IF NOT EXISTS calibrations (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		sensor_id TEXT NOT NULL,
		calibrated_at DATETIME NOT NULL,
		zero_point REAL NOT NULL,
		sensitivity REAL NOT NULL,
		temperature REAL,
		operator TEXT,
		created_at DATETIME NOT NULL,
		UNIQUE(sensor_id, calibrated_at)
	);

	CREATE TABLE IF NOT EXISTS raw_sensor_data (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		record_id INTEGER NOT NULL,
		timestamp REAL NOT NULL,
		accel_x REAL NOT NULL,
		accel_y REAL NOT NULL,
		accel_z REAL NOT NULL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (record_id) REFERENCES experiment_records(id) ON DELETE CASCADE
	);

	CREATE INDEX IF NOT EXISTS idx_records_status ON experiment_records(status);
	CREATE INDEX IF NOT EXISTS idx_records_student ON experiment_records(student_id);
	CREATE INDEX IF NOT EXISTS idx_history_record ON status_history(record_id);
	CREATE INDEX IF NOT EXISTS idx_raw_record ON raw_sensor_data(record_id);
	`

	_, err := d.db.Exec(schema)
	return err
}

func (d *Database) Close() error {
	return d.db.Close()
}

func (d *Database) Begin() (*sql.Tx, error) {
	return d.db.Begin()
}

func (d *Database) UpsertExperimentRecord(record *model.ExperimentRecord) (int64, error) {
	now := time.Now()
	if record.CreatedAt.IsZero() {
		record.CreatedAt = now
	}
	record.UpdatedAt = now

	query := `
	INSERT INTO experiment_records 
	(student_id, student_name, experiment_no, group_no, source, source_file, status,
	 sampling_rate, data_points, zero_drift, has_gap, gap_count, pending_reason,
	 final_gravity, gravity_unit, created_at, updated_at, last_modified_by, remark)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(student_id, experiment_no, source_file) DO UPDATE SET
		student_name=excluded.student_name,
		group_no=excluded.group_no,
		status=CASE WHEN experiment_records.status IN ('approved', 'exported') 
			THEN experiment_records.status ELSE excluded.status END,
		sampling_rate=excluded.sampling_rate,
		data_points=excluded.data_points,
		zero_drift=excluded.zero_drift,
		has_gap=excluded.has_gap,
		gap_count=excluded.gap_count,
		updated_at=excluded.updated_at,
		last_modified_by=excluded.last_modified_by
	RETURNING id
	`

	var id int64
	err := d.db.QueryRow(query,
		record.StudentID, record.StudentName, record.ExperimentNo, record.GroupNo,
		record.Source, record.SourceFile, record.Status,
		record.SamplingRate, record.DataPoints, record.ZeroDrift, record.HasGap,
		record.GapCount, record.PendingReason, record.FinalGravity, record.GravityUnit,
		record.CreatedAt, record.UpdatedAt, record.LastModifiedBy, record.Remark,
	).Scan(&id)

	return id, err
}

func (d *Database) GetRecordByID(id int64) (*model.ExperimentRecord, error) {
	query := `SELECT id, student_id, student_name, experiment_no, group_no, source, 
		source_file, status, sampling_rate, data_points, zero_drift, has_gap, gap_count,
		pending_reason, final_gravity, gravity_unit, created_at, updated_at, 
		last_modified_by, remark FROM experiment_records WHERE id = ?`

	var r model.ExperimentRecord
	err := d.db.QueryRow(query, id).Scan(
		&r.ID, &r.StudentID, &r.StudentName, &r.ExperimentNo, &r.GroupNo, &r.Source,
		&r.SourceFile, &r.Status, &r.SamplingRate, &r.DataPoints, &r.ZeroDrift,
		&r.HasGap, &r.GapCount, &r.PendingReason, &r.FinalGravity, &r.GravityUnit,
		&r.CreatedAt, &r.UpdatedAt, &r.LastModifiedBy, &r.Remark,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (d *Database) UpdateRecordStatus(id int64, newStatus model.RecordStatus, modifiedBy, reason, details string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var oldStatus model.RecordStatus
	err = tx.QueryRow("SELECT status FROM experiment_records WHERE id = ?", id).Scan(&oldStatus)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`UPDATE experiment_records SET status = ?, pending_reason = ?, 
		updated_at = ?, last_modified_by = ? WHERE id = ?`,
		newStatus, reason, time.Now(), modifiedBy, id)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`INSERT INTO status_history 
		(record_id, from_status, to_status, modified_by, reason, change_details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, oldStatus, newStatus, modifiedBy, reason, details, time.Now())
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (d *Database) ListRecordsByStatus(status model.RecordStatus) ([]*model.ExperimentRecord, error) {
	query := `SELECT id, student_id, student_name, experiment_no, group_no, source,
		source_file, status, sampling_rate, data_points, zero_drift, has_gap, gap_count,
		pending_reason, final_gravity, gravity_unit, created_at, updated_at,
		last_modified_by, remark FROM experiment_records WHERE status = ? ORDER BY created_at DESC`

	rows, err := d.db.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.ExperimentRecord
	for rows.Next() {
		var r model.ExperimentRecord
		err := rows.Scan(
			&r.ID, &r.StudentID, &r.StudentName, &r.ExperimentNo, &r.GroupNo, &r.Source,
			&r.SourceFile, &r.Status, &r.SamplingRate, &r.DataPoints, &r.ZeroDrift,
			&r.HasGap, &r.GapCount, &r.PendingReason, &r.FinalGravity, &r.GravityUnit,
			&r.CreatedAt, &r.UpdatedAt, &r.LastModifiedBy, &r.Remark,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, &r)
	}
	return records, nil
}

func (d *Database) GetStatusHistory(recordID int64) ([]*model.StatusHistory, error) {
	query := `SELECT id, record_id, from_status, to_status, modified_by, reason, 
		change_details, created_at FROM status_history WHERE record_id = ? ORDER BY created_at DESC`

	rows, err := d.db.Query(query, recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var history []*model.StatusHistory
	for rows.Next() {
		var h model.StatusHistory
		err := rows.Scan(&h.ID, &h.RecordID, &h.FromStatus, &h.ToStatus,
			&h.ModifiedBy, &h.Reason, &h.ChangeDetails, &h.CreatedAt)
		if err != nil {
			return nil, err
		}
		history = append(history, &h)
	}
	return history, nil
}

func (d *Database) SaveRawData(recordID int64, data []*model.RawSensorData) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec("DELETE FROM raw_sensor_data WHERE record_id = ?", recordID)
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(`INSERT INTO raw_sensor_data 
		(record_id, timestamp, accel_x, accel_y, accel_z, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	now := time.Now()
	for _, d := range data {
		_, err = stmt.Exec(recordID, d.Timestamp, d.AccelX, d.AccelY, d.AccelZ, now)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (d *Database) GetRawData(recordID int64) ([]*model.RawSensorData, error) {
	query := `SELECT id, record_id, timestamp, accel_x, accel_y, accel_z, created_at
		FROM raw_sensor_data WHERE record_id = ? ORDER BY timestamp`

	rows, err := d.db.Query(query, recordID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var data []*model.RawSensorData
	for rows.Next() {
		var d model.RawSensorData
		err := rows.Scan(&d.ID, &d.RecordID, &d.Timestamp, &d.AccelX, &d.AccelY, &d.AccelZ, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		data = append(data, &d)
	}
	return data, nil
}

func (d *Database) SaveCalibration(cal *model.Calibration) (int64, error) {
	now := time.Now()
	if cal.CreatedAt.IsZero() {
		cal.CreatedAt = now
	}

	query := `
	INSERT INTO calibrations (sensor_id, calibrated_at, zero_point, sensitivity, temperature, operator, created_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(sensor_id, calibrated_at) DO UPDATE SET
		zero_point=excluded.zero_point,
		sensitivity=excluded.sensitivity,
		temperature=excluded.temperature,
		operator=excluded.operator
	RETURNING id
	`

	var id int64
	err := d.db.QueryRow(query, cal.SensorID, cal.CalibratedAt, cal.ZeroPoint,
		cal.Sensitivity, cal.Temperature, cal.Operator, cal.CreatedAt).Scan(&id)
	return id, err
}

func (d *Database) GetLatestCalibration(sensorID string) (*model.Calibration, error) {
	query := `SELECT id, sensor_id, calibrated_at, zero_point, sensitivity, temperature, operator, created_at
		FROM calibrations WHERE sensor_id = ? ORDER BY calibrated_at DESC LIMIT 1`

	var c model.Calibration
	err := d.db.QueryRow(query, sensorID).Scan(
		&c.ID, &c.SensorID, &c.CalibratedAt, &c.ZeroPoint, &c.Sensitivity,
		&c.Temperature, &c.Operator, &c.CreatedAt,
	)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (d *Database) ListAllRecords() ([]*model.ExperimentRecord, error) {
	query := `SELECT id, student_id, student_name, experiment_no, group_no, source,
		source_file, status, sampling_rate, data_points, zero_drift, has_gap, gap_count,
		pending_reason, final_gravity, gravity_unit, created_at, updated_at,
		last_modified_by, remark FROM experiment_records ORDER BY created_at DESC`

	rows, err := d.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.ExperimentRecord
	for rows.Next() {
		var r model.ExperimentRecord
		err := rows.Scan(
			&r.ID, &r.StudentID, &r.StudentName, &r.ExperimentNo, &r.GroupNo, &r.Source,
			&r.SourceFile, &r.Status, &r.SamplingRate, &r.DataPoints, &r.ZeroDrift,
			&r.HasGap, &r.GapCount, &r.PendingReason, &r.FinalGravity, &r.GravityUnit,
			&r.CreatedAt, &r.UpdatedAt, &r.LastModifiedBy, &r.Remark,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, &r)
	}
	return records, nil
}

func (d *Database) UpdateRecordGravity(id int64, gravity float64, modifiedBy, reason string) error {
	tx, err := d.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	var oldStatus model.RecordStatus
	var oldGravity float64
	err = tx.QueryRow("SELECT status, final_gravity FROM experiment_records WHERE id = ?", id).Scan(&oldStatus, &oldGravity)
	if err != nil {
		return err
	}

	newStatus := model.StatusCorrected
	if oldStatus == model.StatusApproved {
		newStatus = model.StatusApproved
	}

	_, err = tx.Exec(`UPDATE experiment_records SET final_gravity = ?, status = ?, 
		updated_at = ?, last_modified_by = ? WHERE id = ?`,
		gravity, newStatus, time.Now(), modifiedBy, id)
	if err != nil {
		return err
	}

	details := fmt.Sprintf("重力加速度从 %.4f 更新为 %.4f", oldGravity, gravity)
	_, err = tx.Exec(`INSERT INTO status_history 
		(record_id, from_status, to_status, modified_by, reason, change_details, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		id, oldStatus, newStatus, modifiedBy, reason, details, time.Now())
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (d *Database) GetStats() (map[string]int, error) {
	rows, err := d.db.Query("SELECT status, COUNT(*) FROM experiment_records GROUP BY status")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	stats := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		stats[status] = count
	}
	return stats, nil
}
