from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy import create_engine, Column, String, Integer, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from typing import List, Optional
from pydantic import BaseModel
import json
from enum import Enum

DATABASE_URL = "sqlite:///./evidence.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class BorrowStatus(str, Enum):
    DRAFT = "draft"
    PENDING_REVIEW = "pending_review"
    APPROVED = "approved"
    LENT = "lent"
    RETURNED = "returned"
    REJECTED = "rejected"
    WITHDRAWN = "withdrawn"
    OVERDUE = "overdue"


class SealStatus(str, Enum):
    INTACT = "intact"
    DAMAGED = "damaged"
    MISSING = "missing"
    UNVERIFIED = "unverified"


class Evidence(Base):
    __tablename__ = "evidences"
    id = Column(String, primary_key=True)
    case_number = Column(String, nullable=False)
    description = Column(String)
    current_status = Column(String, default="in_storage")
    seal_status = Column(String, default=SealStatus.INTACT)
    created_at = Column(DateTime, default=datetime.utcnow)


class BorrowRecord(Base):
    __tablename__ = "borrow_records"
    id = Column(String, primary_key=True)
    batch_id = Column(String, index=True)
    evidence_id = Column(String, ForeignKey("evidences.id"))
    case_number = Column(String, nullable=False)
    borrower = Column(String, nullable=False)
    borrower_dept = Column(String)
    purpose = Column(String)
    expected_return_date = Column(DateTime)
    actual_return_date = Column(DateTime)
    status = Column(String, default=BorrowStatus.DRAFT)
    seal_status_checkout = Column(String, default=SealStatus.UNVERIFIED)
    seal_status_return = Column(String, default=SealStatus.UNVERIFIED)
    assistant_verified = Column(Boolean, default=False)
    assistant_verified_by = Column(String)
    assistant_verified_at = Column(DateTime)
    keeper_verified = Column(Boolean, default=False)
    keeper_verified_by = Column(String)
    keeper_verified_at = Column(DateTime)
    seal_checker_verified = Column(Boolean, default=False)
    seal_checker_verified_by = Column(String)
    seal_checker_verified_at = Column(DateTime)
    reject_reason = Column(Text)
    previous_reject_reason = Column(Text)
    correction_note = Column(Text)
    report_content = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    evidence = relationship("Evidence")
    audit_logs = relationship("AuditLog", back_populates="borrow_record")


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    borrow_record_id = Column(String, ForeignKey("borrow_records.id"))
    action = Column(String, nullable=False)
    operator = Column(String, nullable=False)
    operator_role = Column(String)
    remark = Column(Text)
    old_status = Column(String)
    new_status = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    borrow_record = relationship("BorrowRecord", back_populates="audit_logs")


Base.metadata.create_all(bind=engine)


class EvidenceSchema(BaseModel):
    id: str
    case_number: str
    description: Optional[str]
    current_status: str
    seal_status: str

    class Config:
        from_attributes = True


class BorrowRecordCreate(BaseModel):
    batch_id: Optional[str] = None
    evidence_id: str
    case_number: str
    borrower: str
    borrower_dept: Optional[str] = None
    purpose: Optional[str] = None
    expected_return_days: int = 7


class BorrowRecordSchema(BaseModel):
    id: str
    batch_id: Optional[str]
    evidence_id: str
    case_number: str
    borrower: str
    borrower_dept: Optional[str]
    purpose: Optional[str]
    expected_return_date: Optional[datetime]
    actual_return_date: Optional[datetime]
    status: str
    seal_status_checkout: str
    seal_status_return: str
    assistant_verified: bool
    assistant_verified_by: Optional[str]
    assistant_verified_at: Optional[datetime]
    keeper_verified: bool
    keeper_verified_by: Optional[str]
    keeper_verified_at: Optional[datetime]
    seal_checker_verified: bool
    seal_checker_verified_by: Optional[str]
    seal_checker_verified_at: Optional[datetime]
    reject_reason: Optional[str]
    previous_reject_reason: Optional[str]
    correction_note: Optional[str]
    report_content: Optional[str]
    is_overdue: bool = False
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AuditLogSchema(BaseModel):
    id: int
    action: str
    operator: str
    operator_role: Optional[str]
    remark: Optional[str]
    old_status: Optional[str]
    new_status: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class VerificationRequest(BaseModel):
    operator: str
    seal_status: Optional[str]
    remark: Optional[str]


