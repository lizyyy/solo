from fastapi import FastAPI, HTTPException, Query, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import create_engine, Column, String, Integer, Float, DateTime, Text, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, Session, relationship
from datetime import datetime, timedelta
from pydantic import BaseModel
from typing import Optional, List
import csv
from io import StringIO

DATABASE_URL = "sqlite:///./equity.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

app = FastAPI(title="权益扣减修正审批余额重算API", version="1.0.0")


class Customer(Base):
    __tablename__ = "customers"
    id = Column(String(50), primary_key=True)
    name = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class EquityPackage(Base):
    __tablename__ = "equity_packages"
    id = Column(String(50), primary_key=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False)
    package_type = Column(String(50), nullable=False)
    total_quota = Column(Float, nullable=False)
    used_quota = Column(Float, default=0.0)
    remaining_quota = Column(Float, nullable=False)
    status = Column(String(20), default="active")
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    customer = relationship("Customer")


class CallEvent(Base):
    __tablename__ = "call_events"
    id = Column(String(50), primary_key=True)
    event_idempotent_key = Column(String(100), unique=True, nullable=False)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False)
    package_id = Column(String(50), ForeignKey("equity_packages.id"))
    api_name = Column(String(100), nullable=False)
    call_time = Column(DateTime, default=datetime.utcnow)
    request_body = Column(Text)
    status = Column(String(20), default="pending")
    error_message = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    customer = relationship("Customer")


class DeductionDetail(Base):
    __tablename__ = "deduction_details"
    id = Column(String(50), primary_key=True)
    event_id = Column(String(50), ForeignKey("call_events.id"), nullable=False)
    package_id = Column(String(50), ForeignKey("equity_packages.id"), nullable=False)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False)
    deduct_amount = Column(Float, nullable=False)
    deduct_reason = Column(String(200), nullable=False)
    deduct_time = Column(DateTime, default=datetime.utcnow)
    is_reversed = Column(Boolean, default=False)
    reversed_by = Column(String(50))
    reversed_time = Column(DateTime)
    reversed_reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    event = relationship("CallEvent")
    package = relationship("EquityPackage")


class CorrectionApplication(Base):
    __tablename__ = "correction_applications"
    id = Column(String(50), primary_key=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False)
    deduction_id = Column(String(50), ForeignKey("deduction_details.id"), nullable=False)
    applicant = Column(String(50), nullable=False)
    apply_reason = Column(Text, nullable=False)
    correction_amount = Column(Float, nullable=False)
    status = Column(String(20), default="pending")
    current_approver = Column(String(50))
    approved_amount = Column(Float)
    final_conclusion = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    customer = relationship("Customer")
    deduction = relationship("DeductionDetail")


class ApprovalRecord(Base):
    __tablename__ = "approval_records"
    id = Column(String(50), primary_key=True)
    application_id = Column(String(50), ForeignKey("correction_applications.id"), nullable=False)
    approver = Column(String(50), nullable=False)
    action = Column(String(20), nullable=False)
    comment = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    application = relationship("CorrectionApplication")


class ReconciliationResult(Base):
    __tablename__ = "reconciliation_results"
    id = Column(String(50), primary_key=True)
    customer_id = Column(String(50), ForeignKey("customers.id"), nullable=False)
    package_id = Column(String(50), ForeignKey("equity_packages.id"), nullable=False)
    reconcile_date = Column(String(20), nullable=False)
    system_total = Column(Float, nullable=False)
    manual_total = Column(Float, nullable=False)
    difference = Column(Float, nullable=False)
    status = Column(String(20), default="pending")
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    customer = relationship("Customer")
    package = relationship("EquityPackage")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class CustomerCreate(BaseModel):
    id: str
    name: str


class PackageCreate(BaseModel):
    id: str
    customer_id: str
    package_type: str
    total_quota: float
    start_time: datetime
    end_time: datetime


