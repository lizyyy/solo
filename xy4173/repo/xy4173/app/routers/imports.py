from datetime import datetime
from typing import Dict, List, Optional, Any

from fastapi import APIRouter, Depends, File, UploadFile, Form, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.config import settings
from app.schemas.base import BaseResponse, SuccessResponse, ImportResult, ErrorDetail
from app.models import (
    User, Instrument, ResearchGroup, Reservation, SwipeLog,
    SampleRegistration, BillingRule, ImportBatch, AuditLog
)
from app.parsers.csv_parser import (
    parse_reservation_csv, parse_swipe_log_csv, parse_sample_registration_csv
)
from app.parsers.json_parser import parse_billing_rules_json
from app.parsers.base import ImportType
from app.utils.code_generator import generate_batch_code
from app.utils.sample_data import generate_sample_data


router = APIRouter(prefix="/import", tags=["数据导入"])


async def save_upload_file(file: UploadFile) -> str:
    """保存上传的文件"""
    import os
    import aiofiles
    
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    file_path = os.path.join(settings.UPLOAD_DIR, f"{timestamp}_{file.filename}")
    
    content = await file.read()
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    return file_path


def create_import_batch(db: Session, import_type: ImportType, 
                         file_name: str, total_records: int) -> ImportBatch:
    """创建导入批次记录"""
    batch = ImportBatch(
        batch_code=generate_batch_code(),
        import_type=import_type.value,
        file_name=file_name,
        total_records=total_records,
        status="processing",
        started_at=datetime.now()
    )
    db.add(batch)
    db.commit()
    db.refresh(batch)
    return batch


def complete_import_batch(db: Session, batch: ImportBatch,
                           imported: int, failed: int, skipped: int = 0,
                           error_message: str = None) -> ImportBatch:
    """完成导入批次"""
    batch.imported_records = imported
    batch.failed_records = failed
    batch.skipped_records = skipped
    batch.completed_at = datetime.now()
    batch.status = "completed" if failed == 0 else "completed_with_errors"
    if error_message:
        batch.error_message = error_message
    db.commit()
    db.refresh(batch)
    return batch


@router.post("/reservations", response_model=SuccessResponse)
async def import_reservations(
    file: UploadFile = File(..., description="预约单 CSV 文件"),
    db: Session = Depends(get_db)
):
    """导入预约单 CSV"""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持 CSV 文件")
    
    try:
        content = await file.read()
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('gbk')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    
    parse_result = parse_reservation_csv(text_content)
    
    batch = create_import_batch(
        db, ImportType.RESERVATION, 
        file.filename, parse_result.total_count
    )
    
    imported_count = 0
    failed_count = 0
    errors = []
    
    for row in parse_result.data:
        try:
            instrument = None
            if row.instrument_code:
                instrument = db.query(Instrument).filter(
                    Instrument.instrument_code == row.instrument_code
                ).first()
            
            user = None
            if row.user_id:
                user = db.query(User).filter(User.user_id == row.user_id).first()
            if not user and row.user_name:
                user = db.query(User).filter(User.name == row.user_name).first()
            
            research_group = None
            if row.group_code:
                research_group = db.query(ResearchGroup).filter(
                    ResearchGroup.group_code == row.group_code
                ).first()
            
            existing = db.query(Reservation).filter(
                Reservation.reservation_code == row.reservation_code
            ).first()
            
            if existing:
                existing.instrument_id = instrument.id if instrument else existing.instrument_id
                existing.user_id = user.id if user else existing.user_id
                existing.research_group_id = research_group.id if research_group else existing.research_group_id
                existing.start_time = row.start_time
                existing.end_time = row.end_time
                existing.purpose = row.purpose
                existing.status = row.status
                existing.import_batch_id = batch.id
            else:
                reservation = Reservation(
                    reservation_code=row.reservation_code,
                    instrument_id=instrument.id if instrument else None,
                    user_id=user.id if user else None,
                    research_group_id=research_group.id if research_group else None,
                    start_time=row.start_time,
                    end_time=row.end_time,
                    purpose=row.purpose,
                    status=row.status,
                    is_approved=True,
                    import_batch_id=batch.id
                )
                db.add(reservation)
            
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(ErrorDetail(
                field=row.reservation_code,
                message=str(e),
                code="IMPORT_ERROR"
            ))
    
    db.commit()
    
    complete_import_batch(db, batch, imported_count, failed_count)
    
    return SuccessResponse(
        success=failed_count == 0,
        message=f"导入完成: {imported_count} 成功, {failed_count} 失败",
        data={
            "batch_code": batch.batch_code,
            "total": parse_result.total_count,
            "imported": imported_count,
            "failed": failed_count,
            "errors": [
                {"field": e.field, "message": e.message, "code": e.code}
                for e in errors
            ]
        }
    )


