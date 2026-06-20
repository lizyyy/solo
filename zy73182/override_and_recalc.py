from typing import List, Dict, Any, Optional, Tuple
from models import (
    OverrideRecord,
    OverrideSource,
    ProcessingStatus,
    AttributionResult,
    StudentDraft,
    AuditLogEntry,
    EvidenceGap,
    EvidenceGapLevel,
    AttributionConfig,
    RecalculationReport,
    RecalculationDiff,
    _now,
    _gen_id,
)
from engine import ConstraintAttributionEngine


class OverrideManager:
    def __init__(self, auditor=None):
        self.auditor = auditor
        self._overrides: List[OverrideRecord] = []

    def override_attribution(self,
                              draft: StudentDraft,
                              old_result: AttributionResult,
                              new_category: str,
                              new_subcategory: str = "",
                              new_confidence: Optional[float] = None,
                              operator: str = "anonymous",
                              reason: str = "",
                              source: OverrideSource = OverrideSource.MANUAL,
                              reference_material_id: str = "") -> Tuple[OverrideRecord, StudentDraft]:
        effective_confidence = new_confidence if new_confidence is not None else old_result.confidence_score
        effective_subcategory = new_subcategory or old_result.error_subcategory

        previous_status = draft.processing_status

        override = OverrideRecord(
            draft_id=draft.draft_id,
            attribution_id=old_result.attribution_id,
            previous_category=f"{old_result.error_category}/{old_result.error_subcategory}",
            new_category=f"{new_category}/{effective_subcategory}",
            previous_confidence=old_result.confidence_score,
            new_confidence=effective_confidence,
            operator=operator,
            source=source,
            reason=reason,
            reference_material_id=reference_material_id,
            previous_status=previous_status,
            new_status=ProcessingStatus.OVERRIDDEN,
        )

        self._overrides.append(override)

        draft.processing_status = ProcessingStatus.OVERRIDDEN
        draft.version += 1
        draft.updated_at = _now()

        if self.auditor:
            self.auditor.log(
                AuditLogEntry(
                    entity_type="OverrideRecord",
                    entity_id=override.override_id,
                    action="create_override",
                    operator=operator,
                    before={
                        "category": override.previous_category,
                        "confidence": override.previous_confidence,
                        "draft_status": previous_status.value,
                    },
                    after={
                        "category": override.new_category,
                        "confidence": override.new_confidence,
                        "draft_status": ProcessingStatus.OVERRIDDEN.value,
                        "source": source.value,
                    },
                    comment=reason or f"人工改判: {override.previous_category} -> {override.new_category}",
                )
            )

        return override, draft

    def get_override_history(self, draft_id: str = "",
                              operator: str = "",
                              source: Optional[OverrideSource] = None,
                              limit: int = 100) -> List[OverrideRecord]:
        result = self._overrides
        if draft_id:
            result = [o for o in result if o.draft_id == draft_id]
        if operator:
            result = [o for o in result if o.operator == operator]
        if source is not None:
            result = [o for o in result if o.source == source]
        return sorted(result, key=lambda o: o.created_at, reverse=True)[:limit]

    def get_current_status(self, draft_id: str) -> Dict[str, Any]:
        history = self.get_override_history(draft_id=draft_id)
        if not history:
            return {"status": "no_override", "history_count": 0}
        latest = history[0]
        return {
            "status": latest.new_status.value,
            "current_category": latest.new_category,
            "current_confidence": latest.new_confidence,
            "latest_operator": latest.operator,
            "latest_source": latest.source.value,
            "latest_reason": latest.reason,
            "latest_at": latest.created_at,
            "history_count": len(history),
        }


