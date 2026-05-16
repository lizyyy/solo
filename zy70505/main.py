from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime
import sqlite3
import json
from enum import Enum

app = FastAPI(title="设备事件顺序修复API", version="1.0.0")

def init_db():
    conn = sqlite3.connect('event_fix.db')
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS device_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            event_sequence INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            event_data TEXT,
            receive_time DATETIME NOT NULL,
            room_id TEXT,
            raw_input TEXT NOT NULL,
            status TEXT DEFAULT 'pending',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS conflict_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            event_id INTEGER,
            conflict_type TEXT NOT NULL,
            conflict_detail TEXT,
            resolution TEXT,
            resolved_by TEXT,
            resolved_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fix_rules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            rule_name TEXT UNIQUE NOT NULL,
            rule_type TEXT NOT NULL,
            rule_config TEXT NOT NULL,
            is_active INTEGER DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS timeline_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            report_data TEXT NOT NULL,
            generated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS manual_corrections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            device_id TEXT NOT NULL,
            event_id INTEGER,
            original_sequence INTEGER,
            corrected_sequence INTEGER,
            reason TEXT NOT NULL,
            operator TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

class EventStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    CONFLICT = "conflict"
    FIXED = "fixed"
    MANUAL_CORRECTED = "manual_corrected"

class ConflictType(str, Enum):
    OUT_OF_ORDER = "out_of_order"
    DUPLICATE_SEQUENCE = "duplicate_sequence"
    MISSING_SEQUENCE = "missing_sequence"
    TIME_INCONSISTENCY = "time_inconsistency"

class DeviceEventCreate(BaseModel):
    device_id: str
    event_sequence: int
    event_type: str
    event_data: Optional[Dict[str, Any]] = None
    receive_time: datetime
    room_id: Optional[str] = None

class DeviceEventResponse(BaseModel):
    id: int
    device_id: str
    event_sequence: int
    event_type: str
    event_data: Optional[Dict[str, Any]]
    receive_time: datetime
    room_id: Optional[str]
    status: str
    created_at: datetime

class ConflictRecordResponse(BaseModel):
    id: int
    device_id: str
    event_id: Optional[int]
    conflict_type: str
    conflict_detail: Optional[str]
    resolution: Optional[str]
    resolved_by: Optional[str]
    resolved_at: Optional[datetime]
    created_at: datetime

class ManualCorrectionCreate(BaseModel):
    device_id: str
    event_id: int
    corrected_sequence: int
    reason: str
    operator: str

class TimelineReportResponse(BaseModel):
    id: int
    device_id: str
    report_data: Dict[str, Any]
    generated_at: datetime

