import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.append(str(Path(__file__).parent))

from src.data_processor import DataProcessor
from src.validator import DataValidator
from src.calibration import LaserRangeCalibrator
from src.conflict_detector import ConflictDetector
from src.report_generator import ReportGenerator


def test_data_processor():
    print("=" * 50)
    print("测试1: 数据处理模块")
    print("=" * 50)
    
    processor = DataProcessor()
    sample_file = Path('data') / 'laser_calibration_sample.xlsx'
    
    if sample_file.exists():
        df = processor.load_experiment_table(str(sample_file))
        print(f"✓ 成功加载数据: {df.shape}")
        print(f"✓ 自动列映射: {processor.column_mapping}")
        
        conditions_text = """环境温度: 25°C
环境湿度: 60%
设备型号: LASER-001
操作人员: 何工"""
        conditions = processor.parse_working_conditions(conditions_text)
        print(f"✓ 工况解析: {len(conditions)} 条")
        
        df_with_unit = processor.convert_units(df, '原始值', 'mm', 'cm')
        print(f"✓ 单位转换完成，新增列: {df_with_unit.columns[-1]}")
        
        return df
    else:
        print("✗ 示例数据文件不存在")
        return None


def test_validator(df):
    print("\n" + "=" * 50)
    print("测试2: 数据验证模块")
    print("=" * 50)
    
    validator = DataValidator()
    
    report = validator.validate_all(
        df,
        time_col='时间',
        value_col='原始值',
        direction_col='方向',
        min_value=0,
        max_value=500
    )
    
    warnings = validator.get_warnings()
    print(f"✓ 验证完成，发现 {len(warnings)} 个警告")
    
    for w in warnings:
        print(f"  - {w['message']}: {w['details']}")
    
    return report


def test_calibration(df):
    print("\n" + "=" * 50)
    print("测试3: 校准计算模块")
    print("=" * 50)
    
    calibrator = LaserRangeCalibrator()
    
    raw_values = pd.to_numeric(df['原始值'], errors='coerce').values
    ref_values = pd.to_numeric(df['标准值'], errors='coerce').values
    
    result = calibrator.linear_calibration(raw_values, ref_values)
    print(f"✓ 线性校准完成")
    print(f"  - 偏差 (bias): {result.bias:.6f} mm")
    print(f"  - 比例 (scale): {result.scale_factor:.6f}")
    print(f"  - RMSE: {result.rmse:.6f} mm")
    print(f"  - R²: {result.r_squared:.6f}")
    
    test_value = 100.0
    corrected = calibrator.apply_correction(test_value)
    print(f"✓ 校正示例: {test_value} -> {corrected:.3f}")
    
    directions = df['方向'].tolist()
    dir_stats = calibrator.direction_analysis(raw_values, ref_values, directions)
    if '正向' in dir_stats:
        print(f"✓ 正向误差均值: {dir_stats['正向']['mean_error']:.4f} mm")
    if '反向' in dir_stats:
        print(f"✓ 反向误差均值: {dir_stats['反向']['mean_error']:.4f} mm")
    
    return result


def test_conflict_detector(df):
    print("\n" + "=" * 50)
    print("测试4: 冲突检测模块")
    print("=" * 50)
    
    detector = ConflictDetector()
    
    wechat_file = Path('data') / 'wechat_sample.txt'
    if wechat_file.exists():
        with open(wechat_file, 'r', encoding='utf-8') as f:
            wechat_text = f.read()
        
        parsed = detector.parse_wechat_text(wechat_text)
        print(f"✓ 解析微信群记录: {len(parsed)} 条")
        
        for rec in parsed:
            detector.add_wechat_record(
                timestamp=rec.get('timestamp', ''),
                content=rec.get('content', ''),
                distance=rec.get('distance'),
                direction=rec.get('direction')
            )
        
        conflicts = detector.compare_distance(df, '原始值', '时间')
        print(f"✓ 冲突检测完成，发现 {len(conflicts)} 处冲突")
        
        summary = detector.get_conflict_summary()
        actions = detector.get_suggested_actions()
        print(f"✓ 建议动作: {len(actions)} 条")
        for action in actions[:3]:
            print(f"  - {action}")
        
        return conflicts
    else:
        print("✗ 微信群示例文件不存在")
        return []


def test_report_generator(df, calibration_result):
    print("\n" + "=" * 50)
    print("测试5: 报告生成模块")
    print("=" * 50)
    
    generator = ReportGenerator()
    
    raw_values = pd.to_numeric(df['原始值'], errors='coerce').values
    ref_values = pd.to_numeric(df['标准值'], errors='coerce').values
    
    fig = generator.create_calibration_curve(
        raw_values, ref_values,
        np.array(calibration_result.corrected_values),
        np.array(calibration_result.residuals)
    )
    print(f"✓ 校准曲线图表生成")
    
    fig2 = generator.create_error_histogram(np.array(calibration_result.residuals))
    print(f"✓ 误差分布图表生成")
    
    error_stats = {
        'mean_error': np.mean(calibration_result.residuals),
        'std_error': np.std(calibration_result.residuals)
    }
    summary_df = generator.create_summary_table(calibration_result, error_stats)
    print(f"✓ 摘要表格生成: {len(summary_df)} 行")
    
    print(f"✓ 报告模块测试完成")


def main():
    print("🔬 激光测距误差校准系统 - 模块测试")
    
    df = test_data_processor()
    if df is None:
        print("\n测试终止：无法加载数据")
        return
    
    test_validator(df)
    
    calibration_result = test_calibration(df)
    
    test_conflict_detector(df)
    
    test_report_generator(df, calibration_result)
    
    print("\n" + "=" * 50)
    print("✅ 所有测试完成！")
    print("=" * 50)
    print("\n启动应用命令: streamlit run app.py")


if __name__ == '__main__':
    main()
