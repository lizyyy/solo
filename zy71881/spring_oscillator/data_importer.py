"""数据导入器。

支持多种数据格式（CSV/Excel），处理晚到附件、去重，
并将原始数据转换为标准的实验记录和标定记录对象。
"""

from pathlib import Path
from datetime import datetime
from typing import List, Tuple, Optional, Dict, Any
import pandas as pd
import numpy as np

from .models import (
    ExperimentRecord,
    CalibrationRecord,
    DataStatus,
    RecordSource,
    ProcessingSummary,
)
from .errors import (
    DataImportError,
    wrap_technical_error,
)


SUPPORTED_FORMATS = [".csv", ".xlsx", ".xls"]

EXPERIMENT_COLUMN_MAPPING = {
    "学号": "student_id",
    "student_id": "student_id",
    "姓名": "student_name",
    "student_name": "student_name",
    "日期": "experiment_date",
    "实验日期": "experiment_date",
    "date": "experiment_date",
    "experiment_date": "experiment_date",
    "质量kg": "mass_kg",
    "质量(kg)": "mass_kg",
    "质量": "mass_kg",
    "mass": "mass_kg",
    "mass_kg": "mass_kg",
    "周期s": "period_s",
    "周期(秒)": "period_s",
    "周期": "period_s",
    "period": "period_s",
    "period_s": "period_s",
    "振幅cm": "amplitude_cm",
    "振幅(cm)": "amplitude_cm",
    "振幅": "amplitude_cm",
    "amplitude": "amplitude_cm",
    "amplitude_cm": "amplitude_cm",
    "伸长量mm": "spring_extension_mm",
    "弹簧伸长mm": "spring_extension_mm",
    "伸长量": "spring_extension_mm",
    "extension": "spring_extension_mm",
    "spring_extension_mm": "spring_extension_mm",
    "备注": "notes",
    "notes": "notes",
    "状态": "status",
    "status": "status",
}

CALIBRATION_COLUMN_MAPPING = {
    "弹簧编号": "spring_id",
    "spring_id": "spring_id",
    "标定日期": "calibration_date",
    "日期": "calibration_date",
    "date": "calibration_date",
    "calibration_date": "calibration_date",
    "标称质量kg": "nominal_mass_kg",
    "标称质量(kg)": "nominal_mass_kg",
    "标称质量": "nominal_mass_kg",
    "nominal_mass": "nominal_mass_kg",
    "nominal_mass_kg": "nominal_mass_kg",
    "实际质量kg": "actual_mass_kg",
    "实际质量(kg)": "actual_mass_kg",
    "实际质量": "actual_mass_kg",
    "actual_mass": "actual_mass_kg",
    "actual_mass_kg": "actual_mass_kg",
    "劲度系数N/m": "spring_constant_nm",
    "劲度系数(N/m)": "spring_constant_nm",
    "弹簧常数": "spring_constant_nm",
    "k值": "spring_constant_nm",
    "spring_constant": "spring_constant_nm",
    "spring_constant_nm": "spring_constant_nm",
    "备注": "notes",
    "notes": "notes",
}

REQUIRED_EXPERIMENT_COLUMNS = ["mass_kg", "period_s"]
REQUIRED_CALIBRATION_COLUMNS = ["nominal_mass_kg", "actual_mass_kg"]


