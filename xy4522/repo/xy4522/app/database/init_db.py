from app.database.connection import get_db_connection


def init_database():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS plate_inventory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT UNIQUE NOT NULL,
            student_name TEXT,
            plate_type TEXT,
            plate_size TEXT,
            estimated_etching_time INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS acid_bath_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            bath_number TEXT NOT NULL,
            concentration REAL,
            temperature REAL,
            ventilation_status TEXT,
            record_time TIMESTAMP,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS color_separation (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            color_name TEXT,
            color_order INTEGER,
            etching_depth REAL,
            notes TEXT,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE(plate_number, color_order)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS test_print_photos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            photo_path TEXT NOT NULL,
            notes TEXT,
            print_order INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_appointments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            student_name TEXT,
            appointment_date DATE,
            start_time TIME,
            end_time TIME,
            bath_number TEXT,
            notes TEXT,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            issue_type TEXT NOT NULL,
            issue_description TEXT,
            severity TEXT DEFAULT 'warning',
            detected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_decisions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            issue_id INTEGER,
            decision_type TEXT NOT NULL,
            decision_reason TEXT,
            handler_name TEXT,
            decision_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (issue_id) REFERENCES review_issues(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processing_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            note_content TEXT,
            note_type TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS export_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            export_type TEXT NOT NULL,
            file_path TEXT NOT NULL,
            export_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            plate_count INTEGER
        )
    ''')

    conn.commit()
