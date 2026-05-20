from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date

from app.core.database import get_db
from app.models.models import RecordType, DataSource, ProcessingStatus, Batch
from app.schemas.schemas import UploadResponse, ResultQueryResponse, ReportResponse
from app.services.data_import import (
    generate_batch_hash, check_duplicate_batch, create_batch,
    parse_checkin_csv, parse_leave_json, parse_location_summary,
    save_checkin_records, save_leave_records, save_location_records
)
from app.services.rules_engine import RulesEngine

router = APIRouter(prefix="/api/v1", tags=["community-correction"])


@router.post("/upload/checkin", response_model=UploadResponse)
async def upload_checkin(
    file: UploadFile = File(...),
    source: DataSource = Query(DataSource.OTHER, description="数据来源"),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        content_str = content.decode("utf-8")
        
        batch_hash = generate_batch_hash(content_str, RecordType.CHECKIN)
        
        if check_duplicate_batch(db, batch_hash):
            raise HTTPException(
                status_code=400,
                detail=f"该批次数据已存在，请勿重复提交。批次哈希: {batch_hash[:16]}..."
            )
        
        valid_records, invalid_records = parse_checkin_csv(content_str)
        
        if not valid_records:
            raise HTTPException(
                status_code=400,
                detail="没有有效的签到记录"
            )
        
        batch = create_batch(db, batch_hash, RecordType.CHECKIN, source, len(valid_records))
        
        saved_records = save_checkin_records(db, valid_records, source)
        
        engine = RulesEngine(db)
        processed_results = []
        for record in saved_records:
            result = engine.process_checkin_record(record)
            processed_results.append(result)
        
        engine.save_processing_results(batch.id, RecordType.CHECKIN, processed_results)
        
        normal_items = [r for r in processed_results if r.status == ProcessingStatus.NORMAL]
        pending_items = [r for r in processed_results if r.status == ProcessingStatus.PENDING_CONFIRM]
        failed_items = [r for r in processed_results if r.status == ProcessingStatus.FAILED]
        
        for invalid in invalid_records:
            failed_items.append({
                "person_id": str(invalid.get('data', {}).get('person_id', 'unknown')),
                "person_name": str(invalid.get('data', {}).get('person_name', '')),
                "status": ProcessingStatus.FAILED,
                "rule_code": "PARSE_ERROR",
                "rule_name": "数据解析失败",
                "suggestion": f"第{invalid.get('row', '?')}行数据格式错误，请检查并重新提交",
                "original_data": invalid.get('data'),
                "detail": invalid.get('error')
            })
        
        batch.processed = True
        db.commit()
        
        return UploadResponse(
            batch_id=batch.id,
            batch_hash=batch_hash,
            record_type=RecordType.CHECKIN,
            total_records=len(valid_records) + len(invalid_records),
            normal_count=len(normal_items),
            pending_confirm_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_confirm_items=pending_items,
            failed_items=failed_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/upload/leave", response_model=UploadResponse)
async def upload_leave(
    file: UploadFile = File(...),
    source: DataSource = Query(DataSource.OTHER, description="数据来源"),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        content_str = content.decode("utf-8")
        
        batch_hash = generate_batch_hash(content_str, RecordType.LEAVE)
        
        if check_duplicate_batch(db, batch_hash):
            raise HTTPException(
                status_code=400,
                detail=f"该批次数据已存在，请勿重复提交。批次哈希: {batch_hash[:16]}..."
            )
        
        valid_records, invalid_records = parse_leave_json(content_str)
        
        if not valid_records:
            raise HTTPException(
                status_code=400,
                detail="没有有效的请假记录"
            )
        
        batch = create_batch(db, batch_hash, RecordType.LEAVE, source, len(valid_records))
        
        saved_records = save_leave_records(db, valid_records, source)
        
        normal_items = []
        for record in saved_records:
            normal_items.append({
                "person_id": record.person_id,
                "person_name": record.person_name,
                "status": ProcessingStatus.NORMAL,
                "rule_code": "LEAVE_APPROVED",
                "rule_name": "请假已批准",
                "suggestion": "请假记录已保存，可用于签到时的请假覆盖判断",
                "original_data": record.raw_data,
                "detail": f"请假时间: {record.start_time} 至 {record.end_time}"
            })
        
        pending_items = []
        failed_items = []
        
        for invalid in invalid_records:
            failed_items.append({
                "person_id": str(invalid.get('data', {}).get('person_id', 'unknown')),
                "person_name": str(invalid.get('data', {}).get('person_name', '')),
                "status": ProcessingStatus.FAILED,
                "rule_code": "PARSE_ERROR",
                "rule_name": "数据解析失败",
                "suggestion": f"第{invalid.get('index', '?')}条数据格式错误，请检查并重新提交",
                "original_data": invalid.get('data'),
                "detail": invalid.get('error')
            })
        
        batch.processed = True
        db.commit()
        
        return UploadResponse(
            batch_id=batch.id,
            batch_hash=batch_hash,
            record_type=RecordType.LEAVE,
            total_records=len(valid_records) + len(invalid_records),
            normal_count=len(normal_items),
            pending_confirm_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_confirm_items=pending_items,
            failed_items=failed_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.post("/upload/location", response_model=UploadResponse)
async def upload_location(
    file: UploadFile = File(...),
    source: DataSource = Query(DataSource.OTHER, description="数据来源"),
    db: Session = Depends(get_db)
):
    try:
        content = await file.read()
        content_str = content.decode("utf-8")
        
        batch_hash = generate_batch_hash(content_str, RecordType.LOCATION)
        
        if check_duplicate_batch(db, batch_hash):
            raise HTTPException(
                status_code=400,
                detail=f"该批次数据已存在，请勿重复提交。批次哈希: {batch_hash[:16]}..."
            )
        
        valid_records, invalid_records = parse_location_summary(content_str)
        
        if not valid_records:
            raise HTTPException(
                status_code=400,
                detail="没有有效的定位摘要记录"
            )
        
        batch = create_batch(db, batch_hash, RecordType.LOCATION, source, len(valid_records))
        
        saved_records = save_location_records(db, valid_records, source)
        
        engine = RulesEngine(db)
        processed_results = []
        for record in saved_records:
            result = engine.process_location_record(record)
            processed_results.append(result)
        
        engine.save_processing_results(batch.id, RecordType.LOCATION, processed_results)
        
        normal_items = [r for r in processed_results if r.status == ProcessingStatus.NORMAL]
        pending_items = [r for r in processed_results if r.status == ProcessingStatus.PENDING_CONFIRM]
        failed_items = [r for r in processed_results if r.status == ProcessingStatus.FAILED]
        
        for invalid in invalid_records:
            failed_items.append({
                "person_id": str(invalid.get('data', {}).get('person_id', 'unknown')),
                "person_name": str(invalid.get('data', {}).get('person_name', '')),
                "status": ProcessingStatus.FAILED,
                "rule_code": "PARSE_ERROR",
                "rule_name": "数据解析失败",
                "suggestion": f"第{invalid.get('index', '?')}条数据格式错误，请检查并重新提交",
                "original_data": invalid.get('data'),
                "detail": invalid.get('error')
            })
        
        batch.processed = True
        db.commit()
        
        return UploadResponse(
            batch_id=batch.id,
            batch_hash=batch_hash,
            record_type=RecordType.LOCATION,
            total_records=len(valid_records) + len(invalid_records),
            normal_count=len(normal_items),
            pending_confirm_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_confirm_items=pending_items,
            failed_items=failed_items
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"处理失败: {str(e)}")


@router.get("/results", response_model=List[ResultQueryResponse])
def get_results(
    person_id: Optional[str] = Query(None, description="按人员ID筛选"),
    status: Optional[ProcessingStatus] = Query(None, description="按处理状态筛选"),
    record_type: Optional[RecordType] = Query(None, description="按记录类型筛选"),
    batch_id: Optional[int] = Query(None, description="按批次ID筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    from app.models.models import ProcessingResult as DBProcessingResult
    
    query = db.query(DBProcessingResult)
    
    if person_id:
        query = query.filter(DBProcessingResult.person_id == person_id)
    if status:
        query = query.filter(DBProcessingResult.status == status)
    if record_type:
        query = query.filter(DBProcessingResult.record_type == record_type)
    if batch_id:
        query = query.filter(DBProcessingResult.batch_id == batch_id)
    
    results = query.order_by(DBProcessingResult.created_at.desc()).offset(skip).limit(limit).all()
    
    return [
        ResultQueryResponse(
            id=r.id,
            batch_id=r.batch_id,
            record_type=r.record_type,
            person_id=r.person_id,
            person_name=r.person_name,
            status=r.status,
            rule_code=r.rule_code,
            rule_name=r.rule_name,
            suggestion=r.suggestion,
            original_data=r.original_data,
            detail=r.detail,
            created_at=r.created_at
        )
        for r in results
    ]


@router.get("/results/{result_id}", response_model=ResultQueryResponse)
def get_result_detail(
    result_id: int,
    db: Session = Depends(get_db)
):
    from app.models.models import ProcessingResult as DBProcessingResult
    
    result = db.query(DBProcessingResult).filter(DBProcessingResult.id == result_id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="处理结果不存在")
    
    return ResultQueryResponse(
        id=result.id,
        batch_id=result.batch_id,
        record_type=result.record_type,
        person_id=result.person_id,
        person_name=result.person_name,
        status=result.status,
        rule_code=result.rule_code,
        rule_name=result.rule_name,
        suggestion=result.suggestion,
        original_data=result.original_data,
        detail=result.detail,
        created_at=result.created_at
    )


@router.get("/report", response_model=ReportResponse)
def get_report(
    start_date: Optional[date] = Query(None, description="开始日期"),
    end_date: Optional[date] = Query(None, description="结束日期"),
    db: Session = Depends(get_db)
):
    from app.models.models import ProcessingResult as DBProcessingResult
    from sqlalchemy import func
    
    query = db.query(DBProcessingResult)
    
    if start_date:
        query = query.filter(func.date(DBProcessingResult.created_at) >= start_date)
    if end_date:
        query = query.filter(func.date(DBProcessingResult.created_at) <= end_date)
    
    all_results = query.all()
    
    person_stats = {}
    for r in all_results:
        if r.person_id not in person_stats:
            person_stats[r.person_id] = {
                'person_name': r.person_name,
                'total_checkins': 0,
                'checkin_failed': 0,
                'leave_count': 0,
                'location_gaps': 0,
                'max_gap_minutes': 0,
                'issues': [],
                'worst_status': ProcessingStatus.NORMAL
            }
        
        if r.record_type == RecordType.CHECKIN:
            person_stats[r.person_id]['total_checkins'] += 1
            if r.status == ProcessingStatus.FAILED:
                person_stats[r.person_id]['checkin_failed'] += 1
        
        if r.record_type == RecordType.LEAVE:
            person_stats[r.person_id]['leave_count'] += 1
        
        if r.record_type == RecordType.LOCATION:
            if r.rule_code and 'GAP' in r.rule_code:
                person_stats[r.person_id]['location_gaps'] += 1
        
        if r.status == ProcessingStatus.FAILED:
            person_stats[r.person_id]['worst_status'] = ProcessingStatus.FAILED
            person_stats[r.person_id]['issues'].append({
                'rule_code': r.rule_code,
                'rule_name': r.rule_name,
                'detail': r.detail,
                'suggestion': r.suggestion
            })
        elif r.status == ProcessingStatus.PENDING_CONFIRM and person_stats[r.person_id]['worst_status'] == ProcessingStatus.NORMAL:
            person_stats[r.person_id]['worst_status'] = ProcessingStatus.PENDING_CONFIRM
            person_stats[r.person_id]['issues'].append({
                'rule_code': r.rule_code,
                'rule_name': r.rule_name,
                'detail': r.detail,
                'suggestion': r.suggestion
            })
    
    from app.schemas.schemas import ReportItem
    
    details = []
    for person_id, stats in person_stats.items():
        details.append(ReportItem(
            person_id=person_id,
            person_name=stats['person_name'],
            total_checkins=stats['total_checkins'],
            checkin_failed=stats['checkin_failed'],
            leave_count=stats['leave_count'],
            location_gaps=stats['location_gaps'],
            max_gap_minutes=stats['max_gap_minutes'],
            overall_status=stats['worst_status'],
            issues=stats['issues']
        ))
    
    normal_count = sum(1 for d in details if d.overall_status == ProcessingStatus.NORMAL)
    pending_count = sum(1 for d in details if d.overall_status == ProcessingStatus.PENDING_CONFIRM)
    failed_count = sum(1 for d in details if d.overall_status == ProcessingStatus.FAILED)
    
    return ReportResponse(
        start_date=start_date,
        end_date=end_date,
        total_persons=len(details),
        normal_count=normal_count,
        pending_confirm_count=pending_count,
        failed_count=failed_count,
        details=details
    )


@router.get("/batches")
def get_batches(
    record_type: Optional[RecordType] = None,
    processed: Optional[bool] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Batch)
    
    if record_type:
        query = query.filter(Batch.record_type == record_type)
    if processed is not None:
        query = query.filter(Batch.processed == processed)
    
    batches = query.order_by(Batch.uploaded_at.desc()).offset(skip).limit(limit).all()
    
    return [
        {
            "id": b.id,
            "batch_hash": b.batch_hash,
            "record_type": b.record_type,
            "source": b.source,
            "uploaded_at": b.uploaded_at,
            "total_records": b.total_records,
            "processed": b.processed
        }
        for b in batches
    ]
