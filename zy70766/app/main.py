from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import Response, StreamingResponse
from sqlalchemy.orm import Session
from datetime import datetime
from typing import List, Optional
import io

from app.database import engine, get_db, Base
from app.models import LifecycleRule, StorageObject, PreviewReport, PreviewHit
from app.schemas import (
    LifecycleRule as LifecycleRuleSchema,
    LifecycleRuleCreate,
    LifecycleRuleUpdate,
    StorageObject as StorageObjectSchema,
    StorageObjectCreate,
    PreviewReport as PreviewReportSchema,
    PreviewReportCreate,
    PreviewHit as PreviewHitSchema,
    PreviewResult,
    PreviewStartResponse,
    BulkImportResponse,
    ErrorType,
    ErrorResponse
)
from app.lifecycle_engine import LifecycleMatcher
from app.report_generator import ReportGenerator

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="对象生命周期删除预演命中说明API",
    description="用于预览对象存储生命周期规则会删除哪些真实对象的后端服务",
    version="1.0.0"
)


def create_error_response(
    error_type: ErrorType,
    message: str,
    status_code: int,
    field: Optional[str] = None,
    details: Optional[dict] = None
) -> HTTPException:
    return HTTPException(
        status_code=status_code,
        detail={
            "error_type": error_type.value,
            "message": message,
            "field": field,
            "details": details
        }
    )


@app.post("/api/rules/", response_model=LifecycleRuleSchema, summary="创建生命周期规则")
def create_rule(rule: LifecycleRuleCreate, db: Session = Depends(get_db)):
    db_rule = LifecycleRule(**rule.model_dump())
    is_valid, error_msg = LifecycleMatcher.validate_rule(db_rule)
    if not is_valid:
        raise create_error_response(
            ErrorType.VALIDATION_ERROR,
            error_msg,
            400
        )
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.get("/api/rules/", response_model=List[LifecycleRuleSchema], summary="获取所有生命周期规则")
def list_rules(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    rules = db.query(LifecycleRule).offset(skip).limit(limit).all()
    return rules


@app.get("/api/rules/{rule_id}", response_model=LifecycleRuleSchema, summary="获取单个生命周期规则")
def get_rule(rule_id: int, db: Session = Depends(get_db)):
    rule = db.query(LifecycleRule).filter(LifecycleRule.id == rule_id).first()
    if not rule:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"规则 {rule_id} 不存在",
            404,
            field="rule_id"
        )
    return rule


@app.put("/api/rules/{rule_id}", response_model=LifecycleRuleSchema, summary="更新生命周期规则")
def update_rule(rule_id: int, rule_update: LifecycleRuleUpdate, db: Session = Depends(get_db)):
    db_rule = db.query(LifecycleRule).filter(LifecycleRule.id == rule_id).first()
    if not db_rule:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"规则 {rule_id} 不存在",
            404,
            field="rule_id"
        )

    update_data = rule_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_rule, field, value)

    is_valid, error_msg = LifecycleMatcher.validate_rule(db_rule)
    if not is_valid:
        raise create_error_response(
            ErrorType.VALIDATION_ERROR,
            error_msg,
            400
        )

    db.commit()
    db.refresh(db_rule)
    return db_rule


@app.delete("/api/rules/{rule_id}", summary="删除生命周期规则")
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = db.query(LifecycleRule).filter(LifecycleRule.id == rule_id).first()
    if not db_rule:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"规则 {rule_id} 不存在",
            404,
            field="rule_id"
        )
    db.delete(db_rule)
    db.commit()
    return {"message": "规则已删除"}


@app.post("/api/objects/", response_model=StorageObjectSchema, summary="创建存储对象")
def create_object(obj: StorageObjectCreate, db: Session = Depends(get_db)):
    db_obj = StorageObject(**obj.model_dump())
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return db_obj


