from fastapi import FastAPI, UploadFile, File, Depends, HTTPException, Query
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from datetime import date, datetime
from typing import Optional, List
import os
import tempfile
import uuid

from app.database import (
    init_db, get_db, SessionLocal,
    Cylinder, Appointment, Risk, ReviewRecord,
    FillRecord, CompressorMaintenance, Batch
)
from app.importers import (
    CylinderImporter, FillRecordImporter,
    CompressorMaintenanceImporter, AppointmentImporter
)
from app.risk_engine import RiskEngine
from app.review_service import ReviewService
from app.export_service import ExportService

app = FastAPI(
    title="潜水气瓶充填站管理系统 API",
    description="用于管理潜水气瓶台账、充填记录、压缩机维护、顾客预约及风险识别的本地 REST API 服务",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    init_db()


@app.get("/")
def root():
    return {
        "message": "潜水气瓶充填站管理系统 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/import/cylinders", tags=["数据导入"])
def import_cylinders(
    file: UploadFile = File(..., description="气瓶台账 CSV 文件"),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        importer = CylinderImporter(db)
        result = importer.import_csv(tmp_path)
        os.unlink(tmp_path)
        
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import/fill-records", tags=["数据导入"])
def import_fill_records(
    file: UploadFile = File(..., description="充填记录 CSV 文件"),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        importer = FillRecordImporter(db)
        result = importer.import_csv(tmp_path)
        os.unlink(tmp_path)
        
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import/compressor-maintenance", tags=["数据导入"])
def import_compressor_maintenance(
    file: UploadFile = File(..., description="压缩机维护 JSON 文件"),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".json"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        importer = CompressorMaintenanceImporter(db)
        result = importer.import_json(tmp_path)
        os.unlink(tmp_path)
        
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import/appointments", tags=["数据导入"])
def import_appointments(
    file: UploadFile = File(..., description="顾客取瓶预约 CSV 文件"),
    db: Session = Depends(get_db)
):
    try:
        suffix = os.path.splitext(file.filename)[1] if file.filename else ".csv"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as tmp:
            tmp.write(file.file.read())
            tmp_path = tmp.name
        
        importer = AppointmentImporter(db)
        result = importer.import_csv(tmp_path)
        os.unlink(tmp_path)
        
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/risks/check", tags=["风险识别"])
def check_all_risks(db: Session = Depends(get_db)):
    try:
        engine = RiskEngine(db)
        result = engine.check_all_risks()
        return JSONResponse(content=result)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/risks/active", tags=["风险识别"])
def get_active_risks(db: Session = Depends(get_db)):
    try:
        engine = RiskEngine(db)
        risks = engine.get_active_risks()
        return JSONResponse(content={"count": len(risks), "risks": risks})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/risks/{risk_id}/resolve", tags=["风险识别"])
def resolve_risk(
    risk_id: int,
    resolved_by: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        engine = RiskEngine(db)
        result = engine.resolve_risk(risk_id, resolved_by, notes)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reviews/{review_id}/reviewed", tags=["复核操作"])
def mark_as_reviewed(
    review_id: int,
    reviewer_name: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReviewService(db)
        result = service.mark_as_reviewed(review_id, reviewer_name, notes)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/appointments/{appointment_id}/reschedule", tags=["复核操作"])
def reschedule_appointment(
    appointment_id: int,
    rescheduled_to: datetime,
    reviewer_name: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        service = ReviewService(db)
        result = service.reschedule_appointment(appointment_id, rescheduled_to, reviewer_name, notes)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["message"])
        return JSONResponse(content=result)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reviews", tags=["复核操作"])
def get_reviews(
    status: Optional[str] = None,
    review_type: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    try:
        service = ReviewService(db)
        reviews = service.get_reviews(status, review_type, limit)
        return JSONResponse(content={"count": len(reviews), "reviews": reviews})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/pickup-list/markdown", tags=["导出功能"])
def export_pickup_list_markdown(
    target_date: Optional[date] = Query(None, description="目标日期，默认为今天"),
    db: Session = Depends(get_db)
):
    try:
        service = ExportService(db)
        markdown_content = service.generate_markdown_pickup_list(target_date)
        
        suffix = ""
        if target_date:
            suffix = f"_{target_date.isoformat()}"
        
        filename = f"pickup_list{suffix}.md"
        tmp_path = os.path.join(tempfile.gettempdir(), filename)
        
        with open(tmp_path, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        
        return FileResponse(
            path=tmp_path,
            media_type="text/markdown",
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/audit-package", tags=["导出功能"])
def export_audit_package(
    start_date: Optional[date] = Query(None, description="开始日期，默认为30天前"),
    end_date: Optional[date] = Query(None, description="结束日期，默认为今天"),
    db: Session = Depends(get_db)
):
    try:
        service = ExportService(db)
        audit_package = service.generate_audit_package(start_date, end_date)
        
        return JSONResponse(content=audit_package)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/export/audit-package/download", tags=["导出功能"])
def download_audit_package(
    start_date: Optional[date] = Query(None, description="开始日期，默认为30天前"),
    end_date: Optional[date] = Query(None, description="结束日期，默认为今天"),
    db: Session = Depends(get_db)
):
    try:
        service = ExportService(db)
        audit_package = service.generate_audit_package(start_date, end_date)
        
        start_str = start_date.isoformat() if start_date else (date.today()).isoformat()
        end_str = end_date.isoformat() if end_date else date.today().isoformat()
        filename = f"audit_package_{start_str}_to_{end_str}.json"
        tmp_path = os.path.join(tempfile.gettempdir(), filename)
        
        import json
        with open(tmp_path, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        
        return FileResponse(
            path=tmp_path,
            media_type="application/json",
            filename=filename
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/cylinders", tags=["数据查询"])
def get_cylinders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    try:
        cylinders = db.query(Cylinder).offset(skip).limit(limit).all()
        result = []
        for c in cylinders:
            result.append({
                "id": c.id,
                "serial_number": c.serial_number,
                "cylinder_type": c.cylinder_type,
                "capacity_liters": c.capacity_liters,
                "working_pressure_bar": c.working_pressure_bar,
                "test_expiry_date": c.test_expiry_date.strftime("%Y-%m-%d") if c.test_expiry_date else None,
                "last_test_date": c.last_test_date.strftime("%Y-%m-%d") if c.last_test_date else None,
                "owner_name": c.owner_name,
                "owner_contact": c.owner_contact
            })
        return JSONResponse(content={"count": len(result), "cylinders": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/appointments", tags=["数据查询"])
def get_appointments(
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    try:
        query = db.query(Appointment)
        if status:
            query = query.filter(Appointment.status == status)
        
        appointments = query.offset(skip).limit(limit).all()
        result = []
        for a in appointments:
            cylinder = db.query(Cylinder).filter(Cylinder.id == a.cylinder_id).first()
            result.append({
                "id": a.id,
                "appointment_number": a.appointment_number,
                "serial_number": cylinder.serial_number if cylinder else None,
                "customer_name": a.customer_name,
                "customer_contact": a.customer_contact,
                "pickup_date": a.pickup_date.strftime("%Y-%m-%d %H:%M:%S") if a.pickup_date else None,
                "status": a.status,
                "notes": a.notes
            })
        return JSONResponse(content={"count": len(result), "appointments": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/compressors", tags=["数据查询"])
def get_compressors(db: Session = Depends(get_db)):
    try:
        compressors = db.query(CompressorMaintenance).all()
        result = []
        for cm in compressors:
            result.append({
                "id": cm.id,
                "compressor_id": cm.compressor_id,
                "model": cm.model,
                "last_maintenance_date": cm.last_maintenance_date.strftime("%Y-%m-%d") if cm.last_maintenance_date else None,
                "filter_change_date": cm.filter_change_date.strftime("%Y-%m-%d") if cm.filter_change_date else None,
                "filter_expiry_date": cm.filter_expiry_date.strftime("%Y-%m-%d") if cm.filter_expiry_date else None,
                "next_service_date": cm.next_service_date.strftime("%Y-%m-%d") if cm.next_service_date else None,
                "operating_hours": cm.operating_hours,
                "notes": cm.notes
            })
        return JSONResponse(content={"count": len(result), "compressors": result})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
