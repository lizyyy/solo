from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import BuildStatus
from app.schemas import (
    BuildArtifactCreate, BuildArtifactResponse, BudgetReportResponse,
    BudgetRuleCreate, BudgetRuleResponse, BudgetReportFilter,
    SuccessResponse
)
from app.crud import (
    create_build_artifact, get_build_artifact, get_build_artifacts,
    get_build_artifact_by_build_id, create_budget_rule, get_budget_rules,
    analyze_budget_violations, get_budget_report, get_budget_reports,
    mark_report_processed, review_violation
)
from app.exceptions import (
    NotFoundException, DuplicateBuildException, MissingFieldException
)
from app.exporter import export_report_to_csv, export_report_to_excel

router = APIRouter()


@router.post("/artifacts/", response_model=BuildArtifactResponse, status_code=status.HTTP_201_CREATED)
def create_artifact(artifact: BuildArtifactCreate, db: Session = Depends(get_db)):
    existing = get_build_artifact_by_build_id(db, artifact.build_id)
    if existing:
        raise DuplicateBuildException(artifact.build_id)

    if not artifact.chunks:
        raise MissingFieldException("chunks", "At least one chunk is required")

    return create_build_artifact(db, artifact)


@router.get("/artifacts/", response_model=List[BuildArtifactResponse])
def list_artifacts(
    project_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return get_build_artifacts(db, project_name=project_name, skip=skip, limit=limit)


@router.get("/artifacts/{artifact_id}", response_model=BuildArtifactResponse)
def get_artifact(artifact_id: int, db: Session = Depends(get_db)):
    artifact = get_build_artifact(db, artifact_id)
    if not artifact:
        raise NotFoundException("BuildArtifact", artifact_id)
    return artifact


@router.post("/artifacts/{artifact_id}/analyze", response_model=BudgetReportResponse)
def analyze_artifact(artifact_id: int, db: Session = Depends(get_db)):
    artifact = get_build_artifact(db, artifact_id)
    if not artifact:
        raise NotFoundException("BuildArtifact", artifact_id)

    if artifact.status not in [BuildStatus.PENDING, BuildStatus.COMPLETED]:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot analyze artifact in status: {artifact.status}",
        )

    return analyze_budget_violations(db, artifact)


@router.post("/rules/", response_model=BudgetRuleResponse, status_code=status.HTTP_201_CREATED)
def create_rule(rule: BudgetRuleCreate, db: Session = Depends(get_db)):
    return create_budget_rule(db, rule)


@router.get("/rules/", response_model=List[BudgetRuleResponse])
def list_rules(project_name: Optional[str] = None, db: Session = Depends(get_db)):
    return get_budget_rules(db, project_name=project_name)


@router.get("/reports/", response_model=List[BudgetReportResponse])
def list_reports(
    project_name: Optional[str] = None,
    branch: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    has_violations: Optional[bool] = None,
    is_processed: Optional[bool] = None,
    needs_review: Optional[bool] = None,
    db: Session = Depends(get_db),
):
    filter_params = BudgetReportFilter(
        project_name=project_name,
        branch=branch,
        start_date=start_date,
        end_date=end_date,
        has_violations=has_violations,
        is_processed=is_processed,
        needs_review=needs_review,
    )
    return get_budget_reports(db, filter_params)


@router.get("/reports/{report_id}", response_model=BudgetReportResponse)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = get_budget_report(db, report_id)
    if not report:
        raise NotFoundException("BudgetReport", report_id)
    return report


@router.post("/reports/{report_id}/process", response_model=BudgetReportResponse)
def process_report(report_id: int, notes: Optional[str] = None, db: Session = Depends(get_db)):
    return mark_report_processed(db, report_id, notes)


@router.post("/violations/{violation_id}/review")
def review_single_violation(
    violation_id: int,
    reviewed: bool = True,
    reviewed_by: Optional[str] = None,
    db: Session = Depends(get_db),
):
    violation = review_violation(db, violation_id, reviewed, reviewed_by)
    return SuccessResponse(
        message="Violation reviewed successfully",
        data={"violation_id": violation.id, "reviewed": violation.reviewed},
    )


@router.get("/reports/{report_id}/export/csv")
def export_report_csv(report_id: int, db: Session = Depends(get_db)):
    report = get_budget_report(db, report_id)
    if not report:
        raise NotFoundException("BudgetReport", report_id)

    csv_data = export_report_to_csv(db, report_id)
    filename = f"budget_report_{report_id}_{datetime.now().strftime('%Y%m%d')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/reports/{report_id}/export/excel")
def export_report_excel(report_id: int, db: Session = Depends(get_db)):
    report = get_budget_report(db, report_id)
    if not report:
        raise NotFoundException("BudgetReport", report_id)

    excel_data = export_report_to_excel(db, report_id)
    filename = f"budget_report_{report_id}_{datetime.now().strftime('%Y%m%d')}.xlsx"

    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )
