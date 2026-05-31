package db

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

const schema = `
CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_no TEXT NOT NULL,
    idempotency_key TEXT DEFAULT '',
    idempotency_key_valid INTEGER DEFAULT 1,
    client_params TEXT DEFAULT '{}',
    client_params_corrupted INTEGER DEFAULT 0,
    source TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'imported',
    pending_reason TEXT DEFAULT '',
    review_reason TEXT DEFAULT '',
    reviewed_by TEXT DEFAULT '',
    reviewed_at DATETIME,
    raw_data TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_order_no ON orders(order_no);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_idempotency_key ON orders(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_orders_source ON orders(source);

CREATE TABLE IF NOT EXISTS order_histories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    old_status TEXT DEFAULT '',
    new_status TEXT DEFAULT '',
    operator TEXT NOT NULL,
    reason TEXT DEFAULT '',
    detail TEXT DEFAULT '{}',
    created_at DATETIME NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id)
);

CREATE INDEX IF NOT EXISTS idx_order_histories_order_id ON order_histories(order_id);
`

const StatusImported = "imported"
const StatusPending = "pending"
const StatusReviewed = "reviewed"
const StatusFixed = "fixed"
const StatusMigrated = "migrated"
const StatusSkipped = "skipped"

var validStatuses = map[string]bool{
	StatusImported:  true,
	StatusPending:   true,
	StatusReviewed:  true,
	StatusFixed:     true,
	StatusMigrated:  true,
	StatusSkipped:   true,
}

func IsValidStatus(s string) bool {
	return validStatuses[s]
}

type Order struct {
	ID                    int64
	OrderNo               string
	IdempotencyKey        string
	IdempotencyKeyValid   bool
	ClientParams          string
	ClientParamsCorrupted bool
	Source                string
	Status                string
	PendingReason         string
	ReviewReason          string
	ReviewedBy            string
	ReviewedAt            *time.Time
	RawData               string
	CreatedAt             time.Time
	UpdatedAt             time.Time
}

type OrderHistory struct {
	ID         int64
	OrderID    int64
	Action     string
	OldStatus  string
	NewStatus  string
	Operator   string
	Reason     string
	Detail     string
	CreatedAt  time.Time
}

var dbPath string

func SetDBPath(p string) {
	dbPath = p
}

func GetDBPath() string {
	if dbPath != "" {
		return dbPath
	}
	return "legacy_order_sync.db"
}

func Open() (*sql.DB, error) {
	p := GetDBPath()
	dir := filepath.Dir(p)
	if dir != "" && dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("create db directory: %w", err)
		}
	}
	db, err := sql.Open("sqlite3", p+"?_journal_mode=WAL&_busy_timeout=5000")
	if err != nil {
		return nil, fmt.Errorf("open database: %w", err)
	}
	return db, nil
}

func InitSchema(db *sql.DB) error {
	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("init schema: %w", err)
	}
	return nil
}

func EnsureDB() (*sql.DB, error) {
	db, err := Open()
	if err != nil {
		return nil, err
	}
	if err := InitSchema(db); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}

