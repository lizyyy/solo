from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Batch
from app.services.report_service import report_service

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/{batch_id}/json")
def get_json_report(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return report_service.generate_json_report(batch)


@router.get("/{batch_id}/markdown")
def get_markdown_report(batch_id: int, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return {"content": report_service.generate_markdown_report(batch)}


@router.get("/{batch_id}/download")
def download_report(
    batch_id: int,
    format: str = Query('json', enum=['json', 'markdown']),
    db: Session = Depends(get_db)
):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    content, media_type, filename = report_service.generate_download_content(batch, format)
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
