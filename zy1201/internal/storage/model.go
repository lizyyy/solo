package storage

import (
	"database/sql"
	"encoding/json"
	"time"
)

type AnalysisSession struct {
	ID          int64
	CreatedAt   time.Time
	ProjectName string
	Version     string
	Status      string
	Error       string
}

type ConnectionPoolAnalysis struct {
	ID               int64
	SessionID        int64
	MaxOpenConns     int
	MaxIdleConns     int
	ConnectionRating string
	Issues           string
	Suggestions      string
	CreatedAt        time.Time
}

type IndexAnalysis struct {
	ID              int64
	SessionID       int64
	TableName       string
	IndexName       string
	IndexType       string
	Columns         string
	IssueType       string
	Severity        string
	Description     string
	Suggestion      string
	ImpactScore     float64
	CreatedAt       time.Time
}

type SlowQueryAnalysis struct {
	ID              int64
	SessionID       int64
	QueryTime       time.Duration
	LockTime        time.Duration
	RowsExamined    int64
	RowsSent        int64
	SQL             string
	AnalysisType    string
	Severity        string
	Description     string
	Suggestion      string
	OptimizedSQL    string
	ImpactScore     float64
	CreatedAt       time.Time
}

type WritePerformanceAnalysis struct {
	ID               int64
	SessionID        int64
	TableName        string
	Operation        string
	AvgSingleRowTime time.Duration
	AvgBatchRowTime  time.Duration
	BatchSize        int
	PerformanceRatio float64
	Recommendation   string
	CreatedAt        time.Time
}

type ReadWriteAnalysis struct {
	ID               int64
	SessionID        int64
	ReadWriteEnabled bool
	ReadRatio        float64
	ActualReadRatio  float64
	ReadEndpointCount int
	Issues           string
	Suggestions      string
	CreatedAt        time.Time
}

type ShardingAnalysis struct {
	ID               int64
	SessionID        int64
	ShardingEnabled  bool
	ShardKey         string
	ShardCount       int
	HotspotRisk      string
	HotspotTables    string
	Suggestions      string
	ShardDistribution string
	CreatedAt        time.Time
}

type Bottleneck struct {
	ID          int64
	SessionID   int64
	Category    string
	Description string
	Severity    string
	Priority    int
	Impact      float64
	CreatedAt   time.Time
}

type Storage struct {
	db *sql.DB
}

func (s *Storage) InitDB() error {
	schema := `
	CREATE TABLE IF NOT EXISTS analysis_sessions (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		created_at DATETIME NOT NULL,
		project_name TEXT,
		version TEXT,
		status TEXT,
		error TEXT
	);

	CREATE TABLE IF NOT EXISTS connection_pool_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		max_open_conns INTEGER,
		max_idle_conns INTEGER,
		connection_rating TEXT,
		issues TEXT,
		suggestions TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS index_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		table_name TEXT,
		index_name TEXT,
		index_type TEXT,
		columns TEXT,
		issue_type TEXT,
		severity TEXT,
		description TEXT,
		suggestion TEXT,
		impact_score REAL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS slow_query_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		query_time REAL,
		lock_time REAL,
		rows_examined INTEGER,
		rows_sent INTEGER,
		sql TEXT,
		analysis_type TEXT,
		severity TEXT,
		description TEXT,
		suggestion TEXT,
		optimized_sql TEXT,
		impact_score REAL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS write_performance_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		table_name TEXT,
		operation TEXT,
		avg_single_row_time REAL,
		avg_batch_row_time REAL,
		batch_size INTEGER,
		performance_ratio REAL,
		recommendation TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS read_write_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		read_write_enabled BOOLEAN,
		read_ratio REAL,
		actual_read_ratio REAL,
		read_endpoint_count INTEGER,
		issues TEXT,
		suggestions TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS sharding_analysis (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		sharding_enabled BOOLEAN,
		shard_key TEXT,
		shard_count INTEGER,
		hotspot_risk TEXT,
		hotspot_tables TEXT,
		suggestions TEXT,
		shard_distribution TEXT,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE TABLE IF NOT EXISTS bottlenecks (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		session_id INTEGER NOT NULL,
		category TEXT,
		description TEXT,
		severity TEXT,
		priority INTEGER,
		impact REAL,
		created_at DATETIME NOT NULL,
		FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
	);

	CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON analysis_sessions(created_at);
	CREATE INDEX IF NOT EXISTS idx_index_analysis_session ON index_analysis(session_id);
	CREATE INDEX IF NOT EXISTS idx_slow_query_session ON slow_query_analysis(session_id);
	CREATE INDEX IF NOT EXISTS idx_bottlenecks_session ON bottlenecks(session_id);
	`

	_, err := s.db.Exec(schema)
	return err
}

