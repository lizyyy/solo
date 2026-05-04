package storage

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"localmq/internal/models"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("failed to create directory for database: %w", err)
		}
	}

	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(1)
	db.SetMaxIdleConns(1)

	store := &SQLiteStore{db: db}
	if err := store.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS queues (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT UNIQUE NOT NULL,
		description TEXT DEFAULT '',
		retry_strategy TEXT DEFAULT 'fixed',
		retry_delay_seconds INTEGER DEFAULT 10,
		max_delay_seconds INTEGER DEFAULT 300,
		visibility_timeout_seconds INTEGER DEFAULT 60,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_queues_name ON queues(name);

	CREATE TABLE IF NOT EXISTS messages (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		queue_id INTEGER NOT NULL,
		queue_name TEXT NOT NULL,
		body TEXT NOT NULL,
		priority INTEGER DEFAULT 0,
		delay_seconds INTEGER DEFAULT 0,
		max_attempts INTEGER DEFAULT 3,
		attempts INTEGER DEFAULT 0,
		idempotency_key TEXT,
		metadata TEXT DEFAULT '{}',
		status TEXT NOT NULL DEFAULT 'pending',
		reserved_by TEXT,
		reserved_at DATETIME,
		visible_at DATETIME NOT NULL,
		dead_reason TEXT,
		last_error TEXT,
		created_at DATETIME NOT NULL,
		updated_at DATETIME NOT NULL,
		FOREIGN KEY (queue_id) REFERENCES queues(id)
	);

	CREATE INDEX IF NOT EXISTS idx_messages_queue_name ON messages(queue_name);
	CREATE INDEX IF NOT EXISTS idx_messages_status ON messages(status);
	CREATE INDEX IF NOT EXISTS idx_messages_visible_at ON messages(visible_at);
	CREATE INDEX IF NOT EXISTS idx_messages_idempotency_key ON messages(idempotency_key);
	CREATE INDEX IF NOT EXISTS idx_messages_queue_status ON messages(queue_name, status);
	CREATE INDEX IF NOT EXISTS idx_messages_priority ON messages(priority DESC);
	CREATE INDEX IF NOT EXISTS idx_messages_reserved_by ON messages(reserved_by);

	CREATE TABLE IF NOT EXISTS audit_logs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		message_id INTEGER NOT NULL,
		action TEXT NOT NULL,
		old_status TEXT,
		new_status TEXT NOT NULL,
		attempt_number INTEGER DEFAULT 0,
		error_reason TEXT,
		created_at DATETIME NOT NULL
	);

	CREATE INDEX IF NOT EXISTS idx_audit_logs_message_id ON audit_logs(message_id);
	CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
	`

	_, err := s.db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to initialize schema: %w", err)
	}

	return nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) CreateQueue(q *models.Queue) error {
	now := time.Now()
	q.CreatedAt = now
	q.UpdatedAt = now

	result, err := s.db.Exec(`
		INSERT INTO queues (name, description, retry_strategy, retry_delay_seconds, max_delay_seconds, visibility_timeout_seconds, created_at, updated_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, q.Name, q.Description, q.RetryStrategy, q.RetryDelaySeconds, q.MaxDelaySeconds, q.VisibilityTimeoutSeconds, q.CreatedAt, q.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to create queue: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	q.ID = id
	return nil
}

func (s *SQLiteStore) GetQueueByName(name string) (*models.Queue, error) {
	var q models.Queue
	err := s.db.QueryRow(`
		SELECT id, name, description, retry_strategy, retry_delay_seconds, max_delay_seconds, visibility_timeout_seconds, created_at, updated_at
		FROM queues WHERE name = ?
	`, name).Scan(&q.ID, &q.Name, &q.Description, &q.RetryStrategy, &q.RetryDelaySeconds, &q.MaxDelaySeconds, &q.VisibilityTimeoutSeconds, &q.CreatedAt, &q.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get queue: %w", err)
	}
	return &q, nil
}

func (s *SQLiteStore) GetOrCreateQueue(name string) (*models.Queue, error) {
	q, err := s.GetQueueByName(name)
	if err != nil {
		return nil, err
	}
	if q != nil {
		return q, nil
	}

	q = &models.Queue{
		Name:                    name,
		RetryStrategy:           "fixed",
		RetryDelaySeconds:       10,
		MaxDelaySeconds:         300,
		VisibilityTimeoutSeconds: 60,
	}

	if err := s.CreateQueue(q); err != nil {
		return nil, err
	}
	return q, nil
}

