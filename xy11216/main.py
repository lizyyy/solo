from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_
from typing import Optional, List
from datetime import datetime, date
import uuid
import pandas as pd
import json
import os
from io import BytesIO

from database import (
    get_db, init_db, QualityControlRecord,
    ImportErrorLog, ImportHistory
)

app = FastAPI(title="门店品控数据管理系统", version="1.0.0")

@app.on_event("startup")
async def startup_event():
    init_db()

def parse_datetime(value):
    if pd.isna(value):
        return None
    if isinstance(value, datetime):
        return value
    formats = [
        "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d",
        "%Y/%m/%d %H:%M:%S", "%Y/%m/%d %H:%M", "%Y/%m/%d",
        "%Y-%m-%dT%H:%M:%S"
    ]
    for fmt in formats:
        try:
            return datetime.strptime(str(value).strip(), fmt)
        except ValueError:
            continue
    return None

def validate_sample_record(row, row_num):
    errors = []
    suggestions = []
    
    if pd.isna(row.get("门店名称")) or not str(row.get("门店名称")).strip():
        errors.append("门店名称不能为空")
        suggestions.append("请填写门店名称，如：朝阳门店")
    
    if pd.isna(row.get("负责人")) or not str(row.get("负责人")).strip():
        errors.append("负责人不能为空")
        suggestions.append("请填写负责人姓名")
    
    record_date = parse_datetime(row.get("日期"))
    if not record_date:
        errors.append("日期格式不正确")
        suggestions.append("日期格式应为：YYYY-MM-DD 或 YYYY/MM/DD")
    
    sample_time = parse_datetime(row.get("留样时间"))
    discard_time = parse_datetime(row.get("废弃时间"))
    
    if discard_time and sample_time and discard_time <= sample_time:
        errors.append("废弃时间必须晚于留样时间")
        suggestions.append("请检查废弃时间，确保晚于留样时间")
    
    return errors, suggestions

def validate_temperature_record(row, row_num):
    errors = []
    suggestions = []
    
    if pd.isna(row.get("门店名称")) or not str(row.get("门店名称")).strip():
        errors.append("门店名称不能为空")
        suggestions.append("请填写门店名称，如：朝阳门店")
    
    if pd.isna(row.get("负责人")) or not str(row.get("负责人")).strip():
        errors.append("负责人不能为空")
        suggestions.append("请填写负责人姓名")
    
    record_date = parse_datetime(row.get("日期"))
    if not record_date:
        errors.append("日期格式不正确")
        suggestions.append("日期格式应为：YYYY-MM-DD 或 YYYY/MM/DD")
    
    temp = row.get("温度")
    if pd.isna(temp):
        errors.append("温度不能为空")
        suggestions.append("请填写冰箱温度数值")
    else:
        try:
            temp_val = float(temp)
            if temp_val < -50 or temp_val > 50:
                errors.append(f"温度值异常: {temp_val}°C")
                suggestions.append("温度值超出合理范围，请检查数据")
        except ValueError:
            errors.append(f"温度格式错误: {temp}")
            suggestions.append("请填写有效的数字温度值")
    
    return errors, suggestions

