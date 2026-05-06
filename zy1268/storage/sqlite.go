package storage

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"time"

	_ "modernc.org/sqlite"
)

type DB struct {
	*sql.DB
}

// Stacktrace 记录 goroutine stacktrace
type Stacktrace struct {
	ID          int64
	Timestamp   time.Time
	GoroutineID int
	Status      string // running, waiting, syscall, etc.
	Frames      string // JSON encoded stack frames
	Raw         string // 原始 stacktrace 文本
	SourceFile  string // 来源文件路径
}

// Schedtrace 记录调度追踪
type Schedtrace struct {
	ID              int64
	Timestamp       time.Time
	GOMAXPROCS      int
	IdleProcs       int
	Threads         int
	SpinningThreads int
	IdleThreads     int
	RunQueue        int
	PerProcRunQ     string // JSON encoded per-proc runqueue
	Raw             string
	SourceFile      string
}

// SchedGoroutine 记录 schedtrace 中的单个 goroutine 状态
type SchedGoroutine struct {
	ID           int64
	SchedtraceID int64
	GoroutineID  int
	Status       string // running, runnable, waiting, syscall
	Function     string
	Latency      int64 // 微秒
	Tick         int64
}

// PreemptEvent 记录抢占事件
type PreemptEvent struct {
	ID          int64
	Timestamp   time.Time
	GoroutineID int
	EventType   string // async_preempt, stack_growth, nosplit_call, syscall_block
	Reason      string
	Duration    int64  // 微秒
	Details     string // JSON encoded details
	Raw         string
	SourceFile  string
}

// StackGrowth 记录栈增长/收缩事件
type StackGrowth struct {
	ID             int64
	PreemptEventID int64
	OldSize        int64  // 字节
	NewSize        int64  // 字节
	GrowthType     string // growth, shrink
}

// NosplitCall 记录 nosplit 调用
type NosplitCall struct {
	ID             int64
	PreemptEventID int64
	Function       string
	FrameCount     int
}

// SyscallBlock 记录系统调用阻塞
type SyscallBlock struct {
	ID             int64
	PreemptEventID int64
	SyscallName    string
}

// CodeSnippet 记录代码片段
type CodeSnippet struct {
	ID         int64
	FilePath   string
	Content    string
	Issues     string // JSON encoded detected issues
	ImportedAt time.Time
}

// BenchmarkResult 记录 benchmark 结果
type BenchmarkResult struct {
	ID          int64
	Timestamp   time.Time
	TestName    string
	Iterations  int64
	NsPerOp     int64
	BytesPerOp  int64
	AllocsPerOp int64
	GoOS        string
	GoArch      string
	CPU         string
	Raw         string
	SourceFile  string
}

// AnalysisReport 分析报告摘要
type AnalysisReport struct {
	ID              int64
	CreatedAt       time.Time
	DataSources     string // JSON encoded data sources
	Findings        string // JSON encoded findings
	Recommendations string // JSON encoded recommendations
}

// InitDB 初始化数据库
func InitDB(dbPath string) (*DB, error) {
	// 确保目录存在
	dir := filepath.Dir(dbPath)
	if dir != "." && dir != "" {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return nil, fmt.Errorf("创建数据库目录失败: %w", err)
		}
	}

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("打开数据库失败: %w", err)
	}

	// 启用外键约束
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		db.Close()
		return nil, fmt.Errorf("启用外键约束失败: %w", err)
	}

	// 创建表
	if err := createTables(db); err != nil {
		db.Close()
		return nil, err
	}

	return &DB{db}, nil
}

