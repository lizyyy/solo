from typing import Optional, List, Dict
import json
from datetime import datetime

from sqlalchemy.orm import Session

from .models import (
    RangefinderRecord, ObstacleRemark, RemarkChangeLog,
    ReplaySnapshot, ReplayReport, CoordType, ReplayStage,
)
from .coord_utils import detect_coord_type, compute_record_hash


def import_rangefinder_records(db: Session, batch_id: str, records: List[Dict]) -> Dict:
    imported = 0
    skipped = 0
    mixed_count = 0

    for rec in records:
        raw_data = rec.get("raw_data", "")
        recorded_at = rec.get("recorded_at")
        record_hash = compute_record_hash(batch_id, raw_data, recorded_at)

        existing = db.query(RangefinderRecord).filter(
            RangefinderRecord.record_hash == record_hash
        ).first()
        if existing:
            skipped += 1
            continue

        coord_type = detect_coord_type(raw_data)
        needs_review = coord_type == CoordType.MIXED

        row = RangefinderRecord(
            batch_id=batch_id,
            record_hash=record_hash,
            raw_data=raw_data,
            coord_type=coord_type,
            lat_value=rec.get("lat"),
            lng_value=rec.get("lng"),
            metric_x=rec.get("metric_x"),
            metric_y=rec.get("metric_y"),
            metric_z=rec.get("metric_z"),
            distance=rec.get("distance"),
            recorded_at=recorded_at,
            needs_review=needs_review,
        )
        db.add(row)
        db.flush()
        imported += 1
        if needs_review:
            mixed_count += 1

        snapshot_data = {
            "batch_id": batch_id,
            "raw_data": raw_data,
            "coord_type": coord_type.value,
            "needs_review": needs_review,
            "stage": ReplayStage.IMPORTED.value,
        }
        snapshot = ReplaySnapshot(
            rangefinder_record_id=row.id,
            stage=ReplayStage.IMPORTED,
            snapshot_data=snapshot_data,
            model_params_version=rec.get("model_params_version"),
            model_params_reason=rec.get("model_params_reason"),
        )
        db.add(snapshot)

    db.commit()
    return {
        "imported": imported,
        "skipped_duplicates": skipped,
        "mixed_coord_count": mixed_count,
    }


def add_obstacle_remark(db: Session, record_id: str, author: str, content: str) -> ObstacleRemark:
    remark = ObstacleRemark(
        rangefinder_record_id=record_id,
        author=author,
        content=content,
    )
    db.add(remark)
    db.flush()

    record = db.query(RangefinderRecord).filter(RangefinderRecord.id == record_id).first()
    if record and record.coord_type == CoordType.MIXED and not record.needs_review:
        record.needs_review = True

    _advance_snapshot(db, record, ReplayStage.ENGINEER_REVIEWED, author)
    db.commit()
    return remark


def update_obstacle_remark(
    db: Session, remark_id: str, new_content: str, changed_by: str, reason: Optional[str] = None
) -> ObstacleRemark:
    remark = db.query(ObstacleRemark).filter(ObstacleRemark.id == remark_id).first()
    if not remark:
        raise ValueError("Remark not found")

    if remark.content != new_content:
        change_log = RemarkChangeLog(
            obstacle_remark_id=remark.id,
            field_name="content",
            old_value=remark.content,
            new_value=new_content,
            changed_by=changed_by,
            reason=reason,
        )
        db.add(change_log)
        remark.content = new_content
        remark.updated_at = datetime.utcnow().isoformat()

        record = db.query(RangefinderRecord).filter(
            RangefinderRecord.id == remark.rangefinder_record_id
        ).first()
        _advance_snapshot(db, record, ReplayStage.ENGINEER_REVIEWED, changed_by)

    db.commit()
    return remark


def get_remark_change_history(db: Session, remark_id: str) -> List[RemarkChangeLog]:
    return db.query(RemarkChangeLog).filter(
        RemarkChangeLog.obstacle_remark_id == remark_id
    ).order_by(RemarkChangeLog.changed_at).all()


def update_crew_briefing(
    db: Session,
    record_id: str,
    why_kept: str,
    missing_materials: str,
    next_step_owner: str,
    next_step_description: str,
    param_version: Optional[str] = None,
    param_tradeoff_reason: Optional[str] = None,
) -> ReplayReport:
    record = db.query(RangefinderRecord).filter(RangefinderRecord.id == record_id).first()
    if not record:
        raise ValueError("Record not found")

    if record.coord_type == CoordType.MIXED and not record.needs_review:
        record.needs_review = True

    snapshot = _advance_snapshot(db, record, ReplayStage.CREW_BRIEFED, next_step_owner)

    report = ReplayReport(
        replay_snapshot_id=snapshot.id,
        why_kept=why_kept,
        missing_materials=missing_materials,
        next_step_owner=next_step_owner,
        next_step_description=next_step_description,
        param_version=param_version,
        param_tradeoff_reason=param_tradeoff_reason,
    )
    db.add(report)
    db.commit()
    return report


