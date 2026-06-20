from datetime import datetime
from typing import List, Tuple, Optional
from models import (
    MergeRecord,
    Point,
    MergeSession,
    RecordStatus,
    RecordSource,
    PointStatus,
    ConflictEvidence,
)


def detect_conflicts(record: MergeRecord) -> List[ConflictEvidence]:
    conflicts = []

    if record.resident_complaint_id and record.intersection_photo_id:
        if record.house_number and "旧" in record.house_number:
            if not record.is_old_standard:
                conflicts.append(
                    ConflictEvidence(
                        field_name="门牌编号",
                        complaint_value=record.house_number,
                        photo_value=record.house_number.replace("旧", ""),
                        description="居民投诉使用旧门牌编号，路口照片显示新编号",
                    )
                )

    return conflicts


def _next_point_id(session: MergeSession) -> str:
    existing_ids = {p.point_id for p in session.points}
    for i in range(1, 1000):
        candidate = f"P-{i:03d}"
        if candidate not in existing_ids:
            return candidate
    raise RuntimeError("点位ID已用尽（超过999个）")


def process_normal_record(record: MergeRecord, session: MergeSession) -> Tuple[Point, MergeRecord]:
    record.add_audit_log("系统", "开始正常归并处理")

    point = Point(
        point_id=_next_point_id(session),
        house_number=record.house_number,
        address=record.address,
        status=PointStatus.ACTIVE,
        source_records=[record.record_id],
        remark="正常归并",
    )

    record.point_id = point.point_id
    record.update_status(RecordStatus.MERGED, "系统", "正常归并完成")
    session.points.append(point)

    return point, record


def process_temporary_detour(record: MergeRecord, session: MergeSession) -> Tuple[Optional[Point], MergeRecord]:
    record.add_audit_log("系统", "检测到施工临时改道标记")

    record.is_temporary_detour = True
    record.update_status(
        RecordStatus.PENDING_RESIDENT_REVIEW,
        "系统",
        "施工临时改道，地图未同步，留待居民代表复核，暂不归并",
    )

    return None, record


def process_supplementary_record(record: MergeRecord, session: MergeSession) -> Tuple[Point, MergeRecord]:
    record.add_audit_log("系统", "处理路口照片补录的旧口径记录")

    record.is_old_standard = True

    existing_point = None
    for p in session.points:
        if p.house_number == record.house_number.replace("旧", ""):
            existing_point = p
            break

    if existing_point:
        existing_point.source_records.append(record.record_id)
        existing_point.remark = f"{existing_point.remark}; 关联旧口径补录记录{record.record_id}"
        existing_point.updated_at = datetime.now()
        point = existing_point
    else:
        point = Point(
            point_id=_next_point_id(session),
            house_number=record.house_number,
            address=record.address,
            status=PointStatus.OLD_STANDARD,
            source_records=[record.record_id],
            remark="旧口径补录，路口照片补充",
        )
        session.points.append(point)

    record.point_id = point.point_id
    record.update_status(RecordStatus.SUPPLEMENTED, "系统", "旧口径补录完成")

    return point, record


def process_conflict(record: MergeRecord, session: MergeSession) -> MergeRecord:
    conflicts = detect_conflicts(record)
    record.conflicts = conflicts

    if conflicts:
        record.add_audit_log("系统", f"检测到{len(conflicts)}处冲突，需周姐确认")
        record.update_status(RecordStatus.CONFLICT, "系统", "存在冲突，待社区书记周姐确认")
    else:
        record.add_audit_log("系统", "冲突检查通过")

    return record


def resolve_conflict(
    record: MergeRecord,
    confirm: bool,
    session: MergeSession,
    operator: str = "周姐",
) -> Tuple[Optional[Point], MergeRecord]:
    if record.status != RecordStatus.CONFLICT:
        return None, record

    if confirm:
        record.add_audit_log(operator, "确认冲突，以路口照片为准")
        if record.is_temporary_detour:
            return process_temporary_detour(record, session)
        elif record.is_old_standard:
            return process_supplementary_record(record, session)
        else:
            return process_normal_record(record, session)
    else:
        record.update_status(RecordStatus.REJECTED, operator, "驳回冲突，不予归并")
        return None, record
