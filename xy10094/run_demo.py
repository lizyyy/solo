#!/usr/bin/env python3
"""水质检测质控报告器 - 演示脚本"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from water_quality.pipeline import QCPipeline
from water_quality.sample_data import save_sample_data
from water_quality.config import QCConfig


def main():
    print("=" * 60)
    print("水质检测质控报告器 v1.0.0")
    print("=" * 60)

    print("\n[1/4] 生成示例数据 (包含各种数据质量问题)...")
    data_paths = save_sample_data("./examples")
    print(f"    - CSV (含问题): {data_paths['with_issues_csv']}")
    print(f"    - Excel (含问题): {data_paths['with_issues_xlsx']}")
    print(f"    - CSV (干净): {data_paths['clean_csv']}")

    custom_config = QCConfig(
        blank_threshold=0.01,
        parallel_max_rpd=5.0,
        recovery_min=80.0,
        recovery_max=120.0,
        outlier_method="iqr",
        outlier_factor=1.5,
    )

    print("\n[2/4] 初始化质控管道...")
    pipeline = QCPipeline(config=custom_config, output_dir="./output")
    print("    输出目录: ./output")

    print("\n[3/4] 运行质控流程 (使用含问题的数据)...")
    input_file = data_paths["with_issues_csv"]
    result = pipeline.run(
        input_path=input_file,
        report_title="水质检测质控报告 - 演示版",
        generate_html=True,
        generate_excel=True,
        generate_json=True,
    )

    print(f"\n{'='*60}")
    print("执行结果:")
    print(f"{'='*60}")
    print(f"  成功: {result.success}")
    print(f"  消息: {result.message}")

    if result.load_result:
        print(f"\n  [数据加载]")
        print(f"    行数: {result.load_result.row_count}")
        print(f"    列数: {result.load_result.column_count}")
        print(f"    问题数: {len(result.load_result.issues)}")
        for issue in result.load_result.issues:
            prefix = "ERROR" if issue.type.startswith("critical") else (
                "WARN" if issue.type.startswith("warning") else "INFO"
            )
            print(f"      [{prefix}] {issue.type}: {issue.message}")

    if result.preprocess_result:
        print(f"\n  [数据预处理]")
        print(f"    原始行数: {result.preprocess_result.original_rows}")
        print(f"    清洗后行数: {result.preprocess_result.cleaned_rows}")
        print(f"    移除行数: {result.preprocess_result.original_rows - result.preprocess_result.cleaned_rows}")
        print(f"    问题数: {len(result.preprocess_result.issues)}")
        for issue in result.preprocess_result.issues:
            print(f"      [{issue.severity.upper()}] {issue.type}: {issue.message}")

    if result.qc_result:
        print(f"\n  [质控检查]")
        summary = result.qc_result.to_summary_dict()
        print(f"    检查项: {summary['passed_checks']}/{summary['total_checks']}")
        print(f"    失败样本数: {summary['total_failures']}")

        for check in result.qc_result.checks:
            status = "✓ 通过" if check.passed else "✗ 不通过"
            print(f"      - {check.rule_name}: {status} (失败: {len(check.failures)})")

        if result.qc_result.failures:
            print(f"\n  [失败样本详情]")
            for i, failure in enumerate(result.qc_result.failures, 1):
                print(f"\n    失败 #{i}:")
                print(f"      样本: {failure.sample_id}")
                print(f"      指标: {failure.parameter}")
                print(f"      类型: {failure.sample_type}")
                print(f"      规则: {failure.rule_name}")
                print(f"      原因: {failure.message}")

    print(f"\n{'='*60}")
    print("输出文件:")
    print(f"{'='*60}")

    if result.html_report:
        print(f"  [HTML报告] {result.html_report.html_path}")
        print(f"    大小: {result.html_report.report_size_kb:.2f} KB")

    if result.excel_report:
        print(f"  [Excel报告] {result.excel_report.file_path}")
        print(f"    大小: {result.excel_report.file_size_kb:.2f} KB")

    if result.json_export:
        print(f"  [JSON数据] {result.json_export.file_path}")
        print(f"    大小: {result.json_export.file_size_kb:.2f} KB")

    print(f"\n{'='*60}")
    print("复算功能演示:")
    print(f"{'='*60}")

    if result.json_export and os.path.exists(result.json_export.file_path):
        print("\n[4/4] 从 JSON 导出复算...")
        rerun_result = pipeline.rerun_from_json(result.json_export.file_path)
        print(f"  复算成功: {rerun_result.success}")
        print(f"  复算报告: {rerun_result.html_report.html_path if rerun_result.html_report else '无'}")

    print(f"\n{'='*60}")
    print("完成!")
    print(f"{'='*60}")

    if result.html_report:
        print(f"\n提示: 请在浏览器中打开 HTML 报告查看完整结果:")
        print(f"      file://{os.path.abspath(result.html_report.html_path)}")


if __name__ == "__main__":
    main()
