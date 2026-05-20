from fastapi import FastAPI, Depends, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os
import tempfile

from app.database import get_db, engine, Base
from app.services.import_service import ImportService
from app.services.reconciliation_service import ReconciliationService
from app.services.review_service import ReviewService
from app.services.batch_trace_service import BatchTraceService
from app.services.report_service import ReportService
from app.models.models import MaterialRequisition, VehicleMaterial, Inventory

Base.metadata.create_all(bind=engine)

app = FastAPI(title="供水抢修对账服务API", version="1.0.0")


@app.get("/")
async def root():
    return {
        "message": "供水抢修对账服务API",
        "version": "1.0.0",
        "endpoints": {
            "import": "/import/",
            "reconciliation": "/reconciliation/",
            "review": "/review/",
            "batch": "/batch/",
            "reports": "/reports/"
        }
    }


@app.post("/import/requisitions", tags=["导入"])
async def import_requisitions(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as f:
            content = await file.read()
            f.write(content)
            temp_path = f.name

        result = ImportService.import_requisitions_from_csv(db, temp_path)
        os.unlink(temp_path)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import/vehicle-materials", tags=["导入"])
async def import_vehicle_materials(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as f:
            content = await file.read()
            f.write(content)
            temp_path = f.name

        result = ImportService.import_vehicle_materials_from_json(db, temp_path)
        os.unlink(temp_path)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/import/inventory", tags=["导入"])
async def import_inventory(file: UploadFile = File(...), db: Session = Depends(get_db)):
    try:
        suffix = os.path.splitext(file.filename)[1]
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix, mode='wb') as f:
            content = await file.read()
            f.write(content)
            temp_path = f.name

        result = ImportService.import_inventory_from_csv(db, temp_path)
        os.unlink(temp_path)

        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])

        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/reconciliation/run", tags=["对账"])
async def run_reconciliation(db: Session = Depends(get_db)):
    try:
        result = ReconciliationService.run_auto_reconciliation(db)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reconciliation/diffs", tags=["对账"])
async def get_diffs(diff_type: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        diffs = ReconciliationService.get_diff_list(db, diff_type, status)
        return {"success": True, "data": diffs, "count": len(diffs)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/review/diff/{diff_id}", tags=["复核"])
async def review_diff(
    diff_id: int,
    reviewer: str,
    review_status: str,
    review_remark: Optional[str] = None,
    diff_explanation: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        result = ReviewService.review_diff(db, diff_id, reviewer, review_status, review_remark, diff_explanation)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/review/batch", tags=["复核"])
async def batch_review(
    diff_ids: List[int],
    reviewer: str,
    review_status: str,
    review_remark: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        result = ReviewService.batch_review_diffs(db, diff_ids, reviewer, review_status, review_remark)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.put("/review/requisition/{requisition_id}", tags=["复核"])
async def update_requisition_and_recalculate(
    requisition_id: int,
    updates: dict,
    db: Session = Depends(get_db)
):
    try:
        result = ReviewService.update_requisition_and_recalculate(db, requisition_id, updates)
        if not result["success"]:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/review/requisition/{requisition_id}", tags=["复核"])
async def get_requisition_detail(requisition_id: int, db: Session = Depends(get_db)):
    try:
        result = ReviewService.get_requisition_detail(db, requisition_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/review/history", tags=["复核"])
async def get_review_history(requisition_id: Optional[int] = None, db: Session = Depends(get_db)):
    try:
        records = ReviewService.get_review_history(db, requisition_id)
        return {"success": True, "data": records, "count": len(records)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/batch/trace/{batch_no}", tags=["批次追踪"])
async def trace_batch(batch_no: str, db: Session = Depends(get_db)):
    try:
        result = BatchTraceService.trace_batch_history(db, batch_no)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/batch/list", tags=["批次追踪"])
async def get_batch_list(material_code: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        batches = BatchTraceService.get_material_batch_list(db, material_code)
        return {"success": True, "data": batches, "count": len(batches)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/batch/requisition-source/{requisition_id}", tags=["批次追踪"])
async def get_requisition_batch_source(requisition_id: int, db: Session = Depends(get_db)):
    try:
        result = BatchTraceService.trace_requisition_batch_source(db, requisition_id)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/summary", tags=["报告"])
async def get_report_summary(db: Session = Depends(get_db)):
    try:
        result = ReportService.generate_reconciliation_report(db)
        if not result["success"]:
            raise HTTPException(status_code=404, detail=result["error"])
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/export/diffs", tags=["报告"])
async def export_diffs(diff_type: Optional[str] = None, status: Optional[str] = None, db: Session = Depends(get_db)):
    try:
        output = ReportService.export_diffs_to_excel(db, diff_type, status)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=差异明细_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/export/requisitions", tags=["报告"])
async def export_requisitions(db: Session = Depends(get_db)):
    try:
        output = ReportService.export_requisitions_to_excel(db)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=领料单明细_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/reports/export/full", tags=["报告"])
async def export_full_report(db: Session = Depends(get_db)):
    try:
        output = ReportService.export_full_reconciliation_report(db)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=对账完整报告_{datetime.now().strftime('%Y%m%d')}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/requisitions", tags=["基础数据"])
async def list_requisitions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    requisitions = db.query(MaterialRequisition).offset(skip).limit(limit).all()
    return {"success": True, "data": requisitions, "count": len(requisitions)}


@app.get("/vehicle-materials", tags=["基础数据"])
async def list_vehicle_materials(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    materials = db.query(VehicleMaterial).offset(skip).limit(limit).all()
    return {"success": True, "data": materials, "count": len(materials)}


@app.get("/inventory", tags=["基础数据"])
async def list_inventory(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    items = db.query(Inventory).offset(skip).limit(limit).all()
    return {"success": True, "data": items, "count": len(items)}
