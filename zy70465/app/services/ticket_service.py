from typing import Optional, List
from sqlalchemy.orm import Session
from app.models.ticket import Ticket, TicketStatus, StatusLog, ManualNote, TicketAttachment
from app.schemas.ticket import TicketCreate, ManualNoteCreate


class TicketService:
    def __init__(self, db: Session):
        self.db = db

    def create_ticket(self, ticket_data: TicketCreate) -> Ticket:
        ticket = Ticket(**ticket_data.model_dump())
        self.db.add(ticket)
        self.db.commit()
        self.db.refresh(ticket)
        
        self._add_status_log(
            ticket_id=ticket.id,
            to_status=TicketStatus.PENDING,
            operator="system",
            reason="工单创建",
            duty_record="系统自动创建工单，初始化状态为pending"
        )
        
        return ticket

    def get_ticket_by_no(self, ticket_no: str) -> Optional[Ticket]:
        return self.db.query(Ticket).filter(Ticket.ticket_no == ticket_no).first()

    def get_ticket_by_id(self, ticket_id: int) -> Optional[Ticket]:
        return self.db.query(Ticket).filter(Ticket.id == ticket_id).first()

    def get_all_tickets(self, skip: int = 0, limit: int = 100) -> List[Ticket]:
        return self.db.query(Ticket).offset(skip).limit(limit).all()

    def update_ticket_status(
        self,
        ticket_id: int,
        new_status: TicketStatus,
        operator: str,
        reason: str,
        duty_record: str
    ) -> Optional[Ticket]:
        ticket = self.get_ticket_by_id(ticket_id)
        if not ticket:
            return None
        
        old_status = ticket.status
        ticket.status = new_status
        
        self._add_status_log(
            ticket_id=ticket.id,
            from_status=old_status,
            to_status=new_status,
            operator=operator,
            reason=reason,
            duty_record=duty_record
        )
        
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def add_manual_note(self, note_data: ManualNoteCreate) -> Optional[Ticket]:
        ticket = self.get_ticket_by_no(note_data.ticket_no)
        if not ticket:
            return None
        
        original_conclusion = ticket.conclusion
        
        note = ManualNote(
            ticket_id=ticket.id,
            original_conclusion=original_conclusion,
            revised_conclusion=note_data.revised_conclusion,
            operator=note_data.operator,
            remark=note_data.remark
        )
        
        ticket.conclusion = note_data.revised_conclusion
        
        self.db.add(note)
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def update_summary_and_conclusion(
        self,
        ticket_id: int,
        summary: str,
        conclusion: str
    ) -> Optional[Ticket]:
        ticket = self.get_ticket_by_id(ticket_id)
        if not ticket:
            return None
        
        ticket.summary = summary
        ticket.conclusion = conclusion
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def mark_version_conflict(self, ticket_id: int) -> Optional[Ticket]:
        ticket = self.get_ticket_by_id(ticket_id)
        if not ticket:
            return None
        
        ticket.has_version_conflict = True
        self.db.commit()
        self.db.refresh(ticket)
        return ticket

    def _add_status_log(
        self,
        ticket_id: int,
        to_status: TicketStatus,
        operator: str,
        reason: str,
        duty_record: str,
        from_status: Optional[TicketStatus] = None
    ):
        log = StatusLog(
            ticket_id=ticket_id,
            from_status=from_status,
            to_status=to_status,
            operator=operator,
            reason=reason,
            duty_record=duty_record
        )
        self.db.add(log)
