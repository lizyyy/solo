package storage

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

type DB struct {
	*sql.DB
}

type ExecutionRecord struct {
	ID           string
	CaseName     string
	Status       string
	ReturnValue  interface{}
	PanicValue   interface{}
	Recovered    bool
	DeferStack   []string
	TimelineJSON string
	RiskLevel    string
	RiskJSON     string
	StartedAt    time.Time
	CompletedAt  time.Time
	CreatedAt    time.Time
}

type EventRecord struct {
	ID          int64
	Timestamp   string
	EventType   string
	CaseName    string
	DetailsJSON string
	CreatedAt   time.Time
}

type ExecutionData struct {
	ID          string
	CaseName    string
	Status      string
	ReturnValue interface{}
	PanicValue  interface{}
	Recovered   bool
	DeferStack  []string
	Timeline    interface{}
	RiskLevel   string
	Risk        interface{}
	StartedAt   time.Time
	CompletedAt time.Time
}

type EventData struct {
	Timestamp string
	EventType string
	CaseName  string
	Details   map[string]interface{}
}

func InitDB(path string) error {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return fmt.Errorf("打开数据库失败: %w", err)
	}
	defer db.Close()

	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS executions (
		id TEXT PRIMARY KEY,
		case_name TEXT NOT NULL,
		status TEXT NOT NULL,
		return_value TEXT,
		panic_value TEXT,
		recovered INTEGER,
		defer_stack TEXT,
		timeline_json TEXT,
		risk_level TEXT,
		risk_json TEXT,
		started_at DATETIME,
		completed_at DATETIME,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("创建 executions 表失败: %w", err)
	}

	_, err = db.Exec(`
	CREATE TABLE IF NOT EXISTS events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp TEXT NOT NULL,
		event_type TEXT NOT NULL,
		case_name TEXT,
		details_json TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP
	)`)
	if err != nil {
		return fmt.Errorf("创建 events 表失败: %w", err)
	}

	_, err = db.Exec(`CREATE INDEX IF NOT EXISTS idx_executions_case_name ON executions(case_name)`)
	if err != nil {
		return fmt.Errorf("创建索引失败: %w", err)
	}

	return nil
}

func OpenDB(path string) (*DB, error) {
	db, err := sql.Open("sqlite3", path)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}
	return &DB{db}, nil
}

