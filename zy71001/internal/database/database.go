package database

import (
	"database/sql"
	"log"
	"time"

	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB(dbPath string) (*sql.DB, error) {
	var err error
	DB, err = sql.Open("sqlite3", dbPath)
	if err != nil {
		return nil, err
	}

	if err = DB.Ping(); err != nil {
		return nil, err
	}

	if err = createTables(); err != nil {
		return nil, err
	}

	log.Println("Database initialized successfully")
	return DB, nil
}

func createTables() error {
	statements := []string{
		"CREATE TABLE IF NOT EXISTS bases (id TEXT PRIMARY KEY, name TEXT NOT NULL, code TEXT NOT NULL UNIQUE, city TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)",
		"CREATE TABLE IF NOT EXISTS crew_members (id TEXT PRIMARY KEY, name TEXT NOT NULL, employee_no TEXT NOT NULL UNIQUE, base_id TEXT NOT NULL, position TEXT NOT NULL, phone TEXT, email TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (base_id) REFERENCES bases(id))",
		"CREATE TABLE IF NOT EXISTS flight_segments (id TEXT PRIMARY KEY, flight_no TEXT NOT NULL, departure_city TEXT NOT NULL, arrival_city TEXT NOT NULL, departure_time DATETIME NOT NULL, arrival_time DATETIME NOT NULL, actual_departure DATETIME, actual_arrival DATETIME, delay_minutes INTEGER DEFAULT 0, flight_date TEXT NOT NULL, crew_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (crew_id) REFERENCES crew_members(id))",
		"CREATE TABLE IF NOT EXISTS applications (id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, flight_segment_id TEXT, flight_no TEXT NOT NULL, flight_date TEXT NOT NULL, departure_time DATETIME NOT NULL, arrival_time DATETIME NOT NULL, delay_minutes INTEGER DEFAULT 0, compensation_type TEXT NOT NULL, compensation_hours REAL NOT NULL, status TEXT NOT NULL DEFAULT 'pending', idempotency_key TEXT NOT NULL UNIQUE, is_cross_base BOOLEAN DEFAULT false, rest_hours_after_landing REAL DEFAULT 0, rest_check_passed BOOLEAN DEFAULT true, match_score REAL DEFAULT 100, leader_approved_by TEXT, leader_approved_at DATETIME, supervisor_approved_by TEXT, supervisor_approved_at DATETIME, rejected_by TEXT, rejected_at DATETIME, reject_reason TEXT, remarks TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (crew_id) REFERENCES crew_members(id), FOREIGN KEY (flight_segment_id) REFERENCES flight_segments(id))",
		"CREATE TABLE IF NOT EXISTS compensation_summaries (id TEXT PRIMARY KEY, crew_id TEXT NOT NULL, period_start DATETIME NOT NULL, period_end DATETIME NOT NULL, total_hours REAL DEFAULT 0, approved_hours REAL DEFAULT 0, pending_hours REAL DEFAULT 0, rejected_hours REAL DEFAULT 0, application_count INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (crew_id) REFERENCES crew_members(id), UNIQUE(crew_id, period_start, period_end))",
		"CREATE TABLE IF NOT EXISTS processing_logs (id TEXT PRIMARY KEY, application_id TEXT NOT NULL, action TEXT NOT NULL, old_status TEXT, new_status TEXT, operator_id TEXT, operator_name TEXT, details TEXT, ip_address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (application_id) REFERENCES applications(id))",
		"CREATE INDEX IF NOT EXISTS idx_applications_idempotency_key ON applications(idempotency_key)",
		"CREATE INDEX IF NOT EXISTS idx_applications_crew_id ON applications(crew_id)",
		"CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)",
		"CREATE INDEX IF NOT EXISTS idx_flight_segments_flight_no ON flight_segments(flight_no)",
		"CREATE INDEX IF NOT EXISTS idx_processing_logs_application_id ON processing_logs(application_id)",
	}

	for _, stmt := range statements {
		_, err := DB.Exec(stmt)
		if err != nil {
			return err
		}
	}

	return nil
}

func GetNow() time.Time {
	return time.Now()
}