class RecalculationEngine:
    def __init__(self, auditor=None):
        self.auditor = auditor

    def clone_config(self, old_config: AttributionConfig,
                      threshold_overrides: Optional[Dict[str, float]] = None,
                      range_overrides: Optional[Dict[str, Dict[str, float]]] = None,
                      new_name: str = "") -> AttributionConfig:
        new_thresholds = {**old_config.thresholds}
        if threshold_overrides:
            new_thresholds.update(threshold_overrides)

        new_ranges = {k: dict(v) for k, v in old_config.valid_ranges.items()}
        if range_overrides:
            for k, v in range_overrides.items():
                if k in new_ranges:
                    new_ranges[k].update(v)
                else:
                    new_ranges[k] = dict(v)

        return AttributionConfig(
            config_name=new_name or f"{old_config.config_name}_v{old_config.version + 1}",
            version=old_config.version + 1,
            thresholds=new_thresholds,
            category_rules=dict(old_config.category_rules),
            valid_ranges=new_ranges,
            formulas=dict(old_config.formulas),
            units=dict(old_config.units),
            field_synonyms={k: list(v) for k, v in old_config.field_synonyms.items()},
            created_by="recalc_engine",
        )

    def recalculate(self,
                     drafts: List[StudentDraft],
                     old_config: AttributionConfig,
                     new_config: AttributionConfig,
                     previous_results: Dict[str, AttributionResult],
                     operator: str = "recalc_job") -> Tuple[RecalculationReport,
                                                           Dict[str, AttributionResult],
                                                           Dict[str, List[EvidenceGap]]]:
        new_engine = ConstraintAttributionEngine(new_config, self.auditor)
        run_id = _gen_id()

        report = RecalculationReport(
            old_config_id=old_config.config_id,
            new_config_id=new_config.config_id,
        )

        new_results: Dict[str, AttributionResult] = {}
        all_new_gaps: Dict[str, List[EvidenceGap]] = {}
        category_change_counter: Dict[str, int] = {}
        boundary_changes = 0
        formula_changes = 0

        threshold_diff = self._dict_diff(old_config.thresholds, new_config.thresholds)
        range_diff = self._nested_dict_diff(old_config.valid_ranges, new_config.valid_ranges)

        for draft in drafts:
            old_result = previous_results.get(draft.draft_id)
            if not old_result:
                continue

            new_result, _, new_gaps = new_engine.run(draft, run_id=run_id, operator=operator)
            new_results[draft.draft_id] = new_result
            all_new_gaps[draft.draft_id] = new_gaps

            diffs = self._compare_results(
                old_result, new_result, old_config, new_config,
                threshold_diff, range_diff, draft
            )

            if diffs:
                report.affected_draft_count += 1
                report.per_draft_diffs[draft.draft_id] = diffs

                old_cat = old_result.error_category
                new_cat = new_result.error_category
                if old_cat != new_cat:
                    key = f"{old_cat} -> {new_cat}"
                    category_change_counter[key] = category_change_counter.get(key, 0) + 1

                for d in diffs:
                    if d.boundary_sample_involved:
                        boundary_changes += 1
                    if d.changed_by_formula:
                        formula_changes += 1

            delta = {
                "category_changed": old_result.error_category != new_result.error_category,
                "subcategory_changed": old_result.error_subcategory != new_result.error_subcategory,
                "confidence_delta": round(new_result.confidence_score - old_result.confidence_score, 4),
                "severity_delta": round(new_result.severity - old_result.severity, 4),
                "diff_summary": [d.rationale for d in diffs],
            }
            new_result.delta_from_previous = delta
            old_result.is_latest = False

        report.category_changes = category_change_counter
        report.boundary_driven_changes = boundary_changes
        report.formula_driven_changes = formula_changes

        if self.auditor:
            self.auditor.log(
                AuditLogEntry(
                    entity_type="RecalculationReport",
                    entity_id=report.report_id,
                    action="recalculate",
                    operator=operator,
                    before={
                        "config_id": old_config.config_id,
                        "config_version": old_config.version,
                    },
                    after={
                        "config_id": new_config.config_id,
                        "config_version": new_config.version,
                        "affected_drafts": report.affected_draft_count,
                        "category_changes": category_change_counter,
                    },
                    comment=f"参数复算完成，影响{report.affected_draft_count}份草稿，分类变更{sum(category_change_counter.values())}次",
                )
            )

        return report, new_results, all_new_gaps

    @staticmethod
    def _dict_diff(old: Dict, new: Dict) -> Dict[str, Tuple[Any, Any]]:
        diff = {}
        all_keys = set(old.keys()) | set(new.keys())
        for k in all_keys:
            if old.get(k) != new.get(k):
                diff[k] = (old.get(k), new.get(k))
        return diff

    @staticmethod
    def _nested_dict_diff(old: Dict, new: Dict) -> Dict[str, Dict[str, Tuple[Any, Any]]]:
        diff = {}
        all_keys = set(old.keys()) | set(new.keys())
        for k in all_keys:
            d = RecalculationEngine._dict_diff(old.get(k, {}), new.get(k, {}))
            if d:
                diff[k] = d
        return diff

    def _compare_results(self,
                          old: AttributionResult,
                          new: AttributionResult,
                          old_config: AttributionConfig,
                          new_config: AttributionConfig,
                          threshold_diff: Dict[str, Tuple[Any, Any]],
                          range_diff: Dict[str, Dict[str, Tuple[Any, Any]]],
                          draft: StudentDraft) -> List[RecalculationDiff]:
        diffs: List[RecalculationDiff] = []
        old_traces = {t.variable: t for t in old.formula_traces}
        new_traces = {t.variable: t for t in new.formula_traces}
        all_vars = set(old_traces.keys()) | set(new_traces.keys())

        for var in all_vars:
            ot = old_traces.get(var)
            nt = new_traces.get(var)

            old_val = ot.output_value if ot else None
            new_val = nt.output_value if nt else None
            if old_val == new_val and ot and nt and ot.formula == nt.formula:
                continue

            unit = (nt or ot).unit if (nt or ot) else ""

            changed_by_formula = False
            if ot and nt and ot.formula != nt.formula:
                changed_by_formula = True

            changed_by_threshold = False
            rationale_parts = []
            for th_key, (ov, nv) in threshold_diff.items():
                if th_key in ("conceptual_error_weight", "calculation_error_weight",
                              "extrapolation_penalty", "boundary_sample_margin"):
                    changed_by_threshold = True
                    rationale_parts.append(f"阈值{th_key}: {ov}->{nv}")

            boundary_involved = False
            if range_diff:
                for range_key, subdiff in range_diff.items():
                    if range_key == var or (nt and range_key in nt.input_values):
                        boundary_involved = True
                        for rk, (rov, rnv) in subdiff.items():
                            rationale_parts.append(f"参数{var}的{rk}: {rov}->{rnv}")

            if nt and nt.boundary_sample:
                boundary_involved = True
                if nt.boundary_rationale:
                    rationale_parts.append(f"边界样本: {nt.boundary_rationale}")
            if ot and ot.boundary_sample and not (nt and nt.boundary_sample):
                boundary_involved = True
                rationale_parts.append(f"旧值为边界样本: {ot.boundary_rationale or var}")

            if old_val != new_val:
                rationale_parts.insert(0, f"{var}: {old_val}{unit} -> {new_val}{unit}")

            if not rationale_parts and old.error_category != new.error_category:
                rationale_parts.append(f"分类变更触发: {old.error_category} -> {new.error_category}")

            if rationale_parts:
                diffs.append(RecalculationDiff(
                    variable=var,
                    old_value=old_val,
                    new_value=new_val,
                    changed_by_formula=changed_by_formula,
                    changed_by_threshold=changed_by_threshold,
                    boundary_sample_involved=boundary_involved,
                    unit=unit,
                    rationale=" | ".join(rationale_parts),
                ))

        if old.error_category != new.error_category:
            cat_diff = RecalculationDiff(
                variable="__category__",
                old_value=f"{old.error_category}/{old.error_subcategory}",
                new_value=f"{new.error_category}/{new.error_subcategory}",
                changed_by_formula=any(d.changed_by_formula for d in diffs),
                changed_by_threshold=bool(threshold_diff),
                boundary_sample_involved=any(d.boundary_sample_involved for d in diffs),
                unit="",
                rationale=f"归因分类由{old.error_category}/{old.error_subcategory}变更为{new.error_category}/{new.error_subcategory}，置信度{old.confidence_score}->{new.confidence_score}，严重度{old.severity}->{new.severity}",
            )
            diffs.append(cat_diff)

        return diffs


