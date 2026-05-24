from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.database import get_db
from app.schemas import VoucherCreate, VoucherResponse, VoucherBindRequest, VoucherUseRequest
from app.services import VoucherService

router = APIRouter()


@router.post("/", response_model=VoucherResponse)
def create_voucher(
    request: VoucherCreate,
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    try:
        voucher = service.create_voucher(
            voucher_no=request.voucher_no,
            user_id=request.user_id,
            amount=request.amount,
            valid_days=request.valid_days
        )
        db.commit()
        db.refresh(voucher)
        return voucher
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/{voucher_no}", response_model=VoucherResponse)
def get_voucher(
    voucher_no: str,
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    voucher = service.get_voucher(voucher_no)
    if not voucher:
        raise HTTPException(status_code=404, detail="补偿券不存在")
    return voucher


@router.get("/")
def query_vouchers(
    voucher_no: Optional[str] = None,
    user_id: Optional[str] = None,
    status: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    vouchers, total = service.query_vouchers(
        voucher_no=voucher_no,
        user_id=user_id,
        status=status,
        start_date=start_date,
        end_date=end_date,
        page=page,
        page_size=page_size
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [VoucherResponse(
            id=v.id,
            voucher_no=v.voucher_no,
            user_id=v.user_id,
            amount=v.amount,
            valid_from=v.valid_from,
            valid_to=v.valid_to,
            status=v.status,
            used_time=v.used_time,
            created_at=v.created_at
        ) for v in vouchers]
    }


@router.post("/bind")
def bind_voucher(
    request: VoucherBindRequest,
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    try:
        record = service.bind_voucher_to_case(
            voucher_no=request.voucher_no,
            case_no=request.case_no
        )
        db.commit()
        return {
            "message": "绑定成功",
            "case_no": request.case_no,
            "voucher_no": request.voucher_no
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/{voucher_no}/use", response_model=VoucherResponse)
def use_voucher(
    voucher_no: str,
    request: VoucherUseRequest,
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    try:
        voucher = service.use_voucher(
            voucher_no=voucher_no,
            operator=request.operator,
            remark=request.remark
        )
        db.commit()
        db.refresh(voucher)
        return voucher
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/case/{case_no}/create", response_model=dict)
def create_voucher_for_case(
    case_no: str,
    voucher_no: Optional[str] = None,
    amount: Optional[float] = None,
    valid_days: int = 30,
    db: Session = Depends(get_db)
):
    service = VoucherService(db)
    try:
        voucher, record = service.create_and_bind_voucher(
            case_no=case_no,
            voucher_no=voucher_no,
            amount=amount,
            valid_days=valid_days
        )
        db.commit()
        db.refresh(voucher)
        return {
            "voucher": VoucherResponse(
                id=voucher.id,
                voucher_no=voucher.voucher_no,
                user_id=voucher.user_id,
                amount=voucher.amount,
                valid_from=voucher.valid_from,
                valid_to=voucher.valid_to,
                status=voucher.status,
                used_time=voucher.used_time,
                created_at=voucher.created_at
            ),
            "case_no": case_no
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
