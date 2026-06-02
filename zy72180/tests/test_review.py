from __future__ import annotations

import json
from datetime import datetime

from smart_review.models import SampleRecord
from smart_review.orchestrator import ReviewOrchestrator
from smart_review.report import ReportGenerator
from smart_review.loader import DataLoader, DataQualityChecker
from smart_review.models import WarningType, DecisionSource, ReviewStatus


def build_test_samples() -> list:
    return [
        SampleRecord(
            sample_id="S001",
            features={"urgency": 0.8, "complexity": 0.3, "resource_avail": 0.9},
            reference_result="positive",
            original_label="positive",
            group_id="train",
            source="调度日志2026Q1",
            created_at="2026-03-15T10:30:00",
        ),
        SampleRecord(
            sample_id="S002",
            features={"urgency": 0.2, "complexity": 0.7, "resource_avail": 0.4},
            reference_result="negative",
            original_label="negative",
            group_id="train",
            source="调度日志2026Q1",
            created_at="2026-03-15T11:00:00",
        ),
        SampleRecord(
            sample_id="S002",
            features={"urgency": 0.2, "complexity": 0.7, "resource_avail": 0.4},
            reference_result="negative",
            original_label="negative",
            group_id="train",
            source="调度日志2026Q1",
            created_at="2026-03-15T11:00:00",
        ),
        SampleRecord(
            sample_id="S003",
            features={"urgency": None, "complexity": 0.5, "resource_avail": 0.6},
            reference_result="positive",
            original_label="positive",
            group_id="train",
            source="调度日志2026Q2",
            created_at="2026-04-01T09:15:00",
        ),
        SampleRecord(
            sample_id="S004",
            features={"urgency": 0.6, "complexity": 0.4, "resource_avail": 0.7},
            reference_result=None,
            original_label="positive",
            group_id="train",
            source="调度日志2026Q2",
            created_at="2026-04-01T14:20:00",
        ),
        SampleRecord(
            sample_id="S005",
            features={"urgency": 0.9, "complexity": 0.2, "resource_avail": 0.8},
            reference_result="positive",
            original_label="negative",
            human_label="positive",
            group_id="train",
            source="调度日志2026Q1",
            created_at="2026-03-20T16:45:00",
        ),
        SampleRecord(
            sample_id="S006",
            features={"urgency": 0.5, "complexity": 0.5, "resource_avail": 0.5},
            reference_result="negative",
            original_label="negative",
            human_label="positive",
            group_id="test",
            source="人工补录-周姐",
            created_at="2026-05-10T08:30:00",
        ),
        SampleRecord(
            sample_id="S006",
            features={"urgency": 0.5, "complexity": 0.5, "resource_avail": 0.5},
            reference_result="negative",
            original_label="negative",
            human_label="positive",
            group_id="train",
            source="调度日志2026Q1",
            created_at="2026-03-18T13:00:00",
        ),
        SampleRecord(
            sample_id="S007",
            features={},
            reference_result=None,
            original_label=None,
            group_id="val",
            source="接口导入-异常批次",
            created_at="2026-05-20T22:10:00",
        ),
    ]


def test_duplicate_detection():
    loader = DataLoader()
    records = build_test_samples()
    accepted, warnings = loader.add_records(records)
    dup_warnings = [w for w in warnings if w.warning_type == WarningType.DUPLICATE_SAMPLE]
    assert len(dup_warnings) > 0, "重复样本应被检测到"
    assert len(accepted) < len(records), "重复样本不应被加入"
    print("[PASS] 重复样本检测")


def test_null_feature_detection():
    checker = DataQualityChecker()
    records = build_test_samples()
    loader = DataLoader()
    accepted, _ = loader.add_records(records)
    warnings = checker.check(accepted)
    null_warnings = [w for w in warnings if w.warning_type == WarningType.NULL_FEATURE]
    assert len(null_warnings) > 0, "空特征应被检测到"
    null_ids = set()
    for w in null_warnings:
        null_ids.update(w.sample_ids)
    assert "S003" in null_ids, "S003 含 None 特征值"
    assert "S007" in null_ids, "S007 空特征字典"
    print("[PASS] 空特征值检测")


def test_missing_reference_detection():
    checker = DataQualityChecker()
    records = build_test_samples()
    loader = DataLoader()
    accepted, _ = loader.add_records(records)
    warnings = checker.check(accepted)
    missing_warnings = [w for w in warnings if w.warning_type == WarningType.MISSING_REFERENCE]
    assert len(missing_warnings) > 0, "缺引用结果应被检测到"
    missing_ids = set()
    for w in missing_warnings:
        missing_ids.update(w.sample_ids)
    assert "S004" in missing_ids, "S004 缺引用结果"
    print("[PASS] 缺引用结果检测")


def test_label_conflict_detection():
    checker = DataQualityChecker()
    records = build_test_samples()
    loader = DataLoader()
    accepted, _ = loader.add_records(records)
    warnings = checker.check(accepted)
    conflict_warnings = [w for w in warnings if w.warning_type == WarningType.LABEL_CONFLICT]
    assert len(conflict_warnings) > 0, "标签冲突应被检测到"
    conflict_ids = set()
    for w in conflict_warnings:
        conflict_ids.update(w.sample_ids)
    assert "S005" in conflict_ids, "S005 原始标签与人工标签冲突"
    assert "S006" in conflict_ids, "S006 原始标签与人工标签冲突"
    print("[PASS] 标签冲突检测")


