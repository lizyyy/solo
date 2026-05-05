package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/zy1214/pefa/pkg/evidence"
)

const schemaSQL = `
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    description TEXT,
    tags TEXT
);

CREATE TABLE IF NOT EXISTS evidence_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    evidence_type TEXT NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    sample_count INTEGER,
    metadata TEXT,
    raw_content BLOB,
    created_at TIMESTAMP NOT NULL,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS analysis_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    is_aligned BOOLEAN,
    common_start_time TIMESTAMP,
    common_end_time TIMESTAMP,
    total_duration INTEGER,
    bottlenecks TEXT,
    recommendations TEXT,
    summary TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS timeline_gaps (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_result_id INTEGER NOT NULL,
    evidence_type TEXT NOT NULL,
    start_time TIMESTAMP,
    end_time TIMESTAMP,
    duration INTEGER,
    reason TEXT,
    severity TEXT,
    FOREIGN KEY (analysis_result_id) REFERENCES analysis_results(id)
);

CREATE TABLE IF NOT EXISTS audit_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    timestamp TIMESTAMP NOT NULL,
    evidence_types TEXT,
    missing_types TEXT,
    quality_score REAL,
    issues TEXT,
    recommendations TEXT,
    FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_created ON sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_evidence_session ON evidence_records(session_id);
CREATE INDEX IF NOT EXISTS idx_evidence_type ON evidence_records(evidence_type);
CREATE INDEX IF NOT EXISTS idx_analysis_session ON analysis_results(session_id);
`

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	if dbPath == "" {
		dbPath = filepath.Join(os.Getenv("HOME"), ".pefa", "pefa.db")
	}

	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, fmt.Errorf("failed to create database directory: %w", err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if _, err := db.Exec(schemaSQL); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return &SQLiteStore{db: db}, nil
}

func (s *SQLiteStore) Close() error {
	return s.db.Close()
}

type Session struct {
	ID          string
	CreatedAt   time.Time
	UpdatedAt   time.Time
	Description string
	Tags        []string
}

func (s *SQLiteStore) CreateSession(session *Session) error {
	tagsJSON, _ := json.Marshal(session.Tags)
	_, err := s.db.Exec(
		`INSERT INTO sessions (id, created_at, updated_at, description, tags)
		 VALUES (?, ?, ?, ?, ?)`,
		session.ID, session.CreatedAt, session.UpdatedAt,
		session.Description, string(tagsJSON),
	)
	return err
}

func (s *SQLiteStore) GetSession(id string) (*Session, error) {
	var session Session
	var tagsStr string

	err := s.db.QueryRow(
		`SELECT id, created_at, updated_at, description, tags
		 FROM sessions WHERE id = ?`,
		id,
	).Scan(&session.ID, &session.CreatedAt, &session.UpdatedAt,
		&session.Description, &tagsStr)

	if err != nil {
		return nil, err
	}

	json.Unmarshal([]byte(tagsStr), &session.Tags)
	return &session, nil
}

func (s *SQLiteStore) ListSessions(limit, offset int) ([]*Session, error) {
	rows, err := s.db.Query(
		`SELECT id, created_at, updated_at, description, tags
		 FROM sessions ORDER BY created_at DESC LIMIT ? OFFSET ?`,
		limit, offset,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []*Session
	for rows.Next() {
		var session Session
		var tagsStr string
		if err := rows.Scan(&session.ID, &session.CreatedAt,
			&session.UpdatedAt, &session.Description, &tagsStr); err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(tagsStr), &session.Tags)
		sessions = append(sessions, &session)
	}
	return sessions, nil
}

type EvidenceRecord struct {
	ID           int
	SessionID    string
	EvidenceType evidence.EvidenceType
	StartTime    time.Time
	EndTime      time.Time
	SampleCount  int
	Metadata     map[string]string
	RawContent   []byte
	CreatedAt    time.Time
}

