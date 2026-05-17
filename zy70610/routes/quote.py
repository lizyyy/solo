from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models import Quote, Device, Deduction, DeductionReason
from schemas import (
    QuoteCreate, QuoteFreezeRequest, QuoteResponse,
    DeductionCreate, DeductionResponse, DeductionReasonCreate, DeductionReasonResponse
)
from exceptions import (
    NotFoundException, InvalidStatusException,
    AlreadyProcessedException
)

router = APIRouter()


@router.post("/", response_model=QuoteResponse)
def create_quote(quote: QuoteCreate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.id == quote.device_id).first()
    if not device:
        raise NotFoundException("设备", quote.device_id)

    last_quote = db.query(Quote).filter(
        Quote.device_id == quote.device_id
    ).order_by(Quote.version.desc()).first()
    version = last_quote.version + 1 if last_quote else 1

    db_quote = Quote(
        **quote.dict(),
        version=version,
        final_price=quote.base_price
    )
    db.add(db_quote)
    db.commit()
    db.refresh(db_quote)

    response = QuoteResponse(
        id=db_quote.id,
        device_id=db_quote.device_id,
        serial_number=device.serial_number,
        version=db_quote.version,
        base_price=db_quote.base_price,
        final_price=db_quote.final_price,
        is_frozen=db_quote.is_frozen,
        frozen_at=db_quote.frozen_at,
        frozen_by=db_quote.frozen_by,
        status=db_quote.status,
        notes=db_quote.notes,
        created_at=db_quote.created_at,
        updated_at=db_quote.updated_at
    )
    return response


@router.post("/{quote_id}/freeze", response_model=QuoteResponse)
def freeze_quote(
    quote_id: int,
    request: QuoteFreezeRequest,
    db: Session = Depends(get_db)
):
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not db_quote:
        raise NotFoundException("报价", quote_id)

    if db_quote.is_frozen:
        raise AlreadyProcessedException("报价已冻结")

    db_quote.is_frozen = True
    db_quote.frozen_at = datetime.utcnow()
    db_quote.frozen_by = request.frozen_by
    db_quote.status = "frozen"

    db.commit()
    db.refresh(db_quote)

    device = db.query(Device).filter(Device.id == db_quote.device_id).first()

    response = QuoteResponse(
        id=db_quote.id,
        device_id=db_quote.device_id,
        serial_number=device.serial_number,
        version=db_quote.version,
        base_price=db_quote.base_price,
        final_price=db_quote.final_price,
        is_frozen=db_quote.is_frozen,
        frozen_at=db_quote.frozen_at,
        frozen_by=db_quote.frozen_by,
        status=db_quote.status,
        notes=db_quote.notes,
        created_at=db_quote.created_at,
        updated_at=db_quote.updated_at
    )
    return response


@router.get("/", response_model=List[QuoteResponse])
def list_quotes(
    skip: int = 0,
    limit: int = 100,
    device_id: int = None,
    is_frozen: bool = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Quote)
    if device_id:
        query = query.filter(Quote.device_id == device_id)
    if is_frozen is not None:
        query = query.filter(Quote.is_frozen == is_frozen)
    if status:
        query = query.filter(Quote.status == status)

    quotes = query.offset(skip).limit(limit).all()
    results = []
    for q in quotes:
        device = db.query(Device).filter(Device.id == q.device_id).first()
        results.append(QuoteResponse(
            id=q.id,
            device_id=q.device_id,
            serial_number=device.serial_number if device else "",
            version=q.version,
            base_price=q.base_price,
            final_price=q.final_price,
            is_frozen=q.is_frozen,
            frozen_at=q.frozen_at,
            frozen_by=q.frozen_by,
            status=q.status,
            notes=q.notes,
            created_at=q.created_at,
            updated_at=q.updated_at
        ))
    return results


@router.post("/reasons", response_model=DeductionReasonResponse)
def create_deduction_reason(
    reason: DeductionReasonCreate,
    db: Session = Depends(get_db)
):
    db_reason = DeductionReason(**reason.dict())
    db.add(db_reason)
    db.commit()
    db.refresh(db_reason)
    return db_reason


@router.get("/reasons", response_model=List[DeductionReasonResponse])
def list_deduction_reasons(db: Session = Depends(get_db)):
    return db.query(DeductionReason).all()


@router.post("/deductions", response_model=DeductionResponse)
def create_deduction(
    deduction: DeductionCreate,
    db: Session = Depends(get_db)
):
    quote = db.query(Quote).filter(Quote.id == deduction.quote_id).first()
    if not quote:
        raise NotFoundException("报价", deduction.quote_id)

    if quote.is_frozen:
        raise InvalidStatusException("frozen", "报价已冻结，无法扣减")

    reason = db.query(DeductionReason).filter(
        DeductionReason.id == deduction.reason_id
    ).first()
    if not reason:
        raise NotFoundException("扣减原因", deduction.reason_id)

    db_deduction = Deduction(**deduction.dict())
    db.add(db_deduction)

    total_deductions = db.query(Deduction).filter(
        Deduction.quote_id == deduction.quote_id
    ).all()
    total_deduction_amount = sum(d.amount for d in total_deductions) + deduction.amount
    quote.final_price = max(0, quote.base_price - total_deduction_amount)

    db.commit()
    db.refresh(db_deduction)

    response = DeductionResponse(
        id=db_deduction.id,
        quote_id=db_deduction.quote_id,
        reason_id=db_deduction.reason_id,
        reason_code=reason.code,
        reason_name=reason.name,
        amount=db_deduction.amount,
        description=db_deduction.description,
        recorded_by=db_deduction.recorded_by,
        created_at=db_deduction.created_at
    )
    return response


@router.get("/{quote_id}", response_model=QuoteResponse)
def get_quote(quote_id: int, db: Session = Depends(get_db)):
    db_quote = db.query(Quote).filter(Quote.id == quote_id).first()
    if not db_quote:
        raise NotFoundException("报价", quote_id)

    device = db.query(Device).filter(Device.id == db_quote.device_id).first()

    response = QuoteResponse(
        id=db_quote.id,
        device_id=db_quote.device_id,
        serial_number=device.serial_number,
        version=db_quote.version,
        base_price=db_quote.base_price,
        final_price=db_quote.final_price,
        is_frozen=db_quote.is_frozen,
        frozen_at=db_quote.frozen_at,
        frozen_by=db_quote.frozen_by,
        status=db_quote.status,
        notes=db_quote.notes,
        created_at=db_quote.created_at,
        updated_at=db_quote.updated_at
    )
    return response


@router.get("/{quote_id}/deductions", response_model=List[DeductionResponse])
def get_quote_deductions(quote_id: int, db: Session = Depends(get_db)):
    deductions = db.query(Deduction).filter(Deduction.quote_id == quote_id).all()

    results = []
    for d in deductions:
        reason = db.query(DeductionReason).filter(
            DeductionReason.id == d.reason_id
        ).first()
        results.append(DeductionResponse(
            id=d.id,
            quote_id=d.quote_id,
            reason_id=d.reason_id,
            reason_code=reason.code if reason else "",
            reason_name=reason.name if reason else "",
            amount=d.amount,
            description=d.description,
            recorded_by=d.recorded_by,
            created_at=d.created_at
        ))
    return results
