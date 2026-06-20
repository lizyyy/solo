import hashlib
import uuid
from datetime import datetime
from typing import List, Tuple, Dict
from collections import defaultdict

from models import (
    ReviewSession,
    SelfCheckResult,
    MapExport,
    RecordSource,
    ConflictResolution,
    AuditActionType,
)
from persistence import write_map_export_file, save_session
from database import save_session_to_db, SessionLocal


def run_all_checks(session: ReviewSession) -> Tuple[ReviewSession, List[SelfCheckResult]]:
    results = []

    check_functions = [
        check_duplicate_imports,
        check_boundary_points,
        check_supplementary_recalc,
        check_export_consistency,
    ]

    for check_fn in check_functions:
        session, result = check_fn(session)
        results.append(result)

    session.self_check_results = results
    return session, results


def check_duplicate_imports(session: ReviewSession) -> Tuple[ReviewSession, SelfCheckResult]:
    duplicates = defaultdict(list)

    for r in session.records:
        key = (r.point_id, r.source.value, r.inspect_time.isoformat())
        duplicates[key].append(r.record_id)

    duplicate_groups = {k: v for k, v in duplicates.items() if len(v) > 1}
    passed = len(duplicate_groups) == 0

    if passed:
        message = "未发现重复导入记录"
    else:
        message = f"发现 {len(duplicate_groups)} 组重复导入记录"

    result = SelfCheckResult(
        check_name="重复导入检查",
        passed=passed,
        message=message,
        details={
            "duplicate_count": len(duplicate_groups),
            "duplicate_groups": [
                {"point_id": k[0], "source": k[1], "inspect_time": k[2], "record_ids": v}
                for k, v in duplicate_groups.items()
            ],
        },
    )

    return session, result


def check_boundary_points(session: ReviewSession) -> Tuple[ReviewSession, SelfCheckResult]:
    boundary_points = [
        p for p in session.inspection_points.values() if p.location.is_boundary
    ]
    passed = len(boundary_points) == 0

    if passed:
        message = "无街道边界点位"
    else:
        message = f"发现 {len(boundary_points)} 个街道边界点位，需项目经理复核"

    result = SelfCheckResult(
        check_name="街道边界点位检查",
        passed=passed,
        message=message,
        details={
            "boundary_count": len(boundary_points),
            "boundary_points": [
                {
                    "point_id": p.point_id,
                    "name": p.name,
                    "street": p.location.street,
                    "adjacent_streets": p.location.adjacent_streets,
                }
                for p in boundary_points
            ],
        },
    )

    return session, result


def check_supplementary_recalc(session: ReviewSession) -> Tuple[ReviewSession, SelfCheckResult]:
    supplementary_records = [r for r in session.records if r.is_supplementary]
    affected_points = set(r.point_id for r in supplementary_records)

    issues = []
    for point_id in affected_points:
        point_records = [r for r in session.records if r.point_id == point_id]
        sources = set(r.source.value for r in point_records)

        if RecordSource.RAMP_SURVEY.value in sources and RecordSource.NIGHT_SAMPLING.value in sources:
            has_conflict = any(
                c.point_id == point_id and c.resolution == ConflictResolution.PENDING
                for c in session.conflicts
            )
            if has_conflict:
                issues.append({
                    "point_id": point_id,
                    "status": "存在未解决冲突",
                })

    passed = len(issues) == 0

    if passed:
        message = "补录数据已同步重算，无遗留问题"
    else:
        message = f"补录后有 {len(issues)} 个点位需重新确认"

    result = SelfCheckResult(
        check_name="补录后重算检查",
        passed=passed,
        message=message,
        details={
            "supplementary_record_count": len(supplementary_records),
            "affected_point_count": len(affected_points),
            "issues": issues,
        },
    )

    return session, result


