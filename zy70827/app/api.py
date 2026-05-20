from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime

from app.database import get_db
from app.services import TaskService
from app.schemas import (
    SampleTaskCreate, SampleTaskResponse, SampleTaskDetailResponse,
    CategoryUpdateRequest, StatusUpdateRequest, DamagePhotoUpdateRequest,
    SettlementRequest, AuditLogResponse, ErrorDetailResponse, SampleResponse,
    BrandBatchResponse, TalentScheduleResponse, DepositRecordResponse
)
from app.models import SampleTask, Sample, BrandBatch, TalentSchedule, DepositRecord

router = APIRouter()


@router.post("/tasks", response_model=SampleTaskResponse, summary="创建样品任务")
def create_task(task_data: SampleTaskCreate, db: Session = Depends(get_db)):
    try:
        service = TaskService(db)
        task = service.create_task(task_data)
        return task
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/tasks", response_model=List[SampleTaskResponse], summary="查询任务列表")
def get_tasks(
    status: str = None,
    category: str = None,
    task_no: str = None,
    batch_no: str = None,
    submitted_by: str = None,
    start_date: datetime = None,
    end_date: datetime = None,
    db: Session = Depends(get_db)
):
    service = TaskService(db)
    tasks = service.query_tasks(
        status=status, category=category, task_no=task_no,
        batch_no=batch_no, submitted_by=submitted_by,
        start_date=start_date, end_date=end_date
    )
    return tasks


@router.get("/tasks/{task_id}", response_model=SampleTaskDetailResponse, summary="获取任务详情")
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(SampleTask).filter(SampleTask.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="任务不存在")
    return task


@router.get("/tasks/{task_id}/samples", response_model=List[SampleResponse], summary="获取任务样品列表")
def get_task_samples(task_id: int, db: Session = Depends(get_db)):
    samples = db.query(Sample).filter(Sample.task_id == task_id).all()
    return samples


@router.get("/tasks/{task_id}/errors", response_model=List[ErrorDetailResponse], summary="获取任务错误详情")
def get_task_errors(task_id: int, db: Session = Depends(get_db)):
    from app.models import ErrorDetail
    errors = db.query(ErrorDetail).filter(ErrorDetail.task_id == task_id).all()
    return errors


