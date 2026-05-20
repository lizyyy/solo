from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse
from datetime import datetime

from .database import engine, get_db, Base
from . import models, schemas, services
from .models import SubmissionStatus

Base.metadata.create_all(bind=engine)

app = FastAPI(title="作业判分回调台 API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/submissions/", response_model=schemas.SubmissionResponse)
def create_submission(submission: schemas.SubmissionCreate, db: Session = Depends(get_db)):
    return services.create_submission(db, submission)


@app.get("/api/submissions/", response_model=List[schemas.SubmissionResponse])
def read_submissions(
    skip: int = 0,
    limit: int = 100,
    status: Optional[SubmissionStatus] = None,
    course_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return services.get_submissions(db, skip, limit, status, course_id)


@app.get("/api/submissions/{submission_id}", response_model=schemas.SubmissionDetailResponse)
def read_submission(submission_id: str, db: Session = Depends(get_db)):
    submission = services.get_submission(db, submission_id)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.put("/api/submissions/{submission_id}/status", response_model=schemas.SubmissionResponse)
def update_submission_status(
    submission_id: str,
    request: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    submission = services.update_submission_status(db, submission_id, request.status, request.updated_by)
    if submission is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return submission


@app.post("/api/grading-tasks/", response_model=schemas.GradingTaskResponse)
def create_grading_task(task: schemas.GradingTaskCreate, db: Session = Depends(get_db)):
    return services.create_grading_task(db, task)


@app.put("/api/grading-tasks/{task_id}/complete", response_model=schemas.GradingTaskResponse)
def complete_grading_task(
    task_id: str,
    score: float,
    details: str = "",
    db: Session = Depends(get_db)
):
    task = services.complete_grading_task(db, task_id, score, details)
    if task is None:
        raise HTTPException(status_code=404, detail="Grading task not found")
    return task


@app.post("/api/callback-payloads/", response_model=schemas.CallbackPayloadResponse)
def create_callback_payload(payload: schemas.CallbackPayloadCreate, db: Session = Depends(get_db)):
    return services.create_callback_payload(db, payload)


@app.post("/api/callback-payloads/{payload_id}/verify", response_model=schemas.CallbackPayloadResponse)
def verify_callback_payload(payload_id: str, db: Session = Depends(get_db)):
    payload = services.verify_callback_payload(db, payload_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Callback payload not found")
    return payload


@app.post("/api/callback-payloads/{payload_id}/write-grade", response_model=schemas.CallbackPayloadResponse)
def write_grade(
    payload_id: str,
    request: schemas.GradeWriteRequest,
    db: Session = Depends(get_db)
):
    payload = services.write_grade(db, payload_id, request.score)
    if payload is None:
        raise HTTPException(status_code=404, detail="Callback payload not found")
    return payload


@app.get("/api/exceptions/", response_model=List[schemas.ExceptionLogResponse])
def read_exceptions(unresolved_only: bool = False, db: Session = Depends(get_db)):
    return services.get_exceptions(db, unresolved_only)


@app.put("/api/exceptions/{exception_id}/resolve", response_model=schemas.ExceptionLogResponse)
def resolve_exception(exception_id: str, resolved_by: str, db: Session = Depends(get_db)):
    exception = services.resolve_exception(db, exception_id, resolved_by)
    if exception is None:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@app.post("/api/retry/", response_model=schemas.RetryRecordResponse)
def retry_callback(request: schemas.RetryRequest, db: Session = Depends(get_db)):
    retry_record = services.retry_callback(db, request.submission_id, request.retry_type, request.triggered_by)
    if retry_record is None:
        raise HTTPException(status_code=404, detail="Submission not found")
    return retry_record


@app.get("/api/statistics/", response_model=schemas.StatisticsResponse)
def get_statistics(db: Session = Depends(get_db)):
    return services.get_statistics(db)


@app.post("/api/export/")
def export_data(request: schemas.ExportRequest, db: Session = Depends(get_db)):
    submissions = services.get_submissions(
        db,
        status=request.status,
        course_id=request.course_id
    )
    
    data = []
    for sub in submissions:
        if request.start_date and sub.submit_time < request.start_date:
            continue
        if request.end_date and sub.submit_time > request.end_date:
            continue
        
        data.append({
            "submission_id": sub.submission_id,
            "student_id": sub.student_id,
            "assignment_id": sub.assignment_id,
            "course_id": sub.course_id,
            "status": sub.status,
            "final_score": sub.final_score,
            "submit_time": sub.submit_time.isoformat() if sub.submit_time else None
        })
    
    df = pd.DataFrame(data)
    
    output = BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Submissions')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename=submissions_export.xlsx"}
    )


@app.get("/health")
def health_check():
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/")
def root():
    return {
        "message": "作业判分回调台 API",
        "version": "1.0.0",
        "docs": "/docs"
    }
