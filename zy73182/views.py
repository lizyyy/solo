from typing import List, Dict, Any, Optional
from models import (
    StudentDraft,
    AttributionResult,
    BoundaryEvent,
    BoundaryEventType,
    EvidenceGap,
    EvidenceGapLevel,
    OverrideRecord,
    RecalculationReport,
    AttributionConfig,
    ProcessingStatus,
)
from override_and_recalc import GapManager, OverrideManager


class VisualizationService:
    def __init__(self, drafts: List[StudentDraft],
                 results: Dict[str, AttributionResult],
                 boundary_events: Dict[str, List[BoundaryEvent]],
                 override_manager: OverrideManager):
        self.drafts = drafts
        self.results = results
        self.boundary_events = boundary_events
        self.override_manager = override_manager
        self._draft_by_id = {d.draft_id: d for d in drafts}

    def get_chart_dataset(self, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        points: List[Dict[str, Any]] = []
        for draft in self.drafts:
            if filters:
                if filters.get("student_id") and draft.student_id != filters["student_id"]:
                    continue
                if filters.get("question_id") and draft.question_id != filters["question_id"]:
                    continue
            result = self.results.get(draft.draft_id)
            status = draft.processing_status.value
            override_status = self.override_manager.get_current_status(draft.draft_id)
            override_flag = override_status["history_count"] > 0

            for idx, pt in enumerate(draft.raw_chart_points or [{}]):
                point = {
                    "id": f"{draft.draft_id}_pt{idx}",
                    "draft_id": draft.draft_id,
                    "student_id": draft.student_id,
                    "question_id": draft.question_id,
                    "chart_index": idx,
                    "processing_status": status,
                    "has_override": override_flag,
                    "raw_point": pt,
                }
                if result:
                    point["error_category"] = result.error_category
                    point["error_subcategory"] = result.error_subcategory
                    point["confidence"] = result.confidence_score
                    point["severity"] = result.severity
                points.append(point)

            if not draft.raw_chart_points:
                point = {
                    "id": f"{draft.draft_id}_summary",
                    "draft_id": draft.draft_id,
                    "student_id": draft.student_id,
                    "question_id": draft.question_id,
                    "chart_index": -1,
                    "processing_status": status,
                    "has_override": override_flag,
                    "raw_point": {},
                }
                if result:
                    point["error_category"] = result.error_category
                    point["error_subcategory"] = result.error_subcategory
                    point["confidence"] = result.confidence_score
                    point["severity"] = result.severity
                points.append(point)

        return {
            "total_points": len(points),
            "points": points,
            "filters_applied": filters or {},
            "legend": {
                "status_options": [s.value for s in ProcessingStatus],
                "override_flag_meaning": "true表示经过人工改判",
            },
        }

    def click_through(self, point_id: str = "",
                       draft_id: str = "",
                       chart_index: int = -1) -> Dict[str, Any]:
        if point_id and "_pt" in point_id:
            draft_id, idx_part = point_id.rsplit("_pt", 1)
            chart_index = int(idx_part)
        elif point_id and "_summary" in point_id:
            draft_id = point_id.rsplit("_summary", 1)[0]
            chart_index = -1

        draft = self._draft_by_id.get(draft_id)
        if not draft:
            return {"error": "草稿不存在", "draft_id": draft_id}

        result = self.results.get(draft_id)
        events = self.boundary_events.get(draft_id, [])
        override_info = self.override_manager.get_current_status(draft_id)
        overrides = self.override_manager.get_override_history(draft_id=draft_id)

        chart_point = None
        linked_formulas = []
        if chart_index >= 0 and chart_index < len(draft.raw_chart_points):
            chart_point = draft.raw_chart_points[chart_index]
        if result:
            for ct in result.chart_clickthrough:
                if ct.get("chart_index") == chart_index:
                    linked_formulas = ct.get("linked_formulas", [])
                    break
            if not linked_formulas and result.chart_clickthrough:
                linked_formulas = result.chart_clickthrough[0].get("linked_formulas", [])

        return {
            "draft_summary": {
                "draft_id": draft.draft_id,
                "student_id": draft.student_id,
                "question_id": draft.question_id,
                "submit_time": draft.submit_time,
                "processing_status": draft.processing_status.value,
                "source_file": draft.source_file,
                "source_batch": draft.source_batch,
                "version": draft.version,
            },
            "raw_data": {
                "clicked_point": chart_point,
                "all_chart_points": draft.raw_chart_points,
                "raw_scratch_text": draft.raw_scratch_text,
                "raw_payload_fields": list(draft.raw_payload.keys()),
                "field_mappings": [
                    {
                        "source": m.source_field,
                        "target": m.target_field,
                        "confidence": m.confidence,
                        "rule": m.mapping_rule,
                        "manual_override": m.manual_override,
                        "value_preview": str(draft.raw_payload.get(m.source_field, ""))[:100],
                    }
                    for m in draft.field_mappings
                ],
            },
            "attribution_detail": self._format_attribution_detail(result) if result else None,
            "boundary_events": [self._format_boundary(e, draft.raw_scratch_text) for e in events],
            "override_info": {
                "summary": override_info,
                "history": [
                    {
                        "time": o.created_at,
                        "operator": o.operator,
                        "source": o.source.value,
                        "from": o.previous_category,
                        "to": o.new_category,
                        "confidence_from": o.previous_confidence,
                        "confidence_to": o.new_confidence,
                        "reason": o.reason,
                        "reference": o.reference_material_id,
                    }
                    for o in overrides
                ],
            },
            "linked_formulas_at_click": linked_formulas,
            "normalized_snapshot": draft.normalized_data,
        }

    @staticmethod
    def _format_attribution_detail(result: AttributionResult) -> Dict[str, Any]:
        return {
            "attribution_id": result.attribution_id,
            "run_id": result.run_id,
            "config_id": result.config_id,
            "category": result.error_category,
            "subcategory": result.error_subcategory,
            "confidence": result.confidence_score,
            "severity": result.severity,
            "generated_at": result.generated_at,
            "is_latest": result.is_latest,
            "delta_from_previous": result.delta_from_previous,
            "formula_traces": [
                {
                    "variable": t.variable,
                    "formula": t.formula,
                    "unit": t.unit,
                    "input_values": t.input_values,
                    "output_value": t.output_value,
                    "boundary_sample": t.boundary_sample,
                    "boundary_rationale": t.boundary_rationale,
                }
                for t in result.formula_traces
            ],
            "evidence_count": len(result.supporting_evidence),
            "supporting_evidence_sample": (result.supporting_evidence[:5]
                                            if len(result.supporting_evidence) > 10
                                            else result.supporting_evidence),
            "total_supporting_evidence": result.supporting_evidence,
        }

    @staticmethod
    def _format_boundary(event: BoundaryEvent, scratch: str) -> Dict[str, Any]:
        has_claim = bool(event.original_claim_text)
        related_lines = []
        if scratch and event.variable_name:
            for line in scratch.replace("\r", "").split("\n"):
                if event.variable_name.lower() in line.lower() and line.strip():
                    related_lines.append(line.strip()[:150])
        return {
            "event_id": event.event_id,
            "event_type": event.event_type.value,
            "variable": event.variable_name,
            "input_value": event.input_value,
            "valid_min": event.valid_min,
            "valid_max": event.valid_max,
            "clamped_to": event.clamped_value,
            "formula_used": event.formula_used,
            "units": event.units,
            "impact_severity": event.impact_severity,
            "linked_original_claim": event.original_claim_text,
            "claim_linked": has_claim,
            "additional_scratch_mentions": related_lines,
        }


class ProjectManagerView:
    def __init__(self, drafts: List[StudentDraft],
                 results: Dict[str, AttributionResult],
                 gap_manager: GapManager,
                 override_manager: OverrideManager,
                 latest_report: Optional[RecalculationReport] = None):
        self.drafts = drafts
        self.results = results
        self.gap_manager = gap_manager
        self.override_manager = override_manager
        self.latest_report = latest_report
        self._draft_by_id = {d.draft_id: d for d in drafts}

    def dashboard(self) -> Dict[str, Any]:
        summary = self.gap_manager.get_summary(self.drafts)
        status_counts = {}
        category_counts = {}
        override_count = 0

        for draft in self.drafts:
            s = draft.processing_status.value
            status_counts[s] = status_counts.get(s, 0) + 1
            hist = self.override_manager.get_override_history(draft_id=draft.draft_id)
            if hist:
                override_count += 1
            r = self.results.get(draft.draft_id)
            if r:
                c = r.error_category
                category_counts[c] = category_counts.get(c, 0) + 1

        unresolved = self.gap_manager.list_unresolved()
        must_list = [g for g in unresolved if g.level == EvidenceGapLevel.MUST_FILL]
        should_list = [g for g in unresolved if g.level == EvidenceGapLevel.SHOULD_FILL]
        ok_list = [g for g in unresolved if g.level == EvidenceGapLevel.OK_TO_PASS]
        nice_list = [g for g in unresolved if g.level == EvidenceGapLevel.NICE_TO_HAVE]

        issue_classification = self._classify_issues(unresolved, must_list, should_list)

        return {
            "summary": summary,
            "progress_bar": self._build_progress_bar(summary),
            "status_breakdown": status_counts,
            "category_breakdown": category_counts,
            "override_count": override_count,
            "latest_recalculation": self._format_recalc_report(self.latest_report) if self.latest_report else None,
            "issue_classification": issue_classification,
            "actionable_panels": {
                "must_fill_panel": self._summarize_gaps(must_list, "必须补齐", True),
                "should_fill_panel": self._summarize_gaps(should_list, "建议补齐", False),
                "ok_to_pass_panel": self._summarize_gaps(ok_list, "可以放行", False),
                "nice_to_have_panel": self._summarize_gaps(nice_list, "锦上添花", False),
            },
            "release_checklist": self._build_release_checklist(summary, must_list),
        }

    def _classify_issues(self, all_unresolved: List[EvidenceGap],
                          must_list: List[EvidenceGap],
                          should_list: List[EvidenceGap]) -> Dict[str, Any]:
        boundary_missing = [
            g for g in all_unresolved
            if g.gap_type == "boundary_event_without_claim" and not g.resolved
        ]
        formula_unit = [
            g for g in all_unresolved
            if g.gap_type in ("formula_unit_incomplete", "formula_missing_units") and not g.resolved
        ]
        other_must = [
            g for g in must_list
            if g.gap_type not in ("boundary_event_without_claim",) and not g.resolved
        ]
        other_should = [
            g for g in should_list
            if g.gap_type not in ("formula_unit_incomplete", "formula_missing_units") and not g.resolved
        ]

        drafts_with_boundary = list(set(g.draft_id for g in boundary_missing))
        drafts_with_formula = list(set(g.draft_id for g in formula_unit))

        ready_drafts = []
        for draft in self.drafts:
            gaps = self.gap_manager._gaps.get(draft.draft_id, [])
            unresolved_for_draft = [g for g in gaps if not g.resolved]
            blocking = [g for g in unresolved_for_draft if g.blocking_release or g.level == EvidenceGapLevel.MUST_FILL]
            if not blocking:
                ready_drafts.append({
                    "draft_id": draft.draft_id,
                    "student_id": draft.student_id,
                    "question_id": draft.question_id,
                    "processing_status": draft.processing_status.value,
                    "non_blocking_gaps": [
                        {"gap_type": g.gap_type, "level": g.level.value}
                        for g in unresolved_for_draft
                    ],
                    "result_category": (
                        self.results.get(draft.draft_id).error_category
                        if self.results.get(draft.draft_id) else "未归因"
                    ),
                })

        boundary_details = []
        for g in boundary_missing:
            boundary_details.append({
                "gap_id": g.gap_id,
                "draft_id": g.draft_id,
                "gap_type": g.gap_type,
                "description": g.gap_description,
                "fill_suggestion": g.fill_suggestion,
                "clickthrough_link": f"/clickthrough?draft_id={g.draft_id}",
            })

        formula_details = []
        for g in formula_unit:
            formula_details.append({
                "gap_id": g.gap_id,
                "draft_id": g.draft_id,
                "gap_type": g.gap_type,
                "description": g.gap_description,
                "fill_suggestion": g.fill_suggestion,
                "blocking": g.blocking_release,
            })

        return {
            "total_drafts": len(self.drafts),
            "🔴 boundary_missing_claim": {
                "count": len(boundary_missing),
                "affected_drafts": len(drafts_with_boundary),
                "blocking_release": True,
                "label": "越界缺原始说法（必补，阻塞放行）",
                "details": boundary_details,
                "draft_ids": drafts_with_boundary,
            },
            "🟡 formula_unit_issue": {
                "count": len(formula_unit),
                "affected_drafts": len(drafts_with_formula),
                "blocking_release": False,
                "label": "公式单位问题（建议补，不阻塞）",
                "details": formula_details,
                "draft_ids": drafts_with_formula,
            },
            "🟢 ready_to_release": {
                "count": len(ready_drafts),
                "label": "证据齐全可放行",
                "details": ready_drafts,
            },
            "other_must_fill": {
                "count": len(other_must),
                "affected_drafts": list(set(g.draft_id for g in other_must)),
                "label": "其他必补项",
            },
            "other_should_fill": {
                "count": len(other_should),
                "affected_drafts": list(set(g.draft_id for g in other_should)),
                "label": "其他建议项",
            },
        }

    @staticmethod
    def _build_progress_bar(summary: Dict[str, Any]) -> Dict[str, Any]:
        total = max(1, summary["unresolved_gaps"] + (summary["total_gaps"] - summary["unresolved_gaps"]))
        resolved_pct = round((summary["total_gaps"] - summary["unresolved_gaps"]) / total * 100, 1) if summary["total_gaps"] else 100.0
        return {
            "resolved_percentage": resolved_pct,
            "unresolved_count": summary["unresolved_gaps"],
            "total_count": summary["total_gaps"],
            "can_release": summary["can_release"],
        }

    @staticmethod
    def _build_release_checklist(summary: Dict[str, Any], must_list: List[EvidenceGap]) -> Dict[str, Any]:
        checklist = [
            {
                "item": "所有必须补齐(MUST_FILL)的证据缺口已解决",
                "passed": summary["must_fill_pending"] == 0,
                "pending_count": summary["must_fill_pending"],
            },
            {
                "item": "所有阻塞发布(blocking_release)的问题已解决",
                "passed": summary["blocking_release_count"] == 0,
                "pending_count": summary["blocking_release_count"],
            },
            {
                "item": "草稿字段没有低置信度未确认映射",
                "passed": not any(g.gap_type == "low_confidence_mapping" for g in must_list),
                "pending_count": sum(1 for g in must_list if g.gap_type == "low_confidence_mapping"),
            },
            {
                "item": "所有边界/越界事件(EXTRAPOLATION/OUT_OF_RANGE/CLAMPED/FORMULA_ADJUSTED)都已关联学生原始说法、变量来源或可解释依据",
                "passed": not any(g.gap_type == "boundary_event_without_claim" for g in must_list),
                "pending_count": sum(1 for g in must_list if g.gap_type == "boundary_event_without_claim"),
            },
        ]
        all_passed = all(c["passed"] for c in checklist)
        return {
            "can_release": all_passed,
            "all_items": checklist,
            "verdict": "✅ 可以发布" if all_passed else "⚠️ 请先处理阻塞项",
        }

    def _summarize_gaps(self, gaps: List[EvidenceGap], panel_title: str,
                         is_blocking: bool) -> Dict[str, Any]:
        type_groups: Dict[str, List[EvidenceGap]] = {}
        for g in gaps:
            type_groups.setdefault(g.gap_type, []).append(g)

        by_type = []
        for gt, glist in type_groups.items():
            draft_ids = list(set(g.draft_id for g in glist))
            sample = glist[0]
            by_type.append({
                "gap_type": gt,
                "count": len(glist),
                "affected_drafts": len(draft_ids),
                "description": sample.gap_description,
                "suggestion": sample.fill_suggestion,
                "draft_ids_sample": draft_ids[:10],
            })

        return {
            "title": panel_title,
            "is_blocking": is_blocking,
            "total_count": len(gaps),
            "unique_gap_types": len(type_groups),
            "by_type": sorted(by_type, key=lambda x: x["count"], reverse=True),
            "action_items": self._build_action_items(gaps, is_blocking),
        }

    def _build_action_items(self, gaps: List[EvidenceGap],
                             is_blocking: bool) -> List[Dict[str, Any]]:
        items = []
        seen_types = set()
        for g in gaps:
            if g.gap_type in seen_types:
                continue
            seen_types.add(g.gap_type)
            matching = [x for x in gaps if x.gap_type == g.gap_type]
            items.append({
                "material_action": f"【{'必须补' if is_blocking else '选择性补'}】{g.fill_suggestion}",
                "gap_description": g.gap_description,
                "gap_type": g.gap_type,
                "involved_count": len(matching),
                "involved_draft_ids": list(set(x.draft_id for x in matching))[:20],
                "sample_gap_ids": [x.gap_id for x in matching[:5]],
                "verdict": "需补齐后才能放行" if is_blocking else "补完后更严谨，不补也可放行",
            })
        return items

    def per_draft_action_list(self, draft_id: str) -> Dict[str, Any]:
        draft = self._draft_by_id.get(draft_id)
        if not draft:
            return {"error": "草稿不存在"}

        gaps = self.gap_manager._gaps.get(draft_id, [])
        unresolved = [g for g in gaps if not g.resolved]
        result = self.results.get(draft_id)
        override_status = self.override_manager.get_current_status(draft_id)

        must_actions = []
        should_actions = []
        pass_actions = []
        nice_actions = []

        for g in unresolved:
            action = {
                "gap_id": g.gap_id,
                "description": g.gap_description,
                "suggestion": g.fill_suggestion,
                "blocking": g.blocking_release,
            }
            if g.level == EvidenceGapLevel.MUST_FILL:
                must_actions.append(action)
            elif g.level == EvidenceGapLevel.SHOULD_FILL:
                should_actions.append(action)
            elif g.level == EvidenceGapLevel.OK_TO_PASS:
                pass_actions.append(action)
            else:
                nice_actions.append(action)

        return {
            "draft_id": draft_id,
            "student_id": draft.student_id,
            "question_id": draft.question_id,
            "processing_status": draft.processing_status.value,
            "current_category": result.error_category if result else "未归因",
            "has_override": override_status["history_count"] > 0,
            "final_verdict": self._draft_verdict(must_actions, should_actions, override_status),
            "actions_must_fill": must_actions,
            "actions_should_fill": should_actions,
            "materials_ok_to_pass": [a["suggestion"] for a in pass_actions],
            "actions_nice_to_have": nice_actions,
        }

    @staticmethod
    def _draft_verdict(must, should, override_status) -> str:
        if must:
            return f"🔴 暂不放行：{len(must)}项必须补齐"
        if override_status["history_count"] > 0 and override_status["status"] != ProcessingStatus.COMPLETED.value:
            return f"🟡 已改判待确认：{override_status.get('latest_reason','未说明原因')}"
        if should:
            return f"🟢 可以放行（建议补：{len(should)}项）"
        return "✅ 材料完备，可放行"

    @staticmethod
    def _format_recalc_report(report: RecalculationReport) -> Dict[str, Any]:
        if not report:
            return None
        return {
            "report_id": report.report_id,
            "old_config": report.old_config_id,
            "new_config": report.new_config_id,
            "affected_drafts": report.affected_draft_count,
            "category_changes": report.category_changes,
            "boundary_driven": report.boundary_driven_changes,
            "formula_driven": report.formula_driven_changes,
            "generated_at": report.generated_at,
        }


class BoundaryTraceService:
    def __init__(self, drafts: List[StudentDraft],
                 boundary_events: Dict[str, List[BoundaryEvent]],
                 results: Dict[str, AttributionResult]):
        self.drafts = drafts
        self.boundary_events = boundary_events
        self.results = results
        self._draft_by_id = {d.draft_id: d for d in drafts}

    def query_by_draft(self, draft_id: str) -> List[Dict[str, Any]]:
        return self._format_list(self.boundary_events.get(draft_id, []), draft_id)

    def query_by_severity(self, min_severity: float = 0.5) -> List[Dict[str, Any]]:
        all_events = []
        for did, events in self.boundary_events.items():
            for e in events:
                if e.impact_severity >= min_severity:
                    all_events.append((did, e))
        all_events.sort(key=lambda x: x[1].impact_severity, reverse=True)
        return self._format_list([e for _, e in all_events], None)

    def query_missing_claim(self) -> List[Dict[str, Any]]:
        missing = []
        for did, events in self.boundary_events.items():
            for e in events:
                if e.event_type in (
                    BoundaryEventType.EXTRAPOLATION,
                    BoundaryEventType.OUT_OF_RANGE,
                    BoundaryEventType.CLAMPED,
                    BoundaryEventType.FORMULA_ADJUSTED,
                ) and not e.original_claim_text:
                    missing.append((did, e))
        return self._format_list([e for _, e in missing], None)

    def query_unresolved_boundary_gaps(self, gap_manager: GapManager) -> List[Dict[str, Any]]:
        unresolved = []
        for did, events in self.boundary_events.items():
            gaps = gap_manager._gaps.get(did, [])
            boundary_gaps = [g for g in gaps if g.gap_type == "boundary_event_without_claim" and not g.resolved]
            for e in events:
                if e.event_type in (
                    BoundaryEventType.EXTRAPOLATION,
                    BoundaryEventType.OUT_OF_RANGE,
                    BoundaryEventType.CLAMPED,
                    BoundaryEventType.FORMULA_ADJUSTED,
                ) and not e.original_claim_text:
                    unresolved.append({
                        "draft_id": did,
                        "event": self._format_single(e),
                        "gap_ids": [g.gap_id for g in boundary_gaps],
                        "student": self._draft_by_id.get(did).student_id if did in self._draft_by_id else "",
                        "question": self._draft_by_id.get(did).question_id if did in self._draft_by_id else "",
                        "processing_status": (
                            self._draft_by_id.get(did).processing_status.value
                            if did in self._draft_by_id else ""
                        ),
                        "scratch_excerpt": (
                            self._draft_by_id.get(did).raw_scratch_text[:300]
                            if did in self._draft_by_id else ""
                        ),
                        "manual_search_hint": (
                            f"在草稿中查找包含 '{e.variable_name}'、数值 {e.input_value} 或变量来源的原始表述；"
                            f"事件类型={e.event_type.value}，范围=[{e.valid_min},{e.valid_max}]"
                        ),
                        "clickthrough_link": f"/clickthrough?draft_id={did}&event_id={e.event_id}",
                    })
        return unresolved

    def _format_list(self, events: List[BoundaryEvent],
                      draft_id_hint: Optional[str]) -> List[Dict[str, Any]]:
        formatted = []
        for e in events:
            d = self._draft_by_id.get(e.draft_id or draft_id_hint)
            formatted.append(self._format_single(e, d))
        return formatted

    @staticmethod
    def _format_single(e: BoundaryEvent, d: Optional[StudentDraft] = None) -> Dict[str, Any]:
        return {
            "event_id": e.event_id,
            "draft_id": e.draft_id,
            "student_id": d.student_id if d else "",
            "question_id": d.question_id if d else "",
            "event_type": e.event_type.value,
            "variable": e.variable_name,
            "value": e.input_value,
            "value_with_unit": f"{e.input_value} {e.units}".strip(),
            "valid_range": f"[{e.valid_min}, {e.valid_max}]" if e.valid_min is not None or e.valid_max is not None else "未设范围",
            "clamped_to": f"{e.clamped_value} {e.units}".strip() if e.clamped_value is not None else None,
            "formula_used": e.formula_used,
            "units": e.units,
            "severity": e.impact_severity,
            "original_claim_linked": bool(e.original_claim_text),
            "original_claim_exact": e.original_claim_text or "【未关联原始说法，需从草稿中提取】",
            "severity_meaning": (
                "重度越界" if e.impact_severity >= 0.7
                else "中度越界" if e.impact_severity >= 0.3
                else "轻度越界/边界附近"
            ),
        }
