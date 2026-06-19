from datetime import datetime
from typing import Optional, List
from .models import (
    DispatchCase, GridInspection, ConstructionNotice, Ramp,
    RectificationSuggestion, Evidence, EvidenceSource, ReviewStatus,
    ResponsibleRole
)
import uuid
import re


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


_MATERIAL_KEYWORDS = [
    ("坡道现场照片", ["照片", "拍了", "已拍", "拍照", "图片", "截图"]),
    ("交通协管现场勘查记录", ["勘查", "勘察", "协管到", "交通.*记录", "协管记录"]),
    ("共享单车实际停放数量统计", ["数量统计", "统计", "多少辆", "约.*辆", "数量", "计数"]),
    ("施工告示照片", ["施工.*照片", "告示照片", "施工告示的照片", "公示照片"]),
    ("现场说法记录", ["现场说法", "说法记录", "施工方.*说", "口头说明"]),
    ("相关责任人联系方式", ["电话", "联系方式", "手机号", "联系人", "电话号"]),
    ("施工结束后的清理计划", ["清理计划", "清场方案", "清理方案", "清理时间"]),
    ("临时停放点设置方案", ["临时停放", "停放点设置", "停放方案", "临时点"]),
    ("网格员初次巡查记录", ["巡查记录", "巡检记录", "初次巡查"]),
    ("无障碍坡道检测报告", ["检测报告", "检测", "坡道检测"]),
]


def _extract_materials_from_note(note: str) -> List[str]:
    """从补录备注里提取已提供的材料清单"""
    if not note:
        return []
    provided = []
    note_lower = note
    for material_name, keywords in _MATERIAL_KEYWORDS:
        for kw in keywords:
            if re.search(kw, note_lower):
                provided.append(material_name)
                break
    return provided


def _merge_inspection_provided(case: DispatchCase, ramp: Ramp) -> List[str]:
    """从网格员巡查表提取已提供材料"""
    provided = []
    for insp in case.grid_inspections:
        if insp.location == ramp.location or insp.location in ramp.location:
            if insp.notes:
                provided.extend(_extract_materials_from_note(insp.notes))
            if insp.photos:
                provided.append("网格员巡查照片")
            provided.append("网格员初次巡查记录")
    return list(dict.fromkeys(provided))


def _merge_notice_provided(case: DispatchCase, ramp: Ramp) -> List[str]:
    """从施工告示提取已提供材料"""
    provided = []
    for notice in case.construction_notices:
        if notice.location in ramp.location or ramp.location in notice.location:
            if notice.photos:
                provided.append("施工告示照片")
            if notice.site_statement:
                provided.append("现场说法记录")
            if notice.reviewed_by_secretary:
                provided.append("社区书记审阅签字")
            if notice.title:
                provided.append("施工告示原件")
    return list(dict.fromkeys(provided))


def _build_evidence_trace(case: DispatchCase, ramp: Ramp) -> List[str]:
    """构建证据追溯链，说明触发「还缺什么材料」的原始依据"""
    trace = []
    for i, e in enumerate(case.evidences):
        loc_match = False
        if e.source == EvidenceSource.GRID_INSPECTOR:
            for insp in case.grid_inspections:
                if insp.location == ramp.location or insp.location in ramp.location:
                    loc_match = True
                    break
        elif e.source == EvidenceSource.CONSTRUCTION_NOTICE:
            for notice in case.construction_notices:
                if notice.location in ramp.location or ramp.location in notice.location:
                    loc_match = True
                    break
        elif e.source == EvidenceSource.RAMP_SUPPLEMENT:
            loc_match = True
        if loc_match:
            trace.append(f"[证据#{i+1}][{e.source.value}] {e.recorded_by}：{e.description[:60]}")
    return trace


def _append_history(ramp: Ramp, action: str, actor: str, note: str = "", **extra):
    """追加状态/材料/责任人变化历史，便于报告追溯整条链路"""
    from datetime import datetime
    record = {
        "timestamp": datetime.now().isoformat(timespec="minutes"),
        "action": action,
        "actor": actor,
        "review_status": ramp.review_status.value,
        "provided_materials": list(ramp.provided_materials),
        "note": note,
    }
    record.update(extra)
    ramp.status_history.append(record)


def calculate_inspection_score(inspection: GridInspection) -> float:
    score = 100.0
    if inspection.bike_overflow:
        score -= 30
    if inspection.blocked_access:
        score -= 25
    if inspection.damaged_facilities:
        score -= 20
    return max(0.0, score)