def test_sample_leakage_detection():
    checker = DataQualityChecker()
    records = build_test_samples()
    warnings = checker.check(records)
    leakage_warnings = [w for w in warnings if w.warning_type == WarningType.SAMPLE_LEAKAGE]
    assert len(leakage_warnings) > 0, "样本泄漏应被检测到"
    leakage_ids = set()
    for w in leakage_warnings:
        leakage_ids.update(w.sample_ids)
    assert "S006" in leakage_ids, "S006 同时出现在 train 和 test 分组"
    print("[PASS] 样本泄漏检测")


def test_full_review_flow():
    orchestrator = ReviewOrchestrator(
        session_id="test-session-001",
        model_version="v1.0.0",
        threshold=0.5,
    )
    records = build_test_samples()
    orchestrator.load_samples(records)
    results = orchestrator.review_all()

    status_map = {r.sample.sample_id: r for r in results}

    s001 = status_map.get("S001")
    assert s001 is not None, "S001 应存在"
    assert s001.status == ReviewStatus.MODEL_APPROVED, f"S001 应为模型判断, 实际: {s001.status}"

    s005 = status_map.get("S005")
    assert s005 is not None, "S005 应存在"
    assert s005.status == ReviewStatus.HUMAN_CORRECTED, f"S005 应为人工修正, 实际: {s005.status}"
    assert s005.decision.human_reason is not None, "S005 应有人工修正原因"

    s003 = status_map.get("S003")
    assert s003 is not None, "S003 应存在"
    assert s003.status == ReviewStatus.NEEDS_REVIEW, f"S003 应为待复核(空特征), 实际: {s003.status}"

    s004 = status_map.get("S004")
    assert s004 is not None, "S004 应存在"
    assert s004.status == ReviewStatus.NEEDS_REVIEW, f"S004 应为待复核(缺引用), 实际: {s004.status}"

    s007 = status_map.get("S007")
    assert s007 is not None, "S007 应存在"
    assert s007.status == ReviewStatus.NEEDS_REVIEW, f"S007 应为待复核(空特征+缺引用), 实际: {s007.status}"

    summary = orchestrator.get_summary()
    assert summary["model_approved"] >= 1, "应有模型判断样本"
    assert summary["human_corrected"] >= 1, "应有人工修正样本"
    assert summary["needs_review"] >= 1, "应有待复核样本"

    print(f"[PASS] 完整回看流程: {summary}")


def test_report_generation():
    orchestrator = ReviewOrchestrator(
        session_id="test-session-002",
        model_version="v1.0.0",
        threshold=0.5,
    )
    orchestrator.load_samples(build_test_samples())
    orchestrator.review_all()

    generator = ReportGenerator()
    report = generator.generate(orchestrator.session)

    assert report.model_approved_count >= 1, "报告中应有模型判断计数"
    assert report.human_corrected_count >= 1, "报告中应有人工修正计数"
    assert report.needs_review_count >= 1, "报告中应有待复核计数"
    assert len(report.warnings_summary) > 0, "报告中应有告警汇总"

    text = generator.to_text(report)
    assert "模型判断" in text, "文本报告应包含模型判断"
    assert "人工修正" in text, "文本报告应包含人工修正"
    assert "待复核" in text, "文本报告应包含待复核"
    assert "标签冲突" in text, "文本报告应包含标签冲突告警"
    assert "样本泄漏" in text, "文本报告应包含样本泄漏告警"

    report_dict = generator.to_dict(report)
    assert "session_id" in report_dict, "字典报告应包含 session_id"
    assert "samples" in report_dict, "字典报告应包含样本详情"

    print("[PASS] 报告生成")
    print("\n" + "=" * 40)
    print("文本报告预览:")
    print("=" * 40)
    print(text)


def test_no_duplicate_review():
    orchestrator = ReviewOrchestrator(
        session_id="test-session-003",
        model_version="v1.0.0",
        threshold=0.5,
    )
    sample = SampleRecord(
        sample_id="S999",
        features={"urgency": 0.7, "complexity": 0.3, "resource_avail": 0.8},
        reference_result="positive",
        original_label="positive",
        group_id="train",
        source="测试来源",
    )
    orchestrator.load_samples([sample])
    results1 = orchestrator.review_all()
    results2 = orchestrator.review_all()

    assert len(results1) == 1, "首次评测应处理1条"
    assert len(results2) == 1, "重复评测同一条不应产生额外记录"
    assert results2[0].decision.decided_label == "SKIP_DUPLICATE", "重复评测应标记为跳过"
    print("[PASS] 同一样本不会重复评测")


if __name__ == "__main__":
    test_duplicate_detection()
    test_null_feature_detection()
    test_missing_reference_detection()
    test_label_conflict_detection()
    test_sample_leakage_detection()
    test_full_review_flow()
    test_report_generation()
    test_no_duplicate_review()

    print("\n" + "=" * 60)
    print("全部测试通过!")
    print("=" * 60)
