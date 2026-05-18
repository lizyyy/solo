from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, validator
from datetime import datetime, date
from typing import Optional, List, Dict, Any
from enum import Enum
import sqlite3
import json
import csv
from io import StringIO
from contextlib import contextmanager

DATABASE_PATH = "parking_reconciliation.db"

class DeductStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    SUCCESS = "success"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    DUPLICATE = "duplicate"

class ApiErrorType(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    VALIDATION_ERROR = "validation_error"
    DUPLICATE = "duplicate"

class ApiException(HTTPException):
    def __init__(self, error_type: ApiErrorType, message: str, details: Dict[str, Any] = None):
        super().__init__(status_code=400, detail={
            "error_type": error_type,
            "message": message,
            "details": details or {}
        })

@contextmanager
def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()

def init_db():
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS monthly_packages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL UNIQUE,
            package_name TEXT NOT NULL,
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            total_amount REAL NOT NULL,
            balance REAL NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS gate_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            event_unique_id TEXT NOT NULL UNIQUE,
            plate_number TEXT NOT NULL,
            pass_time TIMESTAMP NOT NULL,
            direction TEXT NOT NULL,
            gate_id TEXT NOT NULL,
            is_deducted BOOLEAN DEFAULT 0,
            deduction_record_id INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS deduction_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            package_id INTEGER,
            amount REAL NOT NULL,
            deduction_time TIMESTAMP NOT NULL,
            deduction_type TEXT NOT NULL,
            event_id INTEGER,
            status TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (package_id) REFERENCES monthly_packages(id),
            FOREIGN KEY (event_id) REFERENCES gate_events(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS supplementary_deductions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            plate_number TEXT NOT NULL,
            event_id INTEGER,
            amount REAL NOT NULL,
            status TEXT NOT NULL,
            applied_package_id INTEGER,
            requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            processed_at TIMESTAMP,
            review_notes TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (event_id) REFERENCES gate_events(id),
            FOREIGN KEY (applied_package_id) REFERENCES monthly_packages(id)
        )
        ''')
        
        cursor.execute('''
        CREATE TABLE IF NOT EXISTS reconciliation_summaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            summary_date DATE NOT NULL UNIQUE,
            total_events INTEGER DEFAULT 0,
            total_deductions INTEGER DEFAULT 0,
            total_amount REAL DEFAULT 0,
            missing_deductions INTEGER DEFAULT 0,
            supplementary_count INTEGER DEFAULT 0,
            reconciliation_status TEXT DEFAULT 'pending',
            generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        ''')
        
        conn.commit()

init_db()

app = FastAPI(title="月租扣费道闸事件对账闭环API", version="1.0.0")

class MonthlyPackageCreate(BaseModel):
    plate_number: str = Field(..., description="车牌号")
    package_name: str = Field(..., description="套餐名称")
    start_date: date = Field(..., description="套餐开始日期")
    end_date: date = Field(..., description="套餐结束日期")
    total_amount: float = Field(..., gt=0, description="套餐总金额")
    initial_balance: Optional[float] = Field(None, description="初始余额，默认等于总金额")
    
    @validator('end_date')
    def end_date_after_start_date(cls, v, values):
        if 'start_date' in values and v <= values['start_date']:
            raise ValueError("结束日期必须晚于开始日期")
        return v

class GateEventImport(BaseModel):
    event_unique_id: str = Field(..., description="事件唯一ID，用于去重")
    plate_number: str = Field(..., description="车牌号")
    pass_time: datetime = Field(..., description="通过时间")
    direction: str = Field(..., description="方向：in/out")
    gate_id: str = Field(..., description="道闸ID")
    
    @validator('direction')
    def validate_direction(cls, v):
        if v not in ['in', 'out']:
            raise ValueError("方向只能是 'in' 或 'out'")
        return v

class SupplementaryDeductionCreate(BaseModel):
    plate_number: str = Field(..., description="车牌号")
    event_id: int = Field(..., description="道闸事件ID")
    amount: float = Field(..., gt=0, description="补扣金额")

@app.post("/api/packages/", summary="导入月租套餐")
def create_package(package: MonthlyPackageCreate):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        balance = package.initial_balance if package.initial_balance is not None else package.total_amount
        
        try:
            cursor.execute('''
            INSERT INTO monthly_packages 
            (plate_number, package_name, start_date, end_date, total_amount, balance)
            VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                package.plate_number,
                package.package_name,
                package.start_date.isoformat(),
                package.end_date.isoformat(),
                package.total_amount,
                balance
            ))
            conn.commit()
            return {"id": cursor.lastrowid, "message": "套餐创建成功", "balance": balance}
        except sqlite3.IntegrityError:
            raise ApiException(
                ApiErrorType.ALREADY_PROCESSED,
                f"车牌号 {package.plate_number} 的套餐已存在",
                {"plate_number": package.plate_number}
            )

