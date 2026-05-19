from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import date
import io

from database import get_db, init_db, Device, Contract, PhotoRecord, ReconciliationTask
from excel_importer import import_devices_from_excel, import_contracts_from_excel, import_photos_from_excel, generate_sample_excel_files
from reconciliation import (
    create_reconciliation_task, run_reconciliation, get_reconciliation_summary,
    review_record, recalculate_task, get_reconciliation_records
)
from report_generator import generate_excel_report, generate_text_summary

app = FastAPI(title="楼宇维保对账服务", description="设备台账、巡检照片、合同期限自动比对对账系统")


@app.on_event("startup")
def startup_event():
    init_db()


class ReviewRequest(BaseModel):
    review_notes: str
    corrections: Optional[dict] = None


class TaskInfo(BaseModel):
    id: int
    task_code: str
    task_name: str
    status: str
    created_at: Optional[str] = None


@app.get("/")
def root():
    return {"message": "楼宇维保对账服务 API", "version": "1.0.0"}


@app.post("/import/devices", summary="导入设备台账Excel")
async def import_devices(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = import_devices_from_excel(db, content)
    return {"success": True, "message": f"成功导入 {result['imported']} 条设备记录"}


@app.post("/import/contracts", summary="导入合同Excel")
async def import_contracts(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = import_contracts_from_excel(db, content)
    return {"success": True, "message": f"成功导入 {result['imported']} 条合同记录"}


@app.post("/import/photos", summary="导入照片清单Excel")
async def import_photos(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    result = import_photos_from_excel(db, content)
    return {"success": True, "message": f"成功导入 {result['imported']} 条照片记录"}


@app.get("/sample/generate", summary="生成样例Excel文件")
def generate_samples():
    files = generate_sample_excel_files()
    return {"success": True, "files": files}


@app.post("/tasks/create", summary="创建对账任务")
def create_task(task_name: str, db: Session = Depends(get_db)):
    task = create_reconciliation_task(db, task_name)
    return {"success": True, "task_id": task.id, "task_code": task.task_code}


@app.post("/tasks/{task_id}/run", summary="执行对账任务")
def run_task(task_id: int, db: Session = Depends(get_db)):
    result = run_reconciliation(db, task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "summary": result}


@app.post("/tasks/{task_id}/recalculate", summary="重新计算对账任务")
def recalculate(task_id: int, db: Session = Depends(get_db)):
    result = recalculate_task(db, task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "summary": result}


@app.get("/tasks/{task_id}/summary", summary="获取对账汇总")
def get_summary(task_id: int, db: Session = Depends(get_db)):
    result = get_reconciliation_summary(db, task_id)
    if not result:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "summary": result}


@app.get("/tasks/{task_id}/records", summary="获取对账明细")
def get_records(task_id: int, filter: Optional[str] = None, db: Session = Depends(get_db)):
    records = get_reconciliation_records(db, task_id, filter)
    result = []
    for r in records:
        result.append({
            "id": r.id,
            "device_code": r.device_code,
            "device_type": r.device_type,
            "device_name": r.device_name,
            "floor": r.floor,
            "area": r.area,
            "contract_status": r.contract_status,
            "contract_count": r.contract_count,
            "maintenance_status": r.maintenance_status,
            "overdue_days": r.maintenance_overdue_days,
            "photo_status": r.photo_status,
            "photo_count": r.photo_count,
            "overall_status": r.overall_status,
            "issues": r.issues,
            "needs_review": r.needs_review,
            "is_reviewed": r.is_reviewed,
            "review_notes": r.review_notes
        })
    return {"success": True, "records": result}


@app.post("/records/{record_id}/review", summary="复核对账记录")
def review(record_id: int, request: ReviewRequest, db: Session = Depends(get_db)):
    result = review_record(db, record_id, request.review_notes, request.corrections)
    if not result:
        raise HTTPException(status_code=404, detail="记录不存在")
    return {"success": True, "message": "复核完成"}


@app.get("/tasks/{task_id}/report/excel", summary="下载Excel对账报告")
def download_excel_report(task_id: int, db: Session = Depends(get_db)):
    output = generate_excel_report(db, task_id)
    if not output:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = db.query(ReconciliationTask).filter(ReconciliationTask.id == task_id).first()
    filename = f"对账报告_{task.task_code}.xlsx"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue()),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/tasks/{task_id}/report/text", summary="获取文本对账摘要")
def get_text_report(task_id: int, db: Session = Depends(get_db)):
    text = generate_text_summary(db, task_id)
    if not text:
        raise HTTPException(status_code=404, detail="任务不存在")
    return {"success": True, "summary": text}


@app.get("/tasks", summary="获取对账任务列表")
def get_tasks(db: Session = Depends(get_db)):
    tasks = db.query(ReconciliationTask).order_by(ReconciliationTask.created_at.desc()).all()
    result = []
    for t in tasks:
        result.append({
            "id": t.id,
            "task_code": t.task_code,
            "task_name": t.task_name,
            "status": t.status,
            "total_devices": t.total_devices,
            "created_at": t.created_at.strftime('%Y-%m-%d %H:%M:%S') if t.created_at else None
        })
    return {"success": True, "tasks": result}


@app.get("/stats/devices", summary="获取设备统计")
def get_device_stats(db: Session = Depends(get_db)):
    devices = db.query(Device).all()
    type_stats = {}
    floor_stats = {}
    for d in devices:
        dtype = d.device_type or '未知类型'
        floor = d.floor or '未知楼层'
        type_stats[dtype] = type_stats.get(dtype, 0) + 1
        floor_stats[floor] = floor_stats.get(floor, 0) + 1
    
    return {
        "success": True,
        "total": len(devices),
        "by_type": type_stats,
        "by_floor": floor_stats
    }


@app.get("/stats/contracts", summary="获取合同统计")
def get_contract_stats(db: Session = Depends(get_db)):
    contracts = db.query(Contract).all()
    today = date.today()
    active = sum(1 for c in contracts if c.end_date and c.end_date >= today)
    expired = sum(1 for c in contracts if c.end_date and c.end_date < today)
    
    return {
        "success": True,
        "total": len(contracts),
        "active": active,
        "expired": expired
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
