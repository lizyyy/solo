from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import StreamingResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import sqlite3
import json
import csv
from io import StringIO

app = FastAPI(title="异步导出配额拒绝理由后端API", version="1.0.0")

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    for error in exc.errors():
        if error["type"] == "missing":
            field_name = ".".join(str(loc) for loc in error["loc"])
            missing_fields.append(field_name)
    
    if missing_fields:
        return JSONResponse(
            status_code=400,
            content={
                "detail": {
                    "code": ErrorCode.MISSING_FIELD,
                    "message": f"缺少必填字段: {', '.join(missing_fields)}",
                    "missing_fields": missing_fields
                }
            }
        )
    
    return JSONResponse(
        status_code=400,
        content={
            "detail": {
                "code": ErrorCode.MISSING_FIELD,
                "message": f"请求参数错误: {exc.errors()}"
            }
        }
    )

DATABASE_PATH = "export_quota.db"

class ErrorCode:
    MISSING_FIELD = "MISSING_FIELD"
    INVALID_STATUS = "INVALID_STATUS"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    ALREADY_PROCESSED = "ALREADY_PROCESSED"
    QUOTA_EXCEEDED = "QUOTA_EXCEEDED"
    TENANT_NOT_FOUND = "TENANT_NOT_FOUND"
    TASK_NOT_FOUND = "TASK_NOT_FOUND"

class RejectReason:
    QUOTA_EXHAUSTED = "QUOTA_EXHAUSTED"
    FILE_SIZE_EXCEEDS_LIMIT = "FILE_SIZE_EXCEEDS_LIMIT"
    CONCURRENT_LIMIT_REACHED = "CONCURRENT_LIMIT_REACHED"
    MANUAL_REVIEW_REQUIRED = "MANUAL_REVIEW_REQUIRED"
    TASK_QUEUE_FULL = "TASK_QUEUE_FULL"

class TaskStatus:
    PENDING = "PENDING"
    PROCESSING = "PROCESSING"
    COMPLETED = "COMPLETED"
    REJECTED = "REJECTED"
    CANCELLED = "CANCELLED"

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    init_db(conn)
    return conn

