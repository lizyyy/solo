"""高层处理流程。

整合所有模块，提供统一的处理接口，
让一线同事可以一键完成从数据导入到批改表生成的全流程。
"""

from typing import List, Optional, Dict, Any
from pathlib import Path
from dataclasses import dataclass

from .models import (
    ExperimentRecord,
    CalibrationRecord,
    FitResult,
    DataGap,
    ProcessingSummary,
)
from .data_importer import DataImporter
from .data_cleaner import DataCleaner
from .gap_detector import GapDetector
from .fitting import SpringOscillatorFitter
from .report_generator import ReportGenerator
from .errors import SpringOscillatorError


@dataclass
class PipelineResult:
    """处理流程结果。

    包含所有中间结果和最终输出。
    """

    experiment_records: List[ExperimentRecord]
    calibration_records: Optional[List[CalibrationRecord]]
    cleaned_records: List[ExperimentRecord]
    valid_records: List[ExperimentRecord]
    fit_result: Optional[FitResult]
    data_gaps: List[DataGap]
    processing_summary: ProcessingSummary
    grading_report: Dict[str, Any]
    output_files: List[Path]


class SpringOscillatorPipeline:
    """弹簧振子数据处理主流程。

    整合数据导入、清洗、缺口检测、拟合、报告生成等步骤，
    提供一键式处理接口。
    """

    def __init__(
        self,
        output_dir: Optional[str] = None,
        config: Optional[Dict[str, Any]] = None,
    ):
        self.output_dir = Path(output_dir) if output_dir else Path.cwd() / "output"
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.importer = DataImporter()
        self.cleaner = DataCleaner(config)
        self.gap_detector = GapDetector()
        self.fitter = SpringOscillatorFitter()
        self.report_generator = ReportGenerator(self.output_dir)

        self.processing_summary = ProcessingSummary()
        self.data_gaps: List[DataGap] = []
        self.experiment_records: List[ExperimentRecord] = []
        self.calibration_records: Optional[List[CalibrationRecord]] = None
        self.cleaned_records: List[ExperimentRecord] = []
        self.valid_records: List[ExperimentRecord] = []
        self.fit_result: Optional[FitResult] = None
        self.grading_report: Dict[str, Any] = {}
        self.output_files: List[Path] = []

    def run(
        self,
        experiment_file: str,
        calibration_file: Optional[str] = None,
        late_attachment_files: Optional[List[str]] = None,
        fit_method: str = "nonlinear",
        student_name: str = "",
        student_id: str = "",
        export_formats: Optional[List[str]] = None,
    ) -> PipelineResult:
        """执行完整的数据处理流程。

        Args:
            experiment_file: 主实验数据文件路径
            calibration_file: 标定表文件路径（可选）
            late_attachment_files: 晚到附件文件列表（可选）
            fit_method: 拟合方法，'nonlinear' 或 'linear'
            student_name: 学生姓名
            student_id: 学号
            export_formats: 导出格式列表，默认 ['excel', 'json']

        Returns:
            处理结果对象
        """
        if export_formats is None:
            export_formats = ["excel", "json"]

        try:
            self.experiment_records = self._step1_import_experiment_data(
                experiment_file, late_attachment_files
            )

            self.calibration_records = None
            if calibration_file:
                self.calibration_records = self._step2_import_calibration_data(calibration_file)

            self.cleaned_records = self._step3_clean_data(
                self.experiment_records, self.calibration_records
            )

            self.data_gaps = self._step4_detect_gaps(self.cleaned_records, self.calibration_records)

            self.valid_records = self.cleaner.get_valid_records_for_fitting(self.cleaned_records)
            self.fit_result = self._step5_fit(self.valid_records, fit_method)

            self.processing_summary = self._merge_summaries()

            self.grading_report = self._step6_generate_report(
                self.cleaned_records,
                self.fit_result,
                self.processing_summary,
                self.data_gaps,
                self.calibration_records,
                student_name,
                student_id,
            )

            self.output_files = self._step7_export(
                self.grading_report, export_formats, student_id
            )

            return PipelineResult(
                experiment_records=self.experiment_records,
                calibration_records=self.calibration_records,
                cleaned_records=self.cleaned_records,
                valid_records=self.valid_records,
                fit_result=self.fit_result,
                data_gaps=self.data_gaps,
                processing_summary=self.processing_summary,
                grading_report=self.grading_report,
                output_files=self.output_files,
            )

        except SpringOscillatorError:
            raise
        except Exception as e:
            raise SpringOscillatorError(
                message="数据处理过程中发生未预期的错误",
                suggestion="请检查数据文件是否正确，或者联系技术支持。",
                original_error=e,
            )

    def _step1_import_experiment_data(
        self,
        experiment_file: str,
        late_attachment_files: Optional[List[str]],
    ) -> List[ExperimentRecord]:
        """步骤1：导入实验数据。"""
        print("\n📥 步骤1/7: 导入实验数据...")

        records = self.importer.import_experiment_data(experiment_file)
        print(f"   已导入 {len(records)} 条实验记录")

        if late_attachment_files:
            all_late_records = []
            for late_file in late_attachment_files:
                print(f"\n   正在合并晚到附件: {Path(late_file).name}")
                late_records = self.importer.import_experiment_data(
                    late_file, is_late_attachment=True
                )
                all_late_records.extend(late_records)

            if all_late_records:
                records = self.importer.merge_late_attachments(records, all_late_records)
                print(f"   已合并 {len(all_late_records)} 条晚到附件数据")

        records = self.importer.remove_duplicates(records)
        print(f"   去重后剩余 {len(records)} 条记录")

        return records

    def _step2_import_calibration_data(
        self,
        calibration_file: str,
    ) -> List[CalibrationRecord]:
        """步骤2：导入标定数据。"""
        print("\n📐 步骤2/7: 导入标定数据...")

        records = self.importer.import_calibration_data(calibration_file)
        print(f"   已导入 {len(records)} 条标定记录")

        return records

    def _step3_clean_data(
        self,
        experiment_records: List[ExperimentRecord],
        calibration_records: Optional[List[CalibrationRecord]],
    ) -> List[ExperimentRecord]:
        """步骤3：数据清洗。"""
        print("\n🧹 步骤3/7: 数据清洗...")

        cleaned = self.cleaner.clean_experiment_data(
            experiment_records, calibration_records
        )

        confirmed = sum(1 for r in cleaned if r.status.value == "confirmed")
        pending = sum(1 for r in cleaned if r.status.value == "pending")
        manual = sum(1 for r in cleaned if r.status.value == "manual_corrected")
        invalid = sum(1 for r in cleaned if r.status.value == "invalid")

        print(f"   已确认: {confirmed} 条")
        print(f"   待补: {pending} 条")
        print(f"   人工更正: {manual} 条")
        print(f"   无效: {invalid} 条")

        if self.cleaner.gaps:
            print(f"   检测到 {len(self.cleaner.gaps)} 个数据问题")

        return cleaned

    def _step4_detect_gaps(
        self,
        cleaned_records: List[ExperimentRecord],
        calibration_records: Optional[List[CalibrationRecord]],
    ) -> List[DataGap]:
        """步骤4：检测数据缺口。"""
        print("\n🔍 步骤4/7: 检测数据缺口...")

        all_gaps = self.gap_detector.detect_all_gaps(
            cleaned_records, calibration_records
        )

        all_gaps.extend(self.cleaner.gaps)

        print(f"   共检测到 {len(all_gaps)} 个数据缺口")
        if all_gaps:
            gap_report = self.gap_detector.generate_gap_report(all_gaps)
            print(gap_report["summary"])

        return all_gaps

    def _step5_fit(
        self,
        valid_records: List[ExperimentRecord],
        fit_method: str,
    ) -> FitResult:
        """步骤5：曲线拟合。"""
        print("\n📈 步骤5/7: 曲线拟合...")
        print(f"   使用 {len(valid_records)} 条有效记录进行拟合")

        fit_result = self.fitter.fit(valid_records, method=fit_method)

        print(f"   弹簧劲度系数 k = {fit_result.spring_constant_k:.3f} ± "
              f"{fit_result.spring_constant_uncertainty:.3f} N/m")
        print(f"   等效质量 m₀ = {fit_result.equivalent_mass_kg * 1000:.2f} ± "
              f"{fit_result.equivalent_mass_uncertainty * 1000:.2f} g")
        print(f"   R² = {fit_result.r_squared:.6f}")

        return fit_result

    def _step6_generate_report(
        self,
        cleaned_records: List[ExperimentRecord],
        fit_result: FitResult,
        merged_summary: ProcessingSummary,
        data_gaps: List[DataGap],
        calibration_records: Optional[List[CalibrationRecord]],
        student_name: str,
        student_id: str,
    ) -> Dict[str, Any]:
        """步骤6：生成批改报告。"""
        print("\n📊 步骤6/7: 生成批改报告...")

        report = self.report_generator.generate_grading_report(
            experiment_records=cleaned_records,
            fit_result=fit_result,
            processing_summary=merged_summary,
            gaps=data_gaps,
            calibration_records=calibration_records,
            student_name=student_name,
            student_id=student_id,
        )

        print("   报告生成完成")
        return report

    def _step7_export(
        self,
        report: Dict[str, Any],
        export_formats: List[str],
        student_id: str,
    ) -> List[Path]:
        """步骤7：导出报告。"""
        print("\n💾 步骤7/7: 导出报告...")

        output_files = []
        prefix = f"student_{student_id}" if student_id else "spring_oscillator"

        if "excel" in export_formats:
            excel_path = self.report_generator.export_to_excel(
                report, filename=f"{prefix}_grading_report.xlsx"
            )
            output_files.append(excel_path)
            print(f"   Excel报告: {excel_path}")

        if "csv" in export_formats:
            csv_paths = self.report_generator.export_to_csv(report, prefix=prefix)
            output_files.extend(csv_paths)
            print(f"   CSV文件: {len(csv_paths)} 个")

        if "json" in export_formats:
            json_path = self.report_generator.export_to_json(
                report, filename=f"{prefix}_grading_report.json"
            )
            output_files.append(json_path)
            print(f"   JSON报告: {json_path}")

        return output_files

    def _merge_summaries(self) -> ProcessingSummary:
        """合并所有模块的处理摘要。"""
        merged = ProcessingSummary()

        importer_sum = self.importer.summary
        cleaner_sum = self.cleaner.summary
        gap_sum = self.gap_detector.summary
        fitter_sum = self.fitter.summary

        merged.total_records_imported = importer_sum.total_records_imported
        merged.duplicate_records_removed = importer_sum.duplicate_records_removed
        merged.late_attachments_merged = importer_sum.late_attachments_merged
        merged.manual_corrections_applied = (
            importer_sum.manual_corrections_applied + cleaner_sum.manual_corrections_applied
        )
        merged.invalid_records_dropped = (
            importer_sum.invalid_records_dropped + cleaner_sum.invalid_records_dropped
        )
        merged.confirmed_records = cleaner_sum.confirmed_records
        merged.pending_records = cleaner_sum.pending_records
        merged.data_gaps_found = (
            gap_sum.data_gaps_found + len(self.cleaner.gaps)
        )
        merged.records_used_for_fitting = cleaner_sum.records_used_for_fitting
        merged.processing_policy = cleaner_sum.processing_policy

        merged.warnings.extend(importer_sum.warnings)
        merged.warnings.extend(cleaner_sum.warnings)
        merged.warnings.extend(gap_sum.warnings)
        merged.warnings.extend(fitter_sum.warnings)

        merged.errors.extend(importer_sum.errors)
        merged.errors.extend(cleaner_sum.errors)
        merged.errors.extend(gap_sum.errors)
        merged.errors.extend(fitter_sum.errors)

        return merged

    def print_summary(self, result: PipelineResult) -> None:
        """打印处理结果摘要。"""
        print("\n" + "=" * 60)
        print("✅ 数据处理完成！")
        print("=" * 60)

        self.report_generator.print_console_report(result.grading_report)

        if result.output_files:
            print("📁 输出文件:")
            for f in result.output_files:
                print(f"   - {f}")

        print("=" * 60 + "\n")