class RejectRequest(BaseModel):
    operator: str
    reason: str


class CorrectionRequest(BaseModel):
    operator: str
    borrower: Optional[str]
    expected_return_days: Optional[int]
    correction_note: str


class ConfirmReturnRequest(BaseModel):
    operator: str
    seal_status: str
    remark: Optional[str]


app = FastAPI(title="法院物证借阅 API", description="法院庭审前物证借阅管理系统")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_id(prefix: str) -> str:
    return f"{prefix}{datetime.utcnow().strftime('%Y%m%d%H%M%S')}{datetime.utcnow().microsecond % 1000:03d}"


def add_audit_log(db: Session, borrow_record_id: str, action: str, operator: str,
                  operator_role: str = None, remark: str = None, old_status: str = None, new_status: str = None):
    log = AuditLog(
        borrow_record_id=borrow_record_id,
        action=action,
        operator=operator,
        operator_role=operator_role,
        remark=remark,
        old_status=old_status,
        new_status=new_status
    )
    db.add(log)
    db.commit()


def check_overdue(record: BorrowRecord) -> bool:
    if record.status == BorrowStatus.LENT and record.expected_return_date:
        return datetime.utcnow() > record.expected_return_date
    return False


def check_conflict(db: Session, evidence_id: str, exclude_record_id: str = None) -> bool:
    query = db.query(BorrowRecord).filter(
        BorrowRecord.evidence_id == evidence_id,
        BorrowRecord.status.in_([BorrowStatus.LENT, BorrowStatus.PENDING_REVIEW, BorrowStatus.APPROVED])
    )
    if exclude_record_id:
        query = query.filter(BorrowRecord.id != exclude_record_id)
    return query.first() is not None


@app.post("/evidences", response_model=EvidenceSchema, tags=["物证管理"])
def create_evidence(evidence: EvidenceSchema, db: Session = Depends(get_db)):
    db_evidence = Evidence(**evidence.dict())
    db.add(db_evidence)
    db.commit()
    db.refresh(db_evidence)
    return db_evidence


@app.get("/evidences", response_model=List[EvidenceSchema], tags=["物证管理"])
def list_evidences(case_number: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Evidence)
    if case_number:
        query = query.filter(Evidence.case_number == case_number)
    return query.all()


@app.post("/borrow", response_model=BorrowRecordSchema, tags=["借阅管理"])
def create_borrow_record(record: BorrowRecordCreate, db: Session = Depends(get_db)):
    evidence = db.query(Evidence).filter(Evidence.id == record.evidence_id).first()
    if not evidence:
        raise HTTPException(status_code=404, detail="物证不存在")
    
    if check_conflict(db, record.evidence_id):
        raise HTTPException(status_code=400, detail="该物证已有进行中的借阅申请")
    
    borrow_id = generate_id("BR")
    expected_return = datetime.utcnow() + timedelta(days=record.expected_return_days)
    
    db_record = BorrowRecord(
        id=borrow_id,
        batch_id=record.batch_id or generate_id("BATCH"),
        evidence_id=record.evidence_id,
        case_number=record.case_number,
        borrower=record.borrower,
        borrower_dept=record.borrower_dept,
        purpose=record.purpose,
        expected_return_date=expected_return,
        status=BorrowStatus.DRAFT
    )
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    
    add_audit_log(db, borrow_id, "创建借阅申请", record.borrower, "borrower", 
                  f"创建借阅申请，物证编号: {record.evidence_id}")
    
    return db_record


