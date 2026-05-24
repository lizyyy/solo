package database

import (
	"database/sql"
	"time"

	"lab-reagent-api/internal/model"
)

type UsageRepo struct {
	db *sql.DB
}

func NewUsageRepo(db *sql.DB) *UsageRepo {
	return &UsageRepo{db: db}
}

func (r *UsageRepo) Create(record *model.UsageRecord) error {
	record.UsedAt = time.Now()
	result, err := r.db.Exec(`
		INSERT INTO usage_records (reagent_id, batch_no, used_by, project, volume, notes, used_at, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		record.ReagentID, record.BatchNo, record.UsedBy, record.Project,
		record.Volume, record.Notes, record.UsedAt.Format(time.RFC3339), record.RequestID,
	)
	if err != nil {
		return err
	}
	record.ID, err = result.LastInsertId()
	return err
}

func (r *UsageRepo) CheckDuplicateRequest(requestID string) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM usage_records WHERE request_id = ?`, requestID).Scan(&count)
	return count > 0, err
}

func (r *UsageRepo) GetByBatchNo(batchNo string) ([]model.UsageRecord, error) {
	rows, err := r.db.Query(`
		SELECT id, reagent_id, batch_no, used_by, project, volume, notes, used_at
		FROM usage_records WHERE batch_no = ? ORDER BY used_at DESC`, batchNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []model.UsageRecord
	for rows.Next() {
		var record model.UsageRecord
		var usedAtStr string

		err := rows.Scan(&record.ID, &record.ReagentID, &record.BatchNo,
			&record.UsedBy, &record.Project, &record.Volume, &record.Notes, &usedAtStr)
		if err != nil {
			return nil, err
		}

		if t, err := time.Parse(time.RFC3339, usedAtStr); err == nil {
			record.UsedAt = t
		}

		records = append(records, record)
	}
	return records, nil
}

func (r *UsageRepo) GetProjectsByBatchNo(batchNo string) ([]string, error) {
	rows, err := r.db.Query(`
		SELECT DISTINCT project FROM usage_records WHERE batch_no = ? ORDER BY project`, batchNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var projects []string
	for rows.Next() {
		var project string
		if err := rows.Scan(&project); err != nil {
			return nil, err
		}
		projects = append(projects, project)
	}
	return projects, nil
}

func (r *UsageRepo) ListAll() ([]model.UsageRecord, error) {
	rows, err := r.db.Query(`
		SELECT id, reagent_id, batch_no, used_by, project, volume, notes, used_at
		FROM usage_records ORDER BY used_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []model.UsageRecord
	for rows.Next() {
		var record model.UsageRecord
		var usedAtStr string

		err := rows.Scan(&record.ID, &record.ReagentID, &record.BatchNo,
			&record.UsedBy, &record.Project, &record.Volume, &record.Notes, &usedAtStr)
		if err != nil {
			return nil, err
		}

		if t, err := time.Parse(time.RFC3339, usedAtStr); err == nil {
			record.UsedAt = t
		}

		records = append(records, record)
	}
	return records, nil
}
