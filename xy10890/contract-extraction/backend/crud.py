from sqlalchemy.orm import Session
from sqlalchemy import or_, desc
from typing import List, Optional
import hashlib
import json
from datetime import datetime

from models import (
    Contract, Clause, ClauseType, ClauseRevision,
    ContractVersion, TimelineEvent, ContractStatus, RiskLevel
)
from schemas import (
    ContractCreate, ContractUpdate, ClauseCreate, ClauseUpdate,
    ClauseTypeCreate, RevisionRequest
)


def get_contract(db: Session, contract_id: int) -> Optional[Contract]:
    return db.query(Contract).filter(Contract.id == contract_id).first()


def get_contracts(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    status: Optional[ContractStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    search: Optional[str] = None
) -> List[Contract]:
    query = db.query(Contract)
    
    if status:
        query = query.filter(Contract.status == status)
    if risk_level:
        query = query.filter(Contract.overall_risk == risk_level)
    if search:
        query = query.filter(
            or_(
                Contract.filename.contains(search),
                Contract.contract_name.contains(search),
                Contract.party_a.contains(search),
                Contract.party_b.contains(search)
            )
        )
    
    return query.order_by(desc(Contract.created_at)).offset(skip).limit(limit).all()


def count_contracts(
    db: Session,
    status: Optional[ContractStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    search: Optional[str] = None
) -> int:
    query = db.query(Contract)
    
    if status:
        query = query.filter(Contract.status == status)
    if risk_level:
        query = query.filter(Contract.overall_risk == risk_level)
    if search:
        query = query.filter(
            or_(
                Contract.filename.contains(search),
                Contract.contract_name.contains(search),
                Contract.party_a.contains(search),
                Contract.party_b.contains(search)
            )
        )
    
    return query.count()


def create_contract(db: Session, contract: ContractCreate, created_by: str = None) -> Contract:
    db_contract = Contract(
        **contract.model_dump(),
        created_by=created_by
    )
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    
    add_timeline_event(db, db_contract.id, "contract_created", 
                       json.dumps({"filename": contract.filename}), created_by)
    return db_contract


def update_contract(db: Session, contract_id: int, contract_update: ContractUpdate, updated_by: str = None) -> Optional[Contract]:
    db_contract = get_contract(db, contract_id)
    if not db_contract:
        return None
    
    create_contract_version(db, db_contract, updated_by, "contract_updated")
    
    for key, value in contract_update.model_dump(exclude_unset=True).items():
        setattr(db_contract, key, value)
    
    db.commit()
    db.refresh(db_contract)
    
    add_timeline_event(db, contract_id, "contract_updated",
                       json.dumps(contract_update.model_dump(exclude_unset=True)), updated_by)
    return db_contract


def delete_contract(db: Session, contract_id: int) -> bool:
    db_contract = get_contract(db, contract_id)
    if not db_contract:
        return False
    
    db.delete(db_contract)
    db.commit()
    return True


def create_contract_version(db: Session, contract: Contract, created_by: str, change_log: str):
    last_version = db.query(ContractVersion).filter(
        ContractVersion.contract_id == contract.id
    ).order_by(desc(ContractVersion.version_number)).first()
    
    next_version = 1 if not last_version else last_version.version_number + 1
    
    db_version = ContractVersion(
        contract_id=contract.id,
        version_number=next_version,
        status=contract.status,
        overall_risk=contract.overall_risk,
        created_by=created_by,
        change_log=change_log
    )
    db.add(db_version)
    db.commit()


def get_clause(db: Session, clause_id: int) -> Optional[Clause]:
    return db.query(Clause).filter(Clause.id == clause_id).first()


def get_clauses_by_contract(db: Session, contract_id: int) -> List[Clause]:
    return db.query(Clause).filter(Clause.contract_id == contract_id).all()


def create_clause(db: Session, contract_id: int, clause: ClauseCreate) -> Clause:
    db_clause = Clause(
        contract_id=contract_id,
        **clause.model_dump()
    )
    db.add(db_clause)
    db.commit()
    db.refresh(db_clause)
    
    add_timeline_event(db, contract_id, "clause_added",
                       json.dumps({"clause_id": db_clause.id, "title": clause.clause_title}))
    return db_clause


def update_clause(db: Session, clause_id: int, clause_update: ClauseUpdate, updated_by: str = None) -> Optional[Clause]:
    db_clause = get_clause(db, clause_id)
    if not db_clause:
        return None
    
    if clause_update.revised_text and clause_update.revised_text != db_clause.revised_text:
        create_clause_revision(db, db_clause, clause_update.revised_text, 
                               updated_by, clause_update.revision_note if hasattr(clause_update, 'revision_note') else None)
    
    for key, value in clause_update.model_dump(exclude_unset=True).items():
        setattr(db_clause, key, value)
    
    if clause_update.is_approved:
        db_clause.approved_by = updated_by
        db_clause.approved_at = datetime.now()
    
    db.commit()
    db.refresh(db_clause)
    
    add_timeline_event(db, db_clause.contract_id, "clause_updated",
                       json.dumps({"clause_id": clause_id}), updated_by)
    return db_clause


def create_clause_revision(db: Session, clause: Clause, new_text: str, revised_by: str, note: str = None):
    last_revision = db.query(ClauseRevision).filter(
        ClauseRevision.clause_id == clause.id
    ).order_by(desc(ClauseRevision.version_number)).first()
    
    next_version = 1 if not last_revision else last_revision.version_number + 1
    
    db_revision = ClauseRevision(
        clause_id=clause.id,
        version_number=next_version,
        text_before=clause.revised_text or clause.extracted_text,
        text_after=new_text,
        revised_by=revised_by,
        revision_note=note
    )
    db.add(db_revision)
    db.commit()


def annotate_risk(db: Session, clause_id: int, risk_level: RiskLevel, risk_reason: str = None, annotated_by: str = None) -> Optional[Clause]:
    db_clause = get_clause(db, clause_id)
    if not db_clause:
        return None
    
    db_clause.risk_level = risk_level
    db_clause.risk_reason = risk_reason
    
    db.commit()
    db.refresh(db_clause)
    
    add_timeline_event(db, db_clause.contract_id, "risk_annotated",
                       json.dumps({"clause_id": clause_id, "risk_level": risk_level.value}), annotated_by)
    return db_clause


def get_clause_type(db: Session, clause_type_id: int) -> Optional[ClauseType]:
    return db.query(ClauseType).filter(ClauseType.id == clause_type_id).first()


def get_clause_types(db: Session, skip: int = 0, limit: int = 100) -> List[ClauseType]:
    return db.query(ClauseType).filter(ClauseType.is_active == True).offset(skip).limit(limit).all()


def create_clause_type(db: Session, clause_type: ClauseTypeCreate) -> ClauseType:
    db_clause_type = ClauseType(**clause_type.model_dump())
    db.add(db_clause_type)
    db.commit()
    db.refresh(db_clause_type)
    return db_clause_type


def add_timeline_event(db: Session, contract_id: int, event_type: str, event_data: str = None, created_by: str = None):
    db_event = TimelineEvent(
        contract_id=contract_id,
        event_type=event_type,
        event_data=event_data,
        created_by=created_by
    )
    db.add(db_event)
    db.commit()


def update_contract_status(db: Session, contract_id: int, status: ContractStatus, note: str = None, updated_by: str = None) -> Optional[Contract]:
    db_contract = get_contract(db, contract_id)
    if not db_contract:
        return None
    
    create_contract_version(db, db_contract, updated_by, f"status_changed_to_{status.value}")
    
    db_contract.status = status
    db.commit()
    db.refresh(db_contract)
    
    add_timeline_event(db, contract_id, "status_changed",
                       json.dumps({"status": status.value, "note": note}), updated_by)
    return db_contract


def retry_extraction(db: Session, contract_id: int) -> Optional[Contract]:
    db_contract = get_contract(db, contract_id)
    if not db_contract:
        return None
    
    db_contract.retry_count += 1
    db_contract.status = ContractStatus.EXTRACTING
    db_contract.error_message = None
    db.commit()
    db.refresh(db_contract)
    
    add_timeline_event(db, contract_id, "extraction_retried",
                       json.dumps({"retry_count": db_contract.retry_count}))
    return db_contract


def generate_request_hash(request_data: dict) -> str:
    data_str = json.dumps(request_data, sort_keys=True)
    return hashlib.md5(data_str.encode()).hexdigest()


class RequestDeduplicator:
    def __init__(self):
        self._processed_requests = {}
    
    def is_duplicate(self, request_hash: str, ttl_seconds: int = 300) -> bool:
        current_time = datetime.now().timestamp()
        
        if request_hash in self._processed_requests:
            timestamp = self._processed_requests[request_hash]
            if current_time - timestamp < ttl_seconds:
                return True
        
        self._processed_requests[request_hash] = current_time
        return False
    
    def cleanup_old_entries(self, ttl_seconds: int = 300):
        current_time = datetime.now().timestamp()
        to_remove = [h for h, ts in self._processed_requests.items() 
                     if current_time - ts > ttl_seconds]
        for h in to_remove:
            del self._processed_requests[h]


request_deduplicator = RequestDeduplicator()
