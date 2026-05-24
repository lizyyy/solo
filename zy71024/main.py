from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import json
import csv
from io import StringIO
from fastapi.responses import StreamingResponse

SQLALCHEMY_DATABASE_URL = "sqlite:///./visitor_system.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class CertificateStatus(str, Enum):
    ACTIVE = "active"
    REVOKED = "revoked"
    EXPIRED = "expired"
    USED = "used"


class RevokeReason(str, Enum):
    MEETING_CANCELLED = "meeting_cancelled"
    BLACKLIST_HIT = "blacklist_hit"
    TIMEOUT = "timeout"
    MANUAL_REVOKE = "manual_revoke"


class AccessEventType(str, Enum):
    ENTRY = "entry"
    EXIT = "exit"
    DENIED = "denied"


class Visitor(Base):
    __tablename__ = "visitors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    id_card = Column(String, unique=True, index=True)
    phone = Column(String)
    company = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    certificates = relationship("VisitorCertificate", back_populates="visitor")


class Meeting(Base):
    __tablename__ = "meetings"
    id = Column(Integer, primary_key=True, index=True)
    meeting_code = Column(String, unique=True, index=True)
    title = Column(String)
    organizer = Column(String)
    location = Column(String)
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="scheduled")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    certificates = relationship("VisitorCertificate", back_populates="meeting")


class VisitorCertificate(Base):
    __tablename__ = "visitor_certificates"
    id = Column(Integer, primary_key=True, index=True)
    certificate_number = Column(String, unique=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"))
    meeting_id = Column(Integer, ForeignKey("meetings.id"))
    status = Column(String, default=CertificateStatus.ACTIVE)
    valid_from = Column(DateTime)
    valid_to = Column(DateTime)
    issued_by = Column(String)
    issued_at = Column(DateTime, default=datetime.utcnow)
    access_zone = Column(String)
    revoked_at = Column(DateTime, nullable=True)
    revoke_reason = Column(String, nullable=True)
    revoked_by = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    visitor = relationship("Visitor", back_populates="certificates")
    meeting = relationship("Meeting", back_populates="certificates")
    access_events = relationship("AccessEvent", back_populates="certificate")
    revoke_reports = relationship("RevokeReport", back_populates="certificate")


class AccessEvent(Base):
    __tablename__ = "access_events"
    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String, unique=True, index=True)
    certificate_id = Column(Integer, ForeignKey("visitor_certificates.id"))
    event_type = Column(String)
    access_point = Column(String)
    event_time = Column(DateTime)
    processed = Column(Boolean, default=False)
    merged_into = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    certificate = relationship("VisitorCertificate", back_populates="access_events")


class Blacklist(Base):
    __tablename__ = "blacklist"
    id = Column(Integer, primary_key=True, index=True)
    visitor_id = Column(Integer, ForeignKey("visitors.id"), nullable=True)
    id_card = Column(String, unique=True, index=True)
    reason = Column(String)
    added_by = Column(String)
    added_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    expires_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class RevokeReport(Base):
    __tablename__ = "revoke_reports"
    id = Column(Integer, primary_key=True, index=True)
    report_id = Column(String, unique=True, index=True)
    certificate_id = Column(Integer, ForeignKey("visitor_certificates.id"))
    revoke_reason = Column(String)
    source = Column(String)
    process_details = Column(Text)
    final_decision = Column(String)
    processed_by = Column(String)
    processed_at = Column(DateTime, default=datetime.utcnow)
    created_at = Column(DateTime, default=datetime.utcnow)
    certificate = relationship("VisitorCertificate", back_populates="revoke_reports")


Base.metadata.create_all(bind=engine)


class VisitorCreate(BaseModel):
    name: str
    id_card: str
    phone: Optional[str] = None
    company: Optional[str] = None


class MeetingCreate(BaseModel):
    meeting_code: str
    title: str
    organizer: str
    location: str
    start_time: datetime
    end_time: datetime


class CertificateCreate(BaseModel):
    visitor_id: int
    meeting_id: Optional[int] = None
    valid_from: datetime
    valid_to: datetime
    issued_by: str
    access_zone: Optional[str] = None


class CertificateVerify(BaseModel):
    certificate_number: str
    access_point: Optional[str] = None


