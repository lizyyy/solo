from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import User, GasCylinder, Borrow, CylinderWarning, ExchangeRequest, CylinderLevelHistory
from app.schemas import (
    UserCreate, UserResponse,
    GasCylinderCreate, GasCylinderUpdate, GasCylinderResponse,
    BorrowCreate, BorrowResponse,
    CylinderWarningResponse,
    ExchangeRequestCreate, ExchangeRequestUpdate, ExchangeRequestResponse,
    SafetyReportResponse,
    APIErrorResponse
)
from app.services import (
    BusinessException,
    create_user, get_user_by_id,
    create_gas_cylinder, get_cylinder_by_id, update_cylinder_level,
    create_borrow, return_borrow,
    create_exchange_request, update_exchange_request,
    generate_safety_report,
    enrich_cylinder_response, enrich_borrow_response
)

router = APIRouter()


def handle_business_exception(exc: BusinessException):
    raise HTTPException(
        status_code=400,
        detail={
            "success": False,
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )


@router.post("/users", response_model=UserResponse)
def create_user_endpoint(user_data: UserCreate, db: Session = Depends(get_db)):
    try:
        return create_user(db, user_data)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error_code": "USER_NOT_FOUND",
            "message": f"用户ID {user_id} 不存在"
        })
    return user


@router.get("/users", response_model=List[UserResponse])
def list_users(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(User).offset(skip).limit(limit).all()


@router.post("/cylinders", response_model=GasCylinderResponse)
def create_cylinder(cylinder_data: GasCylinderCreate, db: Session = Depends(get_db)):
    try:
        cylinder = create_gas_cylinder(db, cylinder_data)
        return enrich_cylinder_response(cylinder)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/cylinders", response_model=List[GasCylinderResponse])
def list_cylinders(
    skip: int = 0, 
    limit: int = 100,
    danger_category: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(GasCylinder)
    if danger_category:
        query = query.filter(GasCylinder.danger_category == danger_category)
    if status:
        query = query.filter(GasCylinder.status == status)
    
    cylinders = query.offset(skip).limit(limit).all()
    return [enrich_cylinder_response(c) for c in cylinders]


@router.get("/cylinders/{cylinder_id}", response_model=GasCylinderResponse)
def get_cylinder(cylinder_id: int, db: Session = Depends(get_db)):
    cylinder = get_cylinder_by_id(db, cylinder_id)
    if not cylinder:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error_code": "CYLINDER_NOT_FOUND",
            "message": f"气瓶ID {cylinder_id} 不存在"
        })
    return enrich_cylinder_response(cylinder)


@router.put("/cylinders/{cylinder_id}/level", response_model=GasCylinderResponse)
def update_cylinder_level_endpoint(
    cylinder_id: int,
    new_level: float = Query(..., description="新的余量值"),
    recorded_by: Optional[str] = Query(None, description="记录人"),
    notes: Optional[str] = Query(None, description="备注"),
    db: Session = Depends(get_db)
):
    try:
        cylinder = update_cylinder_level(db, cylinder_id, new_level, recorded_by, notes)
        return enrich_cylinder_response(cylinder)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/cylinders/{cylinder_id}/history")
def get_cylinder_history(cylinder_id: int, db: Session = Depends(get_db)):
    cylinder = get_cylinder_by_id(db, cylinder_id)
    if not cylinder:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error_code": "CYLINDER_NOT_FOUND",
            "message": f"气瓶ID {cylinder_id} 不存在"
        })
    
    history = db.query(CylinderLevelHistory).filter(
        CylinderLevelHistory.cylinder_id == cylinder_id
    ).order_by(CylinderLevelHistory.created_at.desc()).all()
    
    return {
        "cylinder_id": cylinder_id,
        "cylinder_code": cylinder.cylinder_code,
        "history": history
    }


@router.post("/borrows", response_model=BorrowResponse)
def create_borrow_endpoint(borrow_data: BorrowCreate, db: Session = Depends(get_db)):
    try:
        borrow = create_borrow(db, borrow_data)
        return enrich_borrow_response(borrow)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/borrows", response_model=List[BorrowResponse])
def list_borrows(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Borrow)
    if status:
        query = query.filter(Borrow.status == status)
    if user_id:
        query = query.filter(Borrow.user_id == user_id)
    
    borrows = query.order_by(Borrow.created_at.desc()).offset(skip).limit(limit).all()
    return [enrich_borrow_response(b) for b in borrows]


@router.get("/borrows/{borrow_id}", response_model=BorrowResponse)
def get_borrow(borrow_id: int, db: Session = Depends(get_db)):
    borrow = db.query(Borrow).filter(Borrow.id == borrow_id).first()
    if not borrow:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error_code": "BORROW_NOT_FOUND",
            "message": f"借用记录ID {borrow_id} 不存在"
        })
    return enrich_borrow_response(borrow)


@router.put("/borrows/{borrow_id}/return", response_model=BorrowResponse)
def return_borrow_endpoint(
    borrow_id: int,
    notes: Optional[str] = Query(None, description="归还备注"),
    db: Session = Depends(get_db)
):
    try:
        borrow = return_borrow(db, borrow_id, notes)
        return enrich_borrow_response(borrow)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/warnings", response_model=List[CylinderWarningResponse])
def list_warnings(
    skip: int = 0,
    limit: int = 100,
    is_resolved: Optional[bool] = None,
    severity: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CylinderWarning)
    if is_resolved is not None:
        query = query.filter(CylinderWarning.is_resolved == is_resolved)
    if severity:
        query = query.filter(CylinderWarning.severity == severity)
    
    return query.order_by(CylinderWarning.created_at.desc()).offset(skip).limit(limit).all()


@router.post("/exchanges", response_model=ExchangeRequestResponse)
def create_exchange_endpoint(exchange_data: ExchangeRequestCreate, db: Session = Depends(get_db)):
    try:
        return create_exchange_request(db, exchange_data)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/exchanges", response_model=List[ExchangeRequestResponse])
def list_exchanges(
    skip: int = 0,
    limit: int = 100,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ExchangeRequest)
    if status:
        query = query.filter(ExchangeRequest.status == status)
    
    return query.order_by(ExchangeRequest.created_at.desc()).offset(skip).limit(limit).all()


@router.get("/exchanges/{exchange_id}", response_model=ExchangeRequestResponse)
def get_exchange(exchange_id: int, db: Session = Depends(get_db)):
    exchange = db.query(ExchangeRequest).filter(ExchangeRequest.id == exchange_id).first()
    if not exchange:
        raise HTTPException(status_code=404, detail={
            "success": False,
            "error_code": "EXCHANGE_NOT_FOUND",
            "message": f"换瓶申请ID {exchange_id} 不存在"
        })
    return exchange


@router.put("/exchanges/{exchange_id}", response_model=ExchangeRequestResponse)
def update_exchange_endpoint(
    exchange_id: int,
    data: ExchangeRequestUpdate,
    db: Session = Depends(get_db)
):
    try:
        return update_exchange_request(db, exchange_id, data)
    except BusinessException as e:
        handle_business_exception(e)


@router.get("/reports/safety", response_model=SafetyReportResponse)
def get_safety_report(db: Session = Depends(get_db)):
    return generate_safety_report(db)