class DataImporter:
    """数据导入器。

    负责从各种格式的文件中导入实验数据和标定数据，
    处理晚到附件的合并，以及重复数据的检测和去重。
    """

    def __init__(self):
        self.summary = ProcessingSummary()

    @wrap_technical_error(
        error_class=DataImportError,
        default_message="导入实验数据失败",
        default_suggestion="请检查文件格式是否正确，数据是否完整。",
    )
    def import_experiment_data(
        self,
        file_path: str,
        source: RecordSource = RecordSource.EXPERIMENT,
        is_late_attachment: bool = False,
    ) -> List[ExperimentRecord]:
        """导入实验数据。

        Args:
            file_path: 数据文件路径
            source: 数据来源
            is_late_attachment: 是否为晚到附件

        Returns:
            实验记录列表
        """
        path = Path(file_path)
        self._validate_file(path)

        df = self._read_file(path)
        self.summary.total_records_imported += len(df)

        df = self._normalize_columns(df, EXPERIMENT_COLUMN_MAPPING)
        self._check_required_columns(df, REQUIRED_EXPERIMENT_COLUMNS, path)

        records = []
        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                record = self._parse_experiment_row(row, row_num, path, source)
                records.append(record)
            except DataImportError:
                self.summary.invalid_records_dropped += 1
                raise

        if is_late_attachment:
            self.summary.late_attachments_merged += len(records)
            self.summary.warnings.append(
                f"已合并 {len(records)} 条晚到附件数据，请确认这些数据是否需要覆盖原有记录"
            )

        return records

    @wrap_technical_error(
        error_class=DataImportError,
        default_message="导入标定数据失败",
        default_suggestion="请检查标定表格式是否正确。",
    )
    def import_calibration_data(
        self,
        file_path: str,
        source: RecordSource = RecordSource.CALIBRATION,
    ) -> List[CalibrationRecord]:
        """导入标定数据。

        Args:
            file_path: 标定表文件路径
            source: 数据来源

        Returns:
            标定记录列表
        """
        path = Path(file_path)
        self._validate_file(path)

        df = self._read_file(path)
        self.summary.total_records_imported += len(df)

        df = self._normalize_columns(df, CALIBRATION_COLUMN_MAPPING)
        self._check_required_columns(df, REQUIRED_CALIBRATION_COLUMNS, path)

        records = []
        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                record = self._parse_calibration_row(row, row_num, path, source)
                records.append(record)
            except DataImportError:
                self.summary.invalid_records_dropped += 1
                raise

        return records

    def merge_late_attachments(
        self,
        existing_records: List[ExperimentRecord],
        late_records: List[ExperimentRecord],
    ) -> List[ExperimentRecord]:
        """合并晚到附件的数据。

        对于相同学生+相同质量点的数据，晚到附件会覆盖原有数据，
        并标记为人工更正状态。
        """
        merged = existing_records.copy()
        existing_keys = self._get_experiment_unique_keys(merged)

        for late_record in late_records:
            key = self._get_experiment_key(late_record)
            if key in existing_keys:
                existing_idx = existing_keys[key]
                old_record = merged[existing_idx]

                late_record.original_values = old_record.to_dict()
                late_record.status = DataStatus.MANUAL_CORRECTED
                late_record.manual_correction_reason = "晚到附件覆盖原有数据"
                late_record.source = RecordSource.LATE_ATTACHMENT
                late_record.record_id = old_record.record_id

                merged[existing_idx] = late_record
                self.summary.manual_corrections_applied += 1
            else:
                late_record.source = RecordSource.LATE_ATTACHMENT
                merged.append(late_record)
                existing_keys[key] = len(merged) - 1

        self.summary.warnings.append(
            f"晚到附件处理完成：覆盖 {self.summary.manual_corrections_applied} 条，新增 {len(late_records) - self.summary.manual_corrections_applied} 条"
        )

        return merged

    def remove_duplicates(
        self,
        records: List[ExperimentRecord],
        keep: str = "latest",
    ) -> List[ExperimentRecord]:
        """去除重复记录。

        Args:
            records: 实验记录列表
            keep: 保留策略，'latest' 保留最新的，'first' 保留最早的

        Returns:
            去重后的记录列表
        """
        if not records:
            return records

        unique_records: Dict[str, ExperimentRecord] = {}
        duplicate_info = []

        for record in records:
            key = self._get_experiment_key(record)

            if key in unique_records:
                existing = unique_records[key]

                dup_info = {
                    "mass": record.mass_kg,
                    "student": record.student_name or record.student_id,
                    "count": 2,
                }
                duplicate_info.append(dup_info)

                if keep == "latest":
                    if record.created_at >= existing.created_at:
                        record.status = DataStatus.CONFIRMED
                        existing.status = DataStatus.DUPLICATE
                        unique_records[key] = record
                    else:
                        record.status = DataStatus.DUPLICATE
                else:
                    if record.created_at <= existing.created_at:
                        record.status = DataStatus.CONFIRMED
                        existing.status = DataStatus.DUPLICATE
                        unique_records[key] = record
                    else:
                        record.status = DataStatus.DUPLICATE
            else:
                unique_records[key] = record

        if duplicate_info:
            self.summary.duplicate_records_removed += len(duplicate_info)
            self.summary.warnings.append(
                f"发现 {len(duplicate_info)} 组重复数据，已自动去重，保留 {keep == 'latest' and '最新' or '最早'} 的一条"
            )

        result = list(unique_records.values())
        return result

    def _validate_file(self, path: Path) -> None:
        """验证文件是否存在且格式支持。"""
        if not path.exists():
            raise DataImportError.file_not_found(str(path))

        if path.suffix.lower() not in SUPPORTED_FORMATS:
            raise DataImportError.unsupported_format(str(path), SUPPORTED_FORMATS)

    def _read_file(self, path: Path) -> pd.DataFrame:
        """读取文件为DataFrame。"""
        if path.stat().st_size == 0:
            raise DataImportError.empty_file(str(path))

        if path.suffix.lower() == ".csv":
            df = pd.read_csv(path, dtype=str)
        else:
            df = pd.read_excel(path, dtype=str)

        if df.empty:
            raise DataImportError.empty_file(str(path))

        df = df.dropna(how="all")
        return df

    def _normalize_columns(self, df: pd.DataFrame, mapping: Dict[str, str]) -> pd.DataFrame:
        """标准化列名。"""
        current_columns = list(df.columns)

        for col in current_columns:
            col_clean = str(col).strip()
            if col_clean in mapping:
                new_col = mapping[col_clean]
                if new_col != col_clean and new_col not in df.columns:
                    df = df.rename(columns={col: new_col})
                elif new_col in df.columns and col != new_col:
                    df[new_col] = df[new_col].fillna(df[col])
                    df = df.drop(columns=[col])

        return df

    def _check_required_columns(self, df: pd.DataFrame, required: List[str], path: Path) -> None:
        """检查必需列是否存在。"""
        available = list(df.columns)
        missing = [col for col in required if col not in available]

        if missing:
            raise DataImportError.missing_columns(str(path), missing, available)

    def _parse_experiment_row(
        self,
        row: pd.Series,
        row_num: int,
        path: Path,
        source: RecordSource,
    ) -> ExperimentRecord:
        """解析一行实验数据。"""
        record = ExperimentRecord(source=source)

        if "student_id" in row and pd.notna(row["student_id"]):
            record.student_id = str(row["student_id"]).strip()

        if "student_name" in row and pd.notna(row["student_name"]):
            record.student_name = str(row["student_name"]).strip()

        if "experiment_date" in row and pd.notna(row["experiment_date"]):
            date_str = str(row["experiment_date"]).strip()
            try:
                record.experiment_date = self._parse_date(date_str)
            except Exception:
                raise DataImportError.invalid_date(str(path), "experiment_date", row_num, date_str)

        try:
            mass_str = str(row["mass_kg"]).strip()
            record.mass_kg = self._parse_float(mass_str, "mass_kg", row_num, path)
        except DataImportError:
            raise

        try:
            period_str = str(row["period_s"]).strip()
            record.period_s = self._parse_float(period_str, "period_s", row_num, path)
        except DataImportError:
            raise

        if "amplitude_cm" in row and pd.notna(row["amplitude_cm"]):
            try:
                amp_str = str(row["amplitude_cm"]).strip()
                record.amplitude_cm = self._parse_float(amp_str, "amplitude_cm", row_num, path)
            except DataImportError:
                self.summary.warnings.append(f"第 {row_num} 行振幅数据无效，已忽略")

        if "spring_extension_mm" in row and pd.notna(row["spring_extension_mm"]):
            try:
                ext_str = str(row["spring_extension_mm"]).strip()
                record.spring_extension_mm = self._parse_float(ext_str, "spring_extension_mm", row_num, path)
            except DataImportError:
                self.summary.warnings.append(f"第 {row_num} 行伸长量数据无效，已忽略")

        if "notes" in row and pd.notna(row["notes"]):
            record.notes = str(row["notes"]).strip()

        if "status" in row and pd.notna(row["status"]):
            status_str = str(row["status"]).strip().lower()
            status_map = {
                "已确认": DataStatus.CONFIRMED,
                "confirmed": DataStatus.CONFIRMED,
                "待补": DataStatus.PENDING,
                "pending": DataStatus.PENDING,
                "人工更正": DataStatus.MANUAL_CORRECTED,
                "manual_corrected": DataStatus.MANUAL_CORRECTED,
            }
            if status_str in status_map:
                record.status = status_map[status_str]

        return record

    def _parse_calibration_row(
        self,
        row: pd.Series,
        row_num: int,
        path: Path,
        source: RecordSource,
    ) -> CalibrationRecord:
        """解析一行标定数据。"""
        record = CalibrationRecord(source=source)

        if "spring_id" in row and pd.notna(row["spring_id"]):
            record.spring_id = str(row["spring_id"]).strip()

        if "calibration_date" in row and pd.notna(row["calibration_date"]):
            date_str = str(row["calibration_date"]).strip()
            try:
                record.calibration_date = self._parse_date(date_str)
            except Exception:
                raise DataImportError.invalid_date(str(path), "calibration_date", row_num, date_str)

        try:
            nom_str = str(row["nominal_mass_kg"]).strip()
            record.nominal_mass_kg = self._parse_float(nom_str, "nominal_mass_kg", row_num, path)
        except DataImportError:
            raise

        try:
            actual_str = str(row["actual_mass_kg"]).strip()
            record.actual_mass_kg = self._parse_float(actual_str, "actual_mass_kg", row_num, path)
        except DataImportError:
            raise

        if "spring_constant_nm" in row and pd.notna(row["spring_constant_nm"]):
            try:
                k_str = str(row["spring_constant_nm"]).strip()
                record.spring_constant_nm = self._parse_float(k_str, "spring_constant_nm", row_num, path)
            except DataImportError:
                self.summary.warnings.append(f"第 {row_num} 行劲度系数数据无效，已忽略")

        if "notes" in row and pd.notna(row["notes"]):
            record.notes = str(row["notes"]).strip()

        return record

    def _parse_float(self, value: str, column: str, row_num: int, path: Path) -> float:
        """解析浮点数值。"""
        if not value or value.lower() in ["nan", "none", "null", "-"]:
            return 0.0

        cleaned = value.replace(",", "").replace("，", "").strip()

        try:
            return float(cleaned)
        except ValueError:
            raise DataImportError.invalid_number(str(path), column, row_num, value)

    def _parse_date(self, date_str: str) -> datetime:
        """解析日期字符串。"""
        date_str = date_str.strip()

        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y.%m.%d",
            "%Y年%m月%d日",
            "%m/%d/%Y",
            "%d/%m/%Y",
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue

        try:
            return pd.to_datetime(date_str).to_pydatetime()
        except Exception:
            raise ValueError(f"无法解析日期: {date_str}")

    def _get_experiment_key(self, record: ExperimentRecord) -> str:
        """生成实验记录的唯一键，用于去重。"""
        return f"{record.student_id}_{record.student_name}_{record.mass_kg:.4f}_{record.experiment_date}"

    def _get_experiment_unique_keys(self, records: List[ExperimentRecord]) -> Dict[str, int]:
        """获取现有记录的唯一键映射。"""
        keys = {}
        for idx, record in enumerate(records):
            key = self._get_experiment_key(record)
            keys[key] = idx
        return keys
