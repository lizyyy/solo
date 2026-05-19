from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import List, Optional
import uuid
import hashlib
import pandas as pd
import json

from database import get_db, SampleRetention, FridgeTemperature, WasteRecord, ImportError, SampleHistory
from schemas import (
    SampleRetentionCreate, SampleRetentionResponse,
    FridgeTemperatureCreate, FridgeTemperatureResponse,
    WasteRecordCreate, WasteRecordResponse,
    InspectionRequest, DestroyRequest,
    ImportResult, ImportErrorResponse, ReportItem
)

app = FastAPI(title="门店品控系统", version="1.0.0")

def generate_idempotency_key(*args):
    content = "|".join(str(arg) for arg in args)
    return hashlib.md5(content.encode()).hexdigest()

@app.get("/")
def read_root():
    return {"message": "门店品控系统API", "version": "1.0.0"}

@app.post("/api/samples/", response_model=SampleRetentionResponse)
def create_sample(sample: SampleRetentionCreate, db: Session = Depends(get_db)):
    idempotency_key = sample.idempotency_key or generate_idempotency_key(
        sample.dish_code, sample.sample_time.isoformat(), sample.keeper
    )
    existing = db.query(SampleRetention).filter(SampleRetention.idempotency_key == idempotency_key).first()
    if existing:
        return existing
    expire_time = sample.sample_time + timedelta(hours=sample.retention_hours)
    db_sample = SampleRetention(
        idempotency_key=idempotency_key,
        dish_name=sample.dish_name,
        dish_code=sample.dish_code,
        sample_time=sample.sample_time,
        sample_quantity=sample.sample_quantity,
        keeper=sample.keeper,
        storage_location=sample.storage_location,
        retention_hours=sample.retention_hours,
        expire_time=expire_time,
        status="active"
    )
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    history = SampleHistory(
        sample_id=db_sample.id,
        action="create",
        operator=sample.keeper,
        remark="留样登记"
    )
    db.add(history)
    db.commit()
    return db_sample

