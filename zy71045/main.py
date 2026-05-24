from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date
import io
import csv

from database import engine, get_db, Base
import models
import schemas
import crud
from state_machine import DuplicateHandler

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="酒庄橡木桶添酒 API",
    description="橡木桶添酒管理系统 - 支持登记、检验、放行、补录、关闭和报告导出",
    version="1.0.0"
)


def topping_to_response(record: models.ToppingRecord) -> schemas.ToppingRecord:
    return schemas.ToppingRecord(
        id=record.id,
        record_code=record.record_code,
        barrel_code=record.barrel.barrel_code,
        source_batch_code=record.source_batch.batch_code,
        evaporation_volume=record.evaporation_volume,
        topping_volume=record.topping_volume,
        topping_date=record.topping_date,
        operator=record.operator,
        status=record.status,
        inspection_status=record.inspection_status,
        is_valid=record.is_valid,
        version=record.version,
        parent_id=record.parent_id,
        notes=record.notes,
        created_at=record.created_at,
        updated_at=record.updated_at,
        inspection=schemas.InspectionResult.model_validate(record.inspection) if record.inspection else None,
        validity_explanation=DuplicateHandler.get_validity_explanation(record)
    )


@app.post("/barrels/", response_model=schemas.OakBarrel, tags=["基础数据"])
def create_barrel(barrel: schemas.OakBarrelCreate, db: Session = Depends(get_db)):
    existing = crud.get_barrel_by_code(db, barrel.barrel_code)
    if existing:
        raise HTTPException(status_code=400, detail="橡木桶编号已存在")
    return crud.create_barrel(db=db, barrel=barrel)


@app.get("/barrels/", response_model=List[schemas.OakBarrel], tags=["基础数据"])
def read_barrels(db: Session = Depends(get_db)):
    return crud.get_all_barrels(db)


@app.post("/batches/", response_model=schemas.WineBatch, tags=["基础数据"])
def create_batch(batch: schemas.WineBatchCreate, db: Session = Depends(get_db)):
    existing = crud.get_batch_by_code(db, batch.batch_code)
    if existing:
        raise HTTPException(status_code=400, detail="批次编号已存在")
    return crud.create_batch(db=db, batch=batch)


@app.get("/batches/", response_model=List[schemas.WineBatch], tags=["基础数据"])
def read_batches(db: Session = Depends(get_db)):
    return crud.get_all_batches(db)


@app.post("/batch-records/", tags=["基础数据"])
def create_batch_record(
    barrel_code: str,
    batch_code: str,
    fill_date: datetime,
    initial_volume: float,
    db: Session = Depends(get_db)
):
    barrel = crud.get_barrel_by_code(db, barrel_code)
    if not barrel:
        raise HTTPException(status_code=404, detail="橡木桶不存在")

    batch = crud.get_batch_by_code(db, batch_code)
    if not batch:
        raise HTTPException(status_code=404, detail="酒液批次不存在")

    db_record = models.BatchRecord(
        barrel_id=barrel.id,
        batch_id=batch.id,
        fill_date=fill_date,
        initial_volume=initial_volume
    )
    barrel.current_volume = initial_volume
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return {"success": True, "message": "桶批次关联已创建", "data": {"id": db_record.id}}


@app.post("/toppings/", response_model=schemas.ApiResponse, tags=["添酒管理"])
def create_topping(topping: schemas.ToppingRecordCreate, db: Session = Depends(get_db)):
    success, message, record = crud.create_topping_record(db, topping)
    if not record:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"record_code": record.record_code, "status": record.status}
    }


@app.post("/toppings/{record_code}/inspect", response_model=schemas.ApiResponse, tags=["添酒管理"])
def submit_inspection(inspection: schemas.InspectionCreate, db: Session = Depends(get_db)):
    success, message, result = crud.create_inspection(db, inspection)
    if not result:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"inspection_id": result.id, "passed": result.passed}
    }