class AccessEventCreate(BaseModel):
    event_id: str
    certificate_number: str
    event_type: AccessEventType
    access_point: str
    event_time: datetime


class CertificateRevoke(BaseModel):
    certificate_number: str
    reason: RevokeReason
    processed_by: str
    source: str
    process_details: Optional[str] = None


class CertificateReissue(BaseModel):
    old_certificate_number: str
    valid_from: datetime
    valid_to: datetime
    issued_by: str
    access_zone: Optional[str] = None


class BlacklistCreate(BaseModel):
    id_card: str
    visitor_id: Optional[int] = None
    reason: str
    added_by: str
    expires_at: Optional[datetime] = None


app = FastAPI(title="楼宇访客证撤销 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def generate_certificate_number():
    return f"VC{datetime.now().strftime('%Y%m%d%H%M%S')}{datetime.now().microsecond}"


def generate_report_id():
    return f"RR{datetime.now().strftime('%Y%m%d%H%M%S')}{datetime.now().microsecond}"


def is_blacklisted(db: Session, id_card: str) -> bool:
    blacklist = db.query(Blacklist).filter(
        Blacklist.id_card == id_card,
        Blacklist.is_active == True,
        (Blacklist.expires_at == None) | (Blacklist.expires_at > datetime.utcnow())
    ).first()
    return blacklist is not None


def check_meeting_status(db: Session, meeting_id: int) -> str:
    meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
    if meeting:
        return meeting.status
    return "unknown"


@app.post("/visitors/", response_model=Dict[str, Any])
def create_visitor(visitor: VisitorCreate, db: Session = Depends(get_db)):
    db_visitor = db.query(Visitor).filter(Visitor.id_card == visitor.id_card).first()
    if db_visitor:
        return {"id": db_visitor.id, "name": db_visitor.name, "message": "访客已存在"}
    db_visitor = Visitor(**visitor.dict())
    db.add(db_visitor)
    db.commit()
    db.refresh(db_visitor)
    return {"id": db_visitor.id, "name": db_visitor.name, "message": "访客创建成功"}


@app.post("/meetings/", response_model=Dict[str, Any])
def create_meeting(meeting: MeetingCreate, db: Session = Depends(get_db)):
    db_meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting.meeting_code).first()
    if db_meeting:
        return {"id": db_meeting.id, "meeting_code": db_meeting.meeting_code, "message": "会议已存在"}
    db_meeting = Meeting(**meeting.dict())
    db.add(db_meeting)
    db.commit()
    db.refresh(db_meeting)
    return {"id": db_meeting.id, "meeting_code": db_meeting.meeting_code, "message": "会议创建成功"}


@app.put("/meetings/{meeting_code}/cancel")
def cancel_meeting(meeting_code: str, processed_by: str, db: Session = Depends(get_db)):
    meeting = db.query(Meeting).filter(Meeting.meeting_code == meeting_code).first()
    if not meeting:
        raise HTTPException(status_code=404, detail="会议不存在")
    meeting.status = "cancelled"
    meeting.updated_at = datetime.utcnow()
    db.commit()
    certificates = db.query(VisitorCertificate).filter(
        VisitorCertificate.meeting_id == meeting.id,
        VisitorCertificate.status == CertificateStatus.ACTIVE
    ).all()
    results = []
    for cert in certificates:
        process_details = f"会议取消触发撤销，会议编号: {meeting_code}, 会议标题: {meeting.title}"
        result = revoke_certificate_internal(
            db, cert.certificate_number, RevokeReason.MEETING_CANCELLED,
            processed_by, "meeting_system", process_details
        )
        results.append(result)
    db.commit()
    return {"message": "会议已取消，关联证件已撤销", "revoked_count": len(results), "details": results}


