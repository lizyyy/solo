package diagnostic

import (
	"database/sql"
	"os"
	"testing"

	_ "modernc.org/sqlite"
)

func setupTestDB(t *testing.T) *sql.DB {
	dbPath := "./test_diagnostic.db"
	os.Remove(dbPath)

	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		t.Fatalf("Failed to open test database: %v", err)
	}

	schema := []string{
		`CREATE TABLE IF NOT EXISTS services (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT UNIQUE NOT NULL,
			description TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS routes (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			service_id INTEGER NOT NULL,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			description TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS middlewares (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			type TEXT NOT NULL,
			description TEXT,
			config TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS route_middlewares (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			route_id INTEGER NOT NULL,
			middleware_id INTEGER NOT NULL,
			position INTEGER NOT NULL,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS request_traces (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trace_id TEXT NOT NULL,
			service_id INTEGER,
			route_id INTEGER,
			method TEXT NOT NULL,
			path TEXT NOT NULL,
			headers TEXT,
			body_read_count INTEGER DEFAULT 0,
			status_code INTEGER,
			response_body TEXT,
			start_time TIMESTAMP,
			end_time TIMESTAMP,
			duration_ms INTEGER,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS context_events (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			trace_id TEXT NOT NULL,
			middleware_name TEXT,
			event_type TEXT NOT NULL,
			key TEXT,
			value TEXT,
			old_value TEXT,
			timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS diagnostic_rules (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			category TEXT NOT NULL,
			severity TEXT NOT NULL,
			description TEXT,
			check_logic TEXT,
			is_enabled BOOLEAN DEFAULT TRUE,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
		`CREATE TABLE IF NOT EXISTS risks (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			rule_id INTEGER NOT NULL,
			route_id INTEGER,
			trace_id TEXT,
			status TEXT DEFAULT 'new',
			evidence TEXT,
			impact TEXT,
			suggestion TEXT,
			created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
		)`,
	}

	for _, stmt := range schema {
		if _, err := db.Exec(stmt); err != nil {
			t.Fatalf("Failed to create schema: %v", err)
		}
	}

	return db
}

func teardownTestDB(t *testing.T, db *sql.DB) {
	db.Close()
	os.Remove("./test_diagnostic.db")
}

func TestInitializeRules(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	var count int
	err := db.QueryRow("SELECT COUNT(*) FROM diagnostic_rules").Scan(&count)
	if err != nil {
		t.Fatalf("Failed to count rules: %v", err)
	}

	if count != 10 {
		t.Errorf("Expected 10 rules, got %d", count)
	}
}

func TestCheckRecoverPosition_NoRecover(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	_, err := db.Exec(`INSERT INTO services (name) VALUES ('test-service')`)
	if err != nil {
		t.Fatalf("Failed to insert service: %v", err)
	}

	_, err = db.Exec(`INSERT INTO routes (service_id, method, path) VALUES (1, 'GET', '/api/test')`)
	if err != nil {
		t.Fatalf("Failed to insert route: %v", err)
	}

	_, err = db.Exec(`INSERT INTO middlewares (name, type) VALUES ('auth-test', 'auth')`)
	if err != nil {
		t.Fatalf("Failed to insert middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO route_middlewares (route_id, middleware_id, position) VALUES (1, 1, 0)`)
	if err != nil {
		t.Fatalf("Failed to link middleware: %v", err)
	}

	risks, err := engine.GetAllRisks("")
	if err != nil {
		t.Fatalf("Failed to get risks: %v", err)
	}

	if len(risks) != 0 {
		t.Errorf("Expected 0 risks before diagnostics, got %d", len(risks))
	}

	result, err := engine.RunAllDiagnostics()
	if err != nil {
		t.Fatalf("Failed to run diagnostics: %v", err)
	}

	if result.TotalRisks == 0 {
		t.Error("Expected at least 1 risk (no recover middleware), got 0")
	}
}

