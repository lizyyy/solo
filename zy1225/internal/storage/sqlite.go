package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"github.com/zy1225/chanalyzer/internal/models"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	store := &SQLiteStore{db: db}
	if err := store.initSchema(); err != nil {
		db.Close()
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return store, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

func (s *SQLiteStore) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS channels (
		id TEXT PRIMARY KEY,
		name TEXT,
		buffer_size INTEGER,
		is_nil BOOLEAN,
		state TEXT,
		created_at TIMESTAMP,
		closed_at TIMESTAMP,
		closed_by TEXT
	);

	CREATE TABLE IF NOT EXISTS events (
		id TEXT PRIMARY KEY,
		type TEXT,
		timestamp TIMESTAMP,
		channel_id TEXT,
		goroutine TEXT,
		value TEXT,
		metadata TEXT,
		FOREIGN KEY (channel_id) REFERENCES channels(id)
	);

	CREATE TABLE IF NOT EXISTS goroutines (
		id TEXT PRIMARY KEY,
		name TEXT,
		state TEXT,
		waiting_on TEXT,
		since TIMESTAMP,
		stack TEXT
	);

	CREATE TABLE IF NOT EXISTS channel_snapshots (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		channel_id TEXT,
		state TEXT,
		buffer_size INTEGER,
		buffer_length INTEGER,
		buffer_content TEXT,
		sendq_length INTEGER,
		sendq_content TEXT,
		recvq_length INTEGER,
		recvq_content TEXT,
		timestamp TIMESTAMP,
		FOREIGN KEY (channel_id) REFERENCES channels(id)
	);

	CREATE TABLE IF NOT EXISTS analysis_results (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		case_id TEXT,
		case_name TEXT,
		deadlock BOOLEAN,
		deadlock_type TEXT,
		description TEXT,
		risk_level TEXT,
		stats TEXT,
		created_at TIMESTAMP
	);

	CREATE TABLE IF NOT EXISTS suggestions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		analysis_result_id INTEGER,
		priority TEXT,
		category TEXT,
		description TEXT,
		code_example TEXT,
		reference TEXT,
		FOREIGN KEY (analysis_result_id) REFERENCES analysis_results(id)
	);

	CREATE INDEX IF NOT EXISTS idx_events_channel ON events(channel_id);
	CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
	CREATE INDEX IF NOT EXISTS idx_snapshots_channel ON channel_snapshots(channel_id);
	CREATE INDEX IF NOT EXISTS idx_snapshots_timestamp ON channel_snapshots(timestamp);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *SQLiteStore) SaveEvent(event *models.Event) error {
	valueJSON, err := json.Marshal(event.Value)
	if err != nil {
		return fmt.Errorf("failed to marshal value: %w", err)
	}

	metadataJSON, err := json.Marshal(event.Metadata)
	if err != nil {
		return fmt.Errorf("failed to marshal metadata: %w", err)
	}

	query := `
	INSERT INTO events (id, type, timestamp, channel_id, goroutine, value, metadata)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err = s.db.Exec(query,
		event.ID,
		event.Type,
		event.Timestamp,
		event.ChannelID,
		event.Goroutine,
		string(valueJSON),
		string(metadataJSON),
	)
	return err
}

func (s *SQLiteStore) SaveEvents(events []*models.Event) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
	INSERT INTO events (id, type, timestamp, channel_id, goroutine, value, metadata)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		tx.Rollback()
		return err
	}
	defer stmt.Close()

	for _, event := range events {
		valueJSON, _ := json.Marshal(event.Value)
		metadataJSON, _ := json.Marshal(event.Metadata)

		_, err = stmt.Exec(
			event.ID,
			event.Type,
			event.Timestamp,
			event.ChannelID,
			event.Goroutine,
			string(valueJSON),
			string(metadataJSON),
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (s *SQLiteStore) SaveChannelSnapshot(snapshot *models.ChannelSnapshot) error {
	bufferJSON, err := json.Marshal(snapshot.Buffer)
	if err != nil {
		return fmt.Errorf("failed to marshal buffer: %w", err)
	}

	sendqJSON, err := json.Marshal(snapshot.Sendq)
	if err != nil {
		return fmt.Errorf("failed to marshal sendq: %w", err)
	}

	recvqJSON, err := json.Marshal(snapshot.Recvq)
	if err != nil {
		return fmt.Errorf("failed to marshal recvq: %w", err)
	}

	query := `
	INSERT INTO channel_snapshots (
		channel_id, state, buffer_size, buffer_length, buffer_content,
		sendq_length, sendq_content, recvq_length, recvq_content, timestamp
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err = s.db.Exec(query,
		snapshot.ChannelID,
		snapshot.State,
		snapshot.BufferSize,
		snapshot.BufferLength,
		string(bufferJSON),
		snapshot.SendqLength,
		string(sendqJSON),
		snapshot.RecvqLength,
		string(recvqJSON),
		snapshot.Timestamp,
	)
	return err
}

func (s *SQLiteStore) SaveChannel(ch *models.Hchan) error {
	query := `
	INSERT INTO channels (id, name, buffer_size, is_nil, state, created_at, closed_at, closed_by)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		state = excluded.state,
		closed_at = excluded.closed_at,
		closed_by = excluded.closed_by
	`

	var isNil bool
	var closedAt sql.NullTime
	var closedBy sql.NullString

	if ch.State == models.ChannelStateNil {
		isNil = true
	}

	if !ch.ClosedAt.IsZero() {
		closedAt = sql.NullTime{Time: ch.ClosedAt, Valid: true}
	}

	if ch.ClosedBy != "" {
		closedBy = sql.NullString{String: ch.ClosedBy, Valid: true}
	}

	_, err := s.db.Exec(query,
		ch.ID,
		ch.ID,
		ch.BufferSize,
		isNil,
		ch.State.String(),
		ch.CreatedAt,
		closedAt,
		closedBy,
	)
	return err
}

func (s *SQLiteStore) SaveGoroutine(g *models.Goroutine) error {
	query := `
	INSERT INTO goroutines (id, name, state, waiting_on, since, stack)
	VALUES (?, ?, ?, ?, ?, ?)
	ON CONFLICT(id) DO UPDATE SET
		state = excluded.state,
		waiting_on = excluded.waiting_on,
		since = excluded.since
	`

	_, err := s.db.Exec(query,
		g.ID,
		g.Name,
		g.State.String(),
		g.WaitingOn,
		g.Since,
		g.Stack,
	)
	return err
}

func (s *SQLiteStore) SaveAnalysisResult(result *models.AnalysisResult) (int64, error) {
	statsJSON, err := json.Marshal(result.Stats)
	if err != nil {
		return 0, fmt.Errorf("failed to marshal stats: %w", err)
	}

	query := `
	INSERT INTO analysis_results (
		case_id, case_name, deadlock, deadlock_type, description,
		risk_level, stats, created_at
	)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`

	res, err := s.db.Exec(query,
		result.CaseID,
		result.CaseName,
		result.Deadlock,
		result.DeadlockType,
		result.Description,
		result.RiskLevel,
		string(statsJSON),
		time.Now(),
	)
	if err != nil {
		return 0, err
	}

	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	for _, suggestion := range result.Suggestions {
		if err := s.saveSuggestion(id, &suggestion); err != nil {
			return id, err
		}
	}

	return id, nil
}

func (s *SQLiteStore) saveSuggestion(resultID int64, suggestion *models.Suggestion) error {
	query := `
	INSERT INTO suggestions (analysis_result_id, priority, category, description, code_example, reference)
	VALUES (?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		resultID,
		suggestion.Priority,
		suggestion.Category,
		suggestion.Description,
		suggestion.CodeExample,
		suggestion.Reference,
	)
	return err
}

func (s *SQLiteStore) GetEvents(channelID string, limit int) ([]*models.Event, error) {
	query := `
	SELECT id, type, timestamp, channel_id, goroutine, value, metadata
	FROM events
	WHERE channel_id = ? OR ? = ''
	ORDER BY timestamp ASC
	LIMIT ?
	`

	rows, err := s.db.Query(query, channelID, channelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []*models.Event
	for rows.Next() {
		var event models.Event
		var valueStr, metadataStr string

		err := rows.Scan(
			&event.ID,
			&event.Type,
			&event.Timestamp,
			&event.ChannelID,
			&event.Goroutine,
			&valueStr,
			&metadataStr,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(valueStr), &event.Value)
		json.Unmarshal([]byte(metadataStr), &event.Metadata)

		events = append(events, &event)
	}

	return events, rows.Err()
}

func (s *SQLiteStore) GetChannelSnapshots(channelID string, limit int) ([]*models.ChannelSnapshot, error) {
	query := `
	SELECT channel_id, state, buffer_size, buffer_length, buffer_content,
	       sendq_length, sendq_content, recvq_length, recvq_content, timestamp
	FROM channel_snapshots
	WHERE channel_id = ? OR ? = ''
	ORDER BY timestamp ASC
	LIMIT ?
	`

	rows, err := s.db.Query(query, channelID, channelID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snapshots []*models.ChannelSnapshot
	for rows.Next() {
		var snapshot models.ChannelSnapshot
		var bufferStr, sendqStr, recvqStr string

		err := rows.Scan(
			&snapshot.ChannelID,
			&snapshot.State,
			&snapshot.BufferSize,
			&snapshot.BufferLength,
			&bufferStr,
			&snapshot.SendqLength,
			&sendqStr,
			&snapshot.RecvqLength,
			&recvqStr,
			&snapshot.Timestamp,
		)
		if err != nil {
			return nil, err
		}

		json.Unmarshal([]byte(bufferStr), &snapshot.Buffer)
		json.Unmarshal([]byte(sendqStr), &snapshot.Sendq)
		json.Unmarshal([]byte(recvqStr), &snapshot.Recvq)

		snapshots = append(snapshots, &snapshot)
	}

	return snapshots, rows.Err()
}

func (s *SQLiteStore) GetAllEvents() ([]*models.Event, error) {
	return s.GetEvents("", 100000)
}

func (s *SQLiteStore) ClearAll() error {
	tables := []string{"events", "channel_snapshots", "channels", "goroutines", "suggestions", "analysis_results"}
	for _, table := range tables {
		_, err := s.db.Exec(fmt.Sprintf("DELETE FROM %s", table))
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteStore) ExportToJSON(filePath string) error {
	events, err := s.GetAllEvents()
	if err != nil {
		return err
	}

	f, err := os.Create(filePath)
	if err != nil {
		return err
	}
	defer f.Close()

	encoder := json.NewEncoder(f)
	encoder.SetIndent("", "  ")

	for _, event := range events {
		if err := encoder.Encode(event); err != nil {
			return err
		}
	}

	return nil
}
