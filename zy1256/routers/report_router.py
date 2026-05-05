from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional, List
import json
import os

from database import get_db
from models import AuditSession, AuditReport, AnalysisResult, KeyAnalysis, RedisKey, ComparisonResult
from schemas import ReportGenerateRequest, ReportResponse
from report_service import ReportService
from config import get_settings


router = APIRouter(prefix="/report", tags=["Report"])

settings = get_settings()
report_service = ReportService(settings.reports_dir)


@router.post("/generate", response_model=ReportResponse, status_code=201)
async def generate_report(
    request: ReportGenerateRequest,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == request.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {request.session_id} not found")
    
    if session.status not in ["analyzed", "confirmed"]:
        raise HTTPException(
            status_code=400,
            detail=f"Session {request.session_id} not analyzed yet. Run analysis first."
        )
    
    result = await db.execute(
        select(AnalysisResult).where(AnalysisResult.session_id == request.session_id)
    )
    analysis_results = result.scalars().all()
    
    result = await db.execute(
        select(KeyAnalysis, RedisKey)
        .join(RedisKey, KeyAnalysis.key_id == RedisKey.id)
        .where(RedisKey.session_id == request.session_id)
    )
    key_analysis_pairs = result.all()
    
    key_analyses = []
    for ka, rk in key_analysis_pairs:
        issues = json.loads(ka.issues) if ka.issues else []
        warnings = json.loads(ka.warnings) if ka.warnings else []
        suggestions = json.loads(ka.suggestions) if ka.suggestions else []
        
        key_analyses.append({
            "key_id": ka.key_id,
            "key_name": rk.key_name,
            "data_type": rk.data_type,
            "scenario": ka.scenario,
            "recommended_type": ka.recommended_type,
            "current_type_suitability": ka.current_type_suitability,
            "estimated_memory_bytes": ka.estimated_memory_bytes,
            "memory_optimization_potential": ka.memory_optimization_potential,
            "is_hot_key": ka.is_hot_key,
            "hot_key_score": ka.hot_key_score,
            "is_big_key": ka.is_big_key,
            "big_key_score": ka.big_key_score,
            "ttl_risk_level": ka.ttl_risk_level,
            "migration_risk_level": ka.migration_risk_level,
            "issues": issues,
            "warnings": warnings,
            "suggestions": suggestions,
        })
    
    result = await db.execute(
        select(ComparisonResult).where(ComparisonResult.session_id == request.session_id)
    )
    comparison_results = result.scalars().all()
    
    comparisons = []
    for comp in comparison_results:
        try:
            alternatives = json.loads(comp.alternatives) if comp.alternatives else []
        except Exception:
            alternatives = []
        
        comparisons.append({
            "id": comp.id,
            "scenario": comp.scenario,
            "current_structure": comp.current_structure,
            "recommended_structure": comp.recommended_structure,
            "comparison_summary": comp.comparison_summary,
            "alternatives": alternatives,
            "created_at": comp.created_at.isoformat() if comp.created_at else None,
        })
    
    session_data = {
        "id": session.id,
        "session_name": session.session_name,
        "created_at": session.created_at,
        "status": session.status,
        "description": session.description,
    }
    
    analysis_results_data = [
        {
            "id": ar.id,
            "analysis_type": ar.analysis_type,
            "summary": ar.summary,
            "score": ar.score,
            "total_keys": ar.total_keys,
            "issues_found": ar.issues_found,
            "warnings_found": ar.warnings_found,
            "created_at": ar.created_at.isoformat() if ar.created_at else None,
        }
        for ar in analysis_results
    ]
    
    report_data = await report_service.generate_report_data(
        session_data=session_data,
        analysis_results=analysis_results_data,
        key_analyses=key_analyses,
        comparison_results=comparisons,
        report_type=request.report_type,
    )
    
    if request.format == "json":
        filepath = await report_service.generate_json_report(
            report_data, request.session_id, request.report_type
        )
    elif request.format == "markdown":
        filepath = await report_service.generate_markdown_report(
            report_data, request.session_id, request.report_type
        )
    elif request.format == "html":
        filepath = await report_service.generate_html_report(
            report_data, request.session_id, request.report_type
        )
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported format: {request.format}")
    
    report_name = f"Redis_Audit_{session.session_name}_{request.report_type}_{request.format}"
    report = AuditReport(
        session_id=request.session_id,
        report_name=report_name,
        report_type=request.report_type,
        format=request.format,
        file_path=filepath,
        human_confirmed=False,
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    return ReportResponse(
        id=report.id,
        session_id=report.session_id,
        report_name=report.report_name,
        report_type=report.report_type,
        format=report.format,
        file_path=report.file_path,
        created_at=report.created_at,
        human_confirmed=report.human_confirmed,
        download_url=f"/report/download/{report.id}",
    )


@router.get("/{report_id}", response_model=ReportResponse)
async def get_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditReport).where(AuditReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    
    return ReportResponse(
        id=report.id,
        session_id=report.session_id,
        report_name=report.report_name,
        report_type=report.report_type,
        format=report.format,
        file_path=report.file_path,
        created_at=report.created_at,
        human_confirmed=report.human_confirmed,
        download_url=f"/report/download/{report.id}",
    )


@router.get("/download/{report_id}")
async def download_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditReport).where(AuditReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    
    if not os.path.exists(report.file_path):
        raise HTTPException(status_code=404, detail=f"Report file not found: {report.file_path}")
    
    media_types = {
        "json": "application/json",
        "html": "text/html",
        "markdown": "text/markdown",
    }
    
    media_type = media_types.get(report.format, "application/octet-stream")
    
    return FileResponse(
        path=report.file_path,
        media_type=media_type,
        filename=f"{report.report_name}.{report.format}",
    )


@router.get("/session/{session_id}", response_model=List[ReportResponse])
async def list_session_reports(
    session_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditSession).where(AuditSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail=f"Session {session_id} not found")
    
    result = await db.execute(
        select(AuditReport)
        .where(AuditReport.session_id == session_id)
        .order_by(AuditReport.created_at.desc())
    )
    reports = result.scalars().all()
    
    return [
        ReportResponse(
            id=r.id,
            session_id=r.session_id,
            report_name=r.report_name,
            report_type=r.report_type,
            format=r.format,
            file_path=r.file_path,
            created_at=r.created_at,
            human_confirmed=r.human_confirmed,
            download_url=f"/report/download/{r.id}",
        )
        for r in reports
    ]


@router.delete("/{report_id}", status_code=204)
async def delete_report(
    report_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(AuditReport).where(AuditReport.id == report_id)
    )
    report = result.scalar_one_or_none()
    
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    
    file_path = report.file_path
    if file_path and os.path.exists(file_path):
        try:
            os.remove(file_path)
        except Exception:
            pass
    
    await db.delete(report)
    await db.commit()
    
    return None