func createTables(db *sql.DB) error {
	schemas := []string{
		`CREATE TABLE IF NOT EXISTS stacktraces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			goroutine_id INTEGER NOT NULL,
			status TEXT NOT NULL,
			frames TEXT,
			raw TEXT NOT NULL,
			source_file TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS schedtraces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			gomaxprocs INTEGER NOT NULL,
			idle_procs INTEGER NOT NULL,
			threads INTEGER NOT NULL,
			spinning_threads INTEGER NOT NULL,
			idle_threads INTEGER NOT NULL,
			run_queue INTEGER NOT NULL,
			per_proc_runq TEXT,
			raw TEXT NOT NULL,
			source_file TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS sched_goroutines (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			schedtrace_id INTEGER NOT NULL,
			goroutine_id INTEGER NOT NULL,
			status TEXT NOT NULL,
			function TEXT,
			latency INTEGER NOT NULL DEFAULT 0,
			tick INTEGER,
			FOREIGN KEY (schedtrace_id) REFERENCES schedtraces(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS preempt_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			goroutine_id INTEGER NOT NULL,
			event_type TEXT NOT NULL,
			reason TEXT,
			duration INTEGER NOT NULL DEFAULT 0,
			details TEXT,
			raw TEXT,
			source_file TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS stack_growths (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			preempt_event_id INTEGER NOT NULL,
			old_size INTEGER NOT NULL,
			new_size INTEGER NOT NULL,
			growth_type TEXT NOT NULL,
			FOREIGN KEY (preempt_event_id) REFERENCES preempt_events(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS nosplit_calls (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			preempt_event_id INTEGER NOT NULL,
			function TEXT NOT NULL,
			frame_count INTEGER NOT NULL,
			FOREIGN KEY (preempt_event_id) REFERENCES preempt_events(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS syscall_blocks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			preempt_event_id INTEGER NOT NULL,
			syscall_name TEXT NOT NULL,
			FOREIGN KEY (preempt_event_id) REFERENCES preempt_events(id) ON DELETE CASCADE
		)`,
		`CREATE TABLE IF NOT EXISTS code_snippets (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			file_path TEXT NOT NULL,
			content TEXT NOT NULL,
			issues TEXT,
			imported_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS benchmark_results (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			test_name TEXT NOT NULL,
			iterations INTEGER NOT NULL,
			ns_per_op INTEGER NOT NULL,
			bytes_per_op INTEGER NOT NULL,
			allocs_per_op INTEGER NOT NULL,
			goos TEXT,
			goarch TEXT,
			cpu TEXT,
			raw TEXT NOT NULL,
			source_file TEXT
		)`,
		`CREATE TABLE IF NOT EXISTS analysis_reports (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
			data_sources TEXT,
			findings TEXT,
			recommendations TEXT
		)`,
		// 索引
		`CREATE INDEX IF NOT EXISTS idx_stacktraces_goroutine ON stacktraces(goroutine_id)`,
		`CREATE INDEX IF NOT EXISTS idx_stacktraces_timestamp ON stacktraces(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_schedtraces_timestamp ON schedtraces(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_sched_goroutines_schedtrace ON sched_goroutines(schedtrace_id)`,
		`CREATE INDEX IF NOT EXISTS idx_preempt_events_goroutine ON preempt_events(goroutine_id)`,
		`CREATE INDEX IF NOT EXISTS idx_preempt_events_timestamp ON preempt_events(timestamp)`,
		`CREATE INDEX IF NOT EXISTS idx_preempt_events_type ON preempt_events(event_type)`,
		`CREATE INDEX IF NOT EXISTS idx_benchmarks_name ON benchmark_results(test_name)`,
	}

	for _, schema := range schemas {
		if _, err := db.Exec(schema); err != nil {
			return fmt.Errorf("创建表失败: %w", err)
		}
	}

	return nil
}

// 插入方法

// InsertStacktrace 插入 stacktrace
func (db *DB) InsertStacktrace(s *Stacktrace) error {
	result, err := db.Exec(
		`INSERT INTO stacktraces (timestamp, goroutine_id, status, frames, raw, source_file)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		s.Timestamp, s.GoroutineID, s.Status, s.Frames, s.Raw, s.SourceFile,
	)
	if err != nil {
		return err
	}
	s.ID, err = result.LastInsertId()
	return err
}

// InsertSchedtrace 插入 schedtrace
func (db *DB) InsertSchedtrace(s *Schedtrace) (int64, error) {
	result, err := db.Exec(
		`INSERT INTO schedtraces (timestamp, gomaxprocs, idle_procs, threads, 
		 spinning_threads, idle_threads, run_queue, per_proc_runq, raw, source_file)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		s.Timestamp, s.GOMAXPROCS, s.IdleProcs, s.Threads,
		s.SpinningThreads, s.IdleThreads, s.RunQueue, s.PerProcRunQ, s.Raw, s.SourceFile,
	)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	s.ID = id
	return id, err
}

// InsertSchedGoroutine 插入 sched goroutine
func (db *DB) InsertSchedGoroutine(s *SchedGoroutine) error {
	result, err := db.Exec(
		`INSERT INTO sched_goroutines (schedtrace_id, goroutine_id, status, function, latency, tick)
		 VALUES (?, ?, ?, ?, ?, ?)`,
		s.SchedtraceID, s.GoroutineID, s.Status, s.Function, s.Latency, s.Tick,
	)
	if err != nil {
		return err
	}
	s.ID, err = result.LastInsertId()
	return err
}

