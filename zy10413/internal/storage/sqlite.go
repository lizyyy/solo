package storage

import (
	"database/sql"
	"fmt"
	"push-token-lifecycle/internal/model"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type SQLiteStorage struct {
	db *sql.DB
}

func NewSQLiteStorage(dbPath string) (*SQLiteStorage, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	storage := &SQLiteStorage{db: db}
	if err := storage.initTables(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to init tables: %w", err)
	}

	return storage, nil
}

func (s *SQLiteStorage) initTables() error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS devices (
			id TEXT PRIMARY KEY,
			user_id TEXT NOT NULL,
			device_id TEXT NOT NULL UNIQUE,
			platform TEXT NOT NULL,
			device_name TEXT,
			app_version TEXT,
			os_version TEXT,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS push_tokens (
			id TEXT PRIMARY KEY,
			token TEXT NOT NULL UNIQUE,
			user_id TEXT NOT NULL,
			device_id TEXT NOT NULL,
			platform TEXT NOT NULL,
			status TEXT NOT NULL,
			bind_count INTEGER NOT NULL DEFAULT 1,
			last_bind_at DATETIME NOT NULL,
			last_push_at DATETIME,
			expire_at DATETIME,
			created_at DATETIME NOT NULL,
			updated_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS bind_events (
			id TEXT PRIMARY KEY,
			token_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			device_id TEXT NOT NULL,
			previous_user_id TEXT,
			previous_device_id TEXT,
			bind_type TEXT NOT NULL,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS unsubscribe_events (
			id TEXT PRIMARY KEY,
			token_id TEXT NOT NULL,
			user_id TEXT NOT NULL,
			device_id TEXT NOT NULL,
			reason TEXT,
			channel TEXT,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS push_receipts (
			id TEXT PRIMARY KEY,
			token_id TEXT NOT NULL,
			push_id TEXT NOT NULL,
			success BOOLEAN NOT NULL,
			failure_reason TEXT,
			error_message TEXT,
			raw_response TEXT,
			sent_at DATETIME NOT NULL,
			received_at DATETIME,
			created_at DATETIME NOT NULL
		)`,
		`CREATE TABLE IF NOT EXISTS lifecycle_reports (
			token_id TEXT PRIMARY KEY,
			token TEXT NOT NULL,
			user_id TEXT NOT NULL,
			device_id TEXT NOT NULL,
			status TEXT NOT NULL,
			total_binds INTEGER NOT NULL,
			total_pushes INTEGER NOT NULL,
			success_pushes INTEGER NOT NULL,
			failed_pushes INTEGER NOT NULL,
			last_failure_at DATETIME,
			last_failure_reason TEXT,
			is_unsubscribed BOOLEAN NOT NULL,
			is_rebound BOOLEAN NOT NULL,
			generated_at DATETIME NOT NULL
		)`,
		`CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id)`,
		`CREATE INDEX IF NOT EXISTS idx_push_tokens_status ON push_tokens(status)`,
		`CREATE INDEX IF NOT EXISTS idx_bind_events_token_id ON bind_events(token_id)`,
		`CREATE INDEX IF NOT EXISTS idx_unsubscribe_events_token_id ON unsubscribe_events(token_id)`,
		`CREATE INDEX IF NOT EXISTS idx_push_receipts_token_id ON push_receipts(token_id)`,
		`CREATE INDEX IF NOT EXISTS idx_push_receipts_push_id ON push_receipts(push_id)`,
	}

	for _, stmt := range statements {
		if _, err := s.db.Exec(stmt); err != nil {
			return fmt.Errorf("failed to execute statement: %w", err)
		}
	}
	return nil
}

func (s *SQLiteStorage) Close() error {
	return s.db.Close()
}

func (s *SQLiteStorage) CreateDevice(device *model.Device) error {
	query := `INSERT INTO devices (id, user_id, device_id, platform, device_name, app_version, os_version, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, device.ID, device.UserID, device.DeviceID, device.Platform, device.DeviceName, device.AppVersion, device.OSVersion, device.CreatedAt, device.UpdatedAt)
	return err
}

func (s *SQLiteStorage) GetDevice(id string) (*model.Device, error) {
	query := `SELECT id, user_id, device_id, platform, device_name, app_version, os_version, created_at, updated_at FROM devices WHERE id = ?`
	device := &model.Device{}
	err := s.db.QueryRow(query, id).Scan(&device.ID, &device.UserID, &device.DeviceID, &device.Platform, &device.DeviceName, &device.AppVersion, &device.OSVersion, &device.CreatedAt, &device.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return device, err
}

func (s *SQLiteStorage) GetDeviceByDeviceID(deviceID string) (*model.Device, error) {
	query := `SELECT id, user_id, device_id, platform, device_name, app_version, os_version, created_at, updated_at FROM devices WHERE device_id = ?`
	device := &model.Device{}
	err := s.db.QueryRow(query, deviceID).Scan(&device.ID, &device.UserID, &device.DeviceID, &device.Platform, &device.DeviceName, &device.AppVersion, &device.OSVersion, &device.CreatedAt, &device.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return device, err
}

func (s *SQLiteStorage) UpdateDevice(device *model.Device) error {
	query := `UPDATE devices SET user_id = ?, device_id = ?, platform = ?, device_name = ?, app_version = ?, os_version = ?, updated_at = ? WHERE id = ?`
	_, err := s.db.Exec(query, device.UserID, device.DeviceID, device.Platform, device.DeviceName, device.AppVersion, device.OSVersion, device.UpdatedAt, device.ID)
	return err
}

func (s *SQLiteStorage) ListDevicesByUser(userID string) ([]*model.Device, error) {
	query := `SELECT id, user_id, device_id, platform, device_name, app_version, os_version, created_at, updated_at FROM devices WHERE user_id = ?`
	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var devices []*model.Device
	for rows.Next() {
		device := &model.Device{}
		err := rows.Scan(&device.ID, &device.UserID, &device.DeviceID, &device.Platform, &device.DeviceName, &device.AppVersion, &device.OSVersion, &device.CreatedAt, &device.UpdatedAt)
		if err != nil {
			return nil, err
		}
		devices = append(devices, device)
	}
	return devices, nil
}

func (s *SQLiteStorage) CreateToken(token *model.PushToken) error {
	query := `INSERT INTO push_tokens (id, token, user_id, device_id, platform, status, bind_count, last_bind_at, last_push_at, expire_at, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, token.ID, token.Token, token.UserID, token.DeviceID, token.Platform, token.Status, token.BindCount, token.LastBindAt, token.LastPushAt, token.ExpireAt, token.CreatedAt, token.UpdatedAt)
	return err
}

func (s *SQLiteStorage) GetToken(id string) (*model.PushToken, error) {
	query := `SELECT id, token, user_id, device_id, platform, status, bind_count, last_bind_at, last_push_at, expire_at, created_at, updated_at FROM push_tokens WHERE id = ?`
	token := &model.PushToken{}
	err := s.db.QueryRow(query, id).Scan(&token.ID, &token.Token, &token.UserID, &token.DeviceID, &token.Platform, &token.Status, &token.BindCount, &token.LastBindAt, &token.LastPushAt, &token.ExpireAt, &token.CreatedAt, &token.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return token, err
}

func (s *SQLiteStorage) GetTokenByToken(tokenStr string) (*model.PushToken, error) {
	query := `SELECT id, token, user_id, device_id, platform, status, bind_count, last_bind_at, last_push_at, expire_at, created_at, updated_at FROM push_tokens WHERE token = ?`
	token := &model.PushToken{}
	err := s.db.QueryRow(query, tokenStr).Scan(&token.ID, &token.Token, &token.UserID, &token.DeviceID, &token.Platform, &token.Status, &token.BindCount, &token.LastBindAt, &token.LastPushAt, &token.ExpireAt, &token.CreatedAt, &token.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return token, err
}

func (s *SQLiteStorage) UpdateToken(token *model.PushToken) error {
	query := `UPDATE push_tokens SET user_id = ?, device_id = ?, platform = ?, status = ?, bind_count = ?, last_bind_at = ?, last_push_at = ?, expire_at = ?, updated_at = ? WHERE id = ?`
	_, err := s.db.Exec(query, token.UserID, token.DeviceID, token.Platform, token.Status, token.BindCount, token.LastBindAt, token.LastPushAt, token.ExpireAt, token.UpdatedAt, token.ID)
	return err
}

func (s *SQLiteStorage) ListTokensByUser(userID string) ([]*model.PushToken, error) {
	query := `SELECT id, token, user_id, device_id, platform, status, bind_count, last_bind_at, last_push_at, expire_at, created_at, updated_at FROM push_tokens WHERE user_id = ?`
	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*model.PushToken
	for rows.Next() {
		token := &model.PushToken{}
		err := rows.Scan(&token.ID, &token.Token, &token.UserID, &token.DeviceID, &token.Platform, &token.Status, &token.BindCount, &token.LastBindAt, &token.LastPushAt, &token.ExpireAt, &token.CreatedAt, &token.UpdatedAt)
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	return tokens, nil
}

func (s *SQLiteStorage) ListTokensByStatus(status model.TokenStatus) ([]*model.PushToken, error) {
	query := `SELECT id, token, user_id, device_id, platform, status, bind_count, last_bind_at, last_push_at, expire_at, created_at, updated_at FROM push_tokens WHERE status = ?`
	rows, err := s.db.Query(query, status)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var tokens []*model.PushToken
	for rows.Next() {
		token := &model.PushToken{}
		err := rows.Scan(&token.ID, &token.Token, &token.UserID, &token.DeviceID, &token.Platform, &token.Status, &token.BindCount, &token.LastBindAt, &token.LastPushAt, &token.ExpireAt, &token.CreatedAt, &token.UpdatedAt)
		if err != nil {
			return nil, err
		}
		tokens = append(tokens, token)
	}
	return tokens, nil
}

func (s *SQLiteStorage) CreateBindEvent(event *model.BindEvent) error {
	query := `INSERT INTO bind_events (id, token_id, user_id, device_id, previous_user_id, previous_device_id, bind_type, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, event.ID, event.TokenID, event.UserID, event.DeviceID, event.PreviousUserID, event.PreviousDeviceID, event.BindType, event.CreatedAt)
	return err
}

func (s *SQLiteStorage) GetBindEvent(id string) (*model.BindEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, previous_user_id, previous_device_id, bind_type, created_at FROM bind_events WHERE id = ?`
	event := &model.BindEvent{}
	err := s.db.QueryRow(query, id).Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.PreviousUserID, &event.PreviousDeviceID, &event.BindType, &event.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return event, err
}

func (s *SQLiteStorage) ListBindEventsByToken(tokenID string) ([]*model.BindEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, previous_user_id, previous_device_id, bind_type, created_at FROM bind_events WHERE token_id = ?`
	rows, err := s.db.Query(query, tokenID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*model.BindEvent
	for rows.Next() {
		event := &model.BindEvent{}
		err := rows.Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.PreviousUserID, &event.PreviousDeviceID, &event.BindType, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (s *SQLiteStorage) ListBindEventsByUser(userID string) ([]*model.BindEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, previous_user_id, previous_device_id, bind_type, created_at FROM bind_events WHERE user_id = ?`
	rows, err := s.db.Query(query, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*model.BindEvent
	for rows.Next() {
		event := &model.BindEvent{}
		err := rows.Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.PreviousUserID, &event.PreviousDeviceID, &event.BindType, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (s *SQLiteStorage) CreateUnsubscribeEvent(event *model.UnsubscribeEvent) error {
	query := `INSERT INTO unsubscribe_events (id, token_id, user_id, device_id, reason, channel, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, event.ID, event.TokenID, event.UserID, event.DeviceID, event.Reason, event.Channel, event.CreatedAt)
	return err
}

func (s *SQLiteStorage) GetUnsubscribeEvent(id string) (*model.UnsubscribeEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, reason, channel, created_at FROM unsubscribe_events WHERE id = ?`
	event := &model.UnsubscribeEvent{}
	err := s.db.QueryRow(query, id).Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.Reason, &event.Channel, &event.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return event, err
}

func (s *SQLiteStorage) GetLatestUnsubscribeByToken(tokenID string) (*model.UnsubscribeEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, reason, channel, created_at FROM unsubscribe_events WHERE token_id = ? ORDER BY created_at DESC LIMIT 1`
	event := &model.UnsubscribeEvent{}
	err := s.db.QueryRow(query, tokenID).Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.Reason, &event.Channel, &event.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return event, err
}

func (s *SQLiteStorage) ListUnsubscribeEventsByToken(tokenID string) ([]*model.UnsubscribeEvent, error) {
	query := `SELECT id, token_id, user_id, device_id, reason, channel, created_at FROM unsubscribe_events WHERE token_id = ? ORDER BY created_at DESC`
	rows, err := s.db.Query(query, tokenID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*model.UnsubscribeEvent
	for rows.Next() {
		event := &model.UnsubscribeEvent{}
		err := rows.Scan(&event.ID, &event.TokenID, &event.UserID, &event.DeviceID, &event.Reason, &event.Channel, &event.CreatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, event)
	}
	return events, nil
}

func (s *SQLiteStorage) CreatePushReceipt(receipt *model.PushReceipt) error {
	query := `INSERT INTO push_receipts (id, token_id, push_id, success, failure_reason, error_message, raw_response, sent_at, received_at, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, receipt.ID, receipt.TokenID, receipt.PushID, receipt.Success, receipt.FailureReason, receipt.ErrorMessage, receipt.RawResponse, receipt.SentAt, receipt.ReceivedAt, receipt.CreatedAt)
	return err
}

func (s *SQLiteStorage) GetPushReceipt(id string) (*model.PushReceipt, error) {
	query := `SELECT id, token_id, push_id, success, failure_reason, error_message, raw_response, sent_at, received_at, created_at FROM push_receipts WHERE id = ?`
	receipt := &model.PushReceipt{}
	err := s.db.QueryRow(query, id).Scan(&receipt.ID, &receipt.TokenID, &receipt.PushID, &receipt.Success, &receipt.FailureReason, &receipt.ErrorMessage, &receipt.RawResponse, &receipt.SentAt, &receipt.ReceivedAt, &receipt.CreatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return receipt, err
}

func (s *SQLiteStorage) ListReceiptsByToken(tokenID string) ([]*model.PushReceipt, error) {
	query := `SELECT id, token_id, push_id, success, failure_reason, error_message, raw_response, sent_at, received_at, created_at FROM push_receipts WHERE token_id = ? ORDER BY created_at DESC`
	rows, err := s.db.Query(query, tokenID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []*model.PushReceipt
	for rows.Next() {
		receipt := &model.PushReceipt{}
		err := rows.Scan(&receipt.ID, &receipt.TokenID, &receipt.PushID, &receipt.Success, &receipt.FailureReason, &receipt.ErrorMessage, &receipt.RawResponse, &receipt.SentAt, &receipt.ReceivedAt, &receipt.CreatedAt)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}
	return receipts, nil
}

func (s *SQLiteStorage) ListReceiptsByPushID(pushID string) ([]*model.PushReceipt, error) {
	query := `SELECT id, token_id, push_id, success, failure_reason, error_message, raw_response, sent_at, received_at, created_at FROM push_receipts WHERE push_id = ? ORDER BY created_at DESC`
	rows, err := s.db.Query(query, pushID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var receipts []*model.PushReceipt
	for rows.Next() {
		receipt := &model.PushReceipt{}
		err := rows.Scan(&receipt.ID, &receipt.TokenID, &receipt.PushID, &receipt.Success, &receipt.FailureReason, &receipt.ErrorMessage, &receipt.RawResponse, &receipt.SentAt, &receipt.ReceivedAt, &receipt.CreatedAt)
		if err != nil {
			return nil, err
		}
		receipts = append(receipts, receipt)
	}
	return receipts, nil
}

func (s *SQLiteStorage) GetFailureStatsByToken(tokenID string) (total, success, failed int, lastFailureAt *time.Time, lastFailureReason model.FailureReason, err error) {
	query := `SELECT COUNT(*), SUM(CASE WHEN success THEN 1 ELSE 0 END), SUM(CASE WHEN NOT success THEN 1 ELSE 0 END) FROM push_receipts WHERE token_id = ?`
	err = s.db.QueryRow(query, tokenID).Scan(&total, &success, &failed)
	if err != nil {
		return
	}

	query2 := `SELECT sent_at, failure_reason FROM push_receipts WHERE token_id = ? AND NOT success ORDER BY sent_at DESC LIMIT 1`
	var lfAt time.Time
	var lfReason model.FailureReason
	err = s.db.QueryRow(query2, tokenID).Scan(&lfAt, &lfReason)
	if err == nil {
		lastFailureAt = &lfAt
		lastFailureReason = lfReason
	} else if err == sql.ErrNoRows {
		err = nil
	}
	return
}

func (s *SQLiteStorage) CreateReport(report *model.LifecycleReport) error {
	query := `INSERT OR REPLACE INTO lifecycle_reports (token_id, token, user_id, device_id, status, total_binds, total_pushes, success_pushes, failed_pushes, last_failure_at, last_failure_reason, is_unsubscribed, is_rebound, generated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, report.TokenID, report.Token, report.UserID, report.DeviceID, report.Status, report.TotalBinds, report.TotalPushes, report.SuccessPushes, report.FailedPushes, report.LastFailureAt, report.LastFailureReason, report.IsUnsubscribed, report.IsRebound, report.GeneratedAt)
	return err
}

func (s *SQLiteStorage) GetReport(tokenID string) (*model.LifecycleReport, error) {
	query := `SELECT token_id, token, user_id, device_id, status, total_binds, total_pushes, success_pushes, failed_pushes, last_failure_at, last_failure_reason, is_unsubscribed, is_rebound, generated_at FROM lifecycle_reports WHERE token_id = ?`
	report := &model.LifecycleReport{}
	err := s.db.QueryRow(query, tokenID).Scan(&report.TokenID, &report.Token, &report.UserID, &report.DeviceID, &report.Status, &report.TotalBinds, &report.TotalPushes, &report.SuccessPushes, &report.FailedPushes, &report.LastFailureAt, &report.LastFailureReason, &report.IsUnsubscribed, &report.IsRebound, &report.GeneratedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return report, err
}

func (s *SQLiteStorage) ListReports(startTime, endTime time.Time) ([]*model.LifecycleReport, error) {
	query := `SELECT token_id, token, user_id, device_id, status, total_binds, total_pushes, success_pushes, failed_pushes, last_failure_at, last_failure_reason, is_unsubscribed, is_rebound, generated_at FROM lifecycle_reports WHERE generated_at BETWEEN ? AND ? ORDER BY generated_at DESC`
	rows, err := s.db.Query(query, startTime, endTime)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []*model.LifecycleReport
	for rows.Next() {
		report := &model.LifecycleReport{}
		err := rows.Scan(&report.TokenID, &report.Token, &report.UserID, &report.DeviceID, &report.Status, &report.TotalBinds, &report.TotalPushes, &report.SuccessPushes, &report.FailedPushes, &report.LastFailureAt, &report.LastFailureReason, &report.IsUnsubscribed, &report.IsRebound, &report.GeneratedAt)
		if err != nil {
			return nil, err
		}
		reports = append(reports, report)
	}
	return reports, nil
}
