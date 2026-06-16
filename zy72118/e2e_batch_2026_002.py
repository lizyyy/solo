import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from src.data_processor import DataProcessor
from src.validator import DataValidator
from src.calibration import LaserRangeCalibrator
from src.conflict_detector import ConflictDetector
from src.report_generator import ReportGenerator


def batch_2026_002_test():
    print("=" * 70)
    print("BATCH-2026-002 端到端验证：上传→验证→冲突检测→处理→复用→校准→报告")
    print("=" * 70)

    passed = True

    # ── Step 0: 生成 BATCH-2026-002 样例 ──
    print("\n▶ Step 0: 生成 BATCH-2026-002 样例数据")
    from batch_2026_002 import generate_batch_2026_002, generate_batch_2026_002_wechat
    df = generate_batch_2026_002()
    wechat_text = generate_batch_2026_002_wechat()

    # ── Step 1: 数据导入 ──
    print("\n▶ Step 1: 数据导入")
    processor = DataProcessor()
    file = Path('data') / 'BATCH-2026-002_experiment.xlsx'
    df_loaded = processor.load_experiment_table(str(file))
    assert df_loaded.shape[0] == 31, f"行数应为 31，实际 {df_loaded.shape[0]}"
    print(f"  ✅ 加载 {df_loaded.shape}")

    # ── Step 2: 数据验证 ──
    print("\n▶ Step 2: 数据验证")
    validator = DataValidator()
    report = validator.validate_all(
        df_loaded, time_col='时间', value_col='原始值',
        direction_col='方向', min_value=0, max_value=500
    )
    warnings = validator.get_warnings()
    print(f"  警告数: {len(warnings)}")
    dir_r = report.get('direction', {})
    assert 'CW' in dir_r.get('alias_values', []), "CW 应被识别为别名方向"
    assert 'CCW' in dir_r.get('alias_values', []), "CCW 应被识别为别名方向"
    assert 'UNKNOWN' in dir_r.get('ambiguous_values', []), "UNKNOWN 应在不可识别列表中"
    print(f"  ✅ CW/CCW 自动映射；UNKNOWN 标记为未知方向")

    # ── Step 3: 冲突检测（核心：方向冲突必须能识别） ──
    print("\n▶ Step 3: 冲突检测（含 DIR=CCW/正向对比）")
    detector = ConflictDetector()
    ref_date = ConflictDetector.infer_reference_date_from_data(df_loaded, '时间')
    print(f"  推断参考日期: {ref_date}")

    parsed = detector.parse_wechat_text(wechat_text, reference_date=ref_date)
    print(f"  解析到 {len(parsed)} 条微信记录")
    for p in parsed:
        print(f"    ts={p.get('timestamp')}  dist={p.get('distance')}  dir={p.get('direction')}")

    directional_count = sum(1 for p in parsed if p.get('direction') is not None)
    assert directional_count >= 4, f"应解析到至少 4 条带方向的记录，实际 {directional_count}"
    assert all(p.get('timestamp') and p['timestamp'].startswith('2024-01-15')
               for p in parsed if p.get('timestamp')), \
        "时间戳应被正确解析为 YYYY-MM-DD HH:MM:SS 格式，而不是人名"
    print(f"  ✅ 时间戳正确解析为日期+时间（非人名）")

    for rec in parsed:
        detector.add_wechat_record(**{k: rec.get(k) for k in
            ['timestamp', 'content', 'distance', 'direction', 'speaker']})

    dist_conflicts = detector.compare_distance(df_loaded, '原始值', '时间')
    dir_conflicts = detector.compare_direction(df_loaded, '方向', '时间')
    summary = detector.get_conflict_summary()
    dr = summary['detection_report']

    print(f"  距离冲突: {len(dist_conflicts)}")
    print(f"  方向冲突: {len(dir_conflicts)}")
    print(f"  检测报告: 微信 {dr['wechat_records_count']} 条 | 含距离 {dr['distance_wechat_records']} | "
          f"含方向 {dr['directional_wechat_records']} | 时间匹配 {dr['time_matches']}")

    assert len(dir_conflicts) >= 2, \
        f"FAIL: 方向冲突应至少 2 条（李工正向 vs 数据CCW；王工反向 vs 数据CW），实际 {len(dir_conflicts)}"
    print(f"  ✅ 方向冲突识别成功，共 {len(dir_conflicts)} 条")

    pending_before = summary['pending_conflicts']
    total_before = summary['total_conflicts']
    print(f"  冲突总数: {total_before}，待处理: {pending_before}")
    assert total_before > 0, "FAIL: 必须有冲突"

    # ── Step 4: 处理冲突并验证复用 ──
    print("\n▶ Step 4: 处理冲突 + 重新检测不重复生成")
    # 处理所有待处理冲突
    for i, c in enumerate(summary['pending_conflicts_list']):
        if i % 2 == 0:
            detector.mark_resolved(c.conflict_id, note=f"已核对，解决 #{i}")
        else:
            detector.mark_ignored(c.conflict_id, note=f"不影响结果，忽略 #{i}")

    summary_after = detector.get_conflict_summary()
    pending_after = summary_after['pending_conflicts']
    print(f"  处理后: 待处理 {pending_after}（应=0） | 已解决 {summary_after['resolved_conflicts']} | "
          f"已忽略 {summary_after['ignored_conflicts']}")
    assert pending_after == 0, f"FAIL: 处理后待处理冲突应为 0，实际 {pending_after}"

    # 重新执行一遍检测，验证处理结果不会被覆盖
    detector.compare_distance(df_loaded, '原始值', '时间')
    detector.compare_direction(df_loaded, '方向', '时间')
    summary_recheck = detector.get_conflict_summary()
    print(f"  重新检测后: 总数 {summary_recheck['total_conflicts']}（应={total_before}） | "
          f"待处理 {summary_recheck['pending_conflicts']}（应=0）")
    assert summary_recheck['total_conflicts'] == total_before, \
        "FAIL: 重新检测产生了新冲突，复用失效"
    assert summary_recheck['pending_conflicts'] == 0, \
        "FAIL: 重新检测后出现了新的待处理冲突"
    print(f"  ✅ 冲突处理结果被复用，未重复生成")

    actions = detector.get_suggested_actions()
    print(f"  收尾建议:")
    for a in actions:
        print(f"    {a}")
    assert not any("未检测到数据冲突" in a for a in actions), \
        "FAIL: 收尾说明不应出现旧的'未检测到数据冲突'"
    assert any("已处理" in a or "未发现新的冲突" in a for a in actions), \
        "FAIL: 收尾说明应反映已处理状态"
    print(f"  ✅ 收尾建议与实际处理状态一致")

    # ── Step 5: 校准（线性 + 分段） ──
    print("\n▶ Step 5: 误差校准")
    calibrator = LaserRangeCalibrator()
    raw = pd.to_numeric(df_loaded['原始值'], errors='coerce').values
    ref = pd.to_numeric(df_loaded['标准值'], errors='coerce').values

    linear_result = calibrator.linear_calibration(raw, ref)
    print(f"  线性校准: bias={linear_result.bias:.4f} scale={linear_result.scale_factor:.6f} "
          f"RMSE={linear_result.rmse:.4f} R²={linear_result.r_squared:.4f}")

    calibrator2 = LaserRangeCalibrator()
    pw_result = calibrator2.piecewise_linear_calibration(raw, ref, segments=3)
    print(f"  分段校准: bias={pw_result.bias:.4f} scale_factor={pw_result.scale_factor:.6f} "
          f"RMSE={pw_result.rmse:.4f} R²={pw_result.r_squared:.4f}")
    assert isinstance(pw_result.scale_factor, float), "分段校准 scale_factor 应为 float"
    assert isinstance(calibrator2.apply_correction(100.0), float), \
        "分段校准后 apply_correction 应返回 float"
    print(f"  ✅ 线性/分段校准 + apply_correction 全部正常")

    dir_stats = calibrator.direction_analysis(raw, ref, df_loaded['方向'].tolist())
    assert '正向' in dir_stats and '反向' in dir_stats, \
        f"FAIL: 方向分析应包含正向/反向（CW/CCW 映射），实际 {list(dir_stats.keys())}"
    print(f"  ✅ CW/CCW 被正确映射到正向/反向进行方向分析")

    # ── Step 6: 报告生成 ──
    print("\n▶ Step 6: 报告生成")
    gen = ReportGenerator()
    xlsx = gen.export_report_data(
        df_loaded, pw_result, report, raw_col='原始值', ref_col='标准值'
    )
    xf = pd.ExcelFile(xlsx)
    assert '校准明细' in xf.sheet_names, "FAIL: 校准明细 sheet 不存在"
    detail_df = pd.read_excel(xlsx, sheet_name='校准明细')
    assert '校准后' in detail_df.columns and '残差' in detail_df.columns
    assert len(detail_df) == len(df_loaded), \
        f"FAIL: 校准明细行数 {len(detail_df)} != 数据行数 {len(df_loaded)}"
    print(f"  ✅ Excel 报告: {xlsx}（{len(detail_df)} 行校准明细已写入）")

    figs = [
        gen.create_calibration_curve(
            raw, ref, np.array(pw_result.corrected_values), np.array(pw_result.residuals)
        ),
        gen.create_error_histogram(np.array(pw_result.residuals))
    ]
    summary_df = gen.create_summary_table(pw_result, {})
    html = gen.generate_html_report(figs, summary_df, warnings, actions)
    size = Path(html).stat().st_size
    assert size > 5000, f"FAIL: HTML 报告过小 ({size} bytes)"
    print(f"  ✅ HTML 报告: {html} ({size} bytes)")

    # ── 最终结果 ──
    print("\n" + "=" * 70)
    if passed:
        print("✅ BATCH-2026-002 全链路验证通过")
        print("   - 时间戳解析：从人名修复为日期+时间")
        print("   - 方向冲突：DIR=CCW/正向对比能被识别")
        print("   - 冲突复用：处理后重新检测不会重复生成")
        print("   - 收尾说明：与实际证据一致，无虚假'未检测到冲突'")
        print("   - 分段校准 & 校准明细：正常导出")
    else:
        print("❌ 存在失败项，请检查上方输出")
    print("=" * 70)
    return passed


if __name__ == '__main__':
    batch_2026_002_test()