func TestCheckRecoverPosition_WrongPosition(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	_, err := db.Exec(`INSERT INTO services (name) VALUES ('test-service')`)
	if err != nil {
		t.Fatalf("Failed to insert service: %v", err)
	}

	_, err = db.Exec(`INSERT INTO routes (service_id, method, path) VALUES (1, 'GET', '/api/test')`)
	if err != nil {
		t.Fatalf("Failed to insert route: %v", err)
	}

	_, err = db.Exec(`INSERT INTO middlewares (name, type) VALUES ('auth-test', 'auth')`)
	if err != nil {
		t.Fatalf("Failed to insert middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO middlewares (name, type) VALUES ('recover-test', 'recover')`)
	if err != nil {
		t.Fatalf("Failed to insert middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO route_middlewares (route_id, middleware_id, position) VALUES (1, 1, 0)`)
	if err != nil {
		t.Fatalf("Failed to link middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO route_middlewares (route_id, middleware_id, position) VALUES (1, 2, 1)`)
	if err != nil {
		t.Fatalf("Failed to link middleware: %v", err)
	}

	result, err := engine.RunAllDiagnostics()
	if err != nil {
		t.Fatalf("Failed to run diagnostics: %v", err)
	}

	foundWrongPosition := false
	for _, risk := range result.Risks {
		if risk.Rule != nil && risk.Rule.Name == "recover_not_outermost" {
			if risk.Evidence != "" && (risk.Evidence != "路由 GET /api/test 没有配置 recover 中间件") {
				foundWrongPosition = true
			}
		}
	}

	if !foundWrongPosition {
		t.Error("Expected to find risk for recover in wrong position")
	}
}

func TestCheckCORSBeforeAuth_WrongOrder(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	_, err := db.Exec(`INSERT INTO services (name) VALUES ('test-service')`)
	if err != nil {
		t.Fatalf("Failed to insert service: %v", err)
	}

	_, err = db.Exec(`INSERT INTO routes (service_id, method, path) VALUES (1, 'OPTIONS', '/api/test')`)
	if err != nil {
		t.Fatalf("Failed to insert route: %v", err)
	}

	_, err = db.Exec(`INSERT INTO middlewares (name, type) VALUES ('auth-test', 'auth')`)
	if err != nil {
		t.Fatalf("Failed to insert middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO middlewares (name, type) VALUES ('cors-test', 'cors')`)
	if err != nil {
		t.Fatalf("Failed to insert middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO route_middlewares (route_id, middleware_id, position) VALUES (1, 1, 0)`)
	if err != nil {
		t.Fatalf("Failed to link middleware: %v", err)
	}

	_, err = db.Exec(`INSERT INTO route_middlewares (route_id, middleware_id, position) VALUES (1, 2, 1)`)
	if err != nil {
		t.Fatalf("Failed to link middleware: %v", err)
	}

	result, err := engine.RunAllDiagnostics()
	if err != nil {
		t.Fatalf("Failed to run diagnostics: %v", err)
	}

	foundCORSIssue := false
	for _, risk := range result.Risks {
		if risk.Rule != nil && risk.Rule.Name == "cors_preflight_blocked_by_auth" {
			foundCORSIssue = true
		}
	}

	if !foundCORSIssue {
		t.Error("Expected to find risk for CORS after auth")
	}
}

func TestUpdateRiskStatus(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	result, err := db.Exec(`INSERT INTO diagnostic_rules (name, category, severity, check_logic) VALUES ('test-rule', 'test', 'high', 'test')`)
	if err != nil {
		t.Fatalf("Failed to insert rule: %v", err)
	}
	ruleID, _ := result.LastInsertId()

	result, err = db.Exec(`INSERT INTO risks (rule_id, status, evidence, impact, suggestion) VALUES (?, 'new', 'test evidence', 'test impact', 'test suggestion')`, ruleID)
	if err != nil {
		t.Fatalf("Failed to insert risk: %v", err)
	}
	riskID, _ := result.LastInsertId()

	if err := engine.UpdateRiskStatus(riskID, "confirmed"); err != nil {
		t.Fatalf("Failed to update risk status: %v", err)
	}

	var status string
	err = db.QueryRow("SELECT status FROM risks WHERE id = ?", riskID).Scan(&status)
	if err != nil {
		t.Fatalf("Failed to query risk: %v", err)
	}

	if status != "confirmed" {
		t.Errorf("Expected status 'confirmed', got '%s'", status)
	}
}

func TestUpdateRiskStatus_InvalidStatus(t *testing.T) {
	db := setupTestDB(t)
	defer teardownTestDB(t, db)

	engine := NewEngine(db)
	if err := engine.InitializeRules(); err != nil {
		t.Fatalf("Failed to initialize rules: %v", err)
	}

	err := engine.UpdateRiskStatus(1, "invalid_status")
	if err == nil {
		t.Error("Expected error for invalid status, got nil")
	}
}
