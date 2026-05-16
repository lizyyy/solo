from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, FileResponse
from sqlalchemy.orm import Session
from io import BytesIO
import tempfile
import os

from app.models import get_db
from app.services.evidence_service import BatchService, OutputService

router = APIRouter(prefix="/outputs", tags=["outputs"])


@router.get("/batches/{batch_id}/json")
def get_batch_json(batch_id: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")

    records = BatchService.get_evidence_records(db, batch_id)
    authorizations = batch.authorizations

    return OutputService.to_json(batch, records, authorizations)


@router.get("/batches/{batch_id}/markdown")
def get_batch_markdown(batch_id: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")

    records = BatchService.get_evidence_records(db, batch_id)
    authorizations = batch.authorizations

    markdown_content = OutputService.to_markdown(batch, records, authorizations)
    return Response(content=markdown_content, media_type="text/markdown")


@router.get("/batches/{batch_id}/download")
def download_batch_report(batch_id: str, format: str = "json", db: Session = Depends(get_db)):
    batch = BatchService.get_batch(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次未找到")

    records = BatchService.get_evidence_records(db, batch_id)
    authorizations = batch.authorizations

    if format == "json":
        content = OutputService.to_json(batch, records, authorizations)
        import json

        content_str = json.dumps(content, ensure_ascii=False, indent=2)
        filename = f"batch_{batch.batch_no}_report.json"
        media_type = "application/json"
    elif format == "markdown":
        content_str = OutputService.to_markdown(batch, records, authorizations)
        filename = f"batch_{batch.batch_no}_report.md"
        media_type = "text/markdown"
    else:
        raise HTTPException(status_code=400, detail="不支持的格式")

    with tempfile.NamedTemporaryFile(mode="w", suffix=f".{format}", delete=False) as f:
        f.write(content_str)
        temp_path = f.name

    response = FileResponse(
        temp_path,
        media_type=media_type,
        filename=filename,
    )

    def cleanup():
        os.unlink(temp_path)

    return response
