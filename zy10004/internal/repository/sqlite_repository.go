package repository

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
)

type SQLiteRepository struct {
	db *sql.DB
}

func NewSQLiteRepository(path string) (*SQLiteRepository, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("failed to open sqlite: %w", err)
	}

	repo := &SQLiteRepository{db: db}
	if err := repo.initSchema(); err != nil {
		return nil, err
	}
	return repo, nil
}

func (r *SQLiteRepository) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS orders (
		id TEXT PRIMARY KEY,
		user_id TEXT NOT NULL,
		items TEXT NOT NULL,
		status TEXT NOT NULL,
		total_amount INTEGER NOT NULL,
		metadata TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS payments (
		id TEXT PRIMARY KEY,
		order_id TEXT NOT NULL,
		user_id TEXT NOT NULL,
		amount INTEGER NOT NULL,
		currency TEXT NOT NULL,
		payment_method TEXT NOT NULL,
		status TEXT NOT NULL,
		transaction_id TEXT,
		metadata TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (order_id) REFERENCES orders(id)
	);

	CREATE TABLE IF NOT EXISTS stock_records (
		product_id TEXT PRIMARY KEY,
		available INTEGER NOT NULL,
		reserved INTEGER NOT NULL,
		total INTEGER NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS trace_records (
		id TEXT PRIMARY KEY,
		trace_id TEXT NOT NULL,
		span_id TEXT NOT NULL,
		parent_span_id TEXT,
		service TEXT NOT NULL,
		method TEXT NOT NULL,
		status TEXT NOT NULL,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		duration_ms INTEGER,
		attempt INTEGER NOT NULL DEFAULT 1,
		max_attempts INTEGER NOT NULL DEFAULT 1,
		error TEXT,
		metadata TEXT,
		INDEX idx_trace_id (trace_id),
		INDEX idx_span_id (span_id)
	);

	CREATE TABLE IF NOT EXISTS chaos_scenarios (
		id TEXT PRIMARY KEY,
		name TEXT NOT NULL,
		description TEXT,
		target_service TEXT NOT NULL,
		target_method TEXT,
		type TEXT NOT NULL,
		config TEXT NOT NULL,
		enabled INTEGER NOT NULL DEFAULT 0,
		created_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS problem_reports (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		summary TEXT,
		trace_id TEXT,
		problem_type TEXT NOT NULL,
		severity TEXT NOT NULL,
		affected_services TEXT,
		root_cause TEXT,
		evidence TEXT,
		recommendations TEXT,
		timeline TEXT,
		generated_at DATETIME NOT NULL
	);

	CREATE TABLE IF NOT EXISTS scenario_executions (
		id TEXT PRIMARY KEY,
		scenario_id TEXT NOT NULL,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		status TEXT NOT NULL,
		request_count INTEGER NOT NULL DEFAULT 0,
		error_count INTEGER NOT NULL DEFAULT 0,
		reports TEXT,
		FOREIGN KEY (scenario_id) REFERENCES chaos_scenarios(id)
	);
	`

	_, err := r.db.Exec(schema)
	return err
}

func (r *SQLiteRepository) Close() error {
	return r.db.Close()
}

func (r *SQLiteRepository) CreateOrder(ctx context.Context, order *types.Order) error {
	itemsJSON, err := json.Marshal(order.Items)
	if err != nil {
		return err
	}
	metadataJSON, err := json.Marshal(order.Metadata)
	if err != nil {
		return err
	}

	query := `INSERT INTO orders (id, user_id, items, status, total_amount, metadata, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = r.db.ExecContext(ctx, query, order.ID, order.UserID, string(itemsJSON),
		order.Status, order.TotalAmount, string(metadataJSON), order.CreatedAt, order.UpdatedAt)
	return err
}

func (r *SQLiteRepository) GetOrderByID(ctx context.Context, id string) (*types.Order, error) {
	var order types.Order
	var itemsJSON, metadataJSON string

	query := `SELECT id, user_id, items, status, total_amount, metadata, created_at, updated_at 
	          FROM orders WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	err := row.Scan(&order.ID, &order.UserID, &itemsJSON, &order.Status,
		&order.TotalAmount, &metadataJSON, &order.CreatedAt, &order.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal([]byte(itemsJSON), &order.Items); err != nil {
		return nil, err
	}
	if err := json.Unmarshal([]byte(metadataJSON), &order.Metadata); err != nil {
		return nil, err
	}

	return &order, nil
}

func (r *SQLiteRepository) UpdateOrderStatus(ctx context.Context, id string, status string, reason string) error {
	query := `UPDATE orders SET status = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, status, time.Now(), id)
	return err
}

func (r *SQLiteRepository) CreatePayment(ctx context.Context, payment *types.Payment) error {
	metadataJSON, err := json.Marshal(payment.Metadata)
	if err != nil {
		return err
	}

	query := `INSERT INTO payments (id, order_id, user_id, amount, currency, payment_method, 
	          status, transaction_id, metadata, created_at, updated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = r.db.ExecContext(ctx, query, payment.ID, payment.OrderID, payment.UserID,
		payment.Amount, payment.Currency, payment.PaymentMethod, payment.Status,
		payment.TransactionID, string(metadataJSON), payment.CreatedAt, payment.UpdatedAt)
	return err
}

func (r *SQLiteRepository) GetPaymentByID(ctx context.Context, id string) (*types.Payment, error) {
	var payment types.Payment
	var metadataJSON string

	query := `SELECT id, order_id, user_id, amount, currency, payment_method, status, 
	          transaction_id, metadata, created_at, updated_at FROM payments WHERE id = ?`
	row := r.db.QueryRowContext(ctx, query, id)

	err := row.Scan(&payment.ID, &payment.OrderID, &payment.UserID, &payment.Amount,
		&payment.Currency, &payment.PaymentMethod, &payment.Status, &payment.TransactionID,
		&metadataJSON, &payment.CreatedAt, &payment.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal([]byte(metadataJSON), &payment.Metadata); err != nil {
		return nil, err
	}

	return &payment, nil
}

func (r *SQLiteRepository) UpdatePaymentStatus(ctx context.Context, id string, status string, transactionID string) error {
	query := `UPDATE payments SET status = ?, transaction_id = ?, updated_at = ? WHERE id = ?`
	_, err := r.db.ExecContext(ctx, query, status, transactionID, time.Now(), id)
	return err
}

func (r *SQLiteRepository) GetStockByProductID(ctx context.Context, productID string) (*types.StockRecord, error) {
	var record types.StockRecord

	query := `SELECT product_id, available, reserved, total, updated_at 
	          FROM stock_records WHERE product_id = ?`
	row := r.db.QueryRowContext(ctx, query, productID)

	err := row.Scan(&record.ProductID, &record.Available, &record.Reserved, &record.Total, &record.UpdatedAt)
	if err != nil {
		return nil, err
	}

	return &record, nil
}

func (r *SQLiteRepository) CreateInitialStock(ctx context.Context, productID string, total int32) error {
	now := time.Now()
	query := `INSERT INTO stock_records (product_id, available, reserved, total, updated_at) 
	          VALUES (?, ?, 0, ?, ?) 
	          ON CONFLICT(product_id) DO NOTHING`
	_, err := r.db.ExecContext(ctx, query, productID, total, total, now)
	return err
}

func (r *SQLiteRepository) UpdateStock(ctx context.Context, record *types.StockRecord) error {
	query := `UPDATE stock_records SET available = ?, reserved = ?, total = ?, updated_at = ? 
	          WHERE product_id = ?`
	_, err := r.db.ExecContext(ctx, query, record.Available, record.Reserved, record.Total,
		time.Now(), record.ProductID)
	return err
}

func (r *SQLiteRepository) SaveTraceRecord(ctx context.Context, record *types.TraceRecord) error {
	metadataJSON, err := json.Marshal(record.Metadata)
	if err != nil {
		return err
	}

	query := `INSERT INTO trace_records (id, trace_id, span_id, parent_span_id, service, method, 
	          status, start_time, end_time, duration_ms, attempt, max_attempts, error, metadata) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err = r.db.ExecContext(ctx, query, record.ID, record.TraceID, record.SpanID,
		record.ParentSpanID, record.Service, record.Method, record.Status,
		record.StartTime, record.EndTime, record.DurationMS, record.Attempt,
		record.MaxAttempts, record.Error, string(metadataJSON))
	return err
}

func (r *SQLiteRepository) GetTraceRecords(ctx context.Context, traceID string) ([]*types.TraceRecord, error) {
	query := `SELECT id, trace_id, span_id, parent_span_id, service, method, status, 
	          start_time, end_time, duration_ms, attempt, max_attempts, error, metadata 
	          FROM trace_records WHERE trace_id = ? ORDER BY start_time ASC`

	rows, err := r.db.QueryContext(ctx, query, traceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*types.TraceRecord
	for rows.Next() {
		var record types.TraceRecord
		var metadataJSON string
		var endTime sql.NullTime
		var durationMS sql.NullInt64
		var errorStr sql.NullString

		err := rows.Scan(&record.ID, &record.TraceID, &record.SpanID, &record.ParentSpanID,
			&record.Service, &record.Method, &record.Status, &record.StartTime,
			&endTime, &durationMS, &record.Attempt, &record.MaxAttempts,
			&errorStr, &metadataJSON)
		if err != nil {
			return nil, err
		}

		if endTime.Valid {
			record.EndTime = endTime.Time
		}
		if durationMS.Valid {
			record.DurationMS = durationMS.Int64
		}
		if errorStr.Valid {
			record.Error = errorStr.String
		}

		if err := json.Unmarshal([]byte(metadataJSON), &record.Metadata); err != nil {
			return nil, err
		}

		records = append(records, &record)
	}

	return records, nil
}

func (r *SQLiteRepository) SaveChaosScenario(ctx context.Context, scenario *types.ChaosScenario) error {
	configJSON, err := json.Marshal(scenario.Config)
	if err != nil {
		return err
	}

	enabled := 0
	if scenario.Enabled {
		enabled = 1
	}

	query := `INSERT INTO chaos_scenarios (id, name, description, target_service, target_method, 
	          type, config, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) 
	          ON CONFLICT(id) DO UPDATE SET name=excluded.name, description=excluded.description,
	          target_service=excluded.target_service, target_method=excluded.target_method,
	          type=excluded.type, config=excluded.config, enabled=excluded.enabled`

	_, err = r.db.ExecContext(ctx, query, scenario.ID, scenario.Name, scenario.Description,
		scenario.TargetService, scenario.TargetMethod, string(scenario.Type),
		string(configJSON), enabled, scenario.CreatedAt)
	return err
}

func (r *SQLiteRepository) GetAllChaosScenarios(ctx context.Context) ([]*types.ChaosScenario, error) {
	query := `SELECT id, name, description, target_service, target_method, type, config, enabled, created_at 
	          FROM chaos_scenarios ORDER BY created_at DESC`

	rows, err := r.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var scenarios []*types.ChaosScenario
	for rows.Next() {
		var scenario types.ChaosScenario
		var configJSON string
		var enabled int

		err := rows.Scan(&scenario.ID, &scenario.Name, &scenario.Description,
			&scenario.TargetService, &scenario.TargetMethod, &scenario.Type,
			&configJSON, &enabled, &scenario.CreatedAt)
		if err != nil {
			return nil, err
		}

		scenario.Enabled = enabled == 1
		if err := json.Unmarshal([]byte(configJSON), &scenario.Config); err != nil {
			return nil, err
		}

		scenarios = append(scenarios, &scenario)
	}

	return scenarios, nil
}

func (r *SQLiteRepository) SaveProblemReport(ctx context.Context, report *types.ProblemReport) error {
	affectedJSON, err := json.Marshal(report.AffectedServices)
	if err != nil {
		return err
	}
	evidenceJSON, err := json.Marshal(report.Evidence)
	if err != nil {
		return err
	}
	recommendationsJSON, err := json.Marshal(report.Recommendations)
	if err != nil {
		return err
	}
	timelineJSON, err := json.Marshal(report.Timeline)
	if err != nil {
		return err
	}

	query := `INSERT INTO problem_reports (id, title, summary, trace_id, problem_type, severity, 
	          affected_services, root_cause, evidence, recommendations, timeline, generated_at) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err = r.db.ExecContext(ctx, query, report.ID, report.Title, report.Summary,
		report.TraceID, report.ProblemType, report.Severity, string(affectedJSON),
		report.RootCause, string(evidenceJSON), string(recommendationsJSON),
		string(timelineJSON), report.GeneratedAt)
	return err
}

func (r *SQLiteRepository) GetProblemReports(ctx context.Context, limit int) ([]*types.ProblemReport, error) {
	query := `SELECT id, title, summary, trace_id, problem_type, severity, affected_services, 
	          root_cause, evidence, recommendations, timeline, generated_at 
	          FROM problem_reports ORDER BY generated_at DESC LIMIT ?`

	rows, err := r.db.QueryContext(ctx, query, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*types.ProblemReport
	for rows.Next() {
		var report types.ProblemReport
		var affectedJSON, evidenceJSON, recommendationsJSON, timelineJSON string

		err := rows.Scan(&report.ID, &report.Title, &report.Summary, &report.TraceID,
			&report.ProblemType, &report.Severity, &affectedJSON, &report.RootCause,
			&evidenceJSON, &recommendationsJSON, &timelineJSON, &report.GeneratedAt)
		if err != nil {
			return nil, err
		}

		if err := json.Unmarshal([]byte(affectedJSON), &report.AffectedServices); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(evidenceJSON), &report.Evidence); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(recommendationsJSON), &report.Recommendations); err != nil {
			return nil, err
		}
		if err := json.Unmarshal([]byte(timelineJSON), &report.Timeline); err != nil {
			return nil, err
		}

		reports = append(reports, &report)
	}

	return reports, nil
}

func (r *SQLiteRepository) SaveScenarioExecution(ctx context.Context, execution *types.ScenarioExecution) error {
	reportsJSON, err := json.Marshal(execution.Reports)
	if err != nil {
		return err
	}

	query := `INSERT INTO scenario_executions (id, scenario_id, start_time, end_time, 
	          status, request_count, error_count, reports) 
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?) 
	          ON CONFLICT(id) DO UPDATE SET status=excluded.status, end_time=excluded.end_time,
	          request_count=excluded.request_count, error_count=excluded.error_count,
	          reports=excluded.reports`

	var endTime interface{}
	if execution.EndTime.IsZero() {
		endTime = nil
	} else {
		endTime = execution.EndTime
	}

	_, err = r.db.ExecContext(ctx, query, execution.ID, execution.ScenarioID,
		execution.StartTime, endTime, execution.Status, execution.RequestCount,
		execution.ErrorCount, string(reportsJSON))
	return err
}