func (s *SQLiteStore) ListQueues() ([]*models.Queue, error) {
	rows, err := s.db.Query(`
		SELECT id, name, description, retry_strategy, retry_delay_seconds, max_delay_seconds, visibility_timeout_seconds, created_at, updated_at
		FROM queues ORDER BY name
	`)
	if err != nil {
		return nil, fmt.Errorf("failed to list queues: %w", err)
	}
	defer rows.Close()

	var queues []*models.Queue
	for rows.Next() {
		var q models.Queue
		if err := rows.Scan(&q.ID, &q.Name, &q.Description, &q.RetryStrategy, &q.RetryDelaySeconds, &q.MaxDelaySeconds, &q.VisibilityTimeoutSeconds, &q.CreatedAt, &q.UpdatedAt); err != nil {
			return nil, err
		}
		queues = append(queues, &q)
	}
	return queues, nil
}

func (s *SQLiteStore) EnqueueMessage(msg *models.Message) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	if msg.IdempotencyKey.String != "" {
		var exists bool
		err = tx.QueryRow(`
			SELECT EXISTS(SELECT 1 FROM messages WHERE queue_name = ? AND idempotency_key = ?)
		`, msg.QueueName, msg.IdempotencyKey.String).Scan(&exists)
		if err != nil {
			return fmt.Errorf("failed to check idempotency key: %w", err)
		}
		if exists {
			return fmt.Errorf("idempotency key already exists")
		}
	}

	now := time.Now()
	msg.CreatedAt = now
	msg.UpdatedAt = now
	if msg.Status == "" {
		msg.Status = models.StatusReady
	}
	if msg.Priority == 0 {
		msg.Priority = 0
	}
	if msg.MaxAttempts == 0 {
		msg.MaxAttempts = 3
	}
	if msg.DelaySeconds > 0 {
		msg.VisibleAt = now.Add(time.Duration(msg.DelaySeconds) * time.Second)
		msg.Status = models.StatusPending
	} else {
		msg.VisibleAt = now
	}

	result, err := tx.Exec(`
			INSERT INTO messages (queue_id, queue_name, body, priority, delay_seconds, max_attempts, attempts, idempotency_key, metadata, status, visible_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, msg.QueueID, msg.QueueName, msg.Body, msg.Priority, msg.DelaySeconds, msg.MaxAttempts, msg.Attempts,
		sql.NullString{String: msg.IdempotencyKey.String, Valid: msg.IdempotencyKey.Valid},
		string(msg.Metadata), msg.Status, msg.VisibleAt, msg.CreatedAt, msg.UpdatedAt)
	if err != nil {
		return fmt.Errorf("failed to insert message: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return fmt.Errorf("failed to get last insert id: %w", err)
	}
	msg.ID = id

	_, err = tx.Exec(`
		INSERT INTO audit_logs (message_id, action, old_status, new_status, attempt_number, created_at)
		VALUES (?, ?, NULL, ?, ?, ?)
	`, id, "enqueue", msg.Status, 0, now)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SQLiteStore) GetMessageByID(id int64) (*models.Message, error) {
	var msg models.Message
	var idempotencyKey sql.NullString
	var reservedBy sql.NullString
	var reservedAt sql.NullTime
	var deadReason sql.NullString
	var lastError sql.NullString
	var metadataStr string

	err := s.db.QueryRow(`
		SELECT id, queue_id, queue_name, body, priority, delay_seconds, max_attempts, attempts, idempotency_key, metadata, status, reserved_by, reserved_at, visible_at, dead_reason, last_error, created_at, updated_at
		FROM messages WHERE id = ?
	`, id).Scan(&msg.ID, &msg.QueueID, &msg.QueueName, &msg.Body, &msg.Priority, &msg.DelaySeconds, &msg.MaxAttempts, &msg.Attempts, &idempotencyKey, &metadataStr, &msg.Status, &reservedBy, &reservedAt, &msg.VisibleAt, &deadReason, &lastError, &msg.CreatedAt, &msg.UpdatedAt)

	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get message: %w", err)
	}

	msg.IdempotencyKey = idempotencyKey
	msg.ReservedBy = reservedBy
	msg.ReservedAt = reservedAt
	msg.DeadReason = deadReason
	msg.LastError = lastError
	msg.Metadata = []byte(metadataStr)

	return &msg, nil
}

func (s *SQLiteStore) ReserveMessages(queueName string, workerID string, limit int, visibilityTimeoutSeconds int) ([]*models.Message, error) {
	if limit <= 0 {
		limit = 1
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()
	rows, err := tx.Query(`
		SELECT id, queue_id, queue_name, body, priority, delay_seconds, max_attempts, attempts, idempotency_key, metadata, status, visible_at, created_at, updated_at
		FROM messages
		WHERE queue_name = ? 
		  AND status IN ('ready', 'pending')
		  AND visible_at <= ?
		ORDER BY priority DESC, created_at ASC
		LIMIT ?
	`, queueName, now, limit)

	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		var msg models.Message
		var idempotencyKey sql.NullString
		var metadataStr string
		if err := rows.Scan(&msg.ID, &msg.QueueID, &msg.QueueName, &msg.Body, &msg.Priority, &msg.DelaySeconds, &msg.MaxAttempts, &msg.Attempts, &idempotencyKey, &metadataStr, &msg.Status, &msg.VisibleAt, &msg.CreatedAt, &msg.UpdatedAt); err != nil {
			return nil, err
		}
		msg.IdempotencyKey = idempotencyKey
		msg.Metadata = []byte(metadataStr)
		messages = append(messages, &msg)
	}

	if len(messages) == 0 {
		tx.Rollback()
		return []*models.Message{}, nil
	}

	var reservedMessages []*models.Message
	for _, msg := range messages {
		now := time.Now()
		result, err := tx.Exec(`
			UPDATE messages
			SET status = ?, reserved_by = ?, reserved_at = ?, visible_at = ?, updated_at = ?
			WHERE id = ? AND status IN ('ready', 'pending')
		`, models.StatusReserved, workerID, now, now.Add(time.Duration(visibilityTimeoutSeconds)*time.Second), now, msg.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to reserve message: %w", err)
		}

		rowsAffected, err := result.RowsAffected()
		if err != nil {
			return nil, fmt.Errorf("failed to get rows affected: %w", err)
		}
		if rowsAffected == 0 {
			continue
		}

		msg.Status = models.StatusReserved
		msg.ReservedBy = sql.NullString{String: workerID, Valid: true}
		msg.ReservedAt = sql.NullTime{Time: now, Valid: true}
		msg.VisibleAt = now.Add(time.Duration(visibilityTimeoutSeconds) * time.Second)
		msg.UpdatedAt = now

		_, err = tx.Exec(`
			INSERT INTO audit_logs (message_id, action, old_status, new_status, attempt_number, created_at)
			VALUES (?, ?, ?, ?, ?, ?)
		`, msg.ID, "reserve", "ready", models.StatusReserved, msg.Attempts, now)
		if err != nil {
			return nil, fmt.Errorf("failed to insert audit log: %w", err)
		}

		reservedMessages = append(reservedMessages, msg)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return reservedMessages, nil
}

func (s *SQLiteStore) AckMessage(msgID int64, workerID string) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var msg models.Message
	var reservedBy sql.NullString
	err = tx.QueryRow(`SELECT status, reserved_by FROM messages WHERE id = ?`, msgID).Scan(&msg.Status, &reservedBy)
	if err == sql.ErrNoRows {
		return fmt.Errorf("message not found")
	}
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	if msg.Status != models.StatusReserved {
		return fmt.Errorf("message is not reserved")
	}

	if reservedBy.String != workerID {
		return fmt.Errorf("message not reserved by this worker")
	}

	now := time.Now()
	_, err = tx.Exec(`
		UPDATE messages
		SET status = ?, updated_at = ?
		WHERE id = ?
	`, models.StatusSucceeded, now, msgID)
	if err != nil {
		return fmt.Errorf("failed to ack message: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO audit_logs (message_id, action, old_status, new_status, attempt_number, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, msgID, "ack", msg.Status, models.StatusSucceeded, 0, now)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SQLiteStore) NackMessage(msgID int64, workerID string, errorReason *string, queue *models.Queue) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var msg models.Message
	var reservedBy sql.NullString
	err = tx.QueryRow(`SELECT id, status, reserved_by, attempts, max_attempts FROM messages WHERE id = ?`, msgID).Scan(&msg.ID, &msg.Status, &reservedBy, &msg.Attempts, &msg.MaxAttempts)
	if err == sql.ErrNoRows {
		return fmt.Errorf("message not found")
	}
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	if msg.Status != models.StatusReserved {
		return fmt.Errorf("message is not reserved")
	}

	if reservedBy.String != workerID {
		return fmt.Errorf("message not reserved by this worker")
	}

	newAttempts := msg.Attempts + 1
	now := time.Now()

	var newStatus models.MessageStatus
	var visibleAt time.Time
	var deadReason *string

	if newAttempts >= msg.MaxAttempts {
		newStatus = models.StatusDead
		visibleAt = now
		reason := "max_attempts_exceeded"
		deadReason = &reason
	} else {
		newStatus = models.StatusReady
		delay := s.calculateDelay(queue, newAttempts)
		visibleAt = now.Add(time.Duration(delay) * time.Second)
	}

	var errorReasonStr string
	if errorReason != nil {
		errorReasonStr = *errorReason
	}

	_, err = tx.Exec(`
		UPDATE messages
		SET status = ?, attempts = ?, visible_at = ?, dead_reason = ?, last_error = ?, updated_at = ?
		WHERE id = ?
	`, newStatus, newAttempts, visibleAt, deadReason, errorReasonStr, now, msgID)
	if err != nil {
		return fmt.Errorf("failed to nack message: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO audit_logs (message_id, action, old_status, new_status, attempt_number, error_reason, created_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, msgID, "nack", msg.Status, newStatus, newAttempts, errorReasonStr, now)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SQLiteStore) calculateDelay(queue *models.Queue, attempt int) int {
	if queue.RetryStrategy == "exponential" {
		baseDelay := queue.RetryDelaySeconds
		delay := baseDelay * (1 << (attempt - 1))
		if delay > queue.MaxDelaySeconds {
			return queue.MaxDelaySeconds
		}
		return delay
	}
	return queue.RetryDelaySeconds
}

func (s *SQLiteStore) ExtendLease(msgID int64, workerID string, seconds int) error {
	tx, err := s.db.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	var msg models.Message
	var reservedBy sql.NullString
	var visibleAt time.Time
	err = tx.QueryRow(`SELECT status, reserved_by, visible_at FROM messages WHERE id = ?`, msgID).Scan(&msg.Status, &reservedBy, &visibleAt)
	if err == sql.ErrNoRows {
		return fmt.Errorf("message not found")
	}
	if err != nil {
		return fmt.Errorf("failed to get message: %w", err)
	}

	if msg.Status != models.StatusReserved {
		return fmt.Errorf("message is not reserved")
	}

	if reservedBy.String != workerID {
		return fmt.Errorf("message not reserved by this worker")
	}

	now := time.Now()
	newVisibleAt := visibleAt.Add(time.Duration(seconds) * time.Second)

	_, err = tx.Exec(`
		UPDATE messages
		SET visible_at = ?, updated_at = ?
		WHERE id = ?
	`, newVisibleAt, now, msgID)
	if err != nil {
		return fmt.Errorf("failed to extend lease: %w", err)
	}

	_, err = tx.Exec(`
		INSERT INTO audit_logs (message_id, action, old_status, new_status, attempt_number, created_at)
		VALUES (?, ?, ?, ?, ?, ?)
	`, msgID, "extend_lease", msg.Status, msg.Status, 0, now)
	if err != nil {
		return fmt.Errorf("failed to insert audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

func (s *SQLiteStore) ReplayDeadLetter(queueName string, deadReasons []string, messageIDs []int64, newDelaySeconds *int) (int64, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("failed to begin transaction: %w", err)
	}
	defer tx.Rollback()

	now := time.Now()
	var visibleAt time.Time
	if newDelaySeconds != nil && *newDelaySeconds > 0 {
		visibleAt = now.Add(time.Duration(*newDelaySeconds) * time.Second)
	} else {
		visibleAt = now
	}

	query := `
		UPDATE messages
		SET status = ?, attempts = 0, visible_at = ?, dead_reason = NULL, last_error = NULL, updated_at = ?
		WHERE queue_name = ? AND status = ?
	`
	args := []interface{}{models.StatusReady, visibleAt, now, queueName, models.StatusDead}

	if len(deadReasons) > 0 {
		query += ` AND dead_reason IN (`
		for i := range deadReasons {
			if i > 0 {
				query += ", "
			}
			query += "?"
			args = append(args, deadReasons[i])
		}
		query += ")"
	}

	if len(messageIDs) > 0 {
		query += ` AND id IN (`
		for i := range messageIDs {
			if i > 0 {
				query += ", "
			}
			query += "?"
			args = append(args, messageIDs[i])
		}
		query += ")"
	}

	result, err := tx.Exec(query, args...)
	if err != nil {
		return 0, fmt.Errorf("failed to replay dead letters: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return 0, fmt.Errorf("failed to get rows affected: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return rowsAffected, nil
}

func (s *SQLiteStore) GetQueueStats(queueName string) (*models.QueueStats, error) {
	var stats models.QueueStats
	stats.QueueName = queueName

	err := s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ?`, queueName).Scan(&stats.Total)
	if err != nil {
		return nil, fmt.Errorf("failed to get total count: %w", err)
	}

	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusPending).Scan(&stats.Pending)
	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusReady).Scan(&stats.Ready)
	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusReserved).Scan(&stats.Reserved)
	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusSucceeded).Scan(&stats.Succeeded)
	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusFailed).Scan(&stats.Failed)
	s.db.QueryRow(`SELECT COUNT(*) FROM messages WHERE queue_name = ? AND status = ?`, queueName, models.StatusDead).Scan(&stats.Dead)

	return &stats, nil
}