def _advance_snapshot(db: Session, record: Optional[RangefinderRecord], stage: ReplayStage, actor: str) -> ReplaySnapshot:
    if not record:
        raise ValueError("Record not found")

    remarks = db.query(ObstacleRemark).filter(
        ObstacleRemark.rangefinder_record_id == record.id
    ).all()

    snapshot_data = {
        "batch_id": record.batch_id,
        "raw_data": record.raw_data,
        "coord_type": record.coord_type.value,
        "needs_review": record.needs_review,
        "stage": stage.value,
        "actor": actor,
        "remarks": [
            {"id": r.id, "author": r.author, "content": r.content, "updated_at": r.updated_at}
            for r in remarks
        ],
    }

    snapshot = ReplaySnapshot(
        rangefinder_record_id=record.id,
        stage=stage,
        snapshot_data=snapshot_data,
        model_params_version=None,
        model_params_reason=None,
    )
    db.add(snapshot)
    db.flush()
    return snapshot


def get_snapshot_history(db: Session, record_id: str) -> List[ReplaySnapshot]:
    return db.query(ReplaySnapshot).filter(
        ReplaySnapshot.rangefinder_record_id == record_id
    ).order_by(ReplaySnapshot.created_at).all()


def get_traceback(db: Session, record_id: str) -> Dict:
    record = db.query(RangefinderRecord).filter(RangefinderRecord.id == record_id).first()
    if not record:
        raise ValueError("Record not found")

    remarks = db.query(ObstacleRemark).filter(
        ObstacleRemark.rangefinder_record_id == record_id
    ).all()
    snapshots = db.query(ReplaySnapshot).filter(
        ReplaySnapshot.rangefinder_record_id == record_id
    ).order_by(ReplaySnapshot.created_at).all()
    reports = []
    for snap in snapshots:
        rpts = db.query(ReplayReport).filter(
            ReplayReport.replay_snapshot_id == snap.id
        ).all()
        reports.extend(rpts)

    return {
        "record": {
            "id": record.id,
            "batch_id": record.batch_id,
            "raw_data": record.raw_data,
            "coord_type": record.coord_type.value,
            "needs_review": record.needs_review,
            "recorded_at": record.recorded_at,
            "imported_at": record.imported_at,
        },
        "remarks": [
            {
                "id": r.id,
                "author": r.author,
                "content": r.content,
                "created_at": r.created_at,
                "updated_at": r.updated_at,
            }
            for r in remarks
        ],
        "snapshots": [
            {
                "id": s.id,
                "stage": s.stage.value,
                "snapshot_data": s.snapshot_data,
                "created_at": s.created_at,
            }
            for s in snapshots
        ],
        "reports": [
            {
                "id": r.id,
                "why_kept": r.why_kept,
                "missing_materials": r.missing_materials,
                "next_step_owner": r.next_step_owner,
                "next_step_description": r.next_step_description,
                "param_version": r.param_version,
                "param_tradeoff_reason": r.param_tradeoff_reason,
            }
            for r in reports
        ],
    }


def generate_report_text(db: Session, report_id: str) -> str:
    report = db.query(ReplayReport).filter(ReplayReport.id == report_id).first()
    if not report:
        raise ValueError("Report not found")

    snapshot = db.query(ReplaySnapshot).filter(
        ReplaySnapshot.id == report.replay_snapshot_id
    ).first()
    record = db.query(RangefinderRecord).filter(
        RangefinderRecord.id == snapshot.rangefinder_record_id
    ).first()

    lines = []
    lines.append("=" * 60)
    lines.append("港口堆场箱位回放 — 现场班组说明")
    lines.append("=" * 60)
    lines.append("")
    lines.append(f"记录编号: {record.id}")
    lines.append(f"批次: {record.batch_id}")
    lines.append(f"坐标类型: {record.coord_type.value}")
    if record.coord_type == CoordType.MIXED:
        lines.append("⚠️  本条记录经纬度与米制坐标混用，已标记待巡检组复核，请勿直接判正常。")
    lines.append(f"录入时间: {record.imported_at}")
    lines.append("")

    lines.append("【为什么保留这条】")
    lines.append(f"  {report.why_kept or '（未填写）'}")
    lines.append("")

    lines.append("【还缺什么材料】")
    lines.append(f"  {report.missing_materials or '（未填写）'}")
    lines.append("")

    lines.append("【下一步该找谁】")
    owner_label = _owner_label(report.next_step_owner)
    lines.append(f"  找 {owner_label}：{report.next_step_description or '（未填写）'}")
    lines.append("")

    if report.param_version:
        lines.append("【参数版本与取舍理由】")
        lines.append(f"  参数版本: {report.param_version}")
        lines.append(f"  取舍理由: {report.param_tradeoff_reason or '（未填写）'}")
        lines.append("")

    lines.append("-" * 60)
    lines.append("本说明由系统自动生成，如有疑问请联系巡检组或设备工程师许工。")
    lines.append("=" * 60)
    return "\n".join(lines)


def _owner_label(owner: Optional[str]) -> str:
    if not owner:
        return "（未指定）"
    mapping = {
        "inspection": "巡检组",
        "engineer_xu": "设备工程师许工",
        "crew": "现场班组",
    }
    return mapping.get(owner, owner)
