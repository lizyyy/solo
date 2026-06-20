from typing import List, Dict, Any, Optional, Tuple, Callable
from models import (
    StudentDraft,
    AttributionResult,
    AttributionConfig,
    FormulaTrace,
    BoundaryEvent,
    BoundaryEventType,
    EvidenceGap,
    EvidenceGapLevel,
    ProcessingStatus,
    AuditLogEntry,
    _gen_id,
    _now,
)
import re
import math


class FormulaEvaluator:
    BUILTIN_FUNCS = {
        "abs": abs,
        "max": max,
        "min": min,
        "sqrt": math.sqrt,
        "pow": pow,
        "log": math.log,
        "exp": math.exp,
    }

    def __init__(self, formulas: Dict[str, str], units: Dict[str, str]):
        self.formulas = formulas
        self.units = units

    def _safe_eval(self, expr: str, variables: Dict[str, float]) -> float:
        env = {**self.BUILTIN_FUNCS, **variables}
        allowed = set(list(self.BUILTIN_FUNCS.keys()) + list(variables.keys()))
        for tok in re.findall(r"[a-zA-Z_]\w*", expr):
            if tok not in allowed and tok not in ("True", "False", "None"):
                raise ValueError(f"未知变量或函数: {tok}")
        return float(eval(expr, {"__builtins__": {}}, env))

    def evaluate(self, var_name: str, inputs: Dict[str, float],
                 valid_ranges: Dict[str, Dict[str, float]]) -> Tuple[float, FormulaTrace]:
        formula = self.formulas.get(var_name, var_name)
        unit = self.units.get(var_name, "")

        if var_name in inputs:
            value = float(inputs[var_name])
            is_boundary = self._is_boundary_sample(var_name, value, valid_ranges)
            rationale = self._boundary_rationale(var_name, value, valid_ranges) if is_boundary else ""
            trace = FormulaTrace(
                variable=var_name,
                formula=f"直接取值: {value}",
                unit=unit,
                input_values={var_name: value},
                output_value=value,
                boundary_sample=is_boundary,
                boundary_rationale=rationale,
            )
            return value, trace

        referenced_vars = re.findall(r"[a-zA-Z_]\w*", formula)
        referenced_vars = [v for v in referenced_vars if v not in self.BUILTIN_FUNCS]
        available_inputs = {k: v for k, v in inputs.items() if isinstance(v, (int, float))}
        used_inputs = {k: available_inputs.get(k, 0.0) for k in referenced_vars if k in available_inputs}

        try:
            value = self._safe_eval(formula, available_inputs)
        except Exception as e:
            value = 0.0
            formula = f"{formula} [计算失败: {str(e)}]"

        is_boundary = any(
            self._is_boundary_sample(v, used_inputs.get(v, 0.0), valid_ranges)
            for v in referenced_vars
        ) or self._is_boundary_sample(var_name, value, valid_ranges)

        rationale_parts = []
        for v in referenced_vars:
            if v in used_inputs:
                vr = self._boundary_rationale(v, used_inputs[v], valid_ranges)
                if vr:
                    rationale_parts.append(vr)
        var_rationale = self._boundary_rationale(var_name, value, valid_ranges)
        if var_rationale:
            rationale_parts.append(var_rationale)

        trace = FormulaTrace(
            variable=var_name,
            formula=formula,
            unit=unit,
            input_values=used_inputs,
            output_value=value,
            boundary_sample=is_boundary,
            boundary_rationale="; ".join(rationale_parts),
        )
        return value, trace

    @staticmethod
    def _is_boundary_sample(var_name: str, value: float,
                             valid_ranges: Dict[str, Dict[str, float]],
                             margin: float = 0.05) -> bool:
        rng = valid_ranges.get(var_name)
        if not rng:
            return False
        lo = rng.get("min")
        hi = rng.get("max")
        if lo is None or hi is None:
            return False
        span = hi - lo
        if span == 0:
            return False
        margin_value = span * margin
        return (value <= lo + margin_value) or (value >= hi - margin_value)

    @staticmethod
    def _boundary_rationale(var_name: str, value: float,
                             valid_ranges: Dict[str, Dict[str, float]]) -> str:
        rng = valid_ranges.get(var_name)
        if not rng:
            return ""
        lo = rng.get("min")
        hi = rng.get("max")
        if lo is not None and value < lo:
            return f"{var_name}={value}低于下界{lo}"
        if hi is not None and value > hi:
            return f"{var_name}={value}超过上界{hi}"
        if lo is not None and hi is not None:
            span = hi - lo
            if span > 0:
                if value <= lo + span * 0.05:
                    return f"{var_name}={value}接近下界{lo}(5%范围内)"
                if value >= hi - span * 0.05:
                    return f"{var_name}={value}接近上界{hi}(5%范围内)"
        return ""


