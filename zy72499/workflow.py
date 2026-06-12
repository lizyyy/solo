from typing import List, Optional, Tuple
from datetime import datetime
from models import (
    MergeSession,
    MergeRecord,
    Point,
    RecordStatus,
    RecordSource,
    PointStatus,
)
from engine import (
    process_normal_record,
    process_temporary_detour,
    process_supplementary_record,
    process_conflict,
    resolve_conflict,
)
from sample_data import load_complaints, load_photo_mappings


def _shell_quote(s: str) -> str:
    if " " in s or "'" in s or '"' in s:
        return "'" + s.replace("'", "'\\''") + "'"
    return s


def step1_import_complaints(
    session: MergeSession,
    records_data_source: str,
) -> MergeSession:
    records_data = load_complaints(records_data_source)

    cmd = f"python3 main.py import --session {session.session_id} --data {_shell_quote(records_data_source)}"
    session.add_replay_command(cmd)
    session.add_replay_command(f'echo "  [导入] 已载入 {len(records_data)} 条居民投诉记录"')

    for idx, data in enumerate(records_data):
        record = MergeRecord(
            record_id=f"R-{len(session.records) + 1:03d}",
            house_number=data["house_number"],
            address=data["address"],
            source=RecordSource.RESIDENT_COMPLAINT,
            status=RecordStatus.IMPORTED,
            resident_complaint_id=data.get("complaint_id", f"C-{idx + 1:03d}"),
            is_temporary_detour=data.get("is_temporary_detour", False),
            is_old_standard=data.get("is_old_standard", False),
            remark=data.get("remark", ""),
        )
        record.add_audit_log("系统", f"居民投诉编号导入: {record.resident_complaint_id}")
        session.records.append(record)

    return session


def step2_review_photos(
    session: MergeSession,
    photo_mappings_source: str,
    reviewer: str = "周姐",
) -> MergeSession:
    photo_mappings = load_photo_mappings(photo_mappings_source)

    cmd = (
        f"python3 main.py review-photos --session {session.session_id} "
        f"--data {_shell_quote(photo_mappings_source)} --reviewer {_shell_quote(reviewer)}"
    )
    session.add_replay_command(cmd)
    session.add_replay_command(f'echo "  [审核] {reviewer} 已审核 {len(photo_mappings)} 张路口照片"')

    for mapping in photo_mappings:
        record_id = mapping["record_id"]
        photo_id = mapping["photo_id"]
        mark_detour = mapping.get("mark_detour", False)
        mark_old_standard = mapping.get("mark_old_standard", False)

        record = None
        for r in session.records:
            if r.record_id == record_id:
                record = r
                break

        if not record:
            continue

        record.intersection_photo_id = photo_id
        record.add_audit_log(reviewer, f"关联路口照片: {photo_id}")

        if mark_detour:
            record.is_temporary_detour = True
            record.add_audit_log(reviewer, "标记: 施工临时改道，地图未同步")

        if mark_old_standard:
            record.is_old_standard = True
            record.add_audit_log(reviewer, "标记: 旧口径，从路口照片补录")

        record.update_status(RecordStatus.PENDING_REVIEW_PHOTO, reviewer, "路口照片审核完成")

    return session


def step3_update_points(
    session: MergeSession,
    operator: str = "系统",
) -> Tuple[MergeSession, List[dict]]:
    cmd = f"python3 main.py update-points --session {session.session_id}"
    session.add_replay_command(cmd)

    results = []

    for record in session.records:
        if record.status != RecordStatus.PENDING_REVIEW_PHOTO:
            continue

        record = process_conflict(record, session)

        if record.status == RecordStatus.CONFLICT:
            results.append(
                {
                    "record_id": record.record_id,
                    "action": "conflict",
                    "conflicts": [c.description for c in record.conflicts],
                }
            )
            continue

        if record.is_temporary_detour:
            point, record = process_temporary_detour(record, session)
            results.append(
                {
                    "record_id": record.record_id,
                    "action": "pending_resident_review",
                    "point_id": None,
                    "status": record.status.value,
                }
            )
        elif record.is_old_standard:
            point, record = process_supplementary_record(record, session)
            results.append(
                {
                    "record_id": record.record_id,
                    "action": "supplemented",
                    "point_id": point.point_id if point else None,
                    "status": record.status.value,
                }
            )
        else:
            point, record = process_normal_record(record, session)
            results.append(
                {
                    "record_id": record.record_id,
                    "action": "merged",
                    "point_id": point.point_id if point else None,
                    "status": record.status.value,
                }
            )

    session.completed_at = datetime.now()
    merged_count = sum(1 for r in session.records if r.status == RecordStatus.MERGED)
    supp_count = sum(1 for r in session.records if r.status == RecordStatus.SUPPLEMENTED)
    pending_count = sum(1 for r in session.records if r.status == RecordStatus.PENDING_RESIDENT_REVIEW)
    conflict_count = sum(1 for r in session.records if r.status == RecordStatus.CONFLICT)
    session.add_replay_command(
        f'echo "  [更新点位] 已归并{merged_count}条，已补录{supp_count}条，'
        f'待复核{pending_count}条，冲突{conflict_count}条"'
    )
    return session, results


def resolve_conflict_interactive(
    session: MergeSession,
    record_id: str,
    confirm: bool,
    operator: str = "周姐",
) -> Tuple[MergeSession, Optional[Point]]:
    action = "confirm" if confirm else "reject"
    cmd = (
        f"python3 main.py resolve-conflict --session {session.session_id} "
        f"--record {record_id} --{action} --operator {_shell_quote(operator)}"
    )
    session.add_replay_command(cmd)
    session.add_replay_command(
        f'echo "  [冲突处理] {operator}对{record_id}{"确认" if confirm else "驳回"}"'
    )

    record = None
    for r in session.records:
        if r.record_id == record_id:
            record = r
            break

    if not record:
        return session, None

    point, record = resolve_conflict(record, confirm, session, operator)
    return session, point


def resident_review_complete(
    session: MergeSession,
    record_id: str,
    approved: bool,
    operator: str = "居民代表",
) -> MergeSession:
    action = "approve" if approved else "reject"
    cmd = (
        f"python3 main.py resident-review --session {session.session_id} "
        f"--record {record_id} --{action} --operator {_shell_quote(operator)}"
    )
    session.add_replay_command(cmd)
    session.add_replay_command(
        f'echo "  [居民复核] {operator}对{record_id}{"通过" if approved else "不通过"}"'
    )

    record = None
    for r in session.records:
        if r.record_id == record_id:
            record = r
            break

    if not record or record.status != RecordStatus.PENDING_RESIDENT_REVIEW:
        return session

    if approved:
        point = Point(
            point_id=f"P-{len(session.points) + 1:03d}",
            house_number=record.house_number,
            address=record.address,
            status=PointStatus.TEMPORARY_DETOUR,
            source_records=[record.record_id],
            remark="施工临时改道，居民代表复核通过",
        )
        session.points.append(point)
        record.point_id = point.point_id
        record.update_status(RecordStatus.MERGED, operator, "居民代表复核通过，归并为施工临时改道点位")
    else:
        record.update_status(RecordStatus.REJECTED, operator, "居民代表复核不通过")

    return session