@router.get("/tasks/{task_id}/audit-logs", response_model=List[AuditLogResponse], summary="获取任务审计日志")
def get_task_audit_logs(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    logs = service.get_task_audit_logs(task_id)
    
    result = []
    for log in logs:
        log_dict = {
            "id": log.id,
            "task_id": log.task_id,
            "operator_id": log.operator_id,
            "operator_name": log.operator.username if log.operator else None,
            "action": log.action,
            "field_changed": log.field_changed,
            "old_value": log.old_value,
            "new_value": log.new_value,
            "reason": log.reason,
            "operated_at": log.operated_at
        }
        result.append(log_dict)
    return result


@router.put("/tasks/{task_id}/category", response_model=SampleTaskResponse, summary="更新任务分类")
def update_task_category(task_id: int, update_data: CategoryUpdateRequest, db: Session = Depends(get_db)):
    try:
        service = TaskService(db)
        task = service.update_category(task_id, update_data)
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/tasks/{task_id}/status", response_model=SampleTaskResponse, summary="更新任务状态")
def update_task_status(task_id: int, update_data: StatusUpdateRequest, db: Session = Depends(get_db)):
    try:
        service = TaskService(db)
        task = service.update_status(task_id, update_data)
        return task
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/samples/damage-photo", response_model=SampleResponse, summary="更新样品破损照片")
def update_damage_photo(update_data: DamagePhotoUpdateRequest, db: Session = Depends(get_db)):
    try:
        service = TaskService(db)
        sample = service.update_damage_photo(
            sample_id=update_data.sample_id,
            has_damage_photo=update_data.has_damage_photo,
            damage_photo_url=update_data.damage_photo_url,
            operator_id=update_data.operator_id,
            reason=update_data.reason
        )
        return sample
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/tasks/{task_id}/can-settle", summary="检查任务是否可以结清")
def check_can_settle(task_id: int, db: Session = Depends(get_db)):
    service = TaskService(db)
    can_settle, message = service.can_settle(task_id)
    return {"can_settle": can_settle, "message": message}


@router.post("/tasks/settle", response_model=SampleTaskResponse, summary="结清任务")
def settle_task(settle_data: SettlementRequest, db: Session = Depends(get_db)):
    try:
        service = TaskService(db)
        task = service.settle_task(
            task_id=settle_data.task_id,
            operator_id=settle_data.operator_id,
            remark=settle_data.remark
        )
        return task
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/brand-batches", response_model=List[BrandBatchResponse], summary="获取品牌批次列表")
def get_brand_batches(db: Session = Depends(get_db)):
    batches = db.query(BrandBatch).all()
    return batches


@router.get("/talent-schedules", response_model=List[TalentScheduleResponse], summary="获取达人档期列表")
def get_talent_schedules(db: Session = Depends(get_db)):
    schedules = db.query(TalentSchedule).all()
    return schedules


@router.get("/tasks/{task_id}/deposits", response_model=List[DepositRecordResponse], summary="获取任务押金记录")
def get_task_deposits(task_id: int, db: Session = Depends(get_db)):
    deposits = db.query(DepositRecord).filter(DepositRecord.task_id == task_id).all()
    return deposits


@router.post("/users", response_model=dict, summary="创建用户")
def create_user(username: str, password: str, full_name: str = None, email: str = None, db: Session = Depends(get_db)):
    from app.models import User
    from app.security import hash_password
    
    existing_user = db.query(User).filter(User.username == username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    
    hashed_password = hash_password(password)
    user = User(
        username=username,
        full_name=full_name,
        email=email,
        hashed_password=hashed_password
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    return {"id": user.id, "username": user.username, "full_name": user.full_name}


@router.get("/users", response_model=List[dict], summary="获取用户列表")
def get_users(db: Session = Depends(get_db)):
    from app.models import User
    users = db.query(User).all()
    return [{"id": u.id, "username": u.username, "full_name": u.full_name} for u in users]


@router.get("/tasks/{task_id}/report", summary="生成任务最终报告（可追溯）")
def get_task_report(task_id: int, db: Session = Depends(get_db)):
    from app.export_service import ExportService
    try:
        export_service = ExportService(db)
        report = export_service.generate_task_report(task_id)
        return report
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/export/json", summary="批量导出任务为JSON格式")
def export_tasks_json(task_ids: List[int], db: Session = Depends(get_db)):
    from app.export_service import ExportService
    from fastapi.responses import Response
    
    export_service = ExportService(db)
    json_content = export_service.export_tasks_to_json(task_ids)
    
    return Response(
        content=json_content,
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename=tasks_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        }
    )


@router.post("/export/csv", summary="批量导出任务为CSV格式")
def export_tasks_csv(task_ids: List[int], db: Session = Depends(get_db)):
    from app.export_service import ExportService
    from fastapi.responses import Response
    
    export_service = ExportService(db)
    csv_content = export_service.export_tasks_to_csv(task_ids)
    
    return Response(
        content=csv_content.encode('utf-8-sig'),
        media_type="text/csv; charset=utf-8-sig",
        headers={
            "Content-Disposition": f"attachment; filename=tasks_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        }
    )


@router.get("/export/summary", summary="获取导出摘要")
def get_export_summary(
    status: str = None,
    category: str = None,
    db: Session = Depends(get_db)
):
    from app.export_service import ExportService
    from app.models import TaskStatus, DataCategory
    
    status_enum = TaskStatus(status) if status else None
    category_enum = DataCategory(category) if category else None
    
    export_service = ExportService(db)
    summary = export_service.export_all_tasks(
        status=status_enum,
        category=category_enum
    )
    return summary
