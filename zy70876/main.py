from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import models
import schemas
import services
from database import engine, get_db, init_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="研究生院导师分配系统", description="导师分配、调剂管理、审计追踪系统")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.post("/api/advisors/import", response_model=List[schemas.Advisor], tags=["导师管理"])
async def import_advisors(file: UploadFile = File(...), created_by: str = "admin", db: Session = Depends(get_db)):
    content = await file.read()
    advisors = services.AdvisorService.import_advisors_from_csv(db, content.decode('utf-8'), created_by)
    return advisors


@app.get("/api/advisors", response_model=List[schemas.Advisor], tags=["导师管理"])
def get_advisors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Advisor).offset(skip).limit(limit).all()


@app.post("/api/students/preferences/import", response_model=List[schemas.Preference], tags=["学生管理"])
async def import_student_preferences(file: UploadFile = File(...), created_by: str = "admin", db: Session = Depends(get_db)):
    content = await file.read()
    preferences = services.StudentService.import_preferences_from_json(db, content.decode('utf-8'), created_by)
    return preferences


@app.get("/api/students", response_model=List[schemas.Student], tags=["学生管理"])
def get_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.Student).offset(skip).limit(limit).all()


@app.post("/api/batches", response_model=schemas.Batch, tags=["批次管理"])
def create_batch(batch: schemas.BatchCreate, db: Session = Depends(get_db)):
    existing = db.query(models.Batch).filter(models.Batch.batch_code == batch.batch_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="批次代码已存在")
    return services.BatchService.create_batch(db, batch)


@app.get("/api/batches", response_model=List[schemas.Batch], tags=["批次管理"])
def get_batches(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.BatchService.get_batches(db, skip, limit)


@app.post("/api/adjustments/import", tags=["调剂管理"])
async def import_adjustments(file: UploadFile = File(...), created_by: str = "admin", db: Session = Depends(get_db)):
    import json
    content = await file.read()
    data = json.loads(content.decode('utf-8'))
    records = services.AdjustmentService.import_adjustments(db, data, created_by)
    return {"imported": len(records)}


@app.get("/api/adjustments", response_model=List[schemas.AdjustmentRecord], tags=["调剂管理"])
def get_adjustments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.AdjustmentRecord).offset(skip).limit(limit).all()


@app.post("/api/allocations", response_model=schemas.AllocationRecord, tags=["分配管理"])
def create_allocation(allocation: schemas.AllocationRecordCreate, db: Session = Depends(get_db)):
    return services.AllocationService.create_allocation(db, allocation)


@app.post("/api/allocations/{allocation_id}/process", response_model=schemas.AllocationRecord, tags=["分配管理"])
def process_allocation(allocation_id: int, process_request: schemas.ProcessRequest, db: Session = Depends(get_db)):
    try:
        result = services.AllocationService.process_allocation(db, allocation_id, process_request)
        if not result:
            raise HTTPException(status_code=404, detail="分配记录不存在")
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/allocations", response_model=List[schemas.AllocationRecord], tags=["分配管理"])
def query_allocations(
    advisor_id: Optional[int] = None,
    student_id: Optional[int] = None,
    batch_id: Optional[int] = None,
    status: Optional[str] = None,
    research_direction: Optional[str] = None,
    major: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return services.AllocationService.query_allocations(
        db, advisor_id, student_id, batch_id, status, research_direction, major, skip, limit
    )


@app.get("/api/allocations/{allocation_id}", tags=["分配管理"])
def get_allocation_detail(allocation_id: int, db: Session = Depends(get_db)):
    allocation = services.AllocationService.get_allocation_detail(db, allocation_id)
    if not allocation:
        raise HTTPException(status_code=404, detail="分配记录不存在")
    
    student = db.query(models.Student).filter(models.Student.id == allocation.student_id).first()
    advisor = db.query(models.Advisor).filter(models.Advisor.id == allocation.advisor_id).first()
    batch = db.query(models.Batch).filter(models.Batch.id == allocation.batch_id).first()
    audit_logs = services.AuditLogService.get_audit_logs(db, allocation_id)
    
    return {
        "allocation": allocation,
        "student": student,
        "advisor": advisor,
        "batch": batch,
        "audit_logs": audit_logs
    }


@app.post("/api/allocations/export", tags=["导出管理"])
def export_allocations(export_request: schemas.ExportRequest, db: Session = Depends(get_db)):
    excel_file = services.AllocationService.export_to_excel(db, export_request)
    return StreamingResponse(
        excel_file,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=allocation_records.xlsx"}
    )


@app.get("/api/allocations/{allocation_id}/audit-logs", response_model=List[schemas.AuditLog], tags=["审计追踪"])
def get_audit_logs(allocation_id: int, db: Session = Depends(get_db)):
    return services.AuditLogService.get_audit_logs(db, allocation_id)


@app.get("/api/validation/allocation", response_model=schemas.ValidationResult, tags=["校验"])
def validate_allocation(student_id: int, advisor_id: int, db: Session = Depends(get_db)):
    return services.ValidationService.validate_allocation(db, student_id, advisor_id)


@app.get("/", tags=["系统"])
def root():
    return {"message": "研究生院导师分配系统 API", "docs": "/docs", "redoc": "/redoc"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
