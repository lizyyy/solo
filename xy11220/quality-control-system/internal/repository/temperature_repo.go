package repository

import (
	"database/sql"
	"time"

	"quality-control-system/internal/model"
)

type TemperatureRepository struct {
	db *sql.DB
}

func NewTemperatureRepository() *TemperatureRepository {
	return &TemperatureRepository{db: DB}
}

func (r *TemperatureRepository) Create(record *model.TemperatureRecord) error {
	query := `
		INSERT INTO temperature_records (record_no, store_id, fridge_id, fridge_name, 
			temperature, check_time, checker, checker_phone, is_normal, anomaly_reason, 
			idempotent_key, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now()
	_, err := r.db.Exec(query,
		record.RecordNo, record.StoreID, record.FridgeID, record.FridgeName,
		record.Temperature, record.CheckTime, record.Checker, record.CheckerPhone,
		record.IsNormal, record.AnomalyReason, record.IdempotentKey, now, now,
	)
	return err
}

func (r *TemperatureRepository) GetByNo(recordNo string) (*model.TemperatureRecord, error) {
	query := `
		SELECT id, record_no, store_id, fridge_id, fridge_name, temperature, 
			check_time, checker, checker_phone, is_normal, anomaly_reason, 
			idempotent_key, created_at, updated_at
		FROM temperature_records WHERE record_no = ?
	`
	record := &model.TemperatureRecord{}
	err := r.db.QueryRow(query, recordNo).Scan(
		&record.ID, &record.RecordNo, &record.StoreID, &record.FridgeID, &record.FridgeName,
		&record.Temperature, &record.CheckTime, &record.Checker, &record.CheckerPhone,
		&record.IsNormal, &record.AnomalyReason, &record.IdempotentKey,
		&record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (r *TemperatureRepository) GetByIdempotentKey(key string) (*model.TemperatureRecord, error) {
	query := `
		SELECT id, record_no, store_id, fridge_id, fridge_name, temperature, 
			check_time, checker, checker_phone, is_normal, anomaly_reason, 
			idempotent_key, created_at, updated_at
		FROM temperature_records WHERE idempotent_key = ?
	`
	record := &model.TemperatureRecord{}
	err := r.db.QueryRow(query, key).Scan(
		&record.ID, &record.RecordNo, &record.StoreID, &record.FridgeID, &record.FridgeName,
		&record.Temperature, &record.CheckTime, &record.Checker, &record.CheckerPhone,
		&record.IsNormal, &record.AnomalyReason, &record.IdempotentKey,
		&record.CreatedAt, &record.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (r *TemperatureRepository) ListByStore(storeID string, page, pageSize int) ([]*model.TemperatureRecord, int, error) {
	offset := (page - 1) * pageSize
	countQuery := `SELECT COUNT(*) FROM temperature_records WHERE store_id = ?`
	var total int
	err := r.db.QueryRow(countQuery, storeID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, record_no, store_id, fridge_id, fridge_name, temperature, 
			check_time, checker, checker_phone, is_normal, anomaly_reason, created_at, updated_at
		FROM temperature_records WHERE store_id = ?
		ORDER BY check_time DESC LIMIT ? OFFSET ?
	`
	rows, err := r.db.Query(query, storeID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []*model.TemperatureRecord
	for rows.Next() {
		record := &model.TemperatureRecord{}
		err := rows.Scan(
			&record.ID, &record.RecordNo, &record.StoreID, &record.FridgeID, &record.FridgeName,
			&record.Temperature, &record.CheckTime, &record.Checker, &record.CheckerPhone,
			&record.IsNormal, &record.AnomalyReason, &record.CreatedAt, &record.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		records = append(records, record)
	}
	return records, total, nil
}

func (r *TemperatureRepository) GetByTimeRange(storeID string, startTime, endTime time.Time) ([]*model.TemperatureRecord, error) {
	query := `
		SELECT id, record_no, store_id, fridge_id, fridge_name, temperature, 
			check_time, checker, is_normal, anomaly_reason
		FROM temperature_records 
		WHERE store_id = ? AND check_time >= ? AND check_time <= ?
		ORDER BY check_time
	`
	rows, err := r.db.Query(query, storeID, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.TemperatureRecord
	for rows.Next() {
		record := &model.TemperatureRecord{}
		err := rows.Scan(
			&record.ID, &record.RecordNo, &record.StoreID, &record.FridgeID, &record.FridgeName,
			&record.Temperature, &record.CheckTime, &record.Checker,
			&record.IsNormal, &record.AnomalyReason,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, nil
}