def revoke_certificate_internal(db: Session, certificate_number: str, reason: RevokeReason,
                                 processed_by: str, source: str, process_details: str = None):
    certificate = db.query(VisitorCertificate).filter(
        VisitorCertificate.certificate_number == certificate_number
    ).first()
    if not certificate:
        return {"success": False, "message": "证件不存在"}
    if certificate.status != CertificateStatus.ACTIVE:
        return {"success": False, "message": f"证件状态为{certificate.status}，无需撤销"}
    certificate.status = CertificateStatus.REVOKED
    certificate.revoked_at = datetime.utcnow()
    certificate.revoke_reason = reason.value
    certificate.revoked_by = processed_by
    report = RevokeReport(
        report_id=generate_report_id(),
        certificate_id=certificate.id,
        revoke_reason=reason.value,
        source=source,
        process_details=process_details or f"证件于{certificate.revoked_at}被撤销",
        final_decision=f"已撤销，原因: {reason.value}",
        processed_by=processed_by
    )
    db.add(report)
    return {"success": True, "certificate_number": certificate_number, "message": "撤销成功"}


@app.post("/certificates/", response_model=Dict[str, Any])
def create_certificate(cert: CertificateCreate, db: Session = Depends(get_db)):
    visitor = db.query(Visitor).filter(Visitor.id == cert.visitor_id).first()
    if not visitor:
        raise HTTPException(status_code=404, detail="访客不存在")
    if is_blacklisted(db, visitor.id_card):
        raise HTTPException(status_code=403, detail="访客在黑名单中，无法发证")
    if cert.meeting_id:
        meeting_status = check_meeting_status(db, cert.meeting_id)
        if meeting_status == "cancelled":
            raise HTTPException(status_code=400, detail="关联会议已取消，无法发证")
    certificate_number = generate_certificate_number()
    db_cert = VisitorCertificate(
        certificate_number=certificate_number,
        visitor_id=cert.visitor_id,
        meeting_id=cert.meeting_id,
        valid_from=cert.valid_from,
        valid_to=cert.valid_to,
        issued_by=cert.issued_by,
        access_zone=cert.access_zone
    )
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return {
        "certificate_number": certificate_number,
        "status": db_cert.status,
        "valid_from": db_cert.valid_from,
        "valid_to": db_cert.valid_to,
        "message": "临时证创建成功"
    }


@app.post("/certificates/verify", response_model=Dict[str, Any])
def verify_certificate(verify: CertificateVerify, db: Session = Depends(get_db)):
    certificate = db.query(VisitorCertificate).filter(
        VisitorCertificate.certificate_number == verify.certificate_number
    ).first()
    if not certificate:
        return {"valid": False, "reason": "certificate_not_found", "message": "证件不存在"}
    visitor = certificate.visitor
    if is_blacklisted(db, visitor.id_card):
        process_details = f"校验时命中黑名单，身份证号: {visitor.id_card}"
        revoke_certificate_internal(
            db, certificate.certificate_number, RevokeReason.BLACKLIST_HIT,
            "auto_system", "blacklist_check", process_details
        )
        db.commit()
        return {"valid": False, "reason": "blacklist_hit", "message": "黑名单命中，证件已撤销"}
    now = datetime.utcnow()
    if now < certificate.valid_from or now > certificate.valid_to:
        return {"valid": False, "reason": "expired", "message": "证件不在有效期内"}
    if certificate.status != CertificateStatus.ACTIVE:
        return {"valid": False, "reason": certificate.status, "message": f"证件状态: {certificate.status}"}
    if certificate.meeting_id:
        meeting_status = check_meeting_status(db, certificate.meeting_id)
        if meeting_status == "cancelled":
            process_details = f"校验时发现关联会议已取消，会议ID: {certificate.meeting_id}"
            revoke_certificate_internal(
                db, certificate.certificate_number, RevokeReason.MEETING_CANCELLED,
                "auto_system", "meeting_check", process_details
            )
            db.commit()
            return {"valid": False, "reason": "meeting_cancelled", "message": "关联会议已取消，证件已撤销"}
    return {
        "valid": True,
        "certificate_number": certificate.certificate_number,
        "visitor_name": visitor.name,
        "access_zone": certificate.access_zone,
        "message": "证件校验通过"
    }