func SaveExecution(db *DB, data *ExecutionData) error {
	returnValueJSON, _ := json.Marshal(data.ReturnValue)
	panicValueJSON, _ := json.Marshal(data.PanicValue)
	deferStackJSON, _ := json.Marshal(data.DeferStack)
	timelineJSON, _ := json.Marshal(data.Timeline)
	riskJSON, _ := json.Marshal(data.Risk)

	_, err := db.Exec(`
	INSERT OR REPLACE INTO executions 
	(id, case_name, status, return_value, panic_value, recovered, defer_stack, timeline_json, risk_level, risk_json, started_at, completed_at)
	VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		data.ID,
		data.CaseName,
		data.Status,
		string(returnValueJSON),
		string(panicValueJSON),
		boolToInt(data.Recovered),
		string(deferStackJSON),
		string(timelineJSON),
		data.RiskLevel,
		string(riskJSON),
		data.StartedAt,
		data.CompletedAt,
	)

	if err != nil {
		return fmt.Errorf("保存执行记录失败: %w", err)
	}

	return nil
}

func GetExecution(db *DB, id string) (*ExecutionRecord, error) {
	row := db.QueryRow(`
	SELECT id, case_name, status, return_value, panic_value, recovered, defer_stack, 
	       timeline_json, risk_level, risk_json, started_at, completed_at, created_at
	FROM executions WHERE id = ?`, id)

	record := &ExecutionRecord{}
	var returnValueStr, panicValueStr, deferStackStr, timelineJSON, riskJSON sql.NullString
	var recovered sql.NullInt64
	var startedAt, completedAt, createdAt sql.NullTime

	err := row.Scan(
		&record.ID,
		&record.CaseName,
		&record.Status,
		&returnValueStr,
		&panicValueStr,
		&recovered,
		&deferStackStr,
		&timelineJSON,
		&record.RiskLevel,
		&riskJSON,
		&startedAt,
		&completedAt,
		&createdAt,
	)

	if err != nil {
		if err == sql.ErrNoRows {
			return nil, fmt.Errorf("未找到执行记录: %s", id)
		}
		return nil, fmt.Errorf("查询执行记录失败: %w", err)
	}

	if returnValueStr.Valid {
		json.Unmarshal([]byte(returnValueStr.String), &record.ReturnValue)
	}
	if panicValueStr.Valid {
		json.Unmarshal([]byte(panicValueStr.String), &record.PanicValue)
	}
	if recovered.Valid {
		record.Recovered = recovered.Int64 == 1
	}
	if deferStackStr.Valid {
		json.Unmarshal([]byte(deferStackStr.String), &record.DeferStack)
	}
	if timelineJSON.Valid {
		record.TimelineJSON = timelineJSON.String
	}
	if riskJSON.Valid {
		record.RiskJSON = riskJSON.String
	}
	if startedAt.Valid {
		record.StartedAt = startedAt.Time
	}
	if completedAt.Valid {
		record.CompletedAt = completedAt.Time
	}
	if createdAt.Valid {
		record.CreatedAt = createdAt.Time
	}

	return record, nil
}

func GetAllExecutions(db *DB) ([]*ExecutionRecord, error) {
	rows, err := db.Query(`
	SELECT id, case_name, status, return_value, panic_value, recovered, defer_stack, 
	       timeline_json, risk_level, risk_json, started_at, completed_at, created_at
	FROM executions ORDER BY created_at DESC`)
	if err != nil {
		return nil, fmt.Errorf("查询执行记录失败: %w", err)
	}
	defer rows.Close()

	var records []*ExecutionRecord
	for rows.Next() {
		record := &ExecutionRecord{}
		var returnValueStr, panicValueStr, deferStackStr, timelineJSON, riskJSON sql.NullString
		var recovered sql.NullInt64
		var startedAt, completedAt, createdAt sql.NullTime

		err := rows.Scan(
			&record.ID,
			&record.CaseName,
			&record.Status,
			&returnValueStr,
			&panicValueStr,
			&recovered,
			&deferStackStr,
			&timelineJSON,
			&record.RiskLevel,
			&riskJSON,
			&startedAt,
			&completedAt,
			&createdAt,
		)
		if err != nil {
			return nil, fmt.Errorf("扫描执行记录失败: %w", err)
		}

		if returnValueStr.Valid {
			json.Unmarshal([]byte(returnValueStr.String), &record.ReturnValue)
		}
		if panicValueStr.Valid {
			json.Unmarshal([]byte(panicValueStr.String), &record.PanicValue)
		}
		if recovered.Valid {
			record.Recovered = recovered.Int64 == 1
		}
		if deferStackStr.Valid {
			json.Unmarshal([]byte(deferStackStr.String), &record.DeferStack)
		}
		if timelineJSON.Valid {
			record.TimelineJSON = timelineJSON.String
		}
		if riskJSON.Valid {
			record.RiskJSON = riskJSON.String
		}
		if startedAt.Valid {
			record.StartedAt = startedAt.Time
		}
		if completedAt.Valid {
			record.CompletedAt = completedAt.Time
		}
		if createdAt.Valid {
			record.CreatedAt = createdAt.Time
		}

		records = append(records, record)
	}

	return records, nil
}

func SaveEvent(db *DB, data *EventData) error {
	detailsJSON, _ := json.Marshal(data.Details)

	_, err := db.Exec(`
	INSERT INTO events (timestamp, event_type, case_name, details_json)
	VALUES (?, ?, ?, ?)`,
		data.Timestamp,
		data.EventType,
		data.CaseName,
		string(detailsJSON),
	)

	if err != nil {
		return fmt.Errorf("保存事件失败: %w", err)
	}

	return nil
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
