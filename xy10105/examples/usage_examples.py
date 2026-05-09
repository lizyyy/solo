"""
使用示例脚本
演示如何使用传感器漂移校准审计系统
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sensor_audit import (
    AuditConfig,
    ConfigManager,
    DataLoader,
    QualityController,
    DriftDetector,
    Calibrator,
    ReportGenerator,
    AuditPipeline
)
from sensor_audit.sample_generator import SampleDataGenerator


def example_basic_pipeline():
    """
    示例1: 基本流水线使用
    """
    print("=" * 60)
    print("示例 1: 基本流水线使用")
    print("=" * 60)
    
    generator = SampleDataGenerator(seed=42)
    sample_file = generator.generate(
        num_sensors=5,
        num_days=30,
        samples_per_day=12,
        output_file='data/example_data.csv'
    )
    
    pipeline = AuditPipeline()
    results = pipeline.run(
        input_file=sample_file,
        output_prefix='example_basic'
    )
    
    print("\n审计结果摘要:")
    print(f"  - 数据质量评分: {results['qc_result'].quality_score:.1f}/100")
    print(f"  - 发现漂移事件: {len(results['drift_result'].drift_events)}")
    print(f"  - 生成校准参数: {len(results['calibration_result'].parameters)}")
    
    return results


def example_with_custom_config():
    """
    示例2: 使用自定义配置
    """
    print("\n" + "=" * 60)
    print("示例 2: 使用自定义配置")
    print("=" * 60)
    
    config = AuditConfig(
        temperature_range=[-20.0, 50.0],
        humidity_range=[10.0, 95.0],
        temperature_delta_threshold=3.0,
        humidity_delta_threshold=8.0,
        drift_window_size=24,
        drift_threshold_temp=2.0,
        drift_threshold_humidity=5.0,
        iqr_multiplier=2.0,
    )
    
    print(f"自定义配置:")
    print(f"  - 温度范围: {config.temperature_range}")
    print(f"  - 湿度范围: {config.humidity_range}")
    print(f"  - IQR 乘数: {config.iqr_multiplier}")
    print(f"  - 漂移窗口大小: {config.drift_window_size}")
    
    pipeline = AuditPipeline(config=config)
    results = pipeline.run(
        input_file='data/example_data.csv',
        output_prefix='example_custom_config'
    )
    
    return results


def example_module_by_module():
    """
    示例3: 模块化使用（单独调用每个模块）
    """
    print("\n" + "=" * 60)
    print("示例 3: 模块化使用")
    print("=" * 60)
    
    config = AuditConfig()
    
    print("步骤 1: 加载数据...")
    loader = DataLoader(config)
    loaded_data = loader.load_csv('data/example_data.csv')
    print(f"  加载了 {loaded_data.data_summary['raw_rows']} 条记录")
    print(f"  传感器: {loaded_data.sensor_ids}")
    
    print("\n步骤 2: 质量控制...")
    qc = QualityController(config)
    qc_result = qc.run_all_checks(loaded_data.processed_data)
    print(f"  质量评分: {qc_result.quality_score:.1f}/100")
    print(f"  问题统计:")
    for issue_type, info in qc_result.get_issue_summary().items():
        print(f"    - {issue_type}: {info['count']} 条")
    
    print("\n步骤 3: 漂移检测...")
    valid_data = qc.get_valid_data(loaded_data.processed_data.copy(), qc_result)
    detector = DriftDetector(config)
    drift_result = detector.detect_drift(valid_data)
    print(f"  发现 {len(drift_result.drift_events)} 个漂移事件")
    
    print("\n步骤 4: 校准...")
    calibrator = Calibrator(config)
    calib_result = calibrator.calibrate(valid_data.copy(), drift_result)
    print(f"  生成 {len(calib_result.parameters)} 个校准参数")
    
    print("\n步骤 5: 生成报告...")
    reporter = ReportGenerator(config)
    generated_files = reporter.generate_reports(
        loaded_data=loaded_data,
        qc_result=qc_result,
        drift_result=drift_result,
        calibration_result=calib_result,
        output_prefix='example_module'
    )
    print(f"  生成文件:")
    for ftype, fpath in generated_files.items():
        print(f"    - {ftype}: {fpath}")
    
    return {
        'loaded_data': loaded_data,
        'qc_result': qc_result,
        'drift_result': drift_result,
        'calibration_result': calib_result,
        'generated_files': generated_files
    }


def example_qc_rules_demo():
    """
    示例4: 演示各种质控规则
    """
    print("\n" + "=" * 60)
    print("示例 4: 质控规则演示")
    print("=" * 60)
    
    import pandas as pd
    
    config = AuditConfig()
    qc = QualityController(config)
    
    test_data = pd.DataFrame({
        'sensor_id': ['S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1', 'S1'],
        'timestamp': pd.date_range('2024-01-01', periods=8, freq='H'),
        'temperature': [22.0, None, 22.0, 90.0, 22.0, 22.0, 22.0, 22.0],
        'humidity': [55.0, 55.0, 55.0, 55.0, 150.0, 55.0, 55.0, 55.0],
        'location': ['A', 'A', 'A', 'A', 'A', 'A', 'A', 'A'],
        'batch_id': ['B1', 'B1', 'B1', 'B1', 'B1', 'B1', 'B1', 'B1']
    })
    
    test_data_dup = pd.concat([test_data, test_data.head(2)], ignore_index=True)
    
    print("测试数据包含:")
    print("  - 缺失值 (第2行温度)")
    print("  - 重复记录 (前2行重复)")
    print("  - 温度范围异常 (90°C 超出 [-40, 85])")
    print("  - 湿度范围异常 (150% 超出 [0, 100])")
    
    qc_result = qc.run_all_checks(test_data_dup)
    
    print(f"\n质控结果:")
    print(f"  质量评分: {qc_result.quality_score:.1f}/100")
    print(f"  总问题数: {len(qc_result.issues)}")
    
    print("\n问题详情:")
    for issue in qc_result.issues:
        print(f"  [{issue.issue_type}] {issue.message}")
        print(f"      行: {issue.index}, 列: {issue.column}, 严重程度: {issue.severity}")


def main():
    print("\n" + "#" * 60)
    print("#  传感器漂移校准审计系统 - 使用示例")
    print("#" * 60 + "\n")
    
    results1 = example_basic_pipeline()
    
    results2 = example_with_custom_config()
    
    results3 = example_module_by_module()
    
    example_qc_rules_demo()
    
    print("\n" + "=" * 60)
    print("所有示例执行完成！")
    print("=" * 60)
    print("\n生成的文件:")
    print("  - 报告目录: reports/")
    print("  - 数据目录: output/")
    print("  - 示例数据: data/")
    print("\n请查看 reports/ 目录下的 HTML 和 Excel 报告。")


if __name__ == '__main__':
    main()