class Database:
    def __init__(self):
        self.conn = sqlite3.connect('event_fix.db')
        self.conn.row_factory = sqlite3.Row
    
    def close(self):
        self.conn.close()
    
    def execute(self, query, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        self.conn.commit()
        return cursor
    
    def fetch_one(self, query, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchone()
    
    def fetch_all(self, query, params=()):
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return cursor.fetchall()

def row_to_dict(row):
    if row is None:
        return None
    result = dict(row)
    for key, value in result.items():
        if key in ['event_data', 'conflict_detail', 'report_data'] and value:
            try:
                result[key] = json.loads(value)
            except:
                pass
    return result

def detect_out_of_order(db, device_id: str, new_sequence: int):
    events = db.fetch_all(
        "SELECT event_sequence FROM device_events WHERE device_id = ? AND status != 'manual_corrected' ORDER BY event_sequence",
        (device_id,)
    )
    sequences = [e['event_sequence'] for e in events]
    
    if new_sequence in sequences:
        return ConflictType.DUPLICATE_SEQUENCE, f"序号 {new_sequence} 已存在"
    
    if sequences and new_sequence < max(sequences):
        return ConflictType.OUT_OF_ORDER, f"序号 {new_sequence} 小于当前最大序号 {max(sequences)}"
    
    if sequences:
        expected = max(sequences) + 1
        if new_sequence > expected:
            missing = list(range(expected, new_sequence))
            return ConflictType.MISSING_SEQUENCE, f"缺少序号: {missing}"
    
    return None, None

def advance_event_status(db, event_id: int, target_status: str, operator: str = None):
    event = db.fetch_one("SELECT * FROM device_events WHERE id = ?", (event_id,))
    if not event:
        raise HTTPException(status_code=404, detail="事件不存在")
    
    current_status = event['status']
    status_flow = {
        'pending': ['processing', 'conflict'],
        'processing': ['conflict', 'fixed'],
        'conflict': ['fixed', 'manual_corrected'],
        'fixed': [],
        'manual_corrected': []
    }
    
    if target_status not in status_flow[current_status]:
        raise HTTPException(
            status_code=400,
            detail=f"状态不合法: 不能从 {current_status} 推进到 {target_status}"
        )
    
    db.execute(
        "UPDATE device_events SET status = ? WHERE id = ?",
        (target_status, event_id)
    )
    return True

@app.post("/api/events", response_model=DeviceEventResponse, summary="创建设备事件")
async def create_event(event: DeviceEventCreate):
    db = Database()
    try:
        raw_input = json.dumps(event.dict(), ensure_ascii=False, default=str)
        
        conflict_type, conflict_detail = detect_out_of_order(db, event.device_id, event.event_sequence)
        
        status = EventStatus.PENDING
        if conflict_type:
            status = EventStatus.CONFLICT
        
        cursor = db.execute(
            """INSERT INTO device_events 
               (device_id, event_sequence, event_type, event_data, receive_time, room_id, raw_input, status)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                event.device_id,
                event.event_sequence,
                event.event_type,
                json.dumps(event.event_data) if event.event_data else None,
                event.receive_time,
                event.room_id,
                raw_input,
                status
            )
        )
        
        event_id = cursor.lastrowid
        
        if conflict_type:
            db.execute(
                """INSERT INTO conflict_records 
                   (device_id, event_id, conflict_type, conflict_detail)
                   VALUES (?, ?, ?, ?)""",
                (event.device_id, event_id, conflict_type, conflict_detail)
            )
        
        new_event = db.fetch_one("SELECT * FROM device_events WHERE id = ?", (event_id,))
        return row_to_dict(new_event)
    finally:
        db.close()

@app.get("/api/events", response_model=List[DeviceEventResponse], summary="查询设备事件列表")
async def list_events(
    device_id: Optional[str] = Query(None, description="设备编号"),
    status: Optional[str] = Query(None, description="状态"),
    limit: int = Query(100, description="返回数量限制")
):
    db = Database()
    try:
        query = "SELECT * FROM device_events WHERE 1=1"
        params = []
        
        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)
        if status:
            query += " AND status = ?"
            params.append(status)
        
        query += " ORDER BY event_sequence LIMIT ?"
        params.append(limit)
        
        events = db.fetch_all(query, params)
        return [row_to_dict(e) for e in events]
    finally:
        db.close()

@app.get("/api/events/{event_id}", response_model=DeviceEventResponse, summary="查询单个事件")
async def get_event(event_id: int):
    db = Database()
    try:
        event = db.fetch_one("SELECT * FROM device_events WHERE id = ?", (event_id,))
        if not event:
            raise HTTPException(status_code=404, detail="事件不存在")
        return row_to_dict(event)
    finally:
        db.close()

@app.post("/api/events/{event_id}/status", summary="推进事件状态")
async def update_event_status(
    event_id: int,
    target_status: str = Query(..., description="目标状态"),
    operator: Optional[str] = Query(None, description="操作人")
):
    db = Database()
    try:
        advance_event_status(db, event_id, target_status, operator)
        
        event = db.fetch_one("SELECT * FROM device_events WHERE id = ?", (event_id,))
        return {
            "success": True,
            "event_id": event_id,
            "current_status": event['status'],
            "operator": operator
        }
    finally:
        db.close()

@app.get("/api/conflicts", response_model=List[ConflictRecordResponse], summary="查询冲突记录")
async def list_conflicts(
    device_id: Optional[str] = Query(None, description="设备编号"),
    resolved: Optional[bool] = Query(None, description="是否已解决")
):
    db = Database()
    try:
        query = "SELECT * FROM conflict_records WHERE 1=1"
        params = []
        
        if device_id:
            query += " AND device_id = ?"
            params.append(device_id)
        
        if resolved is not None:
            if resolved:
                query += " AND resolved_at IS NOT NULL"
            else:
                query += " AND resolved_at IS NULL"
        
        query += " ORDER BY created_at DESC"
        
        conflicts = db.fetch_all(query, params)
        return [row_to_dict(c) for c in conflicts]
    finally:
        db.close()

@app.post("/api/manual-correction", summary="人工修正事件序号")
async def manual_correction(correction: ManualCorrectionCreate):
    db = Database()
    try:
        event = db.fetch_one("SELECT * FROM device_events WHERE id = ?", (correction.event_id,))
        if not event:
            raise HTTPException(status_code=404, detail="事件不存在")
        
        if event['device_id'] != correction.device_id:
            raise HTTPException(status_code=400, detail="设备编号不匹配")
        
        original_sequence = event['event_sequence']
        
        duplicate = db.fetch_one(
            "SELECT id FROM device_events WHERE device_id = ? AND event_sequence = ? AND id != ?",
            (correction.device_id, correction.corrected_sequence, correction.event_id)
        )
        if duplicate:
            raise HTTPException(status_code=400, detail=f"修正后的序号 {correction.corrected_sequence} 已存在")
        
        db.execute(
            """INSERT INTO manual_corrections 
               (device_id, event_id, original_sequence, corrected_sequence, reason, operator)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (
                correction.device_id,
                correction.event_id,
                original_sequence,
                correction.corrected_sequence,
                correction.reason,
                correction.operator
            )
        )
        
        db.execute(
            "UPDATE device_events SET event_sequence = ?, status = 'manual_corrected' WHERE id = ?",
            (correction.corrected_sequence, correction.event_id)
        )
        
        db.execute(
            "UPDATE conflict_records SET resolution = ?, resolved_by = ?, resolved_at = ? WHERE event_id = ?",
            (f"人工修正: {correction.reason}", correction.operator, datetime.now(), correction.event_id)
        )
        
        return {
            "success": True,
            "event_id": correction.event_id,
            "original_sequence": original_sequence,
            "corrected_sequence": correction.corrected_sequence,
            "operator": correction.operator
        }
    finally:
        db.close()

@app.get("/api/timeline/{device_id}", response_model=TimelineReportResponse, summary="生成设备时间线报告")
async def generate_timeline(device_id: str):
    db = Database()
    try:
        events = db.fetch_all(
            "SELECT * FROM device_events WHERE device_id = ? ORDER BY event_sequence",
            (device_id,)
        )
        
        conflicts = db.fetch_all(
            "SELECT * FROM conflict_records WHERE device_id = ? ORDER BY created_at",
            (device_id,)
        )
        
        corrections = db.fetch_all(
            "SELECT * FROM manual_corrections WHERE device_id = ? ORDER BY created_at",
            (device_id,)
        )
        
        event_list = []
        for e in events:
            event_dict = row_to_dict(e)
            event_list.append({
                "event_id": e['id'],
                "sequence": e['event_sequence'],
                "event_type": e['event_type'],
                "receive_time": e['receive_time'],
                "status": e['status'],
                "room_id": e['room_id']
            })
        
        conflict_summary = []
        for c in conflicts:
            conflict_summary.append({
                "conflict_id": c['id'],
                "type": c['conflict_type'],
                "detail": c['conflict_detail'],
                "resolution": c['resolution'],
                "resolved": c['resolved_at'] is not None
            })
        
        report_data = {
            "device_id": device_id,
            "total_events": len(events),
            "event_sequence_chain": [e['event_sequence'] for e in events],
            "events": event_list,
            "conflicts": conflict_summary,
            "manual_corrections": [row_to_dict(c) for c in corrections],
            "generated_at": datetime.now().isoformat(),
            "anomalies": []
        }
        
        sequences = [e['event_sequence'] for e in events]
        if sequences:
            min_seq, max_seq = min(sequences), max(sequences)
            expected = set(range(min_seq, max_seq + 1))
            actual = set(sequences)
            missing = sorted(expected - actual)
            if missing:
                report_data["anomalies"].append({
                    "type": "missing_sequences",
                    "description": f"缺少序号: {missing}"
                })
            
            duplicates = [s for s in sequences if sequences.count(s) > 1]
            if duplicates:
                report_data["anomalies"].append({
                    "type": "duplicate_sequences",
                    "description": f"重复序号: {list(set(duplicates))}"
                })
        
        cursor = db.execute(
            "INSERT INTO timeline_reports (device_id, report_data) VALUES (?, ?)",
            (device_id, json.dumps(report_data, ensure_ascii=False))
        )
        
        report_id = cursor.lastrowid
        report = db.fetch_one("SELECT * FROM timeline_reports WHERE id = ?", (report_id,))
        return row_to_dict(report)
    finally:
        db.close()

@app.get("/api/export/{device_id}", summary="导出设备事件数据")
async def export_device_data(device_id: str):
    db = Database()
    try:
        events = db.fetch_all(
            "SELECT * FROM device_events WHERE device_id = ? ORDER BY event_sequence",
            (device_id,)
        )
        
        conflicts = db.fetch_all(
            "SELECT * FROM conflict_records WHERE device_id = ?",
            (device_id,)
        )
        
        corrections = db.fetch_all(
            "SELECT * FROM manual_corrections WHERE device_id = ?",
            (device_id,)
        )
        
        export_data = {
            "device_id": device_id,
            "export_time": datetime.now().isoformat(),
            "summary": {
                "total_events": len(events),
                "total_conflicts": len(conflicts),
                "total_corrections": len(corrections),
                "status_distribution": {}
            },
            "events": [],
            "conflict_explanations": []
        }
        
        status_counts = {}
        for e in events:
            status = e['status']
            status_counts[status] = status_counts.get(status, 0) + 1
        
        export_data["summary"]["status_distribution"] = status_counts
        
        for e in events:
            event_dict = dict(e)
            export_data["events"].append({
                "event_id": e['id'],
                "sequence": e['event_sequence'],
                "event_type": e['event_type'],
                "receive_time": e['receive_time'],
                "room_id": e['room_id'],
                "status": e['status'],
                "raw_input": json.loads(e['raw_input']) if e['raw_input'] else None,
                "processing_basis": "按事件序号自然排序" if e['status'] in ['fixed', 'pending'] else None
            })
        
        for c in conflicts:
            export_data["conflict_explanations"].append({
                "conflict_type": c['conflict_type'],
                "conflict_detail": c['conflict_detail'],
                "resolution": c['resolution'],
                "resolved_by": c['resolved_by'],
                "resolved_at": c['resolved_at'],
                "conclusion": c['resolution'] if c['resolution'] else "待处理"
            })
        
        return JSONResponse(content=export_data)
    finally:
        db.close()

@app.get("/api/health", summary="健康检查")
async def health_check():
    return {"status": "ok", "service": "event-fix-service"}

init_db()
