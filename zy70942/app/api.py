from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
from datetime import datetime

from app.database import get_db
from app.services.import_service import ImportService
from app.services.reconciliation_engine import ReconciliationEngine
from app.services.review_service import ReviewService, PenaltyTraceService
from app.services.report_service import ReportService
from app import schemas

router = APIRouter()


@router.post("/import/waybills", response_model=schemas.ImportResult)
async def import_waybills(
    file: UploadFile = File(...),
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    content = await file.read()
    content_str = content.decode('utf-8-sig')

    service = ImportService(db)
    result = service.import_waybills_from_csv(content_str, batch_id)

    return result


@router.post("/import/tracking", response_model=schemas.ImportResult)
async def import_tracking(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    content_str = content.decode('utf-8')

    service = ImportService(db)
    result = service.import_tracking_from_json(content_str)

    return result


@router.post("/import/rules", response_model=schemas.ImportResult)
async def import_rules(
    rules: List[schemas.PenaltyRuleCreate],
    db: Session = Depends(get_db)
):
    service = ImportService(db)
    rules_data = [r.dict() for r in rules]
    result = service.import_penalty_rules(rules_data)

    return result


@router.post("/reconciliation/batch", response_model=schemas.ReconciliationSummary)
async def batch_reconciliation(
    request: schemas.BatchReconciliationRequest,
    db: Session = Depends(get_db)
):
    engine = ReconciliationEngine(db)
    result = engine.reconcile_batch(
        batch_id=request.batch_id,
        batch_name=request.batch_name,
        period=request.period,
        generated_by=request.generated_by
    )

    return result['summary']


@router.get("/reconciliation/{waybill_no}", response_model=schemas.ReconciliationResultDetail)
def get_reconciliation_result(
    waybill_no: str,
    db: Session = Depends(get_db)
):
    from app.models import ReconciliationResult

    result = db.query(ReconciliationResult).filter(
        ReconciliationResult.waybill_no == waybill_no
    ).first()

    if not result:
        raise HTTPException(status_code=404, detail="对账结果不存在")

    return result


@router.get("/reconciliation/batch/{batch_id}/list")
def list_reconciliation_results(
    batch_id: str,
    status: Optional[str] = None,
    review_status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from app.models import ReconciliationResult

    query = db.query(ReconciliationResult).filter(
        ReconciliationResult.batch_id == batch_id
    )

    if status:
        query = query.filter(ReconciliationResult.status == status)
    if review_status:
        query = query.filter(ReconciliationResult.review_status == review_status)

    results = query.offset(skip).limit(limit).all()
    total = query.count()

    return {
        'total': total,
        'items': results
    }


@router.get("/reconciliation/batch/{batch_id}/summary", response_model=schemas.ReconciliationSummary)
def get_batch_summary(
    batch_id: str,
    db: Session = Depends(get_db)
):
    from app.models import ReconciliationResult, ReconciliationBatch

    batch = db.query(ReconciliationBatch).filter(
        ReconciliationBatch.batch_id == batch_id
    ).first()

    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    if batch.summary:
        return batch.summary

    results = db.query(ReconciliationResult).filter(
        ReconciliationResult.batch_id == batch_id
    ).all()

    delayed_count = sum(1 for r in results if r.is_delayed)
    damaged_count = sum(1 for r in results if r.is_damaged)
    transfer_issue_count = sum(1 for r in results if r.is_transfer_issue)
    exempt_count = sum(1 for r in results if r.is_exempt or r.weather_exempt)

    total_delay_penalty = sum(r.delay_penalty for r in results)
    total_damage_penalty = sum(r.damage_penalty for r in results)
    total_transfer_penalty = sum(r.transfer_penalty for r in results)
    total_penalty = sum(r.total_penalty for r in results)

    penalty_distribution = {
        '0-100': sum(1 for r in results if 0 < r.total_penalty <= 100),
        '100-500': sum(1 for r in results if 100 < r.total_penalty <= 500),
        '500-1000': sum(1 for r in results if 500 < r.total_penalty <= 1000),
        '1000+': sum(1 for r in results if r.total_penalty > 1000)
    }

    return {
        'batch_id': batch_id,
        'total_waybills': len(results),
        'processed_count': len(results),
        'pending_count': sum(1 for r in results if r.review_status == 'pending'),
        'exempt_count': exempt_count,
        'delayed_count': delayed_count,
        'damaged_count': damaged_count,
        'transfer_issue_count': transfer_issue_count,
        'total_penalty': round(total_penalty, 2),
        'delay_penalty_total': round(total_delay_penalty, 2),
        'damage_penalty_total': round(total_damage_penalty, 2),
        'transfer_penalty_total': round(total_transfer_penalty, 2),
        'average_penalty': round(total_penalty / len(results), 2) if results else 0,
        'penalty_distribution': penalty_distribution
    }


@router.post("/review/waybill")
def review_waybill(
    request: schemas.ReviewActionRequest,
    db: Session = Depends(get_db)
):
    service = ReviewService(db)
    try:
        result = service.review_waybill(
            waybill_no=request.waybill_no,
            reviewer=request.reviewer,
            action=request.action,
            status=request.status,
            total_penalty=request.total_penalty,
            delay_penalty=request.delay_penalty,
            damage_penalty=request.damage_penalty,
            transfer_penalty=request.transfer_penalty,
            is_exempt=request.is_exempt,
            exempt_reason=request.exempt_reason,
            is_delayed=request.is_delayed,
            is_damaged=request.is_damaged,
            is_transfer_issue=request.is_transfer_issue,
            comment=request.comment,
            evidence=request.evidence
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/review/batch")
def batch_review(
    waybill_nos: List[str],
    reviewer: str,
    action: str,
    comment: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = ReviewService(db)
    result = service.batch_review(waybill_nos, reviewer, action, comment)
    return result


@router.get("/review/{waybill_no}/history")
def get_review_history(
    waybill_no: str,
    db: Session = Depends(get_db)
):
    service = ReviewService(db)
    history = service.get_review_history(waybill_no)
    return history


@router.post("/reconciliation/{waybill_no}/recalculate")
def recalculate_penalty(
    waybill_no: str,
    recalculator: str,
    reason: str,
    db: Session = Depends(get_db)
):
    service = ReviewService(db)
    try:
        result = service.recalculate_penalty(waybill_no, recalculator, reason)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/trace/{waybill_no}")
def trace_penalty(
    waybill_no: str,
    penalty_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = PenaltyTraceService(db)
    result = service.trace_penalty(waybill_no, penalty_type)

    if not result:
        raise HTTPException(status_code=404, detail="未找到扣罚记录")

    return result


@router.get("/trace/statistics")
def get_penalty_statistics(
    rule_code: Optional[str] = None,
    penalty_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    service = PenaltyTraceService(db)
    result = service.get_penalty_statistics(rule_code, penalty_type)
    return result


@router.get("/reports/detailed/{batch_id}")
def download_detailed_report(
    batch_id: str,
    format: str = Query('xlsx', enum=['xlsx', 'csv', 'json']),
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    try:
        content = service.generate_detailed_report(batch_id, format)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    media_types = {
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'csv': 'text/csv',
        'json': 'application/json'
    }

    return StreamingResponse(
        BytesIO(content),
        media_type=media_types[format],
        headers={
            'Content-Disposition': f'attachment; filename="reconciliation_detailed_{batch_id}.{format}"'
        }
    )


@router.get("/reports/summary/{batch_id}")
def download_summary_report(
    batch_id: str,
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    try:
        content = service.generate_summary_report(batch_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        BytesIO(content),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="reconciliation_summary_{batch_id}.xlsx"'
        }
    )


@router.get("/reports/discrepancy/{waybill_no}")
def download_discrepancy_report(
    waybill_no: str,
    db: Session = Depends(get_db)
):
    service = ReportService(db)
    try:
        content = service.generate_discrepancy_report(waybill_no)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return StreamingResponse(
        BytesIO(content),
        media_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        headers={
            'Content-Disposition': f'attachment; filename="discrepancy_{waybill_no}.xlsx"'
        }
    )


@router.post("/weather-exemptions", response_model=schemas.WeatherExemption)
def create_weather_exemption(
    exemption: schemas.WeatherExemptionCreate,
    db: Session = Depends(get_db)
):
    from app.models import WeatherExemption

    db_exemption = WeatherExemption(
        city=exemption.city,
        start_time=exemption.start_time,
        end_time=exemption.end_time,
        weather_type=exemption.weather_type,
        severity=exemption.severity,
        description=exemption.description,
        affected_routes=exemption.affected_routes
    )
    db.add(db_exemption)
    db.commit()
    db.refresh(db_exemption)

    return db_exemption


@router.get("/batches", response_model=List[schemas.ReconciliationBatchDetail])
def list_batches(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    from app.models import ReconciliationBatch

    batches = db.query(ReconciliationBatch).order_by(
        ReconciliationBatch.generated_at.desc()
    ).offset(skip).limit(limit).all()

    return batches


@router.get("/waybills/{waybill_no}", response_model=schemas.Waybill)
def get_waybill(
    waybill_no: str,
    db: Session = Depends(get_db)
):
    from app.models import Waybill

    waybill = db.query(Waybill).filter(Waybill.waybill_no == waybill_no).first()

    if not waybill:
        raise HTTPException(status_code=404, detail="运单不存在")

    return waybill


@router.get("/waybills/{waybill_no}/tracking", response_model=List[schemas.TrackingRecord])
def get_waybill_tracking(
    waybill_no: str,
    db: Session = Depends(get_db)
):
    from app.models import TrackingRecord

    records = db.query(TrackingRecord).filter(
        TrackingRecord.waybill_no == waybill_no
    ).order_by(TrackingRecord.timestamp).all()

    return records
