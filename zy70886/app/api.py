from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List
import os
import tempfile
from datetime import datetime

from app.database import get_db
from app import schemas, models
from app.services import ImportService, ReconciliationEngine, ReviewService, ReportService

router = APIRouter(prefix="/api/v1")


@router.post("/import/applications", response_model=schemas.ImportResponse)
async def import_applications(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        service = ImportService(db)
        imported_count, errors = service.import_contract_applications_from_csv(tmp_path)
        return {
            "success": len(errors) == 0,
            "message": f"成功导入 {imported_count} 条记录",
            "imported_count": imported_count,
            "errors": errors
        }
    finally:
        os.unlink(tmp_path)


@router.post("/import/stamps", response_model=schemas.ImportResponse)
async def import_stamps(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持JSON文件")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        service = ImportService(db)
        imported_count, errors = service.import_stamp_records_from_json(tmp_path)
        return {
            "success": len(errors) == 0,
            "message": f"成功导入 {imported_count} 条记录",
            "imported_count": imported_count,
            "errors": errors
        }
    finally:
        os.unlink(tmp_path)


@router.post("/import/approvals", response_model=schemas.ImportResponse)
async def import_approvals(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.json'):
        raise HTTPException(status_code=400, detail="只支持JSON文件")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.json') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        service = ImportService(db)
        imported_count, errors = service.import_approval_records_from_json(tmp_path)
        return {
            "success": len(errors) == 0,
            "message": f"成功导入 {imported_count} 条记录",
            "imported_count": imported_count,
            "errors": errors
        }
    finally:
        os.unlink(tmp_path)


@router.post("/import/express", response_model=schemas.ImportResponse)
async def import_express(file: UploadFile = File(...), db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")

    with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
        tmp.write(await file.read())
        tmp_path = tmp.name

    try:
        service = ImportService(db)
        imported_count, errors = service.import_express_records_from_csv(tmp_path)
        return {
            "success": len(errors) == 0,
            "message": f"成功导入 {imported_count} 条记录",
            "imported_count": imported_count,
            "errors": errors
        }
    finally:
        os.unlink(tmp_path)


@router.post("/reconciliation/run")
def run_reconciliation(batch_id: str, batch_name: str = None, created_by: str = None, db: Session = Depends(get_db)):
    engine = ReconciliationEngine(db)
    result = engine.run_reconciliation(batch_id, batch_name, created_by)
    return result


@router.post("/reconciliation/{id}/recalculate")
def recalculate_single(id: int, db: Session = Depends(get_db)):
    engine = ReconciliationEngine(db)
    try:
        result = engine.recalculate_single(id)
        return {"success": True, "message": "重新计算完成", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/review")
def process_review(request: schemas.ReviewRequest, db: Session = Depends(get_db)):
    service = ReviewService(db)
    try:
        result = service.process_review(
            request.reconciliation_result_id,
            request.action,
            request.reviewer,
            request.opinion,
            request.change_summary
        )
        return {"success": True, "message": "复核完成", "result": result}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/review/{result_id}/history")
def get_review_history(result_id: int, db: Session = Depends(get_db)):
    service = ReviewService(db)
    history = service.get_review_history(result_id)
    return history


@router.get("/audit-trail/{application_no}")
def get_audit_trail(application_no: str, db: Session = Depends(get_db)):
    service = ReviewService(db)
    return service.get_audit_trail(application_no)


@router.get("/explanation/{result_id}")
def get_disposition_explanation(result_id: int, db: Session = Depends(get_db)):
    service = ReviewService(db)
    explanation = service.generate_disposition_explanation(result_id)
    return {"explanation": explanation}


@router.get("/batch/{batch_id}/summary")
def get_batch_summary(batch_id: str, db: Session = Depends(get_db)):
    service = ReportService(db)
    summary = service.get_batch_summary(batch_id)
    if not summary:
        raise HTTPException(status_code=404, detail="批次不存在")
    return summary


@router.get("/batch/{batch_id}/details")
def get_batch_details(batch_id: str, status: str = None, db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.get_reconciliation_details(batch_id, status)


@router.get("/reconciliation/{id}/full-chain")
def get_full_chain_detail(id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    detail = service.get_full_chain_detail(id)
    if not detail:
        raise HTTPException(status_code=404, detail="记录不存在")
    return detail


@router.get("/export/batch/{batch_id}/excel")
def export_batch_excel(batch_id: str, db: Session = Depends(get_db)):
    service = ReportService(db)
    excel_data = service.export_to_excel(batch_id)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=reconciliation_{batch_id}.xlsx"}
    )


@router.get("/export/reconciliation/{id}/excel")
def export_reconciliation_excel(id: int, db: Session = Depends(get_db)):
    service = ReportService(db)
    excel_data = service.export_single_detail_excel(id)

    return StreamingResponse(
        excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=reconciliation_detail_{id}.xlsx"}
    )


@router.get("/statistics")
def get_statistics(start_date: datetime = None, end_date: datetime = None, db: Session = Depends(get_db)):
    service = ReportService(db)
    return service.generate_statistics_report(start_date, end_date)


@router.get("/batches")
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(models.ReconciliationBatch).order_by(models.ReconciliationBatch.created_at.desc()).all()
    return batches


@router.get("/applications")
def list_applications(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    applications = db.query(models.ContractApplication).offset(skip).limit(limit).all()
    return applications


@router.get("/applications/{application_no}")
def get_application(application_no: str, db: Session = Depends(get_db)):
    app = db.query(models.ContractApplication).filter(
        models.ContractApplication.application_no == application_no
    ).first()
    if not app:
        raise HTTPException(status_code=404, detail="申请不存在")
    return app
