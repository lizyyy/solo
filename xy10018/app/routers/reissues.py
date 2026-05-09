from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import get_current_user, RoleChecker
from ..models import User, UserRole, ReissueStatus
from ..schemas import (
    ReissueCreate, ReissueUpdate, ReissueResponse, StatusChange,
    StatusHistoryResponse, ReissueHistoryResponse
)
from ..services import (
    create_reissue, update_reissue, change_status, delete_reissue,
    get_reissues, get_status_history, get_reissue_history
)

router = APIRouter(prefix="/api/reissues", tags=["补发单管理"])

cs_checker = RoleChecker(["admin", "manager", "cs"])
operator_checker = RoleChecker(["admin", "manager", "cs", "operator"])

@router.get("")
async def list_reissues(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    status: Optional[ReissueStatus] = None,
    assigned_to: Optional[int] = None,
    created_by: Optional[int] = None,
    search: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    items, total = get_reissues(
        db, skip=skip, limit=page_size,
        status=status, assigned_to=assigned_to,
        created_by=created_by, search=search
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [
            {
                "id": item.id,
                "order_no": item.order_no,
                "customer_name": item.customer_name,
                "customer_phone": item.customer_phone,
                "address": item.address,
                "product_name": item.product_name,
                "product_sku": item.product_sku,
                "quantity": item.quantity,
                "reason": item.reason,
                "description": item.description,
                "status": item.status.value,
                "tracking_number": item.tracking_number,
                "shipping_company": item.shipping_company,
                "shipping_cost": item.shipping_cost,
                "remarks": item.remarks,
                "version": item.version,
                "retry_count": item.retry_count,
                "last_error": item.last_error,
                "created_by": item.created_by,
                "assigned_to": item.assigned_to,
                "created_at": item.created_at.isoformat() if item.created_at else None,
                "updated_at": item.updated_at.isoformat() if item.updated_at else None
            }
            for item in items
        ]
    }

@router.post("", response_model=ReissueResponse, status_code=status.HTTP_201_CREATED)
async def create_reissue_endpoint(
    reissue: ReissueCreate,
    current_user: User = Depends(cs_checker),
    db: Session = Depends(get_db)
):
    try:
        return create_reissue(db, reissue, created_by=current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{reissue_id}", response_model=ReissueResponse)
async def get_reissue_detail(
    reissue_id: int,
    current_user: User = Depends(operator_checker),
    db: Session = Depends(get_db)
):
    from ..models import Reissue
    reissue = db.query(Reissue).filter(Reissue.id == reissue_id).first()
    if not reissue:
        raise HTTPException(status_code=404, detail="补发单不存在")
    return reissue

@router.put("/{reissue_id}", response_model=ReissueResponse)
async def update_reissue_endpoint(
    reissue_id: int,
    reissue_update: ReissueUpdate,
    current_user: User = Depends(cs_checker),
    db: Session = Depends(get_db)
):
    reissue = update_reissue(db, reissue_id, reissue_update, changed_by=current_user.id)
    if not reissue:
        raise HTTPException(status_code=404, detail="补发单不存在")
    return reissue

@router.post("/{reissue_id}/status", response_model=ReissueResponse)
async def change_status_endpoint(
    reissue_id: int,
    status_change: StatusChange,
    current_user: User = Depends(operator_checker),
    db: Session = Depends(get_db)
):
    try:
        reissue = change_status(db, reissue_id, status_change, changed_by=current_user.id)
        if not reissue:
            raise HTTPException(status_code=404, detail="补发单不存在")
        return reissue
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

@router.get("/{reissue_id}/status-history", response_model=List[StatusHistoryResponse])
async def get_reissue_status_history(
    reissue_id: int,
    current_user: User = Depends(operator_checker),
    db: Session = Depends(get_db)
):
    return get_status_history(db, reissue_id)

@router.get("/{reissue_id}/history", response_model=List[ReissueHistoryResponse])
async def get_reissue_version_history(
    reissue_id: int,
    current_user: User = Depends(cs_checker),
    db: Session = Depends(get_db)
):
    return get_reissue_history(db, reissue_id)

@router.delete("/{reissue_id}")
async def delete_reissue_endpoint(
    reissue_id: int,
    current_user: User = Depends(cs_checker),
    db: Session = Depends(get_db)
):
    if not delete_reissue(db, reissue_id, deleted_by=current_user.id):
        raise HTTPException(status_code=404, detail="补发单不存在")
    return {"message": "补发单已删除"}
