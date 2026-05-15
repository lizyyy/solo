from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas.ticket import (
    TicketCreate,
    TicketResponse,
    TicketWithDetails,
    ManualNoteCreate,
    CandidateListResponse
)
from app.services.ticket_service import TicketService
from app.services.scan_service import ScanService
from app.services.candidate_service import CandidateService

router = APIRouter(prefix="/api/tickets", tags=["tickets"])


@router.post("/", response_model=TicketResponse, status_code=status.HTTP_201_CREATED)
def create_ticket(ticket_data: TicketCreate, db: Session = Depends(get_db)):
    service = TicketService(db)
    existing = service.get_ticket_by_no(ticket_data.ticket_no)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"工单编号 {ticket_data.ticket_no} 已存在"
        )
    return service.create_ticket(ticket_data)


@router.get("/", response_model=List[TicketResponse])
def get_tickets(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    service = TicketService(db)
    return service.get_all_tickets(skip=skip, limit=limit)


@router.get("/{ticket_no}", response_model=TicketWithDetails)
def get_ticket(ticket_no: str, db: Session = Depends(get_db)):
    service = TicketService(db)
    ticket = service.get_ticket_by_no(ticket_no)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_no} 不存在"
        )
    return ticket


@router.post("/{ticket_no}/scan", response_model=TicketWithDetails)
def scan_ticket(ticket_no: str, operator: str, db: Session = Depends(get_db)):
    service = ScanService(db)
    ticket = service.scan_ticket(ticket_no, operator)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_no} 不存在"
        )
    return ticket


@router.post("/{ticket_no}/attachments")
def add_attachment(
    ticket_no: str,
    file_name: str,
    file_type: str,
    content: str,
    uploaded_by: str,
    db: Session = Depends(get_db)
):
    ticket_service = TicketService(db)
    ticket = ticket_service.get_ticket_by_no(ticket_no)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_no} 不存在"
        )
    
    scan_service = ScanService(db)
    attachment = scan_service.add_attachment(
        ticket_id=ticket.id,
        file_name=file_name,
        file_type=file_type,
        content=content,
        uploaded_by=uploaded_by
    )
    return {
        "message": "附件上传成功",
        "attachment_id": attachment.id,
        "version": attachment.version
    }


@router.post("/manual-note", response_model=TicketWithDetails)
def add_manual_note(note_data: ManualNoteCreate, db: Session = Depends(get_db)):
    service = TicketService(db)
    ticket = service.add_manual_note(note_data)
    if not ticket:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {note_data.ticket_no} 不存在"
        )
    return ticket


@router.get("/candidates/rollback", response_model=CandidateListResponse)
def get_rollback_candidates(db: Session = Depends(get_db)):
    service = CandidateService(db)
    return service.generate_rollback_candidates()


@router.get("/candidates/cleanup", response_model=CandidateListResponse)
def get_cleanup_candidates(retention_days: int = 90, db: Session = Depends(get_db)):
    service = CandidateService(db)
    return service.generate_cleanup_candidates(retention_days=retention_days)


@router.post("/{ticket_id}/rollback")
def rollback_ticket(ticket_id: int, operator: str, db: Session = Depends(get_db)):
    service = CandidateService(db)
    success = service.execute_rollback(ticket_id, operator)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"工单 {ticket_id} 不存在或无法回滚"
        )
    return {"message": "回滚成功", "ticket_id": ticket_id}


@router.post("/cleanup")
def cleanup_tickets(ticket_ids: List[int], operator: str, db: Session = Depends(get_db)):
    service = CandidateService(db)
    result = service.execute_cleanup(ticket_ids, operator)
    return result
