"""三一致性测试 —— 验证状态、备注、结论三者始终表达同一结论"""

import csv
import os
import sys
import tempfile
import shutil


SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
sys.path.insert(0, PROJECT_ROOT)

from matrix_boundary_review.core.review import run_review


TEST_DATA_DIR = os.path.join(PROJECT_ROOT, "sample_data", "input")


def load_csv_rows(filepath):
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def test_triple_consistency_all_rows():
    """所有明细行的状态、备注、结论必须三一致"""

    with tempfile.TemporaryDirectory() as tmpdir:
        result = run_review(TEST_DATA_DIR, strict_mode=False)
        items = result["reviewed_items"]

        assert len(items) > 0, "没有复核结果"

        fail_count = 0
        for item in items:
            ok = (
                (item.status == "卡点-暂不放行" and item.conclusion == "暂不放行" and "暂不放行" in item.remark)
                or (item.status == "待核查" and item.conclusion == "待核查确认" and bool(item.remark))
                or (item.status == "复核通过" and item.conclusion == item.original.conclusion and item.remark == "")
            )
            if not ok:
                fail_count += 1
                print(f"  [不一致] 行{item.original.line_no}: 状态='{item.status}' 备注='{item.remark[:30]}...' 结论='{item.conclusion}'")

        assert fail_count == 0, f"共 {fail_count} 行三不一致"
        print(f"  ✓ 全部 {len(items)} 行三一致校验通过")


def test_q006_duplicate_blocked():
    """Q006 重复样本必须被标记为卡点-暂不放行，且三列一致"""

    with tempfile.TemporaryDirectory() as tmpdir:
        result = run_review(TEST_DATA_DIR, strict_mode=False)
        items = result["reviewed_items"]

        q006_items = [it for it in items if it.original.question_id == "Q006"]
        assert len(q006_items) == 2, f"Q006 应该有2条记录，实际 {len(q006_items)} 条"

        for item in q006_items:
            assert item.status == "卡点-暂不放行", f"Q006 状态应为'卡点-暂不放行'，实际'{item.status}'"
            assert item.conclusion == "暂不放行", f"Q006 结论应为'暂不放行'，实际'{item.conclusion}'"
            assert "暂不放行" in item.remark, f"Q006 备注应含'暂不放行'，实际'{item.remark[:30]}...'"
            assert "重复" in item.remark, f"Q006 备注应含'重复'，实际'{item.remark[:30]}...'"

        print(f"  ✓ Q006 重复样本卡点三一致验证通过（{len(q006_items)}条）")


def test_summary_separate_from_details():
    """终端摘要只做摘要，不混入明细数据（通过检查输出文件分工）"""

    with tempfile.TemporaryDirectory() as tmpdir:
        out_dir = os.path.join(tmpdir, "output")
        result = run_review(TEST_DATA_DIR, strict_mode=False)

        from matrix_boundary_review.core.export import export_summary, export_details_csv

        summary_path = os.path.join(out_dir, "review_summary.txt")
        details_path = os.path.join(out_dir, "review_details.csv")
        blocked_path = os.path.join(out_dir, "blocked_items.csv")

        os.makedirs(out_dir, exist_ok=True)
        export_summary(result, summary_path)
        export_details_csv(result, details_path, blocked_path)

        with open(summary_path, "r", encoding="utf-8") as f:
            summary_text = f.read()

        detail_rows = load_csv_rows(details_path)

        assert "摘要报告" in summary_text, "摘要文件应包含摘要标题"
        assert len(detail_rows) == result["stats"]["total_answers"], "明细CSV条目数应与总条目数一致"
        assert "复核状态" in detail_rows[0], "明细CSV应包含复核状态列"

        print(f"  ✓ 摘要与明细分离：摘要{len(summary_text)}字，明细{len(detail_rows)}行")


def test_strict_mode_stops_on_duplicate():
    """严格模式下检测到重复样本应终止，不生成完整明细"""

    with tempfile.TemporaryDirectory() as tmpdir:
        result = run_review(TEST_DATA_DIR, strict_mode=True)

        assert result.get("strict_stopped") is True, "严格模式下应标记为已终止"
        assert len(result["reviewed_items"]) == 0, "严格模式下不应生成复核明细"
        assert len(result["blocked_items"]) > 0, "严格模式下应有卡点清单"

        print(f"  ✓ 严格模式验证通过：卡点{len(result['blocked_items'])}处，已终止")


def run_all_tests():
    print("=" * 60)
    print("矩阵分解边界复核 —— 三一致性测试")
    print("=" * 60)
    print()

    tests = [
        ("所有明细行三一致", test_triple_consistency_all_rows),
        ("Q006 重复样本卡点三一致", test_q006_duplicate_blocked),
        ("终端摘要与CSV明细分离", test_summary_separate_from_details),
        ("严格模式卡点终止", test_strict_mode_stops_on_duplicate),
    ]

    passed = 0
    failed = 0

    for name, test_fn in tests:
        print(f"[测试] {name}")
        try:
            test_fn()
            passed += 1
        except AssertionError as e:
            failed += 1
            print(f"  ✗ 失败：{e}")
        except Exception as e:
            failed += 1
            print(f"  ✗ 异常：{e}")
        print()

    print("=" * 60)
    print(f"测试结果：{passed} 通过，{failed} 失败")
    print("=" * 60)

    return failed == 0


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