@app.get("/api/packages/", summary="查询月租套餐列表")
def list_packages(plate_number: Optional[str] = Query(None, description="车牌号筛选")):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        if plate_number:
            cursor.execute('SELECT * FROM monthly_packages WHERE plate_number = ?', (plate_number,))
        else:
            cursor.execute('SELECT * FROM monthly_packages')
        
        packages = [dict(row) for row in cursor.fetchall()]
        return {"packages": packages, "count": len(packages)}

def is_package_valid(package: sqlite3.Row, check_date: date) -> bool:
    start_date = date.fromisoformat(package['start_date'])
    end_date = date.fromisoformat(package['end_date'])
    return start_date <= check_date <= end_date

@app.post("/api/events/", summary="导入道闸事件（自动去重）")
def import_gate_event(event: GateEventImport):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT id FROM gate_events WHERE event_unique_id = ?', (event.event_unique_id,))
        if cursor.fetchone():
            raise ApiException(
                ApiErrorType.DUPLICATE,
                f"事件 {event.event_unique_id} 已存在",
                {"event_unique_id": event.event_unique_id}
            )
        
        check_date = event.pass_time.date()
        cursor.execute('SELECT * FROM monthly_packages WHERE plate_number = ?', (event.plate_number,))
        package = cursor.fetchone()
        
        should_deduct = False
        if package and is_package_valid(package, check_date):
            should_deduct = package['balance'] > 0
        
        cursor.execute('''
        INSERT INTO gate_events 
        (event_unique_id, plate_number, pass_time, direction, gate_id)
        VALUES (?, ?, ?, ?, ?)
        ''', (
            event.event_unique_id,
            event.plate_number,
            event.pass_time.isoformat(),
            event.direction,
            event.gate_id
        ))
        
        event_id = cursor.lastrowid
        
        if should_deduct and event.direction == 'out':
            deduct_amount = 5.0
            new_balance = package['balance'] - deduct_amount
            
            cursor.execute('''
            INSERT INTO deduction_records
            (plate_number, package_id, amount, deduction_time, deduction_type, event_id, status)
            VALUES (?, ?, ?, ?, 'automatic', ?, 'success')
            ''', (event.plate_number, package['id'], deduct_amount, event.pass_time.isoformat(), event_id))
            
            deduction_id = cursor.lastrowid
            
            cursor.execute('''
            UPDATE monthly_packages SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
            ''', (new_balance, package['id']))
            
            cursor.execute('''
            UPDATE gate_events SET is_deducted = 1, deduction_record_id = ? WHERE id = ?
            ''', (deduction_id, event_id))
        
        conn.commit()
        
        return {
            "event_id": event_id,
            "message": "事件导入成功",
            "auto_deducted": should_deduct and event.direction == 'out'
        }