@router.post("/swipe-logs", response_model=SuccessResponse)
async def import_swipe_logs(
    file: UploadFile = File(..., description="刷卡日志 CSV 文件"),
    db: Session = Depends(get_db)
):
    """导入刷卡日志 CSV"""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持 CSV 文件")
    
    try:
        content = await file.read()
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('gbk')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    
    parse_result = parse_swipe_log_csv(text_content)
    
    batch = create_import_batch(
        db, ImportType.SWIPE_LOG, 
        file.filename, parse_result.total_count
    )
    
    imported_count = 0
    failed_count = 0
    errors = []
    
    for row in parse_result.data:
        try:
            instrument = None
            if row.instrument_code:
                instrument = db.query(Instrument).filter(
                    Instrument.instrument_code == row.instrument_code
                ).first()
            
            user = None
            if row.user_id:
                user = db.query(User).filter(User.user_id == row.user_id).first()
            if not user and row.user_name:
                user = db.query(User).filter(User.name == row.user_name).first()
            if not user and row.card_number:
                user = db.query(User).filter(User.card_number == row.card_number).first()
            
            reservation = None
            if row.reservation_code:
                reservation = db.query(Reservation).filter(
                    Reservation.reservation_code == row.reservation_code
                ).first()
            
            swipe_log = SwipeLog(
                swipe_code=row.swipe_code,
                card_number=row.card_number,
                swipe_time=row.swipe_time,
                instrument_id=instrument.id if instrument else None,
                user_id=user.id if user else None,
                reservation_id=reservation.id if reservation else None,
                swipe_type=row.swipe_type,
                device_id=row.device_id,
                is_matched=reservation is not None,
                match_status="matched" if reservation else "unmatched",
                import_batch_id=batch.id
            )
            db.add(swipe_log)
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(ErrorDetail(
                field=row.card_number,
                message=str(e),
                code="IMPORT_ERROR"
            ))
    
    db.commit()
    
    complete_import_batch(db, batch, imported_count, failed_count)
    
    return SuccessResponse(
        success=failed_count == 0,
        message=f"导入完成: {imported_count} 成功, {failed_count} 失败",
        data={
            "batch_code": batch.batch_code,
            "total": parse_result.total_count,
            "imported": imported_count,
            "failed": failed_count,
            "errors": [
                {"field": e.field, "message": e.message, "code": e.code}
                for e in errors
            ]
        }
    )


@router.post("/samples", response_model=SuccessResponse)
async def import_samples(
    file: UploadFile = File(..., description="样品登记 CSV 文件"),
    db: Session = Depends(get_db)
):
    """导入样品登记 CSV"""
    if not file.filename or not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持 CSV 文件")
    
    try:
        content = await file.read()
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('gbk')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    
    parse_result = parse_sample_registration_csv(text_content)
    
    batch = create_import_batch(
        db, ImportType.SAMPLE_REGISTRATION, 
        file.filename, parse_result.total_count
    )
    
    imported_count = 0
    failed_count = 0
    errors = []
    
    for row in parse_result.data:
        try:
            user = None
            if row.user_id:
                user = db.query(User).filter(User.user_id == row.user_id).first()
            if not user and row.user_name:
                user = db.query(User).filter(User.name == row.user_name).first()
            
            existing = db.query(SampleRegistration).filter(
                SampleRegistration.sample_code == row.sample_code
            ).first()
            
            if existing:
                existing.user_id = user.id if user else existing.user_id
                existing.sample_type = row.sample_type
                existing.description = row.description
                existing.registered_at = row.registered_at
                existing.expected_pickup_at = row.expected_pickup_at
                existing.actual_pickup_at = row.actual_pickup_at
                existing.max_storage_hours = row.max_storage_hours
                existing.status = row.status
                existing.notes = row.notes
                existing.import_batch_id = batch.id
            else:
                sample = SampleRegistration(
                    sample_code=row.sample_code,
                    user_id=user.id if user else None,
                    sample_type=row.sample_type,
                    description=row.description,
                    registered_at=row.registered_at,
                    expected_pickup_at=row.expected_pickup_at,
                    actual_pickup_at=row.actual_pickup_at,
                    max_storage_hours=row.max_storage_hours,
                    status=row.status,
                    notes=row.notes,
                    import_batch_id=batch.id
                )
                db.add(sample)
            
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(ErrorDetail(
                field=row.sample_code,
                message=str(e),
                code="IMPORT_ERROR"
            ))
    
    db.commit()
    
    complete_import_batch(db, batch, imported_count, failed_count)
    
    return SuccessResponse(
        success=failed_count == 0,
        message=f"导入完成: {imported_count} 成功, {failed_count} 失败",
        data={
            "batch_code": batch.batch_code,
            "total": parse_result.total_count,
            "imported": imported_count,
            "failed": failed_count,
            "errors": [
                {"field": e.field, "message": e.message, "code": e.code}
                for e in errors
            ]
        }
    )


