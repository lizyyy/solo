from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import os
import uuid
from datetime import datetime

from database import engine, get_db, Base
import models
import schemas
import services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="脚手架验收停用 API",
    description="工地脚手架验收停用管理系统后端服务",
    version="1.0.0"
)

os.makedirs("uploads", exist_ok=True)


@app.get("/")
def root():
    return {"message": "脚手架验收停用 API 服务运行中", "version": "1.0.0"}


@app.post("/areas/", response_model=schemas.Area, tags=["区域管理"])
def create_area(area: schemas.AreaCreate, db: Session = Depends(get_db)):
    db_area = db.query(models.Area).filter(models.Area.name == area.name).first()
    if db_area:
        raise HTTPException(status_code=400, detail="区域名称已存在")
    return services.create_area(db=db, area=area)


@app.get("/areas/", response_model=List[schemas.Area], tags=["区域管理"])
def get_areas(
    skip: int = 0,
    limit: int = 100,
    is_deactivated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Area)
    if is_deactivated is not None:
        query = query.filter(models.Area.is_deactivated == is_deactivated)
    return query.offset(skip).limit(limit).all()


@app.get("/areas/{area_id}", response_model=schemas.Area, tags=["区域管理"])
def get_area(area_id: int, db: Session = Depends(get_db)):
    area = db.query(models.Area).filter(models.Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="区域不存在")
    return area


@app.post("/areas/{area_id}/deactivate", response_model=schemas.Area, tags=["区域管理"])
def deactivate_area(
    area_id: int,
    reason: str,
    operator: str = Query(...),
    db: Session = Depends(get_db)
):
    area = services.deactivate_area(db, area_id, reason, operator)
    if not area:
        raise HTTPException(status_code=404, detail="区域不存在")
    return area


@app.post("/scaffolds/", response_model=schemas.Scaffold, tags=["脚手架管理"])
def create_scaffold(scaffold: schemas.ScaffoldCreate, db: Session = Depends(get_db)):
    db_scaffold = db.query(models.Scaffold).filter(
        models.Scaffold.scaffold_number == scaffold.scaffold_number
    ).first()
    if db_scaffold:
        raise HTTPException(status_code=400, detail="脚手架编号已存在")
    
    area = db.query(models.Area).filter(models.Area.id == scaffold.area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="所属区域不存在")
    
    return services.create_scaffold(db=db, scaffold=scaffold)


@app.get("/scaffolds/", response_model=List[schemas.Scaffold], tags=["脚手架管理"])
def get_scaffolds(
    skip: int = 0,
    limit: int = 100,
    area_id: Optional[int] = None,
    is_deactivated: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Scaffold)
    if area_id:
        query = query.filter(models.Scaffold.area_id == area_id)
    if is_deactivated is not None:
        query = query.filter(models.Scaffold.is_deactivated == is_deactivated)
    return query.offset(skip).limit(limit).all()


@app.get("/scaffolds/{scaffold_id}", response_model=schemas.Scaffold, tags=["脚手架管理"])
def get_scaffold(scaffold_id: int, db: Session = Depends(get_db)):
    scaffold = db.query(models.Scaffold).filter(models.Scaffold.id == scaffold_id).first()
    if not scaffold:
        raise HTTPException(status_code=404, detail="脚手架不存在")
    return scaffold


@app.post("/scaffolds/{scaffold_id}/deactivate", response_model=schemas.Scaffold, tags=["脚手架管理"])
def deactivate_scaffold(
    scaffold_id: int,
    reason: str,
    operator: str = Query(...),
    db: Session = Depends(get_db)
):
    scaffold = services.deactivate_scaffold(db, scaffold_id, reason, operator)
    if not scaffold:
        raise HTTPException(status_code=404, detail="脚手架不存在")
    return scaffold


@app.get("/scaffolds/{scaffold_id}/deactivation-check", tags=["脚手架管理"])
def check_scaffold_deactivation(scaffold_id: int, db: Session = Depends(get_db)):
    return services.check_deactivation_interception(db, scaffold_id)


@app.post("/acceptance/", response_model=schemas.AcceptanceRecord, tags=["验收管理"])
def create_acceptance_record(record: schemas.AcceptanceRecordCreate, db: Session = Depends(get_db)):
    scaffold = db.query(models.Scaffold).filter(models.Scaffold.id == record.scaffold_id).first()
    if not scaffold:
        raise HTTPException(status_code=404, detail="脚手架不存在")
    
    return services.create_acceptance_record(db=db, record=record)