func (s *SQLiteStore) SaveEvidence(sessionID string, ev evidence.Evidence, rawContent []byte) error {
	metadataJSON, _ := json.Marshal(ev.GetMetadata())

	_, err := s.db.Exec(
		`INSERT INTO evidence_records
		 (session_id, evidence_type, start_time, end_time, sample_count,
		  metadata, raw_content, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID, string(ev.Type()), ev.GetStartTime(), ev.GetEndTime(),
		ev.GetSampleCount(), string(metadataJSON), rawContent, time.Now(),
	)
	return err
}

func (s *SQLiteStore) GetEvidence(sessionID string, evType evidence.EvidenceType) ([]*EvidenceRecord, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, evidence_type, start_time, end_time,
		        sample_count, metadata, raw_content, created_at
		 FROM evidence_records
		 WHERE session_id = ? AND evidence_type = ?
		 ORDER BY created_at`,
		sessionID, string(evType),
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*EvidenceRecord
	for rows.Next() {
		var rec EvidenceRecord
		var evTypeStr, metadataStr string
		var rawContent []byte

		if err := rows.Scan(&rec.ID, &rec.SessionID, &evTypeStr,
			&rec.StartTime, &rec.EndTime, &rec.SampleCount,
			&metadataStr, &rawContent, &rec.CreatedAt); err != nil {
			return nil, err
		}

		rec.EvidenceType = evidence.EvidenceType(evTypeStr)
		rec.RawContent = rawContent
		json.Unmarshal([]byte(metadataStr), &rec.Metadata)
		records = append(records, &rec)
	}
	return records, nil
}

func (s *SQLiteStore) GetSessionEvidence(sessionID string) ([]*EvidenceRecord, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, evidence_type, start_time, end_time,
		        sample_count, metadata, raw_content, created_at
		 FROM evidence_records
		 WHERE session_id = ?
		 ORDER BY evidence_type, created_at`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []*EvidenceRecord
	for rows.Next() {
		var rec EvidenceRecord
		var evTypeStr, metadataStr string
		var rawContent []byte

		if err := rows.Scan(&rec.ID, &rec.SessionID, &evTypeStr,
			&rec.StartTime, &rec.EndTime, &rec.SampleCount,
			&metadataStr, &rawContent, &rec.CreatedAt); err != nil {
			return nil, err
		}

		rec.EvidenceType = evidence.EvidenceType(evTypeStr)
		rec.RawContent = rawContent
		json.Unmarshal([]byte(metadataStr), &rec.Metadata)
		records = append(records, &rec)
	}
	return records, nil
}

func (s *SQLiteStore) SaveAnalysisResult(sessionID string, result *evidence.AnalysisResult) error {
	bottlenecksJSON, _ := json.Marshal(result.Bottlenecks)
	recommendationsJSON, _ := json.Marshal(result.Recommendations)

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}

	res, err := tx.Exec(
		`INSERT INTO analysis_results
		 (session_id, timestamp, is_aligned, common_start_time,
		  common_end_time, total_duration, bottlenecks, recommendations, summary)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID, result.Timestamp, result.Alignment.IsAligned,
		result.Alignment.CommonStartTime, result.Alignment.CommonEndTime,
		result.Alignment.TotalDuration.Nanoseconds(),
		string(bottlenecksJSON), string(recommendationsJSON), result.Summary,
	)
	if err != nil {
		tx.Rollback()
		return err
	}

	resultID, _ := res.LastInsertId()

	for _, gap := range result.Alignment.Gaps {
		_, err = tx.Exec(
			`INSERT INTO timeline_gaps
			 (analysis_result_id, evidence_type, start_time, end_time,
			  duration, reason, severity)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			resultID, string(gap.EvidenceType), gap.StartTime, gap.EndTime,
			gap.Duration.Nanoseconds(), gap.Reason, string(gap.Severity),
		)
		if err != nil {
			tx.Rollback()
			return err
		}
	}

	return tx.Commit()
}

func (s *SQLiteStore) SaveAuditResult(sessionID string, result *evidence.AuditResult) error {
	evidenceTypesJSON, _ := json.Marshal(result.EvidenceTypes)
	missingTypesJSON, _ := json.Marshal(result.MissingTypes)
	issuesJSON, _ := json.Marshal(result.Issues)
	recommendationsJSON, _ := json.Marshal(result.Recommendations)

	_, err := s.db.Exec(
		`INSERT INTO audit_results
		 (session_id, timestamp, evidence_types, missing_types,
		  quality_score, issues, recommendations)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sessionID, result.Timestamp, string(evidenceTypesJSON),
		string(missingTypesJSON), result.QualityScore,
		string(issuesJSON), string(recommendationsJSON),
	)
	return err
}

func (s *SQLiteStore) GetAnalysisResult(sessionID string) (*evidence.AnalysisResult, error) {
	var result evidence.AnalysisResult
	var isAligned int
	var totalDuration int64
	var commonStartTime, commonEndTime sql.NullTime
	var bottlenecksStr, recommendationsStr, summaryStr sql.NullString

	err := s.db.QueryRow(
		`SELECT session_id, timestamp, is_aligned, common_start_time,
		        common_end_time, total_duration, bottlenecks, recommendations, summary
		 FROM analysis_results
		 WHERE session_id = ?
		 ORDER BY timestamp DESC LIMIT 1`,
		sessionID,
	).Scan(&result.SessionID, &result.Timestamp, &isAligned,
		&commonStartTime, &commonEndTime, &totalDuration,
		&bottlenecksStr, &recommendationsStr, &summaryStr)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no analysis result found for session: %s", sessionID)
	}
	if err != nil {
		return nil, err
	}

	result.Alignment.IsAligned = isAligned != 0
	result.Alignment.CommonStartTime = commonStartTime.Time
	result.Alignment.CommonEndTime = commonEndTime.Time
	result.Alignment.TotalDuration = time.Duration(totalDuration)

	if bottlenecksStr.Valid && bottlenecksStr.String != "" {
		json.Unmarshal([]byte(bottlenecksStr.String), &result.Bottlenecks)
	}
	if recommendationsStr.Valid && recommendationsStr.String != "" {
		json.Unmarshal([]byte(recommendationsStr.String), &result.Recommendations)
	}
	if summaryStr.Valid {
		result.Summary = summaryStr.String
	}

	gaps, err := s.getTimelineGaps(sessionID)
	if err == nil {
		result.Alignment.Gaps = gaps
	}

	return &result, nil
}

