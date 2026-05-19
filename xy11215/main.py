import os
import csv
import json
from datetime import datetime
from fastapi import FastAPI, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional

from database import init_db, get_db
from models import InspectionRecord, ErrorRecord, ProcessingHistory
from data_processor import DataProcessor
from mask_utils import mask_sensitive_data, mask_name, mask_phone

app = FastAPI(title="地下泵房巡检数据处理系统", version="1.0.0")

UPLOAD_DIR = "uploads"
EXPORT_DIR = "exports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    init_db()


def record_to_dict(record: InspectionRecord) -> dict:
    return {
        "id": record.id,
        "record_type": record.record_type,
        "source_file": record.source_file,
        "row_number": record.row_number,
        "pump_room_id": record.pump_room_id,
        "inspection_time": record.inspection_time.isoformat() if record.inspection_time else None,
        "inspector_name": mask_name(record.inspector_name),
        "inspector_phone": mask_phone(record.inspector_phone),
        "water_pressure": record.water_pressure,
        "water_level": record.water_level,
        "pump_status": record.pump_status,
        "temperature": record.temperature,
        "vibration_level": record.vibration_level,
        "remarks": record.remarks,
        "is_valid": record.is_valid,
        "created_at": record.created_at.isoformat() if record.created_at else None
    }


def error_to_dict(error: ErrorRecord) -> dict:
    masked_raw_data = mask_sensitive_data(error.raw_data) if error.raw_data else None
    return {
        "id": error.id,
        "source_file": error.source_file,
        "row_number": error.row_number,
        "error_type": error.error_type,
        "error_message": error.error_message,
        "suggestion": error.suggestion,
        "raw_data": masked_raw_data,
        "created_at": error.created_at.isoformat() if error.created_at else None,
        "resolved": error.resolved
    }


@app.post("/api/upload/csv", summary="上传CSV巡检表")
async def upload_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="请上传CSV格式文件")

    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    processor = DataProcessor(db)
    result = processor.process_csv(file_path, file.filename)

    return JSONResponse({
        "status": "success",
        "message": f"CSV文件处理完成",
        "data": result
    })


@app.post("/api/upload/json", summary="上传JSON传感器告警数据")
async def upload_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="请上传JSON格式文件")

    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())

    processor = DataProcessor(db)
    result = processor.process_json(file_path, file.filename)

    return JSONResponse({
        "status": "success",
        "message": f"JSON文件处理完成",
        "data": result
    })


