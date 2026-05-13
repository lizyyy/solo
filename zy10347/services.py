from sqlalchemy.orm import Session
from sqlalchemy import or_, func
from models import (
    ErrorEvent, TicketStatus, AttributionRule, AttributionRuleMatch,
    SimilarTicket, RootCauseLabel, DispatchRecord, StatusHistory
)
from schemas import (
    ErrorEventCreate, AttributionRuleCreate, RootCauseLabelCreate,
    DispatchRecordCreate, StatusTransitionRequest
)
import re
from typing import Optional, List, Tuple
from datetime import datetime


def get_error_event_by_idempotency_key(db: Session, idempotency_key: str) -> Optional[ErrorEvent]:
    return db.query(ErrorEvent).filter(ErrorEvent.idempotency_key == idempotency_key).first()


def get_error_event_by_ticket_id(db: Session, ticket_id: str) -> Optional[ErrorEvent]:
    return db.query(ErrorEvent).filter(ErrorEvent.ticket_id == ticket_id).first()


def create_error_event(db: Session, event: ErrorEventCreate) -> Tuple[ErrorEvent, bool]:
    existing = get_error_event_by_idempotency_key(db, event.idempotency_key)
    if existing:
        return existing, False

    existing_ticket = get_error_event_by_ticket_id(db, event.ticket_id)
    if existing_ticket:
        return existing_ticket, False

    db_event = ErrorEvent(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)

    _create_status_history(db, db_event.id, None, TicketStatus.PENDING, "工单创建")

    return db_event, True


def _create_status_history(db: Session, ticket_id: int, from_status: Optional[str],
                           to_status: TicketStatus, reason: str, changed_by: Optional[str] = None):
    history = StatusHistory(
        ticket_id=ticket_id,
        from_status=from_status.value if from_status else None,
        to_status=to_status.value,
        reason=reason,
        changed_by=changed_by
    )
    db.add(history)
    db.commit()


def transition_status(db: Session, request: StatusTransitionRequest) -> ErrorEvent:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == request.ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {request.ticket_id} 不存在")

    if ticket.status == request.target_status:
        return ticket

    from_status = ticket.status
    ticket.status = request.target_status
    _create_status_history(db, ticket.id, from_status, request.target_status,
                           request.reason or "状态变更", request.changed_by)

    db.commit()
    db.refresh(ticket)
    return ticket


def match_attribution_rules(db: Session, ticket_id: int) -> List[AttributionRuleMatch]:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {ticket_id} 不存在")

    ticket.status = TicketStatus.MATCHING
    db.commit()

    active_rules = db.query(AttributionRule).filter(AttributionRule.is_active == True).order_by(
        AttributionRule.priority.desc()).all()

    matches = []
    for rule in active_rules:
        score = 0

        if rule.error_code_pattern and ticket.error_code:
            if re.search(rule.error_code_pattern, ticket.error_code, re.IGNORECASE):
                score += 30

        if rule.api_path_pattern and ticket.api_path:
            if re.search(rule.api_path_pattern, ticket.api_path):
                score += 25

        if rule.keyword_pattern:
            keywords = rule.keyword_pattern.split('|')
            text_to_search = f"{ticket.title} {ticket.description or ''} {ticket.error_message or ''}"
            for keyword in keywords:
                if keyword.strip() and keyword.strip().lower() in text_to_search.lower():
                    score += 15
                    break

        if score > 0:
            existing_match = db.query(AttributionRuleMatch).filter(
                AttributionRuleMatch.ticket_id == ticket_id,
                AttributionRuleMatch.rule_id == rule.id
            ).first()

            if not existing_match:
                match = AttributionRuleMatch(
                    ticket_id=ticket_id,
                    rule_id=rule.id,
                    match_score=score
                )
                db.add(match)
                matches.append(match)

    db.commit()
    return matches


def find_similar_tickets(db: Session, ticket_id: int, threshold: int = 30) -> List[SimilarTicket]:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {ticket_id} 不存在")

    other_tickets = db.query(ErrorEvent).filter(ErrorEvent.id != ticket_id).all()
    similar_records = []

    for other in other_tickets:
        score = 0

        if ticket.error_code and other.error_code and ticket.error_code == other.error_code:
            score += 40

        if ticket.api_path and other.api_path and ticket.api_path == other.api_path:
            score += 30

        if ticket.title and other.title:
            ticket_words = set(ticket.title.lower().split())
            other_words = set(other.title.lower().split())
            common = ticket_words & other_words
            if len(common) >= 2:
                score += min(len(common) * 10, 30)

        if score >= threshold:
            existing = db.query(SimilarTicket).filter(
                or_(
                    (SimilarTicket.ticket_id == ticket_id) & (SimilarTicket.similar_ticket_id == other.id),
                    (SimilarTicket.ticket_id == other.id) & (SimilarTicket.similar_ticket_id == ticket_id)
                )
            ).first()

            if not existing:
                similar = SimilarTicket(
                    ticket_id=ticket_id,
                    similar_ticket_id=other.id,
                    similarity_score=score
                )
                db.add(similar)
                similar_records.append(similar)

    db.commit()
    return similar_records


