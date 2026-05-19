package repository

import (
	"database/sql"
	"fmt"
	"time"

	"quality-control-system/internal/model"
)

type SampleRepository struct {
	db *sql.DB
}

func NewSampleRepository() *SampleRepository {
	return &SampleRepository{db: DB}
}

func (r *SampleRepository) Create(sample *model.FoodSample) error {
	query := `
		INSERT INTO food_samples (sample_no, store_id, dish_name, dish_batch, sample_weight, 
			sample_time, keeper, keeper_phone, storage_location, expire_time, status, 
			is_destroyed, idempotent_key, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`
	now := time.Now()
	_, err := r.db.Exec(query,
		sample.SampleNo, sample.StoreID, sample.DishName, sample.DishBatch,
		sample.SampleWeight, sample.SampleTime, sample.Keeper, sample.KeeperPhone,
		sample.StorageLocation, sample.ExpireTime, sample.Status, sample.IsDestroyed,
		sample.IdempotentKey, now, now,
	)
	return err
}

func (r *SampleRepository) GetByNo(sampleNo string) (*model.FoodSample, error) {
	query := `
		SELECT id, sample_no, store_id, dish_name, dish_batch, sample_weight, 
			sample_time, keeper, keeper_phone, storage_location, expire_time, status, 
			is_destroyed, destroy_time, destroy_operator, destroy_reason, idempotent_key, created_at, updated_at
		FROM food_samples WHERE sample_no = ?
	`
	sample := &model.FoodSample{}
	var destroyTime sql.NullTime
	err := r.db.QueryRow(query, sampleNo).Scan(
		&sample.ID, &sample.SampleNo, &sample.StoreID, &sample.DishName, &sample.DishBatch,
		&sample.SampleWeight, &sample.SampleTime, &sample.Keeper, &sample.KeeperPhone,
		&sample.StorageLocation, &sample.ExpireTime, &sample.Status, &sample.IsDestroyed,
		&destroyTime, &sample.DestroyOperator, &sample.DestroyReason, &sample.IdempotentKey,
		&sample.CreatedAt, &sample.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	if destroyTime.Valid {
		sample.DestroyTime = &destroyTime.Time
	}
	return sample, nil
}

func (r *SampleRepository) GetByIdempotentKey(key string) (*model.FoodSample, error) {
	query := `
		SELECT id, sample_no, store_id, dish_name, dish_batch, sample_weight, 
			sample_time, keeper, keeper_phone, storage_location, expire_time, status, 
			is_destroyed, destroy_time, destroy_operator, destroy_reason, idempotent_key, created_at, updated_at
		FROM food_samples WHERE idempotent_key = ?
	`
	sample := &model.FoodSample{}
	var destroyTime sql.NullTime
	err := r.db.QueryRow(query, key).Scan(
		&sample.ID, &sample.SampleNo, &sample.StoreID, &sample.DishName, &sample.DishBatch,
		&sample.SampleWeight, &sample.SampleTime, &sample.Keeper, &sample.KeeperPhone,
		&sample.StorageLocation, &sample.ExpireTime, &sample.Status, &sample.IsDestroyed,
		&destroyTime, &sample.DestroyOperator, &sample.DestroyReason, &sample.IdempotentKey,
		&sample.CreatedAt, &sample.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	if destroyTime.Valid {
		sample.DestroyTime = &destroyTime.Time
	}
	return sample, nil
}

func (r *SampleRepository) UpdateStatus(sampleNo string, status string) error {
	query := `UPDATE food_samples SET status = ?, updated_at = ? WHERE sample_no = ?`
	_, err := r.db.Exec(query, status, time.Now(), sampleNo)
	return err
}

func (r *SampleRepository) Destroy(sampleNo string, operator string, reason string) error {
	query := `
		UPDATE food_samples 
		SET is_destroyed = 1, destroy_time = ?, destroy_operator = ?, destroy_reason = ?, 
			status = 'destroyed', updated_at = ?
		WHERE sample_no = ?
	`
	_, err := r.db.Exec(query, time.Now(), operator, reason, time.Now(), sampleNo)
	return err
}

func (r *SampleRepository) ListByStore(storeID string, page, pageSize int) ([]*model.FoodSample, int, error) {
	offset := (page - 1) * pageSize
	countQuery := `SELECT COUNT(*) FROM food_samples WHERE store_id = ?`
	var total int
	err := r.db.QueryRow(countQuery, storeID).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	query := `
		SELECT id, sample_no, store_id, dish_name, dish_batch, sample_weight, 
			sample_time, keeper, keeper_phone, storage_location, expire_time, status, 
			is_destroyed, destroy_time, destroy_operator, destroy_reason, created_at, updated_at
		FROM food_samples WHERE store_id = ?
		ORDER BY sample_time DESC LIMIT ? OFFSET ?
	`
	rows, err := r.db.Query(query, storeID, pageSize, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var samples []*model.FoodSample
	for rows.Next() {
		sample := &model.FoodSample{}
		var destroyTime sql.NullTime
		err := rows.Scan(
			&sample.ID, &sample.SampleNo, &sample.StoreID, &sample.DishName, &sample.DishBatch,
			&sample.SampleWeight, &sample.SampleTime, &sample.Keeper, &sample.KeeperPhone,
			&sample.StorageLocation, &sample.ExpireTime, &sample.Status, &sample.IsDestroyed,
			&destroyTime, &sample.DestroyOperator, &sample.DestroyReason,
			&sample.CreatedAt, &sample.UpdatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if destroyTime.Valid {
			sample.DestroyTime = &destroyTime.Time
		}
		samples = append(samples, sample)
	}
	return samples, total, nil
}

func (r *SampleRepository) GetExpiredSamples(beforeTime time.Time) ([]*model.FoodSample, error) {
	query := `
		SELECT id, sample_no, store_id, dish_name, dish_batch, expire_time, status, is_destroyed
		FROM food_samples 
		WHERE expire_time <= ? AND status = 'normal' AND is_destroyed = 0
	`
	rows, err := r.db.Query(query, beforeTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []*model.FoodSample
	for rows.Next() {
		sample := &model.FoodSample{}
		err := rows.Scan(
			&sample.ID, &sample.SampleNo, &sample.StoreID, &sample.DishName, &sample.DishBatch,
			&sample.ExpireTime, &sample.Status, &sample.IsDestroyed,
		)
		if err != nil {
			return nil, err
		}
		samples = append(samples, sample)
	}
	return samples, nil
}

func (r *SampleRepository) GetByBatch(dishBatch string) ([]*model.FoodSample, error) {
	query := `
		SELECT id, sample_no, store_id, dish_name, dish_batch, sample_weight, 
			sample_time, expire_time, status, is_destroyed
		FROM food_samples WHERE dish_batch = ?
		ORDER BY store_id, sample_time
	`
	rows, err := r.db.Query(query, dishBatch)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var samples []*model.FoodSample
	for rows.Next() {
		sample := &model.FoodSample{}
		err := rows.Scan(
			&sample.ID, &sample.SampleNo, &sample.StoreID, &sample.DishName, &sample.DishBatch,
			&sample.SampleWeight, &sample.SampleTime, &sample.ExpireTime,
			&sample.Status, &sample.IsDestroyed,
		)
		if err != nil {
			return nil, err
		}
		samples = append(samples, sample)
	}
	return samples, nil
}