@app.post("/toppings/{record_code}/approve", response_model=schemas.ApiResponse, tags=["添酒管理"])
def approve_topping(record_code: str, db: Session = Depends(get_db)):
    success, message, record = crud.approve_topping(db, record_code)
    if not record:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"record_code": record.record_code, "status": record.status}
    }


@app.post("/toppings/{record_code}/reject", response_model=schemas.ApiResponse, tags=["添酒管理"])
def reject_topping(record_code: str, reason: str, db: Session = Depends(get_db)):
    success, message, record = crud.reject_topping(db, record_code, reason)
    if not record:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"record_code": record.record_code, "status": record.status}
    }


@app.post("/toppings/{record_code}/resubmit", response_model=schemas.ApiResponse, tags=["添酒管理"])
def resubmit_topping(record_code: str, new_topping: schemas.ToppingRecordCreate, db: Session = Depends(get_db)):
    success, message, record = crud.resubmit_topping(db, record_code, new_topping)
    if not record:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"record_code": record.record_code, "version": record.version}
    }


@app.post("/toppings/{record_code}/close", response_model=schemas.ApiResponse, tags=["添酒管理"])
def close_topping(record_code: str, db: Session = Depends(get_db)):
    success, message, record = crud.close_topping(db, record_code)
    if not record:
        return {"success": False, "message": message, "data": None}
    return {
        "success": success,
        "message": message,
        "data": {"record_code": record.record_code, "status": record.status}
    }


@app.get("/toppings/", response_model=List[schemas.ToppingRecord], tags=["添酒管理"])
def read_toppings(
    barrel_code: Optional[str] = None,
    batch_code: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    only_valid: bool = True,
    db: Session = Depends(get_db)
):
    query = schemas.ToppingQuery(
        barrel_code=barrel_code,
        batch_code=batch_code,
        start_date=start_date,
        end_date=end_date,
        status=status,
        only_valid=only_valid
    )
    records = crud.get_topping_records(db, query)
    return [topping_to_response(r) for r in records]


@app.get("/toppings/{record_code}", response_model=schemas.ToppingRecord, tags=["添酒管理"])
def read_topping(record_code: str, db: Session = Depends(get_db)):
    record = crud.get_topping_by_code(db, record_code)
    if not record:
        raise HTTPException(status_code=404, detail="添酒记录不存在")
    return topping_to_response(record)


@app.get("/toppings/export/csv", tags=["报告导出"])
def export_toppings_csv(
    barrel_code: Optional[str] = None,
    batch_code: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    status: Optional[str] = None,
    only_valid: bool = True,
    db: Session = Depends(get_db)
):
    query = schemas.ToppingQuery(
        barrel_code=barrel_code,
        batch_code=batch_code,
        start_date=start_date,
        end_date=end_date,
        status=status,
        only_valid=only_valid
    )
    records = crud.get_topping_records(db, query)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "记录编号", "桶编号", "批次编号", "蒸发量(L)", "添酒量(L)",
        "添酒日期", "操作员", "状态", "检验状态", "版本", "有效性说明", "备注"
    ])

    for r in records:
        writer.writerow([
            r.record_code,
            r.barrel.barrel_code,
            r.source_batch.batch_code,
            r.evaporation_volume,
            r.topping_volume,
            r.topping_date.strftime("%Y-%m-%d %H:%M:%S"),
            r.operator,
            r.status,
            r.inspection_status,
            r.version,
            DuplicateHandler.get_validity_explanation(r),
            r.notes or ""
        ])

    output.seek(0)
    filename = f"topping_records_{date.today()}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.post("/reports/", response_model=schemas.CellarReport, tags=["报告导出"])
def create_report(report: schemas.CellarReportCreate, db: Session = Depends(get_db)):
    return crud.generate_cellar_report(db, report)


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "service": "酒庄橡木桶添酒 API", "timestamp": datetime.now().isoformat()}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
