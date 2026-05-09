from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from database import get_db
from models import OverlimitStatus
from schemas import OverlimitRecordResponse
from services import OverlimitRecordService

router = APIRouter(prefix="/api/v1/overlimit", tags=["超标记录"])


@router.get("/{record_id}", response_model=dict, summary="获取超标记录详情")
def get_overlimit_record(record_id: int, db: Session = Depends(get_db)):
    from models import OverlimitRecord, Permission
    
    record = db.query(OverlimitRecord).filter(OverlimitRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="超标记录不存在")
    
    permission = db.query(Permission).filter(Permission.id == record.permission_id).first()
    
    return {
        "id": record.id,
        "permission_id": record.permission_id,
        "detection_report_id": record.detection_report_id,
        "overlimit_value": record.overlimit_value,
        "overlimit_ratio": record.overlimit_ratio,
        "detection_date": record.detection_date,
        "identification_date": record.identification_date,
        "status": record.status,
        "description": record.description,
        "enterprise_name": permission.enterprise_name if permission else None,
        "pollutant_name": permission.pollutant_name if permission else None,
        "permit_no": permission.permit_no if permission else None
    }


@router.get("", response_model=List[dict], summary="查询超标记录列表")
def list_overlimit_records(
    status: Optional[OverlimitStatus] = None,
    permit_no: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return OverlimitRecordService.list(db, status, permit_no, skip, limit)


@router.post("/{record_id}/resolve", summary="手动标记超标已解决")
def resolve_overlimit(record_id: int, db: Session = Depends(get_db)):
    from models import OverlimitRecord, RectificationTask
    
    record = db.query(OverlimitRecord).filter(OverlimitRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="超标记录不存在")
    
    if record.status != OverlimitStatus.RECTIFYING:
        raise HTTPException(
            status_code=400,
            detail=f"当前状态 {record.status} 不允许标记为已解决"
        )
    
    task = db.query(RectificationTask).filter(
        RectificationTask.overlimit_record_id == record_id
    ).first()
    
    if task:
        from models import RectificationStatus
        if task.status not in [RectificationStatus.APPROVED, RectificationStatus.SUBMITTED]:
            raise HTTPException(
                status_code=400,
                detail=f"整改任务状态 {task.status} 不允许标记为已解决"
            )
    
    record.status = OverlimitStatus.RESOLVED
    db.commit()
    
    return {"message": "超标记录已标记为已解决", "id": record_id}
