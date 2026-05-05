package storage

const (
	createAnalysisRunsTable = `
	CREATE TABLE IF NOT EXISTS analysis_runs (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		name TEXT NOT NULL,
		start_time DATETIME NOT NULL,
		end_time DATETIME,
		status TEXT NOT NULL DEFAULT 'running',
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
	);`

	createSyncPrimitivesTable = `
	CREATE TABLE IF NOT EXISTS sync_primitives (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		name TEXT NOT NULL,
		location TEXT,
		file TEXT,
		line INTEGER,
		declaration TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
	);`

	createSyncEventsTable = `
	CREATE TABLE IF NOT EXISTS sync_events (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id INTEGER NOT NULL,
		primitive_id INTEGER,
		event_type TEXT NOT NULL,
		primitive_name TEXT NOT NULL,
		primitive_type TEXT NOT NULL,
		goroutine_id INTEGER NOT NULL,
		timestamp DATETIME NOT NULL,
		location TEXT,
		file TEXT,
		line INTEGER,
		details TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (run_id) REFERENCES analysis_runs(id),
		FOREIGN KEY (primitive_id) REFERENCES sync_primitives(id)
	);`

	createIssuesTable = `
	CREATE TABLE IF NOT EXISTS issues (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		run_id INTEGER NOT NULL,
		type TEXT NOT NULL,
		severity TEXT NOT NULL,
		title TEXT NOT NULL,
		description TEXT,
		location TEXT,
		file TEXT,
		line INTEGER,
		code_snippet TEXT,
		suggestion TEXT,
		references TEXT,
		created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
		FOREIGN KEY (run_id) REFERENCES analysis_runs(id)
	);`

	createIndexes = `
	CREATE INDEX IF NOT EXISTS idx_analysis_runs_name ON analysis_runs(name);
	CREATE INDEX IF NOT EXISTS idx_analysis_runs_start_time ON analysis_runs(start_time);
	
	CREATE INDEX IF NOT EXISTS idx_sync_primitives_run_id ON sync_primitives(run_id);
	CREATE INDEX IF NOT EXISTS idx_sync_primitives_type ON sync_primitives(type);
	
	CREATE INDEX IF NOT EXISTS idx_sync_events_run_id ON sync_events(run_id);
	CREATE INDEX IF NOT EXISTS idx_sync_events_primitive_id ON sync_events(primitive_id);
	CREATE INDEX IF NOT EXISTS idx_sync_events_timestamp ON sync_events(timestamp);
	
	CREATE INDEX IF NOT EXISTS idx_issues_run_id ON issues(run_id);
	CREATE INDEX IF NOT EXISTS idx_issues_type ON issues(type);
	CREATE INDEX IF NOT EXISTS idx_issues_severity ON issues(severity);
	`
)