@app.post("/borrow/{record_id}/submit", response_model=BorrowRecordSchema, tags=["借阅管理"])
def submit_for_review(record_id: str, operator: str, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status not in [BorrowStatus.DRAFT, BorrowStatus.REJECTED]:
        raise HTTPException(status_code=400, detail="当前状态无法提交审核")
    
    if check_conflict(db, record.evidence_id, record_id):
        raise HTTPException(status_code=400, detail="该物证已有进行中的借阅申请")
    
    old_status = record.status
    if record.status == BorrowStatus.REJECTED:
        record.previous_reject_reason = record.reject_reason
        record.reject_reason = None
    
    record.status = BorrowStatus.PENDING_REVIEW
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "提交审核", operator, "borrower", 
                  f"提交审核，从 {old_status} 变为 {BorrowStatus.PENDING_REVIEW}",
                  old_status, BorrowStatus.PENDING_REVIEW)
    
    return record


@app.post("/borrow/{record_id}/assistant-verify", response_model=BorrowRecordSchema, tags=["核验流程"])
def assistant_verify(record_id: str, req: VerificationRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态无法进行法官助理核验")
    
    record.assistant_verified = True
    record.assistant_verified_by = req.operator
    record.assistant_verified_at = datetime.utcnow()
    
    if all([record.assistant_verified, record.keeper_verified, record.seal_checker_verified]):
        record.status = BorrowStatus.APPROVED
        new_status = BorrowStatus.APPROVED
    else:
        new_status = record.status
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "法官助理核验", req.operator, "assistant", 
                  req.remark or "核验通过", record.status, new_status)
    
    return record


@app.post("/borrow/{record_id}/keeper-verify", response_model=BorrowRecordSchema, tags=["核验流程"])
def keeper_verify(record_id: str, req: VerificationRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态无法进行库管核验")
    
    record.keeper_verified = True
    record.keeper_verified_by = req.operator
    record.keeper_verified_at = datetime.utcnow()
    
    if all([record.assistant_verified, record.keeper_verified, record.seal_checker_verified]):
        record.status = BorrowStatus.APPROVED
        new_status = BorrowStatus.APPROVED
    else:
        new_status = record.status
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "库管核验", req.operator, "keeper", 
                  req.remark or "核验通过", record.status, new_status)
    
    return record


@app.post("/borrow/{record_id}/seal-verify", response_model=BorrowRecordSchema, tags=["核验流程"])
def seal_verify(record_id: str, req: VerificationRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态无法进行封条核验")
    
    if req.seal_status and req.seal_status not in [SealStatus.INTACT, SealStatus.DAMAGED, SealStatus.MISSING]:
        raise HTTPException(status_code=400, detail="无效的封条状态")
    
    if req.seal_status and req.seal_status != SealStatus.INTACT:
        add_audit_log(db, record_id, "封条异常", req.operator, "seal_checker", 
                      f"封条状态: {req.seal_status}, 备注: {req.remark or '无'}")
        raise HTTPException(status_code=400, detail=f"封条异常: {req.seal_status}，无法借出")
    
    record.seal_checker_verified = True
    record.seal_checker_verified_by = req.operator
    record.seal_checker_verified_at = datetime.utcnow()
    record.seal_status_checkout = req.seal_status or SealStatus.INTACT
    
    if all([record.assistant_verified, record.keeper_verified, record.seal_checker_verified]):
        record.status = BorrowStatus.APPROVED
        new_status = BorrowStatus.APPROVED
    else:
        new_status = record.status
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "封条核验通过", req.operator, "seal_checker", 
                  req.remark or f"封条状态: {record.seal_status_checkout}", 
                  record.status, new_status)
    
    return record


