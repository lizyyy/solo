from typing import List, Dict, Optional, Tuple, Callable, Any
from datetime import datetime
import json
import re

from .types import (
    DriftRecord,
    RecordStatus,
    FormulaSource,
    Formula,
    ValueEntry,
    ConflictEvidence,
    ReviewResult,
    CalculationDetail,
    MonitorSession,
)
from .exceptions import (
    ConflictDetectedError,
    MixedFormatError,
    PendingReviewError,
    FormulaNotFoundError,
)


class CovarianceMonitor:
    """协方差漂移监测核心类"""

    def __init__(self, operator: str = "system"):
        self.session = MonitorSession(operator=operator)
        self._current_record_var = None

    @staticmethod
    def _format_arg(arg: Any) -> str:
        if isinstance(arg, RecordStatus):
            return f"RecordStatus.{arg.name}"
        if isinstance(arg, FormulaSource):
            return f"FormulaSource.{arg.name}"
        return repr(arg)

    def _register_replay(self, method: str, *args, may_throw: bool = False, **kwargs) -> None:
        args_list = list(args)
        
        if method == "import_screenshot_formula":
            self._current_record_var = "record"
        
        returns_tuple = method in ["import_teacher_comment", "check_format"]
        
        if self._current_record_var and len(args_list) > 0 and method != "import_screenshot_formula":
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
            exception_class = "ConflictDetectedError" if method == "import_teacher_comment" else "MixedFormatError"
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
                f"同时存在百分数格式和小数格式，请活动负责人复核确认是否统一口径"
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
                        conflicts.append(ConflictEvidence(
                            record_id=record.record_id,
                            field_name="协方差计算公式",
                            screenshot_value=s_f.expression,
                            comment_value=c_f.expression,
                            detail=f"旧公式截图使用 '{s_f.expression}'，老师批注使用 '{c_f.expression}'，两者不一致，需教研负责人吴老师确认",
                        ))

        return conflicts

    def _calculate_covariance(
        self,
        values: Dict[str, float],
        formula: str,
        source: FormulaSource,
        record: DriftRecord,
    ) -> float:
        x_values = [v for k, v in values.items() if k.startswith("x_") or k.startswith("x")]
        y_values = [v for k, v in values.items() if k.startswith("y_") or k.startswith("y")]

        if not x_values or not y_values:
            x_values = [v for i, (k, v) in enumerate(values.items()) if i % 2 == 0]
            y_values = [v for i, (k, v) in enumerate(values.items()) if i % 2 == 1]

        n = min(len(x_values), len(y_values))
        if n < 2:
            raise ValueError("至少需要2对数据点才能计算协方差")

        step = 0
        record.calculation_history = []

        step += 1
        x_mean = sum(x_values[:n]) / n
        record.calculation_history.append(CalculationDetail(
            step=step,
            description=f"计算X均值 (E[X])",
            input_values={"x_values": x_values[:n]},
            formula_used="Σx / n",
            intermediate_result=x_mean,
            source=source,
        ))

        step += 1
        y_mean = sum(y_values[:n]) / n
        record.calculation_history.append(CalculationDetail(
            step=step,
            description=f"计算Y均值 (E[Y])",
            input_values={"y_values": y_values[:n]},
            formula_used="Σy / n",
            intermediate_result=y_mean,
            source=source,
        ))

        step += 1
        products = [(x_values[i] - x_mean) * (y_values[i] - y_mean) for i in range(n)]
        record.calculation_history.append(CalculationDetail(
            step=step,
            description="计算偏差乘积 (x-E[X])(y-E[Y])",
            input_values={f"x{i}": x_values[i] for i in range(n)} | {f"y{i}": y_values[i] for i in range(n)},
            formula_used="(x-E[X])(y-E[Y])",
            intermediate_result=sum(products),
            source=source,
        ))

        step += 1
        covariance = sum(products) / n
        record.calculation_history.append(CalculationDetail(
            step=step,
            description="协方差 = 平均偏差乘积",
            input_values={"products": products},
            formula_used=formula,
            intermediate_result=covariance,
            source=source,
        ))

        return covariance

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
        self.session.log_action("import_screenshot_formula", {
            "record_id": record.record_id,
            "batch_id": batch_id,
            "subject": subject,
        })
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
            self.session.log_action("conflict_detected", {
                "record_id": record_id,
                "conflicts_count": len(conflicts),
            })
            self._register_replay(
                "import_teacher_comment",
                record_id,
                formula_expression,
                formula_description,
                comment_source_id,
                may_throw=True,
            )
            raise ConflictDetectedError(record_id, conflicts)

        self.session.log_action("import_teacher_comment", {
            "record_id": record_id,
            "formula": formula_expression,
        })
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
    ) -> DriftRecord:
        if decision not in [RecordStatus.CONFIRMED, RecordStatus.REJECTED]:
            raise ValueError(f"吴老师只能确认(CONFIRMED)或驳回(REJECTED)，不能选择 {decision}")

        record = self._find_record(record_id)
        if record.status != RecordStatus.CONFLICT_DETECTED:
            raise PendingReviewError(record_id, record.status.value, "当前记录未处于冲突状态")

        review = ReviewResult(
            record_id=record_id,
            reviewer="吴老师",
            decision=decision,
            comment=comment,
        )
        record.reviews.append(review)
        record.status = decision
        record.updated_at = datetime.now()

        self.session.log_action("wu_teacher_review", {
            "record_id": record_id,
            "decision": decision.value,
            "comment": comment,
        })
        self._register_replay(
            "review_by_wu_teacher",
            record_id,
            decision,
            comment,
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
            uploaded_by="系统补录",
        )
        record.formulas.append(formula)
        record.status = RecordStatus.SUPPLEMENTARY
        record.notes = (record.notes or "") + f"\n[补录说明] {note}"
        record.updated_at = datetime.now()

        self.session.log_action("import_supplementary_formula", {
            "record_id": record_id,
            "formula": formula_expression,
            "note": note,
        })
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
            self.session.log_action("mixed_format_detected", {
                "record_id": record_id,
                "issues": issues,
            })
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
            raise ValueError(f"活动负责人只能确认(CONFIRMED)或驳回(REJECTED)，不能选择 {decision}")

        record = self._find_record(record_id)
        if record.status != RecordStatus.MIXED_FORMAT:
            raise PendingReviewError(record_id, record.status.value, "当前记录未处于混排状态")

        review = ReviewResult(
            record_id=record_id,
            reviewer="活动负责人",
            decision=decision,
            comment=comment,
        )
        record.reviews.append(review)
        record.status = decision
        record.updated_at = datetime.now()

        if decision == RecordStatus.CONFIRMED and conversion_rules:
            for key, new_value in conversion_rules.items():
                if key in record.original_values:
                    old_entry = record.original_values[key]
                    record.original_values[key] = ValueEntry(
                        raw_value=old_entry.raw_value,
                        numeric_value=new_value,
                        is_decimal=True,
                        format_note=f"活动负责人复核后统一为小数: {old_entry.raw_value} → {new_value}",
                    )

        self.session.log_action("activity_leader_review", {
            "record_id": record_id,
            "decision": decision.value,
            "conversion_rules": conversion_rules,
        })
        self._register_replay(
            "review_by_activity_leader",
            record_id,
            decision,
            comment,
            conversion_rules,
        )

        return record

    def calculate(self, record_id: str, source_preference: Optional[FormulaSource] = None) -> DriftRecord:
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

        covariance = self._calculate_covariance(values, formula.expression, formula.source, record)
        record.covariance_result = covariance
        record.status = RecordStatus.PROCESSED
        record.updated_at = datetime.now()

        self.session.log_action("calculate", {
            "record_id": record_id,
            "covariance": covariance,
            "formula_source": formula.source.value,
        })
        self._register_replay("calculate", record_id, source_preference)

        return record

    def _select_formula(self, record: DriftRecord, preference: Optional[FormulaSource]) -> Formula:
        if not record.formulas:
            raise FormulaNotFoundError("记录没有关联任何公式")

        if preference:
            matching = [f for f in record.formulas if f.source == preference]
            if matching:
                return matching[-1]

        if record.status in [RecordStatus.CONFIRMED, RecordStatus.PROCESSED]:
            comment_formulas = [f for f in record.formulas if f.source == FormulaSource.TEACHER_COMMENT]
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

    def _find_record(self, record_id: str) -> DriftRecord:
        for record in self.session.records:
            if record.record_id == record_id:
                return record
        raise KeyError(f"未找到记录 {record_id}")

    def get_replay_script(self) -> str:
        import os
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        lines = [
            "# 协方差漂移监测 - 可重跑脚本",
            f"# 生成时间: {datetime.now().isoformat()}",
            f"# 会话ID: {self.session.session_id}",
            "",
            "import sys",
            f"sys.path.insert(0, {repr(project_root)})",
            "",
            "from covariance_monitor import (",
            "    CovarianceMonitor, RecordStatus, FormulaSource,",
            "    ConflictDetectedError, MixedFormatError,",
            ")",
            "",
            f"monitor = CovarianceMonitor(operator={repr(self.session.operator)})",
            "",
        ]
        lines.extend(self.session.replay_commands)
        lines.append("")
        lines.append("# 查看结果")
        lines.append("for rec in monitor.session.records:")
        lines.append("    print(f\"{rec.record_id}: {rec.status.value} = {rec.covariance_result}\")")
        return "\n".join(lines)

    def get_audit_report(self) -> str:
        lines = [
            "=" * 80,
            "协方差漂移监测 - 复盘记录",
            "=" * 80,
            f"会话ID: {self.session.session_id}",
            f"操作人: {self.session.operator}",
            f"开始时间: {self.session.started_at.isoformat()}",
            f"结束时间: {self.session.ended_at.isoformat() if self.session.ended_at else '未结束'}",
            f"处理记录数: {len(self.session.records)}",
            "",
            "-" * 80,
            "操作日志:",
            "-" * 80,
        ]

        for log in self.session.audit_log:
            lines.append(f"[{log['timestamp']}] {log['action']}: {json.dumps(log['detail'], ensure_ascii=False)}")

        for record in self.session.records:
            lines.append("")
            lines.append("=" * 80)
            lines.append(f"记录ID: {record.record_id}")
            lines.append(f"批次: {record.batch_id} | 学科: {record.subject} | 考试日期: {record.exam_date}")
            lines.append(f"当前状态: {record.status.value}")
            lines.append(f"协方差结果: {record.covariance_result}")
            lines.append("-" * 40)
            lines.append("原始数据:")
            for key, entry in record.original_values.items():
                lines.append(f"  {key}: {entry.raw_value} → {entry.numeric_value} ({entry.format_note})")
            lines.append("-" * 40)
            lines.append("公式列表:")
            for f in record.formulas:
                lines.append(f"  [{f.source.value}] {f.expression} ({f.description})")
            if record.conflicts:
                lines.append("-" * 40)
                lines.append("冲突证据:")
                for c in record.conflicts:
                    lines.append(f"  * {c.field_name}:")
                    lines.append(f"    截图: {c.screenshot_value}")
                    lines.append(f"    批注: {c.comment_value}")
                    lines.append(f"    说明: {c.detail}")
            if record.reviews:
                lines.append("-" * 40)
                lines.append("复核记录:")
                for r in record.reviews:
                    lines.append(f"  [{r.reviewed_at.isoformat()}] {r.reviewer} → {r.decision.value}")
                    if r.comment:
                        lines.append(f"    备注: {r.comment}")
            if record.calculation_history:
                lines.append("-" * 40)
                lines.append("计算明细:")
                for detail in record.calculation_history:
                    lines.append(f"  步骤{detail.step}: {detail.description}")
                    lines.append(f"    公式: {detail.formula_used}")
                    lines.append(f"    输入: {json.dumps(detail.input_values, ensure_ascii=False)}")
                    lines.append(f"    结果: {detail.intermediate_result}")
                    lines.append(f"    来源: {detail.source.value}")
            if record.notes:
                lines.append("-" * 40)
                lines.append(f"备注: {record.notes}")

        lines.append("")
        lines.append("=" * 80)
        lines.append("可重跑命令:")
        lines.append("=" * 80)
        for cmd in self.session.replay_commands:
            lines.append(cmd)

        return "\n".join(lines)

    def finalize(self) -> None:
        self.session.ended_at = datetime.now()
        self._register_replay("finalize")
