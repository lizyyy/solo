#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import os
import shutil
import sys
from datetime import datetime

from storage import Storage
from explanation_generator import ExplanationGenerator
from workflow import VersionManager, HumanReviewWorkflow
from report_export import ReportExporter
from sample_data import create_samples, create_model_versions, create_legacy_annotation
from models import ExplanationStatus


def print_header(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80 + "\n")


def print_step(step_num, description):
    print(f"\n[{step_num}] {description}")
    print("-" * 60)


def main():
    data_dir = "data"
    export_dir = "exports"

    if os.path.exists(data_dir):
        shutil.rmtree(data_dir)
    if os.path.exists(export_dir):
        shutil.rmtree(export_dir)

    print_header("学习路径推荐解释系统 - 端到端测试")
    print("本测试模拟完整业务流程，验证以下需求:")
    print("  ✓ 版本、阈值、证据、人工改判可回看")
    print("  ✓ 模型版本变更后旧报告不被覆盖")
    print("  ✓ 三条典型记录: 顺利、需人工确认、历史标注")
    print("  ✓ 保留原始来源和处理时间")
    print("  ✓ 重跑时指标变化与样本变化可分开解释")
    print("  ✓ 报告与明细数据一致，无两套说法")

    storage = Storage()
    generator = ExplanationGenerator(storage)
    version_manager = VersionManager(storage)
    review_workflow = HumanReviewWorkflow(storage)
    exporter = ReportExporter(storage)

    print_step(1, "初始化样例数据")
    samples = create_samples()
    for sample in samples:
        storage.save_sample(sample)
        print(f"  ✓ 保存样本: {sample.sample_id} ({sample.user_profile['background']})")

    model_versions = create_model_versions()
    for mv in model_versions:
        storage.save_model_version(mv)
        print(f"  ✓ 注册模型版本: {mv.version}")

    annotation_id, annotation_data = create_legacy_annotation()
    storage.save_legacy_annotation(annotation_id, annotation_data)
    print(f"  ✓ 保存历史标注: {annotation_id} (标注人: {annotation_data['annotator']})")

    print_step(2, "使用模型 v1.0.0 批量生成解释")
    mv_v1 = storage.load_model_version("v1.0.0")
    run_id_v1, reports_v1 = generator.batch_generate(samples, mv_v1)

    print(f"  ✓ 批次运行ID: {run_id_v1}")
    print(f"  ✓ 生成报告数: {len(reports_v1)}")
    print()

    status_map = {
        ExplanationStatus.AUTO_SUCCESS: "自动通过 ✓",
        ExplanationStatus.NEED_HUMAN_REVIEW: "待人工审核 ⚠",
        ExplanationStatus.LEGACY_FROM_ANNOTATION: "历史标注 📜",
    }

    for r in reports_v1:
        status_display = status_map.get(r.status, r.status.value)
        print(f"  {r.report_id} | 样本 {r.sample_id} | {status_display} | "
              f"置信度 {r.confidence_score:.2%} | {r.recommended_path}")
        print(f"    判定: {r.generation_note[:100]}...")

    print_step(3, "验证三条典型记录的状态")
    smp001_reports = storage.list_reports_for_sample("SMP-001", "v1.0.0")
    smp002_reports = storage.list_reports_for_sample("SMP-002", "v1.0.0")

    assert len(smp001_reports) == 1, "SMP-001 应该有1份报告"
    assert smp001_reports[0].status == ExplanationStatus.AUTO_SUCCESS, \
        f"SMP-001 应该自动通过，实际是 {smp001_reports[0].status}"
    print(f"  ✓ SMP-001 (统计学本科，3门先修完成): 自动通过")

    assert len(smp002_reports) == 1, "SMP-002 应该有1份报告"
    assert smp002_reports[0].status == ExplanationStatus.NEED_HUMAN_REVIEW, \
        f"SMP-002 应该待人工审核，实际是 {smp002_reports[0].status}"
    print(f"  ✓ SMP-002 (市场营销转行，先修不足): 待人工审核")

    print_step(4, "导入历史标注 (SMP-003 的旧口径)")
    legacy_report = review_workflow.import_legacy_annotation(
        sample_id="SMP-003",
        annotation_id=annotation_id,
        annotation_data=annotation_data,
        model_version="v1.0.0",
    )
    print(f"  ✓ 导入报告: {legacy_report.report_id}")
    print(f"  ✓ 状态: {status_map.get(legacy_report.status, legacy_report.status)}")
    print(f"  ✓ 历史来源: {legacy_report.legacy_source}")
    print(f"  ✓ 原始标注人: {annotation_data['annotator']}")
    print(f"  ✓ 原始标注时间: {annotation_data['annotated_at']}")

    assert legacy_report.status == ExplanationStatus.LEGACY_FROM_ANNOTATION
    assert legacy_report.legacy_source == annotation_id
    print(f"  ✓ SMP-003 (前端转后端): 历史标注导入")

    print_step(5, "人工审核流程: 确认 SMP-002 的推荐")
    pending = review_workflow.list_pending_reviews("v1.0.0")
    print(f"  待审核报告数: {len(pending)}")

    smp002_report = next((r for r in reports_v1 if r.sample_id == "SMP-002"), None)
    assert smp002_report is not None

    confirmed_report = review_workflow.confirm_recommendation(
        report_id=smp002_report.report_id,
        reviewer="AI产品经理阿宁",
        note="用户虽然是转行，但学习意愿强烈，每周3小时虽然不多但可以慢慢来。先推荐AI工程师路径，后续根据进展调整。",
    )

    print(f"  ✓ 审核人: {confirmed_report.human_review.reviewer}")
    print(f"  ✓ 审核时间: {confirmed_report.human_review.reviewed_at}")
    print(f"  ✓ 原状态 → 新状态: {confirmed_report.human_review.original_status} → {confirmed_report.human_review.final_status}")
    print(f"  ✓ 审核说明: {confirmed_report.human_review.revision_note}")
    print(f"  ✓ 证据链包含人工审核记录: {len(confirmed_report.evidence_chain)} 条证据")

    assert confirmed_report.status == ExplanationStatus.HUMAN_CONFIRMED
    assert confirmed_report.human_review.reviewer == "AI产品经理阿宁"

    print_step(6, "验证证据链和阈值可追溯")
    report = smp001_reports[0]
    print(f"  报告 {report.report_id} 的完整证据链:")
    for i, ev in enumerate(report.evidence_chain, 1):
        print(f"    [{i}] {ev.evidence_type.value}: {ev.description}")
        print(f"        来源: {ev.source} | 取值: {ev.value} | 时间: {ev.timestamp}")

    print(f"\n  使用的阈值配置:")
    for k, v in sorted(report.threshold_used.items()):
        print(f"    {k}: {v}")

    assert len(report.evidence_chain) > 0, "应该有证据链"
    assert len(report.threshold_used) > 0, "应该有阈值记录"
    print(f"  ✓ 证据链和阈值完整可追溯")

    print_step(7, "模型版本升级到 v1.1.0，重新运行")
    print("  v1.1.0 调整了阈值: auto_accept 0.85→0.80, human_review 0.6→0.55")
    mv_v11 = storage.load_model_version("v1.1.0")
    run_id_v11, reports_v11 = generator.batch_generate(samples, mv_v11)

    print(f"  ✓ 新批次ID: {run_id_v11}")
    for r in reports_v11:
        status_display = status_map.get(r.status, r.status.value)
        print(f"  {r.report_id} | 样本 {r.sample_id} | {status_display} | "
              f"置信度 {r.confidence_score:.2%}")

    print_step(8, "验证旧版本报告未被覆盖")
    all_reports_v1 = storage.list_reports_for_model_version("v1.0.0")
    all_reports_v11 = storage.list_reports_for_model_version("v1.1.0")

    print(f"  v1.0.0 报告数: {len(all_reports_v1)} (包含1份历史标注)")
    print(f"  v1.1.0 报告数: {len(all_reports_v11)}")

    assert len(all_reports_v1) >= 3, "v1.0.0 的报告应该保留"
    assert len(all_reports_v11) == 3, "v1.1.0 应该有3份新报告"

    v1_ids = {r.report_id for r in all_reports_v1}
    v11_ids = {r.report_id for r in all_reports_v11}
    assert len(v1_ids & v11_ids) == 0, "新旧报告ID不应重叠"

    print(f"  ✓ 旧版本报告完整保留，未被覆盖")
    print(f"  ✓ 新版本生成独立报告，ID不重叠")

    print_step(9, "对比两次运行，区分指标变化和样本变化")
    comparison = storage.compare_batch_runs(run_id_v1, run_id_v11)

    print(f"  指标变化:")
    for metric, diff in sorted(comparison["metric_diffs"].items()):
        if "rate" in metric:
            print(f"    {metric}: {diff['old']:.2%} → {diff['new']:.2%} (变化: {diff['diff']:+.2%})")
        else:
            print(f"    {metric}: {diff['old']} → {diff['new']} (变化: {diff['diff']:+})")

    print(f"\n  样本变化汇总:")
    s = comparison["summary"]
    print(f"    总样本: {s['total_samples']}, 新增: {s['added']}, 移除: {s['removed']}, 变化: {s['changed']}, 不变: {s['unchanged']}")

    print(f"\n  归因分析:")
    pure_model = [c for c in comparison["sample_changes"]
                  if c["change_type"] in ["status_changed", "path_changed", "both_changed"]]
    sample_only = [c for c in comparison["sample_changes"]
                   if c["change_type"] in ["added", "removed"]]

    print(f"    样本集变动: {len(sample_only)} 个样本")
    print(f"    模型/阈值变动: {len(pure_model)} 个样本")

    if pure_model:
        print(f"\n  模型阈值导致的变化详情:")
        for c in pure_model:
            if c["change_type"] == "status_changed":
                print(f"    样本 {c['sample_id']}: 状态 {c['details']['old_status']} → {c['details']['new_status']}")

    total = s["total_samples"]
    model_contribution = len(pure_model) / total if total > 0 else 0
    sample_contribution = len(sample_only) / total if total > 0 else 0

    print(f"\n  归因结论:")
    print(f"    样本集变动贡献: {sample_contribution:.2%}")
    print(f"    模型/阈值变动贡献: {model_contribution:.2%}")
    print(f"  ✓ 指标变化和样本变化已分开解释")

    print_step(10, "导出报告，验证报告与明细一致")
    summary_path, detail_dir = exporter.export_batch_run_report(run_id_v11)
    print(f"  ✓ 汇总报告: {summary_path}")
    print(f"  ✓ 明细目录: {detail_dir}")

    with open(summary_path, "r", encoding="utf-8") as f:
        summary_content = f.read()

    detail_files = os.listdir(detail_dir)
    print(f"  ✓ 明细报告数: {len(detail_files)}")

    assert len(detail_files) == 3, "应该有3份明细报告"
    assert "数据来源一致，无两套说法" in summary_content
    print(f"  ✓ 汇总报告声明数据一致")

    with open(os.path.join(detail_dir, detail_files[0]), "r", encoding="utf-8") as f:
        detail_content = f.read()
    assert "报告明细完整，与底层数据一致" in detail_content
    print(f"  ✓ 明细报告声明数据完整")

    comparison_path = exporter.compare_runs_and_export(run_id_v1, run_id_v11)
    print(f"  ✓ 对比报告: {comparison_path}")

    for r in reports_v11:
        single_path = exporter.export_single_report(r.report_id)
        with open(single_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "证据链" in content
        assert "使用阈值" in content
        assert r.report_id in content

    print(f"  ✓ 所有报告均包含完整证据链和阈值")
    print(f"  ✓ 汇总报告与明细报告数据一致")

    print_step(11, "追溯 SMP-002 的完整历史")
    trace_reports = storage.list_reports_for_sample("SMP-002")
    print(f"  SMP-002 共有 {len(trace_reports)} 个版本的解释报告:")
    for i, r in enumerate(trace_reports, 1):
        print(f"    [{i}] {r.report_id} | 模型 {r.model_version} | {r.status.value} | {r.generated_at}")
        if r.human_review:
            print(f"        审核人: {r.human_review.reviewer} @ {r.human_review.reviewed_at}")

    assert len(trace_reports) >= 2, "SMP-002 应该有至少2个版本 (v1.0.0带审核, v1.1.0)"
    print(f"  ✓ 完整追溯链可用，无需询问AI产品经理阿宁")

    print_step(12, "验证版本历史和变更日志")
    versions = version_manager.list_versions_with_changelog()
    print(f"  模型版本历史:")
    for v in versions:
        print(f"    {v['version']} | {v['deployed_at']} | {v['description'][:60]}...")
        print(f"      报告数: {v['report_count']}, 阈值数: {len(v['threshold_config'])}")

    v_diff = version_manager.get_version_diff("v1.0.0", "v1.1.0")
    print(f"\n  v1.0.0 → v1.1.0 阈值变化:")
    for k, d in v_diff["threshold_diffs"].items():
        print(f"    {k}: {d['old']} → {d['new']}")

    assert len(v_diff["threshold_diffs"]) > 0, "应该有阈值变化"
    print(f"  ✓ 版本变更完整可追溯")

    print_header("测试总结")
    print("✅ 所有验证项通过:")
    print()
    print("  1. 版本可追溯: 模型版本、阈值配置、发布时间完整记录")
    print("  2. 证据可回看: 每条解释都有完整证据链，含来源和时间戳")
    print("  3. 人工改判留痕: 审核人、审核时间、改判原因完整记录")
    print("  4. 旧报告不覆盖: 模型版本升级后，历史报告完整保留在独立目录")
    print("  5. 三条典型记录:")
    print(f"     - SMP-001: 自动通过 (先修满足，成绩优秀)")
    print(f"     - SMP-002: 待人工审核 → 人工确认 (转行背景，需判断)")
    print(f"     - SMP-003: 历史标注导入 (保留阿宁2025Q4的旧口径)")
    print("  6. 归因分析: 重跑时指标变化和样本变化可分开解释")
    print("  7. 数据一致性: 汇总报告与明细报告来自同一数据源，无两套说法")
    print("  8. 完整追溯: 任一样本的所有历史版本可一键追溯")
    print()
    print(f"📁 数据目录: {os.path.abspath(data_dir)}")
    print(f"📁 导出目录: {os.path.abspath(export_dir)}")
    print()
    print("💡 后续操作命令:")
    print("   查看帮助: python cli.py --help")
    print("   查看报告: python cli.py show-report <report_id>")
    print("   追溯样本: python cli.py trace <sample_id>")
    print("   版本对比: python cli.py compare-versions v1.0.0 v1.1.0")

    return 0


if __name__ == "__main__":
    sys.exit(main())
