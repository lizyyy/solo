package db

import (
	"database/sql"
	"embed"
	"encoding/json"
	"fmt"
	"time"

	"blade-schedule/internal/model"

	_ "modernc.org/sqlite"
)

//go:embed schema.sql
var schemaFS embed.FS

type Store struct {
	DB *sql.DB
}

func Open(path string) (*Store, error) {
	db, err := sql.Open("sqlite", path+"?_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)")
	if err != nil {
		return nil, fmt.Errorf("open sqlite %s: %w", path, err)
	}
	schema, err := schemaFS.ReadFile("schema.sql")
	if err != nil {
		return nil, fmt.Errorf("read schema.sql: %w", err)
	}
	if _, err := db.Exec(string(schema)); err != nil {
		return nil, fmt.Errorf("apply schema: %w", err)
	}
	return &Store{DB: db}, nil
}

func (s *Store) Close() error { return s.DB.Close() }

func (s *Store) CreateRun(tag, summary string) (int64, error) {
	res, err := s.DB.Exec(`INSERT INTO runs(tag, created_at, summary) VALUES(?,?,?)`,
		tag, time.Now().Format(time.RFC3339), summary)
	if err != nil {
		return 0, fmt.Errorf("insert run: %w", err)
	}
	return res.LastInsertId()
}

