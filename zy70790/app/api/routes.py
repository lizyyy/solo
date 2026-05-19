from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.policy_engine import PolicyEngine
from app.schemas.schemas import (
    ConfigImportRequest, ConfigImportResponse,
    ComparisonRequest, ComparisonResponse,
    PolicyReport, ErrorResponse, ErrorCode,
    Language, RetryPolicy
)

router = APIRouter(prefix="/api/v1", tags=["retry-policy"])


@router.post("/config/import", response_model=ConfigImportResponse)
def import_config(request: ConfigImportRequest, db: Session = Depends(get_db)):
    if not request.language:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="language field is required",
                details={"field": "language"}
            ).model_dump()
        )
    if not request.config_data:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="config_data field is required",
                details={"field": "config_data"}
            ).model_dump()
        )
    
    try:
        engine = PolicyEngine(db)
        sdk_config, policies_count = engine.import_sdk_config(
            language=request.language,
            config_data=request.config_data,
            sdk_version=request.sdk_version,
            config_source=request.config_source
        )
        
        return ConfigImportResponse(
            success=True,
            sdk_config_id=sdk_config.id,
            message=f"Successfully imported {policies_count} retry policies",
            policies_parsed=policies_count
        )
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message=str(e),
                details={"language": request.language}
            ).model_dump()
        )


@router.get("/policies", response_model=List[RetryPolicy])
def get_policies(
    language: Optional[str] = Query(None, description="Filter by language"),
    status_code: Optional[int] = Query(None, description="Filter by HTTP status code"),
    status_code_category: Optional[str] = Query(None, description="Filter by status code category"),
    is_retryable: Optional[bool] = Query(None, description="Filter by retryable flag"),
    db: Session = Depends(get_db)
):
    engine = PolicyEngine(db)
    policies = engine.get_policies(
        language=language,
        status_code=status_code,
        status_code_category=status_code_category,
        is_retryable=is_retryable
    )
    return policies


@router.post("/compare", response_model=ComparisonResponse)
def compare_policies(request: ComparisonRequest, db: Session = Depends(get_db)):
    if len(request.languages) < 2:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="At least 2 languages are required for comparison",
                details={"languages_provided": len(request.languages)}
            ).model_dump()
        )
    
    engine = PolicyEngine(db)
    report = engine.compare_policies(
        languages=request.languages,
        status_codes=request.status_codes
    )
    discrepancies = engine.get_report_discrepancies(report.id)
    
    return ComparisonResponse(
        report_id=report.id,
        report_name=report.report_name,
        status_codes_analyzed=report.status_codes_analyzed,
        discrepancies_found=report.discrepancies_found,
        discrepancies=discrepancies
    )


@router.get("/reports/{report_id}", response_model=PolicyReport)
def get_report(report_id: int, db: Session = Depends(get_db)):
    engine = PolicyEngine(db)
    report = engine.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message="Report not found",
                details={"report_id": report_id}
            ).model_dump()
        )
    report.discrepancies = engine.get_report_discrepancies(report_id)
    return report


@router.get("/reports/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    engine = PolicyEngine(db)
    report = engine.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message="Report not found",
                details={"report_id": report_id}
            ).model_dump()
        )
    return engine.export_report(report_id)


@router.post("/reports/{report_id}/review")
def mark_report_reviewed(report_id: int, reviewer: str, db: Session = Depends(get_db)):
    engine = PolicyEngine(db)
    report = engine.get_report(report_id)
    if not report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message="Report not found",
                details={"report_id": report_id}
            ).model_dump()
        )
    
    if report.reviewed:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message="Report has already been reviewed",
                details={"report_id": report_id, "reviewed_by": report.reviewed_by}
            ).model_dump()
        )
    
    if not report.needs_review:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message="Report does not need review",
                details={"report_id": report_id}
            ).model_dump()
        )
    
    success = engine.mark_reviewed(report_id, reviewer)
    return {"success": success, "message": "Report marked as reviewed"}


@router.get("/languages", response_model=List[Language])
def get_languages(db: Session = Depends(get_db)):
    engine = PolicyEngine(db)
    return engine.get_all_languages()


@router.post("/discrepancies/{discrepancy_id}/resolve")
def resolve_discrepancy(discrepancy_id: int, db: Session = Depends(get_db)):
    engine = PolicyEngine(db)
    success = engine.resolve_discrepancy(discrepancy_id)
    if not success:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message="Discrepancy not found or already resolved",
                details={"discrepancy_id": discrepancy_id}
            ).model_dump()
        )
    return {"success": True, "message": "Discrepancy marked as resolved"}