def create_case(title: str) -> DispatchCase:
    return DispatchCase(
        id=generate_id(),
        title=title
    )


def import_grid_inspection(case: DispatchCase, inspection: GridInspection) -> DispatchCase:
    inspection.id = generate_id()
    inspection.score = calculate_inspection_score(inspection)
    case.grid_inspections.append(inspection)
    
    evidence = Evidence(
        source=EvidenceSource.GRID_INSPECTOR,
        description=f"网格员 {inspection.inspector_name} 巡查记录：{inspection.notes}",
        recorded_at=inspection.inspection_date,
        recorded_by=inspection.inspector_name
    )
    case.evidences.append(evidence)
    
    _update_ramps_from_inspection(case, inspection)
    _update_suggestions(case)
    
    return case


def _update_ramps_from_inspection(case: DispatchCase, inspection: GridInspection):
    ramp = Ramp(
        id=generate_id(),
        location=inspection.location,
        score_before=0.0,
        score_after=0.0
    )
    
    issues = []
    if inspection.bike_overflow:
        issues.append("共享单车堆积")
    if inspection.blocked_access:
        issues.append("通道被阻挡")
    if inspection.damaged_facilities:
        issues.append("设施损坏")
    
    ramp.issues = issues
    ramp.score_changed = False
    ramp.review_status = ReviewStatus.PENDING
    ramp.provided_materials = _merge_inspection_provided(case, ramp)
    ramp.score_after = _recalculate_ramp_score(ramp)
    
    _append_history(ramp, "初次巡查建档", inspection.inspector_name or "网格员",
                   f"导入巡查表，初始评分 {ramp.score_after:.1f}",
                   score_before=ramp.score_before, score_after=ramp.score_after,
                   responsible_role=ResponsibleRole.GRID_INSPECTOR.value)
    
    case.ramps.append(ramp)


def supplement_ramp(case: DispatchCase, ramp_id: str, note: str, is_accessible: bool = None, has_bike_parking: bool = None) -> Optional[Ramp]:
    ramp = next((r for r in case.ramps if r.id == ramp_id), None)
    if not ramp:
        return None
    
    ramp.score_before = ramp.score_after
    
    if is_accessible is not None:
        ramp.is_accessible = is_accessible
    if has_bike_parking is not None:
        ramp.has_bike_parking = has_bike_parking
    if note:
        if ramp.supplementary_note:
            ramp.supplementary_note = ramp.supplementary_note + "；" + note
        else:
            ramp.supplementary_note = note
        extracted = _extract_materials_from_note(note)
        for m in extracted:
            if m not in ramp.provided_materials:
                ramp.provided_materials.append(m)
    
    new_score = _recalculate_ramp_score(ramp)
    ramp.score_after = new_score
    
    ramp.score_changed = abs(ramp.score_before - ramp.score_after) > 0.5
    
    if not ramp.score_changed:
        ramp.review_status = ReviewStatus.ESCALATED
        if "坡道补录说明" not in ramp.provided_materials:
            ramp.provided_materials.append("坡道补录说明")
    
    evidence = Evidence(
        source=EvidenceSource.RAMP_SUPPLEMENT,
        description=f"坡道补录：{note}，评分从 {ramp.score_before:.1f} 到 {ramp.score_after:.1f}，{'有变化' if ramp.score_changed else '无变化，需交通协管复核'}",
        recorded_by=ResponsibleRole.COMMUNITY_SECRETARY.value
    )
    case.evidences.append(evidence)
    
    _update_suggestions(case)
    
    # 从最新建议里拿到当前责任人
    current_suggestion = next((s for s in case.suggestions if s.ramp_id == ramp.id), None)
    current_role = current_suggestion.responsible_role.value if current_suggestion else ResponsibleRole.TRAFFIC_ASSISTANT.value
    
    _append_history(ramp, "坡道补录", ResponsibleRole.COMMUNITY_SECRETARY.value,
                   note,
                   score_before=ramp.score_before, score_after=ramp.score_after,
                   score_changed=ramp.score_changed,
                   responsible_role=current_role)
    
    return ramp


def _recalculate_ramp_score(ramp: Ramp) -> float:
    score = 100.0
    if not ramp.is_accessible:
        score -= 30
    if not ramp.has_bike_parking:
        score -= 20
    if "共享单车堆积" in ramp.issues:
        score -= 25
    if "通道被阻挡" in ramp.issues:
        score -= 20
    if "设施损坏" in ramp.issues:
        score -= 15
    return max(0.0, score)