class BoundaryDetector:
    def __init__(self, valid_ranges: Dict[str, Dict[str, float]],
                 scratch_text_extractor: Callable[[str, str], str]):
        self.valid_ranges = valid_ranges
        self.extract_claim = scratch_text_extractor

    def detect(self, draft: StudentDraft, variable_name: str, value: float,
               formula_used: str, units: str, run_id: str) -> Optional[BoundaryEvent]:
        rng = self.valid_ranges.get(variable_name)
        if not rng:
            return None
        lo = rng.get("min")
        hi = rng.get("max")

        event_type = None
        clamped = None

        if lo is not None and value < lo:
            event_type = BoundaryEventType.EXTRAPOLATION
            clamped = lo
        elif hi is not None and value > hi:
            event_type = BoundaryEventType.OUT_OF_RANGE
            clamped = hi
        elif self._near_boundary(value, lo, hi):
            event_type = BoundaryEventType.CLAMPED

        if event_type is None:
            return None

        original_claim = self.extract_claim(draft.raw_scratch_text, variable_name)

        severity = 0.0
        if lo is not None and hi is not None and (hi - lo) > 0:
            if value < lo:
                severity = (lo - value) / (hi - lo)
            elif value > hi:
                severity = (value - hi) / (hi - lo)
            else:
                dist_lo = (value - lo) / (hi - lo)
                dist_hi = (hi - value) / (hi - lo)
                severity = 1.0 - max(dist_lo, dist_hi)
        severity = min(1.0, max(0.0, severity))

        return BoundaryEvent(
            draft_id=draft.draft_id,
            event_type=event_type,
            variable_name=variable_name,
            input_value=value,
            valid_min=lo,
            valid_max=hi,
            clamped_value=clamped,
            original_claim_text=original_claim,
            formula_used=formula_used,
            units=units,
            impact_severity=round(severity, 3),
            attribution_run_id=run_id,
        )

    @staticmethod
    def _near_boundary(value: float, lo: Optional[float], hi: Optional[float]) -> bool:
        if lo is None or hi is None:
            return False
        span = hi - lo
        if span == 0:
            return False
        margin = span * 0.05
        return (value <= lo + margin) or (value >= hi - margin)


class EvidenceGapDetector:
    RULES = [
        {
            "gap_type": "missing_chart_detail",
            "condition": lambda _, __, chart_pts: len(chart_pts) < 3,
            "description": "图表点数不足，点击回显缺少足够明细",
            "level": EvidenceGapLevel.SHOULD_FILL,
            "blocking": False,
            "suggestion": "补充学生草稿原始图表数据点，至少需要3个有效点",
        },
        {
            "gap_type": "missing_scratch_text",
            "condition": lambda draft, ___, ____: len(draft.raw_scratch_text.strip()) < 10,
            "description": "草稿文字说明过短，无法追溯原始说法",
            "level": EvidenceGapLevel.MUST_FILL,
            "blocking": True,
            "suggestion": "补录学生手写草稿中的关键说明文字或步骤描述",
        },
        {
            "gap_type": "low_confidence_mapping",
            "condition": lambda draft, __, ___: any(m.confidence < 0.85 and not m.manual_override for m in draft.field_mappings),
            "description": "存在低置信度字段映射，需人工确认",
            "level": EvidenceGapLevel.MUST_FILL,
            "blocking": True,
            "suggestion": "人工确认低置信度字段的映射关系并标记为人工修正",
        },
        {
            "gap_type": "extrapolation_without_claim",
            "condition": lambda _, boundary_events, __: any(
                b.event_type == BoundaryEventType.EXTRAPOLATION and not b.original_claim_text
                for b in boundary_events
            ),
            "description": "存在外推越界但未关联学生原始说法",
            "level": EvidenceGapLevel.MUST_FILL,
            "blocking": True,
            "suggestion": "从草稿文字中提取学生对越界参数的原始说法并补充",
        },
        {
            "gap_type": "formula_missing_units",
            "condition": lambda _, ___, traces: any(not t.unit for t in traces),
            "description": "部分计算变量缺少单位标注",
            "level": EvidenceGapLevel.NICE_TO_HAVE,
            "blocking": False,
            "suggestion": "在配置文件中补充相关变量的单位定义",
        },
        {
            "gap_type": "boundary_sample_unlabeled",
            "condition": lambda _, __, traces: any(t.boundary_sample and not t.boundary_rationale for t in traces),
            "description": "边界样本未标记具体原因",
            "level": EvidenceGapLevel.SHOULD_FILL,
            "blocking": False,
            "suggestion": "补充边界样本触发原因的详细说明",
        },
    ]

    def detect(self, draft: StudentDraft,
               boundary_events: List[BoundaryEvent],
               formula_traces: List[FormulaTrace]) -> List[EvidenceGap]:
        gaps = []
        for rule in self.RULES:
            try:
                triggered = rule["condition"](draft, boundary_events, formula_traces)
            except Exception:
                triggered = False
            if triggered:
                gaps.append(EvidenceGap(
                    draft_id=draft.draft_id,
                    gap_type=rule["gap_type"],
                    gap_description=rule["description"],
                    level=rule["level"],
                    fill_suggestion=rule["suggestion"],
                    blocking_release=rule["blocking"],
                ))
        return gaps


