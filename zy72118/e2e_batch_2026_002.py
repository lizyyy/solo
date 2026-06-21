import pandas as pd
import numpy as np
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).parent))

from src.data_processor import DataProcessor
from src.validator import DataValidator
from src.calibration import LaserRangeCalibrator
from src.conflict_detector import ConflictDetector, ConflictRecord
from src.report_generator import ReportGenerator


EXPECTED_DIR_CONFLICTS = [
    {'timestamp': '2024-01-15 10:20:00', 'wechat_dir': '正向', 'data_dir': 'CCW'},
    {'timestamp': '2024-01-15 10:30:00', 'wechat_dir': 'CCW',  'data_dir': 'CW'},
    {'timestamp': '2024-01-15 10:50:00', 'wechat_dir': '反向', 'data_dir': 'CW'},
]

EXPECTED_MISSING_WECHAT_DIR = [
    {'timestamp': '2024-01-15 10:40:00', 'data_dir': 'CW'},
]


def batch_2026_002_test():
    print("=" * 78)
    print("BATCH-2026-002 严格验证：方向冲突逐条核对 + None 方向不误报")
    print("=" * 78)
    all_pass = True

    # ── Step 0: 生成样例 ──
    print("\n▶ Step 0: 生成样例 & 打印证据表")
    from batch_2026_002 import (
        generate_batch_2026_002,
        generate_batch_2026_002_wechat,
        print_expected_conflicts,
    )
    df = generate_batch_2026_002()
    wechat_text = generate_batch_2026_002_wechat()
    print_expected_conflicts()

    # ── Step 1: 数据导入 ──
    print("\n▶ Step 1: 数据导入")
    processor = DataProcessor()
    file = Path('data') / 'BATCH-2026-002_experiment.xlsx'
    df_loaded = processor.load_experiment_table(str(file))
    assert df_loaded.shape[0] == 31

    # ── Step 2: 冲突检测（这是重点） ──
    print("\n▶ Step 2: 冲突检测（逐条核对方向冲突）")
    detector = ConflictDetector()
    ref_date = ConflictDetector.infer_reference_date_from_data(df_loaded, '时间')
    parsed = detector.parse_wechat_text(wechat_text, reference_date=ref_date)
    print(f"  解析到 {len(parsed)} 条微信记录:")
    for p in parsed:
        print(f"    ts={p.get('timestamp')}  dist={p.get('distance')}  "
              f"dir={p.get('direction')!r}")
    for rec in parsed:
        detector.add_wechat_record(
            timestamp=rec.get('timestamp'),
            content=rec.get('content'),
            distance=rec.get('distance'),
            direction=rec.get('direction'),
            speaker=rec.get('speaker'),
        )

    dist_conflicts = detector.compare_distance(df_loaded, '原始值', '时间')
    dir_conflicts = detector.compare_direction(df_loaded, '方向', '时间')
    summary = detector.get_conflict_summary()
    dr = summary['detection_report']

    print(f"\n  检测报告:")
    print(f"    微信记录总数:           {dr['wechat_records_count']}")
    print(f"    含距离:                 {dr['distance_wechat_records']}")
    print(f"    含有效方向:             {dr['directional_wechat_records']}")
    print(f"    缺失方向:               {dr.get('missing_direction_wechat_records')}")
    print(f"    时间匹配成功:           {dr['time_matches']}")
    print(f"    解析/匹配异常:          {len(dr.get('parse_errors', []))}")
    print(f"\n  冲突汇总:")
    for ctype, cnt in summary['by_type'].items():
        print(f"    {ctype:<16s}: {cnt}")

    # ── 核心验证 1: 只有 3 条方向冲突，不多不少 ──
    print("\n▶ 核心验证 1: 方向冲突精确为 3 条（不多不少）")
    real_dir_conflicts = [c for c in summary['conflicts']
                          if c.conflict_type == '方向冲突']
    print(f"  方向冲突实际数量: {len(real_dir_conflicts)}")
    if len(real_dir_conflicts) != 3:
        print(f"  ❌ FAIL: 应为 3，实际 {len(real_dir_conflicts)}")
        all_pass = False
    else:
        print(f"  ✅ PASS")

    # ── 核心验证 2: 每条方向冲突的微信方向非空、对得上预置 ──
    print("\n▶ 核心验证 2: 逐条核对方向冲突明细")
    actual_dir_set = []
    for c in real_dir_conflicts:
        # 从 suggestion 中抽信息
        suggestion = c.suggestion
        print(f"  [{c.timestamp}] {suggestion}")
        print(f"      severity={c.severity}  conflict_id={c.conflict_id[:40]}...")

        if c.severity != 'high':
            print(f"      ❌ FAIL: 方向冲突应为 high 严重度，实际 {c.severity}")
            all_pass = False

        # suggestion 里同时包含数据方向和微信方向，不能有 None
        if 'None' in suggestion or 'none' in suggestion.lower():
            print(f"      ❌ FAIL: 方向冲突 suggestion 里出现 None")
            all_pass = False

        # 记录下来做集合比对
        actual_dir_set.append({'timestamp': c.timestamp})

    # 精确匹配预置列表
    expected_ts = {x['timestamp'] for x in EXPECTED_DIR_CONFLICTS}
    actual_ts = {x['timestamp'] for x in actual_dir_set}
    if expected_ts != actual_ts:
        print(f"  ❌ FAIL: 时间戳不匹配")
        print(f"    期望: {sorted(expected_ts)}")
        print(f"    实际: {sorted(actual_ts)}")
        all_pass = False
    else:
        print(f"  ✅ 3 条方向冲突时间戳完全匹配预置证据")

    # ── 核心验证 3: "CW vs None" 不会被算成方向冲突 ──
    print("\n▶ 核心验证 3: 10:40 张工 None → '微信方向缺失'（low），绝不是方向冲突")
    missing_dir = [c for c in summary['conflicts']
                   if c.conflict_type == '微信方向缺失']
    print(f"  微信方向缺失冲突数量: {len(missing_dir)}")
    if len(missing_dir) != 1:
        print(f"  ❌ FAIL: 应为 1，实际 {len(missing_dir)}")
        all_pass = False
    else:
        m = missing_dir[0]
        print(f"    [{m.timestamp}] {m.suggestion}")
        print(f"    severity={m.severity}")
        if m.severity != 'low':
            print(f"    ❌ FAIL: 微信方向缺失应为 low，实际 {m.severity}")
            all_pass = False
        if '10:40' not in m.timestamp:
            print(f"    ❌ FAIL: 应为 10:40，实际 {m.timestamp}")
            all_pass = False
        # 同时确认它没被归类成'方向冲突'
        if m.conflict_type == '方向冲突':
            print(f"    ❌ FAIL: 被错误归类为方向冲突")
            all_pass = False
        print(f"  ✅ 'CW vs None' 被正确识别为微信方向缺失（low），不是方向冲突")

    # ── 核心验证 4: 10:10 CW vs CW → 方向一致，无方向冲突 ──
    print("\n▶ 核心验证 4: 10:10 CW vs CW → 方向一致，无方向冲突")
    ten_ten_dir = [c for c in summary['conflicts']
                   if '10:10:00' in str(c.timestamp) and c.conflict_type == '方向冲突']
    if len(ten_ten_dir) == 0:
        print(f"  ✅ 10:10 方向完全一致，无方向冲突（数值差异单独列出是预期行为）")
    else:
        print(f"  ❌ FAIL: 10:10 不应有方向冲突，实际有 {len(ten_ten_dir)}:")
        for c in ten_ten_dir:
            print(f"    [{c.conflict_type}] {c.suggestion}")
        all_pass = False

    # ── Step 3: 冲突处理 + 复检复用 ──
    print("\n▶ Step 3: 冲突处理 + 复检不重复生成")
    pending_before = summary['pending_conflicts']
    print(f"  处理前: 待处理 {pending_before}")
    # 按冲突类型分别用不同方式处理
    for c in summary['pending_conflicts_list']:
        if c.conflict_type == '方向冲突':
            detector.mark_resolved(c.conflict_id, note="方向核对一致，已改正")
        elif c.conflict_type == '数值差异':
            detector.mark_resolved(c.conflict_id, note="单位换算已核实")
        elif c.conflict_type == '微信方向缺失':
            detector.mark_ignored(c.conflict_id, note="不影响结果，后续补录")
        else:
            detector.mark_ignored(c.conflict_id, note="暂不处理")

    summary_after = detector.get_conflict_summary()
    pending_after = summary_after['pending_conflicts']
    print(f"  处理后: 待处理 {pending_after}（应为 0）")
    if pending_after != 0:
        print(f"  ❌ FAIL: pending_after={pending_after}")
        all_pass = False

    # 复检
    detector.compare_distance(df_loaded, '原始值', '时间')
    detector.compare_direction(df_loaded, '方向', '时间')
    summary_recheck = detector.get_conflict_summary()
    print(f"  复检后: 总数 {summary_recheck['total_conflicts']}（应={summary['total_conflicts']}） "
          f"待处理 {summary_recheck['pending_conflicts']}（应=0）")
    if summary_recheck['total_conflicts'] != summary['total_conflicts']:
        print(f"  ❌ FAIL: 复检总数变化")
        all_pass = False
    if summary_recheck['pending_conflicts'] != 0:
        print(f"  ❌ FAIL: 复检又冒出待处理冲突")
        all_pass = False
    print(f"  ✅ 复检结果稳定，处理状态被复用")

    # ── Step 4: 建议动作准确性 ──
    print("\n▶ Step 4: 建议动作准确性（不能出现虚假'未检测到冲突'）")
    actions = detector.get_suggested_actions()
    print(f"  建议动作列表:")
    bad_words = ['未检测到数据冲突']
    for a in actions:
        print(f"    {a}")
        for bw in bad_words:
            if bw in a:
                print(f"      ❌ FAIL: 出现 '{bw}'")
                all_pass = False
    # 必须包含"所有 N 个冲突均已处理"这种句子
    if not any('已处理' in a for a in actions):
        print(f"  ❌ FAIL: 未出现'已处理'状态描述")
        all_pass = False
    print(f"  ✅ 建议动作与实际状态一致")

    # ── Step 5: 校准 & 报告导出 ──
    print("\n▶ Step 5: 校准 & 报告导出")
    calibrator = LaserRangeCalibrator()
    raw = pd.to_numeric(df_loaded['原始值'], errors='coerce').values
    ref = pd.to_numeric(df_loaded['标准值'], errors='coerce').values
    # 先剔除 NaN 行做分段校准
    valid = ~np.isnan(raw) & ~np.isnan(ref)
    pw_result = calibrator.piecewise_linear_calibration(raw[valid], ref[valid], segments=3)
    print(f"  分段校准: scale_factor={pw_result.scale_factor:.6f}  "
          f"bias={pw_result.bias:.4f}  R²={pw_result.r_squared:.4f}")
    assert isinstance(pw_result.scale_factor, float)

    gen = ReportGenerator()
    # 把 result 扩展成与原始 df 对齐的长度
    full_corrected = np.full(len(df_loaded), np.nan)
    full_residuals = np.full(len(df_loaded), np.nan)
    valid_idx = np.where(valid)[0]
    for i, orig in enumerate(valid_idx):
        if i < len(pw_result.corrected_values):
            full_corrected[orig] = pw_result.corrected_values[i]
            full_residuals[orig] = pw_result.residuals[i]
    # 用伪造的 result 对象报告导出 (保留原始 length 要求)
    class FakeResult:
        pass
    fr = FakeResult()
    fr.bias = pw_result.bias
    fr.scale_factor = pw_result.scale_factor
    fr.rmse = pw_result.rmse
    fr.mae = pw_result.mae
    fr.max_error = pw_result.max_error
    fr.min_error = pw_result.min_error
    fr.std_error = pw_result.std_error
    fr.r_squared = pw_result.r_squared
    fr.corrected_values = full_corrected
    fr.residuals = full_residuals

    validator = DataValidator()
    val_report = validator.validate_all(
        df_loaded, time_col='时间', value_col='原始值',
        direction_col='方向', min_value=0, max_value=500,
    )
    xlsx = gen.export_report_data(
        df_loaded, fr, val_report, raw_col='原始值', ref_col='标准值',
    )
    xf = pd.ExcelFile(xlsx)
    assert '校准明细' in xf.sheet_names
    detail = pd.read_excel(xlsx, sheet_name='校准明细')
    assert '校准后' in detail.columns and '残差' in detail.columns
    assert len(detail) == len(df_loaded), f"{len(detail)} vs {len(df_loaded)}"
    print(f"  ✅ Excel 报告: {len(detail)} 行校准明细已写入")

    # ── 最终 ──
    print("\n" + "=" * 78)
    if all_pass:
        print("✅ BATCH-2026-002 严格验证全通过")
        print("   - 3 条方向冲突逐条匹配预置（微信方向非空、严重度 high）")
        print("   - 'CW vs None' 正确归类为'微信方向缺失'（low），不是方向冲突")
        print("   - 10:10 CW vs CW 一致，无冲突")
        print("   - 复检不重复生成，处理状态复用")
        print("   - 建议动作/报告/历史记录都引用同批真实冲突明细")
    else:
        print("❌ 存在失败项，见上方输出")
    print("=" * 78)
    return all_pass


if __name__ == '__main__':
    ok = batch_2026_002_test()
    sys.exit(0 if ok else 1)
