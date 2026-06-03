from typing import List, Optional, Tuple
import pandas as pd
import numpy as np

from .data_models import (
    TimeSeriesRecord,
    AnomalyResult,
    AnomalyType,
    ProcessStatus,
    BoundaryRuleType,
    BOUNDARY_RULES
)


class TimeSeriesAnomalyDecomposer:
    def __init__(self):
        self.boundary_rules = BOUNDARY_RULES
        self.normal_ratio_min = 0.5
        self.normal_ratio_max = 2.0

    def _check_zero_denominator_empty_string(
        self, record: TimeSeriesRecord
    ) -> Tuple[bool, Optional[float]]:
        raw_denominator = record.raw_denominator
        denominator = record.denominator

        is_empty_string = (
            isinstance(raw_denominator, str) and
            raw_denominator.strip() == ''
        )
        is_zero_string = (
            isinstance(raw_denominator, str) and
            raw_denominator.strip() == '0'
        )

        numeric_denominator: Optional[float] = None
        if denominator is not None:
            try:
                numeric_denominator = float(denominator)
            except (ValueError, TypeError):
                numeric_denominator = None

        is_zero_value = (
            numeric_denominator is not None and
            abs(numeric_denominator) < 1e-10
        )
        is_none = numeric_denominator is None

        is_boundary_case = (
            is_empty_string or
            is_zero_string or
            (is_zero_value and (is_empty_string or is_zero_string)) or
            (is_none and is_empty_string)
        )

        return is_boundary_case, numeric_denominator

    def _calculate_ratio(self, numerator: float,
                         denominator: Optional[float]) -> Optional[float]:
        if denominator is None or abs(denominator) < 1e-10:
            return None
        return numerator / denominator

    def _determine_anomaly_type(
        self,
        ratio: Optional[float],
        is_boundary_case: bool,
        boundary_rule: Optional[BoundaryRuleType]
    ) -> AnomalyType:
        if is_boundary_case and boundary_rule == BoundaryRuleType.ZERO_DENOMINATOR_EMPTY_STRING:
            return AnomalyType.PENDING_VERIFICATION

        if ratio is None:
            return AnomalyType.BOUNDARY_CASE

        if ratio < self.normal_ratio_min or ratio > self.normal_ratio_max:
            return AnomalyType.ABNORMAL

        return AnomalyType.NORMAL

    def decompose_record(self, record: TimeSeriesRecord) -> AnomalyResult:
        is_boundary_case = False
        boundary_rule_triggered = None
        denominator = record.denominator

        is_zero_denominator, denominator = self._check_zero_denominator_empty_string(record)
        if is_zero_denominator:
            is_boundary_case = True
            boundary_rule_triggered = BoundaryRuleType.ZERO_DENOMINATOR_EMPTY_STRING

        if denominator is None and not is_boundary_case:
            is_boundary_case = True
            boundary_rule_triggered = BoundaryRuleType.MISSING_VALUE

        ratio = self._calculate_ratio(record.numerator, denominator)

        if ratio is not None and not is_boundary_case:
            if ratio < self.normal_ratio_min or ratio > self.normal_ratio_max:
                boundary_rule_triggered = BoundaryRuleType.OUTLIER_THRESHOLD

        anomaly_type = self._determine_anomaly_type(
            ratio, is_boundary_case, boundary_rule_triggered
        )

        return AnomalyResult(
            row_number=record.row_number,
            timestamp=record.timestamp,
            metric_name=record.metric_name,
            numerator=record.numerator,
            denominator=denominator,
            raw_denominator=record.raw_denominator,
            ratio=ratio,
            anomaly_type=anomaly_type,
            process_status=ProcessStatus.IMPORTED,
            source_screenshot_ref=record.source_screenshot_ref,
            teacher_comment=record.teacher_comment,
            boundary_rule_triggered=boundary_rule_triggered
        )

    def decompose_dataframe(
        self,
        df: pd.DataFrame,
        row_number_col: str = 'row_number',
        timestamp_col: str = 'timestamp',
        metric_name_col: str = 'metric_name',
        numerator_col: str = 'numerator',
        denominator_col: str = 'denominator',
        screenshot_ref_col: Optional[str] = None,
        teacher_comment_col: Optional[str] = None
    ) -> List[AnomalyResult]:
        results = []

        for idx, row in df.iterrows():
            row_num = int(row.get(row_number_col, idx + 1))
            raw_denominator = row.get(denominator_col, '')

            if pd.isna(raw_denominator):
                raw_denominator = ''
            elif not isinstance(raw_denominator, str):
                raw_denominator = str(raw_denominator)

            record = TimeSeriesRecord(
                row_number=row_num,
                timestamp=str(row.get(timestamp_col, '')),
                metric_name=str(row.get(metric_name_col, '')),
                numerator=float(row.get(numerator_col, 0)),
                denominator=raw_denominator,
                raw_denominator=raw_denominator,
                source_screenshot_ref=(
                    str(row.get(screenshot_ref_col, ''))
                    if screenshot_ref_col else None
                ),
                teacher_comment=(
                    str(row.get(teacher_comment_col, ''))
                    if teacher_comment_col else None
                )
            )

            result = self.decompose_record(record)
            results.append(result)

        return results

    def decompose_records(
        self, records: List[TimeSeriesRecord]
    ) -> List[AnomalyResult]:
        return [self.decompose_record(r) for r in records]

    def get_boundary_rule(
        self, rule_type: BoundaryRuleType
    ) -> Optional[dict]:
        for rule in self.boundary_rules:
            if rule.rule_type == rule_type:
                return rule.model_dump()
        return None

    def print_boundary_rules(self) -> None:
        from rich.console import Console
        from rich.table import Table

        console = Console()
        table = Table(title="时间序列异常分解 - 边界规则")
        table.add_column("规则类型", style="cyan")
        table.add_column("判定标准", style="green")
        table.add_column("处理方式", style="yellow")
        table.add_column("回滚方式", style="red")

        for rule in self.boundary_rules:
            if rule.is_active:
                table.add_row(
                    rule.rule_type.value,
                    rule.judgment_criteria,
                    rule.modification_method,
                    rule.rollback_method
                )

        console.print(table)