func (s *Store) SaveRecord(r *model.ScheduleResult) (int64, error) {
	origJSON, _ := json.Marshal(r.OriginalNames)
	reasonJSON, _ := json.Marshal(r.AnomalyReasons)
	eta := ""
	if !r.ETA.IsZero() {
		eta = r.ETA.Format("2006-01-02")
	}
	ds := ""
	if !r.DowntimeStart.IsZero() {
		ds = r.DowntimeStart.Format("2006-01-02")
	}
	de := ""
	if !r.DowntimeEnd.IsZero() {
		de = r.DowntimeEnd.Format("2006-01-02")
	}
	makeWin := 0
	if r.WillMakeWindow {
		makeWin = 1
	}
	isAnom := 0
	if r.IsAnomaly {
		isAnom = 1
	}
	res, err := s.DB.Exec(`INSERT INTO schedule_records(
		run_id, unified_name, original_names, spec_model, required_qty, arrived_qty,
		eta, downtime_start, downtime_end, will_make_window, days_late, is_anomaly,
		anomaly_reasons, raw_source_quote, threshold_text, status, remark, screenshot_ref)
		VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
		r.RunID, r.UnifiedName, string(origJSON), r.SpecModel, r.RequiredQty, r.ArrivedQty,
		eta, ds, de, makeWin, r.DaysLate, isAnom,
		string(reasonJSON), r.RawSourceQuote, r.ThresholdText, r.Status, r.Remark, r.ScreenshotRef)
	if err != nil {
		return 0, fmt.Errorf("insert record %s: %w", r.UnifiedName, err)
	}
	id, _ := res.LastInsertId()
	if err := s.upsertNote(r); err != nil {
		return id, err
	}
	if isAnom == 1 {
		delta := ""
		if r.PrevStatus != "" && r.PrevStatus != r.Status {
			delta = fmt.Sprintf("status %s→%s", r.PrevStatus, r.Status)
		}
		if r.PrevRemark != "" && r.PrevRemark != r.Remark {
			if delta != "" {
				delta += "; "
			}
			delta += "remark 更新"
		}
		if _, err := s.DB.Exec(`INSERT INTO anomalies(run_id, record_id, unified_name, reasons, raw_source_quote, status, remark, screenshot_ref, delta_from_prev) VALUES(?,?,?,?,?,?,?,?,?)`,
			r.RunID, id, r.UnifiedName, string(reasonJSON), r.RawSourceQuote, r.Status, r.Remark, r.ScreenshotRef, delta); err != nil {
			return id, fmt.Errorf("insert anomaly %s: %w", r.UnifiedName, err)
		}
	}
	return id, nil
}

func (s *Store) upsertNote(r *model.ScheduleResult) error {
	now := time.Now().Format(time.RFC3339)
	var existingStatus, existingRemark, existingShot, existingThr string
	err := s.DB.QueryRow(`SELECT status, remark, screenshot_ref, threshold_note FROM notes WHERE unified_name=? AND spec_model=?`,
		r.UnifiedName, r.SpecModel).Scan(&existingStatus, &existingRemark, &existingShot, &existingThr)
	status := r.Status
	remark := r.Remark
	shot := r.ScreenshotRef
	thr := r.ThresholdText
	if err == nil {
		if existingStatus != "" && existingStatus != "pending" {
			status = existingStatus
		}
		if status == "" {
			status = existingStatus
		}
		if existingRemark != "" {
			remark = existingRemark
		}
		if remark == "" {
			remark = existingRemark
		}
		if existingShot != "" {
			shot = existingShot
		}
		if shot == "" {
			shot = existingShot
		}
		if existingThr != "" {
			thr = existingThr
		}
		if thr == "" {
			thr = existingThr
		}
		_, err = s.DB.Exec(`UPDATE notes SET status=?, remark=?, screenshot_ref=?, threshold_note=?, updated_at=? WHERE unified_name=? AND spec_model=?`,
			status, remark, shot, thr, now, r.UnifiedName, r.SpecModel)
	} else {
		_, err = s.DB.Exec(`INSERT INTO notes(unified_name, spec_model, status, remark, screenshot_ref, threshold_note, updated_at) VALUES(?,?,?,?,?,?,?)`,
			r.UnifiedName, r.SpecModel, status, remark, shot, thr, now)
	}
	return err
}

func (s *Store) SaveRemarks(rs []model.RemarkStatus) error {
	now := time.Now().Format(time.RFC3339)
	for _, r := range rs {
		var existingStatus, existingRemark, existingShot, existingThr string
		err := s.DB.QueryRow(`SELECT status, remark, screenshot_ref, threshold_note FROM notes WHERE unified_name=? AND spec_model=?`,
			r.UnifiedName, r.SpecModel).Scan(&existingStatus, &existingRemark, &existingShot, &existingThr)
		status := r.Status
		remark := r.Remark
		shot := r.ScreenshotRef
		thr := r.ThresholdNote
		upd := now
		if !r.UpdatedAt.IsZero() {
			upd = r.UpdatedAt.Format(time.RFC3339)
		}
		if err == nil {
			if existingStatus != "" && existingStatus != "pending" {
				status = existingStatus
			}
			if status == "" {
				status = existingStatus
			}
			if existingRemark != "" {
				remark = existingRemark
			}
			if remark == "" {
				remark = existingRemark
			}
			if existingShot != "" {
				shot = existingShot
			}
			if shot == "" {
				shot = existingShot
			}
			if existingThr != "" {
				thr = existingThr
			}
			if thr == "" {
				thr = existingThr
			}
			_, err = s.DB.Exec(`UPDATE notes SET status=?, remark=?, screenshot_ref=?, threshold_note=?, updated_at=? WHERE unified_name=? AND spec_model=?`,
				status, remark, shot, thr, upd, r.UnifiedName, r.SpecModel)
		} else {
			_, err = s.DB.Exec(`INSERT INTO notes(unified_name, spec_model, status, remark, screenshot_ref, threshold_note, updated_at) VALUES(?,?,?,?,?,?,?)`,
				r.UnifiedName, r.SpecModel, status, remark, shot, thr, upd)
		}
		if err != nil {
			return fmt.Errorf("upsert remark %s/%s: %w", r.UnifiedName, r.SpecModel, err)
		}
	}
	return nil
}

func (s *Store) GetNote(unified, spec string) (*model.RemarkStatus, error) {
	var (
		status, remark, shot, thr, updated string
	)
	err := s.DB.QueryRow(`SELECT status, remark, screenshot_ref, threshold_note, updated_at FROM notes WHERE unified_name=? AND spec_model=?`,
		unified, spec).Scan(&status, &remark, &shot, &thr, &updated)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	t, _ := time.Parse(time.RFC3339, updated)
	return &model.RemarkStatus{
		UnifiedName:   unified,
		SpecModel:     spec,
		Status:        status,
		Remark:        remark,
		ScreenshotRef: shot,
		ThresholdNote: thr,
		UpdatedAt:     t,
	}, nil
}

type RunSummary struct {
	ID      int64
	Tag     string
	When    string
	Summary string
	Total   int
	Anomaly int
}

func (s *Store) ListRuns() ([]RunSummary, error) {
	rows, err := s.DB.Query(`
		SELECT r.id, r.tag, r.created_at, r.summary,
			(SELECT COUNT(*) FROM schedule_records sr WHERE sr.run_id=r.id),
			(SELECT COUNT(*) FROM anomalies a WHERE a.run_id=r.id)
		FROM runs r ORDER BY r.id DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []RunSummary
	for rows.Next() {
		var rs RunSummary
		if err := rows.Scan(&rs.ID, &rs.Tag, &rs.When, &rs.Summary, &rs.Total, &rs.Anomaly); err != nil {
			return nil, err
		}
		out = append(out, rs)
	}
	return out, nil
}

type AnomalyRow struct {
	ID             int64
	UnifiedName    string
	Reasons        string
	RawSourceQuote string
	Status         string
	Remark         string
	ScreenshotRef  string
	DeltaFromPrev  string
	DaysLate       int64
	WillMakeWindow int
	ETA            string
	DowntimeStart  string
	RequiredQty    int64
	ArrivedQty     int64
}

func (s *Store) ListAnomalies(runID int64) ([]AnomalyRow, error) {
	rows, err := s.DB.Query(`SELECT a.id, a.unified_name, a.reasons, a.raw_source_quote,
		a.status, a.remark, a.screenshot_ref, a.delta_from_prev,
		sr.days_late, sr.will_make_window, sr.eta, sr.downtime_start,
		sr.required_qty, sr.arrived_qty
	FROM anomalies a
	INNER JOIN schedule_records sr ON sr.id = a.record_id
	WHERE a.run_id=? ORDER BY a.id`, runID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []AnomalyRow
	for rows.Next() {
		var r AnomalyRow
		if err := rows.Scan(&r.ID, &r.UnifiedName, &r.Reasons, &r.RawSourceQuote,
			&r.Status, &r.Remark, &r.ScreenshotRef, &r.DeltaFromPrev,
			&r.DaysLate, &r.WillMakeWindow, &r.ETA, &r.DowntimeStart,
			&r.RequiredQty, &r.ArrivedQty); err != nil {
			return nil, err
		}
		out = append(out, r)
	}
	return out, nil
}
