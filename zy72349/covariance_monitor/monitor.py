from typing import List, Dict, Optional, Tuple, Callable, Any
from datetime import datetime
import json
import re
import copy

from .types import (
    DriftRecord,
    RecordStatus,
    FormulaSource,
    Formula,
    ValueEntry,
    ConflictEvidence,
    ReviewResult,
    ReviewField,
    CalculationDetail,
    CalculationSnapshot,
    MonitorSession,
    ValueChange,
)
from .exceptions import (
    ConflictDetectedError,
    MixedFormatError,
    PendingReviewError,
    FormulaNotFoundError,
)


class CovarianceMonitor:
    """协方差漂移监测核心类 - 同一条记录贯通输入/补录/复核/复算/报告"""

    def __init__(self, operator: str = "system"):
        self.session = MonitorSession(operator=operator)
        self._current_record_var = None

    @staticmethod
    def _format_arg(arg: Any) -> str:
        if isinstance(arg, RecordStatus):
            return f"RecordStatus.{arg.name}"
        if isinstance(arg, FormulaSource):
            return f"FormulaSource.{arg.name}"
        if isinstance(arg, ReviewField):
            return f"ReviewField.{arg.name}"
        return repr(arg)

    def _register_replay(self, method: str, *args, may_throw: bool = False, **kwargs) -> None:
        args_list = list(args)

        if method == "import_screenshot_formula":
            self._current_record_var = "record"

        returns_tuple = method in ["import_teacher_comment", "check_format"]

        if (
            self._current_record_var
            and len(args_list) > 0
            and method != "import_screenshot_formula"
        ):
            args_list[0] = f"{self._current_record_var}.record_id"

        formatted_args = []
        for a in args_list:
            if isinstance(a, str) and a.endswith(".record_id"):
                formatted_args.append(a)
            else:
                formatted_args.append(self._format_arg(a))

        args_str = ", ".join(formatted_args)
        kwargs_str = ", ".join([f"{k}={self._format_arg(v)}" for k, v in kwargs.items()])
        if args_str and kwargs_str:
            params = f"{args_str}, {kwargs_str}"
        else:
            params = args_str or kwargs_str

        if method == "import_screenshot_formula":
            line = f"record = monitor.{method}({params})"
        elif returns_tuple:
            line = f"record, _ = monitor.{method}({params})"
        elif self._current_record_var and method != "finalize":
            line = f"record = monitor.{method}({params})"
        else:
            line = f"monitor.{method}({params})"

        if may_throw:
            exception_class = (
                "ConflictDetectedError" if method == "import_teacher_comment" else "MixedFormatError"
            )
            wrapped = [
                f"try:",
                f"    {line}",
                f"except {exception_class} as e:",
                f"    print(f'捕获预期异常: {{e.message}}')",
            ]
            self.session.replay_commands.extend(wrapped)
        else:
            self.session.replay_commands.append(line)

    @staticmethod
    def _parse_value(raw: str) -> ValueEntry:
        raw = raw.strip()
        entry = ValueEntry(raw_value=raw)

        if raw.endswith("%"):
            entry.is_percentage = True
            num_str = raw[:-1]
            try:
                val = float(num_str)
                entry.numeric_value = val / 100.0
                entry.format_note = f"百分数格式: {raw} = {entry.numeric_value}"
            except ValueError:
                entry.numeric_value = None
                entry.format_note = f"无法解析百分数: {raw}"
        else:
            try:
                val = float(raw)
                entry.numeric_value = val
                entry.is_decimal = True
                entry.format_note = f"小数格式: {raw}"
            except ValueError:
                entry.numeric_value = None
                entry.format_note = f"无法解析数值: {raw}"

        return entry

    def _detect_mixed_format(self, record: DriftRecord) -> List[str]:
        issues = []
        has_percentage = False
        has_decimal = False

        for key, entry in record.original_values.items():
            if entry.is_percentage:
                has_percentage = True
            if entry.is_decimal:
                has_decimal = True

        if has_percentage and has_decimal:
            issues.append(
                "同时存在百分数格式和小数格式，请活动负责人复核确认是否统一口径"
            )
            for key, entry in record.original_values.items():
                issues.append(f"  - {key}: {entry.format_note}")

        return issues

    def _detect_formula_conflicts(self, record: DriftRecord) -> List[ConflictEvidence]:
        conflicts = []
        screenshot_formulas = [f for f in record.formulas if f.source == FormulaSource.SCREENSHOT]
        comment_formulas = [f for f in record.formulas if f.source == FormulaSource.TEACHER_COMMENT]

        if screenshot_formulas and comment_formulas:
            for s_f in screenshot_formulas:
                for c_f in comment_formulas:
                    if s_f.expression != c_f.expression:
                        conflicts.append(
                            ConflictEvidence(
                                record_id=record.record_id,
                                field_name="协方差计算公式",
                                screenshot_value=s_f.expression,
                                comment_value=c_f.expression,
                                detail=(
                                    f"旧公式截图使用 '{s_f.expression}'（{s_f.description}），"
                                    f"老师批注使用 '{c_f.expression}'（{c_f.description}），"
                                    f"两者不一致，需教研负责人吴老师确认"
                                ),
                            )
                        )
        return conflicts

    def _run_calculation_steps(
        self,
        values: Dict[str, float],
        formula: Formula,
    ) -> Tuple[List[CalculationDetail], float]:
        """执行计算步骤，返回（明细列表，最终协方差）- 不修改 record"""
        x_keys = sorted([k for k in values.keys() if k.startswith("x")])
        y_keys = sorted([k for k in values.keys() if k.startswith("y")])
        x_values = [values[k] for k in x_keys]
        y_values = [values[k] for k in y_keys]

        if not x_values or not y_values:
            keys = sorted(values.keys())
            half = len(keys) // 2
            x_values = [values[k] for k in keys[:half]]
            y_values = [values[k] for k in keys[half:]]

        n = min(len(x_values), len(y_values))
        if n < 2:
            raise ValueError("至少需要2对数据点才能计算协方差")

        details: List[CalculationDetail] = []
        step = 0

        step += 1
        x_mean = sum(x_values[:n]) / n
        details.append(
            CalculationDetail(
                step=step,
                description=f"计算X均值 (E[X])",
                input_values={"x_values": x_values[:n]},
                formula_used="Σx / n",
                intermediate_result=x_mean,
                source=formula.source,
            )
        )

        step += 1
        y_mean = sum(y_values[:n]) / n
        details.append(
            CalculationDetail(
                step=step,
                description=f"计算Y均值 (E[Y])",
                input_values={"y_values": y_values[:n]},
                formula_used="Σy / n",
                intermediate_result=y_mean,
                source=formula.source,
            )
        )

        step += 1
        products = [(x_values[i] - x_mean) * (y_values[i] - y_mean) for i in range(n)]
        input_map: Dict[str, Any] = {}
        for i in range(n):
            if i < len(x_keys):
                input_map[x_keys[i]] = x_values[i]
            if i < len(y_keys):
                input_map[y_keys[i]] = y_values[i]
        details.append(
            CalculationDetail(
                step=step,
                description="计算偏差乘积 (x-E[X])(y-E[Y])",
                input_values=input_map,
                formula_used="(x-E[X])(y-E[Y])",
                intermediate_result=sum(products),
                source=formula.source,
            )
        )

        step += 1
        if "(n-1)" in formula.expression:
            denominator = n - 1
        else:
            denominator = n
        covariance = sum(products) / denominator
        details.append(
            CalculationDetail(
                step=step,
                description=f"协方差 = 偏差乘积之和 / {denominator}",
                input_values={"products": products, "n": n, "denominator": denominator},
                formula_used=formula.expression,
                intermediate_result=covariance,
                source=formula.source,
            )
        )

        return details, covariance

    def _select_formula(
        self, record: DriftRecord, preference: Optional[FormulaSource]
    ) -> Formula:
        if not record.formulas:
            raise FormulaNotFoundError("记录没有关联任何公式")

        if preference:
            matching = [f for f in record.formulas if f.source == preference]
            if matching:
                return matching[-1]

        if record.status in [
            RecordStatus.CONFIRMED,
            RecordStatus.PROCESSED,
            RecordStatus.RECALCULATED,
        ]:
            comment_formulas = [
                f for f in record.formulas if f.source == FormulaSource.TEACHER_COMMENT
            ]
            if comment_formulas:
                return comment_formulas[-1]

        if record.status == RecordStatus.SUPPLEMENTARY:
            supplementary = [f for f in record.formulas if f.source == FormulaSource.SUPPLEMENTARY]
            if supplementary:
                return supplementary[-1]

        screenshot_formulas = [f for f in record.formulas if f.source == FormulaSource.SCREENSHOT]
        if screenshot_formulas:
            return screenshot_formulas[-1]

        return record.formulas[-1]

    def _build_snapshot_label(
        self, record: DriftRecord, source: FormulaSource, is_recalc: bool
    ) -> str:
        base_labels = {
            FormulaSource.SCREENSHOT: "旧公式截图口径",
            FormulaSource.TEACHER_COMMENT: "老师批注口径",
            FormulaSource.SUPPLEMENTARY: "补录更正口径",
        }
        label = base_labels.get(source, source.value)
        if is_recalc:
            label = f"{label}（复核后复算）"
        else:
            label = f"{label}（初算）"
        return label

    def import_screenshot_formula(
        self,
        batch_id: str,
        subject: str,
        exam_date: str,
        raw_values: Dict[str, str],
        formula_expression: str,
        formula_description: str,
        screenshot_id: Optional[str] = None,
    ) -> DriftRecord:
        parsed_values = {k: self._parse_value(v) for k, v in raw_values.items()}

        record = DriftRecord(
            batch_id=batch_id,
            subject=subject,
            exam_date=exam_date,
            original_values=parsed_values,
        )

        formula = Formula(
            expression=formula_expression,
            source=FormulaSource.SCREENSHOT,
            description=formula_description,
            source_id=screenshot_id,
            uploaded_at=datetime.now(),
            uploaded_by=self.session.operator,
        )
        record.formulas.append(formula)

        self.session.records.append(record)
        self.session.log_action(
            "import_screenshot_formula",
            {
                "record_id": record.record_id,
                "batch_id": batch_id,
                "subject": subject,
                "formula": formula_expression,
            },
        )
        self._register_replay(
            "import_screenshot_formula",
            batch_id,
            subject,
            exam_date,
            raw_values,
            formula_expression,
            formula_description,
            screenshot_id,
        )

        return record

    def import_teacher_comment(
        self,
        record_id: str,
        formula_expression: str,
        formula_description: str,
        comment_source_id: Optional[str] = None,
    ) -> Tuple[DriftRecord, List[ConflictEvidence]]:
        record = self._find_record(record_id)

        formula = Formula(
            expression=formula_expression,
            source=FormulaSource.TEACHER_COMMENT,
            description=formula_description,
            source_id=comment_source_id,
            uploaded_at=datetime.now(),
            uploaded_by="吴老师",
        )
        record.formulas.append(formula)
        record.updated_at = datetime.now()

        conflicts = self._detect_formula_conflicts(record)
        if conflicts:
            record.conflicts.extend(conflicts)
            record.status = RecordStatus.CONFLICT_DETECTED
            self.session.log_action(
                "conflict_detected",
                {"record_id": record_id, "conflicts_count": len(conflicts)},
            )
            self._register_replay(
                "import_teacher_comment",
                record_id,
                formula_expression,
                formula_description,
                comment_source_id,
                may_throw=True,
            )
            raise ConflictDetectedError(record_id, conflicts)

        self.session.log_action(
            "import_teacher_comment",
            {"record_id": record_id, "formula": formula_expression},
        )
        self._register_replay(
            "import_teacher_comment",
            record_id,
            formula_expression,
            formula_description,
            comment_source_id,
        )

        return record, conflicts

    def review_by_wu_teacher(
        self,
        record_id: str,
        decision: RecordStatus,
        comment: Optional[str] = None,
        adopted_formula_idx: Optional[int] = None,
    ) -> DriftRecord:
        if decision not in [RecordStatus.CONFIRMED, RecordStatus.REJECTED]:
            raise ValueError(
                f"吴老师只能确认(CONFIRMED)或驳回(REJECTED)，不能选择 {decision}"
            )

        record = self._find_record(record_id)
        if record.status != RecordStatus.CONFLICT_DETECTED:
            raise PendingReviewError(
                record_id, record.status.value, "当前记录未处于冲突状态"
            )

        screenshot_f = [f for f in record.formulas if f.source == FormulaSource.SCREENSHOT]
        comment_f = [f for f in record.formulas if f.source == FormulaSource.TEACHER_COMMENT]

        value_changes: List[ValueChange] = []
        if screenshot_f and comment_f:
            sf = screenshot_f[-1]
            cf = comment_f[-1]
            value_changes.append(
                ValueChange(
                    field_name="协方差计算公式",
                    original_statement=f"[旧公式截图] {sf.expression} — {sf.description}",
                    original_numeric=None,
                    revised_statement=(
                        f"[老师批注] {cf.expression} — {cf.description}"
                        if decision == RecordStatus.CONFIRMED
                        else f"[维持截图] {sf.expression} — {sf.description}"
                    ),
                    revised_numeric=None,
                    change_reason=(
                        comment or "经吴老师核查确认"
                    ),
                )
            )

        next_handler = (
            "活动负责人：请按已确认公式检查数据格式后计算"
            if decision == RecordStatus.CONFIRMED
            else "系统：公式维持截图口径，可继续流程"
        )

        review = ReviewResult(
            record_id=record_id,
            reviewer="吴老师（教研负责人）",
            review_field=ReviewField.FORMULA,
            decision=decision,
            comment=comment,
            value_changes=value_changes,
            next_handler=next_handler,
        )
        record.reviews.append(review)
        record.status = decision
        record.updated_at = datetime.now()

        self.session.log_action(
            "wu_teacher_review",
            {
                "record_id": record_id,
                "decision": decision.value,
                "comment": comment,
                "value_changes_count": len(value_changes),
            },
        )
        self._register_replay(
            "review_by_wu_teacher",
            record_id,
            decision,
            comment,
            adopted_formula_idx,
        )

        return record

    def import_supplementary_formula(
        self,
        record_id: str,
        formula_expression: str,
        formula_description: str,
        note: str,
    ) -> DriftRecord:
        record = self._find_record(record_id)

        formula = Formula(
            expression=formula_expression,
            source=FormulaSource.SUPPLEMENTARY,
            description=formula_description,
            uploaded_at=datetime.now(),
            uploaded_by="系统补录（吴老师已确认）",
        )
        record.formulas.append(formula)
        record.status = RecordStatus.SUPPLEMENTARY
        old_note = record.notes or ""
        record.notes = (
            old_note + ("\n" if old_note else "") + f"[补录说明] {note}"
        )
        record.updated_at = datetime.now()

        self.session.log_action(
            "import_supplementary_formula",
            {
                "record_id": record_id,
                "formula": formula_expression,
                "note": note,
            },
        )
        self._register_replay(
            "import_supplementary_formula",
            record_id,
            formula_expression,
            formula_description,
            note,
        )

        return record

    def check_format(self, record_id: str) -> Tuple[DriftRecord, List[str]]:
        record = self._find_record(record_id)
        issues = self._detect_mixed_format(record)

        if issues:
            record.status = RecordStatus.MIXED_FORMAT
            self.session.log_action(
                "mixed_format_detected",
                {"record_id": record_id, "issues": issues},
            )
            self._register_replay("check_format", record_id, may_throw=True)
            raise MixedFormatError(record_id, issues)

        self._register_replay("check_format", record_id)
        return record, issues

    def review_by_activity_leader(
        self,
        record_id: str,
        decision: RecordStatus,
        comment: Optional[str] = None,
        conversion_rules: Optional[Dict[str, float]] = None,
    ) -> DriftRecord:
        if decision not in [RecordStatus.CONFIRMED, RecordStatus.REJECTED]:
            raise ValueError(
                f"活动负责人只能确认(CONFIRMED)或驳回(REJECTED)，不能选择 {decision}"
            )

        record = self._find_record(record_id)
        if record.status != RecordStatus.MIXED_FORMAT:
            raise PendingReviewError(
                record_id, record.status.value, "当前记录未处于混排状态"
            )

        value_changes: List[ValueChange] = []
        if decision == RecordStatus.CONFIRMED and conversion_rules:
            for key, new_value in conversion_rules.items():
                if key in record.original_values:
                    old_entry = record.original_values[key]
                    value_changes.append(
                        ValueChange(
                            field_name=key,
                            original_statement=(
                                f"[原始写法] {old_entry.raw_value}"
                                f"（{old_entry.format_note}）"
                            ),
                            original_numeric=old_entry.numeric_value,
                            revised_statement=(
                                f"[复核后统一] {old_entry.raw_value} → {new_value}"
                            ),
                            revised_numeric=new_value,
                            change_reason=comment or "活动负责人统一格式确认",
                        )
                    )
                    record.original_values[key] = ValueEntry(
                        raw_value=old_entry.raw_value,
                        numeric_value=new_value,
                        is_decimal=True,
                        format_note=(
                            f"活动负责人复核后统一为小数: "
                            f"{old_entry.raw_value} → {new_value}"
                        ),
                    )

        next_handler = (
            "系统：格式已统一，请继续执行计算"
            if decision == RecordStatus.CONFIRMED
            else "数据录入员：请核对原始数据后重新提交"
        )

        review = ReviewResult(
            record_id=record_id,
            reviewer="活动负责人",
            review_field=ReviewField.FORMAT,
            decision=decision,
            comment=comment,
            value_changes=value_changes,
            next_handler=next_handler,
        )
        record.reviews.append(review)
        record.status = decision
        record.updated_at = datetime.now()

        self.session.log_action(
            "activity_leader_review",
            {
                "record_id": record_id,
                "decision": decision.value,
                "conversion_rules": conversion_rules,
                "value_changes_count": len(value_changes),
            },
        )
        self._register_replay(
            "review_by_activity_leader",
            record_id,
            decision,
            comment,
            conversion_rules,
        )

        return record

    def calculate(
        self,
        record_id: str,
        source_preference: Optional[FormulaSource] = None,
    ) -> DriftRecord:
        record = self._find_record(record_id)

        if record.status == RecordStatus.CONFLICT_DETECTED:
            raise PendingReviewError(
                record_id,
                record.status.value,
                "存在公式冲突，需吴老师确认后才能计算",
            )
        if record.status == RecordStatus.MIXED_FORMAT:
            raise PendingReviewError(
                record_id,
                record.status.value,
                "存在百分数小数混排，需活动负责人复核后才能计算",
            )
        if record.status == RecordStatus.REJECTED:
            raise PendingReviewError(
                record_id,
                record.status.value,
                "记录已被驳回，无法计算",
            )

        formula = self._select_formula(record, source_preference)
        values = {}
        for key, entry in record.original_values.items():
            if entry.numeric_value is None:
                raise ValueError(f"字段 {key} 数值解析失败，无法计算")
            values[key] = entry.numeric_value

        is_recalc = len(record.calculation_snapshots) > 0

        if is_recalc and record.calculation_snapshots:
            record.status = RecordStatus.RECALCULATED

        details, covariance = self._run_calculation_steps(values, formula)

        label = self._build_snapshot_label(record, formula.source, is_recalc)
        record.take_calculation_snapshot(
            label=label,
            source=formula.source,
            formula_expr=formula.expression,
            details=details,
            result=covariance,
        )

        if not is_recalc and record.status in (
            RecordStatus.NORMAL,
            RecordStatus.CONFIRMED,
            RecordStatus.SUPPLEMENTARY,
        ):
            record.status = RecordStatus.PROCESSED

        record.updated_at = datetime.now()

        diff_summary = None
        diff = record.get_old_vs_new_diff()
        if diff:
            diff_summary = (
                f"旧口径({diff['label_other']},{diff['source_other']}):"
                f" {diff['formula_other']}；"
                f"新口径({diff['label_this']},{diff['source_this']}):"
                f" {diff['formula_this']}；"
                f"结果差值: {diff['result_diff']}"
            )

        self.session.log_action(
            "calculate",
            {
                "record_id": record_id,
                "covariance": covariance,
                "formula_source": formula.source.value,
                "snapshot_label": label,
                "is_recalc": is_recalc,
                "diff_summary": diff_summary,
            },
        )
        self._register_replay("calculate", record_id, source_preference)

        return record

    def _find_record(self, record_id: str) -> DriftRecord:
        for record in self.session.records:
            if record.record_id == record_id:
                return record
        raise KeyError(f"未找到记录 {record_id}")

    def get_replay_script(self) -> str:
        import os

        project_root = os.path.dirname(
            os.path.dirname(os.path.abspath(__file__))
        )
        lines = [
            "# -*- coding: utf-8 -*-",
            "# 协方差漂移监测 - 可重跑脚本",
            f"# 生成时间: {datetime.now().isoformat()}",
            f"# 会话ID: {self.session.session_id}",
            "# 说明：脚本中的所有操作都串在同一个 `record` 变量上，",
            "#       保证报告、复盘记录与计算结果基于同一条最新数据。",
            "",
            "import sys",
            f"sys.path.insert(0, {repr(project_root)})",
            "",
            "from covariance_monitor import (",
            "    CovarianceMonitor, RecordStatus, FormulaSource, ReviewField,",
            "    ConflictDetectedError, MixedFormatError,",
            ")",
            "",
            f"monitor = CovarianceMonitor(operator={repr(self.session.operator)})",
            "",
        ]
        lines.extend(self.session.replay_commands)
        lines.append("")
        lines.append("# ==========================================================")
        lines.append("# 基于同一条记录，同步展示：最新结果 + 快照对比 + 复核留痕")
        lines.append("# ==========================================================")
        lines.append("rec = monitor.session.records[0]")
        lines.append("")
        lines.append("print('=' * 80)")
        lines.append("print('记录ID: %s  |  当前状态: %s' % (rec.record_id, rec.status.value))")
        lines.append("print('最终协方差: %s' % rec.covariance_result)")
        lines.append('print("-" * 80)')
        lines.append('print("计算快照对比 (同一条记录的多口径复盘):")')
        lines.append("for i, snap in enumerate(rec.calculation_snapshots, 1):")
        lines.append('    print("  快照%d: %s" % (i, snap.label))')
        lines.append('    print("    公式来源: %s  公式: %s" % (snap.formula_source.value, snap.formula_expression))')
        lines.append('    print("    协方差: %s" % snap.covariance_result)')
        lines.append("")
        lines.append("diff = rec.get_old_vs_new_diff()")
        lines.append("if diff:")
        lines.append('    print("旧口径 vs 新口径 差异复盘:")')
        lines.append('    print("  结果差值: %s" % diff["result_diff"])')
        lines.append('    print("  公式变更: %s" % ("是" if diff["formula_changed"] else "否"))')
        lines.append('    print("  【%s】%s (%s)" % (diff["label_other"], diff["formula_other"], diff["source_other"]))')
        lines.append('    print("  【%s】%s (%s)" % (diff["label_this"], diff["formula_this"], diff["source_this"]))')
        lines.append("")
        lines.append("if rec.reviews:")
        lines.append('    print("复核留痕 (原始说法/改后值/原因/下一步找谁):")')
        lines.append('    for r in rec.reviews:')
        lines.append('        ts = r.reviewed_at.strftime("%Y-%m-%d %H:%M")')
        lines.append('        print("  [%s] %s 复核%s → %s" % (ts, r.reviewer, r.review_field.value, r.decision.value))')
        lines.append("        if r.comment:")
        lines.append('            print("    说明: %s" % r.comment)')
        lines.append("        for vc in r.value_changes:")
        lines.append('            print("    变更字段 %s:" % vc.field_name)')
        lines.append('            print("      原始说法: %s" % vc.original_statement)')
        lines.append('            print("      改后值:   %s" % vc.revised_statement)')
        lines.append('            print("      处理原因: %s" % vc.change_reason)')
        lines.append('        print("    下一步找谁: %s" % r.next_handler)')
        lines.append("")
        lines.append("for rec in monitor.session.records:")
        lines.append('    print("%s: %s = %s" % (rec.record_id, rec.status.value, rec.covariance_result))')
        return "\n".join(lines)

    def get_audit_report(self) -> str:
        lines = [
            "=" * 80,
            "协方差漂移监测 - 复盘记录",
            "（同一条记录贯通：触发输入 / 补录修正 / 状态变化 / 最终展示）",
            "=" * 80,
            f"会话ID: {self.session.session_id}",
            f"操作人: {self.session.operator}",
            f"开始时间: {self.session.started_at.isoformat()}",
            f"结束时间: {self.session.ended_at.isoformat() if self.session.ended_at else '未结束'}",
            f"处理记录数: {len(self.session.records)}",
            "",
            "-" * 80,
            "操作日志（按时间顺序，全量追踪同一条记录）:",
            "-" * 80,
        ]

        for log in self.session.audit_log:
            lines.append(
                f"[{log['timestamp']}] {log['action']}: "
                f"{json.dumps(log['detail'], ensure_ascii=False)}"
            )

        for record in self.session.records:
            lines.append("")
            lines.append("=" * 80)
            lines.append(
                f"【同一条记录】记录ID: {record.record_id}  |  批次: {record.batch_id}  "
                f"|  学科: {record.subject}  |  考试日期: {record.exam_date}"
            )
            lines.append(
                f"当前状态: {record.status.value}   |   "
                f"最终协方差: {record.covariance_result}"
            )
            lines.append("-" * 40)
            lines.append("1. 触发问题的原始输入（保留原始说法，未提前归一化）:")
            for key, entry in record.original_values.items():
                lines.append(
                    f"    {key}: 原始写法={entry.raw_value}  "
                    f"→ 解析值={entry.numeric_value}  "
                    f"（{entry.format_note}）"
                )
            lines.append("-" * 40)
            lines.append("2. 公式列表（按导入顺序，冲突对比即基于此）:")
            for i, f in enumerate(record.formulas, 1):
                lines.append(
                    f"    {i}. [{f.source.value}] {f.expression}"
                    f" — {f.description}"
                    f"（上传人: {f.uploaded_by}）"
                )
            if record.conflicts:
                lines.append("-" * 40)
                lines.append("3. 冲突证据（旧公式截图 vs 老师批注，明文列出）:")
                for i, c in enumerate(record.conflicts, 1):
                    lines.append(f"    冲突#{i}: 字段「{c.field_name}」")
                    lines.append(f"      [旧公式截图] {c.screenshot_value}")
                    lines.append(f"      [老师批注]   {c.comment_value}")
                    lines.append(f"      说明: {c.detail}")
                    lines.append(f"      → 未自动拍板，已转吴老师确认/驳回")
            if record.reviews:
                lines.append("-" * 40)
                lines.append("4. 复核留痕（原始说法/改后值/处理原因/下一步找谁）:")
                for i, r in enumerate(record.reviews, 1):
                    lines.append(
                        f"    复核#{i} [{r.reviewed_at.isoformat()}] "
                        f"{r.reviewer}  →  {r.review_field.value}: {r.decision.value}"
                    )
                    if r.comment:
                        lines.append(f"      复核意见: {r.comment}")
                    for j, vc in enumerate(r.value_changes, 1):
                        lines.append(f"      变更{j}: 字段 {vc.field_name}")
                        lines.append(f"        原始说法: {vc.original_statement}")
                        lines.append(f"        改后值:     {vc.revised_statement}")
                        lines.append(f"        处理原因:   {vc.change_reason}")
                    lines.append(f"      下一步找谁: {r.next_handler}")
            if record.calculation_snapshots:
                lines.append("-" * 40)
                lines.append("5. 计算快照（同一条记录的多次计算，含旧口径vs新口径）:")
                for i, snap in enumerate(record.calculation_snapshots, 1):
                    lines.append(
                        f"    快照#{i} [{snap.created_at.isoformat()}] "
                        f"{snap.label}"
                    )
                    lines.append(
                        f"      公式来源: {snap.formula_source.value}  "
                        f"公式: {snap.formula_expression}"
                    )
                    lines.append(
                        f"      当时状态: {snap.status_at_snapshot.value}  "
                        f"协方差: {snap.covariance_result}"
                    )
                    lines.append(f"      明细步骤（共{len(snap.details)}步）:")
                    for d in snap.details:
                        lines.append(
                            f"        步骤{d.step}: {d.description}  "
                            f"→ 结果={d.intermediate_result}"
                            f"（公式: {d.formula_used}）"
                        )
                diff = record.get_old_vs_new_diff()
                if diff:
                    lines.append("-" * 40)
                    lines.append("6. 旧口径 vs 批注口径 差异复盘:")
                    lines.append(
                        f"    【{diff['label_other']} | {diff['source_other']}】"
                        f" 公式: {diff['formula_other']}"
                    )
                    lines.append(
                        f"    【{diff['label_this']} | {diff['source_this']}】"
                        f" 公式: {diff['formula_this']}"
                    )
                    lines.append(
                        f"    公式是否变更: {'是' if diff['formula_changed'] else '否'}"
                    )
                    lines.append(f"    协方差结果差值: {diff['result_diff']}")
                    if record.calculation_snapshots:
                        first = record.calculation_snapshots[0]
                        last = record.calculation_snapshots[-1]
                        lines.append(
                            f"    初算值: {first.covariance_result}"
                            f" → 复算值: {last.covariance_result}"
                        )
            if record.notes:
                lines.append("-" * 40)
                lines.append("7. 备注/补录说明:")
                lines.append(f"    {record.notes}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("可重跑命令（与上述复盘记录基于同一条记录）:")
        lines.append("=" * 80)
        for cmd in self.session.replay_commands:
            lines.append(cmd)

        return "\n".join(lines)

    def finalize(self) -> None:
        self.session.ended_at = datetime.now()
        self._register_replay("finalize")
