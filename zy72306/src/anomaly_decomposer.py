from typing import List, Optional, Tuple
from pathlib import Path
import pandas as pd
import numpy as np

from .data_models import (
    TimeSeriesRecord,
    AnomalyResult,
    AnomalyType,
    ProcessStatus,
    BoundaryRuleType,
    BOUNDARY_RULES,
    FIELD_ALIASES,
    FieldMapping,
)


class MultiSourceImporter:
    """Excel / CSV 多源导入 + 字段别名自动归一 + 明确字段映射

    支持：
      - .csv
      - .xlsx / .xls（多个 sheet）
      - 自动匹配中英文列名（FIELD_ALIASES）
      - 或显式传入 FieldMapping
    """

    def __init__(self):
        pass

    def _detect_mapping(self, columns: List[str]) -> FieldMapping:
        """根据列名 + FIELD_ALIASES 自动推断字段映射"""
        mapping = FieldMapping()

        def find_col(target: str) -> Optional[str]:
            aliases = [a.lower() for a in FIELD_ALIASES.get(target, [])]
            for col in columns:
                if col.lower() in aliases:
                    return col
            return None

        mapping.row_number_col = find_col("row_number") or "row_number"
        mapping.timestamp_col = find_col("timestamp") or "timestamp"
        mapping.metric_name_col = find_col("metric_name") or "metric_name"
        mapping.numerator_col = find_col("numerator") or "numerator"
        mapping.denominator_col = find_col("denominator") or "denominator"
        mapping.screenshot_ref_col = find_col("source_screenshot_ref")
        mapping.teacher_comment_col = find_col("teacher_comment")
        return mapping

    def _read_any(self, filepath: str) -> List[Tuple[str, pd.DataFrame]]:
        path = Path(filepath)
        suffix = path.suffix.lower()
        if suffix == ".csv":
            df = pd.read_csv(filepath, keep_default_na=False, na_values=[])
            return [(path.name, df)]
        elif suffix in (".xlsx", ".xls"):
            sheets = pd.read_excel(filepath, sheet_name=None, keep_default_na=False, na_values=[])
            return [(f"{path.name}#{name}", df) for name, df in sheets.items()]
        else:
            raise ValueError(f"不支持的导入格式：{suffix}，仅支持 .csv/.xlsx/.xls")

    def normalize_columns(self, df: pd.DataFrame, mapping: Optional[FieldMapping] = None) -> pd.DataFrame:
        """按映射把任意列名重命名为系统统一列名，缺少的列以空值补齐"""
        mp = mapping or self._detect_mapping(list(df.columns))

        rename_map = {}
        expected = {
            mp.row_number_col: "row_number",
            mp.timestamp_col: "timestamp",
            mp.metric_name_col: "metric_name",
            mp.numerator_col: "numerator",
            mp.denominator_col: "denominator",
        }
        if mp.screenshot_ref_col:
            expected[mp.screenshot_ref_col] = "source_screenshot_ref"
        if mp.teacher_comment_col:
            expected[mp.teacher_comment_col] = "teacher_comment"

        rename_map = {k: v for k, v in expected.items() if k in df.columns}
        norm = df.rename(columns=rename_map).copy()

        for required in ["row_number", "timestamp", "metric_name", "numerator", "denominator"]:
            if required not in norm.columns:
                norm[required] = np.nan if required in ("numerator", "row_number") else ""
        if "source_screenshot_ref" not in norm.columns:
            norm["source_screenshot_ref"] = None
        if "teacher_comment" not in norm.columns:
            norm["teacher_comment"] = None
        return norm

    def load(self, filepath: str, mapping: Optional[FieldMapping] = None) -> List[Tuple[TimeSeriesRecord, str, str]]:
        """导入文件，返回 [(记录, 导入来源, sheet名)] 的列表"""
        output: List[Tuple[TimeSeriesRecord, str, str]] = []

        for source, df in self._read_any(filepath):
            norm = self.normalize_columns(df, mapping)
            sheet_name = source.split("#", 1)[-1] if "#" in source else None

            for idx, row in norm.iterrows():
                row_number_raw = row.get("row_number", np.nan)
                if pd.isna(row_number_raw):
                    row_number = idx + 1
                else:
                    try:
                        row_number = int(row_number_raw)
                    except Exception:
                        row_number = idx + 1

                raw_denominator = row.get("denominator", "")
                if isinstance(raw_denominator, float) and pd.isna(raw_denominator):
                    raw_denominator = ""
                if not isinstance(raw_denominator, str):
                    raw_denominator = str(raw_denominator)

                numerator_raw = row.get("numerator", 0)
                try:
                    numerator = float(numerator_raw) if not (isinstance(numerator_raw, float) and pd.isna(numerator_raw)) else 0.0
                except Exception:
                    numerator = 0.0

                timestamp = str(row.get("timestamp", ""))
                if timestamp == "nan" or timestamp is None:
                    timestamp = ""
                metric_name = str(row.get("metric_name", ""))
                if metric_name == "nan" or metric_name is None:
                    metric_name = ""

                screenshot = row.get("source_screenshot_ref", None)
                if isinstance(screenshot, float) and pd.isna(screenshot):
                    screenshot = None
                teacher = row.get("teacher_comment", None)
                if isinstance(teacher, float) and pd.isna(teacher):
                    teacher = None

                rec = TimeSeriesRecord(
                    row_number=row_number,
                    timestamp=timestamp,
                    metric_name=metric_name,
                    numerator=numerator,
                    denominator=raw_denominator,
                    raw_denominator=raw_denominator,
                    source_screenshot_ref=str(screenshot) if screenshot else None,
                    teacher_comment=str(teacher) if teacher else None,
                    import_source=source,
                    import_sheet_name=sheet_name,
                )
                output.append((rec, source, sheet_name or ""))

        return output