@app.post("/access/events/", response_model=Dict[str, Any])
def create_access_event(event: AccessEventCreate, db: Session = Depends(get_db)):
    existing = db.query(AccessEvent).filter(AccessEvent.event_id == event.event_id).first()
    if existing:
        return {"event_id": event.event_id, "message": "事件已存在，跳过处理", "duplicate": True}
    certificate = db.query(VisitorCertificate).filter(
        VisitorCertificate.certificate_number == event.certificate_number
    ).first()
    if not certificate:
        return {"event_id": event.event_id, "processed": False, "message": "证件不存在"}
    same_event = db.query(AccessEvent).filter(
        AccessEvent.certificate_id == certificate.id,
        AccessEvent.event_type == event.event_type,
        AccessEvent.access_point == event.access_point,
        AccessEvent.event_time >= (event.event_time - timedelta(minutes=5))
    ).first()
    if same_event:
        db_event = AccessEvent(
            event_id=event.event_id,
            certificate_id=certificate.id,
            event_type=event.event_type,
            access_point=event.access_point,
            event_time=event.event_time,
            processed=True,
            merged_into=same_event.id
        )
        db.add(db_event)
        db.commit()
        return {"event_id": event.event_id, "processed": True, "merged": True, "message": "重复事件已合并"}
    db_event = AccessEvent(
        event_id=event.event_id,
        certificate_id=certificate.id,
        event_type=event.event_type,
        access_point=event.access_point,
        event_time=event.event_time,
        processed=True
    )
    db.add(db_event)
    if event.event_type == AccessEventType.EXIT:
        if certificate.status == CertificateStatus.ACTIVE:
            certificate.status = CertificateStatus.USED
            certificate.updated_at = datetime.utcnow()
    db.commit()
    return {"event_id": event.event_id, "processed": True, "message": "门禁事件已处理"}


@app.post("/certificates/revoke", response_model=Dict[str, Any])
def revoke_certificate(revoke: CertificateRevoke, db: Session = Depends(get_db)):
    result = revoke_certificate_internal(
        db, revoke.certificate_number, revoke.reason,
        revoke.processed_by, revoke.source, revoke.process_details
    )
    db.commit()
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/certificates/reissue", response_model=Dict[str, Any])
def reissue_certificate(reissue: CertificateReissue, db: Session = Depends(get_db)):
    old_cert = db.query(VisitorCertificate).filter(
        VisitorCertificate.certificate_number == reissue.old_certificate_number
    ).first()
    if not old_cert:
        raise HTTPException(status_code=404, detail="原证件不存在")
    visitor = old_cert.visitor
    if is_blacklisted(db, visitor.id_card):
        raise HTTPException(status_code=403, detail="访客在黑名单中，无法补证")
    if old_cert.status != CertificateStatus.REVOKED:
        raise HTTPException(status_code=400, detail="原证件未被撤销，无需补证")
    new_cert_number = generate_certificate_number()
    new_cert = VisitorCertificate(
        certificate_number=new_cert_number,
        visitor_id=old_cert.visitor_id,
        meeting_id=old_cert.meeting_id,
        valid_from=reissue.valid_from,
        valid_to=reissue.valid_to,
        issued_by=reissue.issued_by,
        access_zone=reissue.access_zone or old_cert.access_zone
    )
    db.add(new_cert)
    db.commit()
    db.refresh(new_cert)
    return {
        "old_certificate_number": reissue.old_certificate_number,
        "new_certificate_number": new_cert_number,
        "status": new_cert.status,
        "message": "补证成功"
    }


@app.post("/blacklist/", response_model=Dict[str, Any])
def add_blacklist(blacklist: BlacklistCreate, db: Session = Depends(get_db)):
    existing = db.query(Blacklist).filter(Blacklist.id_card == blacklist.id_card, Blacklist.is_active == True).first()
    if existing:
        return {"success": False, "message": "该人员已在黑名单中"}
    db_blacklist = Blacklist(**blacklist.dict())
    db.add(db_blacklist)
    db.commit()
    active_certs = db.query(VisitorCertificate).join(Visitor).filter(
        Visitor.id_card == blacklist.id_card,
        VisitorCertificate.status == CertificateStatus.ACTIVE
    ).all()
    results = []
    for cert in active_certs:
        process_details = f"黑名单新增触发撤销，身份证号: {blacklist.id_card}, 原因: {blacklist.reason}"
        result = revoke_certificate_internal(
            db, cert.certificate_number, RevokeReason.BLACKLIST_HIT,
            blacklist.added_by, "blacklist_system", process_details
        )
        results.append(result)
    db.commit()
    return {
        "success": True,
        "message": "已加入黑名单",
        "revoked_certificates": results
    }


