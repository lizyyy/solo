from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from . import models, schemas, crud
from .database import SessionLocal, engine

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="模型评测结果 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/api/model-versions/", response_model=schemas.ModelVersion)
def create_model_version(version: schemas.ModelVersionCreate, db: Session = Depends(get_db)):
    db_version = crud.get_model_version_by_name(db, version_name=version.version_name)
    if db_version:
        raise HTTPException(status_code=400, detail="版本已存在")
    return crud.create_model_version(db=db, version=version)

@app.get("/api/model-versions/", response_model=List[schemas.ModelVersion])
def read_model_versions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    versions = crud.get_model_versions(db, skip=skip, limit=limit)
    return versions

@app.get("/api/model-versions/{version_id}", response_model=schemas.ModelVersion)
def read_model_version(version_id: int, db: Session = Depends(get_db)):
    db_version = crud.get_model_version(db, version_id=version_id)
    if db_version is None:
        raise HTTPException(status_code=404, detail="版本不存在")
    return db_version

@app.post("/api/evaluations/", response_model=schemas.Evaluation)
def create_evaluation(evaluation: schemas.EvaluationCreate, db: Session = Depends(get_db)):
    return crud.create_evaluation(db=db, evaluation=evaluation)

@app.get("/api/evaluations/", response_model=List[schemas.Evaluation])
def read_evaluations(
    model_version_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    evaluations = crud.get_evaluations(db, model_version_id=model_version_id, status=status, skip=skip, limit=limit)
    return evaluations

@app.get("/api/evaluations/{evaluation_id}", response_model=schemas.Evaluation)
def read_evaluation(evaluation_id: int, db: Session = Depends(get_db)):
    db_eval = crud.get_evaluation(db, evaluation_id=evaluation_id)
    if db_eval is None:
        raise HTTPException(status_code=404, detail="评测不存在")
    return db_eval

@app.patch("/api/evaluations/{evaluation_id}/status", response_model=schemas.Evaluation)
def update_evaluation_status(evaluation_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    db_eval = crud.update_evaluation_status(db, evaluation_id=evaluation_id, status=status_update.status)
    if db_eval is None:
        raise HTTPException(status_code=404, detail="评测不存在")
    return db_eval

@app.post("/api/evaluation-import/", response_model=schemas.Evaluation)
def import_evaluation(import_data: schemas.EvaluationImport, db: Session = Depends(get_db)):
    return crud.import_evaluation_from_excel(db, import_data=import_data)

@app.get("/api/metrics/", response_model=List[schemas.Metric])
def read_metrics(evaluation_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    metrics = crud.get_metrics(db, evaluation_id=evaluation_id, skip=skip, limit=limit)
    return metrics

@app.post("/api/metrics/compare/", response_model=List[schemas.MetricComparison])
def compare_metrics(comparison: schemas.MetricComparisonRequest, db: Session = Depends(get_db)):
    return crud.compare_metrics(db, comparison=comparison)

@app.get("/api/failure-samples/", response_model=List[schemas.FailureSample])
def read_failure_samples(
    evaluation_id: Optional[int] = None,
    is_resolved: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    samples = crud.get_failure_samples(db, evaluation_id=evaluation_id, is_resolved=is_resolved, skip=skip, limit=limit)
    return samples

@app.patch("/api/failure-samples/{sample_id}", response_model=schemas.FailureSample)
def update_failure_sample(sample_id: int, sample_update: schemas.FailureSampleUpdate, db: Session = Depends(get_db)):
    db_sample = crud.update_failure_sample(db, sample_id=sample_id, sample_update=sample_update)
    if db_sample is None:
        raise HTTPException(status_code=404, detail="失败样本不存在")
    return db_sample

@app.post("/api/notes/", response_model=schemas.Note)
def create_note(note: schemas.NoteCreate, db: Session = Depends(get_db)):
    return crud.create_note(db=db, note=note)

@app.get("/api/notes/", response_model=List[schemas.Note])
def read_notes(evaluation_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    notes = crud.get_notes(db, evaluation_id=evaluation_id, skip=skip, limit=limit)
    return notes

@app.post("/api/release-suggestions/", response_model=schemas.ReleaseSuggestion)
def create_release_suggestion(suggestion: schemas.ReleaseSuggestionCreate, db: Session = Depends(get_db)):
    return crud.create_release_suggestion(db=db, suggestion=suggestion)


@app.patch("/api/release-suggestions/{suggestion_id}/approve", response_model=schemas.ReleaseSuggestion)
def approve_release_suggestion(suggestion_id: int, approve_data: schemas.ReleaseSuggestionApprove, db: Session = Depends(get_db)):
    db_suggestion = crud.approve_release_suggestion(db, suggestion_id=suggestion_id, approved_by=approve_data.approved_by)
    if db_suggestion is None:
        raise HTTPException(status_code=404, detail="发布建议不存在")
    return db_suggestion


@app.get("/api/release-suggestions/", response_model=List[schemas.ReleaseSuggestion])
def read_release_suggestions(
    model_version_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    suggestions = crud.get_release_suggestions(db, model_version_id=model_version_id, skip=skip, limit=limit)
    return suggestions

@app.get("/api/anomalies/", response_model=List[schemas.Evaluation])
def get_anomalies(db: Session = Depends(get_db)):
    return crud.get_anomalous_evaluations(db)

@app.get("/api/evaluations/{evaluation_id}/export")
def export_evaluation(evaluation_id: int, format: str = Query("json", enum=["json", "csv"]), db: Session = Depends(get_db)):
    return crud.export_evaluation(db, evaluation_id=evaluation_id, format=format)

@app.get("/api/metrics/history")
def get_metrics_history(metric_name: str, db: Session = Depends(get_db)):
    return crud.get_metric_history(db, metric_name=metric_name)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
