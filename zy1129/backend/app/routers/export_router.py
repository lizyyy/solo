from fastapi import APIRouter, Depends, Query
from fastapi.responses import PlainTextResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.services import ExportService

router = APIRouter()


@router.get("/policies/csv")
async def export_policies_csv(
    member_id: Optional[int] = Query(None),
    policy_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = ExportService(db)
    csv_content = await service.export_policies_csv(
        member_id=member_id,
        policy_type=policy_type
    )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=policies_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/incidents/csv")
async def export_incidents_csv(
    member_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = ExportService(db)
    csv_content = await service.export_incidents_csv(
        member_id=member_id,
        status=status
    )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=incidents_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/claims/csv")
async def export_claims_csv(
    incident_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db)
):
    service = ExportService(db)
    csv_content = await service.export_claims_csv(
        incident_id=incident_id,
        status=status
    )
    return PlainTextResponse(
        content=csv_content,
        media_type="text/csv",
        headers={
            "Content-Disposition": f"attachment; filename=claims_{datetime.now().strftime('%Y%m%d')}.csv"
        }
    )


@router.get("/report/markdown")
async def export_markdown(
    member_id: Optional[int] = Query(None),
    policy_type: Optional[str] = Query(None),
    include_policies: bool = Query(True),
    include_incidents: bool = Query(True),
    include_claims: bool = Query(True),
    db: AsyncSession = Depends(get_db)
):
    service = ExportService(db)
    md_content = await service.export_markdown(
        member_id=member_id,
        policy_type=policy_type,
        include_policies=include_policies,
        include_incidents=include_incidents,
        include_claims=include_claims
    )
    return PlainTextResponse(
        content=md_content,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=insurance_report_{datetime.now().strftime('%Y%m%d')}.md"
        }
    )


@router.get("/report/html")
async def export_html(
    member_id: Optional[int] = Query(None),
    policy_type: Optional[str] = Query(None),
    include_policies: bool = Query(True),
    include_incidents: bool = Query(True),
    include_claims: bool = Query(True),
    db: AsyncSession = Depends(get_db)
):
    service = ExportService(db)
    html_content = await service.export_html(
        member_id=member_id,
        policy_type=policy_type,
        include_policies=include_policies,
        include_incidents=include_incidents,
        include_claims=include_claims
    )
    return HTMLResponse(content=html_content)
