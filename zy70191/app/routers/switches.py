from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import SwitchStatus
from app.schemas import (
    SwitchRequest, SwitchRequestCreate, SwitchRequestDetail,
    SwitchExecutionResult, PriceComparison, QualificationCheckResult
)
from app.services.switch_service import SwitchService
from app.services.price_service import PriceService
from app.services.qualification_service import QualificationService

router = APIRouter(prefix="/api/switches", tags=["供应商切换"])


@router.post("", response_model=SwitchExecutionResult, status_code=status.HTTP_201_CREATED)
def create_switch_request(
    request_data: SwitchRequestCreate,
    db: Session = Depends(get_db)
):
    service = SwitchService(db)
    result = service.create_switch_request(request_data)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result


@router.get("", response_model=List[SwitchRequest])
def list_switch_requests(
    status_filter: Optional[SwitchStatus] = Query(None, alias="status"),
    limit: int = 100,
    db: Session = Depends(get_db)
):
    service = SwitchService(db)
    return service.get_all_switch_requests(status_filter, limit)


@router.get("/{request_id}", response_model=SwitchRequestDetail)
def get_switch_request(request_id: int, db: Session = Depends(get_db)):
    service = SwitchService(db)
    detail = service.get_switch_request_detail(request_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="切换申请不存在"
        )
    return detail


@router.post("/{request_id}/validate")
def validate_switch_request(request_id: int, db: Session = Depends(get_db)):
    service = SwitchService(db)
    result = service.validate_switch_request(request_id)
    return result


@router.post("/{request_id}/execute", response_model=SwitchExecutionResult)
def execute_switch(request_id: int, db: Session = Depends(get_db)):
    service = SwitchService(db)
    result = service.execute_switch(request_id)
    if not result.success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result.message
        )
    return result


@router.get("/{request_id}/price-comparison")
def get_price_comparison(
    request_id: int,
    db: Session = Depends(get_db)
):
    switch_service = SwitchService(db)
    price_service = PriceService(db)
    
    switch_request = switch_service.get_switch_request(request_id)
    if not switch_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="切换申请不存在"
        )
    
    comparison = price_service.compare_prices(
        switch_request.primary_supplier_id,
        switch_request.alternative_supplier_id,
        switch_request.product_code
    )
    
    if not comparison:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="无法获取价格对比信息"
        )
    
    return comparison


@router.get("/{request_id}/qualification-check")
def get_qualification_check(
    request_id: int,
    db: Session = Depends(get_db)
):
    switch_service = SwitchService(db)
    qual_service = QualificationService(db)
    
    switch_request = switch_service.get_switch_request(request_id)
    if not switch_request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="切换申请不存在"
        )
    
    return qual_service.check_qualification(switch_request.alternative_supplier_id)
