#!/usr/bin/env python3
"""
被覆盖样例贯通验证：
用不同标签的样例（模型说normal，人工说violent），
确保覆盖→复核→报告→导出全链路不再显示旧批次证据。

核心断言：
1. 覆盖后 model_output 必须是新批次
2. 覆盖后 current_label 必须反映新批次
3. 复核通过后 active_manual_judgment 必须恢复
4. 复核通过后 is_overridden 必须恢复为 False
5. 复核通过后 current_label 必须是人工标签（不是旧模型标签）
6. 复核通过后 final_evidence 必须包含新批次模型证据+人工现场说法
7. 报告字段必须与导出明细一致
"""
import sys
import shutil
from datetime import datetime

from content_safety_reflow.models import (
    ModelOutput,
    ManualJudgment,
    ManualChangeType,
    ReflowStatus,
)
from content_safety_reflow.reflow_engine import ReflowEngine
from content_safety_reflow.unified_output import UnifiedOutput

DATA_DIR = "./test_data_end_to_end"

failures = []


def assert_eq(actual, expected, label):
    if actual != expected:
        msg = f"[FAIL] {label}: 实际={actual}, 期望={expected}"
        print(f"  ❌ {msg}")
        failures.append(msg)
        return False
    print(f"  ✅ {label}: {actual}")
    return True


def assert_true(val, label):
    if not val:
        msg = f"[FAIL] {label}: 实际={val}, 期望=True"
        print(f"  ❌ {msg}")
        failures.append(msg)
        return False
    print(f"  ✅ {label}")
    return True


def assert_in(needle, haystack, label):
    if needle not in haystack:
        msg = f"[FAIL] {label}: '{needle}' 不在 '{haystack[:80]}...' 中"
        print(f"  ❌ {msg}")
        failures.append(msg)
        return False
    print(f"  ✅ {label}")
    return True