@app.post("/borrow/{record_id}/lend", response_model=BorrowRecordSchema, tags=["借阅管理"])
def confirm_lend(record_id: str, operator: str, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.APPROVED:
        raise HTTPException(status_code=400, detail="当前状态无法确认借出")
    
    old_status = record.status
    record.status = BorrowStatus.LENT
    
    evidence = db.query(Evidence).filter(Evidence.id == record.evidence_id).first()
    if evidence:
        evidence.current_status = "lent"
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "确认借出", operator, "keeper", 
                  "物证已借出", old_status, BorrowStatus.LENT)
    
    return record


@app.post("/borrow/{record_id}/reject", response_model=BorrowRecordSchema, tags=["借阅管理"])
def reject_borrow(record_id: str, req: RejectRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.PENDING_REVIEW:
        raise HTTPException(status_code=400, detail="当前状态无法驳回")
    
    old_status = record.status
    record.status = BorrowStatus.REJECTED
    record.reject_reason = req.reason
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "驳回申请", req.operator, "reviewer", 
                  f"驳回原因: {req.reason}", old_status, BorrowStatus.REJECTED)
    
    return record


@app.post("/borrow/{record_id}/withdraw", response_model=BorrowRecordSchema, tags=["借阅管理"])
def withdraw_borrow(record_id: str, operator: str, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status not in [BorrowStatus.DRAFT, BorrowStatus.PENDING_REVIEW]:
        raise HTTPException(status_code=400, detail="当前状态无法撤回")
    
    old_status = record.status
    record.status = BorrowStatus.WITHDRAWN
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "撤回申请", operator, "borrower", 
                  "用户主动撤回申请", old_status, BorrowStatus.WITHDRAWN)
    
    return record