@router.post("/billing-rules", response_model=SuccessResponse)
async def import_billing_rules(
    file: UploadFile = File(..., description="计费规则 JSON 文件"),
    db: Session = Depends(get_db)
):
    """导入计费规则 JSON"""
    if not file.filename or not (file.filename.endswith('.json') or file.filename.endswith('.js')):
        raise HTTPException(status_code=400, detail="仅支持 JSON 文件")
    
    try:
        content = await file.read()
        text_content = content.decode('utf-8')
    except UnicodeDecodeError:
        text_content = content.decode('gbk')
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件读取失败: {str(e)}")
    
    parse_result = parse_billing_rules_json(text_content)
    
    if not parse_result.success:
        raise HTTPException(
            status_code=400, 
            detail=f"JSON 解析失败: {[e.message for e in parse_result.errors]}"
        )
    
    batch = create_import_batch(
        db, ImportType.BILLING_RULE, 
        file.filename, parse_result.total_count
    )
    
    imported_count = 0
    failed_count = 0
    errors = []
    
    for rule in parse_result.data:
        try:
            instrument = None
            if rule.instrument_code:
                instrument = db.query(Instrument).filter(
                    Instrument.instrument_code == rule.instrument_code
                ).first()
            
            research_group = None
            if rule.research_group_code:
                research_group = db.query(ResearchGroup).filter(
                    ResearchGroup.group_code == rule.research_group_code
                ).first()
            
            existing = db.query(BillingRule).filter(
                BillingRule.rule_code == rule.rule_code
            ).first()
            
            if existing:
                existing.name = rule.name
                existing.instrument_id = instrument.id if instrument else existing.instrument_id
                existing.research_group_id = research_group.id if research_group else existing.research_group_id
                existing.base_hourly_rate = rule.base_hourly_rate
                existing.overtime_rate_multiplier = rule.overtime_rate_multiplier
                existing.overtime_start_hours = rule.overtime_start_hours
                existing.night_rate_multiplier = rule.night_rate_multiplier
                existing.night_start_time = rule.night_start_time
                existing.night_end_time = rule.night_end_time
                existing.weekend_rate_multiplier = rule.weekend_rate_multiplier
                existing.discount_rate = rule.discount_rate
                existing.discount_reason = rule.discount_reason
                existing.priority = rule.priority
                existing.is_active = rule.is_active
                existing.valid_from = rule.valid_from
                existing.valid_to = rule.valid_to
            else:
                billing_rule = BillingRule(
                    rule_code=rule.rule_code,
                    name=rule.name,
                    instrument_id=instrument.id if instrument else None,
                    research_group_id=research_group.id if research_group else None,
                    base_hourly_rate=rule.base_hourly_rate,
                    overtime_rate_multiplier=rule.overtime_rate_multiplier,
                    overtime_start_hours=rule.overtime_start_hours,
                    night_rate_multiplier=rule.night_rate_multiplier,
                    night_start_time=rule.night_start_time,
                    night_end_time=rule.night_end_time,
                    weekend_rate_multiplier=rule.weekend_rate_multiplier,
                    discount_rate=rule.discount_rate,
                    discount_reason=rule.discount_reason,
                    priority=rule.priority,
                    is_active=rule.is_active,
                    valid_from=rule.valid_from,
                    valid_to=rule.valid_to
                )
                db.add(billing_rule)
            
            imported_count += 1
        except Exception as e:
            failed_count += 1
            errors.append(ErrorDetail(
                field=rule.rule_code,
                message=str(e),
                code="IMPORT_ERROR"
            ))
    
    db.commit()
    
    complete_import_batch(db, batch, imported_count, failed_count)
    
    return SuccessResponse(
        success=failed_count == 0,
        message=f"导入完成: {imported_count} 成功, {failed_count} 失败",
        data={
            "batch_code": batch.batch_code,
            "total": parse_result.total_count,
            "imported": imported_count,
            "failed": failed_count,
            "errors": [
                {"field": e.field, "message": e.message, "code": e.code}
                for e in errors
            ]
        }
    )


@router.post("/sample-data", response_model=SuccessResponse)
async def create_sample_data_endpoint(
    db: Session = Depends(get_db)
):
    """生成示例测试数据"""
    try:
        stats = generate_sample_data(db)
        
        return SuccessResponse(
            success=True,
            message="示例数据生成成功",
            data=stats
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"生成示例数据失败: {str(e)}")


@router.get("/batches", response_model=SuccessResponse)
async def list_import_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    import_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """获取导入批次列表"""
    query = db.query(ImportBatch)
    
    if import_type:
        query = query.filter(ImportBatch.import_type == import_type)
    
    total = query.count()
    
    batches = query.order_by(ImportBatch.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size).all()
    
    return SuccessResponse(
        success=True,
        message="获取导入批次列表成功",
        data={
            "total": total,
            "page": page,
            "page_size": page_size,
            "batches": [
                {
                    "id": b.id,
                    "batch_code": b.batch_code,
                    "import_type": b.import_type,
                    "file_name": b.file_name,
                    "total_records": b.total_records,
                    "imported_records": b.imported_records,
                    "failed_records": b.failed_records,
                    "status": b.status,
                    "created_at": b.created_at.isoformat() if b.created_at else None
                }
                for b in batches
            ]
        }
    )