def import_construction_notice(case: DispatchCase, notice: ConstructionNotice, reviewed_by_secretary: bool = False) -> DispatchCase:
    notice.id = generate_id()
    notice.reviewed_by_secretary = reviewed_by_secretary
    case.construction_notices.append(notice)
    
    evidence = Evidence(
        source=EvidenceSource.CONSTRUCTION_NOTICE,
        description=f"施工告示：{notice.title}，现场说法：{notice.site_statement}",
        recorded_by="社区书记周姐" if reviewed_by_secretary else "系统"
    )
    case.evidences.append(evidence)
    
    _merge_construction_impact(case, notice)
    for ramp in case.ramps:
        if notice.location in ramp.location or ramp.location in notice.location:
            notice_provided = _merge_notice_provided(case, ramp)
            for m in notice_provided:
                if m not in ramp.provided_materials:
                    ramp.provided_materials.append(m)
    _update_suggestions(case)
    
    # 给匹配的坡道追加历史记录（施工告示导入）
    for ramp in case.ramps:
        if notice.location in ramp.location or ramp.location in notice.location:
            current_suggestion = next((s for s in case.suggestions if s.ramp_id == ramp.id), None)
            current_role = current_suggestion.responsible_role.value if current_suggestion else ResponsibleRole.COMMUNITY_SECRETARY.value
            _append_history(ramp, "导入施工告示",
                           "社区书记周姐" if reviewed_by_secretary else "系统",
                           f"导入【{notice.title}】，现场说法：{notice.site_statement}",
                           reviewed_by_secretary=reviewed_by_secretary,
                           responsible_role=current_role)
    
    return case


def _merge_construction_impact(case: DispatchCase, notice: ConstructionNotice):
    for ramp in case.ramps:
        if notice.location in ramp.location or ramp.location in notice.location:
            if "施工影响" not in ramp.issues:
                ramp.issues.append("施工影响")
            ramp.score_after = _recalculate_ramp_score(ramp)


def review_ramp(case: DispatchCase, ramp_id: str, status: ReviewStatus, note: str = "") -> Optional[Ramp]:
    ramp = next((r for r in case.ramps if r.id == ramp_id), None)
    if not ramp:
        return None
    
    ramp.review_status = status
    
    if note:
        if ramp.supplementary_note:
            ramp.supplementary_note = ramp.supplementary_note + "；" + note
        else:
            ramp.supplementary_note = note
        extracted = _extract_materials_from_note(note)
        for m in extracted:
            if m not in ramp.provided_materials:
                ramp.provided_materials.append(m)
        if "交通协管现场勘查记录" not in ramp.provided_materials:
            ramp.provided_materials.append("交通协管现场勘查记录")
    
    evidence = Evidence(
        source=EvidenceSource.RAMP_SUPPLEMENT,
        description=f"交通协管复核：坡道 {ramp.location} 状态更新为 {status.value}" + (f"，{note}" if note else ""),
        recorded_by=ResponsibleRole.TRAFFIC_ASSISTANT.value
    )
    case.evidences.append(evidence)
    
    _update_suggestions(case)
    
    current_suggestion = next((s for s in case.suggestions if s.ramp_id == ramp.id), None)
    current_role = current_suggestion.responsible_role.value if current_suggestion else status.value
    
    _append_history(ramp, "复核状态更新", ResponsibleRole.TRAFFIC_ASSISTANT.value,
                   note,
                   new_status=status.value,
                   responsible_role=current_role)
    
    return ramp


def _default_missing_for_status(ramp: Ramp) -> tuple:
    """根据坡道状态返回默认的缺材料清单 + why_kept + next_step + responsible"""
    if ramp.review_status == ReviewStatus.ESCALATED:
        return (
            ["坡道现场照片", "交通协管现场勘查记录", "共享单车实际停放数量统计"],
            "坡道补录后评分无变化，未达到预期改善效果，需进一步核实真实情况，不能简单标记为已整改。先服务复核：优先让交通协管到现场重新核对，不能因为补录了备注就视同闭环。",
            "请交通协管到现场复核，确认坡道无障碍情况和共享单车停放现状，形成书面勘查记录并签字。",
            ResponsibleRole.TRAFFIC_ASSISTANT,
            1
        )
    
    has_notice_reviewed = False
    return (
        ["施工告示照片", "现场说法记录", "相关责任人联系方式"],
        "网格员初次巡查发现问题，尚未有施工告示佐证，需进一步收集现场证据。先服务复核：先让网格员补齐材料后再提交社区书记协调。",
        "请网格员补充收集施工告示等相关证据，或联系社区书记周姐协助核实。补全材料后在系统内做二次提交。",
        ResponsibleRole.GRID_INSPECTOR,
        2
    )