func (s *SQLiteStore) getTimelineGaps(sessionID string) ([]evidence.TimelineGap, error) {
	rows, err := s.db.Query(
		`SELECT tg.evidence_type, tg.start_time, tg.end_time,
		        tg.duration, tg.reason, tg.severity
		 FROM timeline_gaps tg
		 JOIN analysis_results ar ON tg.analysis_result_id = ar.id
		 WHERE ar.session_id = ?
		 ORDER BY tg.id`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var gaps []evidence.TimelineGap
	for rows.Next() {
		var gap evidence.TimelineGap
		var startTime, endTime sql.NullTime
		var duration int64
		var evType, reason, severity sql.NullString

		if err := rows.Scan(&evType, &startTime, &endTime,
			&duration, &reason, &severity); err != nil {
			return nil, err
		}

		gap.EvidenceType = evidence.EvidenceType(evType.String)
		if startTime.Valid {
			gap.StartTime = startTime.Time
		}
		if endTime.Valid {
			gap.EndTime = endTime.Time
		}
		gap.Duration = time.Duration(duration)
		if reason.Valid {
			gap.Reason = reason.String
		}
		if severity.Valid {
			gap.Severity = evidence.GapSeverity(severity.String)
		}

		gaps = append(gaps, gap)
	}

	return gaps, nil
}

func (s *SQLiteStore) GetAuditResult(sessionID string) (*evidence.AuditResult, error) {
	var result evidence.AuditResult
	var evidenceTypesStr, missingTypesStr, issuesStr, recommendationsStr sql.NullString

	err := s.db.QueryRow(
		`SELECT session_id, timestamp, evidence_types, missing_types,
		        quality_score, issues, recommendations
		 FROM audit_results
		 WHERE session_id = ?
		 ORDER BY timestamp DESC LIMIT 1`,
		sessionID,
	).Scan(&result.SessionID, &result.Timestamp, &evidenceTypesStr,
		&missingTypesStr, &result.QualityScore, &issuesStr, &recommendationsStr)

	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("no audit result found for session: %s", sessionID)
	}
	if err != nil {
		return nil, err
	}

	if evidenceTypesStr.Valid && evidenceTypesStr.String != "" {
		json.Unmarshal([]byte(evidenceTypesStr.String), &result.EvidenceTypes)
	}
	if missingTypesStr.Valid && missingTypesStr.String != "" {
		json.Unmarshal([]byte(missingTypesStr.String), &result.MissingTypes)
	}
	if issuesStr.Valid && issuesStr.String != "" {
		json.Unmarshal([]byte(issuesStr.String), &result.Issues)
	}
	if recommendationsStr.Valid && recommendationsStr.String != "" {
		json.Unmarshal([]byte(recommendationsStr.String), &result.Recommendations)
	}

	return &result, nil
}
