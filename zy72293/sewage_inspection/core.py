from __future__ import annotations

from datetime import datetime
from typing import Optional

from .models import (
    AuditEntry,
    CoordinateRow,
    FloorProfile,
    InspectionProject,
    NextAction,
    ObstacleRemark,
    OcclusionPoint,
    OcclusionStatus,
    PhotoLocation,
    WorkflowPhase,
)

COORDINATE_TOLERANCE = 0.5


def find_matching_coordinate(
    photo_loc: PhotoLocation, rows: list[CoordinateRow]
) -> Optional[CoordinateRow]:
    for row in rows:
        if (
            abs(row.x - photo_loc.x) <= COORDINATE_TOLERANCE
            and abs(row.y - photo_loc.y) <= COORDINATE_TOLERANCE
            and abs(row.z - photo_loc.z) <= COORDINATE_TOLERANCE
        ):
            return row
    return None


def detect_inconsistencies(project: InspectionProject) -> list[OcclusionPoint]:
    new_points: list[OcclusionPoint] = []
    existing_photo_ids = {op.photo_location_id for op in project.occlusion_points}

    for photo_loc in project.photo_locations:
        if photo_loc.id in existing_photo_ids:
            continue

        match = find_matching_coordinate(photo_loc, project.coordinate_rows)
        if match is None:
            reason = (
                f"照片 {photo_loc.photo_ref} 标注了点位 "
                f"({photo_loc.x:.2f}, {photo_loc.y:.2f}, {photo_loc.z:.2f})，"
                f"但坐标表中无对应行（容差 ±{COORDINATE_TOLERANCE}）"
            )
            missing = "坐标表缺少该点位行"
            if photo_loc.obstacle_remark_id:
                missing += "；关联障碍物备注已确认，但坐标未补录"
            else:
                missing += "；未关联障碍物备注，需确认是否遗漏"

            next_action = NextAction.SAFETY_OFFICER
            if photo_loc.obstacle_remark_id:
                remark = _find_obstacle_remark(project, photo_loc.obstacle_remark_id)
                if remark and remark.severity.value in ("high", "critical"):
                    next_action = NextAction.INSTRUCTOR_LIANG

            now = datetime.now().isoformat()
            entry = AuditEntry(
                timestamp=now,
                action="created",
                from_status="",
                to_status=OcclusionStatus.PENDING_REVIEW.value,
                from_reason="",
                to_reason=reason,
                from_missing_material="",
                to_missing_material=missing,
                from_next_action="",
                to_next_action=next_action.value,
                changed_by="system_detect",
                change_cause="照片有点位但坐标表缺一行，自动检测生成",
                note="原始检测：不要急着归正常，留给安全员复核",
            )

            op = OcclusionPoint(
                photo_location_id=photo_loc.id,
                photo_ref=photo_loc.photo_ref,
                point_x=photo_loc.x,
                point_y=photo_loc.y,
                point_z=photo_loc.z,
                status=OcclusionStatus.PENDING_REVIEW,
                reason=reason,
                missing_material=missing,
                next_action=next_action,
                obstacle_remark_id=photo_loc.obstacle_remark_id,
                floor_profile_id=photo_loc.floor_profile_id,
                original_reason=reason,
                original_missing_material=missing,
                original_next_action=next_action.value,
                audit_trail=[entry],
            )
            new_points.append(op)

    return new_points


def resolve_occlusion_points(
    project: InspectionProject,
) -> list[OcclusionPoint]:
    resolved: list[OcclusionPoint] = []
    now = datetime.now().isoformat()
    for op in project.occlusion_points:
        if op.status != OcclusionStatus.PENDING_REVIEW:
            continue
        photo_loc = _find_photo_location(project, op.photo_location_id)
        if photo_loc is None:
            continue
        match = find_matching_coordinate(photo_loc, project.coordinate_rows)
        if match is not None:
            old_reason = op.reason
            old_missing = op.missing_material
            old_next = op.next_action.value

            new_reason = op.original_reason
            new_missing = f"已通过补录坐标表解决（匹配坐标行: {match.point_label}）"
            new_next = NextAction.SAFETY_OFFICER.value

            entry = AuditEntry(
                timestamp=now,
                action="resolved_by_coordinate",
                from_status=OcclusionStatus.PENDING_REVIEW.value,
                to_status=OcclusionStatus.RESOLVED.value,
                from_reason=old_reason,
                to_reason=new_reason,
                from_missing_material=old_missing,
                to_missing_material=new_missing,
                from_next_action=old_next,
                to_next_action=new_next,
                changed_by="system_auto",
                change_cause=f"坐标表补录了匹配行 {match.point_label} ({match.x:.2f}, {match.y:.2f}, {match.z:.2f})",
                note="原始说法已保留，改后值和原因已记录",
            )

            op.status = OcclusionStatus.RESOLVED
            op.resolved_by = "system_auto"
            op.resolved_at = now
            op.updated_at = now
            op.missing_material = new_missing
            op.next_action = NextAction.SAFETY_OFFICER
            op.audit_trail.append(entry)
            resolved.append(op)
    return resolved