class TimeSeriesAnomalyDecomposer:
    def __init__(self):
        self.boundary_rules = BOUNDARY_RULES
        self.normal_ratio_min = 0.5
        self.normal_ratio_max = 2.0
        self.importer = MultiSourceImporter()

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
            boundary_rule_triggered=boundary_rule_triggered,
            import_source=record.import_source,
            import_sheet_name=record.import_sheet_name,
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
        mp = FieldMapping(
            row_number_col=row_number_col,
            timestamp_col=timestamp_col,
            metric_name_col=metric_name_col,
            numerator_col=numerator_col,
            denominator_col=denominator_col,
            screenshot_ref_col=screenshot_ref_col,
            teacher_comment_col=teacher_comment_col,
        )
        norm = self.importer.normalize_columns(df, mp)
        results = []

        for idx, row in norm.iterrows():
            row_num = int(row.get("row_number", idx + 1))
            raw_denominator = row.get("denominator", "")

            if isinstance(raw_denominator, float) and pd.isna(raw_denominator):
                raw_denominator = ""
            elif not isinstance(raw_denominator, str):
                raw_denominator = str(raw_denominator)

            record = TimeSeriesRecord(
                row_number=row_num,
                timestamp=str(row.get("timestamp", "")),
                metric_name=str(row.get("metric_name", "")),
                numerator=float(row.get("numerator", 0)),
                denominator=raw_denominator,
                raw_denominator=raw_denominator,
                source_screenshot_ref=(
                    str(row.get("source_screenshot_ref", ''))
                    if row.get("source_screenshot_ref") is not None
                    and not (isinstance(row.get("source_screenshot_ref"), float) and pd.isna(row.get("source_screenshot_ref")))
                    else None
                ),
                teacher_comment=(
                    str(row.get("teacher_comment", ''))
                    if row.get("teacher_comment") is not None
                    and not (isinstance(row.get("teacher_comment"), float) and pd.isna(row.get("teacher_comment")))
                    else None
                )
            )
            result = self.decompose_record(record)
            results.append(result)

        return results

    def decompose_file(self, filepath: str, mapping: Optional[FieldMapping] = None) -> List[AnomalyResult]:
        """从 CSV/Excel 文件直接分解，支持多源字段归一"""
        records_meta = self.importer.load(filepath, mapping)
        results = []
        for rec, _src, _sheet in records_meta:
            results.append(self.decompose_record(rec))
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
