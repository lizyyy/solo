"""电池批次一致性分析系统使用示例。

运行方式:
    python3 example_usage.py

此脚本会：
1. 自动生成样例数据（如果 sample_data 目录不存在）
2. 运行完整的电池批次一致性分析
3. 导出所有结果到 analysis_results 目录
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from generate_sample_data import generate_sample_data
from battery_analysis import (
    AnalysisConfig,
    BatteryConsistencyAnalyzer,
)


def ensure_sample_data(sample_dir: str = "sample_data") -> None:
    """确保样例数据存在。"""
    sample_path = Path(sample_dir)
    
    if not sample_path.exists() or len(list(sample_path.iterdir())) == 0:
        print(f"[准备] 样例数据目录不存在或为空，正在生成...")
        generate_sample_data(sample_dir)
        print(f"[准备] 样例数据生成完成\n")
    else:
        print(f"[准备] 检测到已有样例数据: {sample_dir}\n")


def basic_example():
    """基础使用示例 - 一键完整分析。"""
    print("=" * 70)
    print("电池批次一致性分析系统 - 基础示例 (一键完整分析)")
    print("=" * 70)
    
    ensure_sample_data("sample_data")
    
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
        },
        log_to_file=True,
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    input_path = "sample_data"
    output_dir = "analysis_results"
    
    print(f"[分析] 输入目录: {input_path}")
    print(f"[分析] 输出目录: {output_dir}\n")
    
    result = analyzer.run_full_analysis(input_path, output_dir)
    
    print("\n" + "=" * 70)
    print("分析结果摘要")
    print("=" * 70)
    
    if result.get('status') == 'success':
        print(f"\n✓ 分析状态: 成功")
        print(f"  分析电池数: {result['battery_count']}")
        print(f"  一致性等级: {result['consistency_level']}")
        print(f"  失败样本数: {result['failed_samples']['count']}")
        
        print("\n✓ 导出文件:")
        for key, value in result['exported_files'].items():
            if isinstance(value, dict):
                print(f"  {key}:")
                for sub_key, sub_value in value.items():
                    print(f"    - {sub_key}: {Path(sub_value).name}")
            else:
                print(f"  {key}: {Path(value).name}")
        
        print("\n✓ 质控摘要:")
        qc_summary = result['qc_summary']
        print(f"  总样本数: {qc_summary.get('total_samples', 0)}")
        print(f"  通过: {qc_summary.get('passed_samples', 0)}")
        print(f"  警告: {qc_summary.get('warning_samples', 0)}")
        print(f"  失败: {qc_summary.get('failed_samples', 0)}")
        print(f"  通过率: {qc_summary.get('pass_rate', 'N/A')}")
        
        if result['failed_samples']['count'] > 0:
            print("\n⚠ 失败样本类型:")
            for err_type, count in result['failed_samples']['by_type'].items():
                print(f"  - {err_type}: {count} 个样本")
        
        print(f"\n✓ 完整结果已导出到: {output_dir}/")
        print("  请打开以下文件查看详细结果:")
        print(f"    - {output_dir}/summary_report.html (网页版报告)")
        print(f"    - {output_dir}/analysis_results.xlsx (Excel 详细报告)")
        print(f"    - {output_dir}/plots/ (分析图表)")
        print(f"    - {output_dir}/failed_samples.csv (失败样本详情)")
        
    else:
        print(f"\n✗ 分析失败: {result.get('error', '未知错误')}")
        return False
    
    return True


def step_by_step_example():
    """分步执行示例 - 展示各阶段输出。"""
    print("\n" + "=" * 70)
    print("电池批次一致性分析系统 - 分步执行示例")
    print("=" * 70)
    
    ensure_sample_data("sample_data")
    
    config = AnalysisConfig(
        target_cycles=[50, 100, 150, 200],
        qc_rules={
            "outlier_method": "zscore",
            "outlier_threshold": 3.0,
        },
        log_to_file=False,
    )
    
    analyzer = BatteryConsistencyAnalyzer(config)
    
    print("\n[步骤 1/6] 加载并预处理数据...")
    processed_data = analyzer.load_data("sample_data")
    print(f"  加载完成，{len(processed_data)} 行数据")
    print(f"  检测到的电池: {processed_data['battery_id'].nunique()} 个")
    
    print("\n[步骤 2/6] 质量控制检查...")
    qc_data, qc_report = analyzer.run_quality_control()
    print(f"  质控完成，{len(qc_data)} 行有效数据")
    print(f"  通过: {qc_report.passed_samples}, 警告: {qc_report.warning_samples}, 失败: {qc_report.failed_samples}")
    
    print("\n[步骤 3/6] 一致性分析...")
    analysis_result = analyzer.run_analysis()
    print(f"  分析完成，{len(analysis_result.battery_metrics)} 个电池")
    
    if analysis_result.consistency_metrics:
        print(f"  一致性等级: {analysis_result.consistency_metrics.consistency_level}")
        print(f"  综合CV值: {analysis_result.consistency_metrics.cv_cv_score:.2f}%")
    
    print("\n[步骤 4/6] 获取电池指标...")
    battery_metrics_df = analyzer.get_battery_metrics_df()
    if not battery_metrics_df.empty:
        print(f"  共 {len(battery_metrics_df)} 个电池")
        print(f"  部分指标预览:\n{battery_metrics_df[['电池编号', '初始容量(mAh)', '衰减率(%/循环)']].head()}")
    
    print("\n[步骤 5/6] 获取汇总表格...")
    summary_df = analyzer.get_summary_table()
    if not summary_df.empty:
        print(f"  汇总表格 ({len(summary_df)} 行)")
        pd.set_option('display.width', None)
        pd.set_option('display.max_columns', None)
        print(summary_df.to_string(index=False))
    
    print("\n[步骤 6/6] 获取失败样本...")
    failed_samples = analyzer.get_results()['failed_samples']
    print(f"  失败样本数: {failed_samples['count']}")
    if failed_samples['count'] > 0:
        print(f"  失败类型: {list(failed_samples['by_type'].keys())}")
    
    return True


def main():
    """主函数。"""
    print("\n" + "=" * 70)
    print("  电池批次一致性分析系统演示")
    print("=" * 70)
    
    success = basic_example()
    
    if success:
        step_by_step_example()
    
    print("\n" + "=" * 70)
    print("演示完成！")
    print("=" * 70)


if __name__ == "__main__":
    import pandas as pd
    main()