def add_review_note(
    op: OcclusionPoint,
    action: str,
    new_status: OcclusionStatus,
    new_missing: str,
    new_next: NextAction,
    changed_by: str,
    cause: str,
    note: str,
) -> None:
    now = datetime.now().isoformat()
    entry = AuditEntry(
        timestamp=now,
        action=action,
        from_status=op.status.value,
        to_status=new_status.value,
        from_reason=op.reason,
        to_reason=op.reason,
        from_missing_material=op.missing_material,
        to_missing_material=new_missing,
        from_next_action=op.next_action.value,
        to_next_action=new_next.value,
        changed_by=changed_by,
        change_cause=cause,
        note=note,
    )
    op.status = new_status
    op.missing_material = new_missing
    op.next_action = new_next
    op.updated_at = now
    op.audit_trail.append(entry)


def _find_obstacle_remark(
    project: InspectionProject, remark_id: str
) -> Optional[ObstacleRemark]:
    for r in project.obstacle_remarks:
        if r.id == remark_id:
            return r
    return None


def _find_photo_location(
    project: InspectionProject, loc_id: str
) -> Optional[PhotoLocation]:
    for loc in project.photo_locations:
        if loc.id == loc_id:
            return loc
    return None


def advance_workflow(project: InspectionProject) -> WorkflowPhase:
    if project.current_phase == WorkflowPhase.OBSTACLE_IMPORT:
        project.current_phase = WorkflowPhase.FLOOR_PROFILE_SUPPLEMENT
    elif project.current_phase == WorkflowPhase.FLOOR_PROFILE_SUPPLEMENT:
        new_points = detect_inconsistencies(project)
        project.occlusion_points.extend(new_points)
        resolved = resolve_occlusion_points(project)
        project.current_phase = WorkflowPhase.OCCLUSION_UPDATE
    elif project.current_phase == WorkflowPhase.OCCLUSION_UPDATE:
        resolved = resolve_occlusion_points(project)
        remaining = [
            op
            for op in project.occlusion_points
            if op.status == OcclusionStatus.PENDING_REVIEW
        ]
        if not remaining:
            project.current_phase = WorkflowPhase.OBSTACLE_IMPORT
    return project.current_phase


