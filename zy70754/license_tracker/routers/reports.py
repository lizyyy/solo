from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import csv
import io
import os

from ..database import get_db, LicenseException, Dependency, DependencyPath, ExceptionStatus
from ..schemas import ExceptionReportResponse, ExceptionReportItem

router = APIRouter()

REPORTS_DIR = "./reports"
os.makedirs(REPORTS_DIR, exist_ok=True)


@router.get("/exceptions", response_model=ExceptionReportResponse)
async def generate_exception_report(
    project_path: Optional[str] = None,
    status: Optional[ExceptionStatus] = None,
    db: Session = Depends(get_db)
):
    query = db.query(LicenseException)
    if status:
        query = query.filter(LicenseException.status == status)

    exceptions = query.all()

    items = []
    for exc in exceptions:
        dep = None
        paths = []
        if exc.dependency_id:
            dep = db.query(Dependency).filter(Dependency.id == exc.dependency_id).first()
            dep_paths = db.query(DependencyPath).filter(DependencyPath.dependency_id == exc.dependency_id).all()
            paths = [p.file_path for p in dep_paths]

        items.append(ExceptionReportItem(
            dependency_name=exc.dependency_name,
            version=dep.version if dep else "unknown",
            license_name=exc.license_name,
            exception_status=exc.status,
            exception_reason=exc.reason,
            expires_at=exc.expires_at,
            requested_by=exc.requested_by,
            approved_by=exc.approved_by,
            project_path=dep.project_path if dep else "unknown",
            paths=paths
        ))

    pending_count = sum(1 for exc in exceptions if exc.status == ExceptionStatus.PENDING_REVIEW)
    approved_count = sum(1 for exc in exceptions if exc.status == ExceptionStatus.APPROVED)

    now = datetime.utcnow()
    thirty_days = now + datetime.timedelta(days=30)
    expiring_count = sum(
        1 for exc in exceptions
        if exc.status == ExceptionStatus.APPROVED
        and exc.expires_at <= thirty_days
        and exc.expires_at >= now
    )

    return ExceptionReportResponse(
        report_generated_at=datetime.utcnow(),
        total_items=len(items),
        pending_review=pending_count,
        approved=approved_count,
        expiring_30_days=expiring_count,
        items=items
    )


@router.get("/exceptions/export/csv")
async def export_exceptions_csv(
    project_path: Optional[str] = None,
    status: Optional[ExceptionStatus] = None,
    db: Session = Depends(get_db)
):
    report = await generate_exception_report(project_path, status, db)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"license_exceptions_{timestamp}.csv"
    filepath = os.path.join(REPORTS_DIR, filename)

    with open(filepath, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            "Dependency Name",
            "Version",
            "License Name",
            "Status",
            "Reason",
            "Expires At",
            "Requested By",
            "Approved By",
            "Project Path",
            "Usage Paths"
        ])

        for item in report.items:
            writer.writerow([
                item.dependency_name,
                item.version,
                item.license_name,
                item.exception_status,
                item.exception_reason,
                item.expires_at.isoformat() if item.expires_at else "",
                item.requested_by or "",
                item.approved_by or "",
                item.project_path,
                "; ".join(item.paths)
            ])

    return FileResponse(
        filepath,
        media_type="text/csv",
        filename=filename
    )


@router.get("/exceptions/export/json")
async def export_exceptions_json(
    project_path: Optional[str] = None,
    status: Optional[ExceptionStatus] = None,
    db: Session = Depends(get_db)
):
    report = await generate_exception_report(project_path, status, db)

    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"license_exceptions_{timestamp}.json"
    filepath = os.path.join(REPORTS_DIR, filename)

    import json
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(report.dict(), f, indent=2, default=str)

    return FileResponse(
        filepath,
        media_type="application/json",
        filename=filename
    )


@router.get("/dependencies/summary")
async def get_dependencies_summary(
    project_path: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Dependency)
    if project_path:
        query = query.filter(Dependency.project_path == project_path)

    dependencies = query.all()

    by_license = {}
    for dep in dependencies:
        lic = dep.license_name or "Unknown"
        if lic not in by_license:
            by_license[lic] = 0
        by_license[lic] += 1

    return {
        "total_dependencies": len(dependencies),
        "by_license": by_license,
        "with_exceptions": db.query(LicenseException).count()
    }
