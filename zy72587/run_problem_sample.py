"""
出问题的样例：线上特征缺失给默认分导致结论不敢直接发
==================================================================
使用场景：
  推荐负责人晚上催结果时，评测运营小孟翻线上实验桶，
  发现"时间窗特征穿越检查"里有线上特征缺失却给了默认分的记录，
  结论不敢直接发。

本脚本：
  1. 用出问题的样例数据走完三步流程（导入→补看负样本→更新摘要）
  2. 停在导出明细查看状态
  3. 打印每条特征缺失默认分记录的状态变化、历史留痕、结果说明
  4. 验证页面/接口/导出三端数据完全一致
"""
import sys
import io
import json
import pandas as pd
from datetime import datetime, timedelta

sys.path.insert(0, ".")

from app.models import (
    FeatureRecord,
    CheckParameters,
    RecordStatus,
    ConflictResolution,
)
from app.workflow import WorkflowManager
from app.result_store import UnifiedResultStore
from app.self_check import check_export_consistency


def make_window(day_start=1, day_end=8):
    return (
        datetime(2024, 1, day_start, 0, 0, 0),
        datetime(2024, 1, day_end, 0, 0, 0),
    )


def make_sample(
    sid, fid, fname, bucket_id="exp_prod_bucket",
    value=None, default_used=False, hours_gap=72,
    day_s=1, day_e=8,
):
    s, e = make_window(day_s, day_e)
    ft = None if (value is None or default_used) else e - timedelta(hours=hours_gap)
    return FeatureRecord(
        feature_id=fid,
        feature_name=fname,
        bucket_id=bucket_id,
        sample_id=sid,
        feature_value=value,
        default_value_used=default_used,
        time_window_start=s,
        time_window_end=e,
        feature_timestamp=ft,
    )


