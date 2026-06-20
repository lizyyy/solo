from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime

from models import (
    BoundaryParams,
    StudentWork,
    InputType,
    ReviewRecord,
)


class CalculationEngine:
    STANDARD_ANSWERS = {
        "prob_area_rectangle": {"value": 24.0, "unit": "cm²", "formula": "S = a × b"},
        "prob_velocity": {"value": 15.0, "unit": "m/s", "formula": "v = s / t"},
        "prob_set_operation": {"value": {1, 2, 3}, "unit": None, "formula": "A ∪ B"},
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

        result = {
            "work_id": work.id,
            "problem_id": pid,
            "timestamp": datetime.now().isoformat(),
            "params_snapshot": params.to_dict(),
            "input_type": input_type.value,
            "anomalies": anomalies,
            "student_answer": {
                "value": work.answer,
                "unit": work.unit,
                "is_draft": work.is_draft,
            },
        }

        if standard:
            result["standard"] = standard
            is_correct = self._check_answer(work, standard, params)
            result["is_correct"] = is_correct

            if isinstance(work.answer, (int, float)) and isinstance(
                standard["value"], (int, float)
            ):
                diff = abs(float(work.answer) - float(standard["value"]))
                result["difference"] = {
                    "absolute": round(diff, 4),
                    "relative": round(diff / abs(standard["value"]), 4)
                    if standard["value"] != 0
                    else None,
                    "within_tolerance": diff <= params.tolerance,
                }

                boundary_check = self._check_boundary(
                    float(work.answer), params
                )
                result["boundary_check"] = boundary_check

            formula_explain = self._explain_formula(work, standard, params)
            result["formula_explanation"] = formula_explain

        calc_key = work.id
        if calc_key not in self._calc_history:
            self._calc_history[calc_key] = []
        self._calc_history[calc_key].append(result)

        return result

    def _check_answer(
        self, work: StudentWork, standard: Dict[str, Any], params: BoundaryParams
    ) -> Optional[bool]:
        if work.answer is None:
            return None
        if isinstance(standard["value"], set):
            try:
                return set(work.answer) == standard["value"]
            except (TypeError, ValueError):
                return None
        if isinstance(standard["value"], (int, float)):
            try:
                val = float(work.answer)
                diff = abs(val - float(standard["value"]))
                if params.unit_required and standard.get("unit"):
                    if work.unit != standard["unit"]:
                        return False
                return diff <= params.tolerance
            except (TypeError, ValueError):
                return None
        return str(work.answer) == str(standard["value"])

    def _check_boundary(
        self, value: float, params: BoundaryParams
    ) -> Dict[str, Any]:
        dist_min = value - params.min_value
        dist_max = params.max_value - value
        is_boundary_sample = (
            abs(dist_min) <= params.tolerance * 10
            or abs(dist_max) <= params.tolerance * 10
        )
        return {
            "value": value,
            "min": params.min_value,
            "max": params.max_value,
            "distance_to_min": round(dist_min, 4),
            "distance_to_max": round(dist_max, 4),
            "is_boundary_sample": is_boundary_sample,
            "in_range": params.min_value <= value <= params.max_value,
        }

    def _explain_formula(
        self, work: StudentWork, standard: Dict[str, Any], params: BoundaryParams
    ) -> Dict[str, Any]:
        return {
            "formula": standard.get("formula", "N/A"),
            "standard_unit": standard.get("unit"),
            "student_unit": work.unit,
            "unit_match": work.unit == standard.get("unit") if standard.get("unit") else True,
            "tolerance_applied": params.tolerance,
            "strict_mode": params.strict_mode,
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

        return {
            "old_result": old_result,
            "new_result": new_result,
            "changes": changes,
            "report": self._generate_recalc_report(
                record.work, old_params, new_params, old_result, new_result, changes
            ),
        }

    def _compare_results(
        self,
        old_result: Dict[str, Any],
        new_result: Dict[str, Any],
        old_params: BoundaryParams,
        new_params: BoundaryParams,
    ) -> Dict[str, Any]:
        changes = {
            "params": {},
            "outcome": {},
            "boundary": {},
            "anomalies": {},
        }

        old_p = old_params.to_dict()
        new_p = new_params.to_dict()
        for key in old_p:
            if old_p[key] != new_p[key]:
                changes["params"][key] = {"old": old_p[key], "new": new_p[key]}

        old_correct = old_result.get("is_correct")
        new_correct = new_result.get("is_correct")
        if old_correct != new_correct:
            changes["outcome"]["is_correct"] = {
                "old": old_correct,
                "new": new_correct,
            }

        old_boundary = old_result.get("boundary_check", {})
        new_boundary = new_result.get("boundary_check", {})
        if old_boundary.get("is_boundary_sample") != new_boundary.get("is_boundary_sample"):
            changes["boundary"]["is_boundary_sample"] = {
                "old": old_boundary.get("is_boundary_sample"),
                "new": new_boundary.get("is_boundary_sample"),
                "reason": f"容差从 {old_params.tolerance} 调整为 {new_params.tolerance}，边界样本判定阈值随之变化",
            }
        if old_boundary.get("in_range") != new_boundary.get("in_range"):
            changes["boundary"]["in_range"] = {
                "old": old_boundary.get("in_range"),
                "new": new_boundary.get("in_range"),
                "reason": f"边界从 [{old_params.min_value}, {old_params.max_value}] 调整为 [{new_params.min_value}, {new_params.max_value}]",
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

        lines.append("【公式与单位】")
        std = new_result.get("standard", {})
        lines.append(f"  标准公式: {std.get('formula', 'N/A')}")
        lines.append(f"  标准单位: {std.get('unit', '无')}")
        lines.append(f"  学生答案: {work.answer} {work.unit or '(无单位)'}")
        lines.append(f"  单位匹配: {'是' if new_result.get('formula_explanation', {}).get('unit_match') else '否'}")
        lines.append("")

        lines.append("【结果变化】")
        if changes["outcome"]:
            for key, val in changes["outcome"].items():
                lines.append(f"  - {key}: {val['old']} → {val['new']}")
        else:
            lines.append("  (判定结果未变)")

        old_diff = old_result.get("difference", {})
        new_diff = new_result.get("difference", {})
        if old_diff or new_diff:
            lines.append(f"  差值(绝对): {old_diff.get('absolute', 'N/A')} → {new_diff.get('absolute', 'N/A')}")
            lines.append(f"  容差内: {old_diff.get('within_tolerance', 'N/A')} → {new_diff.get('within_tolerance', 'N/A')}")
        lines.append("")

        lines.append("【边界样本分析】")
        nb = new_result.get("boundary_check", {})
        if nb:
            lines.append(f"  当前值: {nb.get('value')}")
            lines.append(f"  边界范围: [{nb.get('min')}, {nb.get('max')}]")
            lines.append(f"  距下界: {nb.get('distance_to_min')}, 距上界: {nb.get('distance_to_max')}")
            lines.append(f"  是否边界样本: {'是' if nb.get('is_boundary_sample') else '否'}")
            if changes["boundary"]:
                for key, val in changes["boundary"].items():
                    if "reason" in val:
                        lines.append(f"  变化原因: {val['reason']}")
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
        for a in new_result.get("anomalies", []):
            lines.append(f"  - [{a['severity']}] {a['type']}: {a['message']}")
            if "detail" in a:
                lines.append(f"    {a['detail']}")
            if "handling" in a:
                lines.append(f"    处理方式: {a['handling']}")
        lines.append("")

        return "\n".join(lines)

    def get_calc_history(self, work_id: str) -> List[Dict[str, Any]]:
        return self._calc_history.get(work_id, [])