def generate_occlusion_report(project: InspectionProject) -> str:
    lines: list[str] = []
    lines.append(f"# 污水厂池体巡检路线 — 遮挡点清单")
    lines.append(f"")
    lines.append(f"项目: {project.name}")
    lines.append(f"当前阶段: {_phase_label(project.current_phase)}")
    lines.append(f"遮挡点总数: {len(project.occlusion_points)}")
    pending = [
        op
        for op in project.occlusion_points
        if op.status == OcclusionStatus.PENDING_REVIEW
    ]
    resolved = [
        op
        for op in project.occlusion_points
        if op.status == OcclusionStatus.RESOLVED
    ]
    escalated = [
        op
        for op in project.occlusion_points
        if op.status == OcclusionStatus.ESCALATED_SAFETY
    ]
    lines.append(f"  待复核: {len(pending)}  |  已解决: {len(resolved)}  |  已升级安全员: {len(escalated)}")
    lines.append(f"")
    lines.append(f"---")
    lines.append(f"")

    if not project.occlusion_points:
        lines.append(f"当前无遮挡点，巡检路线数据一致。")
        return "\n".join(lines)

    for i, op in enumerate(project.occlusion_points, 1):
        lines.append(f"## 遮挡点 #{i}")
        lines.append(f"")
        lines.append(f"- **照片引用**: {op.photo_ref}")
        lines.append(
            f"- **点位坐标**: ({op.point_x:.2f}, {op.point_y:.2f}, {op.point_z:.2f})"
        )
        lines.append(f"- **当前状态**: {_status_label(op.status)}")
        lines.append(f"- **为什么被留下**: {op.reason}")
        lines.append(f"- **还缺什么材料**: {op.missing_material}")
        lines.append(
            f"- **下一步**: {_next_action_label(op.next_action)}"
        )
        if op.original_reason and op.original_reason != op.reason:
            lines.append(f"- **原始说法（保留）**: {op.original_reason}")
        if op.original_missing_material and op.original_missing_material != op.missing_material:
            lines.append(f"- **原始缺失描述（保留）**: {op.original_missing_material}")
        if op.original_next_action and op.original_next_action != op.next_action.value:
            lines.append(f"- **原始下一步（保留）**: {_next_action_label(NextAction(op.original_next_action))}")
        if op.obstacle_remark_id:
            remark = _find_obstacle_remark(project, op.obstacle_remark_id)
            if remark:
                lines.append(
                    f"- **关联障碍物备注**: {remark.location} — {remark.description}"
                )
        if op.floor_profile_id:
            profile = _find_floor_profile(project, op.floor_profile_id)
            if profile:
                lines.append(f"- **关联楼层剖面草图**: {profile.floor_name}")

        if op.audit_trail:
            lines.append(f"")
            lines.append(f"### 变更历史")
            for j, entry in enumerate(op.audit_trail, 1):
                lines.append(f"  {j}. [{entry.timestamp}] {_audit_action_label(entry.action)}")
                lines.append(f"     状态: {_occlusion_status_value_label(entry.from_status) or '(新建)'} → {_occlusion_status_value_label(entry.to_status)}")
                if entry.from_missing_material != entry.to_missing_material:
                    lines.append(f"     缺失描述: {entry.from_missing_material or '(无)'} → {entry.to_missing_material}")
                if entry.from_next_action != entry.to_next_action:
                    fn_from = _next_action_label(NextAction(entry.from_next_action)) if entry.from_next_action else "(无)"
                    fn_to = _next_action_label(NextAction(entry.to_next_action)) if entry.to_next_action else "(无)"
                    lines.append(f"     下一步: {fn_from} → {fn_to}")
                lines.append(f"     操作人: {entry.changed_by}  原因: {entry.change_cause}")
                if entry.note:
                    lines.append(f"     备注: {entry.note}")
        lines.append(f"")

    return "\n".join(lines)


def _phase_label(phase: WorkflowPhase) -> str:
    return {
        WorkflowPhase.OBSTACLE_IMPORT: "障碍物备注导入",
        WorkflowPhase.FLOOR_PROFILE_SUPPLEMENT: "培训教官老梁补看楼层剖面草图",
        WorkflowPhase.OCCLUSION_UPDATE: "遮挡点清单更新",
    }.get(phase, str(phase))


def _status_label(status: OcclusionStatus) -> str:
    return {
        OcclusionStatus.PENDING_REVIEW: "⏳ 待安全员复核",
        OcclusionStatus.CONFIRMED: "✅ 已确认遮挡",
        OcclusionStatus.RESOLVED: "✔ 已解决",
        OcclusionStatus.ESCALATED_SAFETY: "🚨 已升级安全员",
    }.get(status, str(status))


def _next_action_label(action: NextAction) -> str:
    return {
        NextAction.SAFETY_OFFICER: "找安全员复核",
        NextAction.INSTRUCTOR_LIANG: "找培训教官老梁补材料",
    }.get(action, str(action))


def _audit_action_label(action: str) -> str:
    return {
        "created": "首次检测生成",
        "resolved_by_coordinate": "坐标表补录后自动解决",
        "escalated_to_safety": "升级安全员复核",
        "revert_to_pending": "回退待复核",
        "review_comment": "人工复核批注",
    }.get(action, action)


def _occlusion_status_value_label(value: str) -> str:
    return {
        "pending_review": "待安全员复核",
        "confirmed": "已确认遮挡",
        "resolved": "已解决",
        "escalated_safety": "已升级安全员",
    }.get(value, value)


def _find_floor_profile(
    project: InspectionProject, profile_id: str
) -> Optional[FloorProfile]:
    for p in project.floor_profiles:
        if p.id == profile_id:
            return p
    return None
