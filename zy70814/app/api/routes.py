from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import os

from app.core.database import get_db
from app.schemas import (
    ReviewRequest,
    BatchReviewRequest,
    DiscrepancyResolveRequest,
    Response,
)
from app.services.import_service import ImportService
from app.services.reconciliation_service import ReconciliationService
from app.services.review_service import ReviewService
from app.services.report_service import ReportService
from app.models import ReconciliationBatch, ReconciliationRecord

router = APIRouter(prefix="/api/v1", tags=["reconciliation"])


@router.post("/import/vessel-schedule", response_model=Response)
async def import_vessel_schedule(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        import_service = ImportService(db)
        content = await file.read()
        vessels, batch_id = import_service.import_vessel_schedule_csv(content, file.filename)
        return Response(
            code=200,
            message="船期导入成功",
            data={"batch_id": batch_id, "vessel_count": len(vessels)},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"船期导入失败: {str(e)}")


@router.post("/import/berth", response_model=Response)
async def import_berth(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        import_service = ImportService(db)
        content = await file.read()
        berths, batch_id = import_service.import_berth_json(content, file.filename)
        return Response(
            code=200,
            message="泊位数据导入成功",
            data={"batch_id": batch_id, "berth_count": len(berths)},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"泊位数据导入失败: {str(e)}")


@router.post("/import/tide", response_model=Response)
async def import_tide(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    try:
        import_service = ImportService(db)
        content = await file.read()
        tides, batch_id = import_service.import_tide_csv(content, file.filename)
        return Response(
            code=200,
            message="潮汐数据导入成功",
            data={"batch_id": batch_id, "tide_count": len(tides)},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"潮汐数据导入失败: {str(e)}")


@router.post("/reconciliation/run/{batch_id}", response_model=Response)
def run_reconciliation(
    batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        reconciliation_service = ReconciliationService(db)
        result = reconciliation_service.run_reconciliation(batch_id)
        return Response(
            code=200,
            message="对账计算完成",
            data=result,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"对账计算失败: {str(e)}")


@router.get("/reconciliation/batch/{batch_id}", response_model=Response)
def get_batch_details(
    batch_id: str,
    db: Session = Depends(get_db),
):
    batch = db.query(ReconciliationBatch).filter(ReconciliationBatch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    reconciliation_service = ReconciliationService(db)
    records = reconciliation_service.get_batch_records(batch_id)

    return Response(
        code=200,
        message="查询成功",
        data={
            "batch": {
                "batch_id": batch.batch_id,
                "name": batch.name,
                "status": batch.status,
                "total_records": batch.total_records,
                "passed_records": batch.passed_records,
                "failed_records": batch.failed_records,
                "warning_records": batch.warning_records,
                "created_at": batch.created_at,
            },
            "records": [
                {
                    "id": r.id,
                    "vessel_name": r.vessel_name,
                    "berth_number": r.berth_number,
                    "draft": r.draft,
                    "available_depth": r.available_depth,
                    "depth_margin": r.depth_margin,
                    "status": r.status,
                    "has_discrepancy": r.has_discrepancy,
                    "discrepancy_count": r.discrepancy_count,
                    "is_reviewed": r.is_reviewed,
                }
                for r in records
            ],
        },
    )


@router.get("/reconciliation/record/{record_id}", response_model=Response)
def get_record_details(
    record_id: int,
    db: Session = Depends(get_db),
):
    reconciliation_service = ReconciliationService(db)
    record = reconciliation_service.get_record_details(record_id)

    discrepancies = db.query(ReconciliationRecord.discrepancies).filter(ReconciliationRecord.id == record_id).first()

    review_service = ReviewService(db)
    history = review_service.get_review_history(record_id)

    return Response(
        code=200,
        message="查询成功",
        data={
            "record": {
                "id": record.id,
                "vessel_name": record.vessel_name,
                "vessel_imo": record.vessel_imo,
                "voyage_number": record.voyage_number,
                "berth_number": record.berth_number,
                "draft": record.draft,
                "available_depth": record.available_depth,
                "depth_margin": record.depth_margin,
                "arrival_time": record.arrival_time,
                "departure_time": record.departure_time,
                "status": record.status,
                "has_discrepancy": record.has_discrepancy,
                "discrepancy_count": record.discrepancy_count,
                "is_reviewed": record.is_reviewed,
                "reviewed_by": record.reviewed_by,
                "reviewed_at": record.reviewed_at,
                "review_notes": record.review_notes,
                "override_reason": record.override_reason,
            },
            "discrepancies": [
                {
                    "id": d.id,
                    "type": d.discrepancy_type,
                    "severity": d.severity,
                    "description": d.description,
                    "explanation": d.explanation,
                    "is_resolved": d.is_resolved,
                    "resolution_notes": d.resolution_notes,
                }
                for d in record.discrepancies
            ],
            "review_history": [
                {
                    "action": h.action,
                    "previous_status": h.previous_status,
                    "new_status": h.new_status,
                    "reviewer": h.reviewer,
                    "review_notes": h.review_notes,
                    "timestamp": h.created_at,
                }
                for h in history
            ],
        },
    )


@router.post("/review/record/{record_id}", response_model=Response)
def review_record(
    record_id: int,
    request: ReviewRequest,
    db: Session = Depends(get_db),
):
    try:
        review_service = ReviewService(db)
        record = review_service.review_record(
            record_id=record_id,
            decision=request.decision,
            notes=request.notes,
            reviewer=request.reviewer,
            override_reason=request.override_reason,
        )
        return Response(
            code=200,
            message="复核完成",
            data={"record_id": record.id, "status": record.status},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"复核失败: {str(e)}")


@router.post("/review/batch", response_model=Response)
def batch_review(
    request: BatchReviewRequest,
    db: Session = Depends(get_db),
):
    try:
        review_service = ReviewService(db)
        result = review_service.batch_review(
            record_ids=request.record_ids,
            decision=request.decision,
            notes=request.notes,
            reviewer=request.reviewer,
        )
        return Response(
            code=200,
            message="批量复核完成",
            data=result,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"批量复核失败: {str(e)}")


@router.post("/discrepancy/{discrepancy_id}/resolve", response_model=Response)
def resolve_discrepancy(
    discrepancy_id: int,
    request: DiscrepancyResolveRequest,
    db: Session = Depends(get_db),
):
    try:
        review_service = ReviewService(db)
        discrepancy = review_service.resolve_discrepancy(
            discrepancy_id=discrepancy_id,
            resolution_notes=request.resolution_notes,
            resolved_by=request.resolved_by,
        )
        return Response(
            code=200,
            message="差异已标记为已解决",
            data={"discrepancy_id": discrepancy.id},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"解决差异失败: {str(e)}")


@router.get("/report/summary/{batch_id}", response_model=Response)
def get_summary_report(
    batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        report_service = ReportService(db)
        report = report_service.generate_summary_report(batch_id)
        return Response(
            code=200,
            message="生成汇总报告成功",
            data=report,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"生成汇总报告失败: {str(e)}")


@router.get("/report/detailed/{batch_id}", response_model=Response)
def get_detailed_report(
    batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        report_service = ReportService(db)
        report = report_service.generate_detailed_report(batch_id)
        return Response(
            code=200,
            message="生成详细报告成功",
            data=report,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"生成详细报告失败: {str(e)}")


@router.get("/report/export/csv/{batch_id}")
def export_csv(
    batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        report_service = ReportService(db)
        filepath = report_service.export_to_csv(batch_id)
        return FileResponse(
            path=filepath,
            filename=os.path.basename(filepath),
            media_type="text/csv",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导出CSV失败: {str(e)}")


@router.get("/report/export/excel/{batch_id}")
def export_excel(
    batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        report_service = ReportService(db)
        filepath = report_service.export_to_excel(batch_id)
        return FileResponse(
            path=filepath,
            filename=os.path.basename(filepath),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导出Excel失败: {str(e)}")


@router.get("/batches", response_model=Response)
def list_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    query = db.query(ReconciliationBatch)
    if status:
        query = query.filter(ReconciliationBatch.status == status)

    total = query.count()
    batches = query.order_by(ReconciliationBatch.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return Response(
        code=200,
        message="查询成功",
        data={
            "batches": [
                {
                    "id": b.id,
                    "batch_id": b.batch_id,
                    "name": b.name,
                    "status": b.status,
                    "total_records": b.total_records,
                    "passed_records": b.passed_records,
                    "failed_records": b.failed_records,
                    "warning_records": b.warning_records,
                    "created_at": b.created_at,
                    "checked_at": b.checked_at,
                }
                for b in batches
            ],
            "pagination": {
                "page": page,
                "page_size": page_size,
                "total": total,
                "total_pages": (total + page_size - 1) // page_size,
            },
        },
    )


@router.post("/batch/create", response_model=Response)
def create_batch(
    name: str,
    vessel_batch_id: str,
    berth_batch_id: str,
    tide_batch_id: str,
    db: Session = Depends(get_db),
):
    try:
        import_service = ImportService(db)
        batch = import_service.create_reconciliation_batch(
            name=name,
            vessel_batch_id=vessel_batch_id,
            berth_batch_id=berth_batch_id,
            tide_batch_id=tide_batch_id,
            vessel_file=f"vessel_{vessel_batch_id}.csv",
            berth_file=f"berth_{berth_batch_id}.json",
            tide_file=f"tide_{tide_batch_id}.csv",
        )
        return Response(
            code=200,
            message="批次创建成功",
            data={"batch_id": batch.batch_id, "name": batch.name},
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"批次创建失败: {str(e)}")
