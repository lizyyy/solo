from datetime import datetime, date
from enum import Enum
from typing import List, Optional, Dict, Any
from decimal import Decimal
from sqlalchemy import create_engine, Column, String, Integer, Float, Date, DateTime, ForeignKey, Text, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, Session
from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, Field, validator
from pydantic import ValidationError
import pandas as pd
from io import BytesIO

SQLALCHEMY_DATABASE_URL = "sqlite:///./deposit_refund.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class DisputeStatus(str, Enum):
    PENDING = "pending"
    UNDER_REVIEW = "under_review"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    REFUNDED = "refunded"


class DeductionType(str, Enum):
    WATER = "water"
    ELECTRICITY = "electricity"
    MAINTENANCE = "maintenance"
    CLEANING = "cleaning"
    OTHER = "other"


class Lease(Base):
    __tablename__ = "leases"
    id = Column(String, primary_key=True)
    tenant_name = Column(String, nullable=False)
    tenant_phone = Column(String)
    apartment_number = Column(String, nullable=False)
    lease_start_date = Column(Date, nullable=False)
    lease_end_date = Column(Date, nullable=False)
    monthly_rent = Column(Float, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    deposits = relationship("Deposit", back_populates="lease")
    checkout_inspections = relationship("CheckoutInspection", back_populates="lease")
    utility_bills = relationship("UtilityBill", back_populates="lease")
    refund_reports = relationship("RefundReport", back_populates="lease")


class Deposit(Base):
    __tablename__ = "deposits"
    id = Column(String, primary_key=True)
    lease_id = Column(String, ForeignKey("leases.id"), nullable=False)
    amount = Column(Float, nullable=False)
    currency = Column(String, default="CNY")
    received_date = Column(Date, nullable=False)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    lease = relationship("Lease", back_populates="deposits")
    refund_reports = relationship("RefundReport", back_populates="deposit")


class CheckoutInspection(Base):
    __tablename__ = "checkout_inspections"
    id = Column(String, primary_key=True)
    lease_id = Column(String, ForeignKey("leases.id"), nullable=False)
    inspection_date = Column(Date, nullable=False)
    inspector_name = Column(String)
    overall_condition = Column(String)
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    lease = relationship("Lease", back_populates="checkout_inspections")
    deductions = relationship("Deduction", back_populates="inspection")


class UtilityBill(Base):
    __tablename__ = "utility_bills"
    id = Column(String, primary_key=True)
    lease_id = Column(String, ForeignKey("leases.id"), nullable=False)
    bill_type = Column(String, nullable=False)
    billing_period_start = Column(Date, nullable=False)
    billing_period_end = Column(Date, nullable=False)
    usage_amount = Column(Float)
    unit_price = Column(Float)
    total_amount = Column(Float, nullable=False)
    payment_status = Column(String, default="unpaid")
    notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    lease = relationship("Lease", back_populates="utility_bills")


class Deduction(Base):
    __tablename__ = "deductions"
    id = Column(String, primary_key=True)
    inspection_id = Column(String, ForeignKey("checkout_inspections.id"), nullable=False)
    deduction_type = Column(String, nullable=False)
    description = Column(Text)
    amount = Column(Float, nullable=False)
    is_reviewed = Column(Boolean, default=False)
    review_notes = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow)
    inspection = relationship("CheckoutInspection", back_populates="deductions")


class RefundReport(Base):
    __tablename__ = "refund_reports"
    id = Column(String, primary_key=True)
    lease_id = Column(String, ForeignKey("leases.id"), nullable=False)
    deposit_id = Column(String, ForeignKey("deposits.id"), nullable=False)
    status = Column(String, nullable=False)
    total_deposit = Column(Float, nullable=False)
    total_deductions = Column(Float, default=0)
    total_utility_deductions = Column(Float, default=0)
    refund_amount = Column(Float, nullable=False)
    dispute_status = Column(String, default=DisputeStatus.PENDING)
    dispute_notes = Column(Text)
    refund_date = Column(Date)
    refund_method = Column(String)
    transaction_id = Column(String, unique=True)
    generated_at = Column(DateTime, default=datetime.utcnow)
    reviewed_at = Column(DateTime)
    reviewed_by = Column(String)
    lease = relationship("Lease", back_populates="refund_reports")
    deposit = relationship("Deposit", back_populates="refund_reports")


Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


app = FastAPI(title="退租押金水电抵扣争议复核API", version="1.0.0")


class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


def create_error_response(code: ErrorCode, message: str, details: Optional[Dict] = None):
    return HTTPException(
        status_code=400 if code in [ErrorCode.MISSING_FIELD, ErrorCode.VALIDATION_ERROR] else 409 if code == ErrorCode.ALREADY_PROCESSED else 422,
        detail={
            "code": code,
            "message": message,
            "details": details or {}
        }
    )


