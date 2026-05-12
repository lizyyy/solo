"""完整导出测试脚本 - 验证图表/表格/Excel报告的导出闭环。"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path('.')))

from battery_analysis import (
    AnalysisConfig,
    BatteryConsistencyAnalyzer,
    ReportGenerator,
    Exporter,
)


def main():
    """运行完整导出测试。"""
    print("=" * 70)
    print("电池批次一致性分析系统 - 完整导出测试")
    print("=" * 70)
    
    config = AnalysisConfig(
        target_cycles=[100, 200],
        qc_rules={'min_cycles_required': 50},
        log_to_file=False,
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    print("\n[1/5] 加载数据...")
    processed_data = analyzer.load_data('sample_data')
    print(f"  ✓ 完成: {len(processed_data)} 行, {processed_data['battery_id'].nunique()} 个电池")
    
    print("\n[2/5] 质量控制...")
    qc_data, qc_report = analyzer.run_quality_control()
    print(f"  ✓ 完成: 通过 {qc_report.passed_samples}, 警告 {qc_report.warning_samples}, 失败 {qc_report.failed_samples}")
    
    print("\n[3/5] 一致性分析...")
    analysis_result = analyzer.run_analysis()
    print(f"  ✓ 完成: 分析 {len(analysis_result.battery_metrics)} 个电池")
    
    print("\n[4/5] 创建报告生成器和导出器...")
    report_gen = ReportGenerator(config, analyzer.logger)
    exporter = Exporter(config, analyzer.logger)
    print("  ✓ 完成")
    
    output_dir = Path('analysis_results')
    print(f"\n[5/5] 导出所有结果到: {output_dir}")
    
    exported = exporter.export_all(
        qc_data,
        analysis_result,
        qc_report,
        report_gen,
        str(output_dir)
    )
    
    print("\n✓ 导出完成!")
    print("\n导出文件清单:")
    for key, value in exported.items():
        if isinstance(value, dict):
            print(f"  图表 ({key}): {len(value)} 张")
        elif value:
            fp = Path(value)
            if fp.exists():
                print(f"  文件: {fp.name} ({fp.stat().st_size/1024:.1f} KB)")
    
    print("\n检查输出目录内容...")
    if output_dir.exists():
        files = list(output_dir.iterdir())
        print(f"  输出目录存在: {output_dir}")
        print(f"  文件数量: {len(files)}")
        for f in sorted(files):
            if f.is_file():
                size_kb = f.stat().st_size / 1024
                print(f"    - {f.name} ({size_kb:.1f} KB)")
    
    print("\n" + "=" * 70)
    print("完整导出测试: 成功")
    print("=" * 70)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