func (s *SQLiteStore) PeekMessages(queueName string, status models.MessageStatus, limit int) ([]*models.Message, error) {
	query := `
		SELECT id, queue_id, queue_name, body, priority, delay_seconds, max_attempts, attempts, idempotency_key, metadata, status, reserved_by, reserved_at, visible_at, dead_reason, last_error, created_at, updated_at
		FROM messages
		WHERE queue_name = ?
	`
	args := []interface{}{queueName}

	if status != "" {
		query += ` AND status = ?`
		args = append(args, status)
	}

	query += ` ORDER BY priority DESC, created_at ASC`
	if limit > 0 {
		query += ` LIMIT ?`
		args = append(args, limit)
	}

	rows, err := s.db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query messages: %w", err)
	}
	defer rows.Close()

	var messages []*models.Message
	for rows.Next() {
		var msg models.Message
		var idempotencyKey sql.NullString
		var reservedBy sql.NullString
		var reservedAt sql.NullTime
		var deadReason sql.NullString
		var lastError sql.NullString
		var metadataStr string

		if err := rows.Scan(&msg.ID, &msg.QueueID, &msg.QueueName, &msg.Body, &msg.Priority, &msg.DelaySeconds, &msg.MaxAttempts, &msg.Attempts, &idempotencyKey, &metadataStr, &msg.Status, &reservedBy, &reservedAt, &msg.VisibleAt, &deadReason, &lastError, &msg.CreatedAt, &msg.UpdatedAt); err != nil {
			return nil, err
		}

		msg.IdempotencyKey = idempotencyKey
		msg.ReservedBy = reservedBy
		msg.ReservedAt = reservedAt
		msg.DeadReason = deadReason
		msg.LastError = lastError
		msg.Metadata = []byte(metadataStr)
		messages = append(messages, &msg)
	}

	return messages, nil
}

