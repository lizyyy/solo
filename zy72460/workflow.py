from typing import Dict, Any, List
from models import (
    ReviewSession,
    ConflictItem,
    ConflictResolution,
    RecordSource,
)
from core import get_point_records


def format_conflict_evidence(
    session: ReviewSession,
    conflict: ConflictItem,
) -> Dict[str, Any]:
    point = session.inspection_points.get(conflict.point_id)
    point_records = get_point_records(session, conflict.point_id)

    ramp_record = next(
        (r for r in point_records if r.record_id == conflict.ramp_record_id),
        None,
    )
    night_record = next(
        (r for r in point_records if r.record_id == conflict.night_sampling_id),
        None,
    )

    field_display = {
        "has_waterlogging": "是否积水",
        "ramp_accessible": "无障碍坡道是否可用",
    }

    def format_bool(v):
        return "是" if v else "否"

    return {
        "conflict_id": conflict.conflict_id,
        "point_info": {
            "point_id": conflict.point_id,
            "name": point.name if point else "未知点位",
            "street": point.location.street if point else "未知街道",
            "is_boundary": point.location.is_boundary if point else False,
        },
        "conflict_field": field_display.get(conflict.field_name, conflict.field_name),
        "evidence": [
            {
                "source": "无障碍坡道普查记录",
                "source_type": RecordSource.RAMP_SURVEY.value,
                "record_id": conflict.ramp_record_id,
                "inspector": ramp_record.inspector if ramp_record else "未知",
                "inspect_time": ramp_record.inspect_time.isoformat() if ramp_record else "未知",
                "value": format_bool(conflict.ramp_record_value),
                "ramp_note": ramp_record.ramp_note if ramp_record else None,
            },
            {
                "source": "夜间采样补录记录",
                "source_type": RecordSource.NIGHT_SAMPLING.value,
                "record_id": conflict.night_sampling_id,
                "inspector": night_record.inspector if night_record else "未知",
                "inspect_time": night_record.inspect_time.isoformat() if night_record else "未知",
                "value": format_bool(conflict.night_sampling_value),
                "remarks": night_record.remarks if night_record else None,
            },
        ],
        "resolution": conflict.resolution.value,
    }


def generate_handover_report(session: ReviewSession) -> Dict[str, Any]:
    pending_conflicts = [
        c for c in session.conflicts if c.resolution == ConflictResolution.PENDING
    ]
    boundary_points = [
        p for p in session.inspection_points.values() if p.location.is_boundary
    ]

    conflict_reports = [
        format_conflict_evidence(session, c) for c in pending_conflicts
    ]

    return {
        "task_name": session.task_name,
        "session_id": session.session_id,
        "current_step": f"第{session.current_step}步",
        "summary": {
            "total_points": len(session.inspection_points),
            "total_records": len(session.records),
            "pending_conflicts": len(pending_conflicts),
            "boundary_points": len(boundary_points),
            "export_count": len(session.export_history),
        },
        "action_items": {
            "inspector_actions": [
                f"请确认/驳回冲突 {c['conflict_id']}（点位：{c['point_info']['name']}）"
                for c in conflict_reports
            ],
            "manager_actions": [
                f"请复核边界点位 {p.point_id}（{p.name}，位于 {p.location.street} 与 {', '.join(p.location.adjacent_streets)} 交界）"
                for p in boundary_points
            ],
        },
        "conflict_details": conflict_reports,
        "boundary_details": [
            {
                "point_id": p.point_id,
                "name": p.name,
                "street": p.location.street,
                "adjacent_streets": p.location.adjacent_streets,
            }
            for p in boundary_points
        ],
    }


def advance_step(session: ReviewSession) -> ReviewSession:
    if session.current_step < 3:
        session.current_step += 1
    return session


def get_step_description(step: int) -> str:
    steps = {
        1: "第一步：无障碍坡道记录第一次导入",
        2: "第二步：市政巡检员小付补看夜间采样点",
        3: "第三步：地图导出更新",
    }
    return steps.get(step, "未知步骤")
