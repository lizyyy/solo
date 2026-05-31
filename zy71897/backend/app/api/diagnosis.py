from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import List, Optional
from datetime import datetime
import uuid

from ..database import get_db
from .. import models, schemas
from ..diagnosis.energy_model import energy_diagnosis_model
from ..diagnosis.threshold import threshold_manager

router = APIRouter(prefix="/api/diagnosis", tags=["能耗诊断"])


@router.post("/run", response_model=schemas.DiagnosisResult)
def run_diagnosis(
    request: schemas.DiagnosisCreate,
    db: Session = Depends(get_db)
):
    try:
        if not request.batch_id:
            batch_id = f"diag_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
        else:
            batch_id = request.batch_id

        report = energy_diagnosis_model.diagnose(
            db=db,
            compressor_id=request.compressor_id,
            start_time=request.start_time,
            end_time=request.end_time,
            diagnosis_type=request.diagnosis_type,
            batch_id=batch_id,
        )

        return schemas.DiagnosisResult(
            success=True,
            message=f"诊断完成，发现{report.abnormal_count}个异常",
            diagnosis_id=report.diagnosis_id,
            report_hash=report.report_hash,
            abnormal_count=report.abnormal_count,
            anomaly_score=report.anomaly_score,
        )

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"诊断失败: {str(e)}")


@router.post("/batch", response_model=List[schemas.DiagnosisResult])
def run_batch_diagnosis(
    requests: List[schemas.DiagnosisCreate],
    db: Session = Depends(get_db)
):
    batch_id = f"batch_{datetime.now().strftime('%Y%m%d')}_{uuid.uuid4().hex[:8]}"
    results = []

    for request in requests:
        try:
            request.batch_id = batch_id
            result = run_diagnosis(request, db)
            results.append(result)
        except HTTPException as e:
            results.append(schemas.DiagnosisResult(
                success=False,
                message=e.detail,
                diagnosis_id=0,
                report_hash="",
                abnormal_count=0,
                anomaly_score=0,
            ))

    return results


