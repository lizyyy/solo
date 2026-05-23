from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime
import pandas as pd
import io
import uuid

from app.database import get_db
from app.models import User, ConsumableRecord, RecordType, WorkflowStatus, DirtyRecord, ImportBatch, DirtyType
from app.schemas import ConsumableRecordCreate, ConsumableRecordUpdate, ConsumableRecordResponse, DirtyRecordResponse, ImportResponse
from app.security import get_current_user, RoleChecker, filter_fields_by_role, mask_sensitive_data
from app.services import WorkflowService, DirtyRecordService, DataQualityChecker, AuditService, record_to_dict
from app.models import RoleEnum

router = APIRouter(prefix="/consumables", tags=["耗材管理"])


@router.post("/", response_model=ConsumableRecordResponse)
def create_record(
    record_data: ConsumableRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.create_record(db, record_data, current_user)
        AuditService.log_action(db, current_user, "create_record", "consumable", record.id)
        return record
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/", response_model=dict)
def list_records(
    record_type: Optional[RecordType] = None,
    status: Optional[WorkflowStatus] = None,
    department: Optional[str] = None,
    is_dirty: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(ConsumableRecord)

    if current_user.role == RoleEnum.ENTRY:
        query = query.filter(ConsumableRecord.created_by == current_user.id)

    if record_type:
        query = query.filter(ConsumableRecord.record_type == record_type)
    if status:
        query = query.filter(ConsumableRecord.status == status)
    if department:
        query = query.filter(ConsumableRecord.department == department)
    if is_dirty is not None:
        query = query.filter(ConsumableRecord.is_dirty == is_dirty)

    total = query.count()
    records = query.order_by(ConsumableRecord.created_at.desc()) \
        .offset((page - 1) * page_size) \
        .limit(page_size) \
        .all()

    filtered_records = []
    for record in records:
        record_dict = {c.name: getattr(record, c.name) for c in record.__table__.columns}
        for key, value in record_dict.items():
            if hasattr(value, 'value'):
                record_dict[key] = value.value
        filtered = filter_fields_by_role(record_dict, current_user)
        if current_user.role in [RoleEnum.READONLY, RoleEnum.SECRETARY]:
            filtered = mask_sensitive_data(filtered)
        filtered_records.append(filtered)

    return {
        "items": filtered_records,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{record_id}", response_model=ConsumableRecordResponse)
def get_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    record = db.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if current_user.role == RoleEnum.ENTRY and record.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="没有权限查看此记录")

    return record


@router.put("/{record_id}", response_model=ConsumableRecordResponse)
def update_record(
    record_id: int,
    update_data: ConsumableRecordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    try:
        record = WorkflowService.update_record(db, record_id, update_data, current_user)
        AuditService.log_action(db, current_user, "update_record", "consumable", record_id)
        return record
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{record_id}")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    record = db.query(ConsumableRecord).filter(ConsumableRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if record.status != WorkflowStatus.DRAFT:
        raise HTTPException(status_code=400, detail="只能删除草稿状态的记录")

    if record.created_by != current_user.id and current_user.role != RoleEnum.SUPERVISOR:
        raise HTTPException(status_code=403, detail="没有权限删除此记录")

    db.query(WorkflowLog).filter(WorkflowLog.record_id == record_id).delete()
    db.query(DirtyRecord).filter(DirtyRecord.original_record_id == record_id).delete()
    db.delete(record)
    db.commit()

    AuditService.log_action(db, current_user, "delete_record", "consumable", record_id)
    return {"message": "删除成功"}


@router.post("/import", response_model=ImportResponse)
async def import_records(
    record_type: RecordType,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.ENTRY, RoleEnum.SUPERVISOR]))
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持Excel或CSV文件")

    try:
        contents = await file.read()
        if file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(contents))
        else:
            df = pd.read_excel(io.BytesIO(contents))

        batch_no = f"IMP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{str(uuid.uuid4())[:4].upper()}"

        total_count = len(df)
        success_count = 0
        dirty_count = 0
        duplicate_count = 0

        for _, row in df.iterrows():
            try:
                record_data = ConsumableRecordCreate(
                    record_type=record_type,
                    title=str(row.get('title', row.get('标题', ''))),
                    department=str(row.get('department', row.get('部门', ''))),
                    research_group=str(row.get('research_group', row.get('课题组', ''))),
                    teacher_name=str(row.get('teacher_name', row.get('老师姓名', ''))),
                    material_name=str(row.get('material_name', row.get('耗材名称', ''))),
                    specification=str(row.get('specification', row.get('规格', ''))),
                    quantity=float(row.get('quantity', row.get('数量', 0)) or 0),
                    unit=str(row.get('unit', row.get('单位', ''))),
                    unit_price=float(row.get('unit_price', row.get('单价', 0)) or 0),
                    total_amount=float(row.get('total_amount', row.get('总金额', 0)) or 0),
                    supplier=str(row.get('supplier', row.get('供应商', ''))),
                    remarks=str(row.get('remarks', row.get('备注', '')))
                )

                if DataQualityChecker.check_duplicate(db, record_data):
                    duplicate_count += 1
                    continue

                record = WorkflowService.create_record(db, record_data, current_user)

                if record.is_dirty:
                    dirty_count += 1

                success_count += 1

            except Exception as e:
                db.rollback()
                continue

        import_batch = ImportBatch(
            batch_no=batch_no,
            file_name=file.filename,
            record_type=record_type,
            total_count=total_count,
            success_count=success_count,
            dirty_count=dirty_count,
            duplicate_count=duplicate_count,
            imported_by=current_user.id
        )
        db.add(import_batch)
        db.commit()

        AuditService.log_action(db, current_user, "import_records", "consumable", None, {"batch_no": batch_no})

        return ImportResponse(
            batch_no=batch_no,
            total_count=total_count,
            success_count=success_count,
            dirty_count=dirty_count,
            duplicate_count=duplicate_count,
            message=f"导入完成: 成功{success_count}条, 脏数据{dirty_count}条, 重复{duplicate_count}条"
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@router.get("/dirty/", response_model=List[DirtyRecordResponse])
def list_dirty_records(
    is_resolved: Optional[bool] = None,
    dirty_type: Optional[DirtyType] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    query = db.query(DirtyRecord)
    if is_resolved is not None:
        query = query.filter(DirtyRecord.is_resolved == is_resolved)
    if dirty_type:
        query = query.filter(DirtyRecord.dirty_type == dirty_type)

    return query.order_by(DirtyRecord.created_at.desc()).all()


@router.post("/dirty/{dirty_id}/resolve", response_model=DirtyRecordResponse)
def resolve_dirty_record(
    dirty_id: int,
    processing_opinion: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR]))
):
    try:
        dirty = DirtyRecordService.resolve_dirty_record(db, dirty_id, current_user, processing_opinion)
        AuditService.log_action(db, current_user, "resolve_dirty", "dirty_record", dirty_id)
        return dirty
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/dirty/{dirty_id}", response_model=DirtyRecordResponse)
def get_dirty_record(
    dirty_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(RoleChecker([RoleEnum.SUPERVISOR, RoleEnum.SECRETARY]))
):
    dirty = db.query(DirtyRecord).filter(DirtyRecord.id == dirty_id).first()
    if not dirty:
        raise HTTPException(status_code=404, detail="脏记录不存在")
    return dirty
