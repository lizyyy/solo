from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import BondLedger, CouponSchedule, RedemptionNotice, CustodyReceipt, FundCalendar, WarningSheet
from schemas import (
    BondLedgerCreate, BondLedgerOut,
    CouponScheduleCreate, CouponScheduleOut,
    RedemptionNoticeCreate, RedemptionNoticeOut,
    CustodyReceiptCreate, CustodyReceiptOut,
    FundCalendarCreate, FundCalendarOut,
    WarningSheetCreate, WarningSheetOut,
    BatchEntryResult,
)
from datetime import datetime

router = APIRouter()


def _apply_provenance(model_obj, schema_obj):
    model_obj.source_type = schema_obj.source_type
    model_obj.source_detail = schema_obj.source_detail
    model_obj.quality_status = schema_obj.quality_status
    model_obj.anomaly_notes = schema_obj.anomaly_notes or []
    model_obj.created_by = schema_obj.created_by
    model_obj.created_at = datetime.now()
    model_obj.updated_at = datetime.now()


@router.post("/bonds", response_model=BondLedgerOut)
def create_bond(data: BondLedgerCreate, db: Session = Depends(get_db)):
    existing = db.query(BondLedger).filter(BondLedger.bond_code == data.bond_code).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"债券代码 {data.bond_code} 已存在")
    obj = BondLedger(**data.model_dump(exclude={"anomaly_notes"}))
    _apply_provenance(obj, data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/bonds/batch", response_model=BatchEntryResult)
def create_bonds_batch(data: List[BondLedgerCreate], db: Session = Depends(get_db)):
    inserted = 0
    flagged = []
    errors = []
    for i, item in enumerate(data):
        try:
            existing = db.query(BondLedger).filter(BondLedger.bond_code == item.bond_code).first()
            if existing:
                errors.append({"index": i, "bond_code": item.bond_code, "reason": "代码已存在"})
                continue
            obj = BondLedger(**item.model_dump(exclude={"anomaly_notes"}))
            _apply_provenance(obj, item)
            db.add(obj)
            inserted += 1
            if item.quality_status != "normal":
                flagged.append({"index": i, "bond_code": item.bond_code, "status": item.quality_status})
        except Exception as e:
            errors.append({"index": i, "bond_code": item.bond_code, "reason": str(e)})
    db.commit()
    return BatchEntryResult(inserted=inserted, flagged=flagged, errors=errors)


@router.get("/bonds", response_model=List[BondLedgerOut])
def list_bonds(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(BondLedger).offset(skip).limit(limit).all()


@router.get("/bonds/{bond_id}", response_model=BondLedgerOut)
def get_bond(bond_id: int, db: Session = Depends(get_db)):
    obj = db.query(BondLedger).filter(BondLedger.id == bond_id).first()
    if not obj:
        raise HTTPException(status_code=404, detail="债券不存在")
    return obj


@router.post("/coupons", response_model=CouponScheduleOut)
def create_coupon(data: CouponScheduleCreate, db: Session = Depends(get_db)):
    bond = db.query(BondLedger).filter(BondLedger.id == data.bond_id).first()
    if not bond:
        raise HTTPException(status_code=404, detail="关联债券不存在")
    dup = db.query(CouponSchedule).filter(
        CouponSchedule.bond_id == data.bond_id,
        CouponSchedule.payment_date == data.payment_date,
        CouponSchedule.coupon_amount == data.coupon_amount,
    ).first()
    obj = CouponSchedule(**data.model_dump(exclude={"anomaly_notes"}))
    _apply_provenance(obj, data)
    if dup:
        obj.is_duplicate = True
        obj.quality_status = "suspect"
        obj.anomaly_notes = (obj.anomaly_notes or []) + [
            f"疑似重复票息：与ID={dup.id}（{dup.payment_date}，{dup.coupon_amount}万）相同"
        ]
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/coupons/batch", response_model=BatchEntryResult)
def create_coupons_batch(data: List[CouponScheduleCreate], db: Session = Depends(get_db)):
    inserted = 0
    flagged = []
    errors = []
    for i, item in enumerate(data):
        try:
            bond = db.query(BondLedger).filter(BondLedger.id == item.bond_id).first()
            if not bond:
                errors.append({"index": i, "reason": "关联债券不存在"})
                continue
            dup = db.query(CouponSchedule).filter(
                CouponSchedule.bond_id == item.bond_id,
                CouponSchedule.payment_date == item.payment_date,
                CouponSchedule.coupon_amount == item.coupon_amount,
            ).first()
            obj = CouponSchedule(**item.model_dump(exclude={"anomaly_notes"}))
            _apply_provenance(obj, item)
            if dup:
                obj.is_duplicate = True
                obj.quality_status = "suspect"
                obj.anomaly_notes = (obj.anomaly_notes or []) + [
                    f"疑似重复票息：与ID={dup.id}相同"
                ]
            db.add(obj)
            inserted += 1
            if obj.quality_status != "normal":
                flagged.append({"index": i, "bond_id": item.bond_id, "status": obj.quality_status, "note": obj.anomaly_notes})
        except Exception as e:
            errors.append({"index": i, "reason": str(e)})
    db.commit()
    return BatchEntryResult(inserted=inserted, flagged=flagged, errors=errors)


@router.get("/coupons", response_model=List[CouponScheduleOut])
def list_coupons(bond_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(CouponSchedule)
    if bond_id:
        q = q.filter(CouponSchedule.bond_id == bond_id)
    return q.offset(skip).limit(limit).all()


@router.post("/notices", response_model=RedemptionNoticeOut)
def create_notice(data: RedemptionNoticeCreate, db: Session = Depends(get_db)):
    bond = db.query(BondLedger).filter(BondLedger.id == data.bond_id).first()
    if not bond:
        raise HTTPException(status_code=404, detail="关联债券不存在")

    prev_notices = db.query(RedemptionNotice).filter(
        RedemptionNotice.bond_id == data.bond_id
    ).order_by(RedemptionNotice.notice_version.desc()).all()

    version = data.notice_version
    if version is None:
        version = (prev_notices[0].notice_version + 1) if prev_notices else 1

    for pn in prev_notices:
        pn.is_latest = False

    obj = RedemptionNotice(**data.model_dump(exclude={"anomaly_notes", "notice_version"}))
    obj.notice_version = version
    _apply_provenance(obj, data)

    from datetime import timedelta
    if obj.redemption_date - obj.notice_date < timedelta(days=5):
        obj.is_late = True
        obj.quality_status = "suspect"
        obj.anomaly_notes = (obj.anomaly_notes or []) + [
            f"公告日期偏晚：公告日{obj.notice_date}距赎回日{obj.redemption_date}不足5个工作日"
        ]

    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/notices", response_model=List[RedemptionNoticeOut])
def list_notices(bond_id: int = None, latest_only: bool = False, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(RedemptionNotice)
    if bond_id:
        q = q.filter(RedemptionNotice.bond_id == bond_id)
    if latest_only:
        q = q.filter(RedemptionNotice.is_latest == True)
    return q.order_by(RedemptionNotice.redemption_date).offset(skip).limit(limit).all()


@router.post("/receipts", response_model=CustodyReceiptOut)
def create_receipt(data: CustodyReceiptCreate, db: Session = Depends(get_db)):
    bond = db.query(BondLedger).filter(BondLedger.id == data.bond_id).first()
    if not bond:
        raise HTTPException(status_code=404, detail="关联债券不存在")
    obj = CustodyReceipt(**data.model_dump(exclude={"anomaly_notes"}))
    _apply_provenance(obj, data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/receipts/batch", response_model=BatchEntryResult)
def create_receipts_batch(data: List[CustodyReceiptCreate], db: Session = Depends(get_db)):
    inserted = 0
    flagged = []
    errors = []
    for i, item in enumerate(data):
        try:
            bond = db.query(BondLedger).filter(BondLedger.id == item.bond_id).first()
            if not bond:
                errors.append({"index": i, "reason": "关联债券不存在"})
                continue
            obj = CustodyReceipt(**item.model_dump(exclude={"anomaly_notes"}))
            _apply_provenance(obj, item)
            db.add(obj)
            inserted += 1
            if item.quality_status != "normal":
                flagged.append({"index": i, "bond_id": item.bond_id, "status": item.quality_status})
        except Exception as e:
            errors.append({"index": i, "reason": str(e)})
    db.commit()
    return BatchEntryResult(inserted=inserted, flagged=flagged, errors=errors)


@router.get("/receipts", response_model=List[CustodyReceiptOut])
def list_receipts(bond_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(CustodyReceipt)
    if bond_id:
        q = q.filter(CustodyReceipt.bond_id == bond_id)
    return q.offset(skip).limit(limit).all()


@router.post("/fund-calendar", response_model=FundCalendarOut)
def create_fund_calendar(data: FundCalendarCreate, db: Session = Depends(get_db)):
    existing = db.query(FundCalendar).filter(FundCalendar.calendar_date == data.calendar_date).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"{data.calendar_date} 已有资金日历记录")
    obj = FundCalendar(**data.model_dump(exclude={"anomaly_notes"}))
    _apply_provenance(obj, data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.post("/fund-calendar/batch", response_model=BatchEntryResult)
def create_fund_calendar_batch(data: List[FundCalendarCreate], db: Session = Depends(get_db)):
    inserted = 0
    flagged = []
    errors = []
    for i, item in enumerate(data):
        try:
            existing = db.query(FundCalendar).filter(FundCalendar.calendar_date == item.calendar_date).first()
            if existing:
                errors.append({"index": i, "date": str(item.calendar_date), "reason": "日期已存在"})
                continue
            obj = FundCalendar(**item.model_dump(exclude={"anomaly_notes"}))
            _apply_provenance(obj, item)
            db.add(obj)
            inserted += 1
            if item.quality_status != "normal":
                flagged.append({"index": i, "date": str(item.calendar_date), "status": item.quality_status})
        except Exception as e:
            errors.append({"index": i, "reason": str(e)})
    db.commit()
    return BatchEntryResult(inserted=inserted, flagged=flagged, errors=errors)


@router.get("/fund-calendar", response_model=List[FundCalendarOut])
def list_fund_calendar(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(FundCalendar).order_by(FundCalendar.calendar_date).offset(skip).limit(limit).all()


@router.post("/warnings", response_model=WarningSheetOut)
def create_warning(data: WarningSheetCreate, db: Session = Depends(get_db)):
    if data.bond_id:
        bond = db.query(BondLedger).filter(BondLedger.id == data.bond_id).first()
        if not bond:
            raise HTTPException(status_code=404, detail="关联债券不存在")
    obj = WarningSheet(**data.model_dump(exclude={"anomaly_notes"}))
    _apply_provenance(obj, data)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj


@router.get("/warnings", response_model=List[WarningSheetOut])
def list_warnings(status: str = None, warning_type: str = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    q = db.query(WarningSheet)
    if status:
        q = q.filter(WarningSheet.status == status)
    if warning_type:
        q = q.filter(WarningSheet.warning_type == warning_type)
    return q.order_by(WarningSheet.created_at.desc()).offset(skip).limit(limit).all()
