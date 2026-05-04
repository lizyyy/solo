import sqlite3
from datetime import datetime
from config import DATABASE_PATH

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 作品表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pieces (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            piece_code TEXT UNIQUE NOT NULL,
            owner_name TEXT NOT NULL,
            height REAL NOT NULL,
            width REAL NOT NULL,
            depth REAL NOT NULL,
            clay_type TEXT NOT NULL,
            glaze_type TEXT NOT NULL,
            temperature_zone TEXT NOT NULL,
            payment_status TEXT NOT NULL,
            pickup_info TEXT,
            import_date TEXT NOT NULL,
            notes TEXT
        )
    ''')
    
    # 窑炉层板表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS kiln_shelves (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            shelf_number INTEGER NOT NULL,
            max_height REAL NOT NULL,
            temperature_zone TEXT NOT NULL,
            shelf_type TEXT,
            position_in_kiln TEXT,
            is_available INTEGER DEFAULT 1
        )
    ''')
    
    # 釉药禁忌表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS glaze_conflicts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            glaze_a TEXT NOT NULL,
            glaze_b TEXT NOT NULL,
            conflict_severity TEXT NOT NULL,
            conflict_description TEXT,
            is_mutual INTEGER DEFAULT 1
        )
    ''')
    
    # 窑次表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS kiln_batches (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_code TEXT UNIQUE NOT NULL,
            batch_name TEXT,
            target_temperature_zone TEXT NOT NULL,
            scheduled_date TEXT,
            actual_date TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')
    
    # 层板位置表（作品在层板上的安排）
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS shelf_placements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            piece_id INTEGER NOT NULL,
            shelf_id INTEGER NOT NULL,
            position_x REAL,
            position_y REAL,
            placement_order INTEGER,
            placed_at TEXT NOT NULL,
            FOREIGN KEY (batch_id) REFERENCES kiln_batches (id),
            FOREIGN KEY (piece_id) REFERENCES pieces (id),
            FOREIGN KEY (shelf_id) REFERENCES kiln_shelves (id),
            UNIQUE(batch_id, piece_id)
        )
    ''')
    
    # 复核记录表
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS review_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            batch_id INTEGER NOT NULL,
            piece_id INTEGER NOT NULL,
            check_type TEXT NOT NULL,
            original_result TEXT NOT NULL,
            overridden_result TEXT,
            override_reason TEXT,
            reviewed_at TEXT NOT NULL,
            reviewed_by TEXT,
            FOREIGN KEY (batch_id) REFERENCES kiln_batches (id),
            FOREIGN KEY (piece_id) REFERENCES pieces (id)
        )
    ''')
    
    conn.commit()
    conn.close()

def create_kiln_batch(batch_code, target_temperature_zone, batch_name=None, scheduled_date=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute('''
        INSERT INTO kiln_batches (batch_code, batch_name, target_temperature_zone, scheduled_date, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
    ''', (batch_code, batch_name, target_temperature_zone, scheduled_date, now, now))
    
    batch_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return batch_id

def get_all_pieces():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pieces ORDER BY import_date DESC')
    pieces = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return pieces

def get_piece_by_code(piece_code):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM pieces WHERE piece_code = ?', (piece_code,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_kiln_shelves():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM kiln_shelves WHERE is_available = 1 ORDER BY shelf_number')
    shelves = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return shelves

def get_kiln_batch(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM kiln_batches WHERE id = ?', (batch_id,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def get_all_kiln_batches():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM kiln_batches ORDER BY created_at DESC')
    batches = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return batches

def add_shelf_placement(batch_id, piece_id, shelf_id, position_x=None, position_y=None, placement_order=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute('''
        INSERT INTO shelf_placements (batch_id, piece_id, shelf_id, position_x, position_y, placement_order, placed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (batch_id, piece_id, shelf_id, position_x, position_y, placement_order, now))
    
    placement_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return placement_id

def get_batch_placements(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT sp.*, p.piece_code, p.owner_name, p.height, p.width, p.depth, 
               p.clay_type, p.glaze_type, p.temperature_zone, p.payment_status,
               ks.shelf_number, ks.max_height, ks.temperature_zone as shelf_temperature_zone
        FROM shelf_placements sp
        JOIN pieces p ON sp.piece_id = p.id
        JOIN kiln_shelves ks ON sp.shelf_id = ks.id
        WHERE sp.batch_id = ?
        ORDER BY ks.shelf_number, sp.placement_order
    ''', (batch_id,))
    
    placements = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return placements

def get_glaze_conflicts(glaze_type):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM glaze_conflicts
        WHERE glaze_a = ? OR (glaze_b = ? AND is_mutual = 1)
    ''', (glaze_type, glaze_type))
    
    conflicts = []
    for row in cursor.fetchall():
        conflict = dict(row)
        if conflict['glaze_a'] == glaze_type:
            conflicts.append({
                'conflicting_glaze': conflict['glaze_b'],
                'severity': conflict['conflict_severity'],
                'description': conflict['conflict_description']
            })
        else:
            conflicts.append({
                'conflicting_glaze': conflict['glaze_a'],
                'severity': conflict['conflict_severity'],
                'description': conflict['conflict_description']
            })
    
    conn.close()
    return conflicts

def add_review_record(batch_id, piece_id, check_type, original_result, overridden_result=None, override_reason=None, reviewed_by=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
    cursor.execute('''
        INSERT INTO review_records (batch_id, piece_id, check_type, original_result, overridden_result, override_reason, reviewed_at, reviewed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (batch_id, piece_id, check_type, original_result, overridden_result, override_reason, now, reviewed_by))
    
    record_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return record_id

def get_batch_review_records(batch_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT rr.*, p.piece_code, p.owner_name
        FROM review_records rr
        JOIN pieces p ON rr.piece_id = p.id
        WHERE rr.batch_id = ?
        ORDER BY rr.reviewed_at
    ''', (batch_id,))
    
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return records

def get_piece_review_records(batch_id, piece_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT * FROM review_records
        WHERE batch_id = ? AND piece_id = ?
        ORDER BY reviewed_at
    ''', (batch_id, piece_id))
    
    records = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return records
