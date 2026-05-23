from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io
from ..database import get_db
from ..models import User
from ..schemas import StatisticsResponse, SecuritySupervisorView, VisitorLedgerResponse
from ..services.auth_service import get_current_active_user
from ..services.export_service import ExportService

router = APIRouter(prefix="/reports", tags=["报表和导出"])


@router.get("/statistics", response_model=StatisticsResponse)
async def get_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    export_service = ExportService(db)
    return export_service.get_statistics(current_user)


@router.get("/security-supervisor-view")
async def get_security_supervisor_view(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    export_service = ExportService(db)
    try:
        return export_service.get_security_supervisor_view(current_user)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))


@router.post("/export/csv")
async def export_csv(
    ledger_ids: List[int],
    mask_sensitive: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    export_service = ExportService(db)
    try:
        csv_content = export_service.export_to_csv(ledger_ids, current_user, mask_sensitive)

        output = io.BytesIO()
        output.write(csv_content.encode('utf-8-sig'))
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=visitor_ledger_export.csv"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导出失败: {str(e)}")


@router.post("/export/json")
async def export_json(
    ledger_ids: List[int],
    include_workflow: bool = False,
    include_version_history: bool = False,
    mask_sensitive: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    export_service = ExportService(db)
    try:
        json_content = export_service.export_to_json(
            ledger_ids, current_user, include_workflow, include_version_history, mask_sensitive
        )

        output = io.BytesIO()
        output.write(json_content.encode('utf-8'))
        output.seek(0)

        return StreamingResponse(
            output,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": "attachment; filename=visitor_ledger_export.json"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导出失败: {str(e)}")