class CallEventCreate(BaseModel):
    id: str
    event_idempotent_key: str
    customer_id: str
    package_id: Optional[str] = None
    api_name: str
    request_body: Optional[str] = None


class DeductionCreate(BaseModel):
    id: str
    event_id: str
    package_id: str
    customer_id: str
    deduct_amount: float
    deduct_reason: str


class CorrectionCreate(BaseModel):
    id: str
    customer_id: str
    deduction_id: str
    applicant: str
    apply_reason: str
    correction_amount: float


class ApprovalAction(BaseModel):
    application_id: str
    approver: str
    action: str
    comment: Optional[str] = None


@app.post("/customers/", response_model=dict)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    if db.query(Customer).filter(Customer.id == customer.id).first():
        raise HTTPException(status_code=400, detail="客户已存在")
    db_customer = Customer(id=customer.id, name=customer.name)
    db.add(db_customer)
    db.commit()
    return {"code": 0, "message": "创建成功", "data": {"id": customer.id, "name": customer.name}}


@app.post("/packages/", response_model=dict)
def create_package(pkg: PackageCreate, db: Session = Depends(get_db)):
    if db.query(EquityPackage).filter(EquityPackage.id == pkg.id).first():
        raise HTTPException(status_code=400, detail="权益包已存在")
    db_pkg = EquityPackage(
        id=pkg.id,
        customer_id=pkg.customer_id,
        package_type=pkg.package_type,
        total_quota=pkg.total_quota,
        remaining_quota=pkg.total_quota,
        start_time=pkg.start_time,
        end_time=pkg.end_time
    )
    db.add(db_pkg)
    db.commit()
    return {"code": 0, "message": "创建成功", "data": {"id": pkg.id, "remaining_quota": pkg.total_quota}}


@app.post("/events/deduct", response_model=dict)
def create_deduction(deduct: DeductionCreate, db: Session = Depends(get_db)):
    if db.query(DeductionDetail).filter(DeductionDetail.id == deduct.id).first():
        raise HTTPException(status_code=400, detail="扣减记录已存在")
    
    event = db.query(CallEvent).filter(CallEvent.id == deduct.event_id).first()
    if not event:
        raise HTTPException(status_code=404, detail="调用事件不存在")
    
    pkg = db.query(EquityPackage).filter(EquityPackage.id == deduct.package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="权益包不存在")
    
    if pkg.status != "active":
        raise HTTPException(status_code=400, detail="权益包状态异常")
    
    if pkg.remaining_quota < deduct.deduct_amount:
        raise HTTPException(status_code=400, detail="权益余额不足")
    
    db_deduct = DeductionDetail(
        id=deduct.id,
        event_id=deduct.event_id,
        package_id=deduct.package_id,
        customer_id=deduct.customer_id,
        deduct_amount=deduct.deduct_amount,
        deduct_reason=deduct.deduct_reason
    )
    
    pkg.used_quota += deduct.deduct_amount
    pkg.remaining_quota -= deduct.deduct_amount
    event.status = "success"
    
    db.add(db_deduct)
    db.commit()
    
    return {
        "code": 0,
        "message": "扣减成功",
        "data": {
            "deduction_id": deduct.id,
            "remaining_quota": pkg.remaining_quota,
            "deduct_reason": deduct.deduct_reason
        }
    }


@app.post("/events/", response_model=dict)
def create_event(event: CallEventCreate, db: Session = Depends(get_db)):
    existing = db.query(CallEvent).filter(CallEvent.event_idempotent_key == event.event_idempotent_key).first()
    if existing:
        return {
            "code": 0,
            "message": "事件已存在（幂等）",
            "data": {"event_id": existing.id, "status": existing.status}
        }
    
    db_event = CallEvent(
        id=event.id,
        event_idempotent_key=event.event_idempotent_key,
        customer_id=event.customer_id,
        package_id=event.package_id,
        api_name=event.api_name,
        request_body=event.request_body
    )
    db.add(db_event)
    db.commit()
    return {"code": 0, "message": "事件创建成功", "data": {"event_id": event.id}}


