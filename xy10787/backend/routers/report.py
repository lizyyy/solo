from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models import CoverageReport, VersionRelease, LanguagePack
from schemas import CoverageReportResponse, ExportRequest
from services.export_service import ExportService

router = APIRouter(prefix="/api/report", tags=["报告管理"])


@router.get("", response_model=List[CoverageReportResponse])
def get_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reports = db.query(CoverageReport).order_by(
        CoverageReport.generated_at.desc()
    ).offset(skip).limit(limit).all()
    
    result = []
    for report in reports:
        report_dict = {c.name: getattr(report, c.name) for c in report.__table__.columns}
        version = db.query(VersionRelease).filter(
            VersionRelease.id == report.version_release_id
        ).first()
        if version:
            report_dict["version"] = version.version
            lang_pack = db.query(LanguagePack).filter(
                LanguagePack.id == version.language_pack_id
            ).first()
            if lang_pack:
                report_dict["language_code"] = lang_pack.language_code
        result.append(report_dict)
    
    return result


@router.get("/{report_id}", response_model=CoverageReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(CoverageReport).filter(CoverageReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    report_dict = {c.name: getattr(report, c.name) for c in report.__table__.columns}
    version = db.query(VersionRelease).filter(
        VersionRelease.id == report.version_release_id
    ).first()
    if version:
        report_dict["version"] = version.version
        lang_pack = db.query(LanguagePack).filter(
            LanguagePack.id == version.language_pack_id
        ).first()
        if lang_pack:
            report_dict["language_code"] = lang_pack.language_code
    
    return report_dict


@router.post("/export")
def export_language_pack(export_request: ExportRequest, db: Session = Depends(get_db)):
    try:
        export_result = ExportService.export_language_pack(
            db, export_request.language_pack_id,
            export_request.version_release_id,
            export_request.format
        )
        
        return Response(
            content=export_result["content"],
            media_type=export_result["content_type"],
            headers={
                "Content-Disposition": f"attachment; filename={export_result['filename']}"
            }
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
