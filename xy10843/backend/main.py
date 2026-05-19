from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime
from typing import List, Optional
import csv
import io
from fastapi.responses import StreamingResponse

from database import get_db, init_db, Sample, Annotator, TaskPackage, TaskItem, SkipRecord, ReworkRecord
import schemas

app = FastAPI(title="标注任务分发 API")

@app.on_event("startup")
async def startup_event():
    init_db()

@app.get("/")
async def root():
    return FileResponse("../frontend/index.html")

@app.post("/api/annotators/", response_model=schemas.Annotator)
def create_annotator(annotator: schemas.AnnotatorCreate, db: Session = Depends(get_db)):
    db_annotator = db.query(Annotator).filter(Annotator.email == annotator.email).first()
    if db_annotator:
        raise HTTPException(status_code=400, detail="Email already registered")
    db_annotator = Annotator(name=annotator.name, email=annotator.email)
    db.add(db_annotator)
    db.commit()
    db.refresh(db_annotator)
    return db_annotator

@app.get("/api/annotators/", response_model=List[schemas.Annotator])
def get_annotators(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    annotators = db.query(Annotator).offset(skip).limit(limit).all()
    return annotators

@app.post("/api/samples/", response_model=schemas.Sample)
def create_sample(sample: schemas.SampleCreate, db: Session = Depends(get_db)):
    db_sample = Sample(content=sample.content, original_annotation=sample.original_annotation)
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.post("/api/samples/batch/", response_model=List[schemas.Sample])
def create_samples_batch(samples: List[schemas.SampleCreate], db: Session = Depends(get_db)):
    db_samples = []
    for sample in samples:
        db_sample = Sample(content=sample.content, original_annotation=sample.original_annotation)
        db.add(db_sample)
        db_samples.append(db_sample)
    db.commit()
    for sample in db_samples:
        db.refresh(sample)
    return db_samples

@app.get("/api/samples/", response_model=List[schemas.Sample])
def get_samples(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Sample)
    if status:
        query = query.filter(Sample.status == status)
    samples = query.order_by(desc(Sample.created_at)).offset(skip).limit(limit).all()
    return samples

@app.get("/api/samples/{sample_id}", response_model=schemas.Sample)
def get_sample(sample_id: int, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.id == sample_id).first()
    if sample is None:
        raise HTTPException(status_code=404, detail="Sample not found")
    return sample

@app.post("/api/tasks/", response_model=schemas.TaskPackage)
def create_task_package(task: schemas.TaskPackageCreate, db: Session = Depends(get_db)):
    annotator = db.query(Annotator).filter(Annotator.id == task.annotator_id).first()
    if not annotator:
        raise HTTPException(status_code=404, detail="Annotator not found")
    
    db_task = TaskPackage(name=task.name, annotator_id=task.annotator_id)
    db.add(db_task)
    db.flush()
    
    for sample_id in task.sample_ids:
        sample = db.query(Sample).filter(Sample.id == sample_id).first()
        if sample and sample.status == "pending":
            task_item = TaskItem(package_id=db_task.id, sample_id=sample_id, status="assigned")
            db.add(task_item)
            sample.status = "assigned"
            sample.locked_by = task.annotator_id
            sample.locked_at = datetime.utcnow()
    
    db.commit()
    db.refresh(db_task)
    return db_task

@app.get("/api/tasks/", response_model=List[schemas.TaskPackage])
def get_tasks(
    skip: int = 0, 
    limit: int = 100, 
    annotator_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(TaskPackage)
    if annotator_id:
        query = query.filter(TaskPackage.annotator_id == annotator_id)
    if status:
        query = query.filter(TaskPackage.status == status)
    tasks = query.order_by(desc(TaskPackage.assigned_at)).offset(skip).limit(limit).all()
    return tasks

@app.get("/api/tasks/{task_id}", response_model=schemas.TaskPackage)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(TaskPackage).filter(TaskPackage.id == task_id).first()
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return task

@app.get("/api/tasks/{task_id}/items", response_model=List[schemas.TaskItem])
def get_task_items(task_id: int, db: Session = Depends(get_db)):
    items = db.query(TaskItem).filter(TaskItem.package_id == task_id).all()
    return items

@app.post("/api/tasks/items/{item_id}/submit")
def submit_annotation(
    item_id: int,
    request: schemas.SubmitAnnotationRequest,
    db: Session = Depends(get_db)
):
    item = db.query(TaskItem).filter(TaskItem.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Task item not found")
    if item.status == "completed":
        raise HTTPException(status_code=400, detail="Task already completed")
    if item.status == "skipped":
        raise HTTPException(status_code=400, detail="Task has been skipped")
    
    item.status = "completed"
    item.annotation_result = request.annotation_result
    item.annotated_at = datetime.utcnow()
    
    sample = db.query(Sample).filter(Sample.id == item.sample_id).first()
    if sample:
        sample.status = "completed"
        sample.current_annotation = request.annotation_result
        sample.locked_by = None
        sample.locked_at = None
    
    package = db.query(TaskPackage).filter(TaskPackage.id == item.package_id).first()
    if package:
        all_finished = all(i.status in ["completed", "skipped"] for i in package.items)
        if all_finished:
            package.status = "completed"
            package.completed_at = datetime.utcnow()
    
    db.commit()
    return {"status": "success", "message": "Annotation submitted"}

@app.post("/api/skips/", response_model=schemas.SkipRecord)
def create_skip(skip: schemas.SkipRecordCreate, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.id == skip.sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    db_skip = SkipRecord(
        sample_id=skip.sample_id,
        annotator_id=skip.annotator_id,
        reason=skip.reason
    )
    sample.status = "skipped"
    sample.locked_by = None
    sample.locked_at = None
    
    task_item = db.query(TaskItem).filter(TaskItem.sample_id == skip.sample_id, TaskItem.status.in_(["assigned", "pending"])).first()
    if task_item:
        task_item.status = "skipped"
        package = db.query(TaskPackage).filter(TaskPackage.id == task_item.package_id).first()
        if package:
            all_finished = all(i.status in ["completed", "skipped"] for i in package.items)
            if all_finished:
                package.status = "completed"
                package.completed_at = datetime.utcnow()
    
    db.add(db_skip)
    db.commit()
    db.refresh(db_skip)
    return db_skip

@app.get("/api/skips/", response_model=List[schemas.SkipRecord])
def get_skips(
    skip: int = 0, 
    limit: int = 100, 
    reviewed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SkipRecord)
    if reviewed is not None:
        query = query.filter(SkipRecord.reviewed == reviewed)
    skips = query.order_by(desc(SkipRecord.created_at)).offset(skip).limit(limit).all()
    return skips

@app.get("/api/skips/{skip_id}", response_model=schemas.SkipRecord)
def get_skip(skip_id: int, db: Session = Depends(get_db)):
    skip = db.query(SkipRecord).filter(SkipRecord.id == skip_id).first()
    if skip is None:
        raise HTTPException(status_code=404, detail="Skip record not found")
    return skip

@app.post("/api/skips/{skip_id}/review")
def review_skip(
    skip_id: int,
    request: schemas.ReviewSkipRequest,
    db: Session = Depends(get_db)
):
    skip = db.query(SkipRecord).filter(SkipRecord.id == skip_id).first()
    if not skip:
        raise HTTPException(status_code=404, detail="Skip record not found")
    if skip.reviewed:
        raise HTTPException(status_code=400, detail="Already reviewed")
    
    skip.reviewed = True
    skip.review_result = request.review_result
    skip.review_note = request.review_note
    skip.reviewed_by = request.reviewed_by
    skip.reviewed_at = datetime.utcnow()
    
    sample = db.query(Sample).filter(Sample.id == skip.sample_id).first()
    if sample:
        if request.review_result == "reassign":
            sample.status = "pending"
            task_item = db.query(TaskItem).filter(TaskItem.sample_id == skip.sample_id, TaskItem.status == "skipped").first()
            if task_item:
                task_item.status = "pending"
        elif request.review_result == "accept":
            sample.status = "completed"
            task_item = db.query(TaskItem).filter(TaskItem.sample_id == skip.sample_id, TaskItem.status == "skipped").first()
            if task_item:
                task_item.status = "completed"
                package = db.query(TaskPackage).filter(TaskPackage.id == task_item.package_id).first()
                if package:
                    all_finished = all(i.status in ["completed", "skipped"] for i in package.items)
                    if all_finished:
                        package.status = "completed"
                        package.completed_at = datetime.utcnow()
    
    db.commit()
    return {"status": "success", "message": "Review completed"}

@app.post("/api/reworks/", response_model=schemas.ReworkRecord)
def create_rework(rework: schemas.ReworkRecordCreate, db: Session = Depends(get_db)):
    sample = db.query(Sample).filter(Sample.id == rework.sample_id).first()
    if not sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    db_rework = ReworkRecord(
        sample_id=rework.sample_id,
        requester_id=rework.requester_id,
        original_annotation=rework.original_annotation,
        reason=rework.reason
    )
    sample.status = "rework"
    
    db.add(db_rework)
    db.commit()
    db.refresh(db_rework)
    return db_rework

@app.get("/api/reworks/", response_model=List[schemas.ReworkRecord])
def get_reworks(
    skip: int = 0, 
    limit: int = 100, 
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ReworkRecord)
    if status:
        query = query.filter(ReworkRecord.status == status)
    reworks = query.order_by(desc(ReworkRecord.created_at)).offset(skip).limit(limit).all()
    return reworks

@app.get("/api/reworks/{rework_id}", response_model=schemas.ReworkRecord)
def get_rework(rework_id: int, db: Session = Depends(get_db)):
    rework = db.query(ReworkRecord).filter(ReworkRecord.id == rework_id).first()
    if rework is None:
        raise HTTPException(status_code=404, detail="Rework record not found")
    return rework

@app.post("/api/reworks/{rework_id}/complete")
def complete_rework(
    rework_id: int,
    request: schemas.CompleteReworkRequest,
    db: Session = Depends(get_db)
):
    rework = db.query(ReworkRecord).filter(ReworkRecord.id == rework_id).first()
    if not rework:
        raise HTTPException(status_code=404, detail="Rework record not found")
    if rework.status == "completed":
        raise HTTPException(status_code=400, detail="Rework already completed")
    
    rework.status = "completed"
    rework.rework_annotation = request.rework_annotation
    rework.reworked_at = datetime.utcnow()
    
    sample = db.query(Sample).filter(Sample.id == rework.sample_id).first()
    if sample:
        sample.status = "completed"
        sample.current_annotation = request.rework_annotation
    
    db.commit()
    return {"status": "success", "message": "Rework completed"}

@app.get("/api/statistics", response_model=schemas.StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    total_samples = db.query(func.count(Sample.id)).scalar()
    pending_samples = db.query(func.count(Sample.id)).filter(Sample.status == "pending").scalar()
    completed_samples = db.query(func.count(Sample.id)).filter(Sample.status == "completed").scalar()
    skipped_samples = db.query(func.count(Sample.id)).filter(Sample.status == "skipped").scalar()
    rework_samples = db.query(func.count(Sample.id)).filter(Sample.status == "rework").scalar()
    
    total_tasks = db.query(func.count(TaskPackage.id)).scalar()
    completed_tasks = db.query(func.count(TaskPackage.id)).filter(TaskPackage.status == "completed").scalar()
    
    pending_skips = db.query(func.count(SkipRecord.id)).filter(SkipRecord.reviewed == False).scalar()
    pending_reworks = db.query(func.count(ReworkRecord.id)).filter(ReworkRecord.status == "pending").scalar()
    
    return {
        "total_samples": total_samples,
        "pending_samples": pending_samples,
        "completed_samples": completed_samples,
        "skipped_samples": skipped_samples,
        "rework_samples": rework_samples,
        "total_tasks": total_tasks,
        "completed_tasks": completed_tasks,
        "pending_skips": pending_skips,
        "pending_reworks": pending_reworks
    }

@app.get("/api/export/samples")
def export_samples(db: Session = Depends(get_db)):
    samples = db.query(Sample).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Content", "Original Annotation", "Current Annotation", "Status", "Created At"])
    
    for sample in samples:
        writer.writerow([
            sample.id,
            sample.content,
            sample.original_annotation or "",
            sample.current_annotation or "",
            sample.status,
            sample.created_at.isoformat()
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=samples.csv"}
    )

@app.get("/api/export/skips")
def export_skips(db: Session = Depends(get_db)):
    skips = db.query(SkipRecord).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Sample ID", "Annotator ID", "Reason", "Reviewed", "Review Result", "Created At"])
    
    for skip in skips:
        writer.writerow([
            skip.id,
            skip.sample_id,
            skip.annotator_id,
            skip.reason,
            skip.reviewed,
            skip.review_result or "",
            skip.created_at.isoformat()
        ])
    
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=skips.csv"}
    )

app.mount("/static", StaticFiles(directory="../frontend"), name="static")