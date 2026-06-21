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
    SourceDetail,
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
        self.attachments: Dict[str, List[Dict[str, Any]]] = {}
        self.attachment_files: List[str] = []
        self.notes: List[Dict[str, str]] = []
        self.notes_files: List[str] = []

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

    def load_attachments(self, attachments_data: Dict[str, Any], file_names: List[str] = None):
        for name, data in attachments_data.items():
            if isinstance(data, list):
                for item in data:
                    if "id" in item:
                        rid = item["id"]
                        if rid not in self.attachments:
                            self.attachments[rid] = []
                        item_copy = dict(item)
                        item_copy["_source_file"] = name
                        self.attachments[rid].append(item_copy)
        if file_names:
            self.attachment_files.extend(file_names)

    def load_notes(self, notes: List[str], file_names: List[str] = None):
        for i, note in enumerate(notes):
            fname = file_names[i] if file_names and i < len(file_names) else ""
            self.notes.append({"content": note, "file": fname})
        if file_names:
            self.notes_files.extend(file_names)

    def get_attachment_for_row(self, row_id: str) -> Optional[Dict[str, Any]]:
        if row_id not in self.attachments:
            return None
        return self.attachments[row_id][0] if self.attachments[row_id] else None

    def find_related_notes(self, row_id: str, row_data: Dict[str, Any]) -> List[Dict[str, str]]:
        related = []
        for note in self.notes:
            content = note["content"]
            if row_id in content:
                related.append(note)
            elif row_data.get("description") and row_data["description"] in content:
                related.append(note)
        return related

    def _make_source_detail(self, source_type: SourceType, file_name: str = "",
                            content_summary: str = "", affects_value: bool = False,
                            affects_judgment: bool = False, impact_description: str = "",
                            version: str = "") -> SourceDetail:
        return SourceDetail(
            source_type=source_type,
            file_name=file_name,
            content_summary=content_summary[:80] if len(content_summary) > 80 else content_summary,
            affects_value=affects_value,
            affects_judgment=affects_judgment,
            impact_description=impact_description,
            version=version,
        )

    def _calc_value_diff(self, base_val, final_val, base_unit, final_unit) -> str:
        if base_val is None or final_val is None:
            return ""
        try:
            b = float(base_val)
            f = float(final_val)

            if base_unit and final_unit and base_unit != final_unit:
                converted_base = self.formula_engine.convert_unit(b, base_unit, final_unit)
                if converted_base is not None:
                    b = converted_base
                    base_unit = final_unit

            if b == 0 and f == 0:
                return "无变化"
            if b == 0:
                return f"从 0 变为 {f} {final_unit}"
            diff = f - b
            if abs(diff) < 1e-9:
                return "无变化"
            pct = (diff / abs(b)) * 100 if b != 0 else 0
            direction = "增加" if diff > 0 else "减少"
            unit_str = final_unit
            return f"{direction} {abs(diff):.2f} {unit_str} ({pct:+.1f}%)"
        except (ValueError, TypeError):
            if base_val != final_val:
                return f"从 {base_val} 变为 {final_val}"
            return "无变化"

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

    def _calc_base_value(self, row_id: str, row_data: Dict[str, Any],
                         target_unit: str = None) -> tuple:
        value = None
        unit = ""
        formula_name = ""
        formula_version = ""
        unit_note = ""
        abnormal = None
        base_source = ""

        input_formula = row_data.get("formula_name", "")
        if input_formula and input_formula in self.formula_engine.formulas:
            try:
                params = {k: v for k, v in row_data.items() if not k.startswith("param_")}
                clean_params = {k.replace("param_", ""): v for k, v in params.items()}
                value, unit, unit_note = self.formula_engine.evaluate(
                    input_formula, clean_params, target_unit
                )
                formula_name = input_formula
                formula_version = self.formula_engine.formulas[input_formula].version
                base_source = "formula"
            except Exception as e:
                return None, "", "", "", "", "", {"type": "公式计算失败", "detail": str(e)}
        elif row_id in self.history_answers:
            hist = self.get_history_answer(row_id, prefer_old=False)
            if hist and hist.source == SourceType.HISTORY_LATEST:
                value = hist.content
                unit = hist.unit
                formula_name = hist.formula_name or ""
                formula_version = hist.version
                base_source = "history_latest"
                if target_unit and target_unit != unit:
                    converted = self.formula_engine.convert_unit(value, unit, target_unit)
                    if converted is not None:
                        value = converted
                        unit = target_unit
                        unit_note = f"历史答案单位已换算: {hist.unit} -> {target_unit} (版本: {hist.version})"
                    else:
                        unit_note = f"历史答案单位换算失败: {unit} -> {target_unit}"
                        abnormal = {
                            "type": "历史答案单位问题",
                            "detail": f"公式正确但单位不匹配，结果可能偏离。历史版本: {hist.version}, 单位: {hist.unit}",
                        }
        if value is None and "value" in row_data and row_data["value"] is not None and row_data["value"] != "":
            value = row_data.get("value")
            unit = row_data.get("unit", "")
            base_source = "input_value"
            if target_unit and unit and target_unit != unit:
                try:
                    value_num = float(value) if not isinstance(value, (int, float)) else value
                    converted = self.formula_engine.convert_unit(value_num, unit, target_unit)
                    if converted is not None:
                        value = converted
                        unit = target_unit
                        unit_note = f"单位已换算: {row_data.get('unit')} -> {target_unit}"
                    else:
                        unit_note = f"单位换算失败: {unit} -> {target_unit}"
                        abnormal = {"type": "单位换算失败", "detail": f"无法从 {unit} 换算到 {target_unit}"}
                except (ValueError, TypeError):
                    pass

        return value, unit, formula_name, formula_version, unit_note, abnormal, base_source

    def _apply_attachment_impact(self, row_id: str, row_data: Dict[str, Any],
                                  current_value, current_unit: str,
                                  target_unit: str = None) -> tuple:
        attachment = self.get_attachment_for_row(row_id)
        if not attachment:
            return current_value, current_unit, [], False, ""

        source_details = []
        affects_value = False
        unit_basis = ""

        att_value = attachment.get("value")
        att_unit = attachment.get("unit", "")
        att_file = attachment.get("_source_file", "")

        if att_value is not None and att_value != "":
            try:
                new_val = float(att_value) if not isinstance(att_value, (int, float)) else att_value
            except (ValueError, TypeError):
                new_val = att_value

            if target_unit and att_unit and target_unit != att_unit:
                converted = self.formula_engine.convert_unit(new_val, att_unit, target_unit)
                if converted is not None:
                    new_val = converted
                    att_unit = target_unit
                    unit_basis = f"附件单位已换算: {attachment.get('unit')} -> {target_unit}"
                else:
                    unit_basis = f"附件单位换算失败: {att_unit} -> {target_unit}"

            affects_value = False
            try:
                cv = float(current_value) if current_value is not None else None
                nv = float(new_val)
                if current_unit and att_unit and current_unit != att_unit:
                    converted_cv = self.formula_engine.convert_unit(cv, current_unit, att_unit)
                    if converted_cv is not None:
                        cv = converted_cv
                if cv is not None and abs(nv - cv) > 1e-9:
                    affects_value = True
            except (ValueError, TypeError):
                if new_val != current_value:
                    affects_value = True

            impact_desc = f"数值从 {current_value} {current_unit} 变为 {new_val} {att_unit}"
            source_details.append(self._make_source_detail(
                source_type=SourceType.ATTACHMENT_LATE,
                file_name=att_file,
                content_summary=f"{row_id}: {att_value} {attachment.get('unit', '')} - {attachment.get('description', '')}",
                affects_value=affects_value,
                affects_judgment=False,
                impact_description=impact_desc,
                version=attachment.get("version", ""),
            ))
            return new_val, att_unit, source_details, True, unit_basis

        source_details.append(self._make_source_detail(
            source_type=SourceType.ATTACHMENT_LATE,
            file_name=att_file,
            content_summary=f"{row_id}: {attachment.get('description', '无描述')}",
            affects_value=False,
            affects_judgment=False,
            impact_description="附件存在但未改变数值（仅作补充）",
            version=attachment.get("version", ""),
        ))
        return current_value, current_unit, source_details, True, unit_basis

    def _apply_note_impact(self, row_id: str, row_data: Dict[str, Any],
                            current_value, current_unit: str) -> tuple:
        related_notes = self.find_related_notes(row_id, row_data)
        if not related_notes:
            return current_value, current_unit, [], False

        source_details = []
        affects_judgment = False

        for note in related_notes:
            note_content = note["content"]
            note_file = note["file"]

            note_affects_value = False
            note_affects_judgment = False
            impact_desc = "备注仅作补充说明，未改变计算结果"

            if "调整" in note_content or "修改" in note_content or "更正" in note_content:
                note_affects_judgment = True
                impact_desc = "口头备注包含调整说明，可能影响判断结论"
                affects_judgment = True

            source_details.append(self._make_source_detail(
                source_type=SourceType.VERBAL_NOTE,
                file_name=note_file,
                content_summary=note_content,
                affects_value=note_affects_value,
                affects_judgment=note_affects_judgment,
                impact_description=impact_desc,
            ))

        return current_value, current_unit, source_details, affects_judgment

    def _apply_old_history_impact(self, row_id: str, row_data: Dict[str, Any],
                                   current_value, current_unit: str,
                                   target_unit: str = None) -> tuple:
        if not row_data.get("from_history_old", False):
            return current_value, current_unit, [], False, ""

        old_hist = self.get_history_answer(row_id, prefer_old=True)
        if not old_hist or old_hist.source != SourceType.HISTORY_OLD:
            return current_value, current_unit, [], False, ""

        source_details = []
        affects_value = False
        unit_basis = ""

        old_val = old_hist.content
        old_unit = old_hist.unit

        if target_unit and old_unit and target_unit != old_unit:
            converted = self.formula_engine.convert_unit(old_val, old_unit, target_unit)
            if converted is not None:
                old_val = converted
                old_unit = target_unit
                unit_basis = f"旧版答案单位已换算: {old_hist.unit} -> {target_unit}"
            else:
                unit_basis = f"旧版答案单位换算失败: {old_unit} -> {target_unit}"

        affects_value = False
        try:
            cv = float(current_value) if current_value is not None else None
            ov = float(old_val)
            if current_unit and old_unit and current_unit != old_unit:
                converted_cv = self.formula_engine.convert_unit(cv, current_unit, old_unit)
                if converted_cv is not None:
                    cv = converted_cv
            if cv is not None and abs(ov - cv) > 1e-9:
                affects_value = True
        except (ValueError, TypeError):
            if old_val != current_value:
                affects_value = True

        impact_desc = f"使用旧版答案: 值从 {current_value} {current_unit} 变为 {old_val} {old_unit}"
        source_details.append(self._make_source_detail(
            source_type=SourceType.HISTORY_OLD,
            file_name="",
            content_summary=f"旧版答案: {old_hist.content} {old_hist.unit} (版本: {old_hist.version})",
            affects_value=affects_value,
            affects_judgment=False,
            impact_description=impact_desc,
            version=old_hist.version,
        ))

        return old_val, old_unit, source_details, affects_value, unit_basis

    def _build_explanation(self, row: ProcessRow, unit_note: str) -> str:
        parts = []

        if row.base_source == "formula":
            parts.append(f"计算公式: {row.base_formula_name}")
        elif row.base_source == "history_latest":
            parts.append("基准值来自历史答案(最新)")
        elif row.base_source == "input_value":
            parts.append("基准值来自输入数据")
        elif row.base_value is not None:
            parts.append(f"基准值: {row.base_value} {row.base_unit}")

        if row.affected_by_old_history:
            if row.base_source == "history_latest":
                parts.append("使用了历史旧版答案替代最新版")
            else:
                parts.append("使用历史旧版答案作为数据源")

        if row.affected_by_attachment:
            parts.append("晚到附件影响了结果")

        if row.affected_by_note:
            parts.append("存在相关口头备注")

        if row.unit_conversion_basis:
            parts.append(f"单位换算: {row.unit_conversion_basis}")
        elif unit_note:
            parts.append(unit_note)

        if row.value_diff and "无变化" not in row.value_diff:
            parts.append(f"数值变化: {row.value_diff}")

        return "；".join(parts) if parts else "无特殊说明"

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
            sources = self._get_sources(row_data)

            bad_reason = self._detect_bad_row(row_data)
            if bad_reason:
                row = ProcessRow(
                    row_id=row_id,
                    status=RowStatus.BAD,
                    error_msg=bad_reason,
                    sources=sources,
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
                    sources=sources,
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
                    sources=sources,
                    raw_data=row_data,
                )
                bad_rows.append(row)
                rows.append(row)
                summary.bad += 1
                continue

            base_value, base_unit, base_formula, formula_ver, unit_note, abnormal, base_source = self._calc_base_value(
                row_id, row_data, target_unit
            )

            if abnormal:
                abnormal["row_id"] = row_id
                abnormal_points.append(abnormal)

            if unit_note:
                unit_mismatch_notes.append(f"{row_id}: {unit_note}")

            current_value = base_value
            current_unit = base_unit
            all_source_details = []
            affected_by_attachment = False
            affected_by_note = False
            affected_by_old_history = False
            unit_conversion_basis = ""

            if row_data.get("from_history_old", False):
                old_val, old_unit, old_details, affects_val, old_unit_basis = self._apply_old_history_impact(
                    row_id, row_data, current_value, current_unit, target_unit
                )
                if old_details:
                    affected_by_old_history = True
                    current_value = old_val
                    current_unit = old_unit
                if old_unit_basis:
                    unit_conversion_basis = old_unit_basis
                all_source_details.extend(old_details)

            if row_data.get("from_attachment_late", False):
                att_val, att_unit, att_details, has_att, att_unit_basis = self._apply_attachment_impact(
                    row_id, row_data, current_value, current_unit, target_unit
                )
                if has_att:
                    affected_by_attachment = True
                    current_value = att_val
                    current_unit = att_unit
                    if att_unit_basis:
                        unit_conversion_basis = att_unit_basis if not unit_conversion_basis else unit_conversion_basis + "; " + att_unit_basis
                all_source_details.extend(att_details)

            if row_data.get("from_verbal_note", False):
                note_val, note_unit, note_details, note_affects_judg = self._apply_note_impact(
                    row_id, row_data, current_value, current_unit
                )
                if note_details:
                    affected_by_note = True
                all_source_details.extend(note_details)

            if base_formula and base_formula in self.formula_engine.formulas:
                formula_obj = self.formula_engine.formulas[base_formula]
                all_source_details.insert(0, self._make_source_detail(
                    source_type=SourceType.FORMULA,
                    file_name="",
                    content_summary=f"{base_formula}: {formula_obj.expression} ({formula_obj.unit})",
                    affects_value=True,
                    affects_judgment=False,
                    impact_description=f"使用公式 {base_formula} 计算基准值",
                    version=formula_obj.version,
                ))

            if (not row_data.get("from_history_old", False) and
                not row_data.get("from_attachment_late", False) and
                row_id in self.history_answers):
                hist = self.get_history_answer(row_id, prefer_old=False)
                if hist:
                    all_source_details.insert(0, self._make_source_detail(
                        source_type=SourceType.HISTORY_LATEST,
                        file_name="",
                        content_summary=f"历史最新答案: {hist.content} {hist.unit}",
                        affects_value=True,
                        affects_judgment=False,
                        impact_description="基准值来自最新历史答案",
                        version=hist.version,
                    ))

            value_diff = self._calc_value_diff(base_value, current_value, base_unit, current_unit)

            row = ProcessRow(
                row_id=row_id,
                status=RowStatus.PROCESSED,
                value=current_value,
                unit=current_unit,
                formula_name=base_formula,
                formula_version=formula_ver,
                sources=sources,
                source_details=all_source_details,
                sort_order=idx,
                raw_data=row_data,
                base_value=base_value,
                base_unit=base_unit,
                base_formula_name=base_formula,
                base_source=base_source,
                affected_by_attachment=affected_by_attachment,
                affected_by_note=affected_by_note,
                affected_by_old_history=affected_by_old_history,
                value_diff=value_diff,
                unit_conversion_basis=unit_conversion_basis,
            )

            row.explanation = self._build_explanation(row, unit_note)

            rows.append(row)
            summary.processed += 1
            row_ids_in_order.append(row_id)

            if affected_by_attachment:
                summary.affected_by_attachment += 1
            if affected_by_note:
                summary.affected_by_note += 1
            if affected_by_old_history:
                summary.affected_by_old_history += 1
            if unit_conversion_basis or unit_note:
                summary.has_unit_conversion += 1

            for src in sources:
                key = src.label
                summary.by_source[key] = summary.by_source.get(key, 0) + 1

            if base_formula:
                summary.by_formula[base_formula] = summary.by_formula.get(base_formula, 0) + 1

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
