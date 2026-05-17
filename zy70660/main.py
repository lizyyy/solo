from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import threading

from database import init_db, get_db
import schemas
import services

app = FastAPI(title="同卡异地白名单异常清单后端API", version="1.0.0")


@app.on_event("startup")
def startup_event():
    init_db()


@app.post("/api/detection/tasks", response_model=schemas.DetectionTask, status_code=status.HTTP_201_CREATED)
def create_detection_task(
    task: schemas.DetectionTaskCreate,
    db: Session = Depends(get_db)
):
    db_task = services.create_detection_task(db, task)

    def run_detection():
        db_session = next(get_db())
        try:
            services.detect_anomalies(db_session, db_task.id, task.time_window_minutes)
        finally:
            db_session.close()

    thread = threading.Thread(target=run_detection)
    thread.start()

    return db_task


@app.get("/api/detection/tasks/{task_id}", response_model=schemas.DetectionTask)
def get_task(task_id: int, db: Session = Depends(get_db)):
    from database import DetectionTask
    task = db.query(DetectionTask).filter(DetectionTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.get("/api/anomalies", response_model=schemas.AnomalyPaginatedResponse)
def list_anomalies(
    status: Optional[str] = None,
    card_number: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db)
):
    return services.get_anomalies(db, status, card_number, page, page_size)


@app.get("/api/anomalies/{anomaly_id}", response_model=schemas.AnomalyRecordDetail)
def get_anomaly(anomaly_id: int, db: Session = Depends(get_db)):
    from database import AnomalyRecord
    anomaly = db.query(AnomalyRecord).filter(AnomalyRecord.id == anomaly_id).first()
    if not anomaly:
        raise HTTPException(status_code=404, detail="Anomaly not found")
    return anomaly


@app.get("/api/anomalies/{anomaly_id}/history")
def get_anomaly_history(anomaly_id: int, db: Session = Depends(get_db)):
    from database import AnomalyHistory
    histories = db.query(AnomalyHistory).filter(AnomalyHistory.anomaly_id == anomaly_id).order_by(AnomalyHistory.created_at.desc()).all()
    return histories


@app.patch("/api/anomalies/{anomaly_id}/status", response_model=schemas.AnomalyRecord)
def update_anomaly_status(
    anomaly_id: int,
    request: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    try:
        anomaly = services.update_anomaly_status(
            db, anomaly_id, request.status, request.handler, request.remark
        )
        if not anomaly:
            raise HTTPException(status_code=404, detail="Anomaly not found")
        return anomaly
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/anomalies/{anomaly_id}/correct", response_model=schemas.AnomalyRecord)
def correct_anomaly(
    anomaly_id: int,
    request: schemas.CorrectRequest,
    db: Session = Depends(get_db)
):
    try:
        anomaly = services.correct_anomaly(
            db, anomaly_id, request.conclusion, request.is_anomaly, request.handler, request.remark
        )
        if not anomaly:
            raise HTTPException(status_code=404, detail="Anomaly not found")
        return anomaly
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.post("/api/anomalies/{anomaly_id}/close", response_model=schemas.AnomalyRecord)
def close_anomaly(
    anomaly_id: int,
    request: schemas.CloseRequest,
    db: Session = Depends(get_db)
):
    try:
        anomaly = services.close_anomaly(db, anomaly_id, request.reason, request.handler)
        if not anomaly:
            raise HTTPException(status_code=404, detail="Anomaly not found")
        return anomaly
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))


@app.get("/api/anomalies/export")
def export_anomalies(
    format: str = "csv",
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if format != "csv":
        raise HTTPException(status_code=400, detail="Only CSV format is supported")

    csv_content = services.export_anomalies_to_csv(db, status)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"anomalies_{timestamp}.csv"

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/health")
def health_check():
    return {"status": "ok"}
