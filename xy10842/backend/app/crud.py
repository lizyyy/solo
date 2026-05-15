from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from typing import List, Optional
from datetime import datetime
import json
import csv
from io import StringIO

from . import models, schemas

def get_model_version(db: Session, version_id: int):
    return db.query(models.ModelVersion).filter(models.ModelVersion.id == version_id).first()

def get_model_version_by_name(db: Session, version_name: str):
    return db.query(models.ModelVersion).filter(models.ModelVersion.version_name == version_name).first()

def get_model_versions(db: Session, skip: int = 0, limit: int = 100):
    return db.query(models.ModelVersion).order_by(desc(models.ModelVersion.created_at)).offset(skip).limit(limit).all()

def create_model_version(db: Session, version: schemas.ModelVersionCreate):
    db_version = models.ModelVersion(**version.model_dump())
    db.add(db_version)
    db.commit()
    db.refresh(db_version)
    return db_version

def create_evaluation(db: Session, evaluation: schemas.EvaluationCreate):
    db_evaluation = models.Evaluation(**evaluation.model_dump())
    db.add(db_evaluation)
    db.commit()
    db.refresh(db_evaluation)
    return db_evaluation

def get_evaluation(db: Session, evaluation_id: int):
    return db.query(models.Evaluation).filter(models.Evaluation.id == evaluation_id).first()

def get_evaluations(db: Session, model_version_id: Optional[int] = None, status: Optional[str] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Evaluation)
    if model_version_id:
        query = query.filter(models.Evaluation.model_version_id == model_version_id)
    if status:
        query = query.filter(models.Evaluation.status == status)
    return query.order_by(desc(models.Evaluation.started_at)).offset(skip).limit(limit).all()

def update_evaluation_status(db: Session, evaluation_id: int, status: str):
    db_evaluation = get_evaluation(db, evaluation_id)
    if db_evaluation:
        db_evaluation.status = status
        if status == "completed":
            db_evaluation.completed_at = datetime.now()
        db.commit()
        db.refresh(db_evaluation)
    return db_evaluation

def import_evaluation_from_excel(db: Session, import_data: schemas.EvaluationImport):
    db_version = get_model_version_by_name(db, import_data.model_version_name)
    if not db_version:
        version_create = schemas.ModelVersionCreate(
            version_name=import_data.model_version_name,
            model_name=import_data.model_name,
            description=f"导入自 {import_data.dataset_name} 评测"
        )
        db_version = create_model_version(db, version_create)
    
    evaluation_create = schemas.EvaluationCreate(
        model_version_id=db_version.id,
        dataset_name=import_data.dataset_name,
        dataset_version=import_data.dataset_version,
        status="completed",
        total_samples=len(import_data.failure_samples) + 100,
        passed_samples=100,
        failed_samples=len(import_data.failure_samples)
    )
    db_evaluation = create_evaluation(db, evaluation_create)
    
    for metric in import_data.metrics:
        metric.evaluation_id = db_evaluation.id
        db_metric = models.Metric(**metric.model_dump())
        db.add(db_metric)
    
    for sample in import_data.failure_samples:
        sample.evaluation_id = db_evaluation.id
        db_sample = models.FailureSample(**sample.model_dump())
        db.add(db_sample)
    
    db.commit()
    db.refresh(db_evaluation)
    return db_evaluation

def get_metrics(db: Session, evaluation_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Metric)
    if evaluation_id:
        query = query.filter(models.Metric.evaluation_id == evaluation_id)
    return query.order_by(models.Metric.metric_name).offset(skip).limit(limit).all()

def compare_metrics(db: Session, comparison: schemas.MetricComparisonRequest):
    metrics_dict = {}
    for eval_id in comparison.evaluation_ids:
        eval_metrics = get_metrics(db, evaluation_id=eval_id)
        for metric in eval_metrics:
            if metric.metric_name not in metrics_dict:
                metrics_dict[metric.metric_name] = []
            metrics_dict[metric.metric_name].append({
                "evaluation_id": eval_id,
                "value": metric.metric_value,
                "unit": metric.metric_unit
            })
    
    result = []
    for metric_name, values in metrics_dict.items():
        result.append(schemas.MetricComparison(
            metric_name=metric_name,
            values=values
        ))
    return result

