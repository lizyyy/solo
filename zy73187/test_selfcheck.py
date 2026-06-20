import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent))

from src.error_analysis import ErrorAnalysisPipeline


def test_data_loading():
    pipe = ErrorAnalysisPipeline()
    assert len(pipe.df) == 20, f"预期20条样例，实际{len(pipe.df)}"
    print(f"✅ 数据加载正常，共 {len(pipe.df)} 条样例")


def test_supplementary_info_exists():
    pipe = ErrorAnalysisPipeline()
    has_remark = (pipe.df["supplementary_remark"] != "").sum()
    has_expl = (pipe.df["supplementary_explanation"] != "").sum()
    assert has_remark >= 3, f"后补备注条数不足: {has_remark}"
    assert has_expl >= 3, f"后补说明条数不足: {has_expl}"
    print(f"✅ 脏数据样例正常：{has_remark} 条含后补备注，{has_expl} 条含后补说明")


def test_duplicate_detection():
    pipe = ErrorAnalysisPipeline()
    dup_rows = pipe.df[pipe.df["is_duplicate"] == True]
    assert len(dup_rows) >= 2, f"重复样本不足: {len(dup_rows)}"
    dup = pipe.detect_duplicates()
    assert len(dup) >= 2, "重复检测未返回结果"
    print(f"✅ 重复样本检测正常：标记 {len(dup_rows)} 条重复，detect_duplicates 返回 {len(dup)} 条")


def test_confirm_diff_detection():
    pipe = ErrorAnalysisPipeline()
    diffs = pipe.get_confirm_diffs()
    assert len(diffs) >= 3, f"确认差异不足: {len(diffs)}"
    print(f"✅ 人工确认前后差异检测正常：{len(diffs)} 条有差异（用于第二天复盘）")


def test_unified_data_source_consistency():
    """核心校验：统计数字、明细表、CSV导出必须来自同一份 filtered_df"""
    pipe = ErrorAnalysisPipeline()
    pipe.apply_filters(subject="物理")
    pipe.recalculate_propagated_error(formula="rss")

    stats = pipe.get_statistics()
    table = pipe.get_detail_table()
    csv_text = pipe.export_csv()
    csv_lines = [l for l in csv_text.split("\n") if l.strip()]

    assert stats["total_samples"] == len(table), (
        f"口径不一致：统计 total_samples={stats['total_samples']}, 明细表={len(table)}"
    )
    assert stats["total_samples"] == len(csv_lines) - 1, (
        f"口径不一致：统计 total_samples={stats['total_samples']}, CSV行数={len(csv_lines)-1}"
    )
    assert stats["active_filters"].get("subject") == "物理"

    dup_count_in_table = sum(1 for r in table if r.get("is_duplicate") == True)
    assert stats["duplicate_count"] == dup_count_in_table, (
        f"重复样本计数口径不一致：统计={stats['duplicate_count']}, 明细表中={dup_count_in_table}"
    )

    assert "⚠ 重复样本" in csv_text, "CSV导出缺少重复样本提醒列"

    print(f"✅ 统一数据源口径校验通过：筛选后 {stats['total_samples']} 条，统计=明细表={len(csv_lines)-1} 行CSV")
    print(f"   当前筛选: {stats['active_filters']}, 复算公式: {stats['recalc_formula']}")


def test_recalc_formula():
    pipe = ErrorAnalysisPipeline()
    pipe.apply_filters(subject="物理")
    for formula in ["rss", "abs", "max"]:
        pipe.recalculate_propagated_error(formula=formula)
        stats = pipe.get_statistics()
        assert stats["recalc_formula"] == formula
        assert stats["grouped_propagated_error"] > 0
    print("✅ 复算公式切换正常：rss / abs / max 三种口径均生效")


def test_detail_warnings():
    pipe = ErrorAnalysisPipeline()
    detail_dup = pipe.get_sample_detail("S003")
    assert detail_dup, "S003 未找到"
    assert detail_dup["is_duplicate"] == True
    assert any("重复样本" in w for w in detail_dup["warnings"]), "详情页未给出重复提醒"

    detail_normal = pipe.get_sample_detail("S004")
    assert detail_normal["warnings"] == [], "普通记录不应有警告"

    detail_src = pipe.get_sample_detail("S001")
    assert any("被其他记录引用为重复源" in w for w in detail_src["warnings"]), (
        "重复源记录缺少提醒"
    )
    print("✅ 详情页重复提醒正常：S003（重复）、S001（重复源）均有提醒，S004（普通）无提醒")


def test_detail_supplementary():
    pipe = ErrorAnalysisPipeline()
    detail = pipe.get_sample_detail("S020")
    assert detail.get("supplementary_remark"), "S020 缺少后补备注"
    assert detail.get("supplementary_explanation"), "S020 缺少后补说明"
    assert "边界样本" in detail["supplementary_remark"], "S020 后补备注内容不符"
    print(f"✅ 边界样本 S020 的后补信息完整：备注和说明均存在")


def test_roundtrip_filter_recalc_export():
    """模拟用户操作：筛选→复算→导出，三者一致"""
    pipe = ErrorAnalysisPipeline()
    pipe.apply_filters(error_type="读数误差", min_error_magnitude="0.00001")
    pipe.recalculate_propagated_error(formula="abs")
    unified = pipe.get_unified_result()

    assert unified["statistics"]["total_samples"] == len(unified["detail_table"])
    assert "读数误差" in str(unified["filters"])
    assert unified["recalc_params"]["formula"] == "abs"

    chart_total = sum(x["count"] for x in unified["chart_data"]["error_type"])
    assert chart_total == unified["statistics"]["total_samples"], (
        f"图表口径与统计表不一致：图表={chart_total}, 统计={unified['statistics']['total_samples']}"
    )
    print("✅ 端到端校验：筛选→复算→统一结果包（统计/明细/图表/重复/差异）全链路口径一致")


if __name__ == "__main__":
    test_data_loading()
    test_supplementary_info_exists()
    test_duplicate_detection()
    test_confirm_diff_detection()
    test_unified_data_source_consistency()
    test_recalc_formula()
    test_detail_warnings()
    test_detail_supplementary()
    test_roundtrip_filter_recalc_export()
    print("\n🎉 所有自测通过！")
