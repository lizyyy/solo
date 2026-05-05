package database

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "github.com/mattn/go-sqlite3"
	"go-iface-analyzer/internal/models"
)

const (
	dbName = "analysis.db"
)

type Database struct {
	*sql.DB
}

func New() (*Database, error) {
	dbPath := filepath.Join(".", dbName)
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	d := &Database{db}
	if err := d.initSchema(); err != nil {
		return nil, fmt.Errorf("failed to initialize schema: %w", err)
	}

	return d, nil
}

func (d *Database) initSchema() error {
	schema := `
CREATE TABLE IF NOT EXISTS analysis_sessions (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	start_time DATETIME NOT NULL,
	end_time DATETIME,
	status TEXT NOT NULL,
	total_cases INTEGER DEFAULT 0,
	issues_found INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS interface_cases (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id INTEGER NOT NULL,
	case_name TEXT NOT NULL,
	category TEXT NOT NULL,
	description TEXT,
	source_file TEXT,
	line_number INTEGER,
	FOREIGN KEY (session_id) REFERENCES analysis_sessions(id)
);

CREATE TABLE IF NOT EXISTS analysis_issues (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	session_id INTEGER NOT NULL,
	case_id INTEGER NOT NULL,
	issue_type TEXT NOT NULL,
	severity TEXT NOT NULL,
	description TEXT NOT NULL,
	location TEXT,
	suggestion TEXT,
	FOREIGN KEY (session_id) REFERENCES analysis_sessions(id),
	FOREIGN KEY (case_id) REFERENCES interface_cases(id)
);

CREATE TABLE IF NOT EXISTS method_set_info (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	case_id INTEGER NOT NULL,
	type_name TEXT NOT NULL,
	receiver_type TEXT,
	method_name TEXT NOT NULL,
	signature TEXT,
	is_value_method INTEGER DEFAULT 0,
	is_ptr_method INTEGER DEFAULT 0,
	FOREIGN KEY (case_id) REFERENCES interface_cases(id)
);

CREATE TABLE IF NOT EXISTS type_assertion_info (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	case_id INTEGER NOT NULL,
	location TEXT,
	interface_type TEXT,
	target_type TEXT,
	is_type_switch INTEGER DEFAULT 0,
	has_comma_ok INTEGER DEFAULT 0,
	risk_level TEXT,
	FOREIGN KEY (case_id) REFERENCES interface_cases(id)
);

CREATE TABLE IF NOT EXISTS allocation_risks (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	case_id INTEGER NOT NULL,
	location TEXT,
	description TEXT NOT NULL,
	risk_type TEXT NOT NULL,
	example TEXT,
	FOREIGN KEY (case_id) REFERENCES interface_cases(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON analysis_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_cases_session_id ON interface_cases(session_id);
CREATE INDEX IF NOT EXISTS idx_issues_session_id ON analysis_issues(session_id);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON analysis_issues(severity);
`

	_, err := d.Exec(schema)
	return err
}

func (d *Database) CreateSession() (*models.AnalysisSession, error) {
	result, err := d.Exec(
		"INSERT INTO analysis_sessions (start_time, status) VALUES (?, ?)",
		time.Now(), "running",
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create session: %w", err)
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, fmt.Errorf("failed to get last insert id: %w", err)
	}

	return d.GetSessionByID(id)
}

func (d *Database) GetSessionByID(id int64) (*models.AnalysisSession, error) {
	var session models.AnalysisSession
	err := d.QueryRow(
		"SELECT id, start_time, end_time, status, total_cases, issues_found FROM analysis_sessions WHERE id = ?",
		id,
	).Scan(
		&session.ID, &session.StartTime, &session.EndTime, &session.Status,
		&session.TotalCases, &session.IssuesFound,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("failed to get session: %w", err)
	}
	return &session, nil
}

func (d *Database) UpdateSession(session *models.AnalysisSession) error {
	_, err := d.Exec(
		`UPDATE analysis_sessions SET end_time = ?, status = ?, total_cases = ?, issues_found = ? WHERE id = ?`,
		session.EndTime, session.Status, session.TotalCases, session.IssuesFound, session.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update session: %w", err)
	}
	return nil
}

func (d *Database) GetRecentSessions(limit int) ([]*models.AnalysisSession, error) {
	rows, err := d.Query(
		`SELECT id, start_time, end_time, status, total_cases, issues_found 
		 FROM analysis_sessions ORDER BY start_time DESC LIMIT ?`,
		limit,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to query sessions: %w", err)
	}
	defer rows.Close()

	var sessions []*models.AnalysisSession
	for rows.Next() {
		var session models.AnalysisSession
		if err := rows.Scan(
			&session.ID, &session.StartTime, &session.EndTime, &session.Status,
			&session.TotalCases, &session.IssuesFound,
		); err != nil {
			return nil, err
		}
		sessions = append(sessions, &session)
	}
	return sessions, nil
}

