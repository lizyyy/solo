"""采样缺口检测与溯源。

检测数据中的采样缺口，区分缺口来源（实验记录/标定表），
并提供明确的补数据责任人和下一步操作指引。
"""

from typing import List, Set, Dict, Any, Optional, Tuple
from collections import defaultdict
import numpy as np

from .models import (
    ExperimentRecord,
    CalibrationRecord,
    DataStatus,
    RecordSource,
    DataGap,
    GapType,
    ProcessingSummary,
)


EXPECTED_MASS_POINTS = [0.05, 0.10, 0.15, 0.20, 0.25, 0.30, 0.35]


class GapDetector:
    """数据缺口检测器。

    负责检测实验数据和标定数据中的缺口，
    并生成详细的缺口报告，包含责任人和下一步操作。
    """

    def __init__(
        self,
        expected_mass_points: Optional[List[float]] = None,
        mass_tolerance: float = 0.005,
    ):
        self.expected_mass_points = expected_mass_points or EXPECTED_MASS_POINTS
        self.mass_tolerance = mass_tolerance
        self.summary = ProcessingSummary()

    def detect_all_gaps(
        self,
        experiment_records: List[ExperimentRecord],
        calibration_records: Optional[List[CalibrationRecord]] = None,
    ) -> List[DataGap]:
        """检测所有类型的数据缺口。

        Args:
            experiment_records: 实验记录列表
            calibration_records: 标定记录列表（可选）

        Returns:
            数据缺口列表
        """
        all_gaps: List[DataGap] = []

        experiment_gaps = self.detect_experiment_gaps(experiment_records)
        all_gaps.extend(experiment_gaps)

        if calibration_records:
            calibration_gaps = self.detect_calibration_gaps(calibration_records, experiment_records)
            all_gaps.extend(calibration_gaps)

        self.summary.data_gaps_found = len(all_gaps)

        return all_gaps

    def detect_experiment_gaps(
        self,
        records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """检测实验记录中的缺口。

        Args:
            records: 实验记录列表

        Returns:
            数据缺口列表
        """
        gaps: List[DataGap] = []

        valid_records = [
            r for r in records
            if r.status not in [DataStatus.INVALID, DataStatus.DUPLICATE]
        ]

        if not valid_records:
            gap = DataGap(
                gap_type=GapType.MISSING_EXPERIMENT_DATA,
                source=RecordSource.EXPERIMENT,
                description="没有有效的实验记录，请检查数据导入是否正确",
                severity="error",
            )
            gaps.append(gap)
            return gaps

        gaps.extend(self._detect_mass_point_gaps(valid_records))
        gaps.extend(self._detect_pending_records_gaps(valid_records))
        gaps.extend(self._detect_student_missing_data(valid_records))

        return gaps

    def detect_calibration_gaps(
        self,
        calibration_records: List[CalibrationRecord],
        experiment_records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """检测标定数据中的缺口。

        Args:
            calibration_records: 标定记录列表
            experiment_records: 实验记录列表（用于比对）

        Returns:
            数据缺口列表
        """
        gaps: List[DataGap] = []

        valid_calibration = [
            c for c in calibration_records
            if c.status != DataStatus.INVALID
        ]

        if not valid_calibration:
            gap = DataGap(
                gap_type=GapType.MISSING_CALIBRATION_DATA,
                source=RecordSource.CALIBRATION,
                description="没有有效的标定数据，请检查标定表是否正确导入",
                severity="warning",
            )
            gaps.append(gap)
            return gaps

        gaps.extend(self._detect_calibration_mass_gaps(valid_calibration, experiment_records))

        return gaps

    def _detect_mass_point_gaps(
        self,
        records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """检测质量点采样缺口。

        检查是否缺少预期的质量点。
        """
        gaps: List[DataGap] = []

        present_masses: Set[float] = set()
        for record in records:
            if record.mass_kg > 0 and record.period_s > 0:
                rounded_mass = self._round_mass(record.mass_kg)
                present_masses.add(rounded_mass)

        missing_masses = []
        for expected in self.expected_mass_points:
            found = False
            for present in present_masses:
                if abs(present - expected) < self.mass_tolerance:
                    found = True
                    break
            if not found:
                missing_masses.append(expected)

        if missing_masses:
            missing_record_ids = [
                r.record_id for r in records
                if r.status == DataStatus.PENDING
                and any(abs(r.mass_kg - m) < self.mass_tolerance for m in missing_masses)
            ]

            gap = DataGap(
                gap_type=GapType.MASS_POINT_GAP,
                source=RecordSource.EXPERIMENT,
                description=f"缺少 {len(missing_masses)} 个质量点的测量数据："
                + ", ".join([f"{m}kg" for m in sorted(missing_masses)]),
                affected_mass_points=sorted(missing_masses),
                missing_record_ids=missing_record_ids,
                severity="warning",
            )
            gaps.append(gap)

        return gaps

    def _detect_pending_records_gaps(
        self,
        records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """检测待补记录对应的缺口。"""
        gaps: List[DataGap] = []

        pending_records = [r for r in records if r.status == DataStatus.PENDING]

        if not pending_records:
            return gaps

        pending_by_student = defaultdict(list)
        for record in pending_records:
            key = f"{record.student_id}_{record.student_name}"
            pending_by_student[key].append(record)

        for student_key, pending_list in pending_by_student.items():
            missing_masses = sorted(set([r.mass_kg for r in pending_list if r.mass_kg > 0]))
            missing_ids = [r.record_id for r in pending_list]

            if missing_masses:
                student_name = pending_list[0].student_name or pending_list[0].student_id
                gap = DataGap(
                    gap_type=GapType.MISSING_EXPERIMENT_DATA,
                    source=pending_list[0].source,
                    description=f"学生 {student_name} 有 {len(pending_list)} 条记录待确认，"
                    f"涉及质量点：{', '.join([f'{m}kg' for m in missing_masses])}",
                    affected_mass_points=missing_masses,
                    missing_record_ids=missing_ids,
                    severity="warning",
                )
                gaps.append(gap)

        return gaps

    def _detect_student_missing_data(
        self,
        records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """按学生分组检测数据完整性。"""
        gaps: List[DataGap] = []

        records_by_student = defaultdict(list)
        for record in records:
            key = f"{record.student_id}_{record.student_name}"
            records_by_student[key].append(record)

        for student_key, student_records in records_by_student.items():
            if not student_records:
                continue

            valid_records = [
                r for r in student_records
                if r.status in [DataStatus.CONFIRMED, DataStatus.MANUAL_CORRECTED]
                and r.mass_kg > 0
                and r.period_s > 0
            ]

            student_name = student_records[0].student_name or student_records[0].student_id
            unique_masses = sorted(set([r.mass_kg for r in valid_records]))

            if len(unique_masses) < 5:
                missing_expected = []
                for expected in self.expected_mass_points:
                    found = False
                    for present in unique_masses:
                        if abs(present - expected) < self.mass_tolerance:
                            found = True
                            break
                    if not found:
                        missing_expected.append(expected)

                if missing_expected:
                    gap = DataGap(
                        gap_type=GapType.MASS_POINT_GAP,
                        source=RecordSource.EXPERIMENT,
                        description=f"学生 {student_name} 的有效质量点只有 {len(unique_masses)} 个，"
                        f"建议至少5个。缺少：{', '.join([f'{m}kg' for m in missing_expected])}",
                        affected_mass_points=sorted(set(unique_masses + missing_expected)),
                        severity="info",
                    )
                    gaps.append(gap)

        return gaps

    def _detect_calibration_mass_gaps(
        self,
        calibration_records: List[CalibrationRecord],
        experiment_records: List[ExperimentRecord],
    ) -> List[DataGap]:
        """检测标定数据中缺失的质量点。

        检查实验用到的质量点是否都有对应的标定数据。
        """
        gaps: List[DataGap] = []

        experiment_masses: Set[float] = set()
        for record in experiment_records:
            if record.mass_kg > 0 and record.status != DataStatus.INVALID:
                rounded_mass = self._round_mass(record.mass_kg)
                experiment_masses.add(rounded_mass)

        calibration_masses: Set[float] = set()
        for cal in calibration_records:
            if cal.nominal_mass_kg > 0:
                rounded_mass = self._round_mass(cal.nominal_mass_kg)
                calibration_masses.add(rounded_mass)

        missing_calibration = []
        for exp_mass in experiment_masses:
            found = False
            for cal_mass in calibration_masses:
                if abs(cal_mass - exp_mass) < self.mass_tolerance:
                    found = True
                    break
            if not found:
                missing_calibration.append(exp_mass)

        if missing_calibration:
            missing_ids = [
                c.record_id for c in calibration_records
                if c.status == DataStatus.INVALID
            ]

            gap = DataGap(
                gap_type=GapType.MISSING_CALIBRATION_DATA,
                source=RecordSource.CALIBRATION,
                description=f"实验用到的 {len(missing_calibration)} 个质量点缺少标定数据："
                + ", ".join([f"{m}kg" for m in sorted(missing_calibration)]),
                affected_mass_points=sorted(missing_calibration),
                missing_record_ids=missing_ids,
                severity="warning",
            )
            gaps.append(gap)

        return gaps

    def _round_mass(self, mass: float) -> float:
        """将质量四舍五入到最近的标准质量点。"""
        if not self.expected_mass_points:
            return round(mass, 3)

        closest = min(self.expected_mass_points, key=lambda x: abs(x - mass))
        if abs(closest - mass) < self.mass_tolerance:
            return closest
        return round(mass, 3)

    def generate_gap_report(self, gaps: List[DataGap]) -> Dict[str, Any]:
        """生成缺口汇总报告。

        Args:
            gaps: 数据缺口列表

        Returns:
            包含缺口汇总信息的字典
        """
        by_type: Dict[str, List[DataGap]] = defaultdict(list)
        by_source: Dict[str, List[DataGap]] = defaultdict(list)
        by_severity: Dict[str, List[DataGap]] = defaultdict(list)

        for gap in gaps:
            by_type[gap.gap_type.value].append(gap)
            by_source[gap.source.value].append(gap)
            by_severity[gap.severity].append(gap)

        report = {
            "total_gaps": len(gaps),
            "by_type": {
                gap_type: {
                    "count": len(gap_list),
                    "display_name": gap_list[0].gap_type.display_name if gap_list else gap_type,
                }
                for gap_type, gap_list in by_type.items()
            },
            "by_source": {
                source: {
                    "count": len(gap_list),
                    "display_name": gap_list[0].source.display_name if gap_list else source,
                }
                for source, gap_list in by_source.items()
            },
            "by_severity": {
                severity: len(gap_list)
                for severity, gap_list in by_severity.items()
            },
            "details": [gap.to_dict() for gap in gaps],
            "summary": self._generate_summary_text(gaps),
        }

        return report

    def _generate_summary_text(self, gaps: List[DataGap]) -> str:
        """生成缺口的文字总结。"""
        if not gaps:
            return "✅ 数据完整，未检测到明显缺口。"

        parts = [f"⚠️ 共检测到 {len(gaps)} 个数据缺口：\n"]

        error_count = sum(1 for g in gaps if g.severity == "error")
        warning_count = sum(1 for g in gaps if g.severity == "warning")
        info_count = sum(1 for g in gaps if g.severity == "info")

        if error_count:
            parts.append(f"   ❌ 严重问题 {error_count} 个，需要立即处理")
        if warning_count:
            parts.append(f"   ⚠️ 警告 {warning_count} 个，建议补充数据")
        if info_count:
            parts.append(f"   ℹ️ 提示 {info_count} 个，可选择性处理")

        parts.append("\n📋 缺口详情及下一步：")
        for i, gap in enumerate(gaps, 1):
            parts.append(f"\n   {i}. [{gap.severity.upper()}] {gap.gap_type.display_name}")
            parts.append(f"      来源：{gap.source.display_name}")
            parts.append(f"      说明：{gap.description}")
            parts.append(f"      责任人：{gap.responsible_person}")
            parts.append(f"      下一步：{gap.next_step}")

        return "\n".join(parts)