@app.get("/acceptance/", response_model=List[schemas.AcceptanceRecord], tags=["验收管理"])
def get_acceptance_records(
    skip: int = 0,
    limit: int = 100,
    batch_no: Optional[str] = None,
    scaffold_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.AcceptanceRecord)
    if batch_no:
        query = query.filter(models.AcceptanceRecord.batch_no == batch_no)
    if scaffold_id:
        query = query.filter(models.AcceptanceRecord.scaffold_id == scaffold_id)
    if status:
        query = query.filter(models.AcceptanceRecord.status == status)
    return query.order_by(models.AcceptanceRecord.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/acceptance/{record_id}", response_model=schemas.AcceptanceRecord, tags=["验收管理"])
def get_acceptance_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.AcceptanceRecord).filter(models.AcceptanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    return record


@app.post("/acceptance/{record_id}/submit", tags=["验收管理"])
def submit_acceptance(
    record_id: int,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    try:
        result = services.submit_acceptance_record(db, record_id, operator)
        if not result:
            raise HTTPException(status_code=404, detail="验收记录不存在")
        record, validation_result = result
        return {
            "record": schemas.AcceptanceRecord.model_validate(record),
            "validation": validation_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/acceptance/{record_id}/manual-review", response_model=schemas.AcceptanceRecord, tags=["验收管理"])
def manual_review_acceptance(
    record_id: int,
    request: schemas.ManualReviewRequest,
    db: Session = Depends(get_db)
):
    try:
        record = services.manual_review(
            db, record_id, request.operator, request.reason, request.approved
        )
        if not record:
            raise HTTPException(status_code=404, detail="验收记录不存在")
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/acceptance/{record_id}/return", response_model=schemas.AcceptanceRecord, tags=["验收管理"])
def return_for_supplement(
    record_id: int,
    request: schemas.ReturnRequest,
    db: Session = Depends(get_db)
):
    try:
        record = services.return_for_supplement(
            db, record_id, request.operator, request.reason
        )
        if not record:
            raise HTTPException(status_code=404, detail="验收记录不存在")
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/acceptance/{record_id}/recalculate", tags=["验收管理"])
def recalculate_acceptance(
    record_id: int,
    operator: Optional[str] = None,
    db: Session = Depends(get_db)
):
    result = services.recalculate_status(db, record_id, operator)
    if not result:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    record, validation_result = result
    return {
        "record": schemas.AcceptanceRecord.model_validate(record),
        "validation": validation_result
    }


@app.post("/acceptance/{record_id}/photos/", response_model=schemas.Photo, tags=["照片管理"])
async def upload_photo(
    record_id: int,
    photo_type: Optional[str] = None,
    description: Optional[str] = None,
    uploaded_by: Optional[str] = None,
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    record = db.query(models.AcceptanceRecord).filter(models.AcceptanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="验收记录不存在")

    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4().hex}{file_ext}"
    file_path = f"uploads/{unique_filename}"

    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)

    photo_create = schemas.PhotoCreate(
        file_path=file_path,
        file_name=file.filename,
        photo_type=photo_type,
        description=description,
        uploaded_by=uploaded_by
    )

    return services.add_photo(db, record_id, photo_create)


@app.get("/acceptance/{record_id}/photos/", response_model=List[schemas.Photo], tags=["照片管理"])
def get_photos(record_id: int, db: Session = Depends(get_db)):
    record = db.query(models.AcceptanceRecord).filter(models.AcceptanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    return record.photos


@app.get("/photos/{photo_id}", response_model=schemas.Photo, tags=["照片管理"])
def get_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    return photo


@app.get("/photos/{photo_id}/download", tags=["照片管理"])
def download_photo(photo_id: int, db: Session = Depends(get_db)):
    photo = db.query(models.Photo).filter(models.Photo.id == photo_id).first()
    if not photo:
        raise HTTPException(status_code=404, detail="照片不存在")
    
    if not os.path.exists(photo.file_path):
        raise HTTPException(status_code=404, detail="照片文件不存在")
    
    return FileResponse(
        photo.file_path,
        media_type="image/jpeg",
        filename=photo.file_name
    )


@app.post("/rectifications/{rect_id}/close", response_model=schemas.Rectification, tags=["整改管理"])
def close_rectification(
    rect_id: int,
    request: schemas.RectificationCloseRequest,
    db: Session = Depends(get_db)
):
    rect = services.close_rectification(
        db, rect_id, request.operator, request.verification_method
    )
    if not rect:
        raise HTTPException(status_code=404, detail="整改项不存在")
    return rect


@app.get("/rectifications/", response_model=List[schemas.Rectification], tags=["整改管理"])
def get_rectifications(
    skip: int = 0,
    limit: int = 100,
    record_id: Optional[int] = None,
    scaffold_id: Optional[int] = None,
    is_closed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Rectification)
    if record_id:
        query = query.filter(models.Rectification.acceptance_record_id == record_id)
    if scaffold_id:
        query = query.filter(models.Rectification.scaffold_id == scaffold_id)
    if is_closed is not None:
        query = query.filter(models.Rectification.is_closed == is_closed)
    return query.offset(skip).limit(limit).all()


@app.post("/acceptance/{record_id}/report", response_model=schemas.AcceptanceReport, tags=["报告管理"])
def generate_acceptance_report(
    record_id: int,
    generated_by: str = Query(...),
    db: Session = Depends(get_db)
):
    try:
        report = services.generate_report(db, record_id, generated_by)
        if not report:
            raise HTTPException(status_code=404, detail="验收记录不存在")
        return report
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/reports/{report_id}/download", tags=["报告管理"])
def download_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.AcceptanceReport).filter(models.AcceptanceReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")
    
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail="报告文件不存在")
    
    return FileResponse(
        report.file_path,
        media_type="text/plain",
        filename=f"{report.report_no}.txt"
    )


@app.get("/acceptance/{record_id}/logs/", response_model=List[schemas.OperationLog], tags=["历史记录"])
def get_operation_logs(
    record_id: int,
    db: Session = Depends(get_db)
):
    record = db.query(models.AcceptanceRecord).filter(models.AcceptanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="验收记录不存在")
    return record.operation_logs


@app.get("/statistics", response_model=schemas.StatisticsResponse, tags=["统计查询"])
def get_statistics(db: Session = Depends(get_db)):
    return services.get_statistics(db)


@app.get("/statistics/verify", tags=["统计查询"])
def verify_statistics(db: Session = Depends(get_db)):
    return services.verify_statistics(db)


@app.get("/health", tags=["系统"])
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}