def init_db(conn):
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS tenants (
            tenant_id TEXT PRIMARY KEY,
            tenant_name TEXT NOT NULL,
            max_concurrent_tasks INTEGER NOT NULL DEFAULT 2,
            max_daily_exports INTEGER NOT NULL DEFAULT 10,
            max_file_size_mb INTEGER NOT NULL DEFAULT 500,
            max_queue_size INTEGER NOT NULL DEFAULT 5,
            quota_window_hours INTEGER NOT NULL DEFAULT 24,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_active BOOLEAN DEFAULT 1
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS export_tasks (
            task_id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            task_name TEXT NOT NULL,
            file_size_mb INTEGER NOT NULL,
            status TEXT NOT NULL DEFAULT 'PENDING',
            priority INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            started_at TIMESTAMP,
            completed_at TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS quota_usage (
            usage_id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            quota_type TEXT NOT NULL,
            used_value INTEGER NOT NULL,
            window_start TIMESTAMP NOT NULL,
            window_end TIMESTAMP NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
            FOREIGN KEY (task_id) REFERENCES export_tasks(task_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS rejection_logs (
            rejection_id INTEGER PRIMARY KEY AUTOINCREMENT,
            tenant_id TEXT NOT NULL,
            task_id TEXT NOT NULL,
            reject_reason TEXT NOT NULL,
            reject_details TEXT,
            current_usage TEXT,
            quota_limits TEXT,
            rejected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            reviewed_by TEXT,
            reviewed_at TIMESTAMP,
            review_status TEXT DEFAULT 'PENDING',
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id),
            FOREIGN KEY (task_id) REFERENCES export_tasks(task_id)
        )
    ''')
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS task_queue (
            queue_id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id TEXT NOT NULL UNIQUE,
            tenant_id TEXT NOT NULL,
            enqueued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            position INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES export_tasks(task_id),
            FOREIGN KEY (tenant_id) REFERENCES tenants(tenant_id)
        )
    ''')
    
    conn.commit()

class TenantCreate(BaseModel):
    tenant_id: str
    tenant_name: str
    max_concurrent_tasks: int = Field(default=2, ge=1)
    max_daily_exports: int = Field(default=10, ge=1)
    max_file_size_mb: int = Field(default=500, ge=1)
    max_queue_size: int = Field(default=5, ge=1)
    quota_window_hours: int = Field(default=24, ge=1)

class TenantUpdate(BaseModel):
    tenant_name: Optional[str] = None
    max_concurrent_tasks: Optional[int] = Field(default=None, ge=1)
    max_daily_exports: Optional[int] = Field(default=None, ge=1)
    max_file_size_mb: Optional[int] = Field(default=None, ge=1)
    max_queue_size: Optional[int] = Field(default=None, ge=1)
    quota_window_hours: Optional[int] = Field(default=None, ge=1)
    is_active: Optional[bool] = None

class ExportTaskCreate(BaseModel):
    task_id: str
    tenant_id: str
    task_name: str
    file_size_mb: int = Field(gt=0)
    priority: int = Field(default=0, ge=0)

class RejectionResponse(BaseModel):
    rejected: bool
    reason: str = ""
    details: Optional[str] = None
    current_usage: Optional[Dict[str, Any]] = None
    quota_limits: Optional[Dict[str, Any]] = None
    retry_after_minutes: Optional[int] = None

@app.get("/")
def health_check():
    return {"status": "ok", "service": "export-quota-api"}

@app.post("/tenants")
def create_tenant(tenant: TenantCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute(
            "INSERT INTO tenants (tenant_id, tenant_name, max_concurrent_tasks, max_daily_exports, "
            "max_file_size_mb, max_queue_size, quota_window_hours) VALUES (?, ?, ?, ?, ?, ?, ?)",
            (tenant.tenant_id, tenant.tenant_name, tenant.max_concurrent_tasks, tenant.max_daily_exports,
             tenant.max_file_size_mb, tenant.max_queue_size, tenant.quota_window_hours)
        )
        conn.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.ALREADY_PROCESSED,
            "message": "租户已存在"
        })
    finally:
        conn.close()
    
    return {"message": "租户创建成功", "tenant_id": tenant.tenant_id}

@app.get("/tenants/{tenant_id}")
def get_tenant(tenant_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant = cursor.fetchone()
    conn.close()
    
    if not tenant:
        raise HTTPException(status_code=404, detail={
            "code": ErrorCode.TENANT_NOT_FOUND,
            "message": "租户不存在"
        })
    
    return dict(tenant)

@app.put("/tenants/{tenant_id}")
def update_tenant(tenant_id: str, tenant_update: TenantUpdate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    update_fields = []
    update_values = []
    
    for field, value in tenant_update.dict(exclude_unset=True).items():
        update_fields.append(f"{field} = ?")
        update_values.append(value)
    
    if not update_fields:
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.MISSING_FIELD,
            "message": "没有提供更新字段"
        })
    
    update_values.append(tenant_id)
    
    cursor.execute(
        f"UPDATE tenants SET {', '.join(update_fields)} WHERE tenant_id = ?",
        update_values
    )
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail={
            "code": ErrorCode.TENANT_NOT_FOUND,
            "message": "租户不存在"
        })
    
    conn.commit()
    conn.close()
    
    return {"message": "租户更新成功"}

