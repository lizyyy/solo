from __future__ import annotations

from copy import deepcopy
from datetime import datetime
from typing import Any, Callable, Optional

from ..models.change_record import ChangeRecord, ChangeSource, ChangeType
from ..models.constraint import ConstraintOverride, ConstraintSpec, OverrideSource
from ..models.evidence import EvidenceKind, EvidenceRef, ExperimentalData, ResultGraph
from ..models.score import ScoreItem, ScoreResult


class ScoringEngine:
    def __init__(self) -> None:
        self._results: dict[str, ScoreResult] = {}
        self._result_graphs: dict[str, ResultGraph] = {}
        self._exp_data: dict[str, ExperimentalData] = {}
        self._constraints: dict[str, ConstraintSpec] = {}
        self._constraint_overrides: list[ConstraintOverride] = []
        self._change_history: list[ChangeRecord] = []
        self._constraint_history: dict[str, list[dict[str, Any]]] = {}

    # ------------------------------------------------------------------
    # evidence registration
    # ------------------------------------------------------------------
    def register_result_graph(self, graph: ResultGraph) -> EvidenceRef:
        self._result_graphs[graph.id] = graph
        ref = graph.as_evidence_ref()
        self._change_history.append(
            ChangeRecord(
                change_type=ChangeType.SUPPLEMENT,
                source=ChangeSource.RESULT_GRAPH,
                description=f"注册结果图 team={graph.team_id} route={graph.route_id}",
                after=graph.id,
                evidence_ref=ref,
            )
        )
        return ref

    def register_experimental_data(self, data: ExperimentalData) -> EvidenceRef:
        self._exp_data[data.id] = data
        ref = data.as_evidence_ref()
        self._change_history.append(
            ChangeRecord(
                change_type=ChangeType.SUPPLEMENT,
                source=ChangeSource.EXPERIMENTAL_DATA,
                description=f"注册实验数据 team={data.team_id} route={data.route_id}",
                after=data.id,
                evidence_ref=ref,
            )
        )
        return ref

    # ------------------------------------------------------------------
    # constraint management with full history
    # ------------------------------------------------------------------
    def add_constraint(self, spec: ConstraintSpec) -> None:
        self._constraints[spec.id] = spec
        self._constraint_history.setdefault(spec.id, []).append(
            {
                "version": spec.version,
                "value": deepcopy(spec.value),
                "description": spec.description,
                "is_active": spec.is_active,
                "timestamp": datetime.now().isoformat(),
                "source": "initial",
            }
        )
        self._change_history.append(
            ChangeRecord(
                change_type=ChangeType.SUPPLEMENT,
                source=ChangeSource.SYSTEM,
                description=f"添加约束 [{spec.name}]",
                after=spec.value,
            )
        )

    def override_constraint(
        self,
        constraint_id: str,
        new_value: Any,
        source: OverrideSource,
        reason: str = "",
        evidence_id: Optional[str] = None,
        evidence_kind: Optional[EvidenceKind] = None,
        next_action: str = "",
        next_responsible: str = "",
        changed_by: str = "system",
    ) -> ConstraintOverride:
        spec = self._constraints.get(constraint_id)
        if spec is None:
            raise ValueError(f"约束 {constraint_id} 不存在")

        old_value = spec.value
        old_description = spec.description
        old_version = spec.version

        override = ConstraintOverride(
            constraint_id=constraint_id,
            constraint_name=spec.name,
            old_value=old_value,
            new_value=new_value,
            source=source,
            source_evidence_id=evidence_id,
            source_evidence_kind=evidence_kind,
            reason=reason,
            next_action=next_action,
            next_responsible=next_responsible,
        )
        self._constraint_overrides.append(override)

        spec.value = new_value
        spec.version += 1
        spec.updated_at = datetime.now()

        self._constraint_history.setdefault(constraint_id, []).append(
            {
                "version": spec.version,
                "value": deepcopy(new_value),
                "description": spec.description,
                "is_active": spec.is_active,
                "timestamp": datetime.now().isoformat(),
                "source": source.value,
                "evidence_id": evidence_id,
                "reason": reason,
                "old_value": deepcopy(old_value),
            }
        )

        self._change_history.append(
            ChangeRecord(
                change_type=ChangeType.CONSTRAINT_OVERRIDE,
                source=ChangeSource(source.value),
                description=f"约束 [{spec.name}] 被覆盖: {old_value} → {new_value}",
                before=old_value,
                after=new_value,
                override_ref=override,
                changed_by=changed_by,
            )
        )

        self._recheck_affected_scores(constraint_id, override)

        return override

    def manual_edit_constraint(
        self,
        constraint_id: str,
        new_value: Optional[Any] = None,
        new_description: Optional[str] = None,
        reason: str = "",
        changed_by: str = "coach",
    ) -> ChangeRecord:
        spec = self._constraints.get(constraint_id)
        if spec is None:
            raise ValueError(f"约束 {constraint_id} 不存在")

        old_value = spec.value
        old_description = spec.description
        old_version = spec.version

        updates: dict[str, Any] = {"version": spec.version + 1}
        if new_value is not None:
            updates["value"] = new_value
        if new_description is not None:
            updates["description"] = new_description

        for k, v in updates.items():
            setattr(spec, k, v)

        self._constraint_history.setdefault(constraint_id, []).append(
            {
                "version": spec.version,
                "value": deepcopy(spec.value),
                "description": spec.description,
                "is_active": spec.is_active,
                "timestamp": datetime.now().isoformat(),
                "source": "manual",
                "changed_by": changed_by,
                "reason": reason,
                "old_value": deepcopy(old_value),
                "old_description": old_description,
            }
        )

        record = ChangeRecord(
            change_type=ChangeType.MANUAL_EDIT,
            source=ChangeSource.MANUAL,
            description=f"手动修改约束 [{spec.name}]: value={old_value}→{spec.value}, desc='{old_description}'→'{spec.description}'",
            before={"value": old_value, "description": old_description},
            after={"value": spec.value, "description": spec.description},
            changed_by=changed_by,
        )
        self._change_history.append(record)
        return record

    # ------------------------------------------------------------------
    # scoring with traceability
    # ------------------------------------------------------------------
    def create_score(
        self,
        team_id: str,
        route_id: str,
        dimensions: list[dict[str, Any]],
        scorer: Optional[Callable[[dict[str, Any]], tuple[float, str]]] = None,
    ) -> ScoreResult:
        result = ScoreResult(team_id=team_id, route_id=route_id)

        for dim in dimensions:
            constraint_id = dim.get("constraint_id")
            evidence_ids: list[str] = dim.get("evidence_ids", [])
            evidence_refs = self._resolve_evidence_refs(evidence_ids)

            if scorer:
                score_val, desc = scorer(dim)
            else:
                score_val = dim.get("score", 0.0)
                desc = dim.get("description", "")

            item = ScoreItem(
                dimension=dim["dimension"],
                score=score_val,
                max_score=dim.get("max_score", 100.0),
                description=desc,
                evidence_refs=evidence_refs,
                constraint_id=constraint_id,
            )
            result.items.append(item)

            if score_val != dim.get("previous_score"):
                self._change_history.append(
                    ChangeRecord(
                        change_type=ChangeType.CONCLUSION_CHANGE,
                        source=ChangeSource.SYSTEM,
                        description=f"评分项 [{dim['dimension']}] 赋分 {score_val}",
                        after=score_val,
                        evidence_ref=evidence_refs[0] if evidence_refs else None,
                    )
                )

        result.compute_total()
        self._results[result.id] = result
        return result

    def supplement_evidence_to_score(
        self,
        result_id: str,
        dimension: str,
        evidence_ref: EvidenceRef,
        affects_conclusion: bool = False,
    ) -> ChangeRecord:
        result = self._results.get(result_id)
        if result is None:
            raise ValueError(f"评分结果 {result_id} 不存在")

        for item in result.items:
            if item.dimension == dimension:
                item.evidence_refs.append(evidence_ref)
                break
        else:
            raise ValueError(f"评分维度 {dimension} 不存在")

        change_type = ChangeType.CONCLUSION_CHANGE if affects_conclusion else ChangeType.SUPPLEMENT
        record = ChangeRecord(
            change_type=change_type,
            source=ChangeSource(evidence_ref.kind.value),
            description=f"{'结论变更' if affects_conclusion else '补材料'}: 维度[{dimension}] 追加依据 {evidence_ref.label()}",
            evidence_ref=evidence_ref,
        )
        self._change_history.append(record)
        return record

    # ------------------------------------------------------------------
    # query / reporting
    # ------------------------------------------------------------------
    def get_result(self, result_id: str) -> Optional[ScoreResult]:
        return self._results.get(result_id)

    def get_constraint(self, constraint_id: str) -> Optional[ConstraintSpec]:
        return self._constraints.get(constraint_id)

    def get_constraint_history(self, constraint_id: str) -> list[dict[str, Any]]:
        return self._constraint_history.get(constraint_id, [])

    def get_overrides_for_constraint(self, constraint_id: str) -> list[ConstraintOverride]:
        return [o for o in self._constraint_overrides if o.constraint_id == constraint_id]

    def get_change_history(
        self,
        change_type: Optional[ChangeType] = None,
        source: Optional[ChangeSource] = None,
    ) -> list[ChangeRecord]:
        records = self._change_history
        if change_type is not None:
            records = [r for r in records if r.change_type == change_type]
        if source is not None:
            records = [r for r in records if r.source == source]
        return records

    def get_supplements_only(self) -> list[ChangeRecord]:
        return [r for r in self._change_history if r.change_type == ChangeType.SUPPLEMENT]

    def get_conclusion_changes_only(self) -> list[ChangeRecord]:
        return [r for r in self._change_history if r.change_type in (ChangeType.CONCLUSION_CHANGE, ChangeType.CONSTRAINT_OVERRIDE)]

    def change_log_report(self) -> str:
        if not self._change_history:
            return "无变更记录"

        lines = ["变更日志:", "=" * 60]
        for i, rec in enumerate(self._change_history, 1):
            lines.append(f"\n#{i} {rec.summary()}")
        lines.append("\n" + "=" * 60)

        sup_count = sum(1 for r in self._change_history if r.change_type == ChangeType.SUPPLEMENT)
        cc_count = sum(1 for r in self._change_history if r.change_type == ChangeType.CONCLUSION_CHANGE)
        co_count = sum(1 for r in self._change_history if r.change_type == ChangeType.CONSTRAINT_OVERRIDE)
        me_count = sum(1 for r in self._change_history if r.change_type == ChangeType.MANUAL_EDIT)

        lines.append(f"统计: 补材料={sup_count}, 改结论={cc_count}, 约束覆盖={co_count}, 手动修改={me_count}")
        return "\n".join(lines)

    def constraint_audit_report(self, constraint_id: str) -> str:
        spec = self._constraints.get(constraint_id)
        if spec is None:
            return f"约束 {constraint_id} 不存在"

        history = self._constraint_history.get(constraint_id, [])
        overrides = self.get_overrides_for_constraint(constraint_id)

        lines = [
            f"约束审计 - [{spec.name}] (id={constraint_id})",
            f"当前值: {spec.value}, 版本: {spec.version}, 状态: {'激活' if spec.is_active else '停用'}",
            "=" * 50,
            "版本历史:",
        ]
        for h in history:
            src_label = {"initial": "初始", "manual": "手动", "result_graph": "结果图", "experimental_data": "实验数据"}.get(
                h.get("source", ""), h.get("source", "")
            )
            lines.append(f"  v{h['version']} | {h.get('timestamp', '')} | 来源:{src_label} | 值:{h.get('old_value', 'N/A')}→{h['value']}")
            if h.get("changed_by"):
                lines.append(f"         操作人: {h['changed_by']}")
            if h.get("reason"):
                lines.append(f"         原因: {h['reason']}")

        if overrides:
            lines.append("\n约束覆盖记录:")
            for o in overrides:
                lines.append(o.explain())

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # internal
    # ------------------------------------------------------------------
    def _resolve_evidence_refs(self, evidence_ids: list[str]) -> list[EvidenceRef]:
        refs: list[EvidenceRef] = []
        for eid in evidence_ids:
            if eid in self._result_graphs:
                refs.append(self._result_graphs[eid].as_evidence_ref())
            elif eid in self._exp_data:
                refs.append(self._exp_data[eid].as_evidence_ref())
        return refs

    def _recheck_affected_scores(self, constraint_id: str, override: ConstraintOverride) -> None:
        for result in self._results.values():
            for item in result.items:
                if item.constraint_id == constraint_id:
                    self._change_history.append(
                        ChangeRecord(
                            change_type=ChangeType.CONCLUSION_CHANGE,
                            source=ChangeSource.SYSTEM,
                            description=f"约束覆盖可能影响评分: 结果[{result.id}] 维度[{item.dimension}]",
                            override_ref=override,
                        )
                    )