@app.post("/borrow/{record_id}/correct", response_model=BorrowRecordSchema, tags=["借阅管理"])
def correct_record(record_id: str, req: CorrectionRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.REJECTED:
        raise HTTPException(status_code=400, detail="仅被驳回的记录可以修改")
    
    if req.borrower:
        record.borrower = req.borrower
    if req.expected_return_days:
        record.expected_return_date = datetime.utcnow() + timedelta(days=req.expected_return_days)
    
    record.correction_note = req.correction_note
    
    db.commit()
    db.refresh(record)
    
    add_audit_log(db, record_id, "人工修正", req.operator, "admin", 
                  f"修正说明: {req.correction_note}")
    
    return record


@app.post("/borrow/{record_id}/return", response_model=BorrowRecordSchema, tags=["借阅管理"])
def confirm_return(record_id: str, req: ConfirmReturnRequest, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    if record.status != BorrowStatus.LENT:
        raise HTTPException(status_code=400, detail="当前状态无法归还")
    
    if req.seal_status not in [SealStatus.INTACT, SealStatus.DAMAGED, SealStatus.MISSING]:
        raise HTTPException(status_code=400, detail="无效的封条状态")
    
    old_status = record.status
    record.status = BorrowStatus.RETURNED
    record.actual_return_date = datetime.utcnow()
    record.seal_status_return = req.seal_status
    
    evidence = db.query(Evidence).filter(Evidence.id == record.evidence_id).first()
    if evidence:
        evidence.current_status = "in_storage"
        evidence.seal_status = req.seal_status
    
    db.commit()
    db.refresh(record)
    
    seal_remark = f"归还封条状态: {req.seal_status}"
    if req.remark:
        seal_remark += f", 备注: {req.remark}"
    
    add_audit_log(db, record_id, "确认归还", req.operator, "keeper", 
                  seal_remark, old_status, BorrowStatus.RETURNED)
    
    return record


@app.get("/borrow", response_model=List[BorrowRecordSchema], tags=["查询"])
def list_borrow_records(
    status: Optional[str] = None,
    batch_id: Optional[str] = None,
    evidence_id: Optional[str] = None,
    case_number: Optional[str] = None,
    show_overdue_only: bool = False,
    db: Session = Depends(get_db)
):
    query = db.query(BorrowRecord)
    
    if status:
        query = query.filter(BorrowRecord.status == status)
    if batch_id:
        query = query.filter(BorrowRecord.batch_id == batch_id)
    if evidence_id:
        query = query.filter(BorrowRecord.evidence_id == evidence_id)
    if case_number:
        query = query.filter(BorrowRecord.case_number == case_number)
    
    records = query.order_by(BorrowRecord.created_at.desc()).all()
    
    result = []
    for record in records:
        record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        record_dict['is_overdue'] = check_overdue(record)
        if show_overdue_only and not record_dict['is_overdue']:
            continue
        result.append(record_dict)
    
    return result


@app.get("/borrow/{record_id}", tags=["查询"])
def get_borrow_detail(record_id: str, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
    record_dict['is_overdue'] = check_overdue(record)
    
    audit_logs = db.query(AuditLog).filter(
        AuditLog.borrow_record_id == record_id
    ).order_by(AuditLog.created_at.asc()).all()
    
    return {
        "record": record_dict,
        "audit_trail": [
            {
                "id": log.id,
                "action": log.action,
                "operator": log.operator,
                "operator_role": log.operator_role,
                "remark": log.remark,
                "old_status": log.old_status,
                "new_status": log.new_status,
                "created_at": log.created_at
            }
            for log in audit_logs
        ]
    }


@app.get("/borrow/{record_id}/audit", response_model=List[AuditLogSchema], tags=["查询"])
def get_audit_trail(record_id: str, db: Session = Depends(get_db)):
    logs = db.query(AuditLog).filter(
        AuditLog.borrow_record_id == record_id
    ).order_by(AuditLog.created_at.asc()).all()
    return logs


@app.get("/anomalies", tags=["异常管理"])
def get_anomalies(db: Session = Depends(get_db)):
    anomalies = []
    
    overdue_records = db.query(BorrowRecord).filter(
        BorrowRecord.status == BorrowStatus.LENT,
        BorrowRecord.expected_return_date < datetime.utcnow()
    ).all()
    
    for record in overdue_records:
        anomalies.append({
            "type": "overdue",
            "record_id": record.id,
            "evidence_id": record.evidence_id,
            "case_number": record.case_number,
            "borrower": record.borrower,
            "expected_return_date": record.expected_return_date,
            "days_overdue": (datetime.utcnow() - record.expected_return_date).days,
            "description": f"超期未还 { (datetime.utcnow() - record.expected_return_date).days } 天"
        })
    
    seal_issues = db.query(BorrowRecord).filter(
        BorrowRecord.seal_status_return.in_([SealStatus.DAMAGED, SealStatus.MISSING])
    ).all()
    
    for record in seal_issues:
        anomalies.append({
            "type": "seal_issue",
            "record_id": record.id,
            "evidence_id": record.evidence_id,
            "case_number": record.case_number,
            "borrower": record.borrower,
            "seal_status": record.seal_status_return,
            "description": f"归还时封条{record.seal_status_return}"
        })
    
    return {"anomalies": anomalies, "total": len(anomalies)}


@app.get("/export/{record_id}", tags=["导出"])
def export_report(record_id: str, db: Session = Depends(get_db)):
    record = db.query(BorrowRecord).filter(BorrowRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="借阅记录不存在")
    
    audit_logs = db.query(AuditLog).filter(
        AuditLog.borrow_record_id == record_id
    ).order_by(AuditLog.created_at.asc()).all()
    
    report = {
        "report_title": "物证借阅报告",
        "record_id": record.id,
        "batch_id": record.batch_id,
        "evidence_id": record.evidence_id,
        "case_number": record.case_number,
        "borrower": record.borrower,
        "borrower_dept": record.borrower_dept,
        "purpose": record.purpose,
        "status": record.status,
        "is_overdue": check_overdue(record),
        "verification": {
            "assistant": {
                "verified": record.assistant_verified,
                "by": record.assistant_verified_by,
                "at": record.assistant_verified_at
            },
            "keeper": {
                "verified": record.keeper_verified,
                "by": record.keeper_verified_by,
                "at": record.keeper_verified_at
            },
            "seal_checker": {
                "verified": record.seal_checker_verified,
                "by": record.seal_checker_verified_by,
                "at": record.seal_checker_verified_at
            }
        },
        "seal_status": {
            "checkout": record.seal_status_checkout,
            "return": record.seal_status_return
        },
        "dates": {
            "created_at": record.created_at,
            "expected_return": record.expected_return_date,
            "actual_return": record.actual_return_date
        },
        "reject_info": {
            "current_reason": record.reject_reason,
            "previous_reason": record.previous_reject_reason
        },
        "correction_note": record.correction_note,
        "audit_trail": [
            {
                "time": log.created_at,
                "action": log.action,
                "operator": log.operator,
                "role": log.operator_role,
                "remark": log.remark
            }
            for log in audit_logs
        ],
        "generated_at": datetime.utcnow()
    }
    
    return JSONResponse(content=json.loads(json.dumps(report, default=str)))


@app.post("/init-sample-data", tags=["系统"])
def init_sample_data(db: Session = Depends(get_db)):
    sample_evidences = [
        {"id": "WZ2024001", "case_number": "（2024）京民初字第001号", "description": "合同原件一份", "current_status": "in_storage", "seal_status": SealStatus.INTACT},
        {"id": "WZ2024002", "case_number": "（2024）京民初字第001号", "description": "银行转账凭证三张", "current_status": "in_storage", "seal_status": SealStatus.INTACT},
        {"id": "WZ2024003", "case_number": "（2024）京民初字第002号", "description": "物证照片一组", "current_status": "in_storage", "seal_status": SealStatus.INTACT},
        {"id": "WZ2024004", "case_number": "（2024）京民初字第003号", "description": "电子存储介质U盘一个", "current_status": "in_storage", "seal_status": SealStatus.DAMAGED},
    ]
    
    for ev in sample_evidences:
        if not db.query(Evidence).filter(Evidence.id == ev["id"]).first():
            db.add(Evidence(**ev))
    
    db.commit()
    
    batch_id = "BATCH20240524001"
    sample_records = []
    
    record1 = BorrowRecord(
        id="BR20240524001",
        batch_id=batch_id,
        evidence_id="WZ2024001",
        case_number="（2024）京民初字第001号",
        borrower="张明",
        borrower_dept="民事一庭",
        purpose="庭审质证",
        expected_return_date=datetime.utcnow() + timedelta(days=7),
        status=BorrowStatus.LENT,
        seal_status_checkout=SealStatus.INTACT,
        assistant_verified=True,
        assistant_verified_by="李助",
        assistant_verified_at=datetime.utcnow() - timedelta(hours=2),
        keeper_verified=True,
        keeper_verified_by="王库管",
        keeper_verified_at=datetime.utcnow() - timedelta(hours=1.5),
        seal_checker_verified=True,
        seal_checker_verified_by="赵检",
        seal_checker_verified_at=datetime.utcnow() - timedelta(hours=1),
        created_at=datetime.utcnow() - timedelta(hours=3)
    )
    sample_records.append(("正常借出流程-已借出", record1))
    
    record2 = BorrowRecord(
        id="BR20240524002",
        batch_id=batch_id,
        evidence_id="WZ2024002",
        case_number="（2024）京民初字第001号",
        borrower="张明",
        borrower_dept="民事一庭",
        purpose="庭审质证",
        expected_return_date=datetime.utcnow() - timedelta(days=3),
        status=BorrowStatus.LENT,
        seal_status_checkout=SealStatus.INTACT,
        assistant_verified=True,
        assistant_verified_by="李助",
        assistant_verified_at=datetime.utcnow() - timedelta(days=10, hours=2),
        keeper_verified=True,
        keeper_verified_by="王库管",
        keeper_verified_at=datetime.utcnow() - timedelta(days=10, hours=1.5),
        seal_checker_verified=True,
        seal_checker_verified_by="赵检",
        seal_checker_verified_at=datetime.utcnow() - timedelta(days=10, hours=1),
        created_at=datetime.utcnow() - timedelta(days=10, hours=3)
    )
    sample_records.append(("超期未还-异常", record2))
    
    record3 = BorrowRecord(
        id="BR20240524003",
        batch_id="BATCH20240524002",
        evidence_id="WZ2024001",
        case_number="（2024）京民初字第001号",
        borrower="刘华",
        borrower_dept="民事二庭",
        purpose="案卷整理",
        expected_return_date=datetime.utcnow() + timedelta(days=5),
        status=BorrowStatus.REJECTED,
        reject_reason="该物证正在借出中，冲突驳回",
        created_at=datetime.utcnow() - timedelta(hours=1)
    )
    sample_records.append(("冲突驳回-异常", record3))
    
    record4 = BorrowRecord(
        id="BR20240524004",
        batch_id="BATCH20240524003",
        evidence_id="WZ2024003",
        case_number="（2024）京民初字第002号",
        borrower="陈静",
        borrower_dept="执行局",
        purpose="执行核对",
        expected_return_date=datetime.utcnow() + timedelta(days=3),
        status=BorrowStatus.WITHDRAWN,
        assistant_verified=True,
        assistant_verified_by="李助",
        assistant_verified_at=datetime.utcnow() - timedelta(days=1, hours=5),
        created_at=datetime.utcnow() - timedelta(days=1, hours=6)
    )
    sample_records.append(("用户撤回", record4))
    
    record5 = BorrowRecord(
        id="BR20240524005",
        batch_id="BATCH20240524004",
        evidence_id="WZ2024004",
        case_number="（2024）京民初字第003号",
        borrower="周伟",
        borrower_dept="刑事庭",
        expected_return_date=datetime.utcnow() + timedelta(days=14),
        status=BorrowStatus.REJECTED,
        reject_reason="借阅期限过长，请核实用途后重新提交",
        previous_reject_reason="封条破损，需先修复封条",
        correction_note="已修复封条，借阅期限从30天改为14天",
        created_at=datetime.utcnow() - timedelta(days=2)
    )
    sample_records.append(("人工修正-被驳回后修改", record5))
    
    record6 = BorrowRecord(
        id="BR20240524006",
        batch_id="BATCH20240524005",
        evidence_id="WZ2024002",
        case_number="（2024）京民初字第001号",
        borrower="张明",
        borrower_dept="民事一庭",
        purpose="庭审质证",
        expected_return_date=datetime.utcnow() - timedelta(days=10),
        actual_return_date=datetime.utcnow() - timedelta(days=8),
        status=BorrowStatus.RETURNED,
        seal_status_checkout=SealStatus.INTACT,
        seal_status_return=SealStatus.DAMAGED,
        assistant_verified=True,
        assistant_verified_by="李助",
        assistant_verified_at=datetime.utcnow() - timedelta(days=17, hours=2),
        keeper_verified=True,
        keeper_verified_by="王库管",
        keeper_verified_at=datetime.utcnow() - timedelta(days=17, hours=1.5),
        seal_checker_verified=True,
        seal_checker_verified_by="赵检",
        seal_checker_verified_at=datetime.utcnow() - timedelta(days=17, hours=1),
        created_at=datetime.utcnow() - timedelta(days=17, hours=3)
    )
    sample_records.append(("已归还-封条破损异常", record6))
    
    for desc, rec in sample_records:
        if not db.query(BorrowRecord).filter(BorrowRecord.id == rec.id).first():
            db.add(rec)
    
    db.commit()
    
    audit_samples = [
        ("BR20240524001", "创建借阅申请", "张明", "borrower", "创建借阅申请"),
        ("BR20240524001", "提交审核", "张明", "borrower", "提交审核", "draft", "pending_review"),
        ("BR20240524001", "法官助理核验", "李助", "assistant", "核验通过"),
        ("BR20240524001", "库管核验", "王库管", "keeper", "核验通过"),
        ("BR20240524001", "封条核验通过", "赵检", "seal_checker", "封条完好", "pending_review", "approved"),
        ("BR20240524001", "确认借出", "王库管", "keeper", "物证已借出", "approved", "lent"),
        
        ("BR20240524002", "创建借阅申请", "张明", "borrower", "创建借阅申请"),
        ("BR20240524002", "提交审核", "张明", "borrower", "提交审核"),
        ("BR20240524002", "法官助理核验", "李助", "assistant", "核验通过"),
        ("BR20240524002", "库管核验", "王库管", "keeper", "核验通过"),
        ("BR20240524002", "封条核验通过", "赵检", "seal_checker", "封条完好"),
        ("BR20240524002", "确认借出", "王库管", "keeper", "物证已借出", "approved", "lent"),
        
        ("BR20240524003", "创建借阅申请", "刘华", "borrower", "创建借阅申请"),
        ("BR20240524003", "提交审核", "刘华", "borrower", "提交审核"),
        ("BR20240524003", "驳回申请", "系统", "system", "该物证正在借出中，冲突驳回", "pending_review", "rejected"),
        
        ("BR20240524004", "创建借阅申请", "陈静", "borrower", "创建借阅申请"),
        ("BR20240524004", "提交审核", "陈静", "borrower", "提交审核"),
        ("BR20240524004", "法官助理核验", "李助", "assistant", "核验通过"),
        ("BR20240524004", "撤回申请", "陈静", "borrower", "用户主动撤回申请", "pending_review", "withdrawn"),
        
        ("BR20240524005", "创建借阅申请", "周伟", "borrower", "创建借阅申请，借阅期限30天"),
        ("BR20240524005", "提交审核", "周伟", "borrower", "提交审核"),
        ("BR20240524005", "封条异常", "赵检", "seal_checker", "封条破损"),
        ("BR20240524005", "驳回申请", "赵检", "seal_checker", "封条破损，需先修复封条", "pending_review", "rejected"),
        ("BR20240524005", "人工修正", "管理员", "admin", "已修复封条，借阅期限从30天改为14天"),
        ("BR20240524005", "提交审核", "周伟", "borrower", "修正后再次提交"),
        ("BR20240524005", "驳回申请", "李助", "assistant", "借阅期限过长，请核实用途后重新提交", "pending_review", "rejected"),
        
        ("BR20240524006", "创建借阅申请", "张明", "borrower", "创建借阅申请"),
        ("BR20240524006", "提交审核", "张明", "borrower", "提交审核"),
        ("BR20240524006", "确认借出", "王库管", "keeper", "物证已借出"),
        ("BR20240524006", "确认归还", "王库管", "keeper", "归还封条状态: damaged，发现封条破损", "lent", "returned"),
    ]
    
    for sample in audit_samples:
        log = AuditLog(
            borrow_record_id=sample[0],
            action=sample[1],
            operator=sample[2],
            operator_role=sample[3],
            remark=sample[4] if len(sample) > 4 else None,
            old_status=sample[5] if len(sample) > 5 else None,
            new_status=sample[6] if len(sample) > 6 else None,
            created_at=datetime.utcnow() - timedelta(hours=audit_samples.index(sample) * 0.5)
        )
        db.add(log)
    
    db.commit()
    
    return {
        "message": "样例数据初始化成功",
        "evidences_created": len(sample_evidences),
        "records_created": len(sample_records),
        "sample_scenarios": [desc for desc, _ in sample_records]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