func InsertOrder(db *sql.DB, o *Order) (int64, error) {
	now := time.Now()
	idempotencyKeyValid := 0
	if o.IdempotencyKeyValid {
		idempotencyKeyValid = 1
	}
	clientParamsCorrupted := 0
	if o.ClientParamsCorrupted {
		clientParamsCorrupted = 1
	}

	result, err := db.Exec(`
		INSERT INTO orders (order_no, idempotency_key, idempotency_key_valid, client_params, client_params_corrupted, source, status, pending_reason, raw_data, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		o.OrderNo, o.IdempotencyKey, idempotencyKeyValid, o.ClientParams, clientParamsCorrupted,
		o.Source, o.Status, o.PendingReason, o.RawData, now, now)
	if err != nil {
		return 0, fmt.Errorf("insert order: %w", err)
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, fmt.Errorf("last insert id: %w", err)
	}
	o.ID = id
	o.CreatedAt = now
	o.UpdatedAt = now
	return id, nil
}

func UpdateOrderStatus(db *sql.DB, id int64, status, pendingReason string) error {
	now := time.Now()
	_, err := db.Exec(`
		UPDATE orders SET status = ?, pending_reason = ?, updated_at = ? WHERE id = ?`,
		status, pendingReason, now, id)
	return err
}

func UpdateOrderReview(db *sql.DB, id int64, status, reviewReason, reviewedBy string) error {
	now := time.Now()
	_, err := db.Exec(`
		UPDATE orders SET status = ?, review_reason = ?, reviewed_by = ?, reviewed_at = ?, updated_at = ? WHERE id = ?`,
		status, reviewReason, reviewedBy, now, now, id)
	return err
}

func UpdateOrderFix(db *sql.DB, id int64, status, clientParams string, clientParamsCorrupted bool, idempotencyKey string, idempotencyKeyValid bool) error {
	now := time.Now()
	cpc := 0
	if clientParamsCorrupted {
		cpc = 1
	}
	ikv := 0
	if idempotencyKeyValid {
		ikv = 1
	}
	_, err := db.Exec(`
		UPDATE orders SET status = ?, client_params = ?, client_params_corrupted = ?, idempotency_key = ?, idempotency_key_valid = ?, updated_at = ? WHERE id = ?`,
		status, clientParams, cpc, idempotencyKey, ikv, now, id)
	return err
}

func GetOrderByID(db *sql.DB, id int64) (*Order, error) {
	row := db.QueryRow(`
		SELECT id, order_no, idempotency_key, idempotency_key_valid, client_params, client_params_corrupted,
			source, status, pending_reason, review_reason, reviewed_by, reviewed_at, raw_data, created_at, updated_at
		FROM orders WHERE id = ?`, id)
	return scanOrder(row)
}

func GetOrderByOrderNo(db *sql.DB, orderNo string) (*Order, error) {
	row := db.QueryRow(`
		SELECT id, order_no, idempotency_key, idempotency_key_valid, client_params, client_params_corrupted,
			source, status, pending_reason, review_reason, reviewed_by, reviewed_at, raw_data, created_at, updated_at
		FROM orders WHERE order_no = ?`, orderNo)
	return scanOrder(row)
}

func ListOrdersByStatus(db *sql.DB, status string, limit int) ([]Order, error) {
	rows, err := db.Query(`
		SELECT id, order_no, idempotency_key, idempotency_key_valid, client_params, client_params_corrupted,
			source, status, pending_reason, review_reason, reviewed_by, reviewed_at, raw_data, created_at, updated_at
		FROM orders WHERE status = ? ORDER BY created_at ASC LIMIT ?`, status, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrders(rows)
}

func ListAllOrders(db *sql.DB, limit int) ([]Order, error) {
	rows, err := db.Query(`
		SELECT id, order_no, idempotency_key, idempotency_key_valid, client_params, client_params_corrupted,
			source, status, pending_reason, review_reason, reviewed_by, reviewed_at, raw_data, created_at, updated_at
		FROM orders ORDER BY created_at ASC LIMIT ?`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanOrders(rows)
}

func CountOrdersByStatus(db *sql.DB) (map[string]int, error) {
	rows, err := db.Query(`SELECT status, COUNT(*) FROM orders GROUP BY status`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	m := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, err
		}
		m[status] = count
	}
	return m, nil
}

func InsertHistory(db *sql.DB, h *OrderHistory) error {
	now := time.Now()
	_, err := db.Exec(`
		INSERT INTO order_histories (order_id, action, old_status, new_status, operator, reason, detail, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		h.OrderID, h.Action, h.OldStatus, h.NewStatus, h.Operator, h.Reason, h.Detail, now)
	if err != nil {
		return fmt.Errorf("insert history: %w", err)
	}
	return nil
}

func GetHistoriesByOrderID(db *sql.DB, orderID int64) ([]OrderHistory, error) {
	rows, err := db.Query(`
		SELECT id, order_id, action, old_status, new_status, operator, reason, detail, created_at
		FROM order_histories WHERE order_id = ? ORDER BY created_at ASC`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var histories []OrderHistory
	for rows.Next() {
		var h OrderHistory
		if err := rows.Scan(&h.ID, &h.OrderID, &h.Action, &h.OldStatus, &h.NewStatus,
			&h.Operator, &h.Reason, &h.Detail, &h.CreatedAt); err != nil {
			return nil, err
		}
		histories = append(histories, h)
	}
	return histories, nil
}

func scanOrder(row *sql.Row) (*Order, error) {
	var o Order
	var idempotencyKeyValid int
	var clientParamsCorrupted int
	var reviewedAt sql.NullTime
	err := row.Scan(&o.ID, &o.OrderNo, &o.IdempotencyKey, &idempotencyKeyValid, &o.ClientParams,
		&clientParamsCorrupted, &o.Source, &o.Status, &o.PendingReason, &o.ReviewReason,
		&o.ReviewedBy, &reviewedAt, &o.RawData, &o.CreatedAt, &o.UpdatedAt)
	if err != nil {
		return nil, err
	}
	o.IdempotencyKeyValid = idempotencyKeyValid == 1
	o.ClientParamsCorrupted = clientParamsCorrupted == 1
	if reviewedAt.Valid {
		o.ReviewedAt = &reviewedAt.Time
	}
	return &o, nil
}

func scanOrders(rows *sql.Rows) ([]Order, error) {
	var orders []Order
	for rows.Next() {
		var o Order
		var idempotencyKeyValid int
		var clientParamsCorrupted int
		var reviewedAt sql.NullTime
		err := rows.Scan(&o.ID, &o.OrderNo, &o.IdempotencyKey, &idempotencyKeyValid, &o.ClientParams,
			&clientParamsCorrupted, &o.Source, &o.Status, &o.PendingReason, &o.ReviewReason,
			&o.ReviewedBy, &reviewedAt, &o.RawData, &o.CreatedAt, &o.UpdatedAt)
		if err != nil {
			return nil, err
		}
		o.IdempotencyKeyValid = idempotencyKeyValid == 1
		o.ClientParamsCorrupted = clientParamsCorrupted == 1
		if reviewedAt.Valid {
			o.ReviewedAt = &reviewedAt.Time
		}
		orders = append(orders, o)
	}
	return orders, nil
}
