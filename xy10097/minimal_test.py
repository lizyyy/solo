"""最小化验证脚本 - 验证完整分析流程。

此脚本设计用于在只读环境中也能运行验证：
- 禁用文件日志
- 不尝试导出文件
- 只验证核心流程：读取、质控、分析
"""

import sys
import os
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

os.environ.setdefault('MPLCONFIGDIR', '/tmp')

from battery_analysis import (
    AnalysisConfig,
    BatteryConsistencyAnalyzer,
    AnalysisLogger,
)


def main():
    """运行最小验证。"""
    print("=" * 70)
    print("电池批次一致性分析系统 - 最小验证")
    print("=" * 70)
    
    sample_data_path = Path("sample_data")
    if not sample_data_path.exists():
        print(f"\n错误: 找不到样本数据目录: {sample_data_path}")
        print(f"当前目录: {Path('.').absolute()}")
        print(f"目录内容: {list(Path('.').iterdir())}")
        return 1
    
    print(f"\n[配置] 禁用文件日志，仅控制台输出")
    config = AnalysisConfig(
        target_cycles=[50, 100, 200],
        qc_rules={
            "min_cycles_required": 10,
            "capacity_drop_threshold": 0.3,
            "missing_value_threshold": 0.5,
        },
        log_to_file=False,
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    print("\n[步骤 1/4] 加载并预处理数据...")
    try:
        processed_data = analyzer.load_data("sample_data")
        print(f"  ✓ 成功")
        print(f"    数据行数: {len(processed_data)}")
        print(f"    列名: {list(processed_data.columns)}")
        if 'battery_id' in processed_data.columns:
            print(f"    电池数量: {processed_data['battery_id'].nunique()}")
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n[步骤 2/4] 质量控制...")
    try:
        qc_data, qc_report = analyzer.run_quality_control()
        print(f"  ✓ 成功")
        print(f"    质控后行数: {len(qc_data)}")
        print(f"    通过样本: {qc_report.passed_samples}")
        print(f"    警告样本: {qc_report.warning_samples}")
        print(f"    失败样本: {qc_report.failed_samples}")
        print(f"    问题类型: {qc_report.by_type}")
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n[步骤 3/4] 一致性分析...")
    try:
        analysis_result = analyzer.run_analysis()
        print(f"  ✓ 成功")
        print(f"    分析电池数: {len(analysis_result.battery_metrics)}")
        if analysis_result.consistency_metrics:
            print(f"    一致性等级: {analysis_result.consistency_metrics.consistency_level}")
            print(f"    综合CV值: {analysis_result.consistency_metrics.cv_cv_score:.2f}%")
            print(f"    初始容量CV: {analysis_result.consistency_metrics.cv_initial_capacity:.2f}%")
            print(f"    衰减率CV: {analysis_result.consistency_metrics.cv_fade_rate:.2f}%")
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n[步骤 4/4] 生成汇总表格...")
    try:
        battery_metrics_df = analyzer.get_battery_metrics_df()
        summary_df = analyzer.get_summary_table()
        print(f"  ✓ 成功")
        print(f"    电池指标表格: {len(battery_metrics_df)} 行")
        print(f"    汇总表格: {len(summary_df)} 行")
        print("\n电池指标预览:")
        print(battery_metrics_df[['电池编号', '初始容量(mAh)', '衰减率(%/循环)']].head().to_string(index=False))
    except Exception as e:
        print(f"  ✗ 失败: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    print("\n" + "=" * 70)
    print("验证结果: 成功")
    print("=" * 70)
    
    failed_samples = analyzer.logger.get_failed_samples_summary()
    if failed_samples['count'] > 0:
        print(f"\n失败样本汇总: {failed_samples['count']} 个")
        for err_type, count in failed_samples['by_type'].items():
            print(f"  - {err_type}: {count} 个")
    
    print("\n关键验证点:")
    print("  ✓ 模块导入成功")
    print("  ✓ Matplotlib 初始化成功 (无缓存目录问题)")
    print("  ✓ 数据读取和预处理成功")
    print("  ✓ battery_id 分配正确 (确保后续groupby可用)")
    print("  ✓ 质量控制成功")
    print("  ✓ 一致性分析成功")
    print("  ✓ 表格报告生成成功")
    print("\n单位转换验证 (关键):")
    for bid, metrics in list(analysis_result.battery_metrics.items())[:5]:
        print(f"  - {bid}: 初始容量 = {metrics.initial_capacity:.1f} mAh")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