def main():
    try:
        shutil.rmtree(DATA_DIR)
    except FileNotFoundError:
        pass

    print("=" * 70)
    print("被覆盖样例贯通验证")
    print("关键区别：旧模型说 violent，新模型说 normal，人工说 violent")
    print("这样标签差异才能暴露复核是否真的恢复了人工改判效力")
    print("=" * 70)

    engine = ReflowEngine(data_dir=DATA_DIR)
    uo = UnifiedOutput(engine)

    # ────────────────────────────────────────
    # Step 1: 模型输出片段第一次导入（BATCH-001, label=violent）
    # ────────────────────────────────────────
    print("\n━━━ Step 1: 模型输出片段第一次导入 ━━━")

    output_b1 = ModelOutput(
        sample_id="SAMPLE-E2E",
        original_line_number=42,
        batch_id="BATCH-001",
        model_version="v2.3",
        content="一段文本内容",
        predicted_label="violent",
        confidence=0.87,
        evidence_snippets=["B1证据: 检测到暴力词汇"],
    )
    engine.import_model_output(output_b1, "工程师A")

    d1 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d1["status"], "model_imported", "Step1 status")
    assert_eq(d1["model_output"]["batch_id"], "BATCH-001", "Step1 model batch")
    assert_eq(d1["model_output"]["original_line_number"], 42, "Step1 行号")
    assert_eq(d1["current_label"], "violent", "Step1 current_label")

    # ────────────────────────────────────────
    # Step 2: 周姐补看人工改判表（改判为 violent，与旧模型一致）
    # ────────────────────────────────────────
    print("\n━━━ Step 2: 周姐补看人工改判表 ━━━")

    judgment = ManualJudgment(
        sample_id="SAMPLE-E2E",
        judgment_id="JUDGE-E2E-001",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="violent",
        on_site_statement="周姐现场确认: 文本确实包含暴力隐喻，模型判断正确",
        change_type=ManualChangeType.LABEL_CHANGE,
        changed_fields=["predicted_label"],
        original_values={"predicted_label": "normal"},
        new_values={"predicted_label": "violent"},
        remarks="周姐确认需回流训练集",
    )
    engine.add_manual_judgment(judgment, "周姐")

    d2 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d2["status"], "manual_supplemented", "Step2 status")
    assert_eq(d2["active_judgment_id"], "JUDGE-E2E-001", "Step2 active judgment")
    assert_eq(d2["current_label"], "violent", "Step2 current_label")
    assert_true(d2["manual_judgments"][0]["is_overridden"] is False, "Step2 人工未被覆盖")

    # ────────────────────────────────────────
    # Step 2.5: 新批跑覆盖（BATCH-002, label=normal）
    # 关键：新模型说 normal，人工说 violent，标签不同
    # ────────────────────────────────────────
    print("\n━━━ Step 2.5: 新批跑覆盖人工改判 ━━━")

    output_b2 = ModelOutput(
        sample_id="SAMPLE-E2E",
        original_line_number=88,
        batch_id="BATCH-002",
        model_version="v2.4",
        content="一段文本内容",
        predicted_label="normal",
        confidence=0.95,
        evidence_snippets=["B2证据: 新版模型优化后未检测到敏感词"],
    )
    engine.import_model_output(output_b2, "工程师B")

    d25 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d25["status"], "covered_pending_review", "Step2.5 status")
    assert_eq(d25["is_covered"], True, "Step2.5 is_covered")
    assert_eq(d25["covered_by_batch_id"], "BATCH-002", "Step2.5 covered_by_batch_id")

    # ★ 核心：覆盖后 model_output 必须是新批次
    assert_eq(d25["model_output"]["batch_id"], "BATCH-002", "Step2.5 model batch=新批次")
    assert_eq(d25["model_output"]["original_line_number"], 88, "Step2.5 行号=新行号")

    # 人工改判被覆盖
    assert_eq(d25["active_judgment_id"], None, "Step2.5 active judgment=None")
    assert_true(len(d25.get("overridden_judgments", [])) > 0, "Step2.5 有被覆盖人工记录")

    # 当前标签应是新批跑的标签
    assert_eq(d25["current_label"], "normal", "Step2.5 current_label=新批跑标签")

    # result_explanation 必须说清覆盖情况
    assert_in("BATCH-002", d25["result_explanation"], "Step2.5 结果说明包含新批次")
    assert_in("覆盖", d25["result_explanation"], "Step2.5 结果说明包含覆盖信息")

    # ────────────────────────────────────────
    # Step 3: 评测报告更新
    # 覆盖样本不应进入 report_updated
    # ────────────────────────────────────────
    print("\n━━━ Step 3: 评测报告更新 ━━━")

    report = engine.generate_evaluation_report("EVAL-E2E-001", "评测人员", version=1)

    d3 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d3["status"], "covered_pending_review", "Step3 覆盖样本状态不变")

    # 报告中该样本的 source 和 is_covered 必须一致
    report_item = next(i for i in report.items if i.sample_id == "SAMPLE-E2E")
    assert_eq(report_item.is_covered, True, "Step3 报告中is_covered=True")
    assert_eq(report_item.source, "covered_pending", "Step3 报告中source=covered_pending")
    assert_eq(report_item.label, "normal", "Step3 报告中label=新批跑标签")

    # ────────────────────────────────────────
    # Step 4: 安全审核复核通过
    # ★ 这是最关键的：人工改判效力必须恢复
    # ────────────────────────────────────────
    print("\n━━━ Step 4: 安全审核复核通过 ━━━")

    engine.review_covered_sample(
        sample_id="SAMPLE-E2E",
        reviewer="安全审核同事",
        approve=True,
        reason="人工改判有效，模型新版本漏检暴力内容",
    )

    d4 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d4["status"], "review_approved", "Step4 status=review_approved")
    assert_eq(d4["is_covered"], False, "Step4 is_covered=False")

    # ★★★ 核心：复核通过后人工改判效力必须恢复 ★★★
    result_obj = engine.get_result("SAMPLE-E2E")

    assert_true(result_obj.active_manual_judgment is not None, "Step4 active_manual_judgment 不为空")
    if result_obj.active_manual_judgment:
        assert_eq(result_obj.active_manual_judgment.judgment_id, "JUDGE-E2E-001", "Step4 恢复的判断ID")
        assert_eq(result_obj.active_manual_judgment.final_label, "violent", "Step4 恢复的人工标签")
        assert_eq(result_obj.active_manual_judgment.is_overridden, False, "Step4 is_overridden=False")

    # 导出明细中也要验证
    assert_eq(d4["active_judgment_id"], "JUDGE-E2E-001", "Step4 导出明细active_judgment_id")
    active_judgments = d4.get("active_judgments", [])
    assert_true(len(active_judgments) > 0, "Step4 有active_judgments")
    if active_judgments:
        assert_eq(active_judgments[0]["final_label"], "violent", "Step4 active_judgment标签=violent")

    # ★ 核心：复核通过后 current_label 必须是人工标签，不是旧模型标签
    assert_eq(d4["current_label"], "violent", "Step4 current_label=人工标签(violent)")

    # ★ 核心：model_output 必须仍是新批次（不能退回旧批次）
    assert_eq(d4["model_output"]["batch_id"], "BATCH-002", "Step4 model batch=仍是新批次")

    # ★ 核心：final_evidence 必须包含新批次模型证据 + 人工现场说法
    assert_in("B2证据", str(d4["final_evidence"]), "Step4 final_evidence包含新批次模型证据")
    assert_in("周姐现场确认", str(d4["final_evidence"]), "Step4 final_evidence包含人工现场说法")
    assert_true(len(d4["final_evidence"]) >= 2, "Step4 final_evidence至少2条")

    # 覆盖标记清除
    overridden = d4.get("overridden_judgments", [])
    assert_eq(len(overridden), 0, "Step4 无overridden_judgments（已恢复）")

    # result_explanation 必须包含生效人工改判信息
    assert_in("生效人工改判", d4["result_explanation"], "Step4 结果说明包含生效人工改判")
    assert_in("JUDGE-E2E-001", d4["result_explanation"], "Step4 结果说明包含判断ID")

    # ────────────────────────────────────────
    # Step 5: 刷新报告
    # ────────────────────────────────────────
    print("\n━━━ Step 5: 刷新评测报告 ━━━")

    report2 = engine.generate_evaluation_report("EVAL-E2E-002", "评测人员", version=2)

    d5 = engine.export_details(sample_id="SAMPLE-E2E")[0]
    assert_eq(d5["status"], "report_updated", "Step5 status=report_updated")

    # 报告字段与导出明细一致
    report2_item = next(i for i in report2.items if i.sample_id == "SAMPLE-E2E")
    assert_eq(report2_item.label, "violent", "Step5 报告label=人工标签")
    assert_eq(report2_item.source, "manual", "Step5 报告source=manual")
    assert_eq(report2_item.is_covered, False, "Step5 报告is_covered=False")
    assert_eq(report2_item.has_manual_judgment, True, "Step5 报告has_manual_judgment=True")

    # ────────────────────────────────────────
    # Step 6: 统一输出一致性验证
    # ────────────────────────────────────────
    print("\n━━━ Step 6: 统一输出一致性 ━━━")

    api_data = uo.get_api_response("SAMPLE-E2E")
    page_data = uo.get_page_display_data("SAMPLE-E2E")

    assert_eq(api_data["status"], page_data["status"], "API和页面status一致")
    assert_eq(api_data["current_label"], page_data["current_label"], "API和页面label一致")
    assert_eq(api_data["is_covered"], page_data["is_covered"], "API和页面is_covered一致")

    # API 必须有 manual 段（复核通过后恢复了）
    assert_true("manual" in api_data, "API有manual段")
    if "manual" in api_data:
        assert_eq(api_data["manual"]["judgment_id"], "JUDGE-E2E-001", "API manual judgment_id")
        assert_eq(api_data["manual"]["final_label"], "violent", "API manual final_label")

    # 页面证据段必须有现场说法(生效)
    page_sources = [s["source"] for s in page_data.get("evidence_sections", [])]
    assert_true(any("生效" in s for s in page_sources), "页面有现场说法(生效)证据段")

    # API model 段必须是新批次
    assert_eq(api_data["model"]["batch_id"], "BATCH-002", "API model batch=新批次")
    assert_eq(api_data["model"]["original_line_number"], 88, "API model 行号=新行号")

    # ────────────────────────────────────────
    # 全量 change_history 走查
    # ────────────────────────────────────────
    print("\n━━━ 全量 change_history 走查 ━━━")

    full_detail = engine.export_details(sample_id="SAMPLE-E2E")[0]
    actions = [c["action"] for c in full_detail["change_history"]]
    expected_actions = [
        "model_import",
        "manual_judgment_update",
        "batch_override_detected",
        "manual_judgment_overridden",
        "covered_review_approve",
        "report_generated",
    ]
    for ea in expected_actions:
        assert_true(ea in actions, f"change_history包含 {ea}")

    # 复核通过记录必须写明恢复了哪个判断
    review_entries = [c for c in full_detail["change_history"] if c["action"] == "covered_review_approve"]
    assert_true(len(review_entries) > 0, "有复核通过记录")
    if review_entries:
        re = review_entries[0]
        assert_eq(re["new"], "JUDGE-E2E-001", "复核记录写明恢复的判断ID")
        assert_eq(re["field"], "active_manual_judgment", "复核记录field=active_manual_judgment")

    # ────────────────────────────────────────
    # 结果
    # ────────────────────────────────────────
    print("\n" + "=" * 70)
    if not failures:
        print("🎉 全部断言通过！")
        print("\n关键结论:")
        print("  ✅ 覆盖后 model_output 指向新批次 BATCH-002，不停在旧批次")
        print("  ✅ 覆盖后 current_label 反映新批跑标签 normal")
        print("  ✅ 复核通过后 active_manual_judgment 恢复为 JUDGE-E2E-001")
        print("  ✅ 复核通过后 is_overridden 恢复为 False")
        print("  ✅ 复核通过后 current_label=violent（人工标签），不是 normal")
        print("  ✅ 复核通过后 final_evidence=新批次模型证据+人工现场说法")
        print("  ✅ 导出明细、API、页面、报告字段全部一致")
        return 0
    else:
        print(f"❌ {len(failures)} 项断言失败:")
        for f in failures:
            print(f"  - {f}")
        return 1


if __name__ == "__main__":
    sys.exit(main())
