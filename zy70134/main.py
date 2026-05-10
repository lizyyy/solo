from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import models
import schemas
import services
from database import engine, get_db

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="客服质检抽样派单服务", version="1.0.0")


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    return JSONResponse(
        status_code=400,
        content={"detail": str(exc)}
    )


@app.post("/api/batches", response_model=schemas.BatchResponse)
def create_batch(batch_data: schemas.BatchCreate, db: Session = Depends(get_db)):
    return services.create_batch(db, batch_data)


@app.get("/api/batches/{batch_id}", response_model=schemas.BatchResponse)
def get_batch(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(models.RecordingBatch).get(batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="Batch not found")
    return batch


@app.post("/api/rules", response_model=schemas.RuleResponse)
def create_rule(rule_data: schemas.RuleCreate, db: Session = Depends(get_db)):
    return services.create_rule(db, rule_data)


@app.get("/api/rules", response_model=List[schemas.RuleResponse])
def list_rules(db: Session = Depends(get_db)):
    return db.query(models.SamplingRule).all()


@app.post("/api/sampling/execute")
def execute_sampling(
    request: schemas.SamplingRequest,
    db: Session = Depends(get_db)
):
    recordings = services.get_batch_recording_ids(db, request.batch_id)
    if not recordings:
        raise ValueError("Batch recordings not found, please create batch first")
    task, assignments = services.execute_sampling(db, request, recordings)
    return {
        "task": {
            "id": task.id,
            "batch_id": task.batch_id,
            "rule_id": task.rule_id,
            "seed": task.sample_seed,
            "sampled_count": task.sampled_count,
            "status": task.status
        },
        "assignments": [
            {
                "id": a.id,
                "inspector_id": a.inspector_id,
                "status": a.status,
                "recording_id": a.sample_record.recording_id
            }
            for a in assignments
        ]
    }


@app.post("/api/inspections/submit", response_model=schemas.InspectionResponse)
def submit_inspection(
    request: schemas.InspectionRequest,
    db: Session = Depends(get_db)
):
    return services.submit_inspection(db, request)


@app.post("/api/reviews/appeal", response_model=schemas.ReviewResponse)
def appeal_review(
    request: schemas.ReviewCreate,
    db: Session = Depends(get_db)
):
    return services.create_review(db, request)


@app.post("/api/reviews/process")
def process_review(
    request: schemas.ReviewProcess,
    db: Session = Depends(get_db)
):
    review = services.process_review(db, request)
    return {
        "id": review.id,
        "status": review.status,
        "score_adjusted": review.score_adjusted,
        "adjusted_score": review.adjusted_score
    }


@app.post("/api/score-freeze", response_model=schemas.ScoreFreezeResponse)
def freeze_score(
    request: schemas.ScoreFreezeCreate,
    db: Session = Depends(get_db)
):
    return services.freeze_score(db, request)


@app.post("/api/score-freeze/{freeze_id}/unfreeze")
def unfreeze_score(
    freeze_id: int,
    operator_id: str,
    db: Session = Depends(get_db)
):
    freeze = services.unfreeze_score(db, freeze_id, operator_id)
    return {
        "id": freeze.id,
        "is_active": freeze.is_active
    }


@app.get("/api/reports/quality/{batch_id}", response_model=schemas.QualityReport)
def get_quality_report(batch_id: int, db: Session = Depends(get_db)):
    return services.get_quality_report(db, batch_id)


@app.get("/api/history/{entity_type}/{entity_id}", response_model=List[schemas.HistoryResponse])
def get_history(
    entity_type: str,
    entity_id: int,
    db: Session = Depends(get_db)
):
    return services.get_entity_history(db, entity_type, entity_id)


@app.get("/api/assignments")
def list_assignments(
    batch_id: int = None,
    inspector_id: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Assignment)
    if batch_id:
        query = query.filter(models.Assignment.batch_id == batch_id)
    if inspector_id:
        query = query.filter(models.Assignment.inspector_id == inspector_id)
    return query.all()


@app.get("/api/sampling-tasks")
def list_sampling_tasks(
    batch_id: int = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.SamplingTask)
    if batch_id:
        query = query.filter(models.SamplingTask.batch_id == batch_id)
    return query.all()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
