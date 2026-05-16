from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import pandas as pd
import json

from app.database import get_db
from app import crud, schemas
from app.models import ExceptionStatus, HandlingResult
from app.config import EXPORT_DIR

router = APIRouter(prefix="/api/v1", tags=["exceptions"])


@router.post("/exceptions", response_model=schemas.DataQualityExceptionResponse)
def create_exception(
    exception: schemas.DataQualityExceptionCreate,
    db: Session = Depends(get_db)
):
    try:
        db_exception = crud.create_exception(db, exception)
        return db_exception
    except Exception as e:
        crud.create_handling_log(db, schemas.ExceptionHandlingLogCreate(
            exception_id=0,
            action="create_exception_failed",
            original_input=exception.model_dump(),
            handling_basis="Failed to create exception",
            final_conclusion=str(e),
            result=HandlingResult.FAILED,
            error_message=str(e),
            handled_by="system"
        ))
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/exceptions/{exception_id}", response_model=schemas.DataQualityExceptionResponse)
def get_exception(exception_id: int, db: Session = Depends(get_db)):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")
    return exception


@router.get("/exceptions", response_model=schemas.PaginatedResponse)
def list_exceptions(
    rule_name: Optional[str] = None,
    field_path: Optional[str] = None,
    status: Optional[ExceptionStatus] = None,
    created_by: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    params = schemas.ExceptionQueryParams(
        rule_name=rule_name,
        field_path=field_path,
        status=status,
        created_by=created_by,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )
    total, exceptions = crud.get_exceptions(db, params)
    return {"total": total, "page": page, "page_size": page_size, "items": exceptions}


@router.post("/exceptions/{exception_id}/status", response_model=schemas.DataQualityExceptionResponse)
def transition_status(
    exception_id: int,
    request: schemas.StatusTransitionRequest,
    db: Session = Depends(get_db)
):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    updated = crud.update_exception_status(
        db, exception_id, request.target_status,
        request.reviewed_by, request.review_comment,
        request.idempotency_key
    )
    return updated


@router.post("/exceptions/match", response_model=schemas.ExceptionMatchResponse)
def match_exception(
    request: schemas.ExceptionMatchRequest,
    db: Session = Depends(get_db)
):
    exception = crud.match_exception(
        db, request.rule_name, request.field_path, request.record_data
    )

    if exception:
        return {
            "matched": True,
            "exception_id": exception.id,
            "exception_condition": exception.exception_condition
        }
    return {"matched": False, "exception_id": None, "exception_condition": None}


@router.post("/exceptions/{exception_id}/hit-records", response_model=schemas.ExceptionHitRecordResponse)
def create_hit_record(
    exception_id: int,
    hit_record: schemas.ExceptionHitRecordCreate,
    db: Session = Depends(get_db)
):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    return crud.create_hit_record(db, hit_record)


@router.get("/exceptions/{exception_id}/hit-records", response_model=schemas.PaginatedResponse)
def list_hit_records(
    exception_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    total, records = crud.get_hit_records(db, exception_id, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": records}


@router.post("/exceptions/{exception_id}/manual-correction")
def manual_correction(
    exception_id: int,
    request: schemas.ManualCorrectionRequest,
    db: Session = Depends(get_db)
):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    corrected = crud.correct_hit_records(
        db, exception_id, request.hit_record_ids,
        request.correction_note, request.corrected_by,
        request.idempotency_key
    )
    return {"corrected_count": len(corrected), "hit_record_ids": [r.id for r in corrected]}


@router.get("/exceptions/{exception_id}/statistics")
def get_exception_statistics(exception_id: int, db: Session = Depends(get_db)):
    stats = crud.get_exception_statistics(db, exception_id)
    if not stats:
        raise HTTPException(status_code=404, detail="Exception not found")
    return stats


@router.get("/exceptions/{exception_id}/handling-logs", response_model=schemas.PaginatedResponse)
def list_handling_logs(
    exception_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    exception = crud.get_exception(db, exception_id)
    if not exception:
        raise HTTPException(status_code=404, detail="Exception not found")

    total, logs = crud.get_handling_logs(db, exception_id, page, page_size)
    return {"total": total, "page": page, "page_size": page_size, "items": logs}


@router.post("/exceptions/check-expired")
def check_expired_exceptions(db: Session = Depends(get_db)):
    expired = crud.check_expired_exceptions(db)
    return {"expired_count": len(expired), "exception_ids": [e.id for e in expired]}


@router.post("/exceptions/export")
def export_exceptions(
    request: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    query_params = schemas.ExceptionQueryParams(
        start_date=request.start_date,
        end_date=request.end_date,
        page=1,
        page_size=10000
    )

    if request.exception_ids:
        exceptions = []
        for eid in request.exception_ids:
            exc = crud.get_exception(db, eid)
            if exc:
                exceptions.append(exc)
        total = len(exceptions)
    else:
        total, exceptions = crud.get_exceptions(db, query_params)

    exception_data = []
    for exc in exceptions:
        stats = crud.get_exception_statistics(db, exc.id) or {}
        exception_data.append({
            "例外ID": exc.id,
            "规则名称": exc.rule_name,
            "字段路径": exc.field_path,
            "例外条件": json.dumps(exc.exception_condition, ensure_ascii=False),
            "恢复日期": exc.recovery_date,
            "状态": exc.status.value,
            "描述": exc.description or "",
            "创建人": exc.created_by,
            "创建时间": exc.created_at,
            "总命中数": stats.get("total_hits", 0),
            "已恢复数": stats.get("recovered_count", 0),
            "待处理数": stats.get("pending_count", 0),
            "复核人": exc.reviewed_by or "",
            "复核时间": exc.reviewed_at or "",
            "复核备注": exc.review_comment or ""
        })

    df_exceptions = pd.DataFrame(exception_data)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")

    if request.format == "csv":
        filename = f"data_quality_exceptions_{timestamp}.csv"
        filepath = EXPORT_DIR / filename
        df_exceptions.to_csv(filepath, index=False, encoding='utf-8-sig')
    else:
        filename = f"data_quality_exceptions_{timestamp}.xlsx"
        filepath = EXPORT_DIR / filename
        
        with pd.ExcelWriter(filepath, engine='openpyxl') as writer:
            df_exceptions.to_excel(writer, sheet_name='例外清单', index=False)

            if request.include_hit_records:
                hit_records_data = []
                for exc in exceptions:
                    _, records = crud.get_hit_records(db, exc.id, page=1, page_size=10000)
                    for rec in records:
                        hit_records_data.append({
                            "例外ID": exc.id,
                            "记录ID": rec.id,
                            "记录关键字": rec.record_key,
                            "命中时间": rec.hit_time,
                            "是否恢复": "是" if rec.is_recovered else "否",
                            "恢复时间": rec.recovered_at or ""
                        })
                if hit_records_data:
                    df_hits = pd.DataFrame(hit_records_data)
                    df_hits.to_excel(writer, sheet_name='命中记录', index=False)

            if request.include_handling_logs:
                logs_data = []
                for exc in exceptions:
                    _, logs = crud.get_handling_logs(db, exc.id, page=1, page_size=10000)
                    for log in logs:
                        logs_data.append({
                            "例外ID": exc.id,
                            "日志ID": log.id,
                            "操作类型": log.action,
                            "原始输入": json.dumps(log.original_input, ensure_ascii=False) if log.original_input else "",
                            "处理依据": log.handling_basis or "",
                            "最终结论": log.final_conclusion or "",
                            "处理结果": log.result.value,
                            "错误信息": log.error_message or "",
                            "处理人": log.handled_by,
                            "处理时间": log.created_at
                        })
                if logs_data:
                    df_logs = pd.DataFrame(logs_data)
                    df_logs.to_excel(writer, sheet_name='处理日志', index=False)

    report = crud.create_quality_report(db, schemas.QualityReportCreate(
        exception_id=exceptions[0].id if exceptions else 0,
        report_type="export",
        summary={
            "total_exceptions": total,
            "export_format": request.format,
            "include_hit_records": request.include_hit_records,
            "include_handling_logs": request.include_handling_logs
        },
        generated_by="api_export"
    ), file_path=str(filepath))

    return {
        "file_name": filename,
        "file_path": str(filepath),
        "report_id": report.id,
        "total_exceptions": total
    }


@router.get("/quality-reports", response_model=List[schemas.QualityReportResponse])
def list_quality_reports(exception_id: Optional[int] = None, db: Session = Depends(get_db)):
    return crud.get_quality_reports(db, exception_id)


@router.get("/quality-reports/{report_id}", response_model=schemas.QualityReportResponse)
def get_quality_report(report_id: int, db: Session = Depends(get_db)):
    reports = crud.get_quality_reports(db)
    for report in reports:
        if report.id == report_id:
            return report
    raise HTTPException(status_code=404, detail="Report not found")