class LeaseCreate(BaseModel):
    id: str
    tenant_name: str
    tenant_phone: Optional[str] = None
    apartment_number: str
    lease_start_date: date
    lease_end_date: date
    monthly_rent: float

    @validator('monthly_rent')
    def rent_must_be_positive(cls, v):
        if v <= 0:
            raise ValueError('月租金必须大于0')
        return v


class DepositCreate(BaseModel):
    id: str
    lease_id: str
    amount: float
    currency: str = "CNY"
    received_date: date
    notes: Optional[str] = None


class UtilityBillCreate(BaseModel):
    id: str
    lease_id: str
    bill_type: str
    billing_period_start: date
    billing_period_end: date
    usage_amount: Optional[float] = None
    unit_price: Optional[float] = None
    total_amount: float
    payment_status: str = "unpaid"
    notes: Optional[str] = None


class CheckoutInspectionCreate(BaseModel):
    id: str
    lease_id: str
    inspection_date: date
    inspector_name: Optional[str] = None
    overall_condition: Optional[str] = None
    notes: Optional[str] = None


class DeductionCreate(BaseModel):
    id: str
    inspection_id: str
    deduction_type: DeductionType
    description: Optional[str] = None
    amount: float


class RefundReportResponse(BaseModel):
    id: str
    lease_id: str
    deposit_id: str
    status: str
    total_deposit: float
    total_deductions: float
    total_utility_deductions: float
    refund_amount: float
    dispute_status: DisputeStatus
    dispute_notes: Optional[str] = None
    refund_date: Optional[date] = None
    refund_method: Optional[str] = None
    transaction_id: Optional[str] = None
    generated_at: datetime
    reviewed_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None

    class Config:
        orm_mode = True


@app.post("/leases/", response_model=LeaseCreate, status_code=201)
def create_lease(lease: LeaseCreate, db: Session = Depends(get_db)):
    db_lease = db.query(Lease).filter(Lease.id == lease.id).first()
    if db_lease:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"租约 {lease.id} 已存在")
    db_lease = Lease(**lease.dict())
    db.add(db_lease)
    db.commit()
    db.refresh(db_lease)
    return lease


@app.post("/deposits/", status_code=201)
def create_deposit(deposit: DepositCreate, db: Session = Depends(get_db)):
    db_lease = db.query(Lease).filter(Lease.id == deposit.lease_id).first()
    if not db_lease:
        raise create_error_response(ErrorCode.NOT_FOUND, f"租约 {deposit.lease_id} 不存在")
    db_deposit = db.query(Deposit).filter(Deposit.id == deposit.id).first()
    if db_deposit:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"押金记录 {deposit.id} 已存在")
    db_deposit = Deposit(**deposit.dict())
    db.add(db_deposit)
    db.commit()
    return deposit


@app.post("/utility-bills/", status_code=201)
def create_utility_bill(bill: UtilityBillCreate, db: Session = Depends(get_db)):
    db_lease = db.query(Lease).filter(Lease.id == bill.lease_id).first()
    if not db_lease:
        raise create_error_response(ErrorCode.NOT_FOUND, f"租约 {bill.lease_id} 不存在")
    db_bill = db.query(UtilityBill).filter(UtilityBill.id == bill.id).first()
    if db_bill:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"水电账单 {bill.id} 已存在")
    db_bill = UtilityBill(**bill.dict())
    db.add(db_bill)
    db.commit()
    return bill


@app.post("/checkout-inspections/", status_code=201)
def create_checkout_inspection(inspection: CheckoutInspectionCreate, db: Session = Depends(get_db)):
    db_lease = db.query(Lease).filter(Lease.id == inspection.lease_id).first()
    if not db_lease:
        raise create_error_response(ErrorCode.NOT_FOUND, f"租约 {inspection.lease_id} 不存在")
    db_inspection = db.query(CheckoutInspection).filter(CheckoutInspection.id == inspection.id).first()
    if db_inspection:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"退租检查记录 {inspection.id} 已存在")
    db_inspection = CheckoutInspection(**inspection.dict())
    db.add(db_inspection)
    db.commit()
    return inspection


@app.post("/deductions/", status_code=201)
def create_deduction(deduction: DeductionCreate, db: Session = Depends(get_db)):
    db_inspection = db.query(CheckoutInspection).filter(CheckoutInspection.id == deduction.inspection_id).first()
    if not db_inspection:
        raise create_error_response(ErrorCode.NOT_FOUND, f"退租检查记录 {deduction.inspection_id} 不存在")
    db_deduction = db.query(Deduction).filter(Deduction.id == deduction.id).first()
    if db_deduction:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"扣款记录 {deduction.id} 已存在")
    db_deduction = Deduction(**deduction.dict())
    db.add(db_deduction)
    db.commit()
    return deduction


