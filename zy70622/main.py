from fastapi import FastAPI, HTTPException, Depends, Request, status
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from enum import Enum
import sqlite3
import csv
import os
import uuid

app = FastAPI(title="访客车位管理API", version="1.0.0")


class ErrorResponse(BaseModel):
    error_code: str
    message: str
    details: Optional[dict] = None


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    errors = exc.errors()
    missing_fields = []
    for error in errors:
        if error.get("type") == "missing":
            loc = error.get("loc", [])
            field_name = ".".join([str(x) for x in loc if x != "body"])
            missing_fields.append(field_name)
    
    if missing_fields:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": "MISSING_FIELD",
                "message": f"缺少必填字段: {', '.join(missing_fields)}",
                "details": {"missing_fields": missing_fields}
            }
        )
    
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": "INVALID_STATUS",
            "message": "请求参数验证失败",
            "details": {"errors": str(errors)}
        }
    )

DATABASE = "parking.db"

class ErrorCode(str, Enum):
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    NEEDS_MANUAL_REVIEW = "NEEDS_MANUAL_REVIEW"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"

class ParkingStatus(str, Enum):
    AVAILABLE = "AVAILABLE"
    LOCKED = "LOCKED"
    OCCUPIED = "OCCUPIED"

class MeetingStatus(str, Enum):
    SCHEDULED = "SCHEDULED"
    CANCELLED = "CANCELLED"
    COMPLETED = "COMPLETED"

class PassCodeStatus(str, Enum):
    ACTIVE = "ACTIVE"
    USED = "USED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"