def get_quota_usage(tenant_id: str, conn: sqlite3.Connection) -> Dict[str, Any]:
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM tenants WHERE tenant_id = ?", (tenant_id,))
    tenant = cursor.fetchone()
    
    if not tenant:
        return {}
    
    tenant_dict = dict(tenant)
    window_hours = tenant_dict["quota_window_hours"]
    window_start = datetime.now() - timedelta(hours=window_hours)
    
    cursor.execute(
        "SELECT COUNT(*) as count FROM export_tasks "
        "WHERE tenant_id = ? AND status = 'PROCESSING'",
        (tenant_id,)
    )
    concurrent_count = cursor.fetchone()["count"]
    
    cursor.execute(
        "SELECT COUNT(*) as count FROM export_tasks "
        "WHERE tenant_id = ? AND status IN ('COMPLETED', 'PROCESSING', 'PENDING') AND created_at >= ?",
        (tenant_id, window_start)
    )
    window_count = cursor.fetchone()["count"]
    
    cursor.execute(
        "SELECT COUNT(*) as count FROM task_queue WHERE tenant_id = ?",
        (tenant_id,)
    )
    queue_count = cursor.fetchone()["count"]
    
    return {
        "concurrent_tasks": concurrent_count,
        "window_exports": window_count,
        "queue_size": queue_count,
        "max_concurrent": tenant_dict["max_concurrent_tasks"],
        "max_window_exports": tenant_dict["max_daily_exports"],
        "max_file_size_mb": tenant_dict["max_file_size_mb"],
        "max_queue_size": tenant_dict["max_queue_size"],
        "window_hours": window_hours
    }