@router.get("/{diagnosis_id}")
def get_diagnosis(diagnosis_id: int, db: Session = Depends(get_db)):
    diagnosis = db.query(models.Diagnosis).filter(
        models.Diagnosis.id == diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    compressor = db.query(models.Compressor).filter(
        models.Compressor.id == diagnosis.compressor_id
    ).first()

    anomalies = db.query(models.Anomaly).filter(
        models.Anomaly.diagnosis_id == diagnosis_id
    ).order_by(models.Anomaly.severity.desc(), models.Anomaly.record_time).all()

    return {
        "id": diagnosis.id,
        "compressor_id": diagnosis.compressor_id,
        "equipment_no": compressor.equipment_no if compressor else "",
        "compressor_name": compressor.name if compressor else "",
        "diagnosis_time": diagnosis.diagnosis_time,
        "start_time": diagnosis.start_time,
        "end_time": diagnosis.end_time,
        "energy_consumption": diagnosis.energy_consumption,
        "energy_efficiency": diagnosis.energy_efficiency,
        "load_rate_avg": diagnosis.load_rate_avg,
        "anomaly_score": diagnosis.anomaly_score,
        "abnormal_count": diagnosis.abnormal_count,
        "status": diagnosis.status,
        "reviewed_by": diagnosis.reviewed_by,
        "reviewed_at": diagnosis.reviewed_at,
        "review_comment": diagnosis.review_comment,
        "is_manual_corrected": diagnosis.is_manual_corrected,
        "corrected_by": diagnosis.corrected_by,
        "corrected_at": diagnosis.corrected_at,
        "correction_note": diagnosis.correction_note,
        "report_hash": diagnosis.report_hash,
        "created_at": diagnosis.created_at,
        "anomalies": [
            {
                "id": a.id,
                "record_time": a.record_time,
                "parameter": a.parameter,
                "actual_value": a.actual_value,
                "threshold_level": a.threshold_level,
                "threshold_min": a.threshold_min,
                "threshold_max": a.threshold_max,
                "deviation": a.deviation,
                "severity": a.severity,
                "description": a.description,
                "recommendation": a.recommendation,
                "is_manual_override": a.is_manual_override,
                "override_note": a.override_note,
            }
            for a in anomalies
        ],
    }


@router.get("/list", response_model=List[schemas.DiagnosisSummary])
def list_diagnoses(
    compressor_id: Optional[int] = None,
    start_time: Optional[datetime] = None,
    end_time: Optional[datetime] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(
        models.Diagnosis,
        models.Compressor.equipment_no,
    ).join(
        models.Compressor,
        models.Diagnosis.compressor_id == models.Compressor.id,
    )

    if compressor_id:
        query = query.filter(models.Diagnosis.compressor_id == compressor_id)
    if start_time:
        query = query.filter(models.Diagnosis.diagnosis_time >= start_time)
    if end_time:
        query = query.filter(models.Diagnosis.diagnosis_time <= end_time)
    if status:
        query = query.filter(models.Diagnosis.status == status)

    results = query.order_by(
        models.Diagnosis.diagnosis_time.desc()
    ).offset(skip).limit(limit).all()

    return [
        schemas.DiagnosisSummary(
            id=d.id,
            compressor_id=d.compressor_id,
            equipment_no=eq,
            start_time=d.start_time,
            end_time=d.end_time,
            energy_consumption=d.energy_consumption,
            energy_efficiency=d.energy_efficiency,
            anomaly_score=d.anomaly_score,
            abnormal_count=d.abnormal_count,
            status=d.status,
            is_manual_corrected=d.is_manual_corrected,
            created_at=d.created_at,
        )
        for d, eq in results
    ]


@router.put("/{diagnosis_id}/review", response_model=schemas.Diagnosis)
def review_diagnosis(
    diagnosis_id: int,
    review: schemas.DiagnosisReview,
    db: Session = Depends(get_db)
):
    diagnosis = db.query(models.Diagnosis).filter(
        models.Diagnosis.id == diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    diagnosis.status = review.status
    diagnosis.review_comment = review.review_comment
    diagnosis.reviewed_by = review.reviewed_by or "system"
    diagnosis.reviewed_at = datetime.now()

    db.commit()
    db.refresh(diagnosis)

    return diagnosis


@router.put("/{diagnosis_id}/correct")
def correct_diagnosis(
    diagnosis_id: int,
    correction: schemas.DiagnosisCorrection,
    db: Session = Depends(get_db)
):
    diagnosis = db.query(models.Diagnosis).filter(
        models.Diagnosis.id == diagnosis_id
    ).first()

    if not diagnosis:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    diagnosis.is_manual_corrected = True
    diagnosis.correction_note = correction.correction_note
    diagnosis.corrected_by = correction.corrected_by or "system"
    diagnosis.corrected_at = datetime.now()

    if correction.anomaly_overrides:
        for anomaly_id, override in correction.anomaly_overrides.items():
            anomaly = db.query(models.Anomaly).filter(
                and_(
                    models.Anomaly.id == anomaly_id,
                    models.Anomaly.diagnosis_id == diagnosis_id,
                )
            ).first()

            if anomaly:
                anomaly.is_manual_override = override.is_manual_override
                anomaly.override_note = override.override_note

    active_anomalies = db.query(models.Anomaly).filter(
        and_(
            models.Anomaly.diagnosis_id == diagnosis_id,
            models.Anomaly.is_manual_override == False,
        )
    ).count()
    diagnosis.abnormal_count = active_anomalies

    db.commit()
    db.refresh(diagnosis)

    return {
        "success": True,
        "message": "修正已保存",
        "diagnosis_id": diagnosis.id,
        "is_manual_corrected": diagnosis.is_manual_corrected,
        "corrected_at": diagnosis.corrected_at,
        "active_anomaly_count": active_anomalies,
    }


@router.get("/thresholds")
def get_thresholds():
    return threshold_manager.get_all_thresholds_dict()


@router.get("/compare/{diagnosis_id1}/{diagnosis_id2}")
def compare_diagnoses(
    diagnosis_id1: int,
    diagnosis_id2: int,
    db: Session = Depends(get_db)
):
    d1 = db.query(models.Diagnosis).filter(models.Diagnosis.id == diagnosis_id1).first()
    d2 = db.query(models.Diagnosis).filter(models.Diagnosis.id == diagnosis_id2).first()

    if not d1 or not d2:
        raise HTTPException(status_code=404, detail="诊断记录不存在")

    a1 = db.query(models.Anomaly).filter(models.Anomaly.diagnosis_id == diagnosis_id1).all()
    a2 = db.query(models.Anomaly).filter(models.Anomaly.diagnosis_id == diagnosis_id2).all()

    return {
        "diagnosis1": {
            "id": d1.id,
            "time_range": f"{d1.start_time} ~ {d1.end_time}",
            "energy_efficiency": d1.energy_efficiency,
            "load_rate_avg": d1.load_rate_avg,
            "anomaly_score": d1.anomaly_score,
            "abnormal_count": d1.abnormal_count,
            "anomaly_count_by_severity": _count_by_severity(a1),
        },
        "diagnosis2": {
            "id": d2.id,
            "time_range": f"{d2.start_time} ~ {d2.end_time}",
            "energy_efficiency": d2.energy_efficiency,
            "load_rate_avg": d2.load_rate_avg,
            "anomaly_score": d2.anomaly_score,
            "abnormal_count": d2.abnormal_count,
            "anomaly_count_by_severity": _count_by_severity(a2),
        },
        "comparison": {
            "efficiency_diff": round((d2.energy_efficiency or 0) - (d1.energy_efficiency or 0), 2),
            "anomaly_score_diff": round((d2.anomaly_score or 0) - (d1.anomaly_score or 0), 2),
            "abnormal_count_diff": d2.abnormal_count - d1.abnormal_count,
        },
    }


def _count_by_severity(anomalies: List[models.Anomaly]) -> dict:
    counts = {"critical": 0, "warning": 0, "normal": 0}
    for a in anomalies:
        if not a.is_manual_override:
            counts[a.severity] = counts.get(a.severity, 0) + 1
    return counts
