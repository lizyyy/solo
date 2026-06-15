#!/usr/bin/env python3
"""
问题样例逐阶段验证：不是看流程能不能点下一步，
而是看导出明细里状态变化、历史留痕和结果说明是否对齐。
"""
import sys
import json
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

DATA_DIR = "./test_data_problem_sample"


def clean_data():
    try:
        shutil.rmtree(DATA_DIR)
    except FileNotFoundError:
        pass


def check_detail(detail, expected_status, step_name):
    errors = []

    if detail["status"] != expected_status:
        errors.append(f"status={detail['status']}, 期望={expected_status}")

    if not detail["change_history"]:
        errors.append("change_history为空，无历史留痕")
    else:
        last_action = detail["change_history"][-1]["action"]
        has_reason = any(c.get("reason") for c in detail["change_history"])
        if not has_reason:
            errors.append("change_history无reason字段，留痕不足")

    if not detail.get("result_explanation"):
        errors.append("result_explanation为空，无结果说明")

    if errors:
        print(f"  ❌ [{step_name}] 对齐失败:")
        for e in errors:
            print(f"     - {e}")
        return False
    else:
        print(f"  ✅ [{step_name}] 对齐通过")
        print(f"     status: {detail['status']}")
        print(f"     change_history条数: {len(detail['change_history'])}")
        print(f"     result_explanation: {detail['result_explanation']}")
        return True