// InsertPreemptEvent 插入抢占事件
func (db *DB) InsertPreemptEvent(e *PreemptEvent) (int64, error) {
	result, err := db.Exec(
		`INSERT INTO preempt_events (timestamp, goroutine_id, event_type, reason, duration, details, raw, source_file)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		e.Timestamp, e.GoroutineID, e.EventType, e.Reason, e.Duration, e.Details, e.Raw, e.SourceFile,
	)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	e.ID = id
	return id, err
}

// InsertStackGrowth 插入栈增长事件
func (db *DB) InsertStackGrowth(s *StackGrowth) error {
	result, err := db.Exec(
		`INSERT INTO stack_growths (preempt_event_id, old_size, new_size, growth_type)
		 VALUES (?, ?, ?, ?)`,
		s.PreemptEventID, s.OldSize, s.NewSize, s.GrowthType,
	)
	if err != nil {
		return err
	}
	s.ID, err = result.LastInsertId()
	return err
}

// InsertNosplitCall 插入 nosplit 调用
func (db *DB) InsertNosplitCall(n *NosplitCall) error {
	result, err := db.Exec(
		`INSERT INTO nosplit_calls (preempt_event_id, function, frame_count)
		 VALUES (?, ?, ?)`,
		n.PreemptEventID, n.Function, n.FrameCount,
	)
	if err != nil {
		return err
	}
	n.ID, err = result.LastInsertId()
	return err
}

// InsertSyscallBlock 插入系统调用阻塞
func (db *DB) InsertSyscallBlock(s *SyscallBlock) error {
	result, err := db.Exec(
		`INSERT INTO syscall_blocks (preempt_event_id, syscall_name)
		 VALUES (?, ?)`,
		s.PreemptEventID, s.SyscallName,
	)
	if err != nil {
		return err
	}
	s.ID, err = result.LastInsertId()
	return err
}

// InsertCodeSnippet 插入代码片段
func (db *DB) InsertCodeSnippet(c *CodeSnippet) error {
	result, err := db.Exec(
		`INSERT INTO code_snippets (file_path, content, issues, imported_at)
		 VALUES (?, ?, ?, ?)`,
		c.FilePath, c.Content, c.Issues, c.ImportedAt,
	)
	if err != nil {
		return err
	}
	c.ID, err = result.LastInsertId()
	return err
}

// InsertBenchmarkResult 插入 benchmark 结果
func (db *DB) InsertBenchmarkResult(b *BenchmarkResult) error {
	result, err := db.Exec(
		`INSERT INTO benchmark_results (timestamp, test_name, iterations, ns_per_op, 
		 bytes_per_op, allocs_per_op, goos, goarch, cpu, raw, source_file)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		b.Timestamp, b.TestName, b.Iterations, b.NsPerOp,
		b.BytesPerOp, b.AllocsPerOp, b.GoOS, b.GoArch, b.CPU, b.Raw, b.SourceFile,
	)
	if err != nil {
		return err
	}
	b.ID, err = result.LastInsertId()
	return err
}

// InsertAnalysisReport 插入分析报告
func (db *DB) InsertAnalysisReport(r *AnalysisReport) error {
	result, err := db.Exec(
		`INSERT INTO analysis_reports (created_at, data_sources, findings, recommendations)
		 VALUES (?, ?, ?, ?)`,
		r.CreatedAt, r.DataSources, r.Findings, r.Recommendations,
	)
	if err != nil {
		return err
	}
	r.ID, err = result.LastInsertId()
	return err
}

// 查询方法