@app.post("/refund-reports/generate/{lease_id}", response_model=RefundReportResponse)
def generate_refund_report(lease_id: str, db: Session = Depends(get_db)):
    lease = db.query(Lease).filter(Lease.id == lease_id).first()
    if not lease:
        raise create_error_response(ErrorCode.NOT_FOUND, f"租约 {lease_id} 不存在")
    
    existing_report = db.query(RefundReport).filter(
        RefundReport.lease_id == lease_id,
        RefundReport.dispute_status.in_([DisputeStatus.APPROVED, DisputeStatus.REFUNDED])
    ).first()
    if existing_report:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"租约 {lease_id} 已有已批准或已退款的报告", {"report_id": existing_report.id})
    
    deposit = db.query(Deposit).filter(Deposit.lease_id == lease_id).first()
    if not deposit:
        raise create_error_response(ErrorCode.MISSING_FIELD, f"租约 {lease_id} 没有押金记录")
    
    inspection = db.query(CheckoutInspection).filter(CheckoutInspection.lease_id == lease_id).first()
    if not inspection:
        raise create_error_response(ErrorCode.MISSING_FIELD, f"租约 {lease_id} 没有退租检查记录")
    
    deductions = db.query(Deduction).filter(Deduction.inspection_id == inspection.id).all()
    total_deductions = sum(d.amount for d in deductions)
    
    unpaid_bills = db.query(UtilityBill).filter(
        UtilityBill.lease_id == lease_id,
        UtilityBill.payment_status == "unpaid"
    ).all()
    total_utility_deductions = sum(b.total_amount for b in unpaid_bills)
    
    total_deposit = deposit.amount
    total_all_deductions = total_deductions + total_utility_deductions
    refund_amount = max(0, total_deposit - total_all_deductions)
    
    needs_manual = False
    dispute_notes = []
    
    if total_all_deductions > total_deposit:
        needs_manual = True
        dispute_notes.append("扣款总额超过押金，需要人工复核")
    
    if total_deductions > total_deposit * 0.3:
        needs_manual = True
        dispute_notes.append("维修保洁扣款超过押金30%，需要人工复核")
    
    for d in deductions:
        if d.amount > 1000:
            needs_manual = True
            dispute_notes.append(f"单项扣款{d.amount}元超过1000元阈值，需要人工复核")
    
    report_id = f"REFUND-{lease_id}-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    report = RefundReport(
        id=report_id,
        lease_id=lease_id,
        deposit_id=deposit.id,
        status="generated",
        total_deposit=total_deposit,
        total_deductions=total_deductions,
        total_utility_deductions=total_utility_deductions,
        refund_amount=refund_amount,
        dispute_status=DisputeStatus.NEEDS_MANUAL_REVIEW if needs_manual else DisputeStatus.PENDING,
        dispute_notes="; ".join(dispute_notes) if dispute_notes else None
    )
    
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


@app.put("/refund-reports/{report_id}/review", response_model=RefundReportResponse)
def review_refund_report(
    report_id: str,
    approve: bool,
    reviewer: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    report = db.query(RefundReport).filter(RefundReport.id == report_id).first()
    if not report:
        raise create_error_response(ErrorCode.NOT_FOUND, f"退款报告 {report_id} 不存在")
    
    if report.dispute_status == DisputeStatus.REFUNDED:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"报告 {report_id} 已完成退款，无法修改")
    
    if report.dispute_status not in [DisputeStatus.PENDING, DisputeStatus.NEEDS_MANUAL_REVIEW, DisputeStatus.UNDER_REVIEW]:
        raise create_error_response(ErrorCode.INVALID_STATE, f"当前状态 {report.dispute_status} 不允许审核操作")
    
    report.dispute_status = DisputeStatus.APPROVED if approve else DisputeStatus.REJECTED
    report.reviewed_at = datetime.utcnow()
    report.reviewed_by = reviewer
    if notes:
        report.dispute_notes = (report.dispute_notes or "") + f"\n审核意见: {notes}"
    
    db.commit()
    db.refresh(report)
    return report


@app.put("/refund-reports/{report_id}/refund", response_model=RefundReportResponse)
def process_refund(
    report_id: str,
    refund_method: str,
    transaction_id: str,
    db: Session = Depends(get_db)
):
    report = db.query(RefundReport).filter(RefundReport.id == report_id).first()
    if not report:
        raise create_error_response(ErrorCode.NOT_FOUND, f"退款报告 {report_id} 不存在")
    
    if report.dispute_status == DisputeStatus.REFUNDED:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"报告 {report_id} 已完成退款")
    
    if report.dispute_status != DisputeStatus.APPROVED:
        raise create_error_response(ErrorCode.INVALID_STATE, f"只有已批准的报告才能退款，当前状态: {report.dispute_status}")
    
    existing_transaction = db.query(RefundReport).filter(RefundReport.transaction_id == transaction_id).first()
    if existing_transaction:
        raise create_error_response(ErrorCode.ALREADY_PROCESSED, f"交易号 {transaction_id} 已被使用", {"existing_report_id": existing_transaction.id})
    
    report.dispute_status = DisputeStatus.REFUNDED
    report.refund_date = date.today()
    report.refund_method = refund_method
    report.transaction_id = transaction_id
    report.status = "completed"
    
    db.commit()
    db.refresh(report)
    return report