func (d *Database) CreateCase(caseItem *models.InterfaceCase) (int64, error) {
	result, err := d.Exec(
		`INSERT INTO interface_cases (session_id, case_name, category, description, source_file, line_number)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		caseItem.SessionID, caseItem.CaseName, caseItem.Category,
		caseItem.Description, caseItem.SourceFile, caseItem.LineNumber,
	)
	if err != nil {
		return 0, fmt.Errorf("failed to create case: %w", err)
	}
	return result.LastInsertId()
}

func (d *Database) CreateIssue(issue *models.AnalysisIssue) error {
	_, err := d.Exec(
		`INSERT INTO analysis_issues (session_id, case_id, issue_type, severity, description, location, suggestion)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		issue.SessionID, issue.CaseID, issue.IssueType, issue.Severity,
		issue.Description, issue.Location, issue.Suggestion,
	)
	if err != nil {
		return fmt.Errorf("failed to create issue: %w", err)
	}
	return nil
}

func (d *Database) CreateMethodSetInfo(info *models.MethodSetInfo) error {
	_, err := d.Exec(
		`INSERT INTO method_set_info (case_id, type_name, receiver_type, method_name, signature, is_value_method, is_ptr_method)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		info.CaseID, info.TypeName, info.ReceiverType, info.MethodName,
		info.Signature, info.IsValueMethod, info.IsPtrMethod,
	)
	if err != nil {
		return fmt.Errorf("failed to create method set info: %w", err)
	}
	return nil
}

func (d *Database) CreateTypeAssertionInfo(info *models.TypeAssertionInfo) error {
	_, err := d.Exec(
		`INSERT INTO type_assertion_info (case_id, location, interface_type, target_type, is_type_switch, has_comma_ok, risk_level)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		info.CaseID, info.Location, info.InterfaceType, info.TargetType,
		info.IsTypeSwitch, info.HasCommaOk, info.RiskLevel,
	)
	if err != nil {
		return fmt.Errorf("failed to create type assertion info: %w", err)
	}
	return nil
}

func (d *Database) CreateAllocationRisk(risk *models.AllocationRisk) error {
	_, err := d.Exec(
		`INSERT INTO allocation_risks (case_id, location, description, risk_type, example)
		 VALUES (?, ?, ?, ?, ?)`,
		risk.CaseID, risk.Location, risk.Description, risk.RiskType, risk.Example,
	)
	if err != nil {
		return fmt.Errorf("failed to create allocation risk: %w", err)
	}
	return nil
}

func (d *Database) GetSessionWithDetails(sessionID int64) (*models.AnalysisSession, []*models.InterfaceCase, []*models.AnalysisIssue, error) {
	session, err := d.GetSessionByID(sessionID)
	if err != nil {
		return nil, nil, nil, err
	}
	if session == nil {
		return nil, nil, nil, fmt.Errorf("session not found")
	}

	caseRows, err := d.Query(
		`SELECT id, session_id, case_name, category, description, source_file, line_number 
		 FROM interface_cases WHERE session_id = ?`,
		sessionID,
	)
	if err != nil {
		return nil, nil, nil, err
	}
	defer caseRows.Close()

	var cases []*models.InterfaceCase
	for caseRows.Next() {
		var c models.InterfaceCase
		if err := caseRows.Scan(
			&c.ID, &c.SessionID, &c.CaseName, &c.Category,
			&c.Description, &c.SourceFile, &c.LineNumber,
		); err != nil {
			return nil, nil, nil, err
		}
		cases = append(cases, &c)
	}

	issueRows, err := d.Query(
		`SELECT id, session_id, case_id, issue_type, severity, description, location, suggestion
		 FROM analysis_issues WHERE session_id = ? ORDER BY severity DESC, issue_type`,
		sessionID,
	)
	if err != nil {
		return nil, nil, nil, err
	}
	defer issueRows.Close()

	var issues []*models.AnalysisIssue
	for issueRows.Next() {
		var i models.AnalysisIssue
		if err := issueRows.Scan(
			&i.ID, &i.SessionID, &i.CaseID, &i.IssueType, &i.Severity,
			&i.Description, &i.Location, &i.Suggestion,
		); err != nil {
			return nil, nil, nil, err
		}
		issues = append(issues, &i)
	}

	return session, cases, issues, nil
}

func (d *Database) DBExists() bool {
	dbPath := filepath.Join(".", dbName)
	_, err := os.Stat(dbPath)
	return err == nil
}
