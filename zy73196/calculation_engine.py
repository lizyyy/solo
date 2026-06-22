from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

from models import (
    BoundaryParams,
    StudentWork,
    InputType,
    ReviewRecord,
)


def _json_safe_value(v: Any) -> Any:
    if isinstance(v, set):
        return sorted(v)
    if isinstance(v, list):
        return [_json_safe_value(x) for x in v]
    if isinstance(v, dict):
        return {k: _json_safe_value(x) for k, x in v.items()}
    return v


def _to_set(v: Any) -> Optional[set]:
    if v is None:
        return None
    if isinstance(v, set):
        return v
    if isinstance(v, (list, tuple)):
        try:
            return set(v)
        except TypeError:
            return None
    return None


class CalculationEngine:
    STANDARD_ANSWERS = {
        "prob_area_rectangle": {"value": 24.0, "unit": "cm²", "formula": "S = a × b"},
        "prob_velocity": {"value": 15.0, "unit": "m/s", "formula": "v = s / t"},
        "prob_set_operation": {"value": [1, 2, 3], "unit": None, "formula": "A ∪ B"},
        "prob_perimeter": {"value": 20.0, "unit": "m", "formula": "C = 2(a + b)"},
    }

    def __init__(self):
        self._calc_history: Dict[str, List[Dict[str, Any]]] = {}

    def detect_input_anomalies(
        self, work: StudentWork, params: BoundaryParams
    ) -> List[Dict[str, Any]]:
        anomalies = []
        input_type = work.detect_input_type(params)

        if input_type == InputType.EMPTY_SET:
            anomalies.append(
                {
                    "type": "empty_set",
                    "severity": "warning",
                    "message": "答案为空集合或空值",
                    "detail": "学生提交了空集合，需确认是否为有效答案（如集合运算结果确为空）",
                    "relation": "空集合在集合运算中可能是正常结果，需结合题意判断",
                    "source": "student_submit",
                }
            )
        elif input_type == InputType.DRAFT:
            anomalies.append(
                {
                    "type": "student_draft",
                    "severity": "info",
                    "message": "提交内容为学生草稿",
                    "detail": "该提交标记为草稿，包含学生原始演算过程",
                    "relation": "草稿与正常输入共存，草稿保留原始思考，正常输入为最终答案",
                    "raw_draft": work.raw_content,
                    "source": "student_draft",
                }
            )
        elif input_type == InputType.MISSING_UNIT:
            anomalies.append(
                {
                    "type": "missing_unit",
                    "severity": "error",
                    "message": "答案缺少单位",
                    "detail": f"题目 {work.problem_id} 要求填写单位，但答案中未提供",
                    "handling": "标记为异常处理，需人工复核是否扣分或退回补填",
                    "reason": f"参数 unit_required={params.unit_required}，学生未填写单位，进入异常处理流程",
                    "source": "unit_check",
                }
            )

        if isinstance(work.answer, (int, float)) and params.unit_required and work.unit:
            if work.answer < params.min_value or work.answer > params.max_value:
                anomalies.append(
                    {
                        "type": "boundary_violation",
                        "severity": "warning",
                        "message": f"数值超出边界 [{params.min_value}, {params.max_value}]",
                        "detail": f"答案 {work.answer} 不在合理范围内",
                        "source": "boundary_check",
                    }
                )

        return anomalies

    def calculate(
        self,
        work: StudentWork,
        params: BoundaryParams,
        problem_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        pid = problem_id or work.problem_id
        standard = self.STANDARD_ANSWERS.get(pid)

        anomalies = self.detect_input_anomalies(work, params)
        input_type = work.detect_input_type(params)

        answer_value = _json_safe_value(work.answer)

        result: Dict[str, Any] = {
            "work_id": work.id,
            "problem_id": pid,
            "timestamp": datetime.now().isoformat(),
            "params_snapshot": params.to_dict(),
            "input_type": input_type.value,
            "anomalies": anomalies,
            "student_answer": {
                "value": answer_value,
                "unit": work.unit,
                "is_draft": work.is_draft,
                "raw_content": work.raw_content,
            },
            "current_status_hint": (
                "异常处理-待人工复核" if any(a["severity"] == "error" for a in anomalies)
                else "待复核" if any(a["severity"] == "warning" for a in anomalies)
                else "正常"
            ),
        }

        if standard:
            safe_standard = {
                "value": _json_safe_value(standard["value"]),
                "unit": standard.get("unit"),
                "formula": standard.get("formula"),
            }
            result["standard"] = safe_standard
            is_correct = self._check_answer(work, standard, params)
            result["is_correct"] = is_correct

            if isinstance(work.answer, (int, float)) and isinstance(
                standard["value"], (int, float)
            ):
                student_val = float(work.answer)
                standard_val = float(standard["value"])
                diff = abs(student_val - standard_val)
                within_tol = diff <= params.tolerance
                result["difference"] = {
                    "absolute": round(diff, 4),
                    "relative": round(diff / abs(standard_val), 4)
                    if standard_val != 0
                    else None,
                    "tolerance": params.tolerance,
                    "within_tolerance": within_tol,
                    "verdict_detail": (
                        f"|{student_val} - {standard_val}| = {round(diff, 4)} "
                        f"{'<=' if within_tol else '>'} tolerance {params.tolerance}"
                    ),
                }

                boundary_check = self._check_boundary(student_val, params)
                result["boundary_check"] = boundary_check

            formula_explain = self._explain_formula(work, standard, params, is_correct)
            result["formula_explanation"] = formula_explain

        safe_result = _json_safe_value(result)

        calc_key = work.id
        if calc_key not in self._calc_history:
            self._calc_history[calc_key] = []
        self._calc_history[calc_key].append(safe_result)

        return safe_result

    def _check_answer(
        self, work: StudentWork, standard: Dict[str, Any], params: BoundaryParams
    ) -> Optional[bool]:
        if work.answer is None:
            return None

        standard_value = standard["value"]
        std_set = _to_set(standard_value)
        work_set = _to_set(work.answer)
        if std_set is not None:
            if work_set is None:
                return None
            return work_set == std_set

        if isinstance(standard_value, (int, float)):
            try:
                val = float(work.answer)
                diff = abs(val - float(standard_value))
                if params.unit_required and standard.get("unit"):
                    if work.unit != standard["unit"]:
                        return False
                return diff <= params.tolerance
            except (TypeError, ValueError):
                return None
        return str(work.answer) == str(standard_value)

    def _check_boundary(
        self, value: float, params: BoundaryParams
    ) -> Dict[str, Any]:
        dist_min = value - params.min_value
        dist_max = params.max_value - value
        is_boundary_sample = (
            abs(dist_min) <= params.tolerance * 10
            or abs(dist_max) <= params.tolerance * 10
        )
        in_range = params.min_value <= value <= params.max_value
        return {
            "value": value,
            "min": params.min_value,
            "max": params.max_value,
            "distance_to_min": round(dist_min, 4),
            "distance_to_max": round(dist_max, 4),
            "is_boundary_sample": is_boundary_sample,
            "in_range": in_range,
            "boundary_reason": (
                "接近边界，属于边界样本" if is_boundary_sample
                else "远离边界，非边界样本"
            ),
        }

    def _explain_formula(
        self,
        work: StudentWork,
        standard: Dict[str, Any],
        params: BoundaryParams,
        is_correct: Optional[bool],
    ) -> Dict[str, Any]:
        std_unit = standard.get("unit")
        unit_match = (work.unit == std_unit) if std_unit else True
        reasons = []
        if is_correct is False:
            if std_unit and not work.unit:
                reasons.append("单位缺失导致判定失败")
            elif std_unit and work.unit != std_unit:
                reasons.append(f"单位不匹配：学生填'{work.unit or '空'}'，标准'{std_unit}'")
            if isinstance(work.answer, (int, float)) and isinstance(
                standard["value"], (int, float)
            ):
                diff = abs(float(work.answer) - float(standard["value"]))
                if diff > params.tolerance:
                    reasons.append(
                        f"数值偏差 {round(diff, 4)} 超过容差 {params.tolerance}"
                    )
        return {
            "formula": standard.get("formula", "N/A"),
            "standard_unit": std_unit,
            "student_unit": work.unit,
            "unit_match": unit_match,
            "tolerance_applied": params.tolerance,
            "strict_mode": params.strict_mode,
            "reasons": reasons,
        }

    def recalculate_with_new_params(
        self,
        record: ReviewRecord,
        new_params: BoundaryParams,
    ) -> Dict[str, Any]:
        old_params = record.current_params
        old_result = record.last_calc_result or {}

        new_result = self.calculate(record.work, new_params)

        changes = self._compare_results(
            old_result, new_result, old_params, new_params
        )

        record.current_params = new_params
        record.last_calc_result = new_result
        record.anomaly_flags = [a["type"] for a in new_result.get("anomalies", [])]
        record.updated_at = datetime.now()

        report = self._generate_recalc_report(
            record.work, old_params, new_params, old_result, new_result, changes
        )

        return _json_safe_value({
            "old_result": old_result,
            "new_result": new_result,
            "changes": changes,
            "report": report,
        })

    def _compare_results(
        self,
        old_result: Dict[str, Any],
        new_result: Dict[str, Any],
        old_params: BoundaryParams,
        new_params: BoundaryParams,
    ) -> Dict[str, Any]:
        changes: Dict[str, Any] = {
            "params": {},
            "outcome": {},
            "boundary": {},
            "anomalies": {},
            "formula_unit": {},
        }

        old_p = old_params.to_dict()
        new_p = new_params.to_dict()
        for key in old_p:
            if old_p[key] != new_p[key]:
                changes["params"][key] = {"old": old_p[key], "new": new_p[key]}

        old_correct = old_result.get("is_correct")
        new_correct = new_result.get("is_correct")
        if old_correct != new_correct:
            old_diff = old_result.get("difference", {})
            new_diff = new_result.get("difference", {})
            reasons = []
            if changes["params"].get("tolerance"):
                reasons.append(
                    f"容差从 {old_params.tolerance} 调整到 {new_params.tolerance}"
                )
            reasons.append(
                f"绝对差值: {old_diff.get('absolute')} -> {new_diff.get('absolute')}"
            )
            reasons.append(
                f"容差内判定: {old_diff.get('within_tolerance')} -> {new_diff.get('within_tolerance')}"
            )
            if old_diff.get("verdict_detail") or new_diff.get("verdict_detail"):
                reasons.append(
                    f"旧判定: {old_diff.get('verdict_detail')}"
                )
                reasons.append(
                    f"新判定: {new_diff.get('verdict_detail')}"
                )
            changes["outcome"]["is_correct"] = {
                "old": old_correct,
                "new": new_correct,
                "reasons": reasons,
            }

        old_boundary = old_result.get("boundary_check", {})
        new_boundary = new_result.get("boundary_check", {})
        if old_boundary.get("is_boundary_sample") != new_boundary.get("is_boundary_sample"):
            changes["boundary"]["is_boundary_sample"] = {
                "old": old_boundary.get("is_boundary_sample"),
                "new": new_boundary.get("is_boundary_sample"),
                "reason": (
                    f"容差从 {old_params.tolerance} 调整为 {new_params.tolerance}，"
                    f"边界样本判定阈值（容差×10）从 {old_params.tolerance * 10} 变为 {new_params.tolerance * 10}"
                ),
            }
        if old_boundary.get("in_range") != new_boundary.get("in_range"):
            changes["boundary"]["in_range"] = {
                "old": old_boundary.get("in_range"),
                "new": new_boundary.get("in_range"),
                "reason": (
                    f"边界从 [{old_params.min_value}, {old_params.max_value}] "
                    f"调整为 [{new_params.min_value}, {new_params.max_value}]"
                ),
            }

        old_fe = old_result.get("formula_explanation", {})
        new_fe = new_result.get("formula_explanation", {})
        if old_fe.get("unit_match") != new_fe.get("unit_match"):
            changes["formula_unit"]["unit_match"] = {
                "old": old_fe.get("unit_match"),
                "new": new_fe.get("unit_match"),
                "reason": (
                    f"unit_required 参数变化或学生单位补填: "
                    f"{old_fe.get('student_unit')} -> {new_fe.get('student_unit')}"
                ),
            }
        if old_fe.get("reasons") != new_fe.get("reasons"):
            changes["formula_unit"]["reasons"] = {
                "old": old_fe.get("reasons"),
                "new": new_fe.get("reasons"),
            }

        old_anom = {a["type"] for a in old_result.get("anomalies", [])}
        new_anom = {a["type"] for a in new_result.get("anomalies", [])}
        if old_anom != new_anom:
            changes["anomalies"] = {
                "added": list(new_anom - old_anom),
                "removed": list(old_anom - new_anom),
            }

        return changes

    def _generate_recalc_report(
        self,
        work: StudentWork,
        old_params: BoundaryParams,
        new_params: BoundaryParams,
        old_result: Dict[str, Any],
        new_result: Dict[str, Any],
        changes: Dict[str, Any],
    ) -> str:
        lines = ["=== 调参复算报告 ===", ""]
        lines.append(f"作业: {work.id} (学生: {work.student_name})")
        lines.append(f"题目: {work.problem_id}")
        lines.append("")

        lines.append("【参数变化】")
        if changes["params"]:
            for key, val in changes["params"].items():
                lines.append(f"  - {key}: {val['old']} → {val['new']}")
        else:
            lines.append("  (无变化)")
        lines.append("")

        lines.append("【公式与单位依据】")
        std = new_result.get("standard", {})
        new_fe = new_result.get("formula_explanation", {})
        lines.append(f"  标准公式: {std.get('formula', 'N/A')}")
        lines.append(f"  标准单位: {std.get('unit', '无')}")
        lines.append(f"  学生答案值: {work.answer}")
        lines.append(f"  学生填写单位: '{work.unit or '(未填写)'}")
        lines.append(f"  单位匹配: {'是' if new_fe.get('unit_match') else '否'}")
        if new_fe.get("reasons"):
            lines.append(f"  判定相关原因:")
            for r in new_fe["reasons"]:
                lines.append(f"    - {r}")
        lines.append("")

        lines.append("【容差与判定结论变化】")
        if changes["outcome"]:
            out = changes["outcome"]["is_correct"]
            lines.append(f"  is_correct: {out['old']} → {out['new']}")
            lines.append(f"  变化原因:")
            for r in out.get("reasons", []):
                lines.append(f"    - {r}")
        else:
            lines.append("  (判定结论未变)")
        old_diff = old_result.get("difference", {})
        new_diff = new_result.get("difference", {})
        if old_diff or new_diff:
            lines.append(f"  绝对差值: {old_diff.get('absolute', 'N/A')} → {new_diff.get('absolute', 'N/A')}")
            lines.append(f"  应用容差: {old_diff.get('tolerance', old_params.tolerance)} → {new_diff.get('tolerance', new_params.tolerance)}")
            lines.append(f"  容差内: {old_diff.get('within_tolerance', 'N/A')} → {new_diff.get('within_tolerance', 'N/A')}")
            if old_diff.get("verdict_detail"):
                lines.append(f"  旧判定式: {old_diff['verdict_detail']}")
            if new_diff.get("verdict_detail"):
                lines.append(f"  新判定式: {new_diff['verdict_detail']}")
        lines.append("")

        lines.append("【边界样本分析】")
        nb = new_result.get("boundary_check", {})
        ob = old_result.get("boundary_check", {})
        if nb:
            lines.append(f"  当前值: {nb.get('value')}")
            lines.append(f"  边界范围: [{nb.get('min')}, {nb.get('max')}]")
            lines.append(f"  距下界: {nb.get('distance_to_min')}, 距上界: {nb.get('distance_to_max')}")
            lines.append(f"  是否边界样本: {'是' if nb.get('is_boundary_sample') else '否'} ({nb.get('boundary_reason', '')})")
            lines.append(f"  是否在范围内: {'是' if nb.get('in_range') else '否'}")
            if changes["boundary"]:
                for key, val in changes["boundary"].items():
                    if "reason" in val:
                        lines.append(f"  边界判定变化原因: {val['reason']}")
                        lines.append(f"    {key}: {val.get('old')} → {val.get('new')}")
            elif ob and ob.get("is_boundary_sample") == nb.get("is_boundary_sample"):
                lines.append("  (边界样本判定未变)")
        lines.append("")

        lines.append("【异常变化】")
        if changes["anomalies"]:
            if changes["anomalies"].get("added"):
                lines.append(f"  新增异常: {changes['anomalies']['added']}")
            if changes["anomalies"].get("removed"):
                lines.append(f"  消除异常: {changes['anomalies']['removed']}")
        else:
            lines.append("  (异常标记未变)")
        lines.append("")

        lines.append("【当前异常详情】")
        cur_anom = new_result.get("anomalies", [])
        if cur_anom:
            for a in cur_anom:
                lines.append(f"  - [{a['severity']}] {a['type']}: {a['message']}")
                if "detail" in a:
                    lines.append(f"    详情: {a['detail']}")
                if "handling" in a:
                    lines.append(f"    处理方式: {a['handling']}")
                if "reason" in a:
                    lines.append(f"    原因: {a['reason']}")
        else:
            lines.append("  (无异常)")
        lines.append("")

        return "\n".join(lines)

    def get_calc_history(self, work_id: str) -> List[Dict[str, Any]]:
        return [_json_safe_value(r) for r in self._calc_history.get(work_id, [])]