@app.get("/packages/{package_id}", response_model=dict)
def get_package(package_id: str, db: Session = Depends(get_db)):
    pkg = db.query(EquityPackage).filter(EquityPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="权益包不存在")
    
    deductions = db.query(DeductionDetail).filter(
        DeductionDetail.package_id == package_id,
        DeductionDetail.is_reversed == False
    ).all()
    
    return {
        "code": 0,
        "data": {
            "id": pkg.id,
            "customer_id": pkg.customer_id,
            "total_quota": pkg.total_quota,
            "used_quota": pkg.used_quota,
            "remaining_quota": pkg.remaining_quota,
            "status": pkg.status,
            "deductions": [
                {
                    "id": d.id,
                    "event_id": d.event_id,
                    "amount": d.deduct_amount,
                    "reason": d.deduct_reason,
                    "time": d.deduct_time.isoformat()
                } for d in deductions
            ]
        }
    }


@app.post("/corrections/", response_model=dict)
def create_correction(corr: CorrectionCreate, db: Session = Depends(get_db)):
    if db.query(CorrectionApplication).filter(CorrectionApplication.id == corr.id).first():
        raise HTTPException(status_code=400, detail="修正申请已存在")
    
    deduction = db.query(DeductionDetail).filter(DeductionDetail.id == corr.deduction_id).first()
    if not deduction:
        raise HTTPException(status_code=404, detail="扣减记录不存在")
    
    if deduction.is_reversed:
        raise HTTPException(status_code=400, detail="该扣减已被冲正")
    
    db_corr = CorrectionApplication(
        id=corr.id,
        customer_id=corr.customer_id,
        deduction_id=corr.deduction_id,
        applicant=corr.applicant,
        apply_reason=corr.apply_reason,
        correction_amount=corr.correction_amount,
        current_approver="审批人1"
    )
    db.add(db_corr)
    db.commit()
    return {"code": 0, "message": "修正申请创建成功", "data": {"application_id": corr.id, "status": "pending"}}


@app.post("/corrections/approve", response_model=dict)
def approve_correction(approval: ApprovalAction, db: Session = Depends(get_db)):
    app = db.query(CorrectionApplication).filter(CorrectionApplication.id == approval.application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="申请不存在")
    
    if app.status != "pending":
        raise HTTPException(status_code=400, detail=f"申请状态异常: {app.status}")
    
    record = ApprovalRecord(
        id=f"appr_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
        application_id=approval.application_id,
        approver=approval.approver,
        action=approval.action,
        comment=approval.comment
    )
    db.add(record)
    
    if approval.action == "approve":
        app.status = "approved"
        app.approved_amount = app.correction_amount
        app.final_conclusion = approval.comment or "审批通过"
        
        deduction = db.query(DeductionDetail).filter(DeductionDetail.id == app.deduction_id).first()
        pkg = db.query(EquityPackage).filter(EquityPackage.id == deduction.package_id).first()
        
        actual_reverse = min(app.correction_amount, deduction.deduct_amount)
        deduction.is_reversed = True
        deduction.reversed_by = approval.approver
        deduction.reversed_time = datetime.utcnow()
        deduction.reversed_reason = approval.comment or "审批冲正"
        
        pkg.used_quota -= actual_reverse
        pkg.remaining_quota += actual_reverse
        
    elif approval.action == "reject":
        app.status = "rejected"
        app.final_conclusion = approval.comment or "审批拒绝"
    elif approval.action == "close":
        app.status = "closed"
        app.final_conclusion = approval.comment or "申请关闭"
    
    db.commit()
    return {"code": 0, "message": "处理成功", "data": {"application_id": app.id, "status": app.status}}