@app.post("/export-tasks/check")
def check_export_quota(task: ExportTaskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM tenants WHERE tenant_id = ? AND is_active = 1", (task.tenant_id,))
        tenant = cursor.fetchone()
        
        if not tenant:
            raise HTTPException(status_code=404, detail={
                "code": ErrorCode.TENANT_NOT_FOUND,
                "message": "租户不存在或已禁用"
            })
        
        tenant_dict = dict(tenant)
        usage = get_quota_usage(task.tenant_id, conn)
        
        cursor.execute("SELECT task_id FROM export_tasks WHERE task_id = ?", (task.task_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail={
                "code": ErrorCode.ALREADY_PROCESSED,
                "message": "任务ID已存在"
            })
        
        reject_reasons = []
        reject_details = []
        
        if task.file_size_mb > tenant_dict["max_file_size_mb"]:
            reject_reasons.append(RejectReason.FILE_SIZE_EXCEEDS_LIMIT)
            reject_details.append(f"文件大小 {task.file_size_mb}MB 超过限制 {tenant_dict['max_file_size_mb']}MB")
        
        if usage["window_exports"] >= usage["max_window_exports"]:
            reject_reasons.append(RejectReason.QUOTA_EXHAUSTED)
            reject_details.append(f"窗口内导出次数 {usage['window_exports']} 达到上限 {usage['max_window_exports']}")
        
        if usage["concurrent_tasks"] >= usage["max_concurrent"]:
            if usage["queue_size"] >= usage["max_queue_size"]:
                reject_reasons.append(RejectReason.TASK_QUEUE_FULL)
                reject_details.append(f"队列已满 ({usage['queue_size']}/{usage['max_queue_size']})")
        
        if reject_reasons:
            cursor.execute(
                "INSERT INTO export_tasks (task_id, tenant_id, task_name, file_size_mb, status) "
                "VALUES (?, ?, ?, ?, 'REJECTED')",
                (task.task_id, task.tenant_id, task.task_name, task.file_size_mb)
            )
            
            cursor.execute(
                "INSERT INTO rejection_logs (tenant_id, task_id, reject_reason, reject_details, "
                "current_usage, quota_limits) VALUES (?, ?, ?, ?, ?, ?)",
                (task.tenant_id, task.task_id, ",".join(reject_reasons),
                 "; ".join(reject_details),
                 json.dumps(usage, ensure_ascii=False),
                 json.dumps(tenant_dict, ensure_ascii=False))
            )
            
            conn.commit()
            
            return RejectionResponse(
                rejected=True,
                reason=reject_reasons[0],
                details="; ".join(reject_details),
                current_usage=usage,
                quota_limits=tenant_dict,
                retry_after_minutes=60
            )
        
        return RejectionResponse(
            rejected=False,
            reason="",
            current_usage=usage,
            quota_limits=tenant_dict
        )
        
    finally:
        conn.close()

@app.post("/export-tasks")
def create_export_task(task: ExportTaskCreate):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        check_result = check_export_quota(task)
        
        if check_result.rejected:
            raise HTTPException(status_code=429, detail={
                "code": ErrorCode.QUOTA_EXCEEDED,
                "message": check_result.details,
                "reasons": check_result.reason.split(","),
                "retry_after_minutes": check_result.retry_after_minutes
            })
        
        usage = get_quota_usage(task.tenant_id, conn)
        
        cursor.execute(
            "INSERT INTO quota_usage (tenant_id, task_id, quota_type, used_value, window_start, window_end) "
            "VALUES (?, ?, 'EXPORT_COUNT', 1, ?, ?)",
            (task.tenant_id, task.task_id,
             (datetime.now() - timedelta(hours=usage["window_hours"])).isoformat(),
             datetime.now().isoformat())
        )
        
        if usage["concurrent_tasks"] < usage["max_concurrent"]:
            status = TaskStatus.PROCESSING
            started_at = datetime.now().isoformat()
            
            cursor.execute(
                "INSERT INTO export_tasks (task_id, tenant_id, task_name, file_size_mb, status, started_at, priority) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (task.task_id, task.tenant_id, task.task_name, task.file_size_mb, status, started_at, task.priority)
            )
        else:
            status = TaskStatus.PENDING
            cursor.execute(
                "INSERT INTO export_tasks (task_id, tenant_id, task_name, file_size_mb, status, priority) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (task.task_id, task.tenant_id, task.task_name, task.file_size_mb, status, task.priority)
            )
            
            position = usage["queue_size"] + 1
            cursor.execute(
                "INSERT INTO task_queue (task_id, tenant_id, position) VALUES (?, ?, ?)",
                (task.task_id, task.tenant_id, position)
            )
        
        conn.commit()
        
        return {
            "task_id": task.task_id,
            "status": status,
            "message": "任务创建成功"
        }
        
    finally:
        conn.close()

@app.get("/export-tasks/{task_id}")
def get_export_task(task_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM export_tasks WHERE task_id = ?", (task_id,))
    task = cursor.fetchone()
    conn.close()
    
    if not task:
        raise HTTPException(status_code=404, detail={
            "code": ErrorCode.TASK_NOT_FOUND,
            "message": "任务不存在"
        })
    
    return dict(task)

@app.put("/export-tasks/{task_id}/complete")
def complete_task(task_id: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM export_tasks WHERE task_id = ?", (task_id,))
        task = cursor.fetchone()
        
        if not task:
            raise HTTPException(status_code=404, detail={
                "code": ErrorCode.TASK_NOT_FOUND,
                "message": "任务不存在"
            })
        
        if task["status"] != TaskStatus.PROCESSING:
            raise HTTPException(status_code=400, detail={
                "code": ErrorCode.INVALID_STATUS,
                "message": f"当前状态 {task['status']} 不允许完成"
            })
        
        cursor.execute(
            "UPDATE export_tasks SET status = 'COMPLETED', completed_at = ? WHERE task_id = ?",
            (datetime.now().isoformat(), task_id)
        )
        
        tenant_id = task["tenant_id"]
        cursor.execute(
            "SELECT tq.task_id, tq.position FROM task_queue tq "
            "JOIN export_tasks et ON tq.task_id = et.task_id "
            "WHERE tq.tenant_id = ? AND et.status = 'PENDING' "
            "ORDER BY et.priority DESC, tq.position ASC LIMIT 1",
            (tenant_id,)
        )
        next_task = cursor.fetchone()
        
        if next_task:
            cursor.execute(
                "UPDATE export_tasks SET status = 'PROCESSING', started_at = ? WHERE task_id = ?",
                (datetime.now().isoformat(), next_task["task_id"])
            )
            cursor.execute("DELETE FROM task_queue WHERE task_id = ?", (next_task["task_id"],))
            cursor.execute(
                "UPDATE task_queue SET position = position - 1 WHERE tenant_id = ? AND position > ?",
                (tenant_id, next_task["position"])
            )
        
        conn.commit()
        
        return {"message": "任务完成成功"}
        
    finally:
        conn.close()

@app.get("/tenants/{tenant_id}/usage")
def get_tenant_usage(tenant_id: str):
    conn = get_db_connection()
    usage = get_quota_usage(tenant_id, conn)
    conn.close()
    
    if not usage:
        raise HTTPException(status_code=404, detail={
            "code": ErrorCode.TENANT_NOT_FOUND,
            "message": "租户不存在"
        })
    
    return usage

@app.get("/rejections")
def list_rejections(
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    review_status: Optional[str] = None,
    limit: int = Query(default=100, ge=1, le=1000)
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = "SELECT * FROM rejection_logs WHERE 1=1"
    params = []
    
    if tenant_id:
        query += " AND tenant_id = ?"
        params.append(tenant_id)
    
    if start_date:
        query += " AND rejected_at >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND rejected_at <= ?"
        params.append(end_date)
    
    if review_status:
        query += " AND review_status = ?"
        params.append(review_status)
    
    query += " ORDER BY rejected_at DESC LIMIT ?"
    params.append(limit)
    
    cursor.execute(query, params)
    rejections = [dict(row) for row in cursor.fetchall()]
    conn.close()
    
    return rejections

@app.put("/rejections/{rejection_id}/review")
def review_rejection(
    rejection_id: int,
    review_status: str,
    reviewed_by: str
):
    if review_status not in ["APPROVED", "REJECTED", "ESCALATED"]:
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.MISSING_FIELD,
            "message": "review_status 必须是 APPROVED, REJECTED, 或 ESCALATED"
        })
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute(
        "UPDATE rejection_logs SET review_status = ?, reviewed_by = ?, reviewed_at = ? "
        "WHERE rejection_id = ?",
        (review_status, reviewed_by, datetime.now().isoformat(), rejection_id)
    )
    
    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail={
            "code": ErrorCode.NEEDS_REVIEW,
            "message": "拒绝记录不存在"
        })
    
    conn.commit()
    conn.close()
    
    return {"message": "审核成功"}

@app.get("/reports/usage/export")
def export_usage_report(
    tenant_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    query = """
        SELECT 
            t.tenant_id,
            t.tenant_name,
            DATE(et.created_at) as export_date,
            COUNT(*) as total_exports,
            SUM(CASE WHEN et.status = 'COMPLETED' THEN 1 ELSE 0 END) as completed_exports,
            SUM(CASE WHEN et.status = 'REJECTED' THEN 1 ELSE 0 END) as rejected_exports,
            SUM(et.file_size_mb) as total_file_size_mb,
            MAX(t.max_concurrent_tasks) as max_concurrent,
            MAX(t.max_daily_exports) as max_daily
        FROM export_tasks et
        JOIN tenants t ON et.tenant_id = t.tenant_id
        WHERE 1=1
    """
    params = []
    
    if tenant_id:
        query += " AND et.tenant_id = ?"
        params.append(tenant_id)
    
    if start_date:
        query += " AND et.created_at >= ?"
        params.append(start_date)
    
    if end_date:
        query += " AND et.created_at <= ?"
        params.append(end_date)
    
    query += " GROUP BY t.tenant_id, t.tenant_name, DATE(et.created_at) ORDER BY export_date DESC"
    
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "租户ID", "租户名称", "导出日期", "总导出次数", "完成次数",
        "拒绝次数", "总文件大小(MB)", "最大并发数", "日配额上限"
    ])
    
    for row in rows:
        writer.writerow([
            row["tenant_id"], row["tenant_name"], row["export_date"],
            row["total_exports"], row["completed_exports"], row["rejected_exports"],
            row["total_file_size_mb"], row["max_concurrent"], row["max_daily"]
        ])
    
    output.seek(0)
    filename = f"usage_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