def get_failure_samples(db: Session, evaluation_id: Optional[int] = None, is_resolved: Optional[bool] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.FailureSample)
    if evaluation_id:
        query = query.filter(models.FailureSample.evaluation_id == evaluation_id)
    if is_resolved is not None:
        query = query.filter(models.FailureSample.is_resolved == is_resolved)
    return query.order_by(desc(models.FailureSample.created_at)).offset(skip).limit(limit).all()

def update_failure_sample(db: Session, sample_id: int, sample_update: schemas.FailureSampleUpdate):
    db_sample = db.query(models.FailureSample).filter(models.FailureSample.id == sample_id).first()
    if db_sample:
        update_data = sample_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(db_sample, key, value)
        if sample_update.is_resolved and not db_sample.resolved_at:
            db_sample.resolved_at = datetime.now()
        db.commit()
        db.refresh(db_sample)
    return db_sample

def create_note(db: Session, note: schemas.NoteCreate):
    db_note = models.Note(**note.model_dump())
    db.add(db_note)
    db.commit()
    db.refresh(db_note)
    return db_note

def get_notes(db: Session, evaluation_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.Note)
    if evaluation_id:
        query = query.filter(models.Note.evaluation_id == evaluation_id)
    return query.order_by(desc(models.Note.created_at)).offset(skip).limit(limit).all()

def create_release_suggestion(db: Session, suggestion: schemas.ReleaseSuggestionCreate):
    db_suggestion = models.ReleaseSuggestion(**suggestion.model_dump())
    db.add(db_suggestion)
    db.commit()
    db.refresh(db_suggestion)
    return db_suggestion

def get_release_suggestions(db: Session, model_version_id: Optional[int] = None, skip: int = 0, limit: int = 100):
    query = db.query(models.ReleaseSuggestion)
    if model_version_id:
        query = query.filter(models.ReleaseSuggestion.model_version_id == model_version_id)
    return query.order_by(desc(models.ReleaseSuggestion.created_at)).offset(skip).limit(limit).all()

def get_anomalous_evaluations(db: Session):
    return db.query(models.Evaluation).filter(
        models.Evaluation.status.in_(["failed", "error"])
    ).order_by(desc(models.Evaluation.started_at)).all()

def export_evaluation(db: Session, evaluation_id: int, format: str = "json"):
    db_evaluation = get_evaluation(db, evaluation_id)
    if not db_evaluation:
        return None
    
    metrics = get_metrics(db, evaluation_id=evaluation_id)
    failure_samples = get_failure_samples(db, evaluation_id=evaluation_id)
    notes = get_notes(db, evaluation_id=evaluation_id)
    
    data = {
        "evaluation": {
            "id": db_evaluation.id,
            "model_version": db_evaluation.model_version.version_name,
            "model_name": db_evaluation.model_version.model_name,
            "dataset_name": db_evaluation.dataset_name,
            "dataset_version": db_evaluation.dataset_version,
            "status": db_evaluation.status,
            "started_at": db_evaluation.started_at.isoformat(),
            "completed_at": db_evaluation.completed_at.isoformat() if db_evaluation.completed_at else None,
            "total_samples": db_evaluation.total_samples,
            "passed_samples": db_evaluation.passed_samples,
            "failed_samples": db_evaluation.failed_samples
        },
        "metrics": [{"name": m.metric_name, "value": m.metric_value, "unit": m.metric_unit} for m in metrics],
        "failure_samples": [{
            "sample_id": s.sample_id,
            "input": s.input_data,
            "expected": s.expected_output,
            "actual": s.actual_output,
            "error_type": s.error_type,
            "is_resolved": s.is_resolved
        } for s in failure_samples],
        "notes": [{"author": n.author, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes]
    }
    
    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow(["Metric Name", "Value", "Unit"])
        for m in metrics:
            writer.writerow([m.metric_name, m.metric_value, m.metric_unit or ""])
        return {"format": "csv", "data": output.getvalue()}
    
    return {"format": "json", "data": data}

def get_metric_history(db: Session, metric_name: str):
    metrics = db.query(models.Metric).filter(
        models.Metric.metric_name == metric_name
    ).order_by(models.Metric.created_at).all()
    
    history = []
    for metric in metrics:
        evaluation = get_evaluation(db, metric.evaluation_id)
        if evaluation:
            history.append({
                "version": evaluation.model_version.version_name,
                "value": metric.metric_value,
                "timestamp": metric.created_at.isoformat()
            })
    
    return history