@app.get("/refund-reports/", response_model=List[RefundReportResponse])
def list_refund_reports(
    lease_id: Optional[str] = None,
    dispute_status: Optional[DisputeStatus] = None,
    min_refund_amount: Optional[float] = None,
    db: Session = Depends(get_db)
):
    query = db.query(RefundReport)
    if lease_id:
        query = query.filter(RefundReport.lease_id == lease_id)
    if dispute_status:
        query = query.filter(RefundReport.dispute_status == dispute_status)
    if min_refund_amount is not None:
        query = query.filter(RefundReport.refund_amount >= min_refund_amount)
    return query.all()


@app.get("/refund-reports/{report_id}", response_model=RefundReportResponse)
def get_refund_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(RefundReport).filter(RefundReport.id == report_id).first()
    if not report:
        raise create_error_response(ErrorCode.NOT_FOUND, f"退款报告 {report_id} 不存在")
    return report


@app.get("/refund-reports/{report_id}/export")
def export_refund_report(report_id: str, format: str = Query("excel", regex="^(excel|csv)$"), db: Session = Depends(get_db)):
    report = db.query(RefundReport).filter(RefundReport.id == report_id).first()
    if not report:
        raise create_error_response(ErrorCode.NOT_FOUND, f"退款报告 {report_id} 不存在")
    
    lease = db.query(Lease).filter(Lease.id == report.lease_id).first()
    deposit = db.query(Deposit).filter(Deposit.id == report.deposit_id).first()
    inspection = db.query(CheckoutInspection).filter(CheckoutInspection.lease_id == report.lease_id).first()
    
    deductions = []
    if inspection:
        deductions = db.query(Deduction).filter(Deduction.inspection_id == inspection.id).all()
    
    unpaid_bills = db.query(UtilityBill).filter(
        UtilityBill.lease_id == report.lease_id,
        UtilityBill.payment_status == "unpaid"
    ).all()
    
    report_data = {
        "报告编号": [report.id],
        "租客姓名": [lease.tenant_name if lease else ""],
        "房间号": [lease.apartment_number if lease else ""],
        "租约期限": [f"{lease.lease_start_date} 至 {lease.lease_end_date}" if lease else ""],
        "押金金额": [report.total_deposit],
        "维修保洁扣款总额": [report.total_deductions],
        "水电扣款总额": [report.total_utility_deductions],
        "应退押金金额": [report.refund_amount],
        "争议状态": [report.dispute_status],
        "生成时间": [report.generated_at],
        "审核人": [report.reviewed_by or ""],
        "审核时间": [report.reviewed_at or ""],
        "退款方式": [report.refund_method or ""],
        "交易号": [report.transaction_id or ""],
        "备注": [report.dispute_notes or ""]
    }
    
    df_report = pd.DataFrame(report_data)
    
    deduction_data = []
    for d in deductions:
        deduction_data.append({
            "扣款类型": d.deduction_type,
            "描述": d.description or "",
            "金额": d.amount
        })
    df_deductions = pd.DataFrame(deduction_data) if deduction_data else pd.DataFrame(columns=["扣款类型", "描述", "金额"])
    
    utility_data = []
    for b in unpaid_bills:
        utility_data.append({
            "账单类型": b.bill_type,
            "账期": f"{b.billing_period_start} 至 {b.billing_period_end}",
            "用量": b.usage_amount or "",
            "金额": b.total_amount
        })
    df_utilities = pd.DataFrame(utility_data) if utility_data else pd.DataFrame(columns=["账单类型", "账期", "用量", "金额"])
    
    output = BytesIO()
    
    if format == "excel":
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df_report.to_excel(writer, sheet_name="退款报告", index=False)
            df_deductions.to_excel(writer, sheet_name="扣款明细", index=False)
            df_utilities.to_excel(writer, sheet_name="水电账单", index=False)
        output.seek(0)
        return Response(
            content=output.getvalue(),
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=refund_report_{report_id}.xlsx"}
        )
    else:
        csv_content = "=== 退款报告 ===\n" + df_report.to_csv(index=False) + "\n=== 扣款明细 ===\n" + df_deductions.to_csv(index=False) + "\n=== 水电账单 ===\n" + df_utilities.to_csv(index=False)
        return Response(
            content=csv_content,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=refund_report_{report_id}.csv"}
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