class ConstraintAttributionEngine:
    def __init__(self, config: AttributionConfig, auditor=None):
        self.config = config
        self.auditor = auditor
        self.evaluator = FormulaEvaluator(config.formulas, config.units)
        self.boundary_detector = BoundaryDetector(config.valid_ranges, self._extract_claim_from_scratch)
        self.gap_detector = EvidenceGapDetector()

    @staticmethod
    def _extract_claim_from_scratch(scratch_text: str, variable_name: str) -> str:
        if not scratch_text:
            return ""
        lines = scratch_text.replace("\r", "").split("\n")
        patterns = [variable_name, variable_name.lower(), variable_name.upper()]
        for line in lines:
            for pat in patterns:
                if pat in line and len(line.strip()) > 3:
                    return line.strip()[:200]
        return ""

    def _build_clickthrough(self, draft: StudentDraft,
                             traces: List[FormulaTrace]) -> List[Dict[str, Any]]:
        items = []
        for idx, pt in enumerate(draft.raw_chart_points):
            linked_traces = [
                {"variable": t.variable, "value": t.output_value, "unit": t.unit, "formula": t.formula}
                for t in traces if any(k in str(pt) for k in t.input_values)
            ]
            items.append({
                "chart_index": idx,
                "raw_point": pt,
                "linked_formulas": linked_traces,
                "draft_id": draft.draft_id,
                "student_id": draft.student_id,
                "question_id": draft.question_id,
                "source_file": draft.source_file,
                "clickthrough_payload": {
                    "draft_id": draft.draft_id,
                    "chart_point_index": idx,
                    "raw_scratch_excerpt": draft.raw_scratch_text[:300],
                    "mapping_records": [
                        {"source": m.source_field, "target": m.target_field, "confidence": m.confidence}
                        for m in draft.field_mappings
                    ],
                },
            })
        if not items:
            items.append({
                "chart_index": -1,
                "raw_point": {},
                "linked_formulas": [
                    {"variable": t.variable, "value": t.output_value, "unit": t.unit, "formula": t.formula}
                    for t in traces
                ],
                "draft_id": draft.draft_id,
                "student_id": draft.student_id,
                "question_id": draft.question_id,
                "source_file": draft.source_file,
                "clickthrough_payload": {
                    "draft_id": draft.draft_id,
                    "chart_point_index": -1,
                    "raw_scratch_excerpt": draft.raw_scratch_text[:300],
                    "mapping_records": [
                        {"source": m.source_field, "target": m.target_field, "confidence": m.confidence}
                        for m in draft.field_mappings
                    ],
                },
            })
        return items

    def _classify_error(self, values: Dict[str, float], traces: List[FormulaTrace],
                         boundary_events: List[BoundaryEvent],
                         thresholds: Dict[str, float]) -> Tuple[str, str, float, float]:
        conceptual_hits = 0
        calculation_hits = 0
        conceptual_weight = thresholds.get("conceptual_error_weight", 0.6)
        calculation_weight = thresholds.get("calculation_error_weight", 0.4)
        extrapolation_penalty = thresholds.get("extrapolation_penalty", 0.25)

        for b in boundary_events:
            if b.event_type in (BoundaryEventType.EXTRAPOLATION, BoundaryEventType.OUT_OF_RANGE):
                conceptual_hits += 1

        for t in traces:
            if t.boundary_sample:
                calculation_hits += 0.5
            if "[计算失败" in t.formula:
                calculation_hits += 1

        extrap_count = sum(
            1 for b in boundary_events
            if b.event_type == BoundaryEventType.EXTRAPOLATION
        )

        raw_score = (conceptual_hits * conceptual_weight +
                     calculation_hits * calculation_weight)
        penalty = extrap_count * extrapolation_penalty
        severity = min(1.0, raw_score + penalty)
        confidence = max(thresholds.get("confidence_floor", 0.3), 1.0 - 0.1 * (conceptual_hits + calculation_hits))
        confidence = round(confidence, 3)
        severity = round(severity, 3)

        if conceptual_hits > calculation_hits:
            category = "概念性错误"
            subcategory = "约束越界" if extrap_count > 0 else "条件误读"
        elif calculation_hits > 0:
            category = "计算性错误"
            subcategory = "边界样本处理" if any(t.boundary_sample for t in traces) else "公式执行错误"
        elif extrap_count > 0:
            category = "约束性错误"
            subcategory = "外推越界"
        else:
            category = "无明显错误"
            subcategory = "待复核"

        return category, subcategory, confidence, severity

    def run(self, draft: StudentDraft, run_id: str = "",
            operator: str = "engine") -> Tuple[AttributionResult, List[BoundaryEvent], List[EvidenceGap]]:
        run_id = run_id or _gen_id()
        inputs = {k: v for k, v in draft.normalized_data.items() if isinstance(v, (int, float))}

        traces: List[FormulaTrace] = []
        eval_vars = list(self.config.formulas.keys())
        if not eval_vars:
            eval_vars = list(inputs.keys())

        final_values: Dict[str, float] = {}
        for var in eval_vars:
            val, trace = self.evaluator.evaluate(var, {**inputs, **final_values}, self.config.valid_ranges)
            traces.append(trace)
            final_values[var] = val

        for var, val in inputs.items():
            if var not in [t.variable for t in traces]:
                val_float = float(val)
                is_bd = self.evaluator._is_boundary_sample(var, val_float, self.config.valid_ranges)
                ration = self.evaluator._boundary_rationale(var, val_float, self.config.valid_ranges) if is_bd else ""
                traces.append(FormulaTrace(
                    variable=var,
                    formula=f"原始输入",
                    unit=self.config.units.get(var, ""),
                    input_values={var: val_float},
                    output_value=val_float,
                    boundary_sample=is_bd,
                    boundary_rationale=ration,
                ))
                final_values[var] = val_float

        boundary_events: List[BoundaryEvent] = []
        for t in traces:
            be = self.boundary_detector.detect(
                draft, t.variable, t.output_value, t.formula, t.unit, run_id
            )
            if be:
                boundary_events.append(be)

        category, subcategory, confidence, severity = self._classify_error(
            final_values, traces, boundary_events, self.config.thresholds
        )

        clickthrough = self._build_clickthrough(draft, traces)
        supporting_evidence = [
            {
                "type": "formula_trace",
                "variable": t.variable,
                "formula": t.formula,
                "unit": t.unit,
                "inputs": t.input_values,
                "output": t.output_value,
                "boundary_sample": t.boundary_sample,
                "rationale": t.boundary_rationale,
            }
            for t in traces
        ] + [
            {
                "type": "boundary_event",
                "event_id": b.event_id,
                "variable": b.variable_name,
                "event_type": b.event_type.value,
                "value": b.input_value,
                "clamped": b.clamped_value,
                "valid_min": b.valid_min,
                "valid_max": b.valid_max,
                "original_claim": b.original_claim_text,
                "severity": b.impact_severity,
            }
            for b in boundary_events
        ]

        result = AttributionResult(
            draft_id=draft.draft_id,
            run_id=run_id,
            config_id=self.config.config_id,
            error_category=category,
            error_subcategory=subcategory,
            confidence_score=confidence,
            severity=severity,
            formula_traces=traces,
            supporting_evidence=supporting_evidence,
            chart_clickthrough=clickthrough,
            boundary_events=[b.event_id for b in boundary_events],
        )

        gaps = self.gap_detector.detect(draft, boundary_events, traces)

        draft.processing_status = ProcessingStatus.ATTRIBUTED
        draft.version += 1
        draft.updated_at = _now()

        if self.auditor:
            self.auditor.log(
                AuditLogEntry(
                    entity_type="AttributionResult",
                    entity_id=result.attribution_id,
                    action="run_attribution",
                    operator=operator,
                    before={"draft_status": ProcessingStatus.NORMALIZED.value},
                    after={
                        "category": category,
                        "subcategory": subcategory,
                        "confidence": confidence,
                        "severity": severity,
                        "boundary_events": len(boundary_events),
                        "gaps": len(gaps),
                    },
                    comment=f"归因完成: {category}/{subcategory}, 置信度{confidence}, 严重度{severity}",
                )
            )

        return result, boundary_events, gaps
