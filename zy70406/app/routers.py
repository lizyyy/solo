from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
import json
from app.database import get_db
from app import schemas, models
from app.services import FieldTrimmer, ConflictDetector, ReportGenerator, ExportService, TraceabilityService
from app.config import settings

router = APIRouter()


@router.post("/fragments/", response_model=List[schemas.EvaluationFragment])
def create_fragments(fragments: List[schemas.EvaluationFragmentCreate], db: Session = Depends(get_db)):
    db_fragments = []
    for fragment in fragments:
        db_fragment = models.EvaluationFragment(**fragment.model_dump())
        db.add(db_fragment)
        db_fragments.append(db_fragment)
    db.commit()
    for fragment in db_fragments:
        db.refresh(fragment)
    return db_fragments


@router.get("/fragments/", response_model=List[schemas.EvaluationFragment])
def get_fragments(batch_number: Optional[str] = None, has_error: Optional[bool] = None, db: Session = Depends(get_db)):
    query = db.query(models.EvaluationFragment)
    if batch_number:
        query = query.filter(models.EvaluationFragment.batch_number == batch_number)
    if has_error is not None:
        query = query.filter(models.EvaluationFragment.has_error == has_error)
    return query.order_by(models.EvaluationFragment.submitted_at.desc()).all()


@router.get("/fragments/{fragment_id}", response_model=schemas.EvaluationFragment)
def get_fragment(fragment_id: int, db: Session = Depends(get_db)):
    fragment = db.query(models.EvaluationFragment).filter(models.EvaluationFragment.id == fragment_id).first()
    if not fragment:
        raise HTTPException(status_code=404, detail="评测片段不存在")
    return fragment


@router.post("/trim-fields/")
def trim_fields(request: schemas.TrimRequest, db: Session = Depends(get_db)):
    trimmer = FieldTrimmer(db)
    results = trimmer.trim_multiple_fields(
        fragment_ids=request.fragment_ids,
        fields_to_trim=request.fields_to_trim,
        trim_reason=request.trim_reason,
        handler=request.handler
    )
    return {"results": results}


@router.post("/detect-conflicts/")
def detect_conflicts(db: Session = Depends(get_db)):
    detector = ConflictDetector(db)
    conflicts = detector.detect_batch_number_conflicts()
    return {
        "new_conflicts_detected": len([c for c in conflicts if not c["already_recorded"]]),
        "conflicts": conflicts
    }


@router.get("/conflicts/", response_model=List[schemas.BatchConflict])
def get_conflicts(include_resolved: bool = False, db: Session = Depends(get_db)):
    detector = ConflictDetector(db)
    return detector.get_all_conflicts(include_resolved=include_resolved)


@router.post("/resolve-conflict/")
def resolve_conflict(resolution: schemas.ConflictResolution, db: Session = Depends(get_db)):
    detector = ConflictDetector(db)
    success = detector.resolve_conflict(
        conflict_id=resolution.conflict_id,
        resolved_by=resolution.resolved_by,
        resolution_notes=resolution.resolution_notes
    )
    if not success:
        raise HTTPException(status_code=404, detail="冲突记录不存在")
    return {"message": "冲突已标记为已解决"}


@router.post("/reports/error/", response_model=schemas.Report)
def generate_error_report(batch_number: Optional[str] = None, generated_by: str = "系统", db: Session = Depends(get_db)):
    generator = ReportGenerator(db)
    report = generator.generate_error_report(batch_number=batch_number, generated_by=generated_by)
    return report


@router.get("/reports/", response_model=List[schemas.Report])
def get_reports(db: Session = Depends(get_db)):
    return db.query(models.Report).order_by(models.Report.generated_at.desc()).all()


@router.post("/export/error-samples/")
def export_error_samples(conflict_id: Optional[int] = None, db: Session = Depends(get_db)):
    export_service = ExportService(db)
    try:
        file_path = export_service.export_error_samples_for_review(conflict_id=conflict_id)
        return {
            "message": "导出成功",
            "file_path": file_path,
            "download_url": f"/download/{file_path.split('/')[-1]}"
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/traceability/by-handler/{handler}")
def get_traceability_by_handler(handler: str, db: Session = Depends(get_db)):
    trace_service = TraceabilityService(db)
    results = trace_service.get_original_input_by_handler(handler)
    return {
        "handler": handler,
        "total_records": len(results),
        "records": results
    }


@router.post("/load-sample-data/")
def load_sample_data(db: Session = Depends(get_db)):
    sample_file = settings.SAMPLES_DIR / "multi_source_evaluation_samples.json"
    if not sample_file.exists():
        raise HTTPException(status_code=404, detail="样例数据文件不存在")
    
    with open(sample_file, 'r', encoding='utf-8') as f:
        samples = json.load(f)
    
    created_count = 0
    for sample in samples:
        existing = db.query(models.EvaluationFragment).filter(
            models.EvaluationFragment.batch_number == sample["batch_number"],
            models.EvaluationFragment.source_system == sample["source_system"],
            models.EvaluationFragment.model_name == sample["model_name"]
        ).first()
        if not existing:
            db_fragment = models.EvaluationFragment(**sample)
            db.add(db_fragment)
            created_count += 1
    
    db.commit()
    return {
        "message": f"成功加载 {created_count} 条样例数据",
        "total_samples": len(samples),
        "created_count": created_count
    }