// GetAllStacktraces 获取所有 stacktrace
func (db *DB) GetAllStacktraces() ([]Stacktrace, error) {
	rows, err := db.Query(
		`SELECT id, timestamp, goroutine_id, status, frames, raw, source_file
		 FROM stacktraces ORDER BY timestamp DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []Stacktrace
	for rows.Next() {
		var s Stacktrace
		err := rows.Scan(&s.ID, &s.Timestamp, &s.GoroutineID, &s.Status, &s.Frames, &s.Raw, &s.SourceFile)
		if err != nil {
			return nil, err
		}
		traces = append(traces, s)
	}
	return traces, nil
}

// GetAllPreemptEvents 获取所有抢占事件
func (db *DB) GetAllPreemptEvents() ([]PreemptEvent, error) {
	rows, err := db.Query(
		`SELECT id, timestamp, goroutine_id, event_type, reason, duration, details, raw, source_file
		 FROM preempt_events ORDER BY timestamp DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var events []PreemptEvent
	for rows.Next() {
		var e PreemptEvent
		err := rows.Scan(&e.ID, &e.Timestamp, &e.GoroutineID, &e.EventType, &e.Reason, &e.Duration, &e.Details, &e.Raw, &e.SourceFile)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	return events, nil
}

// GetStackGrowths 获取栈增长事件
func (db *DB) GetStackGrowths() ([]StackGrowth, error) {
	rows, err := db.Query(
		`SELECT id, preempt_event_id, old_size, new_size, growth_type
		 FROM stack_growths ORDER BY id`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var growths []StackGrowth
	for rows.Next() {
		var s StackGrowth
		err := rows.Scan(&s.ID, &s.PreemptEventID, &s.OldSize, &s.NewSize, &s.GrowthType)
		if err != nil {
			return nil, err
		}
		growths = append(growths, s)
	}
	return growths, nil
}

// GetAllSchedtraces 获取所有 schedtrace
func (db *DB) GetAllSchedtraces() ([]Schedtrace, error) {
	rows, err := db.Query(
		`SELECT id, timestamp, gomaxprocs, idle_procs, threads, spinning_threads, 
		 idle_threads, run_queue, per_proc_runq, raw, source_file
		 FROM schedtraces ORDER BY timestamp DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var traces []Schedtrace
	for rows.Next() {
		var s Schedtrace
		err := rows.Scan(&s.ID, &s.Timestamp, &s.GOMAXPROCS, &s.IdleProcs, &s.Threads, &s.SpinningThreads,
			&s.IdleThreads, &s.RunQueue, &s.PerProcRunQ, &s.Raw, &s.SourceFile)
		if err != nil {
			return nil, err
		}
		traces = append(traces, s)
	}
	return traces, nil
}

// GetSchedGoroutinesByTraceID 获取指定 schedtrace 的 goroutines
func (db *DB) GetSchedGoroutinesByTraceID(traceID int64) ([]SchedGoroutine, error) {
	rows, err := db.Query(
		`SELECT id, schedtrace_id, goroutine_id, status, function, latency, tick
		 FROM sched_goroutines WHERE schedtrace_id = ?`,
		traceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var goroutines []SchedGoroutine
	for rows.Next() {
		var g SchedGoroutine
		err := rows.Scan(&g.ID, &g.SchedtraceID, &g.GoroutineID, &g.Status, &g.Function, &g.Latency, &g.Tick)
		if err != nil {
			return nil, err
		}
		goroutines = append(goroutines, g)
	}
	return goroutines, nil
}

// GetAllBenchmarks 获取所有 benchmark 结果
func (db *DB) GetAllBenchmarks() ([]BenchmarkResult, error) {
	rows, err := db.Query(
		`SELECT id, timestamp, test_name, iterations, ns_per_op, bytes_per_op, 
		 allocs_per_op, goos, goarch, cpu, raw, source_file
		 FROM benchmark_results ORDER BY timestamp DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []BenchmarkResult
	for rows.Next() {
		var b BenchmarkResult
		err := rows.Scan(&b.ID, &b.Timestamp, &b.TestName, &b.Iterations, &b.NsPerOp, &b.BytesPerOp,
			&b.AllocsPerOp, &b.GoOS, &b.GoArch, &b.CPU, &b.Raw, &b.SourceFile)
		if err != nil {
			return nil, err
		}
		results = append(results, b)
	}
	return results, nil
}

// GetAllSnippets 获取所有代码片段
func (db *DB) GetAllSnippets() ([]CodeSnippet, error) {
	rows, err := db.Query(
		`SELECT id, file_path, content, issues, imported_at
		 FROM code_snippets ORDER BY imported_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var snippets []CodeSnippet
	for rows.Next() {
		var s CodeSnippet
		err := rows.Scan(&s.ID, &s.FilePath, &s.Content, &s.Issues, &s.ImportedAt)
		if err != nil {
			return nil, err
		}
		snippets = append(snippets, s)
	}
	return snippets, nil
}

// GetAllReports 获取所有分析报告
func (db *DB) GetAllReports() ([]AnalysisReport, error) {
	rows, err := db.Query(
		`SELECT id, created_at, data_sources, findings, recommendations
		 FROM analysis_reports ORDER BY created_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []AnalysisReport
	for rows.Next() {
		var r AnalysisReport
		err := rows.Scan(&r.ID, &r.CreatedAt, &r.DataSources, &r.Findings, &r.Recommendations)
		if err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}

// 统计方法

// CountStacktraces 统计 stacktrace 数量
func (db *DB) CountStacktraces() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM stacktraces").Scan(&count)
	return count, err
}

// CountPreemptEvents 统计抢占事件数量
func (db *DB) CountPreemptEvents() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM preempt_events").Scan(&count)
	return count, err
}

// CountSchedtraces 统计 schedtrace 数量
func (db *DB) CountSchedtraces() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM schedtraces").Scan(&count)
	return count, err
}

// CountBenchmarks 统计 benchmark 数量
func (db *DB) CountBenchmarks() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM benchmark_results").Scan(&count)
	return count, err
}

// CountSnippets 统计代码片段数量
func (db *DB) CountSnippets() (int, error) {
	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM code_snippets").Scan(&count)
	return count, err
}
