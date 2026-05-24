package database

import (
	"database/sql"
	"time"

	"lab-reagent-api/internal/model"
)

type ReagentRepo struct {
	db *sql.DB
}

func NewReagentRepo(db *sql.DB) *ReagentRepo {
	return &ReagentRepo{db: db}
}

func (r *ReagentRepo) GetByBatchNo(batchNo string) (*model.Reagent, error) {
	var reagent model.Reagent
	var thawedAt, expireAt, discardedAt sql.NullString

	err := r.db.QueryRow(`
		SELECT id, batch_no, reagent_type, status, thawed_at, thawed_by, project, 
		       expire_at, discarded_at, discarded_by, discard_reason, created_at, updated_at
		FROM reagents WHERE batch_no = ?`, batchNo).Scan(
		&reagent.ID, &reagent.BatchNo, &reagent.ReagentType, &reagent.Status,
		&thawedAt, &reagent.ThawedBy, &reagent.Project,
		&expireAt, &discardedAt, &reagent.DiscardedBy, &reagent.DiscardReason,
		&reagent.CreatedAt, &reagent.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if thawedAt.Valid {
		if t, err := time.Parse(time.RFC3339, thawedAt.String); err == nil {
			reagent.ThawedAt = &t
		}
	}
	if expireAt.Valid {
		if t, err := time.Parse(time.RFC3339, expireAt.String); err == nil {
			reagent.ExpireAt = &t
		}
	}
	if discardedAt.Valid {
		if t, err := time.Parse(time.RFC3339, discardedAt.String); err == nil {
			reagent.DiscardedAt = &t
		}
	}

	return &reagent, nil
}

func (r *ReagentRepo) Create(reagent *model.Reagent) error {
	now := time.Now()
	reagent.CreatedAt = now
	reagent.UpdatedAt = now

	result, err := r.db.Exec(`
		INSERT INTO reagents (batch_no, reagent_type, status, created_at, updated_at, request_id)
		VALUES (?, ?, ?, ?, ?, ?)`,
		reagent.BatchNo, reagent.ReagentType, reagent.Status,
		now.Format(time.RFC3339), now.Format(time.RFC3339), reagent.RequestID,
	)
	if err != nil {
		return err
	}

	reagent.ID, err = result.LastInsertId()
	return err
}

func (r *ReagentRepo) Update(reagent *model.Reagent) error {
	reagent.UpdatedAt = time.Now()

	_, err := r.db.Exec(`
		UPDATE reagents SET 
			status = ?, thawed_at = ?, thawed_by = ?, project = ?, expire_at = ?,
			discarded_at = ?, discarded_by = ?, discard_reason = ?, updated_at = ?
		WHERE id = ?`,
		reagent.Status, ParseTime(reagent.ThawedAt), reagent.ThawedBy, reagent.Project,
		ParseTime(reagent.ExpireAt), ParseTime(reagent.DiscardedAt),
		reagent.DiscardedBy, reagent.DiscardReason,
		reagent.UpdatedAt.Format(time.RFC3339), reagent.ID,
	)
	return err
}

func (r *ReagentRepo) CheckDuplicateRequest(requestID string) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM reagents WHERE request_id = ?`, requestID).Scan(&count)
	return count > 0, err
}

func (r *ReagentRepo) ListAll() ([]model.Reagent, error) {
	rows, err := r.db.Query(`
		SELECT id, batch_no, reagent_type, status, thawed_at, thawed_by, project,
		       expire_at, discarded_at, discarded_by, discard_reason, created_at, updated_at
		FROM reagents ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reagents []model.Reagent
	for rows.Next() {
		var reagent model.Reagent
		var thawedAt, expireAt, discardedAt sql.NullString

		err := rows.Scan(
			&reagent.ID, &reagent.BatchNo, &reagent.ReagentType, &reagent.Status,
			&thawedAt, &reagent.ThawedBy, &reagent.Project,
			&expireAt, &discardedAt, &reagent.DiscardedBy, &reagent.DiscardReason,
			&reagent.CreatedAt, &reagent.UpdatedAt,
		)
		if err != nil {
			return nil, err
		}

		if thawedAt.Valid {
			if t, err := time.Parse(time.RFC3339, thawedAt.String); err == nil {
				reagent.ThawedAt = &t
			}
		}
		if expireAt.Valid {
			if t, err := time.Parse(time.RFC3339, expireAt.String); err == nil {
				reagent.ExpireAt = &t
			}
		}
		if discardedAt.Valid {
			if t, err := time.Parse(time.RFC3339, discardedAt.String); err == nil {
				reagent.DiscardedAt = &t
			}
		}

		reagents = append(reagents, reagent)
	}

	return reagents, nil
}

func (r *ReagentRepo) UpdateExpiredStatus() (int64, error) {
	now := time.Now().Format(time.RFC3339)
	result, err := r.db.Exec(`
		UPDATE reagents SET status = 'expired', updated_at = ?
		WHERE status IN ('thawed', 'in_use') AND expire_at < ?`,
		now, now,
	)
	if err != nil {
		return 0, err
	}
	return result.RowsAffected()
}
