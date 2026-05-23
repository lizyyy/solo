from sqlalchemy.orm import Session
from sqlalchemy import func, case
from app import models, schemas
from typing import List
import io
import csv
from datetime import datetime


def get_report_summary(db: Session) -> schemas.ReportSummary:
    total = db.query(func.count(models.CleaningRecord.id)).scalar()
    
    status_counts = db.query(
        models.CleaningRecord.status,
        func.count(models.CleaningRecord.id)
    ).group_by(models.CleaningRecord.status).all()
    
    count_map = {status: 0 for status in models.RecordStatus}
    for status, count in status_counts:
        count_map[status] = count
    
    return schemas.ReportSummary(
        total_records=total,
        success_count=count_map[models.RecordStatus.SUCCESS],
        failed_count=count_map[models.RecordStatus.FAILED],
        pending_count=count_map[models.RecordStatus.PENDING],
        retrying_count=count_map[models.RecordStatus.RETRYING],
        manual_review_count=count_map[models.RecordStatus.MANUAL_REVIEW],
        dead_letter_count=count_map[models.RecordStatus.DEAD_LETTER],
        compensated_count=count_map[models.RecordStatus.COMPENSATED],
        closed_count=count_map[models.RecordStatus.CLOSED]
    )


def get_retry_category_stats(db: Session) -> List[schemas.RetryCategoryStats]:
    stats = db.query(
        models.CleaningRecord.retry_category,
        func.count(models.CleaningRecord.id),
        func.sum(
            case(
                (models.CleaningRecord.status == models.RecordStatus.SUCCESS, 1),
                else_=0
            )
        )
    ).filter(
        models.CleaningRecord.retry_category.isnot(None)
    ).group_by(models.CleaningRecord.retry_category).all()
    
    result = []
    for category, total, success_count in stats:
        success_rate = (success_count or 0) / total if total > 0 else 0.0
        result.append(schemas.RetryCategoryStats(
            category=category,
            count=total,
            success_rate=round(success_rate, 4)
        ))
    return result


def get_failed_records(db: Session, skip: int = 0, limit: int = 100) -> List[models.CleaningRecord]:
    return db.query(models.CleaningRecord).filter(
        models.CleaningRecord.status.in_([
            models.RecordStatus.FAILED,
            models.RecordStatus.DEAD_LETTER,
            models.RecordStatus.MANUAL_REVIEW
        ])
    ).order_by(models.CleaningRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_dead_letter_records(db: Session, skip: int = 0, limit: int = 100) -> List[models.CleaningRecord]:
    return db.query(models.CleaningRecord).filter(
        models.CleaningRecord.status == models.RecordStatus.DEAD_LETTER
    ).order_by(models.CleaningRecord.created_at.desc()).offset(skip).limit(limit).all()


def get_pending_retry_records(db: Session, skip: int = 0, limit: int = 100) -> List[models.CleaningRecord]:
    return db.query(models.CleaningRecord).filter(
        models.CleaningRecord.status == models.RecordStatus.RETRYING
    ).order_by(models.CleaningRecord.updated_at.desc()).offset(skip).limit(limit).all()


def get_manager_dashboard(db: Session) -> schemas.ManagerDashboard:
    summary = get_report_summary(db)
    retry_categories = get_retry_category_stats(db)
    dead_letter = get_dead_letter_records(db, limit=20)
    pending_retry = get_pending_retry_records(db, limit=20)
    
    return schemas.ManagerDashboard(
        summary=summary,
        retry_categories=retry_categories,
        dead_letter_records=[
            schemas.FailedRecordResponse.model_validate(r) for r in dead_letter
        ],
        pending_retry_records=[
            schemas.FailedRecordResponse.model_validate(r) for r in pending_retry
        ]
    )


def export_records_to_csv(db: Session, status_filter: models.RecordStatus = None) -> str:
    query = db.query(models.CleaningRecord)
    if status_filter:
        query = query.filter(models.CleaningRecord.status == status_filter)
    
    records = query.order_by(models.CleaningRecord.created_at.desc()).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '记录编号', '数据源', '房间号', '客人姓名', '入住日期', '退房日期',
        '状态', '重试分类', '重试次数', '最后错误', '创建时间', '审核备注'
    ])
    
    for r in records:
        writer.writerow([
            r.record_no,
            r.source.value if r.source else '',
            r.room_no or '',
            r.guest_name or '',
            r.checkin_date.strftime('%Y-%m-%d') if r.checkin_date else '',
            r.checkout_date.strftime('%Y-%m-%d') if r.checkout_date else '',
            r.status.value if r.status else '',
            r.retry_category.value if r.retry_category else '',
            r.retry_count,
            r.last_error or '',
            r.created_at.strftime('%Y-%m-%d %H:%M:%S') if r.created_at else '',
            r.review_comment or ''
        ])
    
    return output.getvalue()


def export_failed_records_to_csv(db: Session) -> str:
    records = get_failed_records(db, limit=10000)
    
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        '记录编号', '数据源', '房间号', '状态', '重试分类', '重试次数',
        '最后错误', '创建时间', '是否有效', '验证错误'
    ])
    
    for r in records:
        writer.writerow([
            r.record_no,
            r.source.value if r.source else '',
            r.room_no or '',
            r.status.value if r.status else '',
            r.retry_category.value if r.retry_category else '',
            r.retry_count,
            r.last_error or '',
            r.created_at.strftime('%Y-%m-%d %H:%M:%S') if r.created_at else '',
            r.is_valid,
            r.validation_errors or ''
        ])
    
    return output.getvalue()
