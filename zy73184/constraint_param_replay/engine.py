import re
import copy
from typing import List, Dict, Any, Optional
from datetime import datetime

from .models import (
    FormulaDef,
    HistoryAnswer,
    ProcessRow,
    RowStatus,
    SourceType,
    ReplaySummary,
    ReplayReport,
    JudgmentRecord,
    UnitConversion,
)


class FormulaEngine:
    def __init__(self):
        self.formulas: Dict[str, FormulaDef] = {}
        self.unit_conversions: List[UnitConversion] = []

    def add_formula(self, formula: FormulaDef):
        self.formulas[formula.name] = formula

    def add_unit_conversion(self, conv: UnitConversion):
        self.unit_conversions.append(conv)

    def convert_unit(self, value: float, from_unit: str, to_unit: str) -> Optional[float]:
        if from_unit == to_unit:
            return value

        for conv in self.unit_conversions:
            if conv.from_unit == from_unit and conv.to_unit == to_unit:
                return value * conv.factor
            if conv.from_unit == to_unit and conv.to_unit == from_unit:
                return value / conv.factor

        return None

    def evaluate(self, formula_name: str, params: Dict[str, Any], target_unit: str = None) -> tuple:
        if formula_name not in self.formulas:
            raise ValueError(f"公式不存在: {formula_name}")

        formula = self.formulas[formula_name]

        safe_params = {k: v for k, v in params.items() if k in formula.params}

        missing = [p for p in formula.params if p not in safe_params]
        if missing:
            raise ValueError(f"参数缺失: {', '.join(missing)}")

        try:
            local_vars = {**safe_params}
            result = eval(formula.expression, {"__builtins__": {}}, local_vars)
        except Exception as e:
            raise ValueError(f"公式计算失败: {e}")

        result_unit = formula.unit

        if target_unit and target_unit != result_unit:
            converted = self.convert_unit(result, result_unit, target_unit)
            if converted is None:
                return result, result_unit, f"单位换算失败: {result_unit} -> {target_unit}"
            return converted, target_unit, f"单位已换算: {result_unit} -> {target_unit}"

        return result, result_unit, ""


class SortStabilityChecker:
    def __init__(self, reference_order: List[str] = None):
        self.reference_order = reference_order or []

    def set_reference(self, order: List[str]):
        self.reference_order = order

    def check(self, row_ids: List[str]) -> List[tuple]:
        unstable = []
        if not self.reference_order:
            return unstable

        ref_pos = {rid: i for i, rid in enumerate(self.reference_order)}

        prev_pos = -1
        for rid in row_ids:
            if rid not in ref_pos:
                continue
            curr_pos = ref_pos[rid]
            if curr_pos < prev_pos:
                unstable.append((rid, f"位置回退: 期望在参考顺序第{prev_pos}位之后，但当前第{curr_pos}位"))
            prev_pos = curr_pos

        return unstable


class JudgmentTracker:
    def __init__(self):
        self.changes: List[JudgmentRecord] = []

    def add_change(self, old: str, new: str, reason: str, operator: str = "", timestamp: str = ""):
        record = JudgmentRecord(
            timestamp=timestamp or datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            old_judgment=old,
            new_judgment=new,
            reason=reason,
            operator=operator,
        )
        self.changes.append(record)
        return record

    def add_record(self, record: JudgmentRecord):
        self.changes.append(record)

    def get_all(self) -> List[JudgmentRecord]:
        return self.changes