class GapManager:
    def __init__(self, auditor=None):
        self.auditor = auditor
        self._gaps: Dict[str, List[EvidenceGap]] = {}

    def register_gaps(self, draft_id: str, gaps: List[EvidenceGap]):
        self._gaps[draft_id] = gaps

    def resolve_gap(self, draft_id: str, gap_id: str,
                    resolver: str, note: str = "") -> Optional[EvidenceGap]:
        gaps = self._gaps.get(draft_id, [])
        for g in gaps:
            if g.gap_id == gap_id and not g.resolved:
                g.resolved = True
                g.resolved_by = resolver
                g.resolved_at = _now()
                if self.auditor:
                    self.auditor.log(
                        AuditLogEntry(
                            entity_type="EvidenceGap",
                            entity_id=gap_id,
                            action="resolve_gap",
                            operator=resolver,
                            before={"resolved": False},
                            after={"resolved": True},
                            comment=note or f"解决证据缺口: {g.gap_description}",
                        )
                    )
                return g
        return None

    def get_summary(self, drafts: List[StudentDraft]) -> Dict[str, Any]:
        total_gaps = 0
        unresolved = 0
        must_fill = 0
        should_fill = 0
        ok_to_pass = 0
        nice_to_have = 0
        blocking = 0

        for draft in drafts:
            for g in self._gaps.get(draft.draft_id, []):
                total_gaps += 1
                if not g.resolved:
                    unresolved += 1
                    if g.level == EvidenceGapLevel.MUST_FILL:
                        must_fill += 1
                    elif g.level == EvidenceGapLevel.SHOULD_FILL:
                        should_fill += 1
                    elif g.level == EvidenceGapLevel.OK_TO_PASS:
                        ok_to_pass += 1
                    elif g.level == EvidenceGapLevel.NICE_TO_HAVE:
                        nice_to_have += 1
                    if g.blocking_release:
                        blocking += 1

        return {
            "total_drafts": len(drafts),
            "total_gaps": total_gaps,
            "unresolved_gaps": unresolved,
            "must_fill_pending": must_fill,
            "should_fill_pending": should_fill,
            "ok_to_pass_count": ok_to_pass,
            "nice_to_have_count": nice_to_have,
            "blocking_release_count": blocking,
            "can_release": must_fill == 0 and blocking == 0,
        }

    def list_unresolved(self, level: Optional[EvidenceGapLevel] = None,
                         blocking_only: bool = False) -> List[EvidenceGap]:
        all_unresolved: List[EvidenceGap] = []
        for gaps in self._gaps.values():
            for g in gaps:
                if not g.resolved:
                    if level and g.level != level:
                        continue
                    if blocking_only and not g.blocking_release:
                        continue
                    all_unresolved.append(g)
        return sorted(all_unresolved, key=lambda g: (g.level.value, g.created_at))