@app.get("/api/records", summary="查询巡检记录列表")
async def get_records(
    pump_room_id: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(InspectionRecord)

    if pump_room_id:
        query = query.filter(InspectionRecord.pump_room_id == pump_room_id)
    if start_date:
        query = query.filter(InspectionRecord.inspection_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(InspectionRecord.inspection_time <= datetime.fromisoformat(end_date))

    records = query.order_by(InspectionRecord.inspection_time.desc()).offset(skip).limit(limit).all()
    total = query.count()

    return JSONResponse({
        "status": "success",
        "data": {
            "total": total,
            "records": [record_to_dict(r) for r in records]
        }
    })


@app.get("/api/records/{record_id}", summary="查询单条巡检记录详情")
async def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(InspectionRecord).filter(InspectionRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    return JSONResponse({
        "status": "success",
        "data": record_to_dict(record)
    })


@app.get("/api/errors", summary="查询错误记录列表")
async def get_errors(
    resolved: Optional[bool] = None,
    source_file: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ErrorRecord)

    if resolved is not None:
        query = query.filter(ErrorRecord.resolved == resolved)
    if source_file:
        query = query.filter(ErrorRecord.source_file == source_file)

    errors = query.order_by(ErrorRecord.created_at.desc()).offset(skip).limit(limit).all()
    total = query.count()

    return JSONResponse({
        "status": "success",
        "data": {
            "total": total,
            "errors": [error_to_dict(e) for e in errors]
        }
    })


@app.get("/api/errors/{error_id}", summary="查询单条错误记录详情")
async def get_error(error_id: int, db: Session = Depends(get_db)):
    error = db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="错误记录不存在")

    return JSONResponse({
        "status": "success",
        "data": error_to_dict(error)
    })


@app.put("/api/errors/{error_id}/resolve", summary="标记错误记录为已解决")
async def resolve_error(error_id: int, db: Session = Depends(get_db)):
    error = db.query(ErrorRecord).filter(ErrorRecord.id == error_id).first()
    if not error:
        raise HTTPException(status_code=404, detail="错误记录不存在")

    error.resolved = True
    db.commit()

    return JSONResponse({
        "status": "success",
        "message": "错误记录已标记为已解决"
    })


@app.get("/api/history", summary="查询文件处理历史")
async def get_history(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    history = db.query(ProcessingHistory).order_by(ProcessingHistory.processed_at.desc()).offset(skip).limit(limit).all()

    return JSONResponse({
        "status": "success",
        "data": {
            "total": len(history),
            "history": [
                {
                    "id": h.id,
                    "file_name": h.file_name,
                    "file_type": h.file_type,
                    "total_records": h.total_records,
                    "valid_records": h.valid_records,
                    "invalid_records": h.invalid_records,
                    "processed_at": h.processed_at.isoformat() if h.processed_at else None,
                    "processed_by": h.processed_by,
                    "status": h.status
                } for h in history
            ]
        }
    })


@app.get("/api/export/records", summary="导出巡检记录为CSV")
async def export_records(
    pump_room_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(InspectionRecord)
    if pump_room_id:
        query = query.filter(InspectionRecord.pump_room_id == pump_room_id)

    records = query.all()

    export_file = os.path.join(EXPORT_DIR, f"inspection_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

    with open(export_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "记录类型", "源文件", "行号", "泵房ID", "巡检时间",
            "巡检员姓名", "巡检员电话", "水压(MPa)", "水位(m)",
            "水泵状态", "温度(°C)", "振动等级", "备注"
        ])

        for r in records:
            writer.writerow([
                r.id, r.record_type, r.source_file, r.row_number, r.pump_room_id,
                r.inspection_time.isoformat() if r.inspection_time else "",
                mask_name(r.inspector_name), mask_phone(r.inspector_phone),
                r.water_pressure, r.water_level, r.pump_status,
                r.temperature, r.vibration_level, r.remarks
            ])

    return FileResponse(
        export_file,
        media_type="text/csv",
        filename=os.path.basename(export_file)
    )


@app.get("/api/export/errors", summary="导出错误记录为CSV")
async def export_errors(
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ErrorRecord)
    if resolved is not None:
        query = query.filter(ErrorRecord.resolved == resolved)

    errors = query.all()

    export_file = os.path.join(EXPORT_DIR, f"error_records_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv")

    with open(export_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "ID", "源文件", "行号", "错误类型", "错误信息",
            "修改建议", "原始数据", "创建时间", "是否解决"
        ])

        for e in errors:
            masked_raw = mask_sensitive_data(e.raw_data) if e.raw_data else {}
            writer.writerow([
                e.id, e.source_file, e.row_number, e.error_type, e.error_message,
                e.suggestion, json.dumps(masked_raw, ensure_ascii=False),
                e.created_at.isoformat() if e.created_at else "",
                "是" if e.resolved else "否"
            ])

    return FileResponse(
        export_file,
        media_type="text/csv",
        filename=os.path.basename(export_file)
    )


@app.get("/api/stats", summary="获取统计信息")
async def get_stats(db: Session = Depends(get_db)):
    total_records = db.query(InspectionRecord).count()
    total_errors = db.query(ErrorRecord).count()
    unresolved_errors = db.query(ErrorRecord).filter(ErrorRecord.resolved == False).count()
    total_files = db.query(ProcessingHistory).count()

    pump_rooms = db.query(InspectionRecord.pump_room_id).distinct().count()

    return JSONResponse({
        "status": "success",
        "data": {
            "total_valid_records": total_records,
            "total_error_records": total_errors,
            "unresolved_errors": unresolved_errors,
            "total_processed_files": total_files,
            "distinct_pump_rooms": pump_rooms
        }
    })


@app.get("/", summary="系统状态")
async def root():
    return {
        "name": "地下泵房巡检数据处理系统",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
