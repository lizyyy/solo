from datetime import datetime
from typing import Optional
from .models import (
    DispatchCase, GridInspection, ConstructionNotice, Ramp,
    RectificationSuggestion, Evidence, EvidenceSource, ReviewStatus,
    ResponsibleRole
)
import uuid


def generate_id() -> str:
    return str(uuid.uuid4())[:8]


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
    ramp.score_after = _recalculate_ramp_score(ramp)
    
    case.ramps.append(ramp)


def supplement_ramp(case: DispatchCase, ramp_id: str, note: str, is_accessible: bool = None, has_bike_parking: bool = None) -> Optional[Ramp]:
    ramp = next((r for r in case.ramps if r.id == ramp_id), None)
    if not ramp:
        return None
    
    ramp.score_before = ramp.score_after
    
    original_issues = list(ramp.issues)
    
    if is_accessible is not None:
        ramp.is_accessible = is_accessible
    if has_bike_parking is not None:
        ramp.has_bike_parking = has_bike_parking
    if note:
        ramp.supplementary_note = note
    
    new_score = _recalculate_ramp_score(ramp)
    ramp.score_after = new_score
    
    ramp.score_changed = abs(ramp.score_before - ramp.score_after) > 0.5
    
    if not ramp.score_changed:
        ramp.review_status = ReviewStatus.ESCALATED
    
    evidence = Evidence(
        source=EvidenceSource.RAMP_SUPPLEMENT,
        description=f"坡道补录：{note}，评分从 {ramp.score_before:.1f} 到 {ramp.score_after:.1f}，{'有变化' if ramp.score_changed else '无变化，需交通协管复核'}",
        recorded_by=ResponsibleRole.COMMUNITY_SECRETARY.value
    )
    case.evidences.append(evidence)
    
    _update_suggestions(case)
    
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
    _update_suggestions(case)
    
    return case


def _merge_construction_impact(case: DispatchCase, notice: ConstructionNotice):
    for ramp in case.ramps:
        if notice.location in ramp.location:
            if "施工影响" not in ramp.issues:
                ramp.issues.append("施工影响")
            ramp.score_after = _recalculate_ramp_score(ramp)


def review_ramp(case: DispatchCase, ramp_id: str, status: ReviewStatus) -> Optional[Ramp]:
    ramp = next((r for r in case.ramps if r.id == ramp_id), None)
    if not ramp:
        return None
    
    ramp.review_status = status
    
    evidence = Evidence(
        source=EvidenceSource.RAMP_SUPPLEMENT,
        description=f"交通协管复核：坡道 {ramp.location} 状态更新为 {status.value}",
        recorded_by=ResponsibleRole.TRAFFIC_ASSISTANT.value
    )
    case.evidences.append(evidence)
    
    _update_suggestions(case)
    
    return ramp


def _update_suggestions(case: DispatchCase):
    case.suggestions = []
    
    for ramp in case.ramps:
        if ramp.review_status == ReviewStatus.ESCALATED:
            suggestion = RectificationSuggestion(
                id=generate_id(),
                ramp_id=ramp.id,
                issue_description=f"坡道 {ramp.location} 存在问题：{', '.join(ramp.issues) if ramp.issues else '无'}",
                why_kept="坡道补录后评分无变化，未达到预期改善效果，需进一步核实真实情况，不能简单标记为已整改",
                missing_materials=["坡道现场照片", "交通协管现场勘查记录", "共享单车实际停放数量统计"],
                next_step="请交通协管到现场复核，确认坡道无障碍情况和共享单车停放现状",
                responsible_role=ResponsibleRole.TRAFFIC_ASSISTANT,
                priority=1
            )
            case.suggestions.append(suggestion)
        elif ramp.issues:
            construction_notice = next(
                (n for n in case.construction_notices if n.location in ramp.location),
                None
            )
            
            if construction_notice and construction_notice.reviewed_by_secretary:
                suggestion = RectificationSuggestion(
                    id=generate_id(),
                    ramp_id=ramp.id,
                    issue_description=f"坡道 {ramp.location} 存在问题：{', '.join(ramp.issues)}",
                    why_kept=f"结合施工告示【{construction_notice.title}】的现场说法，施工期间共享单车临时堆放是客观因素，但需防止长期占道",
                    missing_materials=["施工结束后的清理计划", "临时停放点设置方案"],
                    next_step="请社区书记周姐协调施工方和共享单车运营方，设置临时停放区域",
                    responsible_role=ResponsibleRole.COMMUNITY_SECRETARY,
                    priority=2
                )
            else:
                suggestion = RectificationSuggestion(
                    id=generate_id(),
                    ramp_id=ramp.id,
                    issue_description=f"坡道 {ramp.location} 存在问题：{', '.join(ramp.issues)}",
                    why_kept="网格员初次巡查发现问题，尚未有施工告示佐证，需进一步收集现场证据",
                    missing_materials=["施工告示照片", "现场说法记录", "相关责任人联系方式"],
                    next_step="请网格员补充收集施工告示等相关证据，或联系社区书记周姐协助核实",
                    responsible_role=ResponsibleRole.GRID_INSPECTOR,
                    priority=2
                )
            case.suggestions.append(suggestion)


def set_display_mode(case: DispatchCase, mode: str) -> DispatchCase:
    case.display_mode = mode
    return case


def get_ramp_by_id(case: DispatchCase, ramp_id: str) -> Optional[Ramp]:
    return next((r for r in case.ramps if r.id == ramp_id), None)


def get_suggestions_by_ramp(case: DispatchCase, ramp_id: str) -> list:
    return [s for s in case.suggestions if s.ramp_id == ramp_id]