@app.get("/certificates/{certificate_number}/review", response_model=Dict[str, Any])
def review_certificate(certificate_number: str, db: Session = Depends(get_db)):
    certificate = db.query(VisitorCertificate).filter(
        VisitorCertificate.certificate_number == certificate_number
    ).first()
    if not certificate:
        raise HTTPException(status_code=404, detail="证件不存在")
    visitor = certificate.visitor
    meeting = certificate.meeting
    access_events = db.query(AccessEvent).filter(AccessEvent.certificate_id == certificate.id).all()
    revoke_reports = db.query(RevokeReport).filter(RevokeReport.certificate_id == certificate.id).all()
    return {
        "certificate": {
            "certificate_number": certificate.certificate_number,
            "status": certificate.status,
            "valid_from": certificate.valid_from,
            "valid_to": certificate.valid_to,
            "issued_by": certificate.issued_by,
            "revoke_reason": certificate.revoke_reason,
            "revoked_at": certificate.revoked_at
        },
        "visitor": {
            "name": visitor.name,
            "id_card": visitor.id_card,
            "phone": visitor.phone,
            "company": visitor.company
        },
        "meeting": {
            "meeting_code": meeting.meeting_code if meeting else None,
            "title": meeting.title if meeting else None,
            "status": meeting.status if meeting else None
        } if meeting else None,
        "access_events": [
            {
                "event_id": e.event_id,
                "event_type": e.event_type,
                "access_point": e.access_point,
                "event_time": e.event_time
            } for e in access_events
        ],
        "revoke_reports": [
            {
                "report_id": r.report_id,
                "revoke_reason": r.revoke_reason,
                "source": r.source,
                "process_details": r.process_details,
                "final_decision": r.final_decision,
                "processed_by": r.processed_by,
                "processed_at": r.processed_at
            } for r in revoke_reports
        ]
    }


@app.get("/reports/export")
def export_reports(start_date: Optional[datetime] = None, end_date: Optional[datetime] = None,
                   format: str = "csv", db: Session = Depends(get_db)):
    query = db.query(RevokeReport).join(VisitorCertificate).join(Visitor)
    if start_date:
        query = query.filter(RevokeReport.processed_at >= start_date)
    if end_date:
        query = query.filter(RevokeReport.processed_at <= end_date)
    reports = query.all()
    if format == "csv":
        output = StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "报告编号", "证件编号", "访客姓名", "身份证号", "撤销原因",
            "来源系统", "处理详情", "最终结论", "处理人", "处理时间"
        ])
        for r in reports:
            cert = r.certificate
            visitor = cert.visitor
            writer.writerow([
                r.report_id, cert.certificate_number, visitor.name, visitor.id_card,
                r.revoke_reason, r.source, r.process_details, r.final_decision,
                r.processed_by, r.processed_at
            ])
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=revoke_reports_{datetime.now().strftime('%Y%m%d')}.csv"}
        )
    else:
        return {
            "reports": [
                {
                    "report_id": r.report_id,
                    "certificate_number": r.certificate.certificate_number,
                    "visitor_name": r.certificate.visitor.name,
                    "id_card": r.certificate.visitor.id_card,
                    "revoke_reason": r.revoke_reason,
                    "source": r.source,
                    "process_details": r.process_details,
                    "final_decision": r.final_decision,
                    "processed_by": r.processed_by,
                    "processed_at": r.processed_at
                } for r in reports
            ]
        }


@app.post("/system/timeout-check")
def timeout_check(processed_by: str = "auto_system", db: Session = Depends(get_db)):
    now = datetime.utcnow()
    expired_certs = db.query(VisitorCertificate).filter(
        VisitorCertificate.status == CertificateStatus.ACTIVE,
        VisitorCertificate.valid_to < now
    ).all()
    results = []
    for cert in expired_certs:
        process_details = f"超时未离场自动撤销，有效期至: {cert.valid_to}, 当前时间: {now}"
        result = revoke_certificate_internal(
            db, cert.certificate_number, RevokeReason.TIMEOUT,
            processed_by, "timeout_monitor", process_details
        )
        results.append(result)
    db.commit()
    return {"message": "超时检查完成", "revoked_count": len(results), "details": results}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
