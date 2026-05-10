from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
import io

from ..database import get_db
from ..services.export_service import ExportService

router = APIRouter(prefix="/api/export", tags=["export"])


@router.get("/journals/{account_id}")
def export_journals(account_id: int, db: Session = Depends(get_db)):
    try:
        data = ExportService.export_account_journals(db, account_id)
        return StreamingResponse(
            io.BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=journals_account_{account_id}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/settlement/{settlement_id}")
def export_settlement(settlement_id: int, db: Session = Depends(get_db)):
    try:
        data = ExportService.export_settlement(db, settlement_id)
        return StreamingResponse(
            io.BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=settlement_{settlement_id}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/refund-check")
def export_refund_check(start_date: str, end_date: str, db: Session = Depends(get_db)):
    try:
        data = ExportService.export_refund_check(db, start_date, end_date)
        return StreamingResponse(
            io.BytesIO(data),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=refund_check_{start_date}_{end_date}.xlsx"}
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