def main():
    print("=" * 90)
    print("  场景复现：推荐负责人晚上催结果，小孟发现线上特征缺失给默认分不敢发结论")
    print("=" * 90)

    wf = WorkflowManager()

    # -------- 用指定参数：模仿线上环境（24h安全间隔，v1.5版本参数）--------
    params = CheckParameters(
        time_window_gap_hours=24,
        leakage_threshold_ratio=0.8,
        default_fill_strategy="zero",
        default_fill_value=0.0,
        parameter_version="v1.5-2024-06-night",
        rationale=(
            "本次使用夜间版本参数：24h安全间隔根据近3个月A/B测试选取，"
            "可覆盖95%以上用户行为窗口；默认值zero策略避免中位数偏差，"
            "但会使特征缺失记录下探0分，需负责人确认是否接受。"
        ),
    )

    # ================================================================
    # 步骤1：小孟导入线上实验桶（模拟推荐负责人催结果时翻线上实验桶）
    # ================================================================
    print("\n" + "=" * 90)
    print("▶ 步骤1：评测运营小孟导入线上实验桶（exp_prod_bucket）")
    print("=" * 90)
    session = wf.create_session(created_by="xiaomeng")
    print(f"  会话ID：{session.session_id}")
    print(f"  创建人：{session.created_by}")
    print(f"  参数版本：{params.parameter_version}")
    print(f"  参数理由：{params.rationale}")

    # 样例数据：故意放几个有问题的记录
    bucket_samples = [
        make_sample("user_0001", "clk_7d", "用户近7天点击量", value=128, default_used=False, hours_gap=72),
        make_sample("user_0002", "clk_7d", "用户近7天点击量", value=None, default_used=True),  # 出问题：缺失给默认分
        make_sample("user_0003", "clk_7d", "用户近7天点击量", value=56, default_used=False, hours_gap=10),  # 穿越
        make_sample("user_0002", "conv_rt", "用户转化率", value=None, default_used=True),  # 出问题：缺失给默认分
        make_sample("user_0004", "clk_7d", "用户近7天点击量", value=201, default_used=False, hours_gap=48),
        make_sample("user_0005", "dwell_s", "用户平均停留时长(s)", value=None, default_used=True),  # 出问题
        make_sample("user_0006", "clk_7d", "用户近7天点击量", value=87, default_used=False, hours_gap=2),  # 严重穿越
    ]
    print(f"  导入样本数：{len(bucket_samples)}")

    session = wf.step1_import_bucket(session.session_id, bucket_samples, params)
    store = UnifiedResultStore(session)
    summary = store.get_summary_data()

    print(f"\n  ✅ 步骤1完成后的状态：")
    print(f"     - 待推荐负责人复核(特征缺失给默认分)：{summary['pending_review_count']} 条")
    print(f"     - 已检测出时间窗穿越：{summary['status_counts'].get('abnormal', 0)} 条")
    print(f"     - 自检通过？ 所有自检项：{[(r['check_type'], r['passed'], r['found_issues']) for r in summary['self_check_results']]}")

    # ================================================================
    # 步骤2：小孟补看负样本列表
    # ================================================================
    print("\n" + "=" * 90)
    print("▶ 步骤2：评测运营小孟补看负样本列表（对照线上桶）")
    print("=" * 90)

    negative_samples = [
        make_sample("user_0001", "clk_7d", "用户近7天点击量", bucket_id="neg_ref", value=128, hours_gap=72),
        make_sample("user_0002", "clk_7d", "用户近7天点击量", bucket_id="neg_ref", value=5, hours_gap=36),  # 与线上缺失冲突
        make_sample("user_0003", "clk_7d", "用户近7天点击量", bucket_id="neg_ref", value=56, hours_gap=10),
        make_sample("user_0002", "conv_rt", "用户转化率", bucket_id="neg_ref", value=None, default_used=True),  # 双方都缺失
        make_sample("user_0004", "clk_7d", "用户近7天点击量", bucket_id="neg_ref", value=199, hours_gap=48),  # 值不一致冲突
        make_sample("user_0005", "dwell_s", "用户平均停留时长(s)", bucket_id="neg_ref", value=None, default_used=True),
        make_sample("user_0006", "clk_7d", "用户近7天点击量", bucket_id="neg_ref", value=87, hours_gap=2),
        make_sample("user_0007", "imp_7d", "用户近7天曝光量", bucket_id="neg_ref", value=450, hours_gap=60),  # 线上桶缺失
    ]
    print(f"  负样本数：{len(negative_samples)}")
    session = wf.step2_review_negatives(session.session_id, negative_samples)
    store = UnifiedResultStore(session)
    summary = store.get_summary_data()

    print(f"\n  ✅ 步骤2完成后的状态：")
    print(f"     - 检测到冲突总数：{summary['conflict_count']} 个")
    print(f"     - 待推荐负责人复核(特征缺失)：{summary['pending_review_count']} 条")
    print(f"     - 时间窗穿越：{summary['status_counts'].get('abnormal', 0)} 条")
    print(f"\n  📋 冲突明细（系统仅列出证据，不替小孟自动拍板）：")
    for c in summary["conflict_details"][:3]:
        print(f"     · {c}")

    # -------- 小孟手动处理冲突（不自动拍板）--------
    print("\n  🔧 小孟手动处理冲突，逐个确认/驳回：")
    session_data = wf.get_session(session.session_id)
    for idx, conflict in enumerate(session_data.conflicts, 1):
        if conflict.record_id in ("user_0007-imp_7d",):
            resolution = ConflictResolution.REJECT
            txt = "驳回(负样本独有特征，线上没收集到，判定异常)"
        else:
            resolution = ConflictResolution.CONFIRM
            txt = "确认(以线上桶为准，负样本作参考)"
        session = wf.resolve_conflict(session.session_id, conflict.record_id, resolution, "xiaomeng")
        print(f"     [{idx}] 样本 {conflict.record_id} → 小孟选择「{txt}」")

    store = UnifiedResultStore(session)
    summary = store.get_summary_data()
    print(f"\n  冲突处理完成后：待复核={summary['pending_review_count']}条，流程锁定？{summary['is_locked']}")

    # ================================================================
    # 停在「导出明细查看状态」→ 不走下一步，只打印细节
    # ================================================================
    print("\n" + "=" * 90)
    print("⏸ 按你的要求：停在导出明细查看状态 —— 检查状态变化/历史留痕/结果说明")
    print("   （如果这里直接走步骤3，就会让结论在没有负责人复核时发出）")
    print("=" * 90)

    page_data = store.get_all_records_for_page()
    api_data = store.get_all_records_for_api()
    export_data = store.get_all_records_for_export()
    consistency = check_export_consistency(page_data, api_data, export_data)

    print(f"\n【核心验证点】页面/接口/导出三端数据一致性：")
    print(f"  ✅ 通过：{consistency.passed}   发现问题：{consistency.found_issues}")
    print(f"  详细：{consistency.details}")

    missing_records = [r for r in export_data if "默认分" in str(r.get("是否使用了默认填充值", ""))]
    print(f"\n【重点】线上特征缺失却给了默认分的记录，共 {len(missing_records)} 条 —— 结论不敢直接发的原因：")

    for i, rec in enumerate(missing_records, 1):
        print(f"\n{'─' * 80}")
        print(f"  缺省记录 #{i}：样本={rec['样本ID']} | 特征={rec['特征名称']} | 来源={rec['数据来源']}")
        print(f"{'─' * 80}")
        print(f"  📊 数值对比：")
        print(f"     原始值(线上回传)：{rec['特征原始值(线上回传)']}")
        print(f"     默认填充值：      {rec['默认填充数值']}   策略：{rec['填充策略']}")
        print(f"     当前展示值：      {rec['特征当前展示值']}")
        print(f"  🚦 最终状态：{rec['最终状态(中文)']} [{rec['最终状态(英文)']}]")
        print(f"  📌 参数版本紧邻：{rec['应用参数版本']}")
        print(f"  🎯 结果说明(可解释)：")
        for line in rec['结果说明(可解释)'].split("。"):
            if line.strip():
                print(f"     · {line.strip()}。")
        print(f"  📜 历史留痕(完整状态变更链)：")
        for ev in rec['历史留痕(完整状态变更链)'].split(" | "):
            if ev.strip():
                print(f"     · {ev.strip()}")

    print(f"\n📝 完整操作流水（小孟从创建会话到此刻的所有操作，顺序可追溯）：")
    for line in summary['operation_log']:
        print(f"  {line}")

    # ================================================================
    # 最后：尝试调用导出接口生成的DataFrame（模拟导出Excel效果）
    # ================================================================
    print("\n" + "=" * 90)
    print("📄 模拟导出：Excel会有7个Sheet，此处仅打印前3个的关键列")
    print("=" * 90)

    df_export = pd.DataFrame(export_data)
    key_columns = [
        "样本ID", "特征名称", "数据来源", "特征原始值(线上回传)",
        "特征当前展示值", "是否使用了默认填充值", "最终状态(中文)",
        "应用参数版本", "结果说明(可解释)",
    ]
    print(f"\n  ✅ Sheet1「检查明细(与页面/接口同源)」重点列预览：")
    print(df_export[key_columns].to_string(index=False))

    df_missing = pd.DataFrame([
        {"序号": i+1,
         "特征缺失给默认分的记录": f"样本={r['样本ID']} | 特征={r['特征名称']} | 原始值={r['特征原始值(线上回传)']}→填充值={r['默认填充数值']}",
         "当前状态": r["最终状态(中文)"] + " → 结论不能直接发，需推荐负责人复核",
         "参数版本": r["应用参数版本"]}
        for i, r in enumerate(missing_records)
    ])
    print(f"\n  ✅ Sheet2「特征缺失默认分重点」(这就是小孟不敢直接发结论的核心依据)：")
    print(df_missing.to_string(index=False))

    conflicts_list = store.get_conflicts_for_export()
    if conflicts_list:
        df_conflicts = pd.DataFrame(conflicts_list)
        print(f"\n  ✅ Sheet3「冲突证据清单」(含处理历史)：")
        print(df_conflicts[["样本ID", "线上实验桶取值", "负样本列表取值",
                             "冲突描述", "处理状态", "处理人(评测运营)"]].to_string(index=False))

    print(f"\n  ✅ Sheet4「自检结果」包含：三端一致性实时检查")
    print(f"  ✅ Sheet5「参数版本与取舍理由」版本号：{params.parameter_version}")
    print(f"  ✅ Sheet6「完整操作流水」共{len(summary['operation_log'])}条")

    # ================================================================
    # 最终验证：如果此时点下一步(步骤3)但不填reviewer，应该被拦住
    # ================================================================
    print("\n" + "=" * 90)
    print("🚫 额外验证：此时若直接跳过推荐负责人复核，系统会拦截")
    print("=" * 90)
    try:
        wf.step3_update_summary(session.session_id, "假装完成检查", reviewer=None)
        print("  ❌ 错误：系统居然放行——需要修复！")
    except ValueError as ex:
        print(f"  ✅ 正确拦截：{ex}")

    print("\n" + "=" * 90)
    print("✅ 样例执行完毕。结论：")
    print("  1. 线上特征缺失给默认分的记录，状态=待推荐负责人复核，不会自动归正常")
    print("  2. 页面/接口/导出三端读取完全同一份数据（三端一致性检查通过）")
    print("  3. 每条记录的状态变化、触发人、触发原因、参数版本都有历史留痕")
    print("  4. 参数版本和取舍理由紧邻结果说明展示")
    print("  5. 不填推荐负责人，流程会被拦截在步骤3之前，结论不能直接发")
    print("=" * 90)

    return session.session_id


if __name__ == "__main__":
    main()
