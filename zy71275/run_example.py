from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from credit_score_monotonic import (
    BinRecord,
    CheckConfig,
    CheckReport,
    MonotonicChecker,
    MonotonicDirection,
    ReportGenerator,
    Severity,
)


def load_example_data():
    example_path = os.path.join(os.path.dirname(__file__), "example_input.json")
    with open(example_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    feature_bins = {}
    for feature_name, bin_list in data["features"].items():
        bins = []
        for item in bin_list:
            bins.append(
                BinRecord(
                    bin_name=item["bin_name"],
                    bad_count=int(item["bad_count"]),
                    total_count=int(item["total_count"]),
                    score_weight=float(item["score_weight"]),
                    is_missing=bool(item.get("is_missing", False)),
                )
            )
        feature_bins[feature_name] = bins
    return feature_bins


def assert_equal(actual, expected, message=""):
    if actual != expected:
        raise AssertionError(f"{message}\n  期望: {expected}\n  实际: {actual}")


def assert_in(item, container, message=""):
    if item not in container:
        raise AssertionError(f"{message}\n  '{item}' 不在 {container} 中")


def test_perfect_pass_feature():
    """【验证】完美分箱无任何问题 → PASS"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("C", 20, 200, 6.0),
        BinRecord("D", 40, 200, 10.0),
    ]
    result = checker.check_feature("perfect_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.PASS, "完美分箱应标记为 PASS")
    assert_equal(len(result.violations), 0, "完美分箱应无单调违规")
    assert_equal(len(result.anomaly_flags), 0, "完美分箱应无异常标记")
    print("✓ test_perfect_pass_feature 通过")


def test_monotonic_violation_warning():
    """【验证】单调反转差值≤5% → WARNING 而非 PASS"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("C", 5, 200, 6.0),
        BinRecord("D", 40, 200, 10.0),
    ]
    result = checker.check_feature("reverse_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.WARNING, "单调违规应标记为 WARNING")
    assert len(result.violations) > 0, "单调反转应检测到违规"
    print("✓ test_monotonic_violation_warning 通过")


def test_monotonic_violation_fail():
    """【验证】单调反转差值>5% → FAIL"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    bins = [
        BinRecord("A", 2, 100, 1.0),
        BinRecord("B", 20, 100, 5.0),
        BinRecord("C", 5, 100, 10.0),
        BinRecord("D", 30, 100, 15.0),
    ]
    result = checker.check_feature("fail_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.FAIL, "严重单调违规应标记为 FAIL")
    print("✓ test_monotonic_violation_fail 通过")


def test_low_sample_warning():
    """【验证】低样本箱 → WARNING 而非 PASS"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 1, 10, 3.0),
        BinRecord("C", 20, 200, 6.0),
    ]
    result = checker.check_feature("low_sample_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.WARNING, "低样本箱应标记为 WARNING")
    assert any(a.flag_type == "LOW_SAMPLE" for a in result.anomaly_flags), "应检测到 LOW_SAMPLE 异常"
    print("✓ test_low_sample_warning 通过")


def test_missing_bin_warning():
    """【验证】缺失箱（占比≤阈值）→ WARNING 而非 PASS"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50, missing_bin_threshold=0.05))
    bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("MISSING", 8, 20, 5.0, is_missing=True),
    ]
    result = checker.check_feature("missing_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.WARNING, "缺失箱应标记为 WARNING")
    assert any(a.flag_type == "MISSING_BIN" for a in result.anomaly_flags), "应检测到 MISSING_BIN 异常"
    print("✓ test_missing_bin_warning 通过")


def test_high_missing_ratio_fail():
    """【验证】缺失箱占比>阈值 → FAIL"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50, missing_bin_threshold=0.05))
    bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("MISSING", 8, 100, 5.0, is_missing=True),
    ]
    result = checker.check_feature("high_missing_feature", "v1", bins)

    assert_equal(result.overall_severity, Severity.FAIL, "高占比缺失箱应标记为 FAIL")
    assert any(a.flag_type == "HIGH_MISSING_RATIO" for a in result.anomaly_flags), "应检测到 HIGH_MISSING_RATIO 异常"
    print("✓ test_high_missing_ratio_fail 通过")


