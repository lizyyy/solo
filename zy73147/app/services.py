from typing import List, Optional, Tuple
from datetime import datetime

from sqlalchemy.orm import Session

from app import models, schemas
from app.models import RecordStatus
from app.coordinates import normalize_pair
from app.calculator import (
    calculate_siltation,
    FORMULA_VERSION,
    get_fail_stage_description,
)
from app.remote_sensing import (
    detect_cloud_cover,
    build_gray_release_note,
    build_post_run_note,
    get_cloud_suspend_explanation,
)


STATUS_DESCRIPTIONS = {
    RecordStatus.PENDING: "待处理",
    RecordStatus.CALCULATING: "计算中",
    RecordStatus.SUCCESS: "计算成功",
    RecordStatus.FAILED_FORMULA: "计算失败-公式阶段",
    RecordStatus.FAILED_UNIT: "计算失败-单位阶段",
    RecordStatus.FAILED_THRESHOLD: "计算失败-阈值阶段",
    RecordStatus.SUSPENDED_CLOUD: "云遮挡挂起",
    RecordStatus.SUPPLEMENTED: "已补录",
}


def create_record(db: Session, data: schemas.SiltationRecordCreate) -> models.SiltationRecord:
    name_changed = data.original_name is not None and data.original_name != data.harbor_name
    record = models.SiltationRecord(
        record_no=data.record_no,
        harbor_name=data.harbor_name,
        original_name=data.original_name,
        name_changed=name_changed,
        raw_latitude=data.raw_latitude,
        raw_longitude=data.raw_longitude,
        raw_siltation_value=data.raw_siltation_value,
        raw_unit=data.raw_unit,
        status=RecordStatus.PENDING,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    process_record(db, record.id)
    return record


def process_record(db: Session, record_id: int) -> models.SiltationRecord:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {record_id}")

    record.status = RecordStatus.CALCULATING
    db.commit()

    lat_val, lon_val, lat_fmt, lon_fmt, coord_errors = normalize_pair(
        record.raw_latitude, record.raw_longitude
    )
    if lat_val is not None and lon_val is not None:
        record.latitude = lat_val
        record.longitude = lon_val
        record.coord_format_detected = lat_fmt
        record.coord_normalized = True

    record.formula_version = FORMULA_VERSION
    result = calculate_siltation(record.raw_siltation_value, record.raw_unit)
    record.status = result.status
    record.siltation_cm = result.siltation_cm
    record.fail_stage = result.fail_stage
    record.fail_reason = result.fail_reason

    if result.judgment is not None:
        if record.judgment_after is None:
            record.judgment_before = result.judgment
        else:
            record.judgment_before = record.judgment_after
        record.judgment_after = result.judgment
        record.judgment_changed = record.judgment_before != record.judgment_after

        if record.judgment_changed:
            log = models.RejudgeLog(
                record_id=record.id,
                before_judgment=record.judgment_before,
                after_judgment=record.judgment_after,
                reason="淤积量重算后触发自动改判",
                triggered_by="system",
            )
            db.add(log)

    for img in record.images:
        if img.has_cloud_cover or img.cloud_cover_ratio > 0:
            cloud_result = detect_cloud_cover(img.cloud_cover_ratio)
            if cloud_result.should_suspend:
                record.status = RecordStatus.SUSPENDED_CLOUD
                break

    db.commit()
    db.refresh(record)
    return record


def add_remote_sensing_image(db: Session, data: schemas.RemoteSensingImageCreate) -> models.RemoteSensingImage:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == data.record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {data.record_id}")

    lat_val, lon_val, lat_fmt, lon_fmt, coord_errors = normalize_pair(
        data.raw_latitude or record.raw_latitude,
        data.raw_longitude or record.raw_longitude,
    )

    img = models.RemoteSensingImage(
        record_id=data.record_id,
        image_path=data.image_path,
        capture_time=data.capture_time,
        has_cloud_cover=data.has_cloud_cover,
        cloud_cover_ratio=data.cloud_cover_ratio,
        raw_latitude=data.raw_latitude,
        raw_longitude=data.raw_longitude,
        latitude=lat_val,
        longitude=lon_val,
        coord_format_detected=lat_fmt,
        coord_normalized=lat_val is not None,
        remark=data.remark,
    )
    db.add(img)

    cloud_result = detect_cloud_cover(data.cloud_cover_ratio)
    if cloud_result.should_suspend:
        record.status = RecordStatus.SUSPENDED_CLOUD
        sup_note = models.SupplementNote(
            record_id=record.id,
            note_type="cloud_suspend",
            content=get_cloud_suspend_explanation(data.cloud_cover_ratio),
            operator="system",
            affected_judgments="; ".join(cloud_result.affected_judgments),
        )
        db.add(sup_note)

    db.commit()
    db.refresh(img)
    return img


def add_gray_release_note(db: Session, data: schemas.GrayReleaseNoteUpdate) -> models.SiltationRecord:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == data.record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {data.record_id}")

    note = build_gray_release_note(
        changed_fields=data.changed_fields,
        before_judgment=record.judgment_before,
        after_judgment=record.judgment_after,
    )
    if data.remark:
        note += f" 人工补充说明: {data.remark}"

    record.gray_release_note = note

    sup = models.SupplementNote(
        record_id=record.id,
        note_type="gray_release",
        content=note,
        operator="gray_release",
        affected_judgments="判定依据已更新，详见备注",
    )
    db.add(sup)
    record.is_supplemented = True
    record.supplement_count += 1

    db.commit()
    db.refresh(record)
    return record


def add_post_run_supplement(db: Session, data: schemas.PostRunSupplement) -> models.SiltationRecord:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == data.record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {data.record_id}")

    sup = models.SupplementNote(
        record_id=record.id,
        note_type="post_run",
        content=data.content,
        operator=data.operator or "system",
        affected_judgments="; ".join([d.field_name for d in data.export_diffs]) if data.export_diffs else None,
    )
    db.add(sup)

    for diff in data.export_diffs:
        last_export = db.query(models.ExportRecord).filter(
            models.ExportRecord.record_id == record.id
        ).order_by(models.ExportRecord.export_version.desc()).first()
        next_version = (last_export.export_version + 1) if last_export else 1

        export = models.ExportRecord(
            record_id=record.id,
            export_batch_no=f"BATCH_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}",
            export_version=next_version,
            field_name=diff.field_name,
            old_value=diff.old_value,
            new_value=diff.new_value,
            change_reason=diff.change_reason,
        )
        db.add(export)

    note = build_post_run_note(
        supplement_count=1,
        judgment_changed=record.judgment_changed,
        export_diffs=[d.model_dump() for d in data.export_diffs],
    )
    record.post_run_note = note
    record.is_supplemented = True
    record.supplement_count += 1
    record.status = RecordStatus.SUPPLEMENTED

    db.commit()
    db.refresh(record)
    return record


def retry_failed_record(db: Session, record_id: int) -> models.SiltationRecord:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == record_id).first()
    if not record:
        raise ValueError(f"记录不存在: {record_id}")
    return process_record(db, record_id)


