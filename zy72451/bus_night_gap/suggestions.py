from typing import List, Tuple, Dict
from .models import (
    RectificationSuggestion,
    RecordStatus,
    NextAction,
    Role,
    WorkflowState,
    RampRecord,
)
from .store import store, EnhancedAuditLog
from .scoring import check_score_changed


def _analyze_notes_for_missing(raw_notes: str) -> Dict[str, List[str]]:
    """
    分析备注内容，自动提取：
    1. 还缺什么材料
    2. 备注对材料清单的影响说明（为什么这样处理）
    """
    result: Dict[str, List[str]] = {
        "inferred_missing": [],
        "processing_explanations": [],
        "key_findings": [],
    }
    if not raw_notes or not raw_notes.strip():
        result["processing_explanations"].append("备注为空，无法提取信息，需要补充现场原始备注")
        return result

    notes_lower = raw_notes.lower()
    notes = raw_notes

    keywords_map = {
        "宽度": "坡道宽度测量数据（厘米）",
        "宽": "坡道宽度测量数据（厘米）",
        "公分": "坡道宽度测量数据（厘米）",
        "厘米": "坡道宽度测量数据（厘米）",
        "cm": "坡道宽度测量数据（厘米）",
        "状况": "坡道状况评估（good/fair/poor）",
        "破损": "坡道状况评估（good/fair/poor）",
        "好": "坡道状况评估（good/fair/poor）",
        "坏": "坡道状况评估（good/fair/poor）",
        "陡": "坡道状况评估（good/fair/poor）",
        "差": "坡道状况评估（good/fair/poor）",
        "照片": "坡道状况照片备注",
        "图": "坡道状况照片备注",
        "轮椅": "无障碍通行可行性说明",
        "老人": "无障碍通行可行性说明",
        "视线": "夜间通行安全评估",
        "夜班": "夜间通行安全评估",
        "晚上": "夜间通行安全评估",
        "摔跤": "夜间通行安全评估",
        "打报告": "施工方正式审批材料",
        "审批": "施工方正式审批材料",
        "临时": "临时通道设置方案",
        "堵": "临时通道设置方案",
    }

    found_keywords = set()
    for kw, material in keywords_map.items():
        if kw in notes or kw in notes_lower:
            found_keywords.add(material)

    width_mentioned = any(k in notes for k in ["宽度", "宽", "公分", "厘米", "cm"])
    if width_mentioned:
        if any(k in notes for k in ["80", "不够", "不足", "小于", "<", "窄"]):
            result["key_findings"].append("备注提到坡道宽度可能不达标（标准90cm），需要实际测量数据确认")
            result["inferred_missing"].append("坡道宽度实际测量数据（厘米）")
            result["processing_explanations"].append("从备注中识别出宽度问题，但缺少具体测量值，因此补充为缺材料")
        elif any(k in notes for k in ["90", "达标", "符合", "够"]):
            result["key_findings"].append("备注提到坡道宽度符合标准")
            result["processing_explanations"].append("备注已提到宽度达标，但仍需正式测量数据存档")
    else:
        result["processing_explanations"].append("备注中未提及宽度，需补充测量")

    condition_mentioned = any(k in notes for k in ["状况", "破损", "好", "坏", "陡", "差", "fair", "good", "poor"])
    if condition_mentioned:
        if any(k in notes for k in ["破损", "坏", "陡", "差", "poor", "fair"]):
            result["key_findings"].append("备注提到坡道可能存在状况问题")
            result["inferred_missing"].append("坡道状况正式评估（good/fair/poor）")
            result["processing_explanations"].append("备注暗示状况不佳，需要标准化评估")
    else:
        result["processing_explanations"].append("备注未描述坡道状况，需补充分级评估")

    night_keywords = ["夜班", "晚上", "夜间", "视线", "11点", "晚班", "摔跤"]
    if any(k in notes for k in night_keywords):
        result["key_findings"].append("涉及夜班公交时段，需特别关注夜间通行安全")
        if not any(m in result["inferred_missing"] for m in ["夜间通行安全评估"]):
            result["inferred_missing"].append("夜间通行安全评估")
        result["processing_explanations"].append("识别到夜间场景，额外要求安全评估材料")

    if "没有坡道" in notes or "无坡道" in notes or "没坡道" in notes:
        result["key_findings"].append("备注明确提到某位置没有坡道")
        result["inferred_missing"].append("新增坡道施工方案")
        result["processing_explanations"].append("发现缺失坡道点位，需补充施工方案")

    if not raw_notes.strip() or len(raw_notes.strip()) < 10:
        result["inferred_missing"].append("现场原始备注（不要洗成干净数据）")
        result["processing_explanations"].append("备注内容过短，不能作为复核依据，需补充完整现场描述")

    return result


