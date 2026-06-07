from typing import List, Tuple
from .models import (
    RectificationSuggestion,
    RecordStatus,
    NextAction,
    Role,
    WorkflowState,
)
from .store import store
from .scoring import check_score_changed


def generate_suggestion(notice_id: str) -> RectificationSuggestion:
    notice = store.get_notice(notice_id)
    if not notice:
        raise ValueError(f"Notice {notice_id} not found")

    ramp_records = store.get_ramp_records_for_notice(notice_id)
    latest_score = store.get_latest_score(notice_id)
    all_scores = store.get_all_scores(notice_id)
    workflow = store.get_workflow(notice_id)
    previous_suggestion = store.get_latest_suggestion(notice_id)

    missing_materials = []
    why_kept = ""
    next_action = NextAction.COLLECT_MORE_MATERIALS
    next_action_person = "社区书记周姐"
    status = RecordStatus.PENDING_REVIEW

    if not ramp_records:
        status = RecordStatus.NEEDS_SUPPLEMENT
        why_kept = "仅导入了施工告示，但缺少现场核查的无障碍坡道记录，备注里提到的夜班公交站点坡道情况还没核实。"
        missing_materials = ["无障碍坡道现场核查记录", "坡道宽度测量数据", "坡道状况照片备注"]
        next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
        next_action_person = "社区书记周姐"
    else:
        supplement_records = [r for r in ramp_records if r.is_supplement]
        score_changed, _, _ = check_score_changed(notice_id)

        if workflow and workflow.status == RecordStatus.RESOLVED:
            status = RecordStatus.RESOLVED
            why_kept = "所有材料已齐全，整改建议已生成，流程完成。"
            missing_materials = []
            next_action = NextAction.RESOLVED
            next_action_person = "已完成"
        elif workflow and workflow.has_ramp_supplement and not score_changed and len(all_scores) >= 2:
            status = RecordStatus.SCORE_UNCHANGED
            why_kept = (
                "补录了无障碍坡道记录，但评分没有变化。"
                "这说明补录的信息可能和原有记录描述的是同一情况，"
                "或者补录的坡道信息不影响评分，需要交通协管确认是否还有遗漏。"
            )
            missing_materials = ["交通协管对评分未变化的复核确认", "是否还有未登记的坡道点位说明"]
            next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
            next_action_person = "交通协管"
        elif supplement_records:
            status = RecordStatus.PENDING_REVIEW
            why_kept = "已经补录了无障碍坡道记录，需要重新评估整改建议，确认材料是否齐全。"
            missing_materials = []
            if not any(r.ramp_condition for r in ramp_records if r.has_ramp):
                missing_materials.append("坡道状况评估（good/fair/poor）")
            if not any(r.width_cm for r in ramp_records if r.has_ramp):
                missing_materials.append("坡道宽度测量数据（厘米）")

            if missing_materials:
                next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
                next_action_person = "社区书记周姐"
            else:
                next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
                next_action_person = "交通协管"
                status = RecordStatus.READY_FOR_COORDINATOR
        else:
            status = RecordStatus.NEEDS_SUPPLEMENT
            why_kept = "已有初步坡道记录，但信息不够完整，需要社区书记周姐补看现场，补充更详细的备注和测量数据。"
            missing_materials = []
            if not any(r.ramp_condition for r in ramp_records if r.has_ramp):
                missing_materials.append("坡道状况评估")
            if not any(r.width_cm for r in ramp_records if r.has_ramp):
                missing_materials.append("坡道宽度测量数据")
            if not any(r.raw_notes.strip() for r in ramp_records):
                missing_materials.append("现场原始备注（不要洗成干净数据）")

            if missing_materials:
                next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
                next_action_person = "社区书记周姐"
            else:
                next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
                next_action_person = "交通协管"
                status = RecordStatus.READY_FOR_COORDINATOR

    if notice.raw_notes and "夜班" in notice.raw_notes:
        why_kept += " 施工告示原始备注提到了夜班公交相关内容，这部分很重要，不能洗掉。"

    version = (previous_suggestion.version + 1) if previous_suggestion else 1

    notes_parts = []
    if notice.raw_notes:
        notes_parts.append(f"施工告示原始备注：{notice.raw_notes}")
    for r in ramp_records:
        if r.raw_notes:
            notes_parts.append(f"坡道记录[{r.location}]原始备注：{r.raw_notes}")
    notes = "\n".join(notes_parts)

    suggestion = RectificationSuggestion(
        notice_id=notice_id,
        status=status,
        why_kept=why_kept.strip(),
        missing_materials=missing_materials,
        next_action=next_action,
        next_action_person=next_action_person,
        notes=notes,
        version=version,
    )

    store.add_suggestion(suggestion)
    return suggestion


def update_workflow_after_supplement(notice_id: str):
    workflow = store.get_workflow(notice_id)
    if not workflow:
        workflow = WorkflowState(notice_id=notice_id)

    workflow.has_ramp_supplement = True
    score_changed, latest, previous = check_score_changed(notice_id)
    workflow.score_changed_after_supplement = score_changed

    if not score_changed and latest and previous:
        workflow.status = RecordStatus.SCORE_UNCHANGED
        workflow.current_assignee = Role.TRAFFIC_COORDINATOR
    else:
        workflow.status = RecordStatus.PENDING_REVIEW
        workflow.current_assignee = Role.COMMUNITY_SECRETARY

    workflow.history.append({
        "step": workflow.step,
        "action": "supplement_ramp_record",
        "score_changed": score_changed,
        "timestamp": latest.calculated_at.isoformat() if latest else None,
    })
    workflow.step += 1
    workflow.step_description = "补录坡道记录完成"

    store.set_workflow(workflow)
    store.log_audit(
        "workflow",
        notice_id,
        "update",
        None,
        workflow.model_dump(),
        Role.COMMUNITY_SECRETARY,
        "补录坡道记录后更新工作流",
    )