@app.post("/api/objects/bulk", response_model=BulkImportResponse, summary="批量导入存储对象")
def bulk_import_objects(objects: List[StorageObjectCreate], db: Session = Depends(get_db)):
    success_count = 0
    failed_count = 0
    errors = []

    for idx, obj_data in enumerate(objects):
        try:
            db_obj = StorageObject(**obj_data.model_dump())
            db.add(db_obj)
            success_count += 1
        except Exception as e:
            failed_count += 1
            errors.append({
                "index": idx,
                "key": obj_data.key,
                "error": str(e)
            })

    db.commit()
    return BulkImportResponse(
        success_count=success_count,
        failed_count=failed_count,
        errors=errors
    )


@app.get("/api/objects/", response_model=List[StorageObjectSchema], summary="获取存储对象列表")
def list_objects(
    bucket: Optional[str] = None,
    prefix: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(StorageObject)
    if bucket:
        query = query.filter(StorageObject.bucket == bucket)
    if prefix:
        query = query.filter(StorageObject.key.startswith(prefix))
    objects = query.offset(skip).limit(limit).all()
    return objects


@app.delete("/api/objects/", summary="清空所有存储对象")
def clear_objects(db: Session = Depends(get_db)):
    count = db.query(StorageObject).count()
    db.query(StorageObject).delete()
    db.commit()
    return {"message": f"已删除 {count} 个对象"}


@app.post("/api/preview/start", response_model=PreviewStartResponse, summary="启动预演任务")
def start_preview(preview_create: PreviewReportCreate, db: Session = Depends(get_db)):
    rule = db.query(LifecycleRule).filter(LifecycleRule.id == preview_create.rule_id).first()
    if not rule:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"规则 {preview_create.rule_id} 不存在",
            404,
            field="rule_id"
        )

    if rule.status != "active" and rule.status != "draft":
        raise create_error_response(
            ErrorType.INVALID_STATUS,
            f"规则状态 '{rule.status}' 不允许预演，仅允许 active 或 draft 状态",
            400,
            details={"current_status": rule.status, "allowed_statuses": ["active", "draft"]}
        )

    existing_report = db.query(PreviewReport).filter(
        PreviewReport.rule_id == preview_create.rule_id,
        PreviewReport.name == preview_create.name,
        PreviewReport.status == "completed"
    ).first()

    if existing_report:
        raise create_error_response(
            ErrorType.ALREADY_PROCESSED,
            f"同名报告 '{preview_create.name}' 已存在且已完成",
            409,
            details={"existing_report_id": existing_report.id}
        )

    report = PreviewReport(
        rule_id=preview_create.rule_id,
        name=preview_create.name,
        status="running",
        started_at=datetime.utcnow()
    )
    db.add(report)
    db.commit()
    db.refresh(report)

    return PreviewStartResponse(
        report_id=report.id,
        status="running",
        message="预演任务已启动"
    )


@app.post("/api/preview/{report_id}/execute", response_model=PreviewResult, summary="执行预演")
def execute_preview(report_id: int, db: Session = Depends(get_db)):
    report = db.query(PreviewReport).filter(PreviewReport.id == report_id).first()
    if not report:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"报告 {report_id} 不存在",
            404,
            field="report_id"
        )

    if report.status == "completed":
        raise create_error_response(
            ErrorType.ALREADY_PROCESSED,
            "该报告已经执行过",
            400
        )

    if report.status != "running":
        raise create_error_response(
            ErrorType.INVALID_STATUS,
            f"报告状态 '{report.status}' 不允许执行，需要先启动",
            400
        )

    rule = db.query(LifecycleRule).filter(LifecycleRule.id == report.rule_id).first()
    if not rule:
        report.status = "failed"
        report.error_message = "规则不存在"
        db.commit()
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            "关联的规则不存在",
            404,
            field="rule_id"
        )

    objects = db.query(StorageObject).all()
    matcher = LifecycleMatcher(rule)
    preview_time = datetime.utcnow()

    total_size = sum(obj.size for obj in objects)
    hit_objects = 0
    hit_size = 0
    hits = []

    for obj in objects:
        is_match, reason, expiration_date = matcher.match_object(obj, preview_time)
        if is_match:
            hit_objects += 1
            hit_size += obj.size
            hit = PreviewHit(
                report_id=report.id,
                object_id=obj.id,
                object_key=obj.key,
                hit_reason=reason,
                action=rule.action,
                estimated_deletion_date=expiration_date,
                object_size=obj.size,
                last_modified=obj.last_modified
            )
            hits.append(hit)
            db.add(hit)

    requires_review = False
    review_reason = None

    if hit_objects > len(objects) * 0.5:
        requires_review = True
        review_reason = f"命中比例超过50% ({hit_objects}/{len(objects)})，请确认规则是否正确"

    if hit_size > total_size * 0.5:
        requires_review = True
        review_reason = f"命中存储占比超过50% ({ReportGenerator.format_size(hit_size)}/{ReportGenerator.format_size(total_size)})，请确认规则是否正确"

    report.total_objects = len(objects)
    report.hit_objects = hit_objects
    report.total_size = total_size
    report.hit_size = hit_size
    report.status = "completed"
    report.completed_at = datetime.utcnow()
    report.requires_manual_review = requires_review
    report.review_reason = review_reason

    db.commit()
    db.refresh(report)

    return PreviewResult(report=report, hits=hits)