def _explain_why_kept_with_notes(
    base_reason: str,
    notice_raw_notes: str,
    ramp_records: List[RampRecord],
) -> Tuple[str, List[str]]:
    """
    结合备注内容，解释：
    1. 这条整改建议为什么被留下
    2. 还缺什么材料与备注的关系
    """
    explanations: List[str] = []
    enhanced_reason = base_reason

    if notice_raw_notes and notice_raw_notes.strip():
        if "夜班" in notice_raw_notes:
            explanations.append("施工告示备注明确提到夜班公交场景，属于优先复核范围")
        if "周姐" in notice_raw_notes or "书记" in notice_raw_notes:
            explanations.append("备注中有社区书记周姐的现场判断，需要保留原始语境")
        if len(notice_raw_notes) > 100:
            explanations.append(f"备注共{len(notice_raw_notes)}字，包含大量现场细节，不能清洗掉")

    notes_with_content = [r for r in ramp_records if r.raw_notes and r.raw_notes.strip()]
    if notes_with_content:
        for r in notes_with_content:
            analysis = _analyze_notes_for_missing(r.raw_notes)
            if analysis["key_findings"]:
                for finding in analysis["key_findings"]:
                    explanations.append(f"[{r.location}]备注发现：{finding}")
            if analysis["processing_explanations"]:
                for exp in analysis["processing_explanations"]:
                    explanations.append(f"[{r.location}]材料处理：{exp}")

    if explanations:
        enhanced_reason += " 备注证据：" + "；".join(explanations)

    return enhanced_reason, explanations


def _collect_all_missing(
    notice_raw_notes: str,
    ramp_records: List[RampRecord],
    structural_missing: List[str],
) -> Tuple[List[str], Dict[str, List[str]]]:
    """
    汇总所有缺材料：
    - 结构性缺失（没有记录、没有宽度等）
    - 从备注中推断出的缺失
    返回 (材料清单, 每项材料为什么被列入的说明)
    """
    reasons: Dict[str, List[str]] = {}
    all_missing = list(structural_missing)

    for m in structural_missing:
        reasons[m] = ["结构性缺失：未采集到该字段数据"]

    notice_analysis = _analyze_notes_for_missing(notice_raw_notes)
    for m in notice_analysis["inferred_missing"]:
        if m not in all_missing:
            all_missing.append(m)
            reasons[m] = []
        for exp in notice_analysis["processing_explanations"]:
            if m in reasons:
                reasons[m].append(f"[施工告示备注推断] {exp}")

    for r in ramp_records:
        if not r.raw_notes:
            continue
        analysis = _analyze_notes_for_missing(r.raw_notes)
        for m in analysis["inferred_missing"]:
            if m not in all_missing:
                all_missing.append(m)
                reasons[m] = []
            for exp in analysis["key_findings"]:
                reasons[m].append(f"[{r.location}备注发现] {exp}")
            for exp in analysis["processing_explanations"]:
                reasons[m].append(f"[{r.location}处理逻辑] {exp}")

    if any(r.raw_notes.strip() for r in ramp_records):
        notes_based = [m for m, _ in reasons.items() if any("备注" in r for r in reasons[m])]
    else:
        if "现场原始备注（不要洗成干净数据）" not in all_missing:
            all_missing.append("现场原始备注（不要洗成干净数据）")
            reasons["现场原始备注（不要洗成干净数据）"] = ["所有坡道记录都缺少原始备注，无法支持复核"]

    return all_missing, reasons