def merge_similar_ticket(db: Session, ticket_id: int, similar_ticket_id: int) -> SimilarTicket:
    similar = db.query(SimilarTicket).filter(
        SimilarTicket.ticket_id == ticket_id,
        SimilarTicket.similar_ticket_id == similar_ticket_id
    ).first()

    if not similar:
        raise ValueError("相似工单记录不存在")

    similar.merged = True
    similar.merged_at = datetime.now()

    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    ticket.status = TicketStatus.MERGED

    _create_status_history(db, ticket_id, TicketStatus.PENDING, TicketStatus.MERGED,
                           f"合并工单 {similar_ticket_id}")

    db.commit()
    db.refresh(similar)
    return similar


def label_root_cause(db: Session, label_data: RootCauseLabelCreate) -> RootCauseLabel:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == label_data.ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {label_data.ticket_id} 不存在")

    existing = db.query(RootCauseLabel).filter(RootCauseLabel.ticket_id == label_data.ticket_id).first()
    if existing:
        existing.root_cause_category = label_data.root_cause_category
        existing.root_cause_detail = label_data.root_cause_detail
        existing.confidence_score = label_data.confidence_score
        existing.tagged_by = label_data.tagged_by
        label = existing
    else:
        label = RootCauseLabel(**label_data.model_dump())
        db.add(label)

    ticket.status = TicketStatus.ROOT_CAUSE_LABELLED
    _create_status_history(db, label_data.ticket_id, ticket.status, TicketStatus.ROOT_CAUSE_LABELLED,
                           "根因标注完成", label_data.tagged_by)

    db.commit()
    db.refresh(label)
    return label


def create_dispatch_record(db: Session, dispatch_data: DispatchRecordCreate) -> DispatchRecord:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == dispatch_data.ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {dispatch_data.ticket_id} 不存在")

    dispatch = DispatchRecord(**dispatch_data.model_dump())
    db.add(dispatch)

    ticket.status = TicketStatus.DISPATCHED
    _create_status_history(db, dispatch_data.ticket_id, ticket.status, TicketStatus.DISPATCHED,
                           f"派单给 {dispatch_data.assignee}")

    db.commit()
    db.refresh(dispatch)
    return dispatch


def get_status_history(db: Session, ticket_id: int) -> List[StatusHistory]:
    return db.query(StatusHistory).filter(StatusHistory.ticket_id == ticket_id).order_by(
        StatusHistory.changed_at.desc()).all()


def get_attribution_report(db: Session, ticket_id: int) -> dict:
    ticket = db.query(ErrorEvent).filter(ErrorEvent.id == ticket_id).first()
    if not ticket:
        raise ValueError(f"工单 {ticket_id} 不存在")

    matched_rules = db.query(AttributionRuleMatch).filter(
        AttributionRuleMatch.ticket_id == ticket_id).all()
    rule_names = [db.query(AttributionRule).get(m.rule_id).name for m in matched_rules]

    similar_count = db.query(SimilarTicket).filter(SimilarTicket.ticket_id == ticket_id).count()

    root_cause = db.query(RootCauseLabel).filter(RootCauseLabel.ticket_id == ticket_id).first()

    latest_dispatch = db.query(DispatchRecord).filter(
        DispatchRecord.ticket_id == ticket_id).order_by(DispatchRecord.dispatched_at.desc()).first()

    return {
        "ticket_id": ticket.ticket_id,
        "title": ticket.title,
        "status": ticket.status,
        "matched_rules": rule_names,
        "similar_tickets_count": similar_count,
        "root_cause_category": root_cause.root_cause_category if root_cause else None,
        "root_cause_detail": root_cause.root_cause_detail if root_cause else None,
        "assignee": latest_dispatch.assignee if latest_dispatch else None,
        "created_at": ticket.created_at
    }


def list_tickets(db: Session, status: Optional[TicketStatus] = None,
                 page: int = 1, page_size: int = 20) -> Tuple[List[ErrorEvent], int]:
    query = db.query(ErrorEvent)
    if status:
        query = query.filter(ErrorEvent.status == status)

    total = query.count()
    items = query.order_by(ErrorEvent.created_at.desc()).offset(
        (page - 1) * page_size).limit(page_size).all()

    return items, total


def create_attribution_rule(db: Session, rule_data: AttributionRuleCreate) -> AttributionRule:
    rule = AttributionRule(**rule_data.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule