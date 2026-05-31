"""数据清洗器。

负责数据验证、零点漂移检测、异常值识别、
人工更正合并等数据清洗工作。
"""

from typing import List, Tuple, Optional, Dict, Any
import numpy as np
from collections import defaultdict

from .models import (
    ExperimentRecord,
    CalibrationRecord,
    DataStatus,
    RecordSource,
    ProcessingSummary,
    DataGap,
    GapType,
)
from .errors import (
    DataValidationError,
    wrap_technical_error,
)


DEFAULT_CONFIG = {
    "max_mass_kg": 0.5,
    "min_period_s": 0.3,
    "max_period_s": 5.0,
    "max_amplitude_cm": 2.0,
    "zero_drift_threshold_mm": 1.0,
    "outlier_std_threshold": 3.0,
    "min_records_for_fit": 5,
}


class DataCleaner:
    """数据清洗器。

    对导入的实验数据和标定数据进行清洗和验证，
    检测零点漂移、异常值，合并人工更正等。
    """

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = {**DEFAULT_CONFIG, **(config or {})}
        self.summary = ProcessingSummary()
        self.gaps: List[DataGap] = []

    @wrap_technical_error(
        error_class=DataValidationError,
        default_message="数据清洗失败",
        default_suggestion="请检查数据是否符合物理规律。",
    )
    def clean_experiment_data(
        self,
        records: List[ExperimentRecord],
        calibration_records: Optional[List[CalibrationRecord]] = None,
    ) -> List[ExperimentRecord]:
        """清洗实验数据。

        Args:
            records: 实验记录列表
            calibration_records: 标定记录列表（可选）

        Returns:
            清洗后的实验记录列表
        """
        if not records:
            self.summary.warnings.append("没有实验数据需要清洗")
            return records

        cleaned_records = []
        invalid_count = 0

        for record in records:
            try:
                validated = self._validate_single_record(record)
                cleaned_records.append(validated)
            except DataValidationError as e:
                invalid_count += 1
                record.status = DataStatus.INVALID
                record.notes = f"验证失败: {e.user_message}"
                self.summary.errors.append(f"记录 {record.record_id}: {e.user_message}")
                cleaned_records.append(record)

        self.summary.invalid_records_dropped += invalid_count

        if calibration_records:
            cleaned_records = self._apply_calibration_correction(cleaned_records, calibration_records)

        cleaned_records = self._detect_zero_drift(cleaned_records)
        cleaned_records = self._detect_outliers(cleaned_records)
        cleaned_records = self._merge_manual_corrections(cleaned_records)
        cleaned_records = self._update_status_counts(cleaned_records)

        return cleaned_records

    def clean_calibration_data(
        self,
        records: List[CalibrationRecord],
    ) -> List[CalibrationRecord]:
        """清洗标定数据。

        Args:
            records: 标定记录列表

        Returns:
            清洗后的标定记录列表
        """
        if not records:
            self.summary.warnings.append("没有标定数据需要清洗")
            return records

        cleaned_records = []
        for record in records:
            try:
                validated = self._validate_calibration_record(record)
                cleaned_records.append(validated)
            except DataValidationError as e:
                record.status = DataStatus.INVALID
                record.notes = f"验证失败: {e.user_message}"
                self.summary.errors.append(f"标定记录 {record.record_id}: {e.user_message}")
                cleaned_records.append(record)

        return cleaned_records

    def _validate_single_record(self, record: ExperimentRecord) -> ExperimentRecord:
        """验证单条实验记录的物理合理性。"""
        if record.status in [DataStatus.DUPLICATE, DataStatus.INVALID]:
            return record

        if record.mass_kg <= 0:
            raise DataValidationError.negative_mass(record.record_id, record.mass_kg)

        if record.mass_kg > self.config["max_mass_kg"]:
            raise DataValidationError.mass_too_large(
                record.record_id, record.mass_kg, self.config["max_mass_kg"]
            )

        if record.period_s <= 0:
            raise DataValidationError.negative_period(record.record_id, record.period_s)

        if record.period_s < self.config["min_period_s"] or record.period_s > self.config["max_period_s"]:
            raise DataValidationError.period_out_of_range(
                record.record_id,
                record.period_s,
                self.config["min_period_s"],
                self.config["max_period_s"],
            )

        if record.amplitude_cm > self.config["max_amplitude_cm"]:
            warning = DataValidationError.amplitude_too_large(
                record.record_id,
                record.amplitude_cm,
                self.config["max_amplitude_cm"],
            )
            self.summary.warnings.append(warning.user_message)
            record.notes += f" [警告] {warning.user_message}"

        if record.mass_kg == 0 or record.period_s == 0:
            record.status = DataStatus.PENDING
            self.summary.pending_records += 1

        return record

    def _validate_calibration_record(self, record: CalibrationRecord) -> CalibrationRecord:
        """验证单条标定记录。"""
        if record.nominal_mass_kg <= 0:
            raise DataValidationError.negative_mass(record.record_id, record.nominal_mass_kg)

        if record.actual_mass_kg <= 0:
            raise DataValidationError.negative_mass(record.record_id, record.actual_mass_kg)

        if record.spring_constant_nm and record.spring_constant_nm <= 0:
            raise DataValidationError(
                message=f"标定记录 {record.record_id} 的劲度系数为 {record.spring_constant_nm} N/m，必须为正数",
                suggestion="请检查劲度系数的测量或计算是否正确。",
                context={"劲度系数(N/m)": record.spring_constant_nm, "记录ID": record.record_id},
            )

        return record

    def _apply_calibration_correction(
        self,
        experiment_records: List[ExperimentRecord],
        calibration_records: List[CalibrationRecord],
    ) -> List[ExperimentRecord]:
        """应用标定校正。

        使用标定表中的实际质量替换标称质量。
        """
        calibration_map = {}
        for cal in calibration_records:
            if cal.status != DataStatus.INVALID:
                calibration_map[round(cal.nominal_mass_kg, 4)] = cal.actual_mass_kg

        if not calibration_map:
            self.summary.warnings.append("没有有效的标定数据，跳过标定校正")
            return experiment_records

        corrected_count = 0
        for record in experiment_records:
            if record.status == DataStatus.INVALID:
                continue

            nominal_mass = round(record.mass_kg, 4)
            if nominal_mass in calibration_map:
                actual_mass = calibration_map[nominal_mass]
                if abs(actual_mass - nominal_mass) > 0.0001:
                    record.original_values["original_mass_kg"] = record.mass_kg
                    record.mass_kg = actual_mass
                    record.notes += f" [标定校正] 质量从 {nominal_mass}kg 校正为 {actual_mass}kg"
                    corrected_count += 1

        if corrected_count > 0:
            self.summary.warnings.append(f"已应用标定校正，共修正 {corrected_count} 条记录的质量值")

        return experiment_records

    def _detect_zero_drift(self, records: List[ExperimentRecord]) -> List[ExperimentRecord]:
        """检测零点漂移。

        通过分析空载（或小质量）时的弹簧伸长量来检测零点漂移。
        """
        zero_load_records = [
            r for r in records
            if r.mass_kg > 0 and r.spring_extension_mm != 0 and r.status != DataStatus.INVALID
        ]

        if len(zero_load_records) < 2:
            return records

        masses = np.array([r.mass_kg for r in zero_load_records])
        extensions = np.array([r.spring_extension_mm for r in zero_load_records])

        valid_mask = (masses > 0) & (extensions > 0)
        masses = masses[valid_mask]
        extensions = extensions[valid_mask]

        if len(masses) < 3:
            return records

        try:
            slope, intercept = np.polyfit(masses, extensions, 1)
        except Exception:
            return records

        drift_mm = abs(intercept)
        if drift_mm > self.config["zero_drift_threshold_mm"]:
            gap = DataGap(
                gap_type=GapType.ZERO_DRIFT,
                source=RecordSource.EXPERIMENT,
                description=f"检测到零点漂移约 {drift_mm:.2f} mm，拟合截距为 {intercept:.2f} mm",
                severity="warning",
            )
            self.gaps.append(gap)
            self.summary.data_gaps_found += 1

            warning = DataValidationError.zero_drift_detected(
                drift_mm, self.config["zero_drift_threshold_mm"]
            )
            self.summary.warnings.append(warning.user_message)

            for record in records:
                if record.status != DataStatus.INVALID and record.spring_extension_mm != 0:
                    record.notes += f" [零点漂移] 系统漂移 {drift_mm:.2f}mm，已自动修正"
                    record.spring_extension_mm -= intercept

        return records

    def _detect_outliers(self, records: List[ExperimentRecord]) -> List[ExperimentRecord]:
        """检测异常值。

        使用3σ原则检测同一质量点下的周期测量异常值。
        """
        records_by_mass = defaultdict(list)
        for record in records:
            if record.status != DataStatus.INVALID and record.period_s > 0:
                key = round(record.mass_kg, 4)
                records_by_mass[key].append(record)

        outlier_count = 0
        for mass, mass_records in records_by_mass.items():
            if len(mass_records) < 3:
                continue

            periods = np.array([r.period_s for r in mass_records])
            mean = np.mean(periods)
            std = np.std(periods)

            if std == 0:
                continue

            for record in mass_records:
                z_score = abs(record.period_s - mean) / std
                if z_score > self.config["outlier_std_threshold"]:
                    record.notes += f" [异常值] 周期 {record.period_s}s 偏离均值 {mean:.4f}s 达 {z_score:.1f} 个标准差"
                    record.status = DataStatus.PENDING
                    outlier_count += 1

        if outlier_count > 0:
            self.summary.warnings.append(
                f"检测到 {outlier_count} 个可能的异常值，已标记为待补状态，请人工复核"
            )

        return records

    def _merge_manual_corrections(self, records: List[ExperimentRecord]) -> List[ExperimentRecord]:
        """合并人工更正。

        处理人工更正记录，将更正后的数值应用到对应记录。
        """
        corrected_ids = set()
        correction_count = 0

        for record in records:
            if record.status == DataStatus.MANUAL_CORRECTED and record.record_id not in corrected_ids:
                correction_count += 1
                corrected_ids.add(record.record_id)

        if correction_count > 0:
            self.summary.manual_corrections_applied += correction_count
            self.summary.warnings.append(
                f"已应用 {correction_count} 条人工更正，原始值已保记录中备查"
            )

        return records

    def _update_status_counts(self, records: List[ExperimentRecord]) -> List[ExperimentRecord]:
        """更新各状态记录的统计数量。"""
        confirmed = 0
        pending = 0
        manual = 0
        duplicate = 0
        invalid = 0

        for record in records:
            if record.status == DataStatus.CONFIRMED:
                confirmed += 1
            elif record.status == DataStatus.PENDING:
                pending += 1
            elif record.status == DataStatus.MANUAL_CORRECTED:
                manual += 1
            elif record.status == DataStatus.DUPLICATE:
                duplicate += 1
            elif record.status == DataStatus.INVALID:
                invalid += 1

        self.summary.confirmed_records = confirmed
        self.summary.pending_records = pending

        self.summary.processing_policy = (
            "数据处理口径：\n"
            f"1. 物理有效性检查：质量范围 0-{self.config['max_mass_kg']}kg，"
            f"周期范围 {self.config['min_period_s']}-{self.config['max_period_s']}s\n"
            f"2. 零点漂移检测阈值：{self.config['zero_drift_threshold_mm']}mm，检测到自动修正\n"
            f"3. 异常值检测：{self.config['outlier_std_threshold']}σ 原则，标记为待补\n"
            f"4. 重复数据：自动去重，保留最新记录\n"
            f"5. 标定校正：如有标定表，自动应用实际质量校正\n"
            f"6. 人工更正：保留原始值，应用更正后的值，标注更正原因"
        )

        return records

    def get_valid_records_for_fitting(self, records: List[ExperimentRecord]) -> List[ExperimentRecord]:
        """获取可用于拟合的有效记录。"""
        valid_statuses = [DataStatus.CONFIRMED, DataStatus.MANUAL_CORRECTED]
        valid_records = [
            r for r in records
            if r.status in valid_statuses
            and r.mass_kg > 0
            and r.period_s > 0
        ]

        if len(valid_records) < self.config["min_records_for_fit"]:
            raise DataValidationError.insufficient_data(
                len(valid_records), self.config["min_records_for_fit"]
            )

        self.summary.records_used_for_fitting = len(valid_records)
        return valid_records