def generate_suggestion(notice_id: str) -> RectificationSuggestion:
    notice = store.get_notice(notice_id)
    if not notice:
        raise ValueError(f"Notice {notice_id} not found")

    ramp_records = store.get_ramp_records_for_notice(notice_id)
    latest_score = store.get_latest_score(notice_id)
    all_scores = store.get_all_scores(notice_id)
    workflow = store.get_workflow(notice_id)
    previous_suggestion = store.get_latest_suggestion(notice_id)

    previous_missing = previous_suggestion.missing_materials if previous_suggestion else []
    structural_missing: List[str] = []
    base_why = ""
    next_action = NextAction.COLLECT_MORE_MATERIALS
    next_action_person = "社区书记周姐"
    status = RecordStatus.PENDING_REVIEW

    if not ramp_records:
        status = RecordStatus.NEEDS_SUPPLEMENT
        base_why = "仅导入了施工告示，但缺少现场核查的无障碍坡道记录，备注里提到的夜班公交站点坡道情况还没核实。"
        structural_missing = ["无障碍坡道现场核查记录", "坡道宽度测量数据", "坡道状况照片备注"]
        next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
        next_action_person = "社区书记周姐"
    else:
        supplement_records = [r for r in ramp_records if r.is_supplement]
        score_changed, _, _ = check_score_changed(notice_id)

        if workflow and workflow.status == RecordStatus.RESOLVED:
            status = RecordStatus.RESOLVED
            base_why = "所有材料已齐全，整改建议已生成，流程完成。"
            structural_missing = []
            next_action = NextAction.RESOLVED
            next_action_person = "已完成"
        elif workflow and workflow.has_ramp_supplement and not score_changed and len(all_scores) >= 2:
            status = RecordStatus.SCORE_UNCHANGED
            base_why = (
                "补录了无障碍坡道记录，但评分没有变化。"
                "这说明补录的信息可能和原有记录描述的是同一情况，"
                "或者补录的坡道信息不影响评分，需要交通协管确认是否还有遗漏。"
            )
            structural_missing = ["交通协管对评分未变化的复核确认", "是否还有未登记的坡道点位说明"]
            next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
            next_action_person = "交通协管"
        elif supplement_records:
            status = RecordStatus.PENDING_REVIEW
            base_why = "已经补录了无障碍坡道记录，需要重新评估整改建议，确认材料是否齐全。"
            if not any(r.ramp_condition for r in ramp_records if r.has_ramp):
                structural_missing.append("坡道状况评估（good/fair/poor）")
            if not any(r.width_cm for r in ramp_records if r.has_ramp):
                structural_missing.append("坡道宽度测量数据（厘米）")

            if structural_missing:
                next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
                next_action_person = "社区书记周姐"
            else:
                next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
                next_action_person = "交通协管"
                status = RecordStatus.READY_FOR_COORDINATOR
        else:
            status = RecordStatus.NEEDS_SUPPLEMENT
            base_why = "已有初步坡道记录，但信息不够完整，需要社区书记周姐补看现场，补充更详细的备注和测量数据。"
            if not any(r.ramp_condition for r in ramp_records if r.has_ramp):
                structural_missing.append("坡道状况评估")
            if not any(r.width_cm for r in ramp_records if r.has_ramp):
                structural_missing.append("坡道宽度测量数据")
            if not any(r.raw_notes.strip() for r in ramp_records):
                structural_missing.append("现场原始备注（不要洗成干净数据）")

            if structural_missing:
                next_action = NextAction.CONTACT_COMMUNITY_SECRETARY
                next_action_person = "社区书记周姐"
            else:
                next_action = NextAction.CONTACT_TRAFFIC_COORDINATOR
                next_action_person = "交通协管"
                status = RecordStatus.READY_FOR_COORDINATOR

    enhanced_why, note_explanations = _explain_why_kept_with_notes(base_why, notice.raw_notes, ramp_records)
    all_missing, missing_reasons = _collect_all_missing(notice.raw_notes, ramp_records, structural_missing)

    if notice.raw_notes and "夜班" in notice.raw_notes:
        enhanced_why += " 施工告示原始备注提到了夜班公交相关内容，这部分很重要，不能洗掉。"

    version = (previous_suggestion.version + 1) if previous_suggestion else 1

    notes_parts = []
    if notice.raw_notes:
        notes_parts.append(f"施工告示原始备注：{notice.raw_notes}")
    for r in ramp_records:
        if r.raw_notes:
            analysis = _analyze_notes_for_missing(r.raw_notes)
            extra = ""
            if analysis["key_findings"]:
                extra = f" [关键发现：{'；'.join(analysis['key_findings'])}]"
            notes_parts.append(f"坡道记录[{r.location}]原始备注：{r.raw_notes}{extra}")

    missing_with_reasons = []
    for m in all_missing:
        reasons = missing_reasons.get(m, ["列入清单"])
        reason_text = "（依据：" + "；".join(reasons[:2]) + "）" if reasons else ""
        missing_with_reasons.append(f"{m}{reason_text}")

    full_notes = "\n".join(notes_parts)
    if missing_with_reasons:
        full_notes += "\n\n=== 缺材料清单及处理依据 ==="
        for item in missing_with_reasons:
            full_notes += f"\n  ☐ {item}"
    if note_explanations:
        full_notes += "\n\n=== 备注复核要点 ==="
        for exp in note_explanations:
            full_notes += f"\n  • {exp}"

    diff_context = ""
    if previous_missing != all_missing:
        added = [m for m in all_missing if m not in previous_missing]
        removed = [m for m in previous_missing if m not in all_missing]
        if added:
            diff_context += f" 本版本新增缺项: {', '.join(added)}。"
        if removed:
            diff_context += f" 本版本移除缺项: {', '.join(removed)}（已补齐）。"
        if diff_context:
            enhanced_why += diff_context

    suggestion = RectificationSuggestion(
        notice_id=notice_id,
        status=status,
        why_kept=enhanced_why.strip(),
        missing_materials=all_missing,
        next_action=next_action,
        next_action_person=next_action_person,
        notes=full_notes,
        version=version,
    )

    store.add_suggestion(suggestion)

    prev_miss_str = "、".join(previous_missing) if previous_missing else "(空)"
    curr_miss_str = "、".join(all_missing) if all_missing else "(空)"
    store.log_audit(
        "suggestion",
        suggestion.id,
        "generate",
        {"version": previous_suggestion.version if previous_suggestion else 0, "missing": prev_miss_str},
        {"version": version, "missing": curr_miss_str, "status": status.value},
        Role.SYSTEM,
        f"生成整改建议v{version}：还缺什么材料从[{prev_miss_str}]变为[{curr_miss_str}]，原因：{base_why[:60]}",
    )

    return suggestion


