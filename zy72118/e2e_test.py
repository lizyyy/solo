import pandas as pd
import numpy as np
from pathlib import Path
import sys
import os

sys.path.insert(0, str(Path(__file__).parent))

from src.data_processor import DataProcessor
from src.validator import DataValidator
from src.calibration import LaserRangeCalibrator
from src.conflict_detector import ConflictDetector
from src.report_generator import ReportGenerator


def e2e_test():
    print("=" * 60)
    print("端到端验证：上传 → 验证 → 冲突检测 → 校准 → 报告")
    print("=" * 60)
    
    passed = True

    # ── Step 1: 生成样例数据 ──
    print("\n▶ Step 1: 生成样例数据")
    from sample_data import generate_sample_data, generate_wechat_sample
    df = generate_sample_data()
    wechat_text = generate_wechat_sample()
    print(f"  数据: {df.shape}, 方向列值: {df['方向'].unique().tolist()}")
    
    # ── Step 2: 数据导入（模拟 Streamlit 上传） ──
    print("\n▶ Step 2: 数据导入（模拟 Streamlit 上传）")
    processor = DataProcessor()
    sample_file = Path('data') / 'laser_calibration_sample.xlsx'
    df_loaded = processor.load_experiment_table(str(sample_file))
    print(f"  加载: {df_loaded.shape}")
    print(f"  列映射: {processor.column_mapping}")
    assert df_loaded.shape[0] == df.shape[0], "行数不一致"
    assert 'distance_raw' in processor.column_mapping, "distance_raw 未映射"
    assert 'distance_reference' in processor.column_mapping, "distance_reference 未映射"
    print("  ✅ 导入通过")

    # ── Step 3: 数据验证 ──
    print("\n▶ Step 3: 数据验证")
    validator = DataValidator()
    report = validator.validate_all(
        df_loaded,
        time_col='时间',
        value_col='原始值',
        direction_col='方向',
        min_value=0,
        max_value=500
    )
    warnings = validator.get_warnings()
    print(f"  警告数: {len(warnings)}")
    for w in warnings:
        print(f"    - {w['message']}: {w['details']}")
    
    dir_report = report.get('direction', {})
    print(f"  方向验证 valid={dir_report.get('valid')}")
    print(f"  方向别名映射: {dir_report.get('alias_hints', [])}")
    print(f"  不可识别方向: {dir_report.get('ambiguous_values', [])}")
    
    assert not dir_report.get('valid'), "UNKNOWN 应导致 valid=False"
    assert 'CW' in dir_report.get('alias_values', []), "CW 应在 alias_values 中"
    assert 'CCW' in dir_report.get('alias_values', []), "CCW 应在 alias_values 中"
    assert 'UNKNOWN' in dir_report.get('ambiguous_values', []), "UNKNOWN 应在不可识别列表中"
    print("  ✅ CW/CCW 被识别并映射，UNKNOWN 被标记")

    # ── Step 4: 冲突检测 ──
    print("\n▶ Step 4: 冲突检测（含 DIR=CCW 日志）")
    detector = ConflictDetector()
    parsed = detector.parse_wechat_text(wechat_text)
    print(f"  解析微信群记录: {len(parsed)} 条")
    for p in parsed:
        print(f"    direction={p.get('direction')}, distance={p.get('distance')}")
    
    for rec in parsed:
        detector.add_wechat_record(
            timestamp=rec.get('timestamp', ''),
            content=rec.get('content', ''),
            distance=rec.get('distance'),
            direction=rec.get('direction')
        )
    
    conflicts_dist = detector.compare_distance(df_loaded, '原始值', '时间')
    print(f"  距离冲突: {len(conflicts_dist)} 处")
    
    conflicts_dir = detector.compare_direction(df_loaded, '方向', '时间')
    print(f"  方向冲突: {len(conflicts_dir)} 处")
    for c in conflicts_dir:
        print(f"    - {c.conflict_type}: {c.suggestion}")
    
    summary = detector.get_conflict_summary()
    print(f"  总冲突: {summary['total_conflicts']}")
    
    # ── Step 4b: 冲突去重验证 ──
    print("\n▶ Step 4b: 冲突去重验证")
    conflicts_dir_again = detector.compare_direction(df_loaded, '方向', '时间')
    summary2 = detector.get_conflict_summary()
    print(f"  再次检测后总冲突: {summary2['total_conflicts']}")
    assert summary2['total_conflicts'] == summary['total_conflicts'], \
        f"去重失败: {summary2['total_conflicts']} != {summary['total_conflicts']}"
    print("  ✅ 重复检测不会增加同一冲突")

    # ── Step 5: 线性校准 ──
    print("\n▶ Step 5: 线性校准")
    calibrator = LaserRangeCalibrator()
    raw_values = pd.to_numeric(df_loaded['原始值'], errors='coerce').values
    ref_values = pd.to_numeric(df_loaded['标准值'], errors='coerce').values
    
    linear_result = calibrator.linear_calibration(raw_values, ref_values)
    print(f"  bias={linear_result.bias:.6f}, scale={linear_result.scale_factor:.6f}")
    print(f"  RMSE={linear_result.rmse:.6f}, R²={linear_result.r_squared:.6f}")
    assert isinstance(linear_result.bias, float), "bias 类型错误"
    assert isinstance(linear_result.scale_factor, float), "scale_factor 类型错误"
    print("  ✅ 线性校准通过")

    # ── Step 6: 分段线性校准 ──
    print("\n▶ Step 6: 分段线性校准")
    calibrator2 = LaserRangeCalibrator()
    try:
        pw_result = calibrator2.piecewise_linear_calibration(raw_values, ref_values, segments=3)
        print(f"  bias={pw_result.bias:.6f}, scale_factor={pw_result.scale_factor:.6f}")
        print(f"  RMSE={pw_result.rmse:.6f}, R²={pw_result.r_squared:.6f}")
        assert isinstance(pw_result.scale_factor, float), "scale_factor 应为 float"
        
        corrected_val = calibrator2.apply_correction(100.0)
        print(f"  apply_correction(100.0) = {corrected_val:.3f}")
        assert isinstance(corrected_val, float), "apply_correction 应返回 float"
        print("  ✅ 分段线性校准通过（scale→scale_factor 修复有效）")
    except TypeError as e:
        print(f"  ❌ 分段线性校准 TypeError: {e}")
        passed = False

    # ── Step 7: 方向分析（CW/CCW） ──
    print("\n▶ Step 7: 方向分析（CW/CCW）")
    directions = df_loaded['方向'].tolist()
    dir_stats = calibrator.direction_analysis(raw_values, ref_values, directions)
    for key, val in dir_stats.items():
        if isinstance(val, dict) and 'mean_error' in val:
            print(f"  {key}: mean_error={val['mean_error']:.4f}, rmse={val['rmse']:.4f}, n={val['count']}")
    assert '正向' in dir_stats, "CW 应映射到正向"
    assert '反向' in dir_stats, "CCW 应映射到反向"
    print("  ✅ CW/CCW 方向分析通过")

    # ── Step 8: Excel 报告导出 ──
    print("\n▶ Step 8: Excel 报告导出")
    gen = ReportGenerator()
    xlsx_path = gen.export_report_data(
        df_loaded, linear_result, report,
        raw_col='原始值', ref_col='标准值'
    )
    print(f"  报告路径: {xlsx_path}")
    
    xlsx_check = pd.ExcelFile(xlsx_path)
    sheet_names = xlsx_check.sheet_names
    print(f"  Sheet 列表: {sheet_names}")
    assert '校准明细' in sheet_names, "校准明细 sheet 未生成"
    
    detail_df = pd.read_excel(xlsx_path, sheet_name='校准明细')
    print(f"  校准明细行数: {len(detail_df)}")
    print(f"  校准明细列: {detail_df.columns.tolist()}")
    assert '校准后' in detail_df.columns, "校准明细缺少 '校准后' 列"
    assert '残差' in detail_df.columns, "校准明细缺少 '残差' 列"
    assert len(detail_df) > 0, "校准明细为空"
    print("  ✅ Excel 报告导出通过（校准明细已写入）")

    # ── Step 9: HTML 报告导出 ──
    print("\n▶ Step 9: HTML 报告导出")
    figs = []
    figs.append(gen.create_calibration_curve(
        raw_values, ref_values,
        np.array(linear_result.corrected_values),
        np.array(linear_result.residuals)
    ))
    figs.append(gen.create_error_histogram(np.array(linear_result.residuals)))
    
    error_stats = calibrator.get_error_statistics(raw_values, ref_values)
    summary_df = gen.create_summary_table(linear_result, error_stats)
    
    html_path = gen.generate_html_report(
        figs, summary_df, warnings,
        detector.get_suggested_actions()
    )
    print(f"  HTML 报告路径: {html_path}")
    assert Path(html_path).exists(), "HTML 报告未生成"
    html_size = Path(html_path).stat().st_size
    print(f"  HTML 报告大小: {html_size} bytes")
    assert html_size > 1000, "HTML 报告过小"
    print("  ✅ HTML 报告导出通过")

    # ── 最终结果 ──
    print("\n" + "=" * 60)
    if passed:
        print("✅ 全部端到端测试通过")
    else:
        print("❌ 存在失败项，请检查上方输出")
    print("=" * 60)
    return passed


if __name__ == '__main__':
    e2e_test()