@app.get("/corrections/{application_id}", response_model=dict)
def get_correction(application_id: str, db: Session = Depends(get_db)):
    app = db.query(CorrectionApplication).filter(CorrectionApplication.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="申请不存在")
    
    records = db.query(ApprovalRecord).filter(ApprovalRecord.application_id == application_id).all()
    
    return {
        "code": 0,
        "data": {
            "id": app.id,
            "customer_id": app.customer_id,
            "deduction_id": app.deduction_id,
            "applicant": app.applicant,
            "apply_reason": app.apply_reason,
            "correction_amount": app.correction_amount,
            "status": app.status,
            "final_conclusion": app.final_conclusion,
            "approval_records": [
                {
                    "approver": r.approver,
                    "action": r.action,
                    "comment": r.comment,
                    "time": r.created_at.isoformat()
                } for r in records
            ]
        }
    }


@app.post("/reconciliations/", response_model=dict)
def create_reconciliation(
    customer_id: str,
    package_id: str,
    created_by: str,
    reconcile_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    if not reconcile_date:
        reconcile_date = datetime.utcnow().strftime("%Y-%m-%d")
    
    pkg = db.query(EquityPackage).filter(EquityPackage.id == package_id).first()
    if not pkg:
        raise HTTPException(status_code=404, detail="权益包不存在")
    
    deductions = db.query(DeductionDetail).filter(
        DeductionDetail.package_id == package_id,
        DeductionDetail.is_reversed == False
    ).all()
    
    system_total = sum(d.deduct_amount for d in deductions)
    manual_total = pkg.used_quota
    difference = system_total - manual_total
    
    recon_id = f"recon_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    recon = ReconciliationResult(
        id=recon_id,
        customer_id=customer_id,
        package_id=package_id,
        reconcile_date=reconcile_date,
        system_total=system_total,
        manual_total=manual_total,
        difference=difference,
        status="completed" if difference == 0 else "mismatch",
        created_by=created_by
    )
    db.add(recon)
    db.commit()
    
    return {
        "code": 0,
        "data": {
            "reconciliation_id": recon_id,
            "system_total": system_total,
            "manual_total": manual_total,
            "difference": difference,
            "status": recon.status
        }
    }


@app.get("/export/deductions/{customer_id}")
def export_deductions(
    customer_id: str,
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    query = db.query(DeductionDetail).filter(DeductionDetail.customer_id == customer_id)
    
    if start_date:
        query = query.filter(DeductionDetail.deduct_time >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.filter(DeductionDetail.deduct_time <= datetime.fromisoformat(end_date))
    
    deductions = query.all()
    
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["扣减ID", "事件ID", "权益包ID", "扣减金额", "扣减原因", "扣减时间", "是否冲正", "冲正原因"])
    
    for d in deductions:
        writer.writerow([
            d.id, d.event_id, d.package_id, d.deduct_amount, d.deduct_reason,
            d.deduct_time.isoformat(), d.is_reversed, d.reversed_reason or ""
        ])
    
    output.seek(0)
    return StreamingResponse(
        content=output,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=deductions_{customer_id}.csv"}
    )


@app.get("/deductions/", response_model=dict)
def list_deductions(
    customer_id: Optional[str] = None,
    package_id: Optional[str] = None,
    is_reversed: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(DeductionDetail)
    if customer_id:
        query = query.filter(DeductionDetail.customer_id == customer_id)
    if package_id:
        query = query.filter(DeductionDetail.package_id == package_id)
    if is_reversed is not None:
        query = query.filter(DeductionDetail.is_reversed == is_reversed)
    
    deductions = query.all()
    return {
        "code": 0,
        "data": [
            {
                "id": d.id,
                "event_id": d.event_id,
                "package_id": d.package_id,
                "customer_id": d.customer_id,
                "deduct_amount": d.deduct_amount,
                "deduct_reason": d.deduct_reason,
                "deduct_time": d.deduct_time.isoformat(),
                "is_reversed": d.is_reversed,
                "reversed_reason": d.reversed_reason
            } for d in deductions
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
