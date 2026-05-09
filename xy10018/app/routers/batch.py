from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from ..database import get_db
from ..security import get_current_user, RoleChecker
from ..models import User, ReissueStatus
from ..schemas import BatchOperation
from ..services import batch_assign, batch_cancel, log_operation
from ..models import OperationType

router = APIRouter(prefix="/api/batch", tags=["批量操作"])

manager_checker = RoleChecker(["admin", "manager"])

@router.post("/assign")
async def batch_assign_endpoint(
    operation: BatchOperation,
    current_user: User = Depends(manager_checker),
    db: Session = Depends(get_db)
):
    if not operation.params or "assignee_id" not in operation.params:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="缺少 assignee_id 参数"
        )
    
    result = batch_assign(
        db, ids=operation.ids,
        assignee_id=operation.params["assignee_id"],
        changed_by=current_user.id
    )
    return result

@router.post("/cancel")
async def batch_cancel_endpoint(
    operation: BatchOperation,
    current_user: User = Depends(manager_checker),
    db: Session = Depends(get_db)
):
    remarks = operation.params.get("remarks") if operation.params else None
    result = batch_cancel(
        db, ids=operation.ids,
        changed_by=current_user.id,
        remarks=remarks
    )
    return result

@router.post("/retry")
async def batch_retry_endpoint(
    operation: BatchOperation,
    current_user: User = Depends(manager_checker),
    db: Session = Depends(get_db)
):
    from ..services import change_status
    from ..schemas import StatusChange
    
    success_count = 0
    failed_ids = []
    
    for reissue_id in operation.ids:
        try:
            status_change = StatusChange(
                status=ReissueStatus.PENDING,
                remarks="批量重试"
            )
            if change_status(db, reissue_id, status_change, current_user.id):
                success_count += 1
            else:
                failed_ids.append(reissue_id)
        except Exception:
            failed_ids.append(reissue_id)
    
    log_operation(db, current_user.id, OperationType.BATCH_OPERATION, None, {
        "action": "batch_retry",
        "ids": operation.ids,
        "success_count": success_count,
        "failed_count": len(failed_ids)
    })
    db.commit()
    
    return {
        "success_count": success_count,
        "failed_count": len(failed_ids),
        "failed_ids": failed_ids
    }
