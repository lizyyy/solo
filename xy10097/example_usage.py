"""电池批次一致性分析系统使用示例。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from battery_analysis import (
    AnalysisConfig,
    BatteryConsistencyAnalyzer,
)


def basic_example():
    """基础使用示例。"""
    print("=" * 60)
    print("电池批次一致性分析系统 - 基础示例")
    print("=" * 60)
    
    config = AnalysisConfig(
        target_cycles=[100, 200, 300],
        target_capacity_retention=80.0,
        qc_rules={
            "duplicate_detection": True,
            "missing_value_threshold": 0.3,
            "outlier_method": "iqr",
            "outlier_threshold": 1.5,
            "capacity_min": 0.0,
            "capacity_drop_threshold": 0.2,
            "min_cycles_required": 10,
        }
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    input_path = "sample_data"
    output_dir = "analysis_results"
    
    result = analyzer.run_full_analysis(input_path, output_dir)
    
    print("\n" + "=" * 60)
    print("分析结果摘要")
    print("=" * 60)
    
    if result.get('status') == 'success':
        print(f"\n分析状态: 成功")
        print(f"分析电池数: {result['battery_count']}")
        print(f"一致性等级: {result['consistency_level']}")
        print(f"失败样本数: {result['failed_samples']['count']}")
        
        print("\n导出文件:")
        for key, value in result['exported_files'].items():
            if isinstance(value, dict):
                print(f"  {key}:")
                for sub_key, sub_value in value.items():
                    print(f"    - {sub_key}: {sub_value}")
            else:
                print(f"  {key}: {value}")
        
        print("\n质控摘要:")
        qc_summary = result['qc_summary']
        print(f"  总样本数: {qc_summary.get('total_samples', 0)}")
        print(f"  通过: {qc_summary.get('passed_samples', 0)}")
        print(f"  警告: {qc_summary.get('warning_samples', 0)}")
        print(f"  失败: {qc_summary.get('failed_samples', 0)}")
        
        if result['failed_samples']['count'] > 0:
            print("\n失败样本类型:")
            for err_type, count in result['failed_samples']['by_type'].items():
                print(f"  {err_type}: {count} 个样本")
    else:
        print(f"\n分析失败: {result.get('error', '未知错误')}")


def step_by_step_example():
    """分步执行示例。"""
    print("\n" + "=" * 60)
    print("电池批次一致性分析系统 - 分步执行示例")
    print("=" * 60)
    
    config = AnalysisConfig(
        target_cycles=[50, 100, 150, 200],
        qc_rules={
            "outlier_method": "zscore",
            "outlier_threshold": 3.0,
        }
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    print("\n1. 加载数据...")
    processed_data = analyzer.load_data("sample_data")
    print(f"   加载完成，{len(processed_data)} 行数据")
    
    print("\n2. 质量控制...")
    qc_data, qc_report = analyzer.run_quality_control()
    print(f"   质控完成，{len(qc_data)} 行有效数据")
    
    print("\n3. 一致性分析...")
    analysis_result = analyzer.run_analysis()
    print(f"   分析完成，{len(analysis_result.battery_metrics)} 个电池")
    
    print("\n4. 获取电池指标...")
    battery_metrics_df = analyzer.get_battery_metrics_df()
    print(f"   电池指标:\n{battery_metrics_df.head()}")
    
    print("\n5. 获取汇总表格...")
    summary_df = analyzer.get_summary_table()
    print(f"   汇总表格:\n{summary_df}")
    
    print("\n6. 获取失败样本...")
    failed_samples = analyzer.get_results()['failed_samples']
    print(f"   失败样本数: {failed_samples['count']}")


if __name__ == "__main__":
    basic_example()
    step_by_step_example()