@app.get("/api/events/", summary="查询道闸事件")
def list_events(
    plate_number: Optional[str] = Query(None, description="车牌号"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    is_deducted: Optional[bool] = Query(None, description="是否已扣费")
):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        query = 'SELECT * FROM gate_events WHERE 1=1'
        params = []
        
        if plate_number:
            query += ' AND plate_number = ?'
            params.append(plate_number)
        
        if start_date:
            query += ' AND DATE(pass_time) >= ?'
            params.append(start_date.isoformat())
        
        if end_date:
            query += ' AND DATE(pass_time) <= ?'
            params.append(end_date.isoformat())
        
        if is_deducted is not None:
            query += ' AND is_deducted = ?'
            params.append(1 if is_deducted else 0)
        
        query += ' ORDER BY pass_time DESC'
        
        cursor.execute(query, params)
        events = [dict(row) for row in cursor.fetchall()]
        
        return {"events": events, "count": len(events)}

@app.post("/api/supplementary-deductions/", summary="创建补扣申请")
def create_supplementary_deduction(deduction: SupplementaryDeductionCreate):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM gate_events WHERE id = ?', (deduction.event_id,))
        event = cursor.fetchone()
        if not event:
            raise ApiException(
                ApiErrorType.VALIDATION_ERROR,
                f"事件ID {deduction.event_id} 不存在",
                {"event_id": deduction.event_id}
            )
        
        if event['is_deducted']:
            raise ApiException(
                ApiErrorType.ALREADY_PROCESSED,
                "该事件已扣费",
                {"event_id": deduction.event_id}
            )
        
        cursor.execute('SELECT * FROM monthly_packages WHERE plate_number = ?', (deduction.plate_number,))
        package = cursor.fetchone()
        
        if not package:
            raise ApiException(
                ApiErrorType.NEEDS_MANUAL_REVIEW,
                f"车牌号 {deduction.plate_number} 无有效套餐，需要人工处理",
                {"plate_number": deduction.plate_number}
            )
        
        event_date = datetime.fromisoformat(event['pass_time']).date()
        if not is_package_valid(package, event_date):
            raise ApiException(
                ApiErrorType.INVALID_STATE,
                "套餐在事件发生时已过期",
                {"plate_number": deduction.plate_number, "event_date": event_date.isoformat()}
            )
        
        cursor.execute('''
        SELECT * FROM supplementary_deductions 
        WHERE event_id = ? AND status IN ('pending', 'processing', 'success')
        ''', (deduction.event_id,))
        if cursor.fetchone():
            raise ApiException(
                ApiErrorType.ALREADY_PROCESSED,
                "该事件已有待处理或已完成的补扣申请",
                {"event_id": deduction.event_id}
            )
        
        cursor.execute('''
        INSERT INTO supplementary_deductions
        (plate_number, event_id, amount, status)
        VALUES (?, ?, ?, 'pending')
        ''', (deduction.plate_number, deduction.event_id, deduction.amount))
        
        conn.commit()
        
        return {
            "supplementary_id": cursor.lastrowid,
            "message": "补扣申请创建成功",
            "status": DeductStatus.PENDING
        }

@app.post("/api/supplementary-deductions/{deduction_id}/process", summary="处理补扣申请")
def process_supplementary_deduction(deduction_id: int):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM supplementary_deductions WHERE id = ?', (deduction_id,))
        deduction = cursor.fetchone()
        
        if not deduction:
            raise ApiException(
                ApiErrorType.VALIDATION_ERROR,
                f"补扣申请 {deduction_id} 不存在",
                {"deduction_id": deduction_id}
            )
        
        if deduction['status'] == DeductStatus.SUCCESS:
            raise ApiException(
                ApiErrorType.ALREADY_PROCESSED,
                "补扣申请已处理成功",
                {"deduction_id": deduction_id}
            )
        
        if deduction['status'] != DeductStatus.PENDING:
            raise ApiException(
                ApiErrorType.INVALID_STATE,
                f"当前状态 {deduction['status']} 不允许处理",
                {"deduction_id": deduction_id, "current_status": deduction['status']}
            )
        
        cursor.execute('SELECT * FROM monthly_packages WHERE plate_number = ?', (deduction['plate_number'],))
        package = cursor.fetchone()
        
        if not package or package['balance'] < deduction['amount']:
            cursor.execute('''
            UPDATE supplementary_deductions 
            SET status = 'needs_review', processed_at = CURRENT_TIMESTAMP, review_notes = ?
            WHERE id = ?
            ''', ("余额不足或无有效套餐", deduction_id))
            conn.commit()
            raise ApiException(
                ApiErrorType.NEEDS_MANUAL_REVIEW,
                "余额不足，需要人工复核",
                {"deduction_id": deduction_id, "current_balance": package['balance'] if package else 0}
            )
        
        cursor.execute('''
        UPDATE supplementary_deductions 
        SET status = 'processing', processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
        ''', (deduction_id,))
        
        new_balance = package['balance'] - deduction['amount']
        cursor.execute('''
        UPDATE monthly_packages 
        SET balance = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
        ''', (new_balance, package['id']))
        
        cursor.execute('''
        INSERT INTO deduction_records
        (plate_number, package_id, amount, deduction_time, deduction_type, event_id, status)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP, 'supplementary', ?, 'success')
        ''', (deduction['plate_number'], package['id'], deduction['amount'], deduction['event_id']))
        
        deduction_record_id = cursor.lastrowid
        
        cursor.execute('''
        UPDATE gate_events 
        SET is_deducted = 1, deduction_record_id = ? 
        WHERE id = ?
        ''', (deduction_record_id, deduction['event_id']))
        
        cursor.execute('''
        UPDATE supplementary_deductions 
        SET status = 'success', applied_package_id = ?
        WHERE id = ?
        ''', (package['id'], deduction_id))
        
        conn.commit()
        
        return {
            "deduction_id": deduction_id,
            "message": "补扣处理成功",
            "new_balance": new_balance,
            "status": DeductStatus.SUCCESS
        }

@app.get("/api/supplementary-deductions/", summary="查询补扣申请列表")
def list_supplementary_deductions(
    status: Optional[DeductStatus] = Query(None, description="状态筛选"),
    plate_number: Optional[str] = Query(None, description="车牌号筛选")
):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        query = 'SELECT * FROM supplementary_deductions WHERE 1=1'
        params = []
        
        if status:
            query += ' AND status = ?'
            params.append(status)
        
        if plate_number:
            query += ' AND plate_number = ?'
            params.append(plate_number)
        
        query += ' ORDER BY requested_at DESC'
        
        cursor.execute(query, params)
        deductions = [dict(row) for row in cursor.fetchall()]
        
        return {"deductions": deductions, "count": len(deductions)}

@app.post("/api/reconciliation/generate", summary="生成对账摘要")
def generate_reconciliation_summary(target_date: date = Query(..., description="对账日期")):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        target_date_str = target_date.isoformat()
        
        cursor.execute('SELECT id FROM reconciliation_summaries WHERE summary_date = ?', (target_date_str,))
        existing = cursor.fetchone()
        
        cursor.execute('''
        SELECT COUNT(*) as total, SUM(is_deducted) as deducted
        FROM gate_events 
        WHERE DATE(pass_time) = ? AND direction = 'out'
        ''', (target_date_str,))
        event_stats = cursor.fetchone()
        
        total_events = event_stats['total'] or 0
        total_deducted = event_stats['deducted'] or 0
        missing_deductions = total_events - total_deducted
        
        cursor.execute('''
        SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as amount
        FROM deduction_records 
        WHERE DATE(deduction_time) = ?
        ''', (target_date_str,))
        deduction_stats = cursor.fetchone()
        
        cursor.execute('''
        SELECT COUNT(*) as count
        FROM supplementary_deductions 
        WHERE DATE(requested_at) = ? AND status = 'success'
        ''', (target_date_str,))
        supplementary_stats = cursor.fetchone()
        
        if existing:
            cursor.execute('''
            UPDATE reconciliation_summaries
            SET total_events = ?, total_deductions = ?, total_amount = ?,
                missing_deductions = ?, supplementary_count = ?,
                reconciliation_status = ?, generated_at = CURRENT_TIMESTAMP
            WHERE summary_date = ?
            ''', (
                total_events,
                deduction_stats['count'] or 0,
                deduction_stats['amount'] or 0,
                missing_deductions,
                supplementary_stats['count'] or 0,
                'completed' if missing_deductions == 0 else 'needs_review',
                target_date_str
            ))
            summary_id = existing['id']
        else:
            cursor.execute('''
            INSERT INTO reconciliation_summaries
            (summary_date, total_events, total_deductions, total_amount, 
             missing_deductions, supplementary_count, reconciliation_status)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                target_date_str,
                total_events,
                deduction_stats['count'] or 0,
                deduction_stats['amount'] or 0,
                missing_deductions,
                supplementary_stats['count'] or 0,
                'completed' if missing_deductions == 0 else 'needs_review'
            ))
            summary_id = cursor.lastrowid
        
        conn.commit()
        
        cursor.execute('SELECT * FROM reconciliation_summaries WHERE id = ?', (summary_id,))
        summary = dict(cursor.fetchone())
        
        return {"summary": summary, "message": "对账摘要生成成功"}

@app.get("/api/reconciliation/export", summary="导出对账数据CSV")
def export_reconciliation(
    start_date: date = Query(..., description="开始日期"),
    end_date: date = Query(..., description="结束日期")
):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        cursor.execute('''
        SELECT 
            ge.plate_number,
            ge.pass_time,
            ge.direction,
            ge.gate_id,
            ge.is_deducted,
            dr.amount as deduction_amount,
            dr.deduction_type,
            sd.status as supplementary_status
        FROM gate_events ge
        LEFT JOIN deduction_records dr ON ge.deduction_record_id = dr.id
        LEFT JOIN supplementary_deductions sd ON ge.id = sd.event_id
        WHERE DATE(ge.pass_time) BETWEEN ? AND ?
        ORDER BY ge.pass_time DESC
        ''', (start_date.isoformat(), end_date.isoformat()))
        
        rows = cursor.fetchall()
        
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            '车牌号', '通过时间', '方向', '道闸ID', 
            '是否扣费', '扣费金额', '扣费类型', '补扣状态'
        ])
        
        for row in rows:
            writer.writerow([
                row['plate_number'],
                row['pass_time'],
                row['direction'],
                row['gate_id'],
                '是' if row['is_deducted'] else '否',
                row['deduction_amount'] or '',
                row['deduction_type'] or '',
                row['supplementary_status'] or ''
            ])
        
        output.seek(0)
        
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=reconciliation_{start_date}_{end_date}.csv"}
        )

@app.get("/api/deduction-records/", summary="查询扣费流水")
def list_deduction_records(
    plate_number: Optional[str] = Query(None, description="车牌号"),
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期")
):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        
        query = 'SELECT * FROM deduction_records WHERE 1=1'
        params = []
        
        if plate_number:
            query += ' AND plate_number = ?'
            params.append(plate_number)
        
        if start_date:
            query += ' AND DATE(deduction_time) >= ?'
            params.append(start_date.isoformat())
        
        if end_date:
            query += ' AND DATE(deduction_time) <= ?'
            params.append(end_date.isoformat())
        
        query += ' ORDER BY deduction_time DESC'
        
        cursor.execute(query, params)
        records = [dict(row) for row in cursor.fetchall()]
        
        return {"records": records, "count": len(records)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