def main():
    clean_data()
    all_passed = True

    print("=" * 70)
    print("问题样例逐阶段验证：用覆盖样例走完整流程")
    print("不是看流程能不能点下一步，而是停在每个阶段看导出明细")
    print("=" * 70)

    engine = ReflowEngine(data_dir=DATA_DIR)
    uo = UnifiedOutput(engine)

    # ═══════════════════════════════════════
    # Step 1: 模型输出片段第一次导入
    # ═══════════════════════════════════════
    print("\n━━━ Step 1: 模型输出片段第一次导入 ━━━")

    output_batch1 = ModelOutput(
        sample_id="SAMPLE-COVERED",
        original_line_number=42,
        batch_id="BATCH-001",
        model_version="v2.3.1",
        content="文本包含暴力隐喻表达",
        predicted_label="violent",
        confidence=0.87,
        risk_tags=["暴力"],
        evidence_snippets=["检测到暴力词汇", "上下文符合暴力特征"],
    )
    engine.import_model_output(output_batch1, "工程师A")
    engine.save_to_disk()

    detail_step1 = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 Step1 导出明细:")
    print(f"  model_output.original_line_number: {detail_step1['model_output']['original_line_number']}")
    print(f"  model_output.batch_id: {detail_step1['model_output']['batch_id']}")
    print(f"  current_label: {detail_step1['current_label']}")
    print(f"  final_evidence: {detail_step1['final_evidence']}")

    if not check_detail(detail_step1, "model_imported", "Step1"):
        all_passed = False

    # 检查API和页面读同一份
    api_data = uo.get_api_response("SAMPLE-COVERED")
    page_data = uo.get_page_display_data("SAMPLE-COVERED")
    if api_data["status"] != page_data["status"]:
        print(f"  ❌ API({api_data['status']}) != 页面({page_data['status']})")
        all_passed = False
    else:
        print(f"  ✅ API和页面读取同一份: status={api_data['status']}")

    # ═══════════════════════════════════════
    # Step 2: 标注负责人周姐补看人工改判表
    # ═══════════════════════════════════════
    print("\n━━━ Step 2: 周姐补看人工改判表 ━━━")

    judgment = ManualJudgment(
        sample_id="SAMPLE-COVERED",
        judgment_id="JUDGE-COVERED-001",
        judge_person="周姐",
        judgment_time=datetime.now(),
        final_label="violent",
        on_site_statement="周姐现场确认：文本确实包含暴力隐喻，模型判断正确，需回流训练集",
        change_type=ManualChangeType.LABEL_CHANGE,
        changed_fields=["predicted_label"],
        original_values={"predicted_label": "normal"},
        new_values={"predicted_label": "violent"},
        remarks="周姐现场确认，该样本需回流到训练集",
    )
    engine.add_manual_judgment(judgment, "周姐")
    engine.save_to_disk()

    detail_step2 = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 Step2 导出明细:")
    print(f"  current_label: {detail_step2['current_label']}")
    print(f"  active_judgment_id: {detail_step2['active_judgment_id']}")
    print(f"  manual_judgments条数: {len(detail_step2['manual_judgments'])}")
    print(f"  final_evidence(模型+现场说法): {detail_step2['final_evidence']}")

    if not check_detail(detail_step2, "manual_supplemented", "Step2"):
        all_passed = False

    # 检查现场说法在证据里
    if "周姐现场确认" not in str(detail_step2["final_evidence"]):
        print(f"  ❌ 现场说法未合并到final_evidence")
        all_passed = False
    else:
        print(f"  ✅ 现场说法已合并到final_evidence")

    # ═══════════════════════════════════════
    # Step 2.5: 新批跑覆盖 → 别急着归正常
    # ═══════════════════════════════════════
    print("\n━━━ Step 2.5: 新批跑覆盖人工改判 → 别急着归正常 ━━━")

    output_batch2 = ModelOutput(
        sample_id="SAMPLE-COVERED",
        original_line_number=88,
        batch_id="BATCH-002",
        model_version="v2.4.0",
        content="文本包含暴力隐喻表达",
        predicted_label="normal",
        confidence=0.95,
        risk_tags=[],
        evidence_snippets=["新版模型优化后未检测到敏感词"],
    )
    engine.import_model_output(output_batch2, "工程师B")
    engine.save_to_disk()

    detail_step25 = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 Step2.5 导出明细（覆盖后）:")
    print(f"  status: {detail_step25['status']}")
    print(f"  is_covered: {detail_step25['is_covered']}")
    print(f"  covered_by_batch_id: {detail_step25['covered_by_batch_id']}")
    print(f"  active_judgment_id: {detail_step25['active_judgment_id']}")
    print(f"  overridden_judgments条数: {len(detail_step25.get('overridden_judgments', []))}")
    print(f"  active_judgments条数: {len(detail_step25.get('active_judgments', []))}")

    if detail_step25["status"] != "covered_pending_review":
        print(f"  ❌ 覆盖后状态不是 covered_pending_review，急着归了正常")
        all_passed = False
    else:
        print(f"  ✅ 没有急着归正常，正确停在 covered_pending_review")

    # 被覆盖的人工改判是否保留完整信息
    overridden = detail_step25.get("overridden_judgments", [])
    if not overridden:
        print(f"  ❌ overridden_judgments为空，被覆盖的人工改判信息丢失")
        all_passed = False
    else:
        oj = overridden[0]
        print(f"  ✅ 被覆盖人工改判保留:")
        print(f"     judgment_id: {oj['judgment_id']}")
        print(f"     judge_person: {oj['judge_person']}")
        print(f"     on_site_statement: {oj['on_site_statement'][:40]}...")
        print(f"     override_batch_id: {oj['override_batch_id']}")

    # 被覆盖样例的现场说法是否还可见
    api_covered = uo.get_api_response("SAMPLE-COVERED")
    page_covered = uo.get_page_display_data("SAMPLE-COVERED")

    if "overridden_manual" not in api_covered:
        print(f"  ❌ API返回中无 overridden_manual 段，被覆盖现场说法不可见")
        all_passed = False
    else:
        print(f"  ✅ API返回中有 overridden_manual 段，被覆盖现场说法可见")

    # 页面证据段里是否展示被覆盖的现场说法
    page_evidence_sources = [s["source"] for s in page_covered.get("evidence_sections", [])]
    has_overridden_evidence = any("被覆盖" in s for s in page_evidence_sources)
    if not has_overridden_evidence:
        print(f"  ❌ 页面证据段里无被覆盖的现场说法")
        all_passed = False
    else:
        print(f"  ✅ 页面证据段里有被覆盖的现场说法")

    # result_explanation 是否说明覆盖情况
    if "覆盖" not in detail_step25.get("result_explanation", ""):
        print(f"  ❌ result_explanation未说明覆盖情况")
        all_passed = False
    else:
        print(f"  ✅ result_explanation说明了覆盖: {detail_step25['result_explanation']}")

    # check_detail 对齐
    if not check_detail(detail_step25, "covered_pending_review", "Step2.5-覆盖后"):
        all_passed = False

    # ═══════════════════════════════════════
    # Step 3: 评测报告更新
    # ═══════════════════════════════════════
    print("\n━━━ Step 3: 评测报告更新 ━━━")

    report = engine.generate_evaluation_report(
        report_id="EVAL-COVERED-001",
        operator="评测人员",
        version=1,
    )
    engine.save_to_disk()

    detail_step3 = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 Step3 导出明细:")
    print(f"  status: {detail_step3['status']}")
    print(f"  is_covered: {detail_step3['is_covered']}")
    print(f"  current_label: {detail_step3['current_label']}")

    # 覆盖样本不应该进入 report_updated
    if detail_step3["status"] == "covered_pending_review":
        print(f"  ✅ 覆盖样本状态保持 covered_pending_review，未被报告误更新")
    else:
        print(f"  ⚠️ 覆盖样本状态变为 {detail_step3['status']}")

    if not check_detail(detail_step3, "covered_pending_review", "Step3-覆盖样本"):
        all_passed = False

    # ═══════════════════════════════════════
    # 可重跑入口验证
    # ═══════════════════════════════════════
    print("\n━━━ 可重跑入口验证 ━━━")

    replay = engine.replay_sample("SAMPLE-COVERED")
    if "error" in replay:
        print(f"  ❌ 重跑入口返回错误: {replay['error']}")
        all_passed = False
    else:
        print(f"  ✅ 重跑入口可用:")
        print(f"     current_status: {replay['current_status']}")
        print(f"     model_output存在: {'model_output' in replay}")
        print(f"     manual_judgments条数: {len(replay.get('manual_judgments', []))}")
        print(f"     可重跑命令:")
        for cmd in replay.get("replay_commands", []):
            print(f"       {cmd}")

    # ═══════════════════════════════════════
    # 安全审核复核后验证
    # ═══════════════════════════════════════
    print("\n━━━ 安全审核复核通过后 ━━━")

    engine.review_covered_sample(
        sample_id="SAMPLE-COVERED",
        reviewer="安全审核同事",
        approve=True,
        reason="人工改判有效，模型新版本漏检",
    )
    engine.save_to_disk()

    detail_reviewed = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 复核后导出明细:")
    print(f"  status: {detail_reviewed['status']}")
    print(f"  is_covered: {detail_reviewed['is_covered']}")
    print(f"  current_label: {detail_reviewed['current_label']}")
    print(f"  review_person: {detail_reviewed['review_person']}")

    if not check_detail(detail_reviewed, "review_approved", "复核后"):
        all_passed = False

    # 复核后历史留痕检查
    review_actions = [c for c in detail_reviewed["change_history"] if c["action"] == "covered_review_approve"]
    if not review_actions:
        print(f"  ❌ change_history无复核记录")
        all_passed = False
    else:
        print(f"  ✅ change_history有复核记录: {review_actions[0]['reason']}")

    # ═══════════════════════════════════════
    # 全量change_history走查（核心验证）
    # ═══════════════════════════════════════
    print("\n━━━ 全量change_history走查（能不能回到证据） ━━━")

    full_detail = engine.export_details(sample_id="SAMPLE-COVERED")[0]
    print(f"\n📋 SAMPLE-COVERED 完整操作轨迹:")
    for i, entry in enumerate(full_detail["change_history"], 1):
        print(f"  {i}. [{entry['time'][:19]}] {entry['operator']} → {entry['action']}")
        if entry.get("field"):
            print(f"     field: {entry['field']}")
        if entry.get("old"):
            print(f"     old: {entry['old']}")
        if entry.get("new"):
            print(f"     new: {entry['new']}")
        if entry.get("reason"):
            print(f"     reason: {entry['reason']}")

    # 验证每个阶段都留痕
    expected_actions = ["model_import", "manual_judgment_update", "batch_override_detected", "manual_judgment_overridden", "covered_review_approve"]
    actual_actions = [c["action"] for c in full_detail["change_history"]]
    for ea in expected_actions:
        if ea not in actual_actions:
            print(f"  ❌ 缺少操作留痕: {ea}")
            all_passed = False
        else:
            print(f"  ✅ 操作留痕存在: {ea}")

    # ═══════════════════════════════════════
    # 最终总结
    # ═══════════════════════════════════════
    print("\n" + "=" * 70)
    if all_passed:
        print("🎉 全部验证通过！")
        print("\n关键结论:")
        print("  ✅ 导出明细里 status / change_history / result_explanation 三者对齐")
        print("  ✅ 人工改判被覆盖时不急着归正常，停在 covered_pending_review")
        print("  ✅ 被覆盖的人工改判现场说法在 overridden_judgments 和页面证据段可见")
        print("  ✅ API/页面/明细读取同一份数据")
        print("  ✅ 每个阶段的 change_history 都留痕，能回到证据")
        print("  ✅ 可重跑入口打通，能从问题样例重跑")
        return 0
    else:
        print("❌ 存在验证失败项，需修复")
        return 1


if __name__ == "__main__":
    sys.exit(main())