@app.post("/api/import/sample")
async def import_sample_excel(
    file: UploadFile = File(...),
    imported_by: str = "system",
    db: Session = Depends(get_db)
):
    batch_id = str(uuid.uuid4())
    
    try:
        contents = await file.read()
        df = pd.read_excel(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取Excel文件: {str(e)}")
    
    total_records = len(df)
    success_count = 0
    error_count = 0
    
    for idx, row in df.iterrows():
        row_num = idx + 2
        errors, suggestions = validate_sample_record(row, row_num)
        
        if errors:
            error_log = ImportErrorLog(
                import_batch_id=batch_id,
                file_name=file.filename,
                row_number=row_num,
                original_data=json.dumps(row.to_dict(), ensure_ascii=False, default=str),
                error_reason="; ".join(errors),
                fix_suggestion="; ".join(suggestions)
            )
            db.add(error_log)
            error_count += 1
        else:
            record = QualityControlRecord(
                record_type="留样台账",
                store_name=str(row.get("门店名称", "")).strip(),
                responsible_person=str(row.get("负责人", "")).strip(),
                record_date=parse_datetime(row.get("日期")),
                item_name=str(row.get("菜品名称", "")).strip(),
                sample_time=parse_datetime(row.get("留样时间")),
                discard_time=parse_datetime(row.get("废弃时间")),
                status="正常" if not errors else "异常",
                anomaly_type=None if not errors else "数据校验失败",
                remarks=str(row.get("备注", "")) if not pd.isna(row.get("备注")) else "",
                import_batch_id=batch_id
            )
            db.add(record)
            success_count += 1
    
    import_history = ImportHistory(
        batch_id=batch_id,
        file_name=file.filename,
        file_type="excel",
        total_records=total_records,
        success_count=success_count,
        error_count=error_count,
        imported_by=imported_by
    )
    db.add(import_history)
    db.commit()
    
    return {
        "batch_id": batch_id,
        "file_name": file.filename,
        "total_records": total_records,
        "success_count": success_count,
        "error_count": error_count
    }

@app.post("/api/import/temperature")
async def import_temperature_csv(
    file: UploadFile = File(...),
    imported_by: str = "system",
    db: Session = Depends(get_db)
):
    batch_id = str(uuid.uuid4())
    
    try:
        contents = await file.read()
        df = pd.read_csv(BytesIO(contents))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"无法读取CSV文件: {str(e)}")
    
    total_records = len(df)
    success_count = 0
    error_count = 0
    
    for idx, row in df.iterrows():
        row_num = idx + 2
        errors, suggestions = validate_temperature_record(row, row_num)
        
        anomaly_type = None
        status = "正常"
        
        if errors:
            status = "异常"
            anomaly_type = "数据校验失败"
        else:
            temp = float(row.get("温度"))
            if temp > 8:
                status = "异常"
                anomaly_type = "冷藏温度超标"
            elif temp < -15:
                status = "异常"
                anomaly_type = "冷冻温度异常"
        
        if errors:
            error_log = ImportErrorLog(
                import_batch_id=batch_id,
                file_name=file.filename,
                row_number=row_num,
                original_data=json.dumps(row.to_dict(), ensure_ascii=False, default=str),
                error_reason="; ".join(errors),
                fix_suggestion="; ".join(suggestions)
            )
            db.add(error_log)
            error_count += 1
        else:
            record = QualityControlRecord(
                record_type="温度日志",
                store_name=str(row.get("门店名称", "")).strip(),
                responsible_person=str(row.get("负责人", "")).strip(),
                record_date=parse_datetime(row.get("日期")),
                item_name=str(row.get("冰箱编号", "")).strip(),
                temperature=float(row.get("温度")),
                status=status,
                anomaly_type=anomaly_type,
                remarks=str(row.get("备注", "")) if not pd.isna(row.get("备注")) else "",
                import_batch_id=batch_id
            )
            db.add(record)
            success_count += 1
    
    import_history = ImportHistory(
        batch_id=batch_id,
        file_name=file.filename,
        file_type="csv",
        total_records=total_records,
        success_count=success_count,
        error_count=error_count,
        imported_by=imported_by
    )
    db.add(import_history)
    db.commit()
    
    return {
        "batch_id": batch_id,
        "file_name": file.filename,
        "total_records": total_records,
        "success_count": success_count,
        "error_count": error_count
    }

