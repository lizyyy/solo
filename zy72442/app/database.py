import sqlite3
from config import DB_PATH

def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_conn()
    c = conn.cursor()

    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS audio_notes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            track_name TEXT NOT NULL,
            file_path TEXT,
            duration REAL,
            has_leave_hours INTEGER DEFAULT 0,
            leave_hours_count INTEGER DEFAULT 0,
            original_leave_hours_count INTEGER DEFAULT 0,
            leave_hours_correction_note TEXT,
            original_note TEXT,
            imported_by INTEGER,
            imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_corrected_by INTEGER,
            last_corrected_at TIMESTAMP,
            FOREIGN KEY (imported_by) REFERENCES users(id),
            FOREIGN KEY (last_corrected_by) REFERENCES users(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS authorization_pages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_note_id INTEGER NOT NULL,
            authorization_number TEXT,
            valid_from DATE,
            valid_to DATE,
            page_content TEXT,
            uploaded_by INTEGER,
            uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (audio_note_id) REFERENCES audio_notes(id),
            FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS track_checklists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_note_id INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            reason_kept TEXT,
            missing_materials TEXT,
            missing_materials_source TEXT,
            leave_hours_count_used INTEGER,
            next_owner TEXT,
            next_action TEXT,
            data_source TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (audio_note_id) REFERENCES audio_notes(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS rework_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            audio_note_id INTEGER NOT NULL,
            checklist_id INTEGER,
            action_type TEXT NOT NULL,
            field_changed TEXT,
            old_value TEXT,
            new_value TEXT,
            reason TEXT NOT NULL,
            operator_id INTEGER NOT NULL,
            operator_name TEXT NOT NULL,
            affected_results TEXT,
            source_material TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (audio_note_id) REFERENCES audio_notes(id),
            FOREIGN KEY (checklist_id) REFERENCES track_checklists(id),
            FOREIGN KEY (operator_id) REFERENCES users(id)
        )
    ''')

    conn.commit()
    conn.close()