func (s *SQLiteStore) GetAuditLogs(msgID int64) ([]*models.AuditLog, error) {
	rows, err := s.db.Query(`
		SELECT id, message_id, action, old_status, new_status, attempt_number, error_reason, created_at
		FROM audit_logs
		WHERE message_id = ?
		ORDER BY created_at ASC
	`, msgID)
	if err != nil {
		return nil, fmt.Errorf("failed to query audit logs: %w", err)
	}
	defer rows.Close()

	var logs []*models.AuditLog
	for rows.Next() {
		var log models.AuditLog
		var oldStatus sql.NullString
		var errorReason sql.NullString

		if err := rows.Scan(&log.ID, &log.MessageID, &log.Action, &oldStatus, &log.NewStatus, &log.AttemptNumber, &errorReason, &log.CreatedAt); err != nil {
			return nil, err
		}

		log.OldStatus = oldStatus
		log.ErrorReason = errorReason
		logs = append(logs, &log)
	}

	return logs, nil
}

func (s *SQLiteStore) UpdateExpiredMessages() error {
	now := time.Now()
	result, err := s.db.Exec(`
		UPDATE messages
		SET status = ?, reserved_by = NULL, reserved_at = NULL
		WHERE status = ? AND visible_at <= ?
	`, models.StatusReady, models.StatusReserved, now)
	if err != nil {
		return fmt.Errorf("failed to update expired messages: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected > 0 {
		log.Printf("Re-queued %d expired messages", rowsAffected)
	}

	return nil
}

func (s *SQLiteStore) UpdatePendingMessages() error {
	now := time.Now()
	result, err := s.db.Exec(`
		UPDATE messages
		SET status = ?
		WHERE status = ? AND visible_at <= ?
	`, models.StatusReady, models.StatusPending, now)
	if err != nil {
		return fmt.Errorf("failed to update pending messages: %w", err)
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to get rows affected: %w", err)
	}

	if rowsAffected > 0 {
		log.Printf("Moved %d pending messages to ready", rowsAffected)
	}

	return nil
}