@app.get("/api/records")
async def get_records(
    responsible_person: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    record_type: Optional[str] = None,
    store_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(QualityControlRecord)
    
    filters = []
    if responsible_person:
        filters.append(QualityControlRecord.responsible_person == responsible_person)
    if start_date:
        filters.append(QualityControlRecord.record_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(QualityControlRecord.record_date <= datetime.combine(end_date, datetime.max.time()))
    if status:
        filters.append(QualityControlRecord.status == status)
    if anomaly_type:
        filters.append(QualityControlRecord.anomaly_type == anomaly_type)
    if record_type:
        filters.append(QualityControlRecord.record_type == record_type)
    if store_name:
        filters.append(QualityControlRecord.store_name == store_name)
    
    if filters:
        query = query.filter(and_(*filters))
    
    total = query.count()
    records = query.order_by(QualityControlRecord.record_date.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "data": [
            {
                "id": r.id,
                "record_type": r.record_type,
                "store_name": r.store_name,
                "responsible_person": r.responsible_person,
                "record_date": r.record_date.strftime("%Y-%m-%d") if r.record_date else None,
                "item_name": r.item_name,
                "temperature": r.temperature,
                "sample_time": r.sample_time.strftime("%Y-%m-%d %H:%M:%S") if r.sample_time else None,
                "discard_time": r.discard_time.strftime("%Y-%m-%d %H:%M:%S") if r.discard_time else None,
                "status": r.status,
                "anomaly_type": r.anomaly_type,
                "remarks": r.remarks,
                "import_batch_id": r.import_batch_id
            }
            for r in records
        ]
    }

def clean_json_data(obj):
    if isinstance(obj, dict):
        return {k: clean_json_data(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [clean_json_data(item) for item in obj]
    elif isinstance(obj, float) and (obj != obj or abs(obj) == float('inf')):
        return None
    else:
        return obj

@app.get("/api/import/errors/{batch_id}")
async def get_import_errors(
    batch_id: str,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(ImportErrorLog).filter(ImportErrorLog.import_batch_id == batch_id)
    total = query.count()
    errors = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "data": [
            {
                "id": e.id,
                "file_name": e.file_name,
                "row_number": e.row_number,
                "original_data": clean_json_data(json.loads(e.original_data)),
                "error_reason": e.error_reason,
                "fix_suggestion": e.fix_suggestion
            }
            for e in errors
        ]
    }

@app.get("/api/import/history")
async def get_import_history(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(get_db)
):
    query = db.query(ImportHistory)
    total = query.count()
    history = query.order_by(ImportHistory.imported_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "data": [
            {
                "batch_id": h.batch_id,
                "file_name": h.file_name,
                "file_type": h.file_type,
                "total_records": h.total_records,
                "success_count": h.success_count,
                "error_count": h.error_count,
                "imported_by": h.imported_by,
                "imported_at": h.imported_at.strftime("%Y-%m-%d %H:%M:%S")
            }
            for h in history
        ]
    }

@app.get("/api/export/report")
async def export_report(
    responsible_person: Optional[str] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    anomaly_type: Optional[str] = None,
    record_type: Optional[str] = None,
    store_name: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(QualityControlRecord)
    
    filters = []
    if responsible_person:
        filters.append(QualityControlRecord.responsible_person == responsible_person)
    if start_date:
        filters.append(QualityControlRecord.record_date >= datetime.combine(start_date, datetime.min.time()))
    if end_date:
        filters.append(QualityControlRecord.record_date <= datetime.combine(end_date, datetime.max.time()))
    if status:
        filters.append(QualityControlRecord.status == status)
    if anomaly_type:
        filters.append(QualityControlRecord.anomaly_type == anomaly_type)
    if record_type:
        filters.append(QualityControlRecord.record_type == record_type)
    if store_name:
        filters.append(QualityControlRecord.store_name == store_name)
    
    if filters:
        query = query.filter(and_(*filters))
    
    records = query.order_by(QualityControlRecord.record_date.desc()).all()
    
    export_data = []
    for r in records:
        export_data.append({
            "记录类型": r.record_type,
            "门店名称": r.store_name,
            "负责人": r.responsible_person,
            "记录日期": r.record_date.strftime("%Y-%m-%d") if r.record_date else "",
            "项目名称": r.item_name,
            "温度(°C)": r.temperature if r.temperature else "",
            "留样时间": r.sample_time.strftime("%Y-%m-%d %H:%M:%S") if r.sample_time else "",
            "废弃时间": r.discard_time.strftime("%Y-%m-%d %H:%M:%S") if r.discard_time else "",
            "状态": r.status,
            "异常类型": r.anomaly_type if r.anomaly_type else "",
            "备注": r.remarks if r.remarks else ""
        })
    
    df = pd.DataFrame(export_data)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"品控报告_{timestamp}.xlsx"
    filepath = f"/tmp/{filename}"
    
    df.to_excel(filepath, index=False, engine="openpyxl")
    
    return FileResponse(
        path=filepath,
        filename=filename,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )

@app.get("/api/stats/summary")
async def get_stats_summary(db: Session = Depends(get_db)):
    total_records = db.query(QualityControlRecord).count()
    normal_records = db.query(QualityControlRecord).filter(QualityControlRecord.status == "正常").count()
    abnormal_records = db.query(QualityControlRecord).filter(QualityControlRecord.status == "异常").count()
    
    from sqlalchemy import func
    anomaly_stats = db.query(
        QualityControlRecord.anomaly_type,
        func.count(QualityControlRecord.id)
    ).filter(QualityControlRecord.anomaly_type.isnot(None)).group_by(QualityControlRecord.anomaly_type).all()
    
    return {
        "total_records": total_records,
        "normal_records": normal_records,
        "abnormal_records": abnormal_records,
        "anomaly_distribution": [
            {"type": a[0], "count": a[1]} for a in anomaly_stats
        ]
    }

@app.get("/")
async def root():
    return {
        "message": "门店品控数据管理系统",
        "version": "1.0.0",
        "docs": "/docs"
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8001)