def get_db():
    init_db()
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS visitors (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            phone TEXT NOT NULL,
            company TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS parking_spots (
            id TEXT PRIMARY KEY,
            spot_number TEXT UNIQUE NOT NULL,
            area TEXT NOT NULL,
            status TEXT DEFAULT 'AVAILABLE',
            current_meeting_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (current_meeting_id) REFERENCES meetings(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS meetings (
            id TEXT PRIMARY KEY,
            visitor_id TEXT NOT NULL,
            title TEXT NOT NULL,
            meeting_date DATE NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT NOT NULL,
            status TEXT DEFAULT 'SCHEDULED',
            parking_spot_id TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (visitor_id) REFERENCES visitors(id),
            FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS pass_codes (
            id TEXT PRIMARY KEY,
            code TEXT UNIQUE NOT NULL,
            meeting_id TEXT NOT NULL,
            parking_spot_id TEXT NOT NULL,
            visitor_id TEXT NOT NULL,
            status TEXT DEFAULT 'ACTIVE',
            valid_from TIMESTAMP NOT NULL,
            valid_until TIMESTAMP NOT NULL,
            used_at TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id),
            FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
            FOREIGN KEY (visitor_id) REFERENCES visitors(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS cancellation_records (
            id TEXT PRIMARY KEY,
            meeting_id TEXT NOT NULL,
            parking_spot_id TEXT NOT NULL,
            pass_code_id TEXT,
            cancelled_by TEXT NOT NULL,
            cancel_reason TEXT,
            cancelled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            released_at TIMESTAMP,
            needs_review INTEGER DEFAULT 0,
            FOREIGN KEY (meeting_id) REFERENCES meetings(id),
            FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
            FOREIGN KEY (pass_code_id) REFERENCES pass_codes(id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS occupancy_reports (
            id TEXT PRIMARY KEY,
            report_date DATE UNIQUE NOT NULL,
            total_spots INTEGER NOT NULL,
            occupied_spots INTEGER NOT NULL,
            locked_spots INTEGER NOT NULL,
            available_spots INTEGER NOT NULL,
            cancelled_meetings INTEGER DEFAULT 0,
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS spot_occupancy_logs (
            id TEXT PRIMARY KEY,
            parking_spot_id TEXT NOT NULL,
            meeting_id TEXT,
            visitor_id TEXT,
            action TEXT NOT NULL,
            action_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            remarks TEXT,
            FOREIGN KEY (parking_spot_id) REFERENCES parking_spots(id),
            FOREIGN KEY (meeting_id) REFERENCES meetings(id),
            FOREIGN KEY (visitor_id) REFERENCES visitors(id)
        )
    ''')
    
    cursor.execute("SELECT COUNT(*) FROM parking_spots")
    if cursor.fetchone()[0] == 0:
        for i in range(1, 21):
            spot_id = str(uuid.uuid4())
            area = "A区" if i <= 10 else "B区"
            cursor.execute(
                "INSERT INTO parking_spots (id, spot_number, area, status) VALUES (?, ?, ?, ?)",
                (spot_id, f"P{i:03d}", area, "AVAILABLE")
            )
    
    conn.commit()
    conn.close()

@app.on_event("startup")
async def startup_event():
    init_db()

class VisitorCreate(BaseModel):
    name: str = Field(..., description="访客姓名")
    phone: str = Field(..., description="访客电话")
    company: Optional[str] = Field(None, description="访客公司")

class VisitorResponse(BaseModel):
    id: str
    name: str
    phone: str
    company: Optional[str]
    created_at: datetime

class MeetingCreate(BaseModel):
    visitor_id: str = Field(..., description="访客ID")
    title: str = Field(..., description="会议标题")
    meeting_date: date = Field(..., description="会议日期")
    start_time: str = Field(..., description="开始时间 HH:MM")
    end_time: str = Field(..., description="结束时间 HH:MM")
    need_parking: bool = Field(True, description="是否需要车位")

class MeetingResponse(BaseModel):
    id: str
    visitor_id: str
    title: str
    meeting_date: date
    start_time: str
    end_time: str
    status: MeetingStatus
    parking_spot_id: Optional[str]
    parking_spot_number: Optional[str]
    pass_code: Optional[str]
    created_at: datetime

class PassCodeResponse(BaseModel):
    id: str
    code: str
    meeting_id: str
    parking_spot_id: str
    parking_spot_number: str
    visitor_id: str
    status: PassCodeStatus
    valid_from: datetime
    valid_until: datetime
    used_at: Optional[datetime]

class CancellationRequest(BaseModel):
    meeting_id: str = Field(..., description="会议ID")
    cancelled_by: str = Field(..., description="取消操作人")
    cancel_reason: Optional[str] = Field(None, description="取消原因")

class CancellationResponse(BaseModel):
    id: str
    meeting_id: str
    parking_spot_id: str
    pass_code_id: Optional[str]
    cancelled_by: str
    cancel_reason: Optional[str]
    cancelled_at: datetime
    released_at: Optional[datetime]
    needs_review: bool

class ParkingSpotResponse(BaseModel):
    id: str
    spot_number: str
    area: str
    status: ParkingStatus
    current_meeting_id: Optional[str]
    current_visitor_name: Optional[str]

class OccupancyReportResponse(BaseModel):
    id: str
    report_date: date
    total_spots: int
    occupied_spots: int
    locked_spots: int
    available_spots: int
    cancelled_meetings: int
    generated_at: datetime

def raise_api_error(error_code: ErrorCode, message: str, details: dict = None):
    raise HTTPException(
        status_code=400 if error_code != ErrorCode.RESOURCE_NOT_FOUND else 404,
        detail={
            "error_code": error_code.value,
            "message": message,
            "details": details or {}
        }
    )

def generate_pass_code() -> str:
    import random
    return ''.join([str(random.randint(0, 9)) for _ in range(6)])

@app.post("/visitors", response_model=VisitorResponse, status_code=201)
def create_visitor(visitor: VisitorCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    visitor_id = str(uuid.uuid4())
    cursor.execute(
        "INSERT INTO visitors (id, name, phone, company) VALUES (?, ?, ?, ?)",
        (visitor_id, visitor.name, visitor.phone, visitor.company)
    )
    db.commit()
    cursor.execute("SELECT * FROM visitors WHERE id = ?", (visitor_id,))
    row = cursor.fetchone()
    return dict(row)

@app.get("/visitors", response_model=List[VisitorResponse])
def list_visitors(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM visitors ORDER BY created_at DESC")
    return [dict(row) for row in cursor.fetchall()]

@app.get("/parking-spots", response_model=List[ParkingSpotResponse])
def list_parking_spots(status: Optional[ParkingStatus] = None, area: Optional[str] = None, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    query = """
        SELECT ps.*, m.title as meeting_title, v.name as visitor_name
        FROM parking_spots ps
        LEFT JOIN meetings m ON ps.current_meeting_id = m.id
        LEFT JOIN visitors v ON m.visitor_id = v.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND ps.status = ?"
        params.append(status.value)
    if area:
        query += " AND ps.area = ?"
        params.append(area)
    query += " ORDER BY ps.spot_number"
    cursor.execute(query, params)
    rows = cursor.fetchall()
    result = []
    for row in rows:
        result.append({
            "id": row["id"],
            "spot_number": row["spot_number"],
            "area": row["area"],
            "status": row["status"],
            "current_meeting_id": row["current_meeting_id"],
            "current_visitor_name": row["visitor_name"]
        })
    return result

@app.post("/meetings", response_model=MeetingResponse, status_code=201)
def create_meeting(meeting: MeetingCreate, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM visitors WHERE id = ?", (meeting.visitor_id,))
    if not cursor.fetchone():
        raise_api_error(ErrorCode.RESOURCE_NOT_FOUND, "访客不存在", {"visitor_id": meeting.visitor_id})
    
    meeting_id = str(uuid.uuid4())
    parking_spot_id = None
    pass_code_value = None
    
    if meeting.need_parking:
        cursor.execute("SELECT * FROM parking_spots WHERE status = 'AVAILABLE' LIMIT 1")
        spot = cursor.fetchone()
        if not spot:
            raise_api_error(ErrorCode.INVALID_STATUS, "没有可用车位", {"meeting_date": str(meeting.meeting_date)})
        
        parking_spot_id = spot["id"]
        cursor.execute(
            "UPDATE parking_spots SET status = 'LOCKED', current_meeting_id = ? WHERE id = ?",
            (meeting_id, parking_spot_id)
        )
        
        pass_code_value = generate_pass_code()
        pass_code_id = str(uuid.uuid4())
        valid_from = datetime.combine(meeting.meeting_date, datetime.strptime(meeting.start_time, "%H:%M").time())
        valid_until = datetime.combine(meeting.meeting_date, datetime.strptime(meeting.end_time, "%H:%M").time())
        
        cursor.execute(
            """INSERT INTO pass_codes 
               (id, code, meeting_id, parking_spot_id, visitor_id, status, valid_from, valid_until)
               VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?, ?)""",
            (pass_code_id, pass_code_value, meeting_id, parking_spot_id, meeting.visitor_id, valid_from, valid_until)
        )
        
        cursor.execute(
            """INSERT INTO spot_occupancy_logs 
               (id, parking_spot_id, meeting_id, visitor_id, action, remarks)
               VALUES (?, ?, ?, ?, 'LOCKED', ?)""",
            (str(uuid.uuid4()), parking_spot_id, meeting_id, meeting.visitor_id, f"会议预约锁定: {meeting.title}")
        )
    
    cursor.execute(
        """INSERT INTO meetings 
           (id, visitor_id, title, meeting_date, start_time, end_time, parking_spot_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)""",
        (meeting_id, meeting.visitor_id, meeting.title, str(meeting.meeting_date), 
         meeting.start_time, meeting.end_time, parking_spot_id)
    )
    
    db.commit()
    
    cursor.execute("""
        SELECT m.*, ps.spot_number as parking_spot_number
        FROM meetings m
        LEFT JOIN parking_spots ps ON m.parking_spot_id = ps.id
        WHERE m.id = ?
    """, (meeting_id,))
    row = cursor.fetchone()
    
    result = dict(row)
    result["pass_code"] = pass_code_value
    return result

@app.get("/meetings", response_model=List[MeetingResponse])
def list_meetings(status: Optional[MeetingStatus] = None, visitor_id: Optional[str] = None, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    query = """
        SELECT m.*, ps.spot_number as parking_spot_number, pc.code as pass_code
        FROM meetings m
        LEFT JOIN parking_spots ps ON m.parking_spot_id = ps.id
        LEFT JOIN pass_codes pc ON m.id = pc.meeting_id AND pc.status = 'ACTIVE'
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND m.status = ?"
        params.append(status.value)
    if visitor_id:
        query += " AND m.visitor_id = ?"
        params.append(visitor_id)
    query += " ORDER BY m.meeting_date DESC, m.start_time DESC"
    cursor.execute(query, params)
    return [dict(row) for row in cursor.fetchall()]

@app.post("/meetings/cancel")
def cancel_meeting(cancel_req: CancellationRequest, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    
    cursor.execute("SELECT * FROM meetings WHERE id = ?", (cancel_req.meeting_id,))
    meeting = cursor.fetchone()
    if not meeting:
        raise_api_error(ErrorCode.RESOURCE_NOT_FOUND, "会议不存在", {"meeting_id": cancel_req.meeting_id})
    
    if meeting["status"] == "CANCELLED":
        raise_api_error(ErrorCode.ALREADY_PROCESSED, "会议已经取消", {"meeting_id": cancel_req.meeting_id})
    
    if meeting["status"] == "COMPLETED":
        raise_api_error(ErrorCode.INVALID_STATUS, "会议已完成，无法取消", {"meeting_id": cancel_req.meeting_id})
    
    parking_spot_id = meeting["parking_spot_id"]
    needs_review = False
    pass_code_id = None
    
    if parking_spot_id:
        cursor.execute("SELECT * FROM parking_spots WHERE id = ?", (parking_spot_id,))
        spot = cursor.fetchone()
        
        if spot["status"] == "OCCUPIED":
            needs_review = True
        else:
            cursor.execute(
                "UPDATE parking_spots SET status = 'AVAILABLE', current_meeting_id = NULL WHERE id = ?",
                (parking_spot_id,)
            )
            
            cursor.execute(
                """INSERT INTO spot_occupancy_logs 
                   (id, parking_spot_id, meeting_id, visitor_id, action, remarks)
                   VALUES (?, ?, ?, ?, 'RELEASED', ?)""",
                (str(uuid.uuid4()), parking_spot_id, cancel_req.meeting_id, meeting["visitor_id"], 
                 f"会议取消释放: {meeting['title']}")
            )
        
        cursor.execute("SELECT * FROM pass_codes WHERE meeting_id = ? AND status = 'ACTIVE'", (cancel_req.meeting_id,))
        pass_code = cursor.fetchone()
        if pass_code:
            pass_code_id = pass_code["id"]
            cursor.execute("UPDATE pass_codes SET status = 'CANCELLED' WHERE id = ?", (pass_code_id,))
    
    cursor.execute("UPDATE meetings SET status = 'CANCELLED' WHERE id = ?", (cancel_req.meeting_id,))
    
    cancellation_id = str(uuid.uuid4())
    released_at = datetime.now() if not needs_review else None
    cursor.execute(
        """INSERT INTO cancellation_records 
           (id, meeting_id, parking_spot_id, pass_code_id, cancelled_by, cancel_reason, released_at, needs_review)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
        (cancellation_id, cancel_req.meeting_id, parking_spot_id, pass_code_id, 
         cancel_req.cancelled_by, cancel_req.cancel_reason, released_at, 1 if needs_review else 0)
    )
    
    db.commit()
    
    cursor.execute("SELECT * FROM cancellation_records WHERE id = ?", (cancellation_id,))
    row = cursor.fetchone()
    result = dict(row)
    result["needs_review"] = bool(result["needs_review"])
    
    if needs_review:
        raise HTTPException(
            status_code=202,
            detail={
                "error_code": "NEEDS_MANUAL_REVIEW",
                "message": "会议已取消，但车位已被占用，需要人工复核后释放",
                "details": {
                    "cancellation_id": cancellation_id,
                    "meeting_id": cancel_req.meeting_id,
                    "parking_spot_id": parking_spot_id,
                    "parking_spot_number": spot["spot_number"] if spot else None
                }
            }
        )
    
    return result

@app.get("/pass-codes/{code}", response_model=PassCodeResponse)
def verify_pass_code(code: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("""
        SELECT pc.*, ps.spot_number as parking_spot_number
        FROM pass_codes pc
        JOIN parking_spots ps ON pc.parking_spot_id = ps.id
        WHERE pc.code = ?
    """, (code,))
    pass_code = cursor.fetchone()
    if not pass_code:
        raise_api_error(ErrorCode.RESOURCE_NOT_FOUND, "放行码不存在", {"code": code})
    
    if pass_code["status"] != "ACTIVE":
        raise_api_error(ErrorCode.INVALID_STATUS, "放行码已失效", {"code": code, "status": pass_code["status"]})
    
    now = datetime.now()
    valid_from = datetime.fromisoformat(pass_code["valid_from"])
    valid_until = datetime.fromisoformat(pass_code["valid_until"])
    
    if now < valid_from or now > valid_until:
        raise_api_error(ErrorCode.INVALID_STATUS, "放行码不在有效期内", {
            "code": code,
            "valid_from": pass_code["valid_from"],
            "valid_until": pass_code["valid_until"]
        })
    
    return dict(pass_code)

@app.post("/pass-codes/{code}/use", response_model=PassCodeResponse)
def use_pass_code(code: str, db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM pass_codes WHERE code = ?", (code,))
    pass_code = cursor.fetchone()
    if not pass_code:
        raise_api_error(ErrorCode.RESOURCE_NOT_FOUND, "放行码不存在", {"code": code})
    
    if pass_code["status"] == "USED":
        raise_api_error(ErrorCode.ALREADY_PROCESSED, "放行码已使用", {"code": code})
    
    if pass_code["status"] != "ACTIVE":
        raise_api_error(ErrorCode.INVALID_STATUS, "放行码已失效", {"code": code, "status": pass_code["status"]})
    
    cursor.execute("UPDATE pass_codes SET status = 'USED', used_at = ? WHERE code = ?", (datetime.now(), code))
    cursor.execute(
        "UPDATE parking_spots SET status = 'OCCUPIED' WHERE id = ?",
        (pass_code["parking_spot_id"],)
    )
    
    cursor.execute(
        """INSERT INTO spot_occupancy_logs 
           (id, parking_spot_id, meeting_id, visitor_id, action, remarks)
           VALUES (?, ?, ?, ?, 'OCCUPIED', '放行码使用')""",
        (str(uuid.uuid4()), pass_code["parking_spot_id"], pass_code["meeting_id"], pass_code["visitor_id"])
    )
    
    db.commit()
    
    cursor.execute("""
        SELECT pc.*, ps.spot_number as parking_spot_number
        FROM pass_codes pc
        JOIN parking_spots ps ON pc.parking_spot_id = ps.id
        WHERE pc.code = ?
    """, (code,))
    return dict(cursor.fetchone())

@app.get("/reports/occupancy", response_model=OccupancyReportResponse)
def get_occupancy_report(report_date: Optional[date] = None, db: sqlite3.Connection = Depends(get_db)):
    if not report_date:
        report_date = date.today()
    
    cursor = db.cursor()
    cursor.execute("SELECT COUNT(*) as total FROM parking_spots")
    total = cursor.fetchone()["total"]
    
    cursor.execute("SELECT COUNT(*) as count FROM parking_spots WHERE status = 'OCCUPIED'")
    occupied = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM parking_spots WHERE status = 'LOCKED'")
    locked = cursor.fetchone()["count"]
    
    available = total - occupied - locked
    
    cursor.execute(
        "SELECT COUNT(*) as count FROM meetings WHERE status = 'CANCELLED' AND DATE(created_at) = ?",
        (str(report_date),)
    )
    cancelled = cursor.fetchone()["count"]
    
    report_id = str(uuid.uuid4())
    try:
        cursor.execute(
            """INSERT INTO occupancy_reports 
               (id, report_date, total_spots, occupied_spots, locked_spots, available_spots, cancelled_meetings)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (report_id, str(report_date), total, occupied, locked, available, cancelled)
        )
        db.commit()
    except sqlite3.IntegrityError:
        cursor.execute(
            """UPDATE occupancy_reports 
               SET total_spots = ?, occupied_spots = ?, locked_spots = ?, available_spots = ?, 
                   cancelled_meetings = ?, generated_at = CURRENT_TIMESTAMP
               WHERE report_date = ?""",
            (total, occupied, locked, available, cancelled, str(report_date))
        )
        db.commit()
        cursor.execute("SELECT * FROM occupancy_reports WHERE report_date = ?", (str(report_date),))
        return dict(cursor.fetchone())
    
    cursor.execute("SELECT * FROM occupancy_reports WHERE id = ?", (report_id,))
    return dict(cursor.fetchone())

@app.get("/reports/occupancy/export")
def export_occupancy_report(report_date: Optional[date] = None, db: sqlite3.Connection = Depends(get_db)):
    if not report_date:
        report_date = date.today()
    
    get_occupancy_report(report_date, db)
    
    cursor = db.cursor()
    cursor.execute("SELECT * FROM occupancy_reports WHERE report_date = ?", (str(report_date),))
    report = cursor.fetchone()
    
    cursor.execute("""
        SELECT ps.spot_number, ps.area, ps.status, m.title as meeting_title, v.name as visitor_name,
               pc.code as pass_code, pc.status as pass_code_status
        FROM parking_spots ps
        LEFT JOIN meetings m ON ps.current_meeting_id = m.id
        LEFT JOIN visitors v ON m.visitor_id = v.id
        LEFT JOIN pass_codes pc ON m.id = pc.meeting_id AND pc.status IN ('ACTIVE', 'USED')
        ORDER BY ps.spot_number
    """)
    spots = cursor.fetchall()
    
    cursor.execute("""
        SELECT * FROM cancellation_records 
        WHERE DATE(cancelled_at) = ?
        ORDER BY cancelled_at DESC
    """, (str(report_date),))
    cancellations = cursor.fetchall()
    
    filename = f"occupancy_report_{report_date}.csv"
    with open(filename, 'w', newline='', encoding='utf-8-sig') as f:
        writer = csv.writer(f)
        
        writer.writerow(["车位占用报告", f"报告日期: {report_date}"])
        writer.writerow([])
        writer.writerow(["总车位数", report["total_spots"]])
        writer.writerow(["已占用", report["occupied_spots"]])
        writer.writerow(["已锁定", report["locked_spots"]])
        writer.writerow(["可用", report["available_spots"]])
        writer.writerow(["今日取消会议数", report["cancelled_meetings"]])
        writer.writerow([])
        
        writer.writerow(["车位编号", "区域", "状态", "会议标题", "访客姓名", "放行码", "放行码状态"])
        for spot in spots:
            writer.writerow([
                spot["spot_number"], spot["area"], spot["status"],
                spot["meeting_title"] or "", spot["visitor_name"] or "",
                spot["pass_code"] or "", spot["pass_code_status"] or ""
            ])
        writer.writerow([])
        
        writer.writerow(["取消记录"])
        writer.writerow(["会议ID", "车位ID", "操作人", "取消原因", "取消时间", "释放时间", "是否需要复核"])
        for cancel in cancellations:
            writer.writerow([
                cancel["meeting_id"], cancel["parking_spot_id"], cancel["cancelled_by"],
                cancel["cancel_reason"] or "", cancel["cancelled_at"], cancel["released_at"] or "",
                "是" if cancel["needs_review"] else "否"
            ])
    
    return FileResponse(filename, media_type="text/csv", filename=filename)

@app.get("/cancellations/pending-review", response_model=List[CancellationResponse])
def get_pending_review_cancellations(db: sqlite3.Connection = Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT * FROM cancellation_records WHERE needs_review = 1 ORDER BY cancelled_at DESC")
    rows = cursor.fetchall()
    result = []
    for row in rows:
        item = dict(row)
        item["needs_review"] = bool(item["needs_review"])
        result.append(item)
    return result

