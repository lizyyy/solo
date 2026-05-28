#!/usr/bin/env python3

import os
import sys
from typing import Optional
from datetime import datetime

from models import (
    StudentRecord,
    GratingConstant,
    ScreenDistance,
    FringePosition,
    ExperimentReport,
    SourceType,
    AngleUnit,
)
import diffraction
import error_propagation
import anomaly_detector
import visualization
import report_generator


def create_sample_student_record(
    student_name: str = "张三",
    student_id: str = "2024001001",
    has_anomaly: bool = False,
) -> StudentRecord:
    """创建示例学生记录"""
    record = StudentRecord(
        student_id=student_id,
        student_name=student_name,
        experiment_name="光栅衍射测波长",
        source_type=SourceType.STUDENT_INPUT,
        notes="示例学生实验记录",
    )

    record.grating_constant = GratingConstant(
        value=1.0 / 300 * 1e-3,
        unit="m",
        uncertainty=1.0 / 300 * 1e-3 * 0.001,
        source_type=SourceType.REFERENCE,
        notes="300线/mm光栅，光栅常数 d = 1/300 mm",
    )

    record.screen_distance = ScreenDistance(
        value=1.500,
        unit="m",
        uncertainty=0.002,
        source_type=SourceType.MEASURED,
        notes="光栅到屏幕距离 L = 1.500 m",
    )

    record.reference_wavelength = 546.1e-9
    record.reference_wavelength_unit = "m"

    center_fringe = FringePosition(
        order=0,
        side="center",
        position=0.0,
        unit="m",
        uncertainty=0.0005,
        source_type=SourceType.MEASURED,
    )
    record.add_fringe(center_fringe)

    if has_anomaly:
        fringe_k1_left = FringePosition(
            order=-1,
            side="left",
            position=-0.0825,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k1_right = FringePosition(
            order=2,
            side="right",
            position=0.0825,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k2_left = FringePosition(
            order=-2,
            side="left",
            position=-0.1670,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k2_right = FringePosition(
            order=2,
            side="right",
            position=0.1670,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
    else:
        fringe_k1_left = FringePosition(
            order=-1,
            side="left",
            position=-0.0825,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k1_right = FringePosition(
            order=1,
            side="right",
            position=0.0820,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k2_left = FringePosition(
            order=-2,
            side="left",
            position=-0.1670,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )
        fringe_k2_right = FringePosition(
            order=2,
            side="right",
            position=0.1665,
            unit="m",
            uncertainty=0.0005,
            source_type=SourceType.MEASURED,
        )

    record.add_fringe(fringe_k1_left)
    record.add_fringe(fringe_k1_right)
    record.add_fringe(fringe_k2_left)
    record.add_fringe(fringe_k2_right)

    return record


def analyze_student_record(
    student_record: StudentRecord,
    output_dir: str = "output",
    expected_max_order: int = 3,
) -> ExperimentReport:
    """
    完整的学生实验记录分析流程

    步骤:
    1. 衍射计算 - 从条纹位置反推波长
    2. 误差传播 - 计算各测量量的不确定度传播
    3. 异常检测 - 检测级次混淆、角度单位错、条纹缺失等问题
    4. 可视化 - 生成分析图表
    5. 报告生成 - 输出完整分析报告
    """

    print(f"\n{'='*60}")
    print(f"开始分析: {student_record.student_name} ({student_record.student_id})")
    print(f"{'='*60}")

    report = ExperimentReport(
        student_record_id=student_record.source_id,
        source_type=SourceType.CALCULATED,
        parent_ids=[student_record.source_id],
        notes=f"{student_record.experiment_name} 完整分析报告",
    )

    print("\n[步骤 1/5] 衍射计算...")
    diff_step = diffraction.create_diffraction_step(student_record)
    report.steps.append(diff_step)

    def run_diffraction(input_data):
        results, traces = diffraction.calculate_wavelengths(
            student_record, parent_step_id=diff_step.source_id
        )
        return {"wavelength_results": results, "traces": traces}

    diff_output = diff_step.execute(run_diffraction)
    wavelength_results = diff_output["wavelength_results"]
    report.wavelength_results = wavelength_results

    print(f"  ✓ 计算完成，得到 {len(wavelength_results)} 个波长结果")
    for r in wavelength_results:
        print(f"    - k={r.order}: {r.value*1e9:.3f} nm")

    print("\n[步骤 2/5] 误差传播分析...")
    err_step = error_propagation.create_error_propagation_step(
        student_record, wavelength_results
    )
    report.steps.append(err_step)

    def run_error_propagation(input_data):
        updated_results, traces = error_propagation.propagate_uncertainties(
            student_record, wavelength_results, parent_step_id=err_step.source_id
        )
        final_unc, final_trace = error_propagation.calculate_final_uncertainty(
            updated_results
        )
        return {
            "updated_results": updated_results,
            "traces": traces,
            "final_uncertainty": final_unc,
            "final_trace": final_trace,
        }

    err_output = err_step.execute(run_error_propagation)
    wavelength_results = err_output["updated_results"]
    report.wavelength_results = wavelength_results

    values = [r.value for r in wavelength_results]
    uncertainties = [r.uncertainty for r in wavelength_results]
    weights = [1.0 / (u * u) if u > 0 else 1.0 for u in uncertainties]
    total_weight = sum(weights)
    normalized_weights = [w / total_weight for w in weights]
    final_wavelength = sum(w * v for w, v in zip(normalized_weights, values))
    final_uncertainty = err_output["final_uncertainty"]

    report.final_wavelength = final_wavelength
    report.final_uncertainty = final_uncertainty

    if student_record.reference_wavelength:
        report.relative_error = (
            (final_wavelength - student_record.reference_wavelength)
            / student_record.reference_wavelength
            * 100
        )

    print(f"  ✓ 误差传播完成")
    print(f"    最终结果: {final_wavelength*1e9:.3f} ± {final_uncertainty*1e9:.3f} nm")
    if report.relative_error is not None:
        print(f"    与参考值相对误差: {report.relative_error:+.2f}%")

    print("\n[步骤 3/5] 异常检测...")
    anomaly_step = anomaly_detector.create_anomaly_detection_step(
        student_record, wavelength_results
    )
    report.steps.append(anomaly_step)

    def run_anomaly_detection(input_data):
        anomalies, trace = anomaly_detector.detect_all_anomalies(
            student_record, wavelength_results, expected_max_order=expected_max_order
        )
        return {"anomalies": anomalies, "trace": trace}

    anomaly_output = anomaly_step.execute(run_anomaly_detection)
    report.anomalies = anomaly_output["anomalies"]

    error_count = sum(1 for a in report.anomalies if a.severity == "error")
    warning_count = sum(1 for a in report.anomalies if a.severity == "warning")
    print(f"  ✓ 检测完成: {error_count} 个错误, {warning_count} 个警告")
    for a in report.anomalies:
        icon = "❌" if a.severity == "error" else "⚠️"
        print(f"    {icon} [{a.anomaly_type}] {a.description[:50]}...")

    print("\n[步骤 4/5] 生成可视化图表...")
    charts_dir = os.path.join(output_dir, "charts")
    chart_paths, chart_traces = visualization.generate_all_charts(
        student_record, wavelength_results, report, output_dir=charts_dir
    )
    report.chart_paths = chart_paths

    print(f"  ✓ 生成了 {len(chart_paths)} 个图表:")
    for name, path in chart_paths.items():
        print(f"    - {name}: {path}")

    print("\n[步骤 5/5] 生成分析报告...")
    reports_dir = os.path.join(output_dir, "reports")
    report_paths, report_traces = report_generator.generate_all_reports(
        student_record, report, output_dir=reports_dir
    )

    print(f"  ✓ 生成了 {len(report_paths)} 个报告文件:")
    for name, path in report_paths.items():
        print(f"    - {name}: {path}")

    if report.anomalies:
        conclusion_parts = [f"本次实验共检测到 {error_count} 个严重错误和 {warning_count} 个警告。"]
        if error_count > 0:
            conclusion_parts.append("建议优先修正严重错误后重新计算。")
        else:
            conclusion_parts.append("数据质量较好，可继续分析。")
    else:
        conclusion_parts = ["本次实验数据未检测到明显异常，质量良好。"]

    conclusion_parts.append(
        f"最终测量波长为 λ = ({final_wavelength*1e9:.2f} ± {final_uncertainty*1e9:.2f}) nm。"
    )

    if report.relative_error is not None:
        if abs(report.relative_error) < 5:
            conclusion_parts.append(
                f"与参考值的相对误差为 {report.relative_error:+.2f}%，结果在合理范围内。"
            )
        else:
            conclusion_parts.append(
                f"与参考值的相对误差为 {report.relative_error:+.2f}%，偏差较大，建议检查测量过程。"
            )

    report.conclusion = " ".join(conclusion_parts)

    print(f"\n{'='*60}")
    print("分析完成!")
    print(f"{'='*60}")
    print(f"\n快速查看: {report_paths['html']}")
    print(f"详细数据: {report_paths['json']}")

    return report


def create_student_record_from_input(
    student_name: str,
    student_id: str,
    grating_constant: float,
    screen_distance: float,
    fringes_data: list,
    reference_wavelength: Optional[float] = None,
) -> StudentRecord:
    """
    从用户输入创建学生记录

    Args:
        student_name: 学生姓名
        student_id: 学号
        grating_constant: 光栅常数 (m)
        screen_distance: 屏距 (m)
        fringes_data: 条纹数据列表，每项为 (order, side, position, uncertainty)
        reference_wavelength: 参考波长 (m)
    """
    record = StudentRecord(
        student_id=student_id,
        student_name=student_name,
        experiment_name="光栅衍射测波长",
        source_type=SourceType.STUDENT_INPUT,
    )

    record.grating_constant = GratingConstant(
        value=grating_constant,
        unit="m",
        uncertainty=grating_constant * 0.001,
        source_type=SourceType.REFERENCE,
    )

    record.screen_distance = ScreenDistance(
        value=screen_distance,
        unit="m",
        uncertainty=0.002,
        source_type=SourceType.MEASURED,
    )

    if reference_wavelength:
        record.reference_wavelength = reference_wavelength
        record.reference_wavelength_unit = "m"

    for order, side, position, uncertainty in fringes_data:
        fringe = FringePosition(
            order=order,
            side=side,
            position=position,
            unit="m",
            uncertainty=uncertainty,
            source_type=SourceType.MEASURED,
        )
        record.add_fringe(fringe)

    return record


def main():
    """主函数，演示完整流程"""

    print("""
╔══════════════════════════════════════════════════════════════╗
║              光栅衍射测波长 - 实验分析工具                    ║
║              Grating Diffraction Wavelength Analyzer         ║
╚══════════════════════════════════════════════════════════════╝

功能:
  • 从衍射条纹位置反推波长
  • 误差传播分析
  • 智能异常检测 (级次混淆、单位错误、条纹缺失)
  • 专业可视化图表
  • 可追溯的实验报告

快速开始:
  python main.py                  # 运行正常示例
  python main.py --anomaly        # 运行含异常示例
  python main.py --help           # 查看帮助
    """)

    import argparse
    parser = argparse.ArgumentParser(description="光栅衍射测波长分析工具")
    parser.add_argument(
        "--anomaly",
        action="store_true",
        help="使用包含常见错误的示例数据进行演示",
    )
    parser.add_argument(
        "--output",
        type=str,
        default="output",
        help="输出目录 (默认: output)",
    )
    args = parser.parse_args()

    if args.anomaly:
        print("\n>>> 使用含异常的示例数据 (级次混淆演示)...")
        student_record = create_sample_student_record(
            student_name="李四",
            student_id="2024001002",
            has_anomaly=True,
        )
    else:
        print("\n>>> 使用正常示例数据...")
        student_record = create_sample_student_record(
            student_name="张三",
            student_id="2024001001",
            has_anomaly=False,
        )

    report = analyze_student_record(
        student_record,
        output_dir=args.output,
        expected_max_order=3,
    )

    return report


if __name__ == "__main__":
    main()