@app.get("/api/preview/{report_id}", response_model=PreviewResult, summary="获取预演结果")
def get_preview_result(report_id: int, db: Session = Depends(get_db)):
    report = db.query(PreviewReport).filter(PreviewReport.id == report_id).first()
    if not report:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"报告 {report_id} 不存在",
            404,
            field="report_id"
        )

    if report.requires_manual_review:
        raise create_error_response(
            ErrorType.REQUIRES_MANUAL_REVIEW,
            report.review_reason or "该报告需要人工复核",
            403,
            details={"report_id": report_id, "hit_count": report.hit_objects}
        )

    hits = db.query(PreviewHit).filter(PreviewHit.report_id == report_id).all()
    return PreviewResult(report=report, hits=hits)


@app.get("/api/preview/{report_id}/export/csv", summary="导出预演报告为CSV")
def export_preview_csv(report_id: int, db: Session = Depends(get_db)):
    report = db.query(PreviewReport).filter(PreviewReport.id == report_id).first()
    if not report:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"报告 {report_id} 不存在",
            404,
            field="report_id"
        )

    if report.status != "completed":
        raise create_error_response(
            ErrorType.INVALID_STATUS,
            "报告尚未完成执行",
            400
        )

    hits = db.query(PreviewHit).filter(PreviewHit.report_id == report_id).all()
    csv_content = ReportGenerator.generate_csv(report, hits)

    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=preview_report_{report_id}.csv"}
    )


@app.get("/api/preview/{report_id}/export/markdown", summary="导出预演报告为Markdown")
def export_preview_markdown(report_id: int, db: Session = Depends(get_db)):
    report = db.query(PreviewReport).filter(PreviewReport.id == report_id).first()
    if not report:
        raise create_error_response(
            ErrorType.MISSING_FIELD,
            f"报告 {report_id} 不存在",
            404,
            field="report_id"
        )

    if report.status != "completed":
        raise create_error_response(
            ErrorType.INVALID_STATUS,
            "报告尚未完成执行",
            400
        )

    hits = db.query(PreviewHit).filter(PreviewHit.report_id == report_id).all()
    md_content = ReportGenerator.generate_markdown(report, hits)

    return Response(
        content=md_content,
        media_type="text/markdown",
        headers={"Content-Disposition": f"attachment; filename=preview_report_{report_id}.md"}
    )


@app.get("/api/preview/", response_model=List[PreviewReportSchema], summary="获取所有预演报告")
def list_previews(
    rule_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(PreviewReport)
    if rule_id:
        query = query.filter(PreviewReport.rule_id == rule_id)
    if status:
        query = query.filter(PreviewReport.status == status)
    reports = query.order_by(PreviewReport.created_at.desc()).offset(skip).limit(limit).all()
    return reports


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "lifecycle-preview-api"}
