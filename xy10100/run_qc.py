#!/usr/bin/env python3
"""
PCR Ct值质控工具 - 主运行脚本

使用方法:
    python run_qc.py                    # 使用默认示例数据
    python run_qc.py --file data.csv    # 使用指定数据文件
    python run_qc.py --units            # 使用包含单位的示例数据
"""

import sys
import os
import argparse
from pathlib import Path
from pprint import pprint

sys.path.insert(0, str(Path(__file__).parent))

from pcr_qc import DataLoader, QCValidator, ReportGenerator, Exporter


def main():
    parser = argparse.ArgumentParser(description='PCR Ct值质控工具')
    parser.add_argument('--file', '-f', type=str, help='输入数据文件路径')
    parser.add_argument('--units', '-u', action='store_true', help='使用包含单位的示例数据')
    parser.add_argument('--output', '-o', type=str, default='./output', help='输出目录')
    args = parser.parse_args()

    print("=" * 60)
    print("🔬 PCR Ct值质控工具")
    print("=" * 60)
    print()

    if args.file:
        data_file = Path(args.file)
    elif args.units:
        data_file = Path(__file__).parent / "examples" / "sample_data_with_units.csv"
    else:
        data_file = Path(__file__).parent / "examples" / "sample_data_with_issues.csv"

    if not data_file.exists():
        print(f"❌ 找不到数据文件: {data_file}")
        sys.exit(1)

    print(f"📂 数据文件: {data_file}")
    print()

    print("[1/4] 加载数据...")
    loader = DataLoader()
    try:
        loaded_data = loader.load(str(data_file))
        print(f"   ✓ 原始数据: {len(loaded_data.raw_data)} 行")
        print(f"   ✓ 清洗后数据: {len(loaded_data.cleaned_data)} 行")
        print(f"   ✓ 数据问题: {len(loaded_data.issues)} 个")
        print(f"   ✓ 加载失败: {len(loaded_data.failed_samples)} 行")
    except Exception as e:
        print(f"   ❌ 加载失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    print()

    print("[2/4] 执行质控验证...")
    validator = QCValidator()
    try:
        qc_result = validator.validate(loaded_data)
        print(f"   ✓ 总体状态: {qc_result.overall_status.value.upper()}")
        print(f"   ✓ 通过样本: {qc_result.statistics['pass_samples']}")
        print(f"   ✓ 警告样本: {qc_result.statistics['warn_samples']}")
        print(f"   ✓ 失败样本: {qc_result.statistics['fail_samples']}")
    except Exception as e:
        print(f"   ❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    print()

    print("[3/4] 生成质控报告...")
    output_dir = Path(args.output)
    report_generator = ReportGenerator(str(output_dir))
    try:
        report = report_generator.generate(loaded_data, qc_result)
        print(f"   ✓ HTML报告: {report.html_path}")
        print(f"   ✓ Excel报告: {report.excel_path}")
        print(f"   ✓ 图表数: {len(report.charts)}")
    except Exception as e:
        print(f"   ❌ 报告生成失败: {e}")
        import traceback
        traceback.print_exc()
    print()

    print("[4/4] 导出数据文件...")
    exporter = Exporter(str(output_dir))
    try:
        export_result = exporter.export_all(loaded_data, qc_result)
        if export_result.success:
            print(f"   ✓ 导出成功: {len(export_result.files)} 个文件")
            for f in export_result.files:
                print(f"      - {f}")
        else:
            print(f"   ⚠ 部分导出失败")
            for err in export_result.errors:
                print(f"      ❌ {err}")
    except Exception as e:
        print(f"   ❌ 导出失败: {e}")
    print()

    print("=" * 60)
    print("📋 质控结果摘要")
    print("=" * 60)
    print()

    print("【数据问题】")
    if loaded_data.issues:
        for issue in loaded_data.issues:
            print(f"   [{issue.severity.upper()}] {issue.issue_type}: {issue.message}")
    else:
        print("   无")
    print()

    print("【处理日志】")
    for log in loaded_data.processing_log + qc_result.validation_log:
        if '换算' in log or '单位' in log.lower():
            print(f"   ✓ {log}")
    print()

    print("【质控失败样本】")
    if qc_result.failures:
        error_failures = [f for f in qc_result.failures if f.severity == 'error']
        warn_failures = [f for f in qc_result.failures if f.severity == 'warn']
        
        if error_failures:
            print("   [错误 - 会导致整批结果质疑]")
            for failure in error_failures:
                print(f"      ✗ {failure.sample_id}: {failure.reason}")
        
        if warn_failures:
            print("   [警告 - 需关注但不影响整批]")
            for failure in warn_failures:
                print(f"      ⚠ {failure.sample_id}: {failure.reason}")
    else:
        print("   无")
    print()

    print("【对照检查】")
    if qc_result.control_checks:
        for check in qc_result.control_checks:
            status = "✓ 通过" if check.passed else "✗ 失败"
            ctrl_type = {
                'positive_control': '阳性对照',
                'negative_control': '阴性对照',
                'blank': '空白对照'
            }.get(check.control_type, check.control_type)
            print(f"   {status} {ctrl_type}: {check.message}")
    else:
        print("   无对照")
    print()

    print("【详细样本状态】")
    from pcr_qc.data_loader import SampleType
    all_samples = qc_result.sample_results
    
    control_samples = all_samples[
        (all_samples['sample_type'] != SampleType.SAMPLE) &
        (all_samples['sample_type'] != SampleType.UNKNOWN)
    ]
    
    if len(control_samples) > 0:
        print("   对照样本状态:")
        for idx, row in control_samples.iterrows():
            status = row['qc_status']
            reasons = row['qc_fail_reasons'] if 'qc_fail_reasons' in row and row['qc_fail_reasons'] else ''
            status_str = {
                'pass': '✓ PASS',
                'warn': '⚠ WARN',
                'fail': '✗ FAIL'
            }.get(status, status)
            reason_str = f" -> {reasons}" if reasons else ""
            print(f"      {status_str} {row['sample_id']}{reason_str}")
    print()

    print("=" * 60)
    print("✅ 处理完成!")
    print(f"📁 输出目录: {output_dir}")
    print("=" * 60)


if __name__ == "__main__":
    main()