def update_workflow_after_supplement(notice_id: str):
    workflow = store.get_workflow(notice_id)
    if not workflow:
        workflow = WorkflowState(notice_id=notice_id)

    old_status = workflow.status.value if workflow else None
    old_assignee = workflow.current_assignee.value if workflow and workflow.current_assignee else None

    workflow.has_ramp_supplement = True
    score_changed, latest, previous = check_score_changed(notice_id)
    workflow.score_changed_after_supplement = score_changed

    if not score_changed and latest and previous:
        workflow.status = RecordStatus.SCORE_UNCHANGED
        workflow.current_assignee = Role.TRAFFIC_COORDINATOR
    else:
        workflow.status = RecordStatus.PENDING_REVIEW
        workflow.current_assignee = Role.COMMUNITY_SECRETARY

    score_info = ""
    if latest and previous:
        score_info = f"评分从{previous.score:.1f}变为{latest.score:.1f}"

    workflow.history.append({
        "step": workflow.step,
        "action": "supplement_ramp_record",
        "score_changed": score_changed,
        "score_info": score_info,
        "status_from": old_status,
        "status_to": workflow.status.value,
        "assignee_from": old_assignee,
        "assignee_to": workflow.current_assignee.value,
        "timestamp": latest.calculated_at.isoformat() if latest else None,
    })
    workflow.step += 1
    workflow.step_description = "补录坡道记录完成"

    store.set_workflow(workflow)

    change_desc = (
        f"工作流：状态{old_status}→{workflow.status.value}，"
        f"负责人{old_assignee}→{workflow.current_assignee.value}，"
        f"{score_info if score_info else '无评分变化'}"
    )
    store.log_audit(
        "workflow",
        notice_id,
        "update",
        {"step": workflow.step - 1, "status": old_status, "assignee": old_assignee},
        {"step": workflow.step, "status": workflow.status.value, "assignee": workflow.current_assignee.value},
        Role.COMMUNITY_SECRETARY,
        f"补录坡道记录后更新工作流：{change_desc}",
    )