def _update_suggestions(case: DispatchCase):
    case.suggestions = []
    
    for ramp in case.ramps:
        construction_notice = next(
            (n for n in case.construction_notices if n.location in ramp.location or ramp.location in n.location),
            None
        )
        
        if construction_notice and construction_notice.reviewed_by_secretary:
            if ramp.review_status == ReviewStatus.ESCALATED:
                base_missing = [
                    "施工结束后的清理计划", "临时停放点设置方案",
                    "与施工方协调记录", "与共享单车运营方沟通记录"
                ]
                why_kept = (f"坡道补录后评分无变化，已转交通协管；同时结合施工告示【{construction_notice.title}】的现场说法（"
                           f"{construction_notice.site_statement}），"
                           "施工期间共享单车临时堆放是客观因素，不能只让交通协管查现场。"
                           "先服务复核：社区书记已审阅施工告示，先协调施工清理或临时停放方案，再看是否需交通协管进一步复核。")
                next_step = "请社区书记周姐协调施工方和共享单车运营方，设置临时停放区域并出具书面方案，同步记录与双方的沟通情况。"
                role = ResponsibleRole.COMMUNITY_SECRETARY
                prio = 1
            else:
                base_missing = [
                    "施工结束后的清理计划", "临时停放点设置方案", "无障碍坡道检测报告"
                ]
                why_kept = (f"结合施工告示【{construction_notice.title}】的现场说法（"
                           f"{construction_notice.site_statement}），"
                           "施工期间共享单车临时堆放是客观因素，但需防止长期占道。"
                           "先服务复核：社区书记已审阅，下一步重点落实施工结束后的清场和临时停放。")
                next_step = "请社区书记周姐协调施工方和共享单车运营方，设置临时停放区域并出具书面方案。"
                role = ResponsibleRole.COMMUNITY_SECRETARY
                prio = 2
        elif ramp.review_status == ReviewStatus.ESCALATED:
            base_missing, why_kept, next_step, role, prio = _default_missing_for_status(ramp)
        else:
            base_missing, why_kept, next_step, role, prio = _default_missing_for_status(ramp)
            if construction_notice and not construction_notice.reviewed_by_secretary:
                why_kept = (f"发现附近有施工告示【{construction_notice.title}】但社区书记周姐尚未审阅签字。"
                           "先服务复核：请社区书记先审阅施工告示并标注，再给出协调方案。")
                next_step = "先请社区书记周姐审阅施工告示的现场说法，确认施工影响范围后，再协调责任方。"
                role = ResponsibleRole.COMMUNITY_SECRETARY
                prio = 2
        
        all_provided = list(dict.fromkeys(
            ramp.provided_materials
            + _merge_inspection_provided(case, ramp)
            + _merge_notice_provided(case, ramp)
        ))
        
        missing_after_check = [m for m in base_missing if m not in all_provided]
        
        evidence_trace = _build_evidence_trace(case, ramp)
        
        if ramp.review_status != ReviewStatus.CONFIRMED and ramp.issues:
            suggestion = RectificationSuggestion(
                id=generate_id(),
                ramp_id=ramp.id,
                issue_description=f"坡道 {ramp.location} 存在问题：{', '.join(ramp.issues)}",
                why_kept=why_kept,
                missing_materials=missing_after_check,
                provided_materials=all_provided,
                evidence_trace=evidence_trace,
                next_step=next_step,
                responsible_role=role,
                priority=prio
            )
            case.suggestions.append(suggestion)


def set_display_mode(case: DispatchCase, mode: str) -> DispatchCase:
    case.display_mode = mode
    return case


def get_ramp_by_id(case: DispatchCase, ramp_id: str) -> Optional[Ramp]:
    return next((r for r in case.ramps if r.id == ramp_id), None)


def get_suggestions_by_ramp(case: DispatchCase, ramp_id: str) -> list:
    return [s for s in case.suggestions if s.ramp_id == ramp_id]
