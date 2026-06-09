from .config import DB_PATH, ensure_dirs
import sqlite3
from contextlib import contextmanager

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS pets (
    pet_id          TEXT PRIMARY KEY,
    pet_name        TEXT NOT NULL,
    species         TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vaccine_photos (
    photo_id        TEXT PRIMARY KEY,
    pet_id          TEXT NOT NULL,
    source_id       TEXT NOT NULL UNIQUE,
    batch           TEXT,
    file_path       TEXT NOT NULL,
    upload_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
);

CREATE TABLE IF NOT EXISTS medications (
    med_id          TEXT PRIMARY KEY,
    pet_id          TEXT NOT NULL,
    source_id       TEXT NOT NULL UNIQUE,
    med_name        TEXT NOT NULL,
    dosage          TEXT NOT NULL,
    frequency       TEXT,
    start_date      DATE,
    end_date        DATE,
    import_time     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
);

CREATE TABLE IF NOT EXISTS vaccine_medication_relations (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id        TEXT,
    med_id          TEXT,
    pet_id          TEXT NOT NULL,
    relation_type   TEXT NOT NULL,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(photo_id, med_id, relation_type),
    FOREIGN KEY (photo_id) REFERENCES vaccine_photos(photo_id),
    FOREIGN KEY (med_id) REFERENCES medications(med_id),
    FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
);

CREATE TABLE IF NOT EXISTS temp_alerts (
    alert_id        TEXT PRIMARY KEY,
    pet_id          TEXT NOT NULL,
    source_id       TEXT NOT NULL UNIQUE,
    alert_time      TIMESTAMP NOT NULL,
    temperature_c   REAL NOT NULL,
    status          TEXT NOT NULL DEFAULT 'PENDING',
    conclusion      TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (pet_id) REFERENCES pets(pet_id)
);

CREATE TABLE IF NOT EXISTS alert_status_history (
    history_id      INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id        TEXT NOT NULL,
    old_status      TEXT,
    new_status      TEXT NOT NULL,
    reason          TEXT,
    author          TEXT NOT NULL,
    changed_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (alert_id) REFERENCES temp_alerts(alert_id)
);

CREATE TABLE IF NOT EXISTS alert_notes (
    note_id         INTEGER PRIMARY KEY AUTOINCREMENT,
    alert_id        TEXT NOT NULL,
    note_content    TEXT NOT NULL,
    author          TEXT NOT NULL,
    source_note_id  TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(alert_id, author, source_note_id),
    FOREIGN KEY (alert_id) REFERENCES temp_alerts(alert_id)
);
"""


@contextmanager
def get_conn():
    ensure_dirs()
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def init_db():
    ensure_dirs()
    with get_conn() as conn:
        conn.executescript(SCHEMA_SQL)
