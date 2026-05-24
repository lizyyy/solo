package database

import (
	"database/sql"
	"fmt"
	"time"

	"lab-reagent-api/internal/model"
)

type OrderRepo struct {
	db *sql.DB
}

func NewOrderRepo(db *sql.DB) *OrderRepo {
	return &OrderRepo{db: db}
}

func (r *OrderRepo) Create(order *model.ProcessingOrder) error {
	order.CreatedAt = time.Now()
	result, err := r.db.Exec(`
		INSERT INTO processing_orders (order_no, batch_no, type, status, created_by, needs_review, created_at, request_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		order.OrderNo, order.BatchNo, order.Type, order.Status,
		order.CreatedBy, order.NeedsReview, order.CreatedAt.Format(time.RFC3339), order.RequestID,
	)
	if err != nil {
		return err
	}
	order.ID, err = result.LastInsertId()
	return err
}

func (r *OrderRepo) GetByOrderNo(orderNo string) (*model.ProcessingOrder, error) {
	var order model.ProcessingOrder
	var reviewedBy, reviewNotes, reviewedAt sql.NullString

	err := r.db.QueryRow(`
		SELECT id, order_no, batch_no, type, status, created_by, reviewed_by,
		       review_notes, reviewed_at, needs_review, created_at
		FROM processing_orders WHERE order_no = ?`, orderNo).Scan(
		&order.ID, &order.OrderNo, &order.BatchNo, &order.Type, &order.Status,
		&order.CreatedBy, &reviewedBy, &reviewNotes,
		&reviewedAt, &order.NeedsReview, &order.CreatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}

	if reviewedBy.Valid {
		order.ReviewedBy = reviewedBy.String
	}
	if reviewNotes.Valid {
		order.ReviewNotes = reviewNotes.String
	}
	if reviewedAt.Valid {
		if t, err := time.Parse(time.RFC3339, reviewedAt.String); err == nil {
			order.ReviewedAt = &t
		}
	}

	return &order, nil
}

func (r *OrderRepo) Update(order *model.ProcessingOrder) error {
	_, err := r.db.Exec(`
		UPDATE processing_orders SET
			status = ?, reviewed_by = ?, review_notes = ?, reviewed_at = ?, needs_review = ?
		WHERE id = ?`,
		order.Status, order.ReviewedBy, order.ReviewNotes,
		ParseTime(order.ReviewedAt), order.NeedsReview, order.ID,
	)
	return err
}

func (r *OrderRepo) CheckDuplicateRequest(requestID string) (bool, error) {
	var count int
	err := r.db.QueryRow(`SELECT COUNT(*) FROM processing_orders WHERE request_id = ?`, requestID).Scan(&count)
	return count > 0, err
}

func (r *OrderRepo) ListAll() ([]model.ProcessingOrder, error) {
	rows, err := r.db.Query(`
		SELECT id, order_no, batch_no, type, status, created_by, reviewed_by,
		       review_notes, reviewed_at, needs_review, created_at
		FROM processing_orders ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var orders []model.ProcessingOrder
	for rows.Next() {
		var order model.ProcessingOrder
		var reviewedBy, reviewNotes, reviewedAt sql.NullString

		err := rows.Scan(
			&order.ID, &order.OrderNo, &order.BatchNo, &order.Type, &order.Status,
			&order.CreatedBy, &reviewedBy, &reviewNotes,
			&reviewedAt, &order.NeedsReview, &order.CreatedAt,
		)
		if err != nil {
			return nil, err
		}

		if reviewedBy.Valid {
			order.ReviewedBy = reviewedBy.String
		}
		if reviewNotes.Valid {
			order.ReviewNotes = reviewNotes.String
		}
		if reviewedAt.Valid {
			if t, err := time.Parse(time.RFC3339, reviewedAt.String); err == nil {
				order.ReviewedAt = &t
			}
		}

		orders = append(orders, order)
	}
	return orders, nil
}

func (r *OrderRepo) GetNextOrderNo(prefix string) (string, error) {
	var maxNo sql.NullString
	err := r.db.QueryRow(`
		SELECT order_no FROM processing_orders 
		WHERE order_no LIKE ? 
		ORDER BY order_no DESC LIMIT 1`, prefix+"%").Scan(&maxNo)

	if err == sql.ErrNoRows || !maxNo.Valid {
		return prefix + "-0001", nil
	}
	if err != nil {
		return "", err
	}

	seq := 1
	if len(maxNo.String) > len(prefix)+1 {
		seqPart := maxNo.String[len(prefix)+1:]
		var num int
		if _, err := fmt.Sscanf(seqPart, "%d", &num); err == nil {
			seq = num + 1
		} else {
			seq = 1
		}
	}

	if seq > 9999 {
		seq = 1
	}

	return fmt.Sprintf("%s-%04d", prefix, seq), nil
}
