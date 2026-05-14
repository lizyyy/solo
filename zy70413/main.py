from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from database import engine, get_db, Base
from services import VerificationService
from export_service import ExportService
import schemas
import models
import os

Base.metadata.create_all(bind=engine)

app = FastAPI(title="批量回调验签服务", version="1.0.0")


@app.post("/api/batch/submit", response_model=schemas.BatchSubmitResponse)
def submit_batch(request: schemas.BatchSubmitRequest, db: Session = Depends(get_db)):
    try:
        return VerificationService.process_batch(db, request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/batch/{batch_no}", response_model=schemas.BatchResponse)
def get_batch(batch_no: str, include_details: bool = True, db: Session = Depends(get_db)):
    batch = VerificationService.get_batch(db, batch_no, include_details)
    if not batch:
        raise HTTPException(status_code=404, detail=f"批次不存在: {batch_no}")
    return batch


@app.get("/api/batch/{batch_no}/details")
def get_batch_details(batch_no: str, db: Session = Depends(get_db)):
    batch = db.query(models.Batch).filter(models.Batch.batch_no == batch_no).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"批次不存在: {batch_no}")
    
    details = db.query(models.BatchDetail).filter(models.BatchDetail.batch_id == batch.id).all()
    return {
        "batch_no": batch_no,
        "total_count": len(details),
        "details": [
            {
                "id": d.id,
                "sequence_no": d.sequence_no,
                "member_id": d.member_id,
                "transaction_no": d.transaction_no,
                "transaction_time": d.transaction_time,
                "amount": d.amount,
                "status": d.status,
                "error_message": d.error_message,
                "is_time_order_error": d.is_time_order_error,
                "verification_result": d.verification_result
            }
            for d in details
        ]
    }


@app.post("/api/notes", response_model=schemas.ManualNoteResponse)
def add_manual_note(note_data: schemas.ManualNoteCreate, db: Session = Depends(get_db)):
    try:
        return VerificationService.add_manual_note(db, note_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/notes/caller/{caller}")
def get_notes_by_caller(caller: str, db: Session = Depends(get_db)):
    return VerificationService.get_notes_by_caller(db, caller)


@app.post("/api/export", response_model=schemas.ExportResponse)
def export_batch(request: schemas.ExportRequest, db: Session = Depends(get_db)):
    try:
        return ExportService.export_batch_to_excel(
            db,
            request.batch_no,
            request.include_failed_only,
            request.created_by
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/export/{task_no}/download")
def download_export(task_no: str, db: Session = Depends(get_db)):
    task = ExportService.get_export_task(db, task_no)
    if not task:
        raise HTTPException(status_code=404, detail=f"导出任务不存在: {task_no}")
    
    if not os.path.exists(task.file_path):
        raise HTTPException(status_code=404, detail="导出文件不存在")
    
    return FileResponse(
        path=task.file_path,
        filename=os.path.basename(task.file_path),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.post("/api/rules", response_model=schemas.RuleResponse)
def create_rule(rule_data: schemas.RuleCreate, db: Session = Depends(get_db)):
    try:
        return VerificationService.create_rule(db, rule_data)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/rules")
def list_rules(db: Session = Depends(get_db)):
    rules = db.query(models.VerificationRule).all()
    return [
        {
            "version": r.version,
            "rule_name": r.rule_name,
            "description": r.description,
            "is_active": r.is_active,
            "created_at": r.created_at
        }
        for r in rules
    ]


@app.get("/api/health")
def health_check():
    return {"status": "ok", "service": "批量回调验签服务"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