func (s *Storage) CreateSession(projectName, version string) (int64, error) {
	result, err := s.db.Exec(
		`INSERT INTO analysis_sessions (created_at, project_name, version, status) VALUES (?, ?, ?, ?)`,
		time.Now(),
		projectName,
		version,
		"running",
	)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func (s *Storage) UpdateSessionStatus(sessionID int64, status, errorMsg string) error {
	_, err := s.db.Exec(
		`UPDATE analysis_sessions SET status = ?, error = ? WHERE id = ?`,
		status,
		errorMsg,
		sessionID,
	)
	return err
}

func (s *Storage) SaveConnectionPoolAnalysis(sessionID int64, analysis *ConnectionPoolAnalysis) error {
	issuesJSON, _ := json.Marshal(analysis.Issues)
	suggestionsJSON, _ := json.Marshal(analysis.Suggestions)

	_, err := s.db.Exec(
		`INSERT INTO connection_pool_analysis (
			session_id, max_open_conns, max_idle_conns, connection_rating, 
			issues, suggestions, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		sessionID,
		analysis.MaxOpenConns,
		analysis.MaxIdleConns,
		analysis.ConnectionRating,
		string(issuesJSON),
		string(suggestionsJSON),
		time.Now(),
	)
	return err
}

func (s *Storage) SaveIndexAnalysis(sessionID int64, analyses []IndexAnalysis) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO index_analysis (
			session_id, table_name, index_name, index_type, columns,
			issue_type, severity, description, suggestion, impact_score, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range analyses {
		colsJSON, _ := json.Marshal(a.Columns)
		_, err = stmt.Exec(
			sessionID,
			a.TableName,
			a.IndexName,
			a.IndexType,
			string(colsJSON),
			a.IssueType,
			a.Severity,
			a.Description,
			a.Suggestion,
			a.ImpactScore,
			time.Now(),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) SaveSlowQueryAnalysis(sessionID int64, analyses []SlowQueryAnalysis) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO slow_query_analysis (
			session_id, query_time, lock_time, rows_examined, rows_sent,
			sql, analysis_type, severity, description, suggestion, optimized_sql,
			impact_score, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range analyses {
		_, err = stmt.Exec(
			sessionID,
			a.QueryTime.Seconds(),
			a.LockTime.Seconds(),
			a.RowsExamined,
			a.RowsSent,
			a.SQL,
			a.AnalysisType,
			a.Severity,
			a.Description,
			a.Suggestion,
			a.OptimizedSQL,
			a.ImpactScore,
			time.Now(),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) SaveWritePerformanceAnalysis(sessionID int64, analyses []WritePerformanceAnalysis) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO write_performance_analysis (
			session_id, table_name, operation, avg_single_row_time, 
			avg_batch_row_time, batch_size, performance_ratio, recommendation, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, a := range analyses {
		_, err = stmt.Exec(
			sessionID,
			a.TableName,
			a.Operation,
			a.AvgSingleRowTime.Seconds(),
			a.AvgBatchRowTime.Seconds(),
			a.BatchSize,
			a.PerformanceRatio,
			a.Recommendation,
			time.Now(),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) SaveReadWriteAnalysis(sessionID int64, analysis *ReadWriteAnalysis) error {
	issuesJSON, _ := json.Marshal(analysis.Issues)
	suggestionsJSON, _ := json.Marshal(analysis.Suggestions)

	_, err := s.db.Exec(
		`INSERT INTO read_write_analysis (
			session_id, read_write_enabled, read_ratio, actual_read_ratio,
			read_endpoint_count, issues, suggestions, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID,
		analysis.ReadWriteEnabled,
		analysis.ReadRatio,
		analysis.ActualReadRatio,
		analysis.ReadEndpointCount,
		string(issuesJSON),
		string(suggestionsJSON),
		time.Now(),
	)
	return err
}

func (s *Storage) SaveShardingAnalysis(sessionID int64, analysis *ShardingAnalysis) error {
	hotspotTablesJSON, _ := json.Marshal(analysis.HotspotTables)
	suggestionsJSON, _ := json.Marshal(analysis.Suggestions)
	shardDistJSON, _ := json.Marshal(analysis.ShardDistribution)

	_, err := s.db.Exec(
		`INSERT INTO sharding_analysis (
			session_id, sharding_enabled, shard_key, shard_count,
			hotspot_risk, hotspot_tables, suggestions, shard_distribution, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		sessionID,
		analysis.ShardingEnabled,
		analysis.ShardKey,
		analysis.ShardCount,
		analysis.HotspotRisk,
		string(hotspotTablesJSON),
		string(suggestionsJSON),
		string(shardDistJSON),
		time.Now(),
	)
	return err
}

func (s *Storage) SaveBottlenecks(sessionID int64, bottlenecks []Bottleneck) error {
	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	stmt, err := tx.Prepare(
		`INSERT INTO bottlenecks (
			session_id, category, description, severity, priority, impact, created_at
		) VALUES (?, ?, ?, ?, ?, ?, ?)`,
	)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, b := range bottlenecks {
		_, err = stmt.Exec(
			sessionID,
			b.Category,
			b.Description,
			b.Severity,
			b.Priority,
			b.Impact,
			time.Now(),
		)
		if err != nil {
			return err
		}
	}

	return tx.Commit()
}

func (s *Storage) GetSession(sessionID int64) (*AnalysisSession, error) {
	var session AnalysisSession
	err := s.db.QueryRow(
		`SELECT id, created_at, project_name, version, status, error FROM analysis_sessions WHERE id = ?`,
		sessionID,
	).Scan(
		&session.ID,
		&session.CreatedAt,
		&session.ProjectName,
		&session.Version,
		&session.Status,
		&session.Error,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &session, err
}

func (s *Storage) GetLatestSession() (*AnalysisSession, error) {
	var session AnalysisSession
	err := s.db.QueryRow(
		`SELECT id, created_at, project_name, version, status, error 
		 FROM analysis_sessions ORDER BY created_at DESC LIMIT 1`,
	).Scan(
		&session.ID,
		&session.CreatedAt,
		&session.ProjectName,
		&session.Version,
		&session.Status,
		&session.Error,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &session, err
}

func (s *Storage) GetBottlenecksBySession(sessionID int64) ([]Bottleneck, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, category, description, severity, priority, impact, created_at
		 FROM bottlenecks WHERE session_id = ? ORDER BY priority DESC, impact DESC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var bottlenecks []Bottleneck
	for rows.Next() {
		var b Bottleneck
		err := rows.Scan(
			&b.ID, &b.SessionID, &b.Category, &b.Description,
			&b.Severity, &b.Priority, &b.Impact, &b.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		bottlenecks = append(bottlenecks, b)
	}
	return bottlenecks, nil
}

func (s *Storage) GetIndexAnalysisBySession(sessionID int64) ([]IndexAnalysis, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, table_name, index_name, index_type, columns,
				issue_type, severity, description, suggestion, impact_score, created_at
		 FROM index_analysis WHERE session_id = ? ORDER BY impact_score DESC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analyses []IndexAnalysis
	for rows.Next() {
		var a IndexAnalysis
		var colsStr string
		err := rows.Scan(
			&a.ID, &a.SessionID, &a.TableName, &a.IndexName, &a.IndexType,
			&colsStr, &a.IssueType, &a.Severity, &a.Description, &a.Suggestion,
			&a.ImpactScore, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		json.Unmarshal([]byte(colsStr), &a.Columns)
		analyses = append(analyses, a)
	}
	return analyses, nil
}

func (s *Storage) GetSlowQueryAnalysisBySession(sessionID int64) ([]SlowQueryAnalysis, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, query_time, lock_time, rows_examined, rows_sent,
				sql, analysis_type, severity, description, suggestion, optimized_sql,
				impact_score, created_at
		 FROM slow_query_analysis WHERE session_id = ? ORDER BY impact_score DESC, query_time DESC`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analyses []SlowQueryAnalysis
	for rows.Next() {
		var a SlowQueryAnalysis
		var qt, lt float64
		err := rows.Scan(
			&a.ID, &a.SessionID, &qt, &lt, &a.RowsExamined, &a.RowsSent,
			&a.SQL, &a.AnalysisType, &a.Severity, &a.Description, &a.Suggestion,
			&a.OptimizedSQL, &a.ImpactScore, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		a.QueryTime = time.Duration(qt * float64(time.Second))
		a.LockTime = time.Duration(lt * float64(time.Second))
		analyses = append(analyses, a)
	}
	return analyses, nil
}

func (s *Storage) GetConnectionPoolAnalysisBySession(sessionID int64) (*ConnectionPoolAnalysis, error) {
	var analysis ConnectionPoolAnalysis
	var issuesStr, suggestionsStr string
	err := s.db.QueryRow(
		`SELECT id, session_id, max_open_conns, max_idle_conns, connection_rating,
				issues, suggestions, created_at
		 FROM connection_pool_analysis WHERE session_id = ?`,
		sessionID,
	).Scan(
		&analysis.ID, &analysis.SessionID, &analysis.MaxOpenConns, &analysis.MaxIdleConns,
		&analysis.ConnectionRating, &issuesStr, &suggestionsStr, &analysis.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(issuesStr), &analysis.Issues)
	json.Unmarshal([]byte(suggestionsStr), &analysis.Suggestions)
	return &analysis, nil
}

func (s *Storage) GetWritePerformanceAnalysisBySession(sessionID int64) ([]WritePerformanceAnalysis, error) {
	rows, err := s.db.Query(
		`SELECT id, session_id, table_name, operation, avg_single_row_time,
				avg_batch_row_time, batch_size, performance_ratio, recommendation, created_at
		 FROM write_performance_analysis WHERE session_id = ?`,
		sessionID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var analyses []WritePerformanceAnalysis
	for rows.Next() {
		var a WritePerformanceAnalysis
		var srt, brt float64
		err := rows.Scan(
			&a.ID, &a.SessionID, &a.TableName, &a.Operation, &srt,
			&brt, &a.BatchSize, &a.PerformanceRatio, &a.Recommendation, &a.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		a.AvgSingleRowTime = time.Duration(srt * float64(time.Second))
		a.AvgBatchRowTime = time.Duration(brt * float64(time.Second))
		analyses = append(analyses, a)
	}
	return analyses, nil
}

func (s *Storage) GetReadWriteAnalysisBySession(sessionID int64) (*ReadWriteAnalysis, error) {
	var analysis ReadWriteAnalysis
	var issuesStr, suggestionsStr string
	err := s.db.QueryRow(
		`SELECT id, session_id, read_write_enabled, read_ratio, actual_read_ratio,
				read_endpoint_count, issues, suggestions, created_at
		 FROM read_write_analysis WHERE session_id = ?`,
		sessionID,
	).Scan(
		&analysis.ID, &analysis.SessionID, &analysis.ReadWriteEnabled, &analysis.ReadRatio,
		&analysis.ActualReadRatio, &analysis.ReadEndpointCount, &issuesStr, &suggestionsStr, &analysis.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(issuesStr), &analysis.Issues)
	json.Unmarshal([]byte(suggestionsStr), &analysis.Suggestions)
	return &analysis, nil
}

func (s *Storage) GetShardingAnalysisBySession(sessionID int64) (*ShardingAnalysis, error) {
	var analysis ShardingAnalysis
	var hotspotTablesStr, suggestionsStr, shardDistStr string
	err := s.db.QueryRow(
		`SELECT id, session_id, sharding_enabled, shard_key, shard_count,
				hotspot_risk, hotspot_tables, suggestions, shard_distribution, created_at
		 FROM sharding_analysis WHERE session_id = ?`,
		sessionID,
	).Scan(
		&analysis.ID, &analysis.SessionID, &analysis.ShardingEnabled, &analysis.ShardKey,
		&analysis.ShardCount, &analysis.HotspotRisk, &hotspotTablesStr, &suggestionsStr,
		&shardDistStr, &analysis.CreatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	json.Unmarshal([]byte(hotspotTablesStr), &analysis.HotspotTables)
	json.Unmarshal([]byte(suggestionsStr), &analysis.Suggestions)
	json.Unmarshal([]byte(shardDistStr), &analysis.ShardDistribution)
	return &analysis, nil
}

func (s *Storage) ListSessions(limit int) ([]AnalysisSession, error) {
	rows, err := s.db.Query(
		`SELECT id, created_at, project_name, version, status, error 
		 FROM analysis_sessions ORDER BY created_at DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sessions []AnalysisSession
	for rows.Next() {
		var s AnalysisSession
		err := rows.Scan(
			&s.ID, &s.CreatedAt, &s.ProjectName, &s.Version, &s.Status, &s.Error,
		)
		if err != nil {
			return nil, err
		}
		sessions = append(sessions, s)
	}
	return sessions, nil
}

func (s *Storage) Close() error {
	return s.db.Close()
}
