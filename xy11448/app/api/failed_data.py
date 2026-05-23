from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.auth import get_current_active_user, allow_reviewer, allow_supervisor
from app.models import User, FailedData

router = APIRouter()


@router.get("/")
def list_failed_data(
    skip: int = 0,
    limit: int = 100,
    data_type: Optional[str] = None,
    resolved: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    query = db.query(FailedData)
    if data_type:
        query = query.filter(FailedData.data_type == data_type)
    if resolved is not None:
        query = query.filter(FailedData.resolved == resolved)
    
    failed_list = query.order_by(FailedData.failed_at.desc()).offset(skip).limit(limit).all()
    return {
        "success": True,
        "data": failed_list,
        "total": query.count()
    }


@router.get("/{failed_id}")
def get_failed_data(
    failed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    failed = db.query(FailedData).filter(FailedData.id == failed_id).first()
    if not failed:
        raise HTTPException(status_code=404, detail="失败记录不存在")
    return {"success": True, "data": failed}


@router.post("/{failed_id}/resolve", dependencies=[Depends(allow_reviewer)])
def resolve_failed_data(
    failed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    from datetime import datetime
    failed = db.query(FailedData).filter(FailedData.id == failed_id).first()
    if not failed:
        raise HTTPException(status_code=404, detail="失败记录不存在")
    
    failed.resolved = True
    failed.resolved_by = current_user.id
    failed.resolved_at = datetime.now()
    
    db.commit()
    return {"success": True, "message": "已标记为已解决"}


@router.post("/{failed_id}/retry", dependencies=[Depends(allow_reviewer)])
def retry_failed_data(
    failed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    import json
    from app.services import DataQualityService
    
    failed = db.query(FailedData).filter(FailedData.id == failed_id).first()
    if not failed:
        raise HTTPException(status_code=404, detail="失败记录不存在")
    
    try:
        source_data = json.loads(failed.source_data)
        
        if failed.data_type == "pile_alert":
            from app.models import PileAlert, DataQuality
            is_valid, issues = DataQualityService.validate_pile_alert(db, source_data)
            if is_valid:
                from datetime import datetime
                alert_data = source_data.copy()
                if "start_time" in alert_data:
                    alert_data["start_time"] = datetime.fromisoformat(str(alert_data["start_time"]).replace("Z", "+00:00"))
                if "end_time" in alert_data and alert_data["end_time"]:
                    alert_data["end_time"] = datetime.fromisoformat(str(alert_data["end_time"]).replace("Z", "+00:00"))
                
                db_alert = PileAlert(
                    **alert_data,
                    created_by=current_user.id,
                    data_quality=DataQuality.VALID
                )
                db.add(db_alert)
                failed.retried = True
                failed.resolved = True
                failed.resolved_by = current_user.id
                db.commit()
                return {"success": True, "message": "重试成功，数据已导入", "alert_id": db_alert.id}
            else:
                return {"success": False, "message": f"重试失败: {', '.join(issues)}"}
        
        return {"success": False, "message": "不支持的重试类型"}
        
    except Exception as e:
        return {"success": False, "message": f"重试失败: {str(e)}"}


@router.delete("/{failed_id}", dependencies=[Depends(allow_supervisor)])
def delete_failed_data(
    failed_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    failed = db.query(FailedData).filter(FailedData.id == failed_id).first()
    if not failed:
        raise HTTPException(status_code=404, detail="失败记录不存在")
    
    db.delete(failed)
    db.commit()
    return {"success": True, "message": "删除成功"}