def test_overall_pass_consistency():
    """【验证】整体通过判定：只有全部特征 PASS → overall_pass=True"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))

    all_pass_bins = {
        "feat1": [
            BinRecord("A", 5, 200, 1.0),
            BinRecord("B", 10, 200, 3.0),
            BinRecord("C", 20, 200, 6.0),
        ],
        "feat2": [
            BinRecord("X", 5, 200, 2.0),
            BinRecord("Y", 15, 200, 5.0),
            BinRecord("Z", 30, 200, 10.0),
        ],
    }
    report1 = checker.check(all_pass_bins, "v1")
    assert report1.overall_pass is True, "全部特征 PASS 时 overall_pass 应为 True"
    assert "全部特征通过" in report1.summary, "摘要应显示全部通过"
    print("✓ test_overall_pass_consistency - 全部PASS场景 通过")

    has_warning_bins = {
        "feat1": [
            BinRecord("A", 5, 200, 1.0),
            BinRecord("B", 10, 200, 3.0),
            BinRecord("C", 20, 200, 6.0),
        ],
        "feat2": [
            BinRecord("X", 5, 200, 1.0),
            BinRecord("Y", 1, 10, 3.0),
            BinRecord("Z", 20, 200, 6.0),
        ],
    }
    report2 = checker.check(has_warning_bins, "v1")
    assert report2.overall_pass is False, "有特征 WARNING 时 overall_pass 应为 False"
    assert "存在特征未通过" in report2.summary, "摘要应显示未通过"
    print("✓ test_overall_pass_consistency - 含WARNING场景 通过")


def test_summary_severity_consistency():
    """【验证】摘要中显示的通过/警告/不通过计数与实际结果一致"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    feature_bins = load_example_data()
    report = checker.check(feature_bins, "v2.1")

    actual_pass = sum(1 for r in report.results if r.overall_severity == Severity.PASS)
    actual_warn = sum(1 for r in report.results if r.overall_severity == Severity.WARNING)
    actual_fail = sum(1 for r in report.results if r.overall_severity == Severity.FAIL)

    expected_pass_line = f"通过: {actual_pass}  警告: {actual_warn}  不通过: {actual_fail}"
    assert_in(expected_pass_line, report.summary, "摘要中的计数应与实际结果一致")

    if actual_fail > 0 or actual_warn > 0:
        assert report.overall_pass is False, "存在 WARNING/FAIL 时 overall_pass 应为 False"
        assert "存在特征未通过" in report.summary, "摘要结论应与 overall_pass 一致"
    else:
        assert report.overall_pass is True, "全部 PASS 时 overall_pass 应为 True"
        assert "全部特征通过" in report.summary, "摘要结论应与 overall_pass 一致"

    print(f"✓ test_summary_severity_consistency 通过 (PASS={actual_pass}, WARNING={actual_warn}, FAIL={actual_fail})")


def test_reproducibility():
    """【验证】可复算性：相同输入产生相同结果"""
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    feature_bins = load_example_data()

    report1 = checker.check(feature_bins, "v2.1")
    report2 = checker.check(feature_bins, "v2.1")

    assert_equal(report1.input_hash, report2.input_hash, "input_hash 应一致")
    assert_equal(report1.config_hash, report2.config_hash, "config_hash 应一致")

    d1 = report1.to_dict()
    d2 = report2.to_dict()
    d1.pop("check_timestamp", None)
    d2.pop("check_timestamp", None)
    assert_equal(d1, d2, "除时间戳外所有字段应一致")

    print("✓ test_reproducibility 通过")


def test_cli_interface():
    """【验证】CLI接口可用且输出正确"""
    import subprocess

    result = subprocess.run(
        [
            sys.executable,
            "-m",
            "credit_score_monotonic",
            "--input",
            "example_input.json",
            "--model-version",
            "v2.1",
            "--output-dir",
            "test_cli_output",
        ],
        cwd=os.path.dirname(__file__),
        capture_output=True,
        text=True,
    )

    # 检查输出目录存在
    output_dir = os.path.join(os.path.dirname(__file__), "test_cli_output")
    assert os.path.exists(output_dir), "CLI输出目录应被创建"

    # 检查输出文件存在
    for suffix in ["_summary.txt", "_detail.json", "_bins.csv", "_violations.csv", "_anomalies.csv"]:
        filepath = os.path.join(output_dir, f"v2.1{suffix}")
        assert os.path.exists(filepath), f"输出文件 {filepath} 应存在"

    # 清理
    import shutil
    shutil.rmtree(output_dir, ignore_errors=True)

    print("✓ test_cli_interface 通过")


def run_all_tests():
    print("=" * 60)
    print("开始运行验证测试...")
    print("=" * 60)

    tests = [
        test_perfect_pass_feature,
        test_monotonic_violation_warning,
        test_monotonic_violation_fail,
        test_low_sample_warning,
        test_missing_bin_warning,
        test_high_missing_ratio_fail,
        test_overall_pass_consistency,
        test_summary_severity_consistency,
        test_reproducibility,
        test_cli_interface,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            test()
            passed += 1
        except AssertionError as e:
            print(f"✗ {test.__name__} 失败: {e}")
            failed += 1
        except Exception as e:
            print(f"✗ {test.__name__} 异常: {e}")
            failed += 1

    print("=" * 60)
    print(f"测试完成: {passed} 通过, {failed} 失败")
    print("=" * 60)

    if failed > 0:
        sys.exit(1)


def run_example():
    """运行示例并输出报告"""
    feature_bins = load_example_data()
    checker = MonotonicChecker(CheckConfig(min_sample_size=50))
    report = checker.check(feature_bins, model_version="v2.1")

    print(report.summary)
    print()

    output_dir = os.path.join(os.path.dirname(__file__), "example_output")
    files = ReportGenerator.export_report(
        report, output_dir=output_dir, prefix="v2.1"
    )
    print("报告文件已导出:")
    for ftype, fpath in files.items():
        print(f"  {ftype}: {fpath}")

    return report


if __name__ == "__main__":
    run_all_tests()
    print()
    run_example()
