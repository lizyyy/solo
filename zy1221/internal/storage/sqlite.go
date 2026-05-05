package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"

	"github.com/zy1221/slice-teacher/internal/errors"
	"github.com/zy1221/slice-teacher/internal/model"
)

type SQLiteStore struct {
	db *sql.DB
}

func NewSQLiteStore(dbPath string) (*SQLiteStore, error) {
	dir := filepath.Dir(dbPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return nil, errors.NewIOError("无法创建数据库目录", dir, err)
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, errors.NewIOError("无法打开数据库", dbPath, err)
	}

	store := &SQLiteStore{db: db}
	if err := store.initSchema(); err != nil {
		db.Close()
		return nil, err
	}

	return store, nil
}

func (s *SQLiteStore) initSchema() error {
	schema := `
	CREATE TABLE IF NOT EXISTS traces (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp INTEGER NOT NULL,
		case_id TEXT NOT NULL,
		step_number INTEGER NOT NULL,
		operation TEXT NOT NULL,
		slice_name TEXT NOT NULL,
		len INTEGER NOT NULL,
		cap INTEGER NOT NULL,
		array_id TEXT NOT NULL,
		did_grow BOOLEAN NOT NULL,
		is_aliased BOOLEAN NOT NULL,
		notes TEXT
	);

	CREATE INDEX IF NOT EXISTS idx_traces_case_id ON traces(case_id);
	CREATE INDEX IF NOT EXISTS idx_traces_timestamp ON traces(timestamp);
	`

	_, err := s.db.Exec(schema)
	if err != nil {
		return errors.NewRuntimeError(
			fmt.Sprintf("无法初始化数据库 schema: %v", err),
			"请检查数据库文件权限",
		)
	}

	return nil
}

func (s *SQLiteStore) SaveTrace(trace *model.SQLiteTrace) error {
	query := `
	INSERT INTO traces (
		timestamp, case_id, step_number, operation, slice_name, 
		len, cap, array_id, did_grow, is_aliased, notes
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
	`

	_, err := s.db.Exec(query,
		trace.Timestamp,
		trace.CaseID,
		trace.StepNumber,
		trace.Operation,
		trace.SliceName,
		trace.Len,
		trace.Cap,
		trace.ArrayID,
		trace.DidGrow,
		trace.IsAliased,
		"",
	)

	if err != nil {
		return errors.NewRuntimeError(
			fmt.Sprintf("无法保存 trace: %v", err),
			"请检查数据库状态",
		)
	}

	return nil
}

func (s *SQLiteStore) SaveStep(caseID string, step *model.Step) error {
	timestamp := time.Now().Unix()

	for sliceName, slice := range step.Slices {
		notes := ""
		if len(step.Notes) > 0 {
			notes = step.Notes[0]
		}

		trace := &model.SQLiteTrace{
			Timestamp:  timestamp,
			CaseID:     caseID,
			StepNumber: step.StepNumber,
			Operation:  string(step.Operation.Type),
			SliceName:  sliceName,
			Len:        slice.Len,
			Cap:        slice.Cap,
			ArrayID:    slice.ArrayID,
			DidGrow:    step.DidGrow,
			IsAliased:  slice.IsAliased,
		}

		if err := s.SaveTrace(trace); err != nil {
			return err
		}
	}

	return nil
}

func (s *SQLiteStore) SaveAllSteps(caseID string, steps []*model.Step) error {
	for _, step := range steps {
		if err := s.SaveStep(caseID, step); err != nil {
			return err
		}
	}
	return nil
}

func (s *SQLiteStore) QueryByCaseID(caseID string) ([]*model.SQLiteTrace, error) {
	query := `
	SELECT id, timestamp, case_id, step_number, operation, slice_name,
	       len, cap, array_id, did_grow, is_aliased
	FROM traces
	WHERE case_id = ?
	ORDER BY step_number, slice_name
	`

	rows, err := s.db.Query(query, caseID)
	if err != nil {
		return nil, errors.NewRuntimeError(
			fmt.Sprintf("查询失败: %v", err),
			"请检查 case_id 是否正确",
		)
	}
	defer rows.Close()

	var traces []*model.SQLiteTrace
	for rows.Next() {
		trace := &model.SQLiteTrace{}
		var notes sql.NullString
		err := rows.Scan(
			&trace.ID,
			&trace.Timestamp,
			&trace.CaseID,
			&trace.StepNumber,
			&trace.Operation,
			&trace.SliceName,
			&trace.Len,
			&trace.Cap,
			&trace.ArrayID,
			&trace.DidGrow,
			&trace.IsAliased,
		)
		if err != nil {
			return nil, errors.NewRuntimeError(
				fmt.Sprintf("扫描结果失败: %v", err),
				"请检查数据库数据格式",
			)
		}
		traces = append(traces, trace)
	}

	return traces, nil
}

func (s *SQLiteStore) GetRecentCases(limit int) ([]string, error) {
	query := `
	SELECT DISTINCT case_id
	FROM traces
	ORDER BY timestamp DESC
	LIMIT ?
	`

	rows, err := s.db.Query(query, limit)
	if err != nil {
		return nil, errors.NewRuntimeError(
			fmt.Sprintf("查询最近的 case 失败: %v", err),
			"请检查数据库状态",
		)
	}
	defer rows.Close()

	var cases []string
	for rows.Next() {
		var caseID string
		if err := rows.Scan(&caseID); err != nil {
			return nil, err
		}
		cases = append(cases, caseID)
	}

	return cases, nil
}

func (s *SQLiteStore) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
