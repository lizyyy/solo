import sys

CONTENT = r"""from typing import List, Optional, Tuple
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


FINAL_STATUSES = {
    RecordStatus.MERGED,
    RecordStatus.SUPPLEMENTED,
    RecordStatus.REJECTED,
    RecordStatus.PENDING_RESIDENT_REVIEW,
    RecordStatus.CONFLICT,
}


def _shell_quote(s: str) -> str:
    if " " in s or "'" in s or '"' in s:
        return "'" + s.replace("'", "'\\''") + "'"
    return s


def _record_exists_by_complaint_id(session: MergeSession, complaint_id: str) -> bool:
    for r in session.records:
        if r.resident_complaint_id == complaint_id:
            return True
    return False


def _is_record_processed(record: MergeRecord) -> bool:
    return record.point_id is not None or record.status in FINAL_STATUSES


def step1_import_complaints(
    session: MergeSession,
    records_data_source: str,
) -> MergeSession:
    records_data = load_complaints(records_data_source)

    cmd = f"python3 main.py import --session {session.session_id} --data {_shell_quote(records_data_source)}"
    session.add_replay_command(cmd)

    skipped = 0
    imported = 0
    for idx, data in enumerate(records_data):
        complaint_id = data.get("complaint_id", f"C-{idx + 1:03d}")

        if _record_exists_by_complaint_id(session, complaint_id):
            skipped += 1
            continue

        existing_record_ids = {r.record_id for r in session.records}
        new_num = 1
        while f"R-{new_num:03d}" in existing_record_ids:
            new_num += 1
        new_record_id = f"R-{new_num:03d}"

        record = MergeRecord(
            record_id=new_record_id,
            house_number=data["house_number"],
            address=data["address"],
            source=RecordSource.RESIDENT_COMPLAINT,
            status=RecordStatus.IMPORTED,
            resident_complaint_id=complaint_id,
            is_temporary_detour=data.get("is_temporary_detour", False),
            is_old_standard=data.get("is_old_standard", False),
            remark=data.get("remark", ""),
        )
        record.add_audit_log("系统", f"居民投诉编号导入: {complaint_id}")
        session.records.append(record)
        imported += 1

    session.add_replay_command(
        f'echo "  [导入] 新增{imported}条，跳过已有{skipped}条，共{len(session.records)}条记录"'
    )
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

    reviewed = 0
    skipped_final = 0
    skipped_no_record = 0
    already_done = 0

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
            skipped_no_record += 1
            continue

        if record.intersection_photo_id == photo_id and _is_record_processed(record):
            already_done += 1
            continue

        if record.status in FINAL_STATUSES and record.intersection_photo_id:
            skipped_final += 1
            continue

        if record.intersection_photo_id is None:
            record.intersection_photo_id = photo_id
            record.add_audit_log(reviewer, f"关联路口照片: {photo_id}")
        else:
            record.add_audit_log(reviewer, f"确认路口照片: {photo_id}")

        if mark_detour and not record.is_temporary_detour:
            record.is_temporary_detour = True
            record.add_audit_log(reviewer, "标记: 施工临时改道，地图未同步")

        if mark_old_standard and not record.is_old_standard:
            record.is_old_standard = True
            record.add_audit_log(reviewer, "标记: 旧口径，从路口照片补录")

        if record.status == RecordStatus.IMPORTED:
            record.update_status(RecordStatus.PENDING_REVIEW_PHOTO, reviewer, "路口照片审核完成")
        else:
            record.add_audit_log(reviewer, "照片信息已更新，状态保持不变")

        reviewed += 1

    session.add_replay_command(
        f'echo "  [审核] 新审核{reviewed}条，已处理跳过{already_done}条，终态跳过{skipped_final}条，无记录跳过{skipped_no_record}条"'
    )
    return session


def step3_update_points(
    session: MergeSession,
    operator: str = "系统",
) -> Tuple[MergeSession, List[dict]]:
    cmd = f"python3 main.py update-points --session {session.session_id}"
    session.add_replay_command(cmd)

    results = []
    processed = 0
    skipped = 0

    for record in session.records:
        if record.status != RecordStatus.PENDING_REVIEW_PHOTO:
            if record.status == RecordStatus.IMPORTED:
                skipped += 1
            continue

        if _is_record_processed(record):
            skipped += 1
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
            processed += 1
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
        processed += 1

    session.completed_at = datetime.now()
    merged_count = sum(1 for r in session.records if r.status == RecordStatus.MERGED)
    supp_count = sum(1 for r in session.records if r.status == RecordStatus.SUPPLEMENTED)
    pending_count = sum(1 for r in session.records if r.status == RecordStatus.PENDING_RESIDENT_REVIEW)
    conflict_count = sum(1 for r in session.records if r.status == RecordStatus.CONFLICT)
    session.add_replay_command(
        f'echo "  [更新点位] 新处理{processed}条，跳过{skipped}条；'
        f'已归并{merged_count}条，已补录{supp_count}条，待复核{pending_count}条，冲突{conflict_count}条"'
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

    record = None
    for r in session.records:
        if r.record_id == record_id:
            record = r
            break

    if not record:
        session.add_replay_command(f'echo "  [冲突处理] 记录{record_id}不存在，跳过"')
        return session, None

    if record.status != RecordStatus.CONFLICT:
        session.add_replay_command(
            f'echo "  [冲突处理] 记录{record_id}当前状态为{record.status.value}，非冲突状态，跳过"'
        )
        return session, None

    session.add_replay_command(
        f'echo "  [冲突处理] {operator}对{record_id}{"确认" if confirm else "驳回"}"'
    )

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

    record = None
    for r in session.records:
        if r.record_id == record_id:
            record = r
            break

    if not record:
        session.add_replay_command(f'echo "  [居民复核] 记录{record_id}不存在，跳过"')
        return session

    if record.status != RecordStatus.PENDING_RESIDENT_REVIEW:
        session.add_replay_command(
            f'echo "  [居民复核] 记录{record_id}当前状态为{record.status.value}，无需复核，跳过"'
        )
        return session

    session.add_replay_command(
        f'echo "  [居民复核] {operator}对{record_id}{"通过" if approved else "不通过"}"'
    )

    if approved:
        existing_point_ids = {p.point_id for p in session.points}
        new_num = 1
        while f"P-{new_num:03d}" in existing_point_ids:
            new_num += 1

        point = Point(
            point_id=f"P-{new_num:03d}",
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
"""

with open("workflow.py", "w", encoding="utf-8") as f:
    f.write(CONTENT)

print("workflow.py written successfully, lines:", len(CONTENT.splitlines())
