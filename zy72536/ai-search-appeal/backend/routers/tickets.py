from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import StreamingResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import BytesIO
import pandas as pd

from ..database import get_db
from .. import models, schemas
from ..services import appeal_service

router = APIRouter(prefix="/tickets", tags=["tickets"])


@router.get("/", response_model=List[schemas.AppealTicket])
def list_tickets(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.AppealTicket)
    if status:
        query = query.filter(models.AppealTicket.status == status)
    return query.order_by(models.AppealTicket.created_at.desc()).all()


@router.get("/{ticket_id}", response_model=schemas.AppealTicket)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")
    return ticket


@router.post("/import", response_model=schemas.ImportResult)
async def import_ticket(
    file: UploadFile = File(...),
    ticket_no: str = Form(...),
    original_row_start: int = Form(1),
    operator: str = Form("system"),
    db: Session = Depends(get_db)
):
    content = await file.read()
    content_str = content.decode("utf-8-sig")
    df = appeal_service.parse_csv_content(content_str)

    ticket, warnings = appeal_service.import_ticket_from_df(
        db, df, ticket_no, original_row_start, operator
    )

    return schemas.ImportResult(
        success=True,
        ticket_id=ticket.id,
        ticket_no=ticket.ticket_no,
        samples_count=len(ticket.samples),
        warnings=warnings
    )


@router.put("/{ticket_id}", response_model=schemas.AppealTicket)
def update_ticket(
    ticket_id: int,
    data: schemas.AppealTicketUpdate,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    before = {
        "status": ticket.status,
        "handler": ticket.handler,
        "desensitization_note": ticket.desensitization_note
    }

    if data.status is not None:
        ticket.status = data.status
    if data.handler is not None:
        ticket.handler = data.handler
    if data.desensitization_note is not None:
        ticket.desensitization_note = data.desensitization_note

    after = {
        "status": ticket.status,
        "handler": ticket.handler,
        "desensitization_note": ticket.desensitization_note
    }

    audit = models.AuditLog(
        ticket_id=ticket.id,
        action="更新工单",
        operator=operator,
        before_value=before,
        after_value=after
    )
    db.add(audit)
    db.commit()
    db.refresh(ticket)

    return ticket


@router.post("/{ticket_id}/self-check", response_model=List[schemas.SelfCheckResult])
def run_self_check(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")
    return appeal_service.run_self_check(db, ticket_id)


@router.get("/{ticket_id}/self-check", response_model=List[schemas.SelfCheckResult])
def get_self_check_results(ticket_id: int, db: Session = Depends(get_db)):
    results = db.query(models.SelfCheckResult).filter(
        models.SelfCheckResult.ticket_id == ticket_id
    ).order_by(models.SelfCheckResult.created_at.desc()).all()
    return results


@router.post("/{ticket_id}/recalculate", response_model=schemas.RecalculateResult)
def recalculate_ranks(
    ticket_id: int,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")

    result = appeal_service.recalculate_ranks(db, ticket_id, operator)
    return schemas.RecalculateResult(success=True, **result)


@router.get("/{ticket_id}/export")
def export_ticket_excel(ticket_id: int, db: Session = Depends(get_db)):
    df = appeal_service.export_ticket_excel(db, ticket_id)
    if df.empty:
        raise HTTPException(status_code=404, detail="工单不存在或无数据")

    output = BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="申诉明细")
    output.seek(0)

    ticket = db.query(models.AppealTicket).filter(models.AppealTicket.id == ticket_id).first()
    from urllib.parse import quote
    filename_ascii = f"appeal_{ticket.ticket_no}.xlsx"
    filename_utf8 = f"申诉工单_{ticket.ticket_no}.xlsx"
    filename_encoded = quote(filename_utf8)
    content_disposition = f"attachment; filename=\"{filename_ascii}\"; filename*=UTF-8''{filename_encoded}"

    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": content_disposition}
    )


@router.get("/{ticket_id}/export/json")
def export_ticket_json(ticket_id: int, db: Session = Depends(get_db)):
    result = appeal_service.export_ticket_json(db, ticket_id)
    if not result:
        raise HTTPException(status_code=404, detail="工单不存在或无数据")
    return JSONResponse(content=result)


@router.get("/{ticket_id}/audit-logs", response_model=List[schemas.AuditLog])
def get_audit_logs(ticket_id: int, db: Session = Depends(get_db)):
    logs = db.query(models.AuditLog).filter(
        models.AuditLog.ticket_id == ticket_id
    ).order_by(models.AuditLog.created_at.desc()).all()
    return logs


@router.patch("/{ticket_id}/samples/{sample_id}", response_model=schemas.Sample)
def update_sample(
    ticket_id: int,
    sample_id: int,
    data: schemas.SampleUpdate,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    sample = db.query(models.Sample).filter(
        models.Sample.id == sample_id,
        models.Sample.ticket_id == ticket_id
    ).first()
    if not sample:
        raise HTTPException(status_code=404, detail="样本不存在")

    before = {
        "expected_rank": sample.expected_rank,
        "current_rank": sample.current_rank,
        "status": sample.status,
        "manual_note": sample.manual_note,
        "is_hidden_by_avg": sample.is_hidden_by_avg
    }

    changed = False
    if data.expected_rank is not None and data.expected_rank != sample.expected_rank:
        sample.expected_rank = data.expected_rank
        changed = True
    if data.current_rank is not None and data.current_rank != sample.current_rank:
        sample.current_rank = data.current_rank
        changed = True
    if data.status is not None and data.status != sample.status:
        sample.status = data.status
        changed = True
    if data.manual_note is not None and data.manual_note != sample.manual_note:
        sample.manual_note = data.manual_note
        changed = True
    if data.is_hidden_by_avg is not None and data.is_hidden_by_avg != sample.is_hidden_by_avg:
        sample.is_hidden_by_avg = data.is_hidden_by_avg
        changed = True

    if changed:
        after = {
            "expected_rank": sample.expected_rank,
            "current_rank": sample.current_rank,
            "status": sample.status,
            "manual_note": sample.manual_note,
            "is_hidden_by_avg": sample.is_hidden_by_avg
        }
        audit = models.AuditLog(
            ticket_id=ticket_id,
            sample_id=sample_id,
            action="更新样本",
            operator=operator,
            before_value=before,
            after_value=after
        )
        db.add(audit)
        db.commit()
        db.refresh(sample)

    return sample
