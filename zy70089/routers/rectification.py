from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from database import get_db
from models import RectificationStatus, OverlimitStatus
from schemas import (
    RectificationTaskCreate, RectificationTaskUpdate, RectificationTaskResponse
)
from services import RectificationTaskService

router = APIRouter(prefix="/api/v1/rectification", tags=["整改任务"])


@router.post("", response_model=RectificationTaskResponse, summary="创建整改任务")
def create_rectification_task(data: RectificationTaskCreate, db: Session = Depends(get_db)):
    return RectificationTaskService.create(db, data)


@router.put("/{task_id}", response_model=RectificationTaskResponse, summary="更新整改任务")
def update_rectification_task(
    task_id: int,
    data: RectificationTaskUpdate,
    db: Session = Depends(get_db)
):
    return RectificationTaskService.update(db, task_id, data)


@router.get("/{task_id}", response_model=dict, summary="获取整改任务详情")
def get_rectification_task(task_id: int, db: Session = Depends(get_db)):
    from models import RectificationTask, OverlimitRecord, DetectionReport, Permission
    
    task = db.query(RectificationTask).filter(RectificationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="整改任务不存在")
    
    overlimit = db.query(OverlimitRecord).filter(
        OverlimitRecord.id == task.overlimit_record_id
    ).first()
    
    overlimit_info = None
    if overlimit:
        detection = db.query(DetectionReport).filter(
            DetectionReport.id == overlimit.detection_report_id
        ).first()
        permission = db.query(Permission).filter(
            Permission.id == overlimit.permission_id
        ).first()
        
        overlimit_info = {
            "id": overlimit.id,
            "overlimit_value": overlimit.overlimit_value,
            "overlimit_ratio": overlimit.overlimit_ratio,
            "detection_date": overlimit.detection_date,
            "status": overlimit.status,
            "detection_value": detection.detection_value if detection else None,
            "detection_unit": detection.detection_unit if detection else None,
            "limit_value": permission.limit_value if permission else None,
            "limit_unit": permission.limit_unit if permission else None,
            "enterprise_name": permission.enterprise_name if permission else None,
            "pollutant_name": permission.pollutant_name if permission else None
        }
    
    return {
        "id": task.id,
        "overlimit_record_id": task.overlimit_record_id,
        "task_no": task.task_no,
        "deadline": task.deadline,
        "actual_completion_date": task.actual_completion_date,
        "rectification_measures": task.rectification_measures,
        "responsible_person": task.responsible_person,
        "contact_info": task.contact_info,
        "status": task.status,
        "remark": task.remark,
        "created_at": task.created_at,
        "updated_at": task.updated_at,
        "overlimit_info": overlimit_info
    }


@router.get("", response_model=List[RectificationTaskResponse], summary="查询整改任务列表")
def list_rectification_tasks(
    status: Optional[RectificationStatus] = None,
    overdue: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return RectificationTaskService.list(db, status, overdue, skip, limit)


@router.post("/{task_id}/start", response_model=RectificationTaskResponse, summary="开始整改")
def start_rectification(task_id: int, db: Session = Depends(get_db)):
    task = RectificationTaskService.get(db, task_id)
    
    if task.status != RectificationStatus.PENDING:
        raise HTTPException(
            status_code=400,
            detail=f"任务状态 {task.status} 不允许开始整改"
        )
    
    task.status = RectificationStatus.IN_PROGRESS
    db.commit()
    db.refresh(task)
    return task


@router.post("/{task_id}/submit", response_model=RectificationTaskResponse, summary="提交整改完成")
def submit_rectification(task_id: int, db: Session = Depends(get_db)):
    task = RectificationTaskService.get(db, task_id)
    
    if task.status not in [RectificationStatus.IN_PROGRESS, RectificationStatus.REJECTED]:
        raise HTTPException(
            status_code=400,
            detail=f"任务状态 {task.status} 不允许提交整改"
        )
    
    task.status = RectificationStatus.SUBMITTED
    task.actual_completion_date = datetime.utcnow()
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", summary="删除整改任务")
def delete_rectification_task(task_id: int, db: Session = Depends(get_db)):
    from models import RectificationTask, OverlimitRecord, ReviewReceipt, SupervisionReport
    
    task = db.query(RectificationTask).filter(RectificationTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="整改任务不存在")
    
    if task.status not in [RectificationStatus.PENDING, RectificationStatus.IN_PROGRESS]:
        raise HTTPException(
            status_code=400,
            detail=f"任务状态 {task.status} 不允许删除"
        )
    
    has_reviews = db.query(ReviewReceipt).filter(
        ReviewReceipt.rectification_task_id == task_id
    ).first()
    
    if has_reviews:
        raise HTTPException(status_code=400, detail="该任务已有复查记录，无法删除")
    
    has_reports = db.query(SupervisionReport).filter(
        SupervisionReport.rectification_task_id == task_id
    ).first()
    
    if has_reports:
        raise HTTPException(status_code=400, detail="该任务已有监管报告，无法删除")
    
    overlimit = db.query(OverlimitRecord).filter(
        OverlimitRecord.id == task.overlimit_record_id
    ).first()
    
    if overlimit:
        overlimit.status = OverlimitStatus.IDENTIFIED
    
    db.delete(task)
    db.commit()
    return {"message": "删除成功"}