class ReplayEngine:
    def __init__(self, param_version: str = "v1"):
        self.param_version = param_version
        self.formula_engine = FormulaEngine()
        self.sort_checker = SortStabilityChecker()
        self.judgment_tracker = JudgmentTracker()
        self.history_answers: Dict[str, List[HistoryAnswer]] = {}

    def load_formulas(self, formulas: List[FormulaDef]):
        for f in formulas:
            self.formula_engine.add_formula(f)

    def load_unit_conversions(self, convs: List[UnitConversion]):
        for c in convs:
            self.formula_engine.add_unit_conversion(c)

    def load_history_answers(self, answers: List[HistoryAnswer]):
        for a in answers:
            if a.id not in self.history_answers:
                self.history_answers[a.id] = []
            self.history_answers[a.id].append(a)
        for aid in self.history_answers:
            self.history_answers[aid].sort(
                key=lambda x: (x.version, x.timestamp), reverse=True
            )

    def get_history_answer(self, row_id: str, prefer_old: bool = False) -> Optional[HistoryAnswer]:
        if row_id not in self.history_answers:
            return None
        versions = self.history_answers[row_id]
        if not versions:
            return None
        if prefer_old:
            for v in versions:
                if v.source == SourceType.HISTORY_OLD:
                    return v
            return versions[-1]
        for v in versions:
            if v.source == SourceType.HISTORY_LATEST:
                return v
        return versions[0]

    def set_sort_reference(self, order: List[str]):
        self.sort_checker.set_reference(order)

    def add_judgment_change(self, old: str, new: str, reason: str, operator: str = ""):
        return self.judgment_tracker.add_change(old, new, reason, operator)

    def load_judgment_changes(self, filepath: str):
        import json
        import os
        if not os.path.exists(filepath):
            return
        with open(filepath, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    record = JudgmentRecord(
                        timestamp=data.get("timestamp", ""),
                        old_judgment=data.get("old_judgment", ""),
                        new_judgment=data.get("new_judgment", ""),
                        reason=data.get("reason", ""),
                        operator=data.get("operator", ""),
                    )
                    self.judgment_tracker.add_record(record)
                except json.JSONDecodeError:
                    pass

    def _detect_bad_row(self, row_data: Dict[str, Any]) -> Optional[str]:
        if not row_data:
            return "空行"

        required_fields = ["id"]
        for f in required_fields:
            if f not in row_data or row_data[f] in (None, ""):
                return f"缺少必填字段: {f}"

        return None

    def _has_valid_value(self, row_data: Dict[str, Any]) -> bool:
        if row_data.get("formula_name") and row_data["formula_name"] in self.formula_engine.formulas:
            return True
        if row_data.get("id") and row_data["id"] in self.history_answers:
            return True
        if "value" in row_data and row_data["value"] is not None and row_data["value"] != "":
            return True
        return False

    def _should_skip(self, row_data: Dict[str, Any]) -> Optional[str]:
        if row_data.get("skip"):
            return row_data.get("skip_reason", "标记跳过")

        if row_data.get("status") == "draft":
            return "草稿状态"

        return None

    def _get_sources(self, row_data: Dict[str, Any]) -> List[SourceType]:
        sources = []
        if row_data.get("from_history_old"):
            sources.append(SourceType.HISTORY_OLD)
        if row_data.get("from_history_latest"):
            sources.append(SourceType.HISTORY_LATEST)
        if row_data.get("from_attachment_late"):
            sources.append(SourceType.ATTACHMENT_LATE)
        if row_data.get("from_verbal_note"):
            sources.append(SourceType.VERBAL_NOTE)
        if row_data.get("formula_name"):
            sources.append(SourceType.FORMULA)
        if not sources:
            sources.append(SourceType.HISTORY_LATEST)
        return sources

    def process_rows(self, input_rows: List[Dict[str, Any]], target_unit: str = None) -> ReplayReport:
        rows: List[ProcessRow] = []
        sort_unstable_rows: List[ProcessRow] = []
        bad_rows: List[ProcessRow] = []
        skipped_rows: List[ProcessRow] = []
        unit_mismatch_notes: List[str] = []
        abnormal_points: List[Dict[str, Any]] = []

        summary = ReplaySummary()
        summary.total = len(input_rows)

        row_ids_in_order = []

        for idx, row_data in enumerate(input_rows):
            row_id = row_data.get("id", f"row_{idx}")

            bad_reason = self._detect_bad_row(row_data)
            if bad_reason:
                row = ProcessRow(
                    row_id=row_id,
                    status=RowStatus.BAD,
                    error_msg=bad_reason,
                    sources=self._get_sources(row_data),
                    raw_data=row_data,
                )
                bad_rows.append(row)
                rows.append(row)
                summary.bad += 1
                continue

            skip_reason = self._should_skip(row_data)
            if skip_reason:
                row = ProcessRow(
                    row_id=row_id,
                    status=RowStatus.SKIPPED,
                    skip_reason=skip_reason,
                    sources=self._get_sources(row_data),
                    raw_data=row_data,
                )
                skipped_rows.append(row)
                rows.append(row)
                summary.skipped += 1
                continue

            if not self._has_valid_value(row_data):
                row = ProcessRow(
                    row_id=row_id,
                    status=RowStatus.BAD,
                    error_msg="无法获取有效值：无公式、无历史答案、也无value字段",
                    sources=self._get_sources(row_data),
                    raw_data=row_data,
                )
                bad_rows.append(row)
                rows.append(row)
                summary.bad += 1
                continue

            value = None
            unit = ""
            formula_name = row_data.get("formula_name", "")
            sources = self._get_sources(row_data)
            unit_note = ""

            prefer_old = row_data.get("from_history_old", False)

            if formula_name and formula_name in self.formula_engine.formulas:
                try:
                    params = {k: v for k, v in row_data.items() if not k.startswith("param_")}
                    clean_params = {k.replace("param_", ""): v for k, v in params.items()}
                    value, unit, unit_note = self.formula_engine.evaluate(
                        formula_name, clean_params, target_unit
                    )
                    if unit_note:
                        unit_mismatch_notes.append(f"{row_id}: {unit_note}")
                        if "失败" in unit_note:
                            abnormal_points.append({
                                "row_id": row_id,
                                "type": "单位换算失败",
                                "detail": unit_note,
                            })
                except Exception as e:
                    row = ProcessRow(
                        row_id=row_id,
                        status=RowStatus.BAD,
                        error_msg=f"公式计算失败: {e}",
                        formula_name=formula_name,
                        sources=sources,
                        raw_data=row_data,
                    )
                    bad_rows.append(row)
                    rows.append(row)
                    summary.bad += 1
                    continue
            elif row_id in self.history_answers:
                hist = self.get_history_answer(row_id, prefer_old=prefer_old)
                if hist:
                    value = hist.content
                    unit = hist.unit
                    if target_unit and target_unit != unit:
                        converted = self.formula_engine.convert_unit(value, unit, target_unit)
                        if converted is not None:
                            value = converted
                            unit = target_unit
                            unit_mismatch_notes.append(f"{row_id}: 历史答案单位已换算: {hist.unit} -> {target_unit} (版本: {hist.version})")
                        else:
                            unit_mismatch_notes.append(f"{row_id}: 历史答案单位换算失败: {unit} -> {target_unit}")
                            abnormal_points.append({
                                "row_id": row_id,
                                "type": "历史答案单位问题",
                                "detail": f"公式正确但单位不匹配，结果可能偏离。历史版本: {hist.version}, 单位: {hist.unit}",
                            })
                    elif hist.unit != row_data.get("unit", "") and row_data.get("unit"):
                        unit_mismatch_notes.append(
                            f"{row_id}: 历史答案单位与输入不一致: {hist.unit} vs {row_data.get('unit')} "
                            f"(版本: {hist.version}, 公式正确但单位不同结果可能偏离)"
                        )
                        abnormal_points.append({
                            "row_id": row_id,
                            "type": "单位不匹配",
                            "detail": f"历史答案单位: {hist.unit}, 输入期望单位: {row_data.get('unit')}, "
                                      f"公式正确但单位一换结果就偏。历史版本: {hist.version}",
                        })
            else:
                value = row_data.get("value")
                unit = row_data.get("unit", "")
                if target_unit and unit and target_unit != unit and value is not None:
                    try:
                        value_num = float(value) if not isinstance(value, (int, float)) else value
                        converted = self.formula_engine.convert_unit(value_num, unit, target_unit)
                        if converted is not None:
                            value = converted
                            unit = target_unit
                            unit_mismatch_notes.append(f"{row_id}: 单位已换算: {row_data.get('unit')} -> {target_unit}")
                        else:
                            unit_mismatch_notes.append(f"{row_id}: 单位换算失败: {unit} -> {target_unit}")
                            abnormal_points.append({
                                "row_id": row_id,
                                "type": "单位换算失败",
                                "detail": f"无法从 {unit} 换算到 {target_unit}",
                            })
                    except (ValueError, TypeError):
                        pass

            row = ProcessRow(
                row_id=row_id,
                status=RowStatus.PROCESSED,
                value=value,
                unit=unit,
                formula_name=formula_name,
                sources=sources,
                sort_order=idx,
                raw_data=row_data,
            )

            rows.append(row)
            summary.processed += 1
            row_ids_in_order.append(row_id)

            for src in sources:
                key = src.label
                summary.by_source[key] = summary.by_source.get(key, 0) + 1

            if formula_name:
                summary.by_formula[formula_name] = summary.by_formula.get(formula_name, 0) + 1

        unstable = self.sort_checker.check(row_ids_in_order)
        for rid, reason in unstable:
            for row in rows:
                if row.row_id == rid and row.status == RowStatus.PROCESSED:
                    row.status = RowStatus.SORT_UNSTABLE
                    row.sort_unstable_reason = reason
                    sort_unstable_rows.append(row)
                    summary.sort_unstable += 1
                    summary.processed -= 1

        report = ReplayReport(
            param_version=self.param_version,
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            summary=summary,
            rows=rows,
            sort_unstable_rows=sort_unstable_rows,
            bad_rows=bad_rows,
            skipped_rows=skipped_rows,
            unit_mismatch_notes=unit_mismatch_notes,
            judgment_changes=self.judgment_tracker.get_all(),
            abnormal_points=abnormal_points,
        )

        return report
