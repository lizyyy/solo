package database

import (
	"database/sql"
	"time"

	"lab-reagent-api/internal/model"
)

type JudgmentRepo struct {
	db *sql.DB
}

func NewJudgmentRepo(db *sql.DB) *JudgmentRepo {
	return &JudgmentRepo{db: db}
}

func (r *JudgmentRepo) Create(history *model.JudgmentHistory) error {
	history.JudgedAt = time.Now()
	result, err := r.db.Exec(`
		INSERT INTO judgment_history (order_id, order_no, judgment, judged_by, notes, judged_at, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)`,
		history.OrderID, history.OrderNo, history.Judgment, history.JudgedBy,
		history.Notes, history.JudgedAt.Format(time.RFC3339), history.RequestID,
	)
	if err != nil {
		return err
	}
	history.ID, err = result.LastInsertId()
	return err
}

func (r *JudgmentRepo) CheckDuplicateRequest(requestID string) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM judgment_history WHERE request_id = ?`, requestID).Scan(&count)
	return count > 0, err
}

func (r *JudgmentRepo) GetByOrderID(orderID int64) ([]model.JudgmentHistory, error) {
	rows, err := r.db.Query(`
		SELECT id, order_id, order_no, judgment, judged_by, notes, judged_at
		FROM judgment_history WHERE order_id = ? ORDER BY judged_at DESC`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []model.JudgmentHistory
	for rows.Next() {
		var h model.JudgmentHistory
		var judgedAtStr string

		err := rows.Scan(&h.ID, &h.OrderID, &h.OrderNo, &h.Judgment, &h.JudgedBy, &h.Notes, &judgedAtStr)
		if err != nil {
			return nil, err
		}

		if t, err := time.Parse(time.RFC3339, judgedAtStr); err == nil {
			h.JudgedAt = t
		}

		histories = append(histories, h)
	}
	return histories, nil
}

func (r *JudgmentRepo) GetByOrderNo(orderNo string) ([]model.JudgmentHistory, error) {
	rows, err := r.db.Query(`
		SELECT id, order_id, order_no, judgment, judged_by, notes, judged_at
		FROM judgment_history WHERE order_no = ? ORDER BY judged_at DESC`, orderNo)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var histories []model.JudgmentHistory
	for rows.Next() {
		var h model.JudgmentHistory
		var judgedAtStr string

		err := rows.Scan(&h.ID, &h.OrderID, &h.OrderNo, &h.Judgment, &h.JudgedBy, &h.Notes, &judgedAtStr)
		if err != nil {
			return nil, err
		}

		if t, err := time.Parse(time.RFC3339, judgedAtStr); err == nil {
			h.JudgedAt = t
		}

		histories = append(histories, h)
	}
	return histories, nil
}
