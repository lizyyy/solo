from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Header
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.database import get_db, engine
from app.models import Base, TicketStatus, FaultType, ReviewResult
from app.schemas import (
    Ticket,
    TicketCreate,
    Dispatch,
    DispatchCreate,
    DispatchUpdate,
    BatchResult,
    ExportFilter,
)
from app.services import (
    TicketService,
    DispatchService,
    ReviewService,
    ImportService,
    ExportService,
)

Base.metadata.create_all(bind=engine)

app = FastAPI(title="换电运营值班系统", version="1.0.0")


def get_operator(x_operator: Optional[str] = Header(None)) -> Optional[str]:
    return x_operator


@app.get("/")
def read_root():
    return {"message": "换电运营值班系统 API"}


@app.post("/tickets/", response_model=Ticket)
def create_ticket(
    ticket_data: TicketCreate,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = TicketService(db)
    return service.create_ticket(ticket_data, operator)


@app.get("/tickets/", response_model=List[Ticket])
def list_tickets(
    status: Optional[TicketStatus] = None,
    cabinet_code: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    query = db.query(Ticket)
    if status:
        query = query.filter(Ticket.status == status)
    if cabinet_code:
        query = query.filter(Ticket.cabinet_code.contains(cabinet_code))
    return query.offset(skip).limit(limit).all()


@app.get("/tickets/{ticket_id}", response_model=Ticket)
def get_ticket(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.query(Ticket).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="工单不存在")
    return ticket


@app.post("/tickets/{ticket_id}/receive")
def receive_ticket(
    ticket_id: int,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = TicketService(db)
    try:
        ticket, reasons = service.receive_ticket(ticket_id, operator)
        return {
            "ticket_id": ticket.id,
            "ticket_no": ticket.ticket_no,
            "status": ticket.status.value,
            "rule_reasons": reasons,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tickets/batch/receive", response_model=BatchResult)
def batch_receive_tickets(
    ticket_ids: List[int],
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = TicketService(db)
    return service.batch_receive_tickets(ticket_ids, operator)


@app.post("/tickets/{ticket_id}/attribute", response_model=Ticket)
def attribute_ticket(
    ticket_id: int,
    fault_type: FaultType,
    reason: str,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = TicketService(db)
    try:
        return service.attribute_ticket(ticket_id, fault_type, reason, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tickets/batch/attribute", response_model=BatchResult)
def batch_attribute_tickets(
    ticket_ids: List[int],
    fault_type: FaultType,
    reason: str,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = TicketService(db)
    return service.batch_attribute_tickets(ticket_ids, fault_type, reason, operator)


@app.post("/dispatches/", response_model=Dispatch)
def create_dispatch(
    dispatch_data: DispatchCreate,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = DispatchService(db)
    try:
        return service.create_dispatch(dispatch_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.patch("/dispatches/{dispatch_id}", response_model=Dispatch)
def update_dispatch(
    dispatch_id: int,
    update_data: DispatchUpdate,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = DispatchService(db)
    try:
        return service.update_dispatch(dispatch_id, update_data, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/dispatches/batch", response_model=BatchResult)
def batch_create_dispatches(
    ticket_ids: List[int],
    technician_id: str,
    technician_name: str,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = DispatchService(db)
    return service.batch_create_dispatches(ticket_ids, technician_id, technician_name, operator)


@app.post("/tickets/{ticket_id}/review", response_model=Ticket)
def review_ticket(
    ticket_id: int,
    result: ReviewResult,
    comment: Optional[str] = None,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = ReviewService(db)
    try:
        return service.review_ticket(ticket_id, result, comment, operator)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/tickets/batch/review", response_model=BatchResult)
def batch_review_tickets(
    ticket_ids: List[int],
    result: ReviewResult,
    comment: Optional[str] = None,
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    service = ReviewService(db)
    return service.batch_review_tickets(ticket_ids, result, comment, operator)


@app.post("/import/excel")
def import_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    operator: Optional[str] = Depends(get_operator),
):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="只支持Excel文件")

    service = ImportService(db)
    try:
        content = file.file.read()
        batch, tickets = service.import_tickets_from_excel(content, file.filename, operator)
        return {
            "batch_no": batch.batch_no,
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "fail_count": batch.fail_count,
            "fail_details": batch.fail_details,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/export/excel")
def export_excel(
    filter_params: ExportFilter,
    db: Session = Depends(get_db),
):
    service = ExportService(db)
    try:
        excel_data = service.export_tickets(filter_params)
        return Response(
            content=excel_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": "attachment; filename=tickets.xlsx"},
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