@app.get("/api/samples/", response_model=List[SampleRetentionResponse])
def list_samples(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(SampleRetention)
    if status:
        query = query.filter(SampleRetention.status == status)
    return query.order_by(SampleRetention.sample_time.desc()).all()

@app.get("/api/samples/expired/", response_model=List[SampleRetentionResponse])
def get_expired_samples(db: Session = Depends(get_db)):
    now = datetime.utcnow()
    return db.query(SampleRetention).filter(
        SampleRetention.expire_time < now,
        SampleRetention.status == "active"
    ).all()

@app.get("/api/samples/expiring-soon/", response_model=List[SampleRetentionResponse])
def get_expiring_soon_samples(hours: int = 4, db: Session = Depends(get_db)):
    now = datetime.utcnow()
    soon = now + timedelta(hours=hours)
    return db.query(SampleRetention).filter(
        SampleRetention.expire_time >= now,
        SampleRetention.expire_time <= soon,
        SampleRetention.status == "active"
    ).all()

@app.post("/api/samples/inspect/", response_model=SampleRetentionResponse)
def inspect_sample(req: InspectionRequest, db: Session = Depends(get_db)):
    sample = db.query(SampleRetention).filter(SampleRetention.id == req.sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="留样记录不存在")
    if sample.status == "destroyed":
        raise HTTPException(status_code=400, detail="该留样已销毁，无法抽检")
    sample.inspection_time = datetime.utcnow()
    sample.inspector = req.inspector
    sample.inspection_result = req.inspection_result
    sample.status = "inspected"
    history = SampleHistory(
        sample_id=sample.id,
        action="inspect",
        operator=req.inspector,
        remark=f"抽检结果: {req.inspection_result}"
    )
    db.add(history)
    db.commit()
    db.refresh(sample)
    return sample

@app.post("/api/samples/destroy/", response_model=SampleRetentionResponse)
def destroy_sample(req: DestroyRequest, db: Session = Depends(get_db)):
    sample = db.query(SampleRetention).filter(SampleRetention.id == req.sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="留样记录不存在")
    if sample.status == "destroyed":
        return sample
    sample.destroy_time = datetime.utcnow()
    sample.destroyer = req.destroyer
    sample.status = "destroyed"
    history = SampleHistory(
        sample_id=sample.id,
        action="destroy",
        operator=req.destroyer,
        remark="销毁留样"
    )
    db.add(history)
    db.commit()
    db.refresh(sample)
    return sample

@app.post("/api/temperatures/", response_model=FridgeTemperatureResponse)
def create_temperature(temp: FridgeTemperatureCreate, db: Session = Depends(get_db)):
    idempotency_key = temp.idempotency_key or generate_idempotency_key(
        temp.fridge_code, temp.measure_time.isoformat(), temp.temperature
    )
    existing = db.query(FridgeTemperature).filter(FridgeTemperature.idempotency_key == idempotency_key).first()
    if existing:
        return existing
    is_normal = temp.min_temperature <= temp.temperature <= temp.max_temperature
    db_temp = FridgeTemperature(
        idempotency_key=idempotency_key,
        fridge_code=temp.fridge_code,
        fridge_name=temp.fridge_name,
        measure_time=temp.measure_time,
        temperature=temp.temperature,
        min_temperature=temp.min_temperature,
        max_temperature=temp.max_temperature,
        is_normal=is_normal,
        recorder=temp.recorder,
        remark=temp.remark
    )
    db.add(db_temp)
    db.commit()
    db.refresh(db_temp)
    return db_temp

@app.get("/api/temperatures/", response_model=List[FridgeTemperatureResponse])
def list_temperatures(fridge_code: Optional[str] = None, abnormal_only: bool = False, db: Session = Depends(get_db)):
    query = db.query(FridgeTemperature)
    if fridge_code:
        query = query.filter(FridgeTemperature.fridge_code == fridge_code)
    if abnormal_only:
        query = query.filter(FridgeTemperature.is_normal == False)
    return query.order_by(FridgeTemperature.measure_time.desc()).all()

@app.post("/api/wastes/", response_model=WasteRecordResponse)
def create_waste(waste: WasteRecordCreate, db: Session = Depends(get_db)):
    idempotency_key = waste.idempotency_key or generate_idempotency_key(
        waste.dish_code, waste.waste_time.isoformat(), waste.waste_quantity, waste.handler
    )
    existing = db.query(WasteRecord).filter(WasteRecord.idempotency_key == idempotency_key).first()
    if existing:
        return existing
    db_waste = WasteRecord(
        idempotency_key=idempotency_key,
        dish_name=waste.dish_name,
        dish_code=waste.dish_code,
        waste_time=waste.waste_time,
        waste_quantity=waste.waste_quantity,
        waste_reason=waste.waste_reason,
        handler=waste.handler
    )
    db.add(db_waste)
    db.commit()
    db.refresh(db_waste)
    return db_waste

@app.get("/api/wastes/", response_model=List[WasteRecordResponse])
def list_wastes(db: Session = Depends(get_db)):
    return db.query(WasteRecord).order_by(WasteRecord.waste_time.desc()).all()

@app.post("/api/import/samples/excel/", response_model=ImportResult)
async def import_samples_excel(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import_batch_id = str(uuid.uuid4())
    success_count = 0
    error_count = 0
    errors = []
    try:
        df = pd.read_excel(file.file.read())
        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                dish_name = str(row.get("菜品名称", "")).strip()
                dish_code = str(row.get("菜品编码", "")).strip()
                sample_time_str = str(row.get("留样时间", "")).strip()
                sample_quantity = str(row.get("留样数量", "")).strip()
                keeper = str(row.get("留样人", "")).strip()
                storage_location = str(row.get("存放位置", "")).strip()
                retention_hours = int(row.get("保留时长(小时)", 48))
                if not dish_name:
                    raise ValueError("菜品名称不能为空")
                if not dish_code:
                    raise ValueError("菜品编码不能为空")
                if not sample_time_str:
                    raise ValueError("留样时间不能为空")
                try:
                    sample_time = pd.to_datetime(sample_time_str).to_pydatetime()
                except Exception:
                    raise ValueError(f"时间格式错误: {sample_time_str}，建议格式: 2024-01-01 12:00:00")
                sample_data = SampleRetentionCreate(
                    dish_name=dish_name,
                    dish_code=dish_code,
                    sample_time=sample_time,
                    sample_quantity=sample_quantity,
                    keeper=keeper,
                    storage_location=storage_location,
                    retention_hours=retention_hours
                )
                create_sample(sample_data, db)
                success_count += 1
            except Exception as e:
                error_count += 1
                error_reason = str(e)
                suggestion = "请检查必填字段是否完整、时间格式是否正确"
                if "时间格式" in error_reason:
                    suggestion = "请使用标准日期时间格式，如: 2024-01-15 14:30:00"
                elif "菜品名称" in error_reason:
                    suggestion = "请填写菜品名称"
                elif "菜品编码" in error_reason:
                    suggestion = "请填写菜品编码"
                import_error = ImportError(
                    import_batch_id=import_batch_id,
                    file_name=file.filename,
                    sheet_name="Sheet1",
                    row_number=row_num,
                    original_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    error_reason=error_reason,
                    suggestion=suggestion
                )
                db.add(import_error)
                errors.append(import_error)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    db_errors = db.query(ImportError).filter(ImportError.import_batch_id == import_batch_id).all()
    return ImportResult(
        success_count=success_count,
        error_count=error_count,
        import_batch_id=import_batch_id,
        errors=[ImportErrorResponse.from_orm(e) for e in db_errors]
    )

@app.post("/api/import/temperatures/csv/", response_model=ImportResult)
async def import_temperatures_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    import_batch_id = str(uuid.uuid4())
    success_count = 0
    error_count = 0
    errors = []
    try:
        content = file.file.read()
        df = pd.read_csv(pd.io.common.BytesIO(content))
        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                fridge_code = str(row.get("冰箱编码", "")).strip()
                fridge_name = str(row.get("冰箱名称", "")).strip()
                measure_time_str = str(row.get("测量时间", "")).strip()
                temperature_str = str(row.get("温度", "")).strip()
                min_temp = float(row.get("最低温度", 0))
                max_temp = float(row.get("最高温度", 8))
                recorder = str(row.get("记录人", "")).strip()
                remark = str(row.get("备注", "")).strip() or None
                if not fridge_code:
                    raise ValueError("冰箱编码不能为空")
                if not measure_time_str:
                    raise ValueError("测量时间不能为空")
                if not temperature_str:
                    raise ValueError("温度不能为空")
                try:
                    temperature = float(temperature_str)
                except Exception:
                    raise ValueError(f"温度格式错误: {temperature_str}，应为数字")
                try:
                    measure_time = pd.to_datetime(measure_time_str).to_pydatetime()
                except Exception:
                    raise ValueError(f"时间格式错误: {measure_time_str}，建议格式: 2024-01-01 12:00:00")
                temp_data = FridgeTemperatureCreate(
                    fridge_code=fridge_code,
                    fridge_name=fridge_name,
                    measure_time=measure_time,
                    temperature=temperature,
                    min_temperature=min_temp,
                    max_temperature=max_temp,
                    recorder=recorder,
                    remark=remark
                )
                create_temperature(temp_data, db)
                success_count += 1
            except Exception as e:
                error_count += 1
                error_reason = str(e)
                suggestion = "请检查必填字段是否完整、时间和温度格式是否正确"
                if "温度格式" in error_reason:
                    suggestion = "温度应为有效数字，如: 4.5"
                elif "时间格式" in error_reason:
                    suggestion = "请使用标准日期时间格式，如: 2024-01-15 14:30:00"
                import_error = ImportError(
                    import_batch_id=import_batch_id,
                    file_name=file.filename,
                    row_number=row_num,
                    original_data=json.dumps(row.to_dict(), ensure_ascii=False),
                    error_reason=error_reason,
                    suggestion=suggestion
                )
                db.add(import_error)
                errors.append(import_error)
        db.commit()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    db_errors = db.query(ImportError).filter(ImportError.import_batch_id == import_batch_id).all()
    return ImportResult(
        success_count=success_count,
        error_count=error_count,
        import_batch_id=import_batch_id,
        errors=[ImportErrorResponse.from_orm(e) for e in db_errors]
    )

@app.get("/api/import/errors/", response_model=List[ImportErrorResponse])
def list_import_errors(batch_id: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ImportError)
    if batch_id:
        query = query.filter(ImportError.import_batch_id == batch_id)
    return query.order_by(ImportError.created_at.desc()).all()

@app.get("/api/report/daily/", response_model=ReportItem)
def get_daily_report(date: Optional[str] = None, db: Session = Depends(get_db)):
    if date:
        report_date = datetime.strptime(date, "%Y-%m-%d").date()
    else:
        report_date = datetime.utcnow().date()
    start = datetime.combine(report_date, datetime.min.time())
    end = datetime.combine(report_date, datetime.max.time())
    samples = db.query(SampleRetention).filter(
        SampleRetention.sample_time >= start,
        SampleRetention.sample_time <= end
    ).all()
    temps = db.query(FridgeTemperature).filter(
        FridgeTemperature.measure_time >= start,
        FridgeTemperature.measure_time <= end
    ).all()
    wastes = db.query(WasteRecord).filter(
        WasteRecord.waste_time >= start,
        WasteRecord.waste_time <= end
    ).all()
    now = datetime.utcnow()
    expired_count = sum(1 for s in samples if s.expire_time < now and s.status == "active")
    active_count = sum(1 for s in samples if s.status == "active")
    return ReportItem(
        period=report_date.strftime("%Y-%m-%d"),
        total_samples=len(samples),
        inspected_samples=sum(1 for s in samples if s.status in ["inspected", "destroyed"] and s.inspection_time),
        destroyed_samples=sum(1 for s in samples if s.status == "destroyed"),
        active_samples=active_count,
        expired_samples=expired_count,
        temperature_records=len(temps),
        abnormal_temperatures=sum(1 for t in temps if not t.is_normal),
        waste_records=len(wastes)
    )

@app.get("/api/samples/{sample_id}/history")
def get_sample_history(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(SampleRetention).filter(SampleRetention.id == sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="留样记录不存在")
    history = db.query(SampleHistory).filter(SampleHistory.sample_id == sample_id).order_by(SampleHistory.action_time).all()
    return {
        "sample_id": sample_id,
        "dish_name": sample.dish_name,
        "history": [
            {
                "action": h.action,
                "action_time": h.action_time,
                "operator": h.operator,
                "remark": h.remark
            }
            for h in history
        ]
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
