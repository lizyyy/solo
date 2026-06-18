from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import engine, Base, get_db
from app import models, schemas, services

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="港湾淤积时序回放",
    description="生态调查员阿宁的港湾淤积时序回放系统 - 交接版",
    version="1.0.0",
)


@app.post("/api/records", response_model=schemas.SiltationRecordSimple, tags=["淤积记录"])
def create_record(data: schemas.SiltationRecordCreate, db: Session = Depends(get_db)):
    existing = db.query(models.SiltationRecord).filter(models.SiltationRecord.record_no == data.record_no).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"记录编号已存在: {data.record_no}")
    return services.create_record(db, data)


@app.get("/api/records/{record_id}", response_model=schemas.SiltationRecordDetail, tags=["淤积记录"])
def get_record(record_id: int, db: Session = Depends(get_db)):
    detail = services.get_record_detail(db, record_id)
    if not detail:
        raise HTTPException(status_code=404, detail="记录不存在")
    return detail


@app.post("/api/records/{record_id}/retry", response_model=schemas.SiltationRecordSimple, tags=["淤积记录"])
def retry_record(record_id: int, db: Session = Depends(get_db)):
    try:
        return services.retry_failed_record(db, record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/remote-sensing", tags=["遥感截图"])
def add_remote_sensing_image(data: schemas.RemoteSensingImageCreate, db: Session = Depends(get_db)):
    try:
        img = services.add_remote_sensing_image(db, data)
        return {"id": img.id, "record_id": img.record_id, "has_cloud_cover": img.has_cloud_cover}
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/gray-release-note", response_model=schemas.SiltationRecordDetail, tags=["灰度发布"])
def add_gray_release_note(data: schemas.GrayReleaseNoteUpdate, db: Session = Depends(get_db)):
    try:
        services.add_gray_release_note(db, data)
        return services.get_record_detail(db, data.record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/api/post-run-supplement", response_model=schemas.SiltationRecordDetail, tags=["补录"])
def add_post_run_supplement(data: schemas.PostRunSupplement, db: Session = Depends(get_db)):
    try:
        services.add_post_run_supplement(db, data)
        return services.get_record_detail(db, data.record_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/manager/records", response_model=List[schemas.ManagerRecordView], tags=["运营主管"])
def list_manager_records(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return services.list_manager_records(db, skip=skip, limit=limit)


@app.get("/api/manager/records/{record_id}", response_model=schemas.ManagerRecordView, tags=["运营主管"])
def get_manager_record(record_id: int, db: Session = Depends(get_db)):
    view = services.get_manager_view(db, record_id)
    if not view:
        raise HTTPException(status_code=404, detail="记录不存在")
    return view


@app.get("/api/health", tags=["系统"])
def health_check():
    return {"status": "ok", "service": "harbor-siltation-playback"}
