from datetime import datetime
from typing import Optional
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO

from app.core.database import get_db
from app.models.instrument import InstrumentStatus
from app.models.borrow import BorrowStatus
from app.models.calibration import CalibrationStatus
from app.services.export_service import ExportService

router = APIRouter(prefix="/exports", tags=["exports"])


def _stream_xlsx(data: bytes, filename: str):
    buffer = BytesIO(data)
    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/instruments")
def export_instruments(
    status: Optional[InstrumentStatus] = None,
    db: Session = Depends(get_db),
):
    data = ExportService.export_instruments(db, status=status)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _stream_xlsx(data, f"instruments_{timestamp}.xlsx")


@router.get("/borrows")
def export_borrows(
    status: Optional[BorrowStatus] = None,
    db: Session = Depends(get_db),
):
    data = ExportService.export_borrows(db, status=status)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _stream_xlsx(data, f"borrows_{timestamp}.xlsx")


@router.get("/calibrations")
def export_calibrations(
    status: Optional[CalibrationStatus] = None,
    db: Session = Depends(get_db),
):
    data = ExportService.export_calibrations(db, status=status)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _stream_xlsx(data, f"calibrations_{timestamp}.xlsx")


@router.get("/ledger")
def export_full_ledger(db: Session = Depends(get_db)):
    data = ExportService.export_full_ledger(db)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return _stream_xlsx(data, f"ledger_{timestamp}.xlsx")
