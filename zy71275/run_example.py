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
)


def run_example():
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

    config = CheckConfig(
        min_sample_size=50,
        monotonic_direction=MonotonicDirection.AUTO,
        bad_rate_tolerance=0.005,
        missing_bin_threshold=0.05,
    )

    checker = MonotonicChecker(config)
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


def verify_reproducibility():
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

    config = CheckConfig(
        min_sample_size=50,
        monotonic_direction=MonotonicDirection.AUTO,
        bad_rate_tolerance=0.005,
        missing_bin_threshold=0.05,
    )

    checker = MonotonicChecker(config)
    report1 = checker.check(feature_bins, model_version="v2.1")
    report2 = checker.check(feature_bins, model_version="v2.1")

    json1 = ReportGenerator.to_json(report1)
    json2 = ReportGenerator.to_json(report2)

    hash1 = report1.input_hash
    hash2 = report2.input_hash
    config_hash1 = report1.config_hash
    config_hash2 = report2.config_hash

    assert hash1 == hash2, f"输入哈希不一致: {hash1} != {hash2}"
    assert config_hash1 == config_hash2, f"配置哈希不一致: {config_hash1} != {config_hash2}"

    dict1 = report1.to_dict()
    dict2 = report2.to_dict()

    dict1.pop("check_timestamp", None)
    dict2.pop("check_timestamp", None)

    assert dict1 == dict2, "两次运行结果不一致(除时间戳外)"

    print("\n✓ 可复算性验证通过: 相同输入产生相同结果")
    print(f"  input_hash: {hash1}")
    print(f"  config_hash: {config_hash1}")


def verify_specific_scenarios():
    print("\n--- 场景验证 ---\n")

    checker = MonotonicChecker(CheckConfig(min_sample_size=50))

    print("[场景1] 完美单调递增 - 应通过")
    good_bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("C", 20, 200, 6.0),
        BinRecord("D", 40, 200, 10.0),
    ]
    r1 = checker.check_feature("perfect_feature", "v1", good_bins)
    print(f"  结果: {r1.overall_severity.value}, 违规数: {len(r1.violations)}, 异常数: {len(r1.anomaly_flags)}")

    print("\n[场景2] 单调反转 - 应不通过")
    reverse_bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("C", 5, 200, 6.0),
        BinRecord("D", 40, 200, 10.0),
    ]
    r2 = checker.check_feature("reversed_feature", "v1", reverse_bins)
    print(f"  结果: {r2.overall_severity.value}, 违规数: {len(r2.violations)}")
    for v in r2.violations:
        print(f"    {v.reason}")

    print("\n[场景3] 低样本箱 - 应告警")
    low_sample_bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 1, 10, 3.0),
        BinRecord("C", 20, 200, 6.0),
    ]
    r3 = checker.check_feature("low_sample_feature", "v1", low_sample_bins)
    print(f"  结果: {r3.overall_severity.value}, 异常数: {len(r3.anomaly_flags)}")
    for a in r3.anomaly_flags:
        print(f"    [{a.flag_type}] {a.detail}")

    print("\n[场景4] 缺失箱高占比 - 应不通过")
    missing_bins = [
        BinRecord("A", 5, 200, 1.0),
        BinRecord("B", 10, 200, 3.0),
        BinRecord("MISSING", 8, 100, 5.0, is_missing=True),
    ]
    r4 = checker.check_feature("missing_feature", "v1", missing_bins)
    print(f"  结果: {r4.overall_severity.value}, 异常数: {len(r4.anomaly_flags)}")
    for a in r4.anomaly_flags:
        print(f"    [{a.flag_type}] {a.detail}")

    print("\n[场景5] 权重与风险不一致 - 应标记")
    weight_mismatch_bins = [
        BinRecord("A", 40, 200, 10.0),
        BinRecord("B", 20, 200, 6.0),
        BinRecord("C", 5, 200, 15.0),
    ]
    r5 = checker.check_feature("weight_mismatch", "v1", weight_mismatch_bins)
    print(f"  权重排序一致: {r5.weight_interpretation.direction_aligned}")
    print(f"  解释: {r5.weight_interpretation.explanation}")


if __name__ == "__main__":
    report = run_example()
    verify_reproducibility()
    verify_specific_scenarios()
