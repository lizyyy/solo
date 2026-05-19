from fastapi import FastAPI, UploadFile, File, HTTPException, Query, Depends
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import sqlite3
import csv
import json
import os
import uuid
from datetime import datetime
from typing import Optional, List
from io import StringIO, BytesIO

app = FastAPI(title="药房库存管理系统", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "./data/pharmacy.db"
UPLOAD_DIR = "./uploads/photos"

os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
os.makedirs(UPLOAD_DIR, exist_ok=True)


def get_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


def init_db():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    cursor = conn.cursor()

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS delivery_records (
            id TEXT PRIMARY KEY,
            batch_no TEXT NOT NULL,
            product_type TEXT NOT NULL,
            product_name TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            arrival_date DATETIME NOT NULL,
            receiver_name TEXT NOT NULL,
            receiver_phone TEXT NOT NULL,
            supplier TEXT NOT NULL,
            created_at DATETIME NOT NULL,
            updated_at DATETIME NOT NULL,
            UNIQUE(batch_no, product_name)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS temperature_records (
            id TEXT PRIMARY KEY,
            delivery_id TEXT,
            batch_no TEXT NOT NULL,
            temperature REAL NOT NULL,
            record_time DATETIME NOT NULL,
            recorder_name TEXT NOT NULL,
            recorder_phone TEXT NOT NULL,
            thermometer_id TEXT,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (delivery_id) REFERENCES delivery_records(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS damage_records (
            id TEXT PRIMARY KEY,
            delivery_id TEXT,
            batch_no TEXT NOT NULL,
            damage_type TEXT NOT NULL,
            description TEXT,
            quantity INTEGER NOT NULL,
            photo_paths TEXT,
            reporter_name TEXT NOT NULL,
            report_time DATETIME NOT NULL,
            created_at DATETIME NOT NULL,
            FOREIGN KEY (delivery_id) REFERENCES delivery_records(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_errors (
            id TEXT PRIMARY KEY,
            import_session TEXT NOT NULL,
            source_type TEXT NOT NULL,
            source_file TEXT NOT NULL,
            original_row INTEGER NOT NULL,
            original_data TEXT NOT NULL,
            error_type TEXT NOT NULL,
            error_message TEXT NOT NULL,
            suggestion TEXT,
            status TEXT NOT NULL DEFAULT 'pending',
            resolved_by TEXT,
            resolved_at DATETIME,
            created_at DATETIME NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS import_sessions (
            id TEXT PRIMARY KEY,
            source_type TEXT NOT NULL,
            file_name TEXT NOT NULL,
            total_records INTEGER NOT NULL DEFAULT 0,
            success_count INTEGER NOT NULL DEFAULT 0,
            error_count INTEGER NOT NULL DEFAULT 0,
            imported_by TEXT,
            imported_at DATETIME NOT NULL
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS photo_records (
            id TEXT PRIMARY KEY,
            delivery_id TEXT,
            batch_no TEXT NOT NULL,
            file_name TEXT NOT NULL,
            file_hash TEXT NOT NULL,
            file_path TEXT NOT NULL,
            uploaded_by TEXT,
            uploaded_at DATETIME NOT NULL,
            FOREIGN KEY (delivery_id) REFERENCES delivery_records(id)
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS audit_logs (
            id TEXT PRIMARY KEY,
            operation TEXT NOT NULL,
            entity_type TEXT NOT NULL,
            entity_id TEXT NOT NULL,
            operator TEXT,
            old_value TEXT,
            new_value TEXT,
            timestamp DATETIME NOT NULL
        )
    ''')

    conn.commit()
    conn.close()


def mask_name(name: str) -> str:
    if not name or len(name) <= 1:
        return "*" * len(name)
    return name[0] + "*" * (len(name) - 1)


def mask_phone(phone: str) -> str:
    if not phone or len(phone) <= 4:
        return "*" * len(phone)
    return phone[:3] + "*" * (len(phone) - 7) + phone[-4:]


def log_audit(conn, operation, entity_type, entity_id, operator="system", old_value="", new_value=""):
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO audit_logs (id, operation, entity_type, entity_id, operator, old_value, new_value, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        str(uuid.uuid4()),
        operation,
        entity_type,
        entity_id,
        operator,
        old_value,
        new_value,
        datetime.now().isoformat()
    ))
    conn.commit()


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/api/v1/health")
async def health_check():
    return {"status": "ok", "message": "Pharmacy Inventory API is running"}


@app.post("/api/v1/import/delivery")
async def import_delivery_csv(file: UploadFile = File(...), conn: sqlite3.Connection = Depends(get_db)):
    session_id = str(uuid.uuid4())
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO import_sessions (id, source_type, file_name, total_records, success_count, error_count, imported_by, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, "delivery_csv", file.filename, 0, 0, 0, "system", datetime.now().isoformat()))
    conn.commit()

    content = await file.read()
    csv_content = content.decode('utf-8')
    reader = csv.reader(StringIO(csv_content))
    rows = list(reader)

    total_count = 0
    success_count = 0
    error_count = 0

    for row_idx in range(1, len(rows)):
        row = rows[row_idx]
        total_count += 1
        original_data = ",".join(row)

        if len(row) < 8:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "delivery_csv", file.filename,
                row_idx, original_data, "column_mismatch",
                f"Expected at least 8 columns, got {len(row)}",
                "Check CSV format, columns should be: batch_no, product_type, product_name, quantity, arrival_date, receiver_name, receiver_phone, supplier",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1
            continue

        batch_no = row[0].strip()
        product_type = row[1].strip()
        product_name = row[2].strip()
        quantity_str = row[3].strip()
        arrival_date_str = row[4].strip()
        receiver_name = row[5].strip()
        receiver_phone = row[6].strip()
        supplier = row[7].strip()

        errors = []

        if not batch_no:
            errors.append("batch_no is empty")

        try:
            quantity = int(quantity_str)
        except ValueError:
            errors.append("invalid quantity format")
            quantity = 0

        try:
            arrival_date = datetime.strptime(arrival_date_str, "%Y-%m-%d")
        except ValueError:
            try:
                arrival_date = datetime.strptime(arrival_date_str, "%Y/%m/%d")
            except ValueError:
                errors.append("invalid arrival_date format (expected YYYY-MM-DD)")
                arrival_date = datetime.now()

        if not product_name:
            errors.append("product_name is empty")
        if not receiver_name:
            errors.append("receiver_name is empty")
        if not receiver_phone:
            errors.append("receiver_phone is empty")

        if errors:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "delivery_csv", file.filename,
                row_idx, original_data, "validation_error",
                "; ".join(errors),
                "Fix the validation errors and re-import or manually add the record",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1
            continue

        try:
            record_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO delivery_records (id, batch_no, product_type, product_name, quantity, arrival_date, receiver_name, receiver_phone, supplier, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record_id, batch_no, product_type, product_name, quantity,
                arrival_date.isoformat(), receiver_name, receiver_phone, supplier,
                datetime.now().isoformat(), datetime.now().isoformat()
            ))
            conn.commit()

            log_audit(conn, "create", "delivery", record_id, "system", "", original_data)
            success_count += 1
        except sqlite3.IntegrityError as e:
            if "UNIQUE constraint failed" in str(e):
                cursor.execute('''
                    INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()), session_id, "delivery_csv", file.filename,
                    row_idx, original_data, "duplicate_record",
                    f"Record with batch_no {batch_no} and product_name {product_name} already exists",
                    "This record already exists in the system, no action needed unless update is required",
                    "pending", datetime.now().isoformat()
                ))
                conn.commit()
                error_count += 1
            else:
                cursor.execute('''
                    INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()), session_id, "delivery_csv", file.filename,
                    row_idx, original_data, "database_error",
                    str(e),
                    "Check database connection or contact administrator",
                    "pending", datetime.now().isoformat()
                ))
                conn.commit()
                error_count += 1

    cursor.execute('''
        UPDATE import_sessions SET total_records = ?, success_count = ?, error_count = ? WHERE id = ?
    ''', (total_count, success_count, error_count, session_id))
    conn.commit()

    return {
        "result": {
            "session_id": session_id,
            "total_records": total_count,
            "success_count": success_count,
            "error_count": error_count
        }
    }


@app.post("/api/v1/import/temperature")
async def import_temperature_json(file: UploadFile = File(...), conn: sqlite3.Connection = Depends(get_db)):
    session_id = str(uuid.uuid4())
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO import_sessions (id, source_type, file_name, total_records, success_count, error_count, imported_by, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, "temperature_json", file.filename, 0, 0, 0, "system", datetime.now().isoformat()))
    conn.commit()

    content = await file.read()
    try:
        records = json.loads(content.decode('utf-8'))
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"Invalid JSON format: {str(e)}")

    total_count = len(records)
    success_count = 0
    error_count = 0

    for idx, item in enumerate(records):
        original_data = json.dumps(item, ensure_ascii=False)
        errors = []

        batch_no = item.get("batch_no", "").strip()
        temperature = item.get("temperature")
        record_time_str = item.get("record_time", "").strip()
        recorder_name = item.get("recorder_name", "").strip()
        recorder_phone = item.get("recorder_phone", "").strip()
        thermometer_id = item.get("thermometer_id", "").strip()

        if not batch_no:
            errors.append("batch_no is missing or invalid")
        if temperature is None:
            errors.append("temperature is missing or invalid")
        if not record_time_str:
            errors.append("record_time is missing")
        if not recorder_name:
            errors.append("recorder_name is missing")
        if not recorder_phone:
            errors.append("recorder_phone is missing")

        if errors:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "temperature_json", file.filename,
                idx, original_data, "validation_error",
                "; ".join(errors),
                "Fix the validation errors and re-import",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1
            continue

        try:
            record_time = datetime.strptime(record_time_str, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            try:
                record_time = datetime.strptime(record_time_str, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                cursor.execute('''
                    INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ''', (
                    str(uuid.uuid4()), session_id, "temperature_json", file.filename,
                    idx, original_data, "validation_error",
                    "invalid record_time format (expected YYYY-MM-DD HH:MM:SS)",
                    "Fix the validation errors and re-import",
                    "pending", datetime.now().isoformat()
                ))
                conn.commit()
                error_count += 1
                continue

        if temperature < -80 or temperature > 40:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "temperature_json", file.filename,
                idx, original_data, "temperature_out_of_range",
                f"Temperature {temperature}°C is outside valid range (-80°C to 40°C)",
                "Verify thermometer calibration or data entry, this may indicate storage issues",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1
            continue

        delivery_id = None
        cursor.execute('SELECT id FROM delivery_records WHERE batch_no = ? LIMIT 1', (batch_no,))
        row = cursor.fetchone()
        if row:
            delivery_id = row[0]

        try:
            record_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO temperature_records (id, delivery_id, batch_no, temperature, record_time, recorder_name, recorder_phone, thermometer_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record_id, delivery_id, batch_no, temperature,
                record_time.isoformat(), recorder_name, recorder_phone,
                thermometer_id, datetime.now().isoformat()
            ))
            conn.commit()

            log_audit(conn, "create", "temperature", record_id, "system", "", original_data)
            success_count += 1
        except Exception as e:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "temperature_json", file.filename,
                idx, original_data, "database_error",
                str(e),
                "Check database connection or contact administrator",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1

    cursor.execute('''
        UPDATE import_sessions SET total_records = ?, success_count = ?, error_count = ? WHERE id = ?
    ''', (total_count, success_count, error_count, session_id))
    conn.commit()

    return {
        "result": {
            "session_id": session_id,
            "total_records": total_count,
            "success_count": success_count,
            "error_count": error_count
        }
    }


@app.post("/api/v1/import/photos")
async def import_photos(batch_no: str, uploaded_by: Optional[str] = None, files: List[UploadFile] = File(...), conn: sqlite3.Connection = Depends(get_db)):
    session_id = str(uuid.uuid4())
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO import_sessions (id, source_type, file_name, total_records, success_count, error_count, imported_by, imported_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ''', (session_id, "photo_upload", f"{len(files)} photos", 0, 0, 0, uploaded_by or "system", datetime.now().isoformat()))
    conn.commit()

    success_count = 0
    error_count = 0
    total_count = len(files)

    delivery_id = None
    cursor.execute('SELECT id FROM delivery_records WHERE batch_no = ? LIMIT 1', (batch_no,))
    row = cursor.fetchone()
    if row:
        delivery_id = row[0]

    for idx, file in enumerate(files):
        try:
            ext = os.path.splitext(file.filename)[1]
            new_filename = f"{batch_no}_{datetime.now().strftime('%Y%m%d%H%M%S')}_{idx}{ext}"
            file_path = os.path.join(UPLOAD_DIR, new_filename)

            content = await file.read()
            with open(file_path, "wb") as f:
                f.write(content)

            record_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO photo_records (id, delivery_id, batch_no, file_name, file_hash, file_path, uploaded_by, uploaded_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                record_id, delivery_id, batch_no, new_filename,
                "placeholder", file_path, uploaded_by, datetime.now().isoformat()
            ))
            conn.commit()
            success_count += 1
        except Exception as e:
            cursor.execute('''
                INSERT INTO import_errors (id, import_session, source_type, source_file, original_row, original_data, error_type, error_message, suggestion, status, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                str(uuid.uuid4()), session_id, "photo_upload", file.filename,
                idx, file.filename, "save_error",
                str(e),
                "Check file permissions or disk space",
                "pending", datetime.now().isoformat()
            ))
            conn.commit()
            error_count += 1

    cursor.execute('''
        UPDATE import_sessions SET total_records = ?, success_count = ?, error_count = ? WHERE id = ?
    ''', (total_count, success_count, error_count, session_id))
    conn.commit()

    return {
        "result": {
            "session_id": session_id,
            "total_records": total_count,
            "success_count": success_count,
            "error_count": error_count
        }
    }


@app.get("/api/v1/deliveries")
async def get_deliveries(page: int = 1, page_size: int = 20, conn: sqlite3.Connection = Depends(get_db)):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    offset = (page - 1) * page_size

    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as total FROM delivery_records')
    total = cursor.fetchone()['total']

    cursor.execute('''
        SELECT id, batch_no, product_type, product_name, quantity, arrival_date,
               receiver_name, receiver_phone, supplier, created_at, updated_at
        FROM delivery_records ORDER BY created_at DESC LIMIT ? OFFSET ?
    ''', (page_size, offset))

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "batch_no": row['batch_no'],
            "product_type": row['product_type'],
            "product_name": row['product_name'],
            "quantity": row['quantity'],
            "arrival_date": row['arrival_date'],
            "receiver_name": mask_name(row['receiver_name']),
            "receiver_phone": mask_phone(row['receiver_phone']),
            "supplier": row['supplier'],
            "created_at": row['created_at'],
            "updated_at": row['updated_at']
        })

    return {
        "data": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_page": (total + page_size - 1) // page_size
    }


@app.get("/api/v1/deliveries/{record_id}")
async def get_delivery(record_id: str, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, batch_no, product_type, product_name, quantity, arrival_date,
               receiver_name, receiver_phone, supplier, created_at, updated_at
        FROM delivery_records WHERE id = ?
    ''', (record_id,))

    row = cursor.fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Record not found")

    return {
        "data": {
            "id": row['id'],
            "batch_no": row['batch_no'],
            "product_type": row['product_type'],
            "product_name": row['product_name'],
            "quantity": row['quantity'],
            "arrival_date": row['arrival_date'],
            "receiver_name": mask_name(row['receiver_name']),
            "receiver_phone": mask_phone(row['receiver_phone']),
            "supplier": row['supplier'],
            "created_at": row['created_at'],
            "updated_at": row['updated_at']
        }
    }


@app.get("/api/v1/deliveries/export")
async def export_deliveries(conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT batch_no, product_type, product_name, quantity, arrival_date,
               receiver_name, receiver_phone, supplier
        FROM delivery_records ORDER BY created_at DESC
    ''')

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Batch No", "Product Type", "Product Name", "Quantity", "Arrival Date", "Receiver", "Phone", "Supplier"])

    for row in cursor.fetchall():
        writer.writerow([
            row['batch_no'],
            row['product_type'],
            row['product_name'],
            row['quantity'],
            row['arrival_date'],
            mask_name(row['receiver_name']),
            mask_phone(row['receiver_phone']),
            row['supplier']
        ])

    output.seek(0)
    return StreamingResponse(
        BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=delivery_records.csv"}
    )


@app.get("/api/v1/temperature")
async def get_temperature_records(batch_no: str, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, delivery_id, batch_no, temperature, record_time,
               recorder_name, recorder_phone, thermometer_id, created_at
        FROM temperature_records WHERE batch_no = ? ORDER BY record_time DESC
    ''', (batch_no,))

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "delivery_id": row['delivery_id'],
            "batch_no": row['batch_no'],
            "temperature": row['temperature'],
            "record_time": row['record_time'],
            "recorder_name": mask_name(row['recorder_name']),
            "recorder_phone": mask_phone(row['recorder_phone']),
            "thermometer_id": row['thermometer_id'],
            "created_at": row['created_at']
        })

    return {"data": records}


@app.get("/api/v1/damage")
async def get_damage_records(batch_no: str, conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute('''
        SELECT id, delivery_id, batch_no, damage_type, description, quantity,
               photo_paths, reporter_name, report_time, created_at
        FROM damage_records WHERE batch_no = ? ORDER BY report_time DESC
    ''', (batch_no,))

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "delivery_id": row['delivery_id'],
            "batch_no": row['batch_no'],
            "damage_type": row['damage_type'],
            "description": row['description'],
            "quantity": row['quantity'],
            "photo_paths": row['photo_paths'],
            "reporter_name": mask_name(row['reporter_name']),
            "report_time": row['report_time'],
            "created_at": row['created_at']
        })

    return {"data": records}


@app.post("/api/v1/damage")
async def create_damage_record(
    batch_no: str,
    damage_type: str,
    quantity: int,
    reporter_name: str,
    report_time: Optional[str] = None,
    description: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()

    delivery_id = None
    cursor.execute('SELECT id FROM delivery_records WHERE batch_no = ? LIMIT 1', (batch_no,))
    row = cursor.fetchone()
    if row:
        delivery_id = row[0]

    record_id = str(uuid.uuid4())
    if not report_time:
        report_time = datetime.now().isoformat()

    cursor.execute('''
        INSERT INTO damage_records (id, delivery_id, batch_no, damage_type, description, quantity, reporter_name, report_time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        record_id, delivery_id, batch_no, damage_type, description,
        quantity, reporter_name, report_time, datetime.now().isoformat()
    ))
    conn.commit()

    log_audit(conn, "create", "damage", record_id, "system", "", f"{batch_no}: {damage_type}")

    return {"data": {"id": record_id, "batch_no": batch_no, "damage_type": damage_type}}


@app.get("/api/v1/import/sessions")
async def get_import_sessions(page: int = 1, page_size: int = 20, conn: sqlite3.Connection = Depends(get_db)):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    offset = (page - 1) * page_size

    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) as total FROM import_sessions')
    total = cursor.fetchone()['total']

    cursor.execute('''
        SELECT id, source_type, file_name, total_records, success_count,
               error_count, imported_by, imported_at
        FROM import_sessions ORDER BY imported_at DESC LIMIT ? OFFSET ?
    ''', (page_size, offset))

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "source_type": row['source_type'],
            "file_name": row['file_name'],
            "total_records": row['total_records'],
            "success_count": row['success_count'],
            "error_count": row['error_count'],
            "imported_by": mask_name(row['imported_by']) if row['imported_by'] else None,
            "imported_at": row['imported_at']
        })

    return {
        "data": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_page": (total + page_size - 1) // page_size
    }


@app.get("/api/v1/import/errors")
async def get_import_errors(
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    conn: sqlite3.Connection = Depends(get_db)
):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    offset = (page - 1) * page_size

    cursor = conn.cursor()

    base_query = 'FROM import_errors WHERE 1=1'
    params = []

    if session_id:
        base_query += ' AND import_session = ?'
        params.append(session_id)
    if status:
        base_query += ' AND status = ?'
        params.append(status)

    cursor.execute(f'SELECT COUNT(*) as total {base_query}', params)
    total = cursor.fetchone()['total']

    params.extend([page_size, offset])
    cursor.execute(f'''
        SELECT id, import_session, source_type, source_file, original_row,
               original_data, error_type, error_message, suggestion, status,
               resolved_by, resolved_at, created_at
        {base_query} ORDER BY created_at DESC LIMIT ? OFFSET ?
    ''', params)

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "import_session": row['import_session'],
            "source_type": row['source_type'],
            "source_file": row['source_file'],
            "original_row": row['original_row'],
            "original_data": row['original_data'],
            "error_type": row['error_type'],
            "error_message": row['error_message'],
            "suggestion": row['suggestion'],
            "status": row['status'],
            "resolved_by": mask_name(row['resolved_by']) if row['resolved_by'] else None,
            "resolved_at": row['resolved_at'],
            "created_at": row['created_at']
        })

    return {
        "data": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_page": (total + page_size - 1) // page_size
    }


@app.put("/api/v1/import/errors/{error_id}/resolve")
async def resolve_import_error(error_id: str, resolved_by: Optional[str] = "system", conn: sqlite3.Connection = Depends(get_db)):
    cursor = conn.cursor()
    cursor.execute('''
        UPDATE import_errors SET status = 'resolved', resolved_by = ?, resolved_at = ? WHERE id = ?
    ''', (resolved_by, datetime.now().isoformat(), error_id))
    conn.commit()

    if cursor.rowcount == 0:
        raise HTTPException(status_code=404, detail="Error record not found")

    log_audit(conn, "resolve", "import_error", error_id, resolved_by, "pending", "resolved")

    return {"message": "Error resolved successfully"}


@app.get("/api/v1/import/errors/export")
async def export_import_errors(
    session_id: Optional[str] = None,
    status: Optional[str] = None,
    conn: sqlite3.Connection = Depends(get_db)
):
    cursor = conn.cursor()

    base_query = 'FROM import_errors WHERE 1=1'
    params = []

    if session_id:
        base_query += ' AND import_session = ?'
        params.append(session_id)
    if status:
        base_query += ' AND status = ?'
        params.append(status)

    cursor.execute(f'''
        SELECT original_row, original_data, error_type, error_message, suggestion, status
        {base_query} ORDER BY created_at DESC
    ''', params)

    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["Row", "Original Data", "Error Type", "Error Message", "Suggestion", "Status"])

    for row in cursor.fetchall():
        writer.writerow([
            row['original_row'],
            row['original_data'],
            row['error_type'],
            row['error_message'],
            row['suggestion'],
            row['status']
        ])

    output.seek(0)
    return StreamingResponse(
        BytesIO(output.getvalue().encode('utf-8')),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=import_errors.csv"}
    )


@app.get("/api/v1/audit")
async def get_audit_logs(
    entity_type: Optional[str] = None,
    entity_id: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    conn: sqlite3.Connection = Depends(get_db)
):
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 100:
        page_size = 20
    offset = (page - 1) * page_size

    cursor = conn.cursor()

    base_query = 'FROM audit_logs WHERE 1=1'
    params = []

    if entity_type:
        base_query += ' AND entity_type = ?'
        params.append(entity_type)
    if entity_id:
        base_query += ' AND entity_id = ?'
        params.append(entity_id)

    cursor.execute(f'SELECT COUNT(*) as total {base_query}', params)
    total = cursor.fetchone()['total']

    params.extend([page_size, offset])
    cursor.execute(f'''
        SELECT id, operation, entity_type, entity_id, operator, old_value, new_value, timestamp
        {base_query} ORDER BY timestamp DESC LIMIT ? OFFSET ?
    ''', params)

    records = []
    for row in cursor.fetchall():
        records.append({
            "id": row['id'],
            "operation": row['operation'],
            "entity_type": row['entity_type'],
            "entity_id": row['entity_id'],
            "operator": mask_name(row['operator']) if row['operator'] else None,
            "old_value": row['old_value'],
            "new_value": row['new_value'],
            "timestamp": row['timestamp']
        })

    return {
        "data": records,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_page": (total + page_size - 1) // page_size
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8080)
