package repository

import (
	"database/sql"
	"time"

	"quality-control-system/internal/model"
)

type WasteRepository struct {
	db *sql.DB
}

func NewWasteRepository() *WasteRepository {
	return &WasteRepository{db: DB}
}

func (r *WasteRepository) Create(record *model.WasteRecord) error {
	query := `
		INSERT INTO waste_records (waste_no, store_id, dish_name, dish_batch, waste_type,
			waste_weight, waste_time, waste_reason, operator, operator_phone, witness,
			idempotent_key, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now()
	_, err := r.db.Exec(query,
		record.WasteNo, record.StoreID, record.DishName, record.DishBatch, record.WasteType,
		record.WasteWeight, record.WasteTime, record.WasteReason, record.Operator,
		record.OperatorPhone, record.Witness, record.IdempotentKey, now, now,
	)
	return err
}

func (r *WasteRepository) GetByNo(wasteNo string) (*model.WasteRecord, error) {
	query := `
		SELECT id, waste_no, store_id, dish_name, dish_batch, waste_type, waste_weight,
			waste_time, waste_reason, operator, operator_phone, witness, idempotent_key,
			created_at, updated_at
		FROM waste_records WHERE waste_no = ?
	`
	record := &model.WasteRecord{}
	err := r.db.QueryRow(query, wasteNo).Scan(
		&record.ID, &record.WasteNo, &record.StoreID, &record.DishName, &record.DishBatch,
		&record.WasteType, &record.WasteWeight, &record.WasteTime, &record.WasteReason,
		&record.Operator, &record.OperatorPhone, &record.Witness, &record.IdempotentKey,
		&record.CreatedAt, &record.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (r *WasteRepository) GetByIdempotentKey(key string) (*model.WasteRecord, error) {
	query := `
		SELECT id, waste_no, store_id, dish_name, dish_batch, waste_type, waste_weight,
			waste_time, waste_reason, operator, operator_phone, witness, idempotent_key,
			created_at, updated_at
		FROM waste_records WHERE idempotent_key = ?
	`
	record := &model.WasteRecord{}
	err := r.db.QueryRow(query, key).Scan(
		&record.ID, &record.WasteNo, &record.StoreID, &record.DishName, &record.DishBatch,
		&record.WasteType, &record.WasteWeight, &record.WasteTime, &record.WasteReason,
		&record.Operator, &record.OperatorPhone, &record.Witness, &record.IdempotentKey,
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

func (r *WasteRepository) ListByStore(storeID string, page, pageSize int) ([]*model.WasteRecord, int, error) {
	offset := (page - 1) * pageSize
	countQuery := `SELECT COUNT(*) FROM waste_records WHERE store_id = ?`
	var total int
	err := r.db.QueryRow(countQuery, storeID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, waste_no, store_id, dish_name, dish_batch, waste_type, waste_weight,
			waste_time, waste_reason, operator, witness, created_at, updated_at
		FROM waste_records WHERE store_id = ?
		ORDER BY waste_time DESC LIMIT ? OFFSET ?
	`
	rows, err := r.db.Query(query, storeID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var records []*model.WasteRecord
	for rows.Next() {
		record := &model.WasteRecord{}
		err := rows.Scan(
			&record.ID, &record.WasteNo, &record.StoreID, &record.DishName, &record.DishBatch,
			&record.WasteType, &record.WasteWeight, &record.WasteTime, &record.WasteReason,
			&record.Operator, &record.Witness, &record.CreatedAt, &record.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		records = append(records, record)
	}
	return records, total, nil
}

func (r *WasteRepository) GetByBatch(dishBatch string) ([]*model.WasteRecord, error) {
	query := `
		SELECT id, waste_no, store_id, dish_name, dish_batch, waste_type, waste_weight,
			waste_time, waste_reason, operator
		FROM waste_records WHERE dish_batch = ?
		ORDER BY store_id, waste_time
	`
	rows, err := r.db.Query(query, dishBatch)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*model.WasteRecord
	for rows.Next() {
		record := &model.WasteRecord{}
		err := rows.Scan(
			&record.ID, &record.WasteNo, &record.StoreID, &record.DishName, &record.DishBatch,
			&record.WasteType, &record.WasteWeight, &record.WasteTime, &record.WasteReason,
			&record.Operator,
		)
		if err != nil {
			return nil, err
		}
		records = append(records, record)
	}
	return records, nil
}