def get_record_detail(db: Session, record_id: int) -> Optional[schemas.SiltationRecordDetail]:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == record_id).first()
    if not record:
        return None

    fail_stage_desc = None
    if record.fail_stage:
        fail_stage_desc = get_fail_stage_description(record.fail_stage)

    exports = db.query(models.ExportRecord).filter(models.ExportRecord.record_id == record.id).all()
    export_diffs = [
        schemas.ExportDiff(
            field_name=e.field_name,
            old_value=e.old_value,
            new_value=e.new_value,
            change_reason=e.change_reason,
        )
        for e in exports
    ]

    return schemas.SiltationRecordDetail(
        id=record.id,
        record_no=record.record_no,
        harbor_name=record.harbor_name,
        original_name=record.original_name,
        name_changed=record.name_changed,
        raw_latitude=record.raw_latitude,
        raw_longitude=record.raw_longitude,
        latitude=record.latitude,
        longitude=record.longitude,
        coord_format_detected=record.coord_format_detected,
        coord_normalized=record.coord_normalized,
        raw_siltation_value=record.raw_siltation_value,
        raw_unit=record.raw_unit,
        siltation_cm=record.siltation_cm,
        formula_version=record.formula_version,
        status=record.status,
        fail_stage=record.fail_stage,
        fail_reason=record.fail_reason,
        fail_stage_desc=fail_stage_desc,
        judgment_before=record.judgment_before,
        judgment_after=record.judgment_after,
        judgment_changed=record.judgment_changed,
        is_supplemented=record.is_supplemented,
        supplement_count=record.supplement_count,
        gray_release_note=record.gray_release_note,
        post_run_note=record.post_run_note,
        supplements=record.supplements,
        rejudge_logs=record.rejudge_logs,
        export_diffs=export_diffs,
    )


def get_manager_view(db: Session, record_id: int) -> Optional[schemas.ManagerRecordView]:
    record = db.query(models.SiltationRecord).filter(models.SiltationRecord.id == record_id).first()
    if not record:
        return None

    supplement_tags = []
    for sup in record.supplements:
        if sup.note_type == "gray_release":
            supplement_tags.append("灰度发布补录")
        elif sup.note_type == "post_run":
            supplement_tags.append("运行后补录")
        elif sup.note_type == "cloud_suspend":
            supplement_tags.append("云遮挡挂起")
        else:
            supplement_tags.append(f"补录:{sup.note_type}")

    rejudge_reasons = [log.reason for log in record.rejudge_logs if log.reason]

    cloud_suspended = record.status == RecordStatus.SUSPENDED_CLOUD
    cloud_explanation = None
    if cloud_suspended:
        cloud_sup = next((s for s in record.supplements if s.note_type == "cloud_suspend"), None)
        cloud_explanation = cloud_sup.content if cloud_sup else None

    return schemas.ManagerRecordView(
        id=record.id,
        record_no=record.record_no,
        harbor_name=record.harbor_name,
        status=record.status,
        status_desc=STATUS_DESCRIPTIONS.get(record.status, str(record.status)),
        siltation_cm=record.siltation_cm,
        judgment=record.judgment_after,
        is_supplemented=record.is_supplemented,
        supplement_count=record.supplement_count,
        supplement_tags=supplement_tags,
        judgment_changed=record.judgment_changed,
        before_judgment=record.judgment_before,
        after_judgment=record.judgment_after,
        rejudge_reasons=rejudge_reasons,
        fail_stage=record.fail_stage,
        fail_reason=record.fail_reason,
        cloud_suspended=cloud_suspended,
        cloud_explanation=cloud_explanation,
        created_at=record.created_at,
        updated_at=record.updated_at,
    )


def list_manager_records(db: Session, skip: int = 0, limit: int = 100) -> List[schemas.ManagerRecordView]:
    records = db.query(models.SiltationRecord).offset(skip).limit(limit).all()
    return [get_manager_view(db, r.id) for r in records if r]