def check_export_consistency(session: ReviewSession) -> Tuple[ReviewSession, SelfCheckResult]:
    if len(session.export_history) < 2:
        result = SelfCheckResult(
            check_name="导出一致性检查",
            passed=True,
            message="导出记录不足2次，跳过一致性比对",
            details={"export_count": len(session.export_history)},
        )
        return session, result

    latest = session.export_history[-1]
    previous = session.export_history[-2]

    consistent = True
    issues = []

    if latest.point_count != previous.point_count:
        consistent = False
        issues.append(
            f"点位数量变化: {previous.point_count} -> {latest.point_count}"
        )

    if set(latest.boundary_points) != set(previous.boundary_points):
        consistent = False
        added = set(latest.boundary_points) - set(previous.boundary_points)
        removed = set(previous.boundary_points) - set(latest.boundary_points)
        if added:
            issues.append(f"新增边界点位: {list(added)}")
        if removed:
            issues.append(f"移除边界点位: {list(removed)}")

    if set(latest.conflict_points) != set(previous.conflict_points):
        consistent = False
        added = set(latest.conflict_points) - set(previous.conflict_points)
        removed = set(previous.conflict_points) - set(latest.conflict_points)
        if added:
            issues.append(f"新增冲突点位: {list(added)}")
        if removed:
            issues.append(f"已解决冲突点位: {list(removed)}")

    result = SelfCheckResult(
        check_name="导出一致性检查",
        passed=consistent,
        message="历史导出数据一致" if consistent else "历史导出数据存在差异",
        details={
            "consistent": consistent,
            "issues": issues,
            "previous_export": previous.export_id,
            "latest_export": latest.export_id,
        },
    )

    return session, result


def generate_map_export(
    session: ReviewSession, exported_by: str
) -> Tuple[ReviewSession, MapExport]:
    boundary_points = [
        p.point_id for p in session.inspection_points.values() if p.location.is_boundary
    ]
    conflict_points = list(
        set(
            c.point_id
            for c in session.conflicts
            if c.resolution == ConflictResolution.PENDING
        )
    )

    records_snapshot = [r.to_dict() for r in session.records]
    conflicts_snapshot = [c.to_dict() for c in session.conflicts]
    audit_snapshot = [a.to_dict() for a in session.audit_log]

    points_detail = {
        pid: {
            "name": p.name,
            "lat": p.location.lat,
            "lng": p.location.lng,
            "street": p.location.street,
            "is_boundary": p.location.is_boundary,
            "adjacent_streets": p.location.adjacent_streets,
        }
        for pid, p in session.inspection_points.items()
    }

    content_str = (
        f"point_count:{len(session.inspection_points)}|"
        f"boundary:{','.join(sorted(boundary_points))}|"
        f"conflict:{','.join(sorted(conflict_points))}|"
        f"record_count:{len(session.records)}"
    )
    file_hash = hashlib.md5(content_str.encode()).hexdigest()

    export = MapExport(
        export_id=str(uuid.uuid4())[:8],
        export_time=datetime.now(),
        exported_by=exported_by,
        point_count=len(session.inspection_points),
        boundary_points=boundary_points,
        conflict_points=conflict_points,
        file_hash=file_hash,
        records_snapshot=records_snapshot,
        conflicts_snapshot=conflicts_snapshot,
        audit_snapshot=audit_snapshot,
    )

    export_data = export.to_dict()
    export_data["points_detail"] = points_detail

    file_path = write_map_export_file(session, export_data, export.export_id)
    export.file_path = file_path

    session.export_history.append(export)

    for entry in session.audit_log:
        if entry.related_export_id is None:
            entry.related_export_id = export.export_id

    from core import _add_audit
    _add_audit(
        session,
        AuditActionType.MAP_EXPORT,
        exported_by,
        f"地图导出 {export.export_id}，含 {len(records_snapshot)} 条记录、{len(conflicts_snapshot)} 个冲突",
        after_state={
            "export_id": export.export_id,
            "file_hash": file_hash,
            "file_path": file_path,
            "point_count": export.point_count,
            "boundary_count": len(boundary_points),
            "conflict_count": len(conflict_points),
        },
        related_export_id=export.export_id,
    )

    save_session(session)

    db = SessionLocal()
    try:
        save_session_to_db(db, session)
    finally:
        db.close()

    return session, export
