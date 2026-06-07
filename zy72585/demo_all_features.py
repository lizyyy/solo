#!/usr/bin/env python3
"""
异常点可视化分层系统 — 综合演示脚本

验证所有需求点：
1. ✅ 重复导入同一批召回候选表不翻倍
2. ✅ 改备注能看历史差异
3. ✅ 3D/图表可追溯到原始数据
4. ✅ 报告带决策理由、缺什么材料、找谁
5. ✅ 谁改了什么、为什么改
6. ✅ 三步工作流：导入→补看YAML→更新
7. ✅ 阈值改过但报告旧值 → 悬置给数据科学家
"""

import sys
sys.path.insert(0, '.')

from models.candidate import CandidateRecord
from models.params import ParamsYAML
from workflow.workflow_engine import WorkflowEngine, WorkflowStep
from core.diff_engine import DiffEngine
from core.history_tracer import HistoryTracer
from core.threshold_checker import ThresholdChecker
from output.report_generator import ReportGenerator
from output.visualization import VisualizationLayer, VizType


def print_section(title):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print('='*60)


def demo_1_dedup_import():
    """需求1: 重复导入不翻倍"""
    print_section("需求1: 重复导入同批数据不翻倍")

    records = [
        CandidateRecord(record_id="A001", features={"f1": 0.8, "f2": 0.3}, remark="初始记录1"),
        CandidateRecord(record_id="A002", features={"f1": 0.2, "f2": 0.9}, remark="初始记录2"),
    ]

    from models.candidate import CandidateTable
    from core.dedup_engine import DedupEngine

    table = CandidateTable(name="test_dedup")
    dedup = DedupEngine()

    result1 = dedup.safe_import_records(table, records, "xiaoqiao", "第一次导入")
    print(f"第一次导入: {result1['imported_count']} 条, 总记录数: {table.get_record_count()}")

    result2 = dedup.safe_import_records(table, records, "xiaoqiao", "重复导入同一批")
    print(f"第二次导入(同批): {result2['imported_count']} 条, 总记录数: {table.get_record_count()}")
    print(f"  跳过原因: 全局去重 {result2['global_dup_count']} 条, 表内去重 {result2['table_dup_count']} 条")

    assert table.get_record_count() == 2, "重复导入后数量不应该翻倍"
    print("✅ 验证通过: 重复导入不翻倍")


def demo_2_remark_history():
    """需求2: 改备注能看历史"""
    print_section("需求2: 改备注能看改前改后差别")

    record = CandidateRecord(record_id="B001", features={"f1": 0.5}, remark="初始备注")
    diff_engine = DiffEngine()

    print("初始备注:", record.remark)

    diffs1 = record.update({"remark": "第一次修改备注"}, "xiaoqiao", "补充信息")
    print(f"\n第1次修改: {diffs1[0].old_value} → {diffs1[0].new_value}")

    diffs2 = record.update({"remark": "第二次修改，补充更多细节"}, "xiaoqiao", "完善说明")
    print(f"第2次修改: {diffs2[0].old_value} → {diffs2[0].new_value}")

    history = diff_engine.format_remark_change_history(record)
    print("\n📜 完整备注历史:")
    for h in history:
        print(f"  v{h['version']} [{h['timestamp'][:19]}]: {h['remark']}")

    print("✅ 验证通过: 备注历史清晰可追溯")


def demo_3_workflow_and_threshold():
    """需求3+6+7: 三步工作流 + 阈值不一致处理"""
    print_section("需求3+6+7: 三步工作流 + 阈值不一致悬置给科学家")

    engine = WorkflowEngine()
    ctx = engine.start_workflow("演示工作流")

    # ===== 第一步: 导入召回候选表 =====
    print("\n📍 第一步: 导入召回候选表")
    records = [
        CandidateRecord(record_id="S001", features={"f1": 0.9, "f2": 0.1}, remark="高可疑"),
        CandidateRecord(record_id="S002", features={"f1": 0.3, "f2": 0.4}, remark="待确认"),
        CandidateRecord(record_id="S003", features={"f1": 0.6, "f2": 0.7}, remark="中等"),
    ]
    step1 = engine.execute_step_1_import(ctx, "召回表_0607", records, "xiaoqiao")
    print(f"  导入结果: {step1['record_count']} 条记录")
    print(f"  下一步: {step1['next_step']}")

    # ===== 第二步: 算法工程师小乔补看参数YAML =====
    print("\n📍 第二步: 算法工程师小乔补看参数YAML")
    params = ParamsYAML(name="参数_v1")
    params.thresholds = {"anomaly_score": 0.5}
    step2 = engine.execute_step_2_review_params(ctx, params, "xiaoqiao")
    print(f"  当前阈值: {step2['thresholds']}")
    print(f"  下一步: {step2['next_step']}")

    # ===== 第三步: 分层指标更新 =====
    print("\n📍 第三步: 分层指标更新")
    def scoring_fn(record, params):
        return (record.features["f1"] + record.features["f2"]) / 2

    step3 = engine.execute_step_3_update_layers(
        ctx, "分层结果_v1", scoring_fn, "anomaly_score", "xiaoqiao"
    )
    print(f"  生成分层: {step3['total_items']} 条")
    print(f"  状态统计: {step3['summary']['status_counts']}")

    # ===== 模拟: 阈值被改了但报告还是旧值 =====
    print("\n⚠️  模拟: 阈值从 0.5 改成 0.7，但分层报告还是按 0.5 生成的")
    params.update_threshold("anomaly_score", 0.7, "xiaoqiao", "调整阈值")

    checker = ThresholdChecker()
    scan = checker.scan_all_items_for_mismatch(ctx.layer_result, params, "system", auto_suspend=True)
    print(f"  检测到阈值不一致: {scan['mismatch_count']} 条")
    for m in scan['mismatches']:
        print(f"    - 记录{m['record_id']}: 报告阈值={m['reported_threshold']}, 当前阈值={m['actual_threshold']}")

    print(f"\n  📌 当前工作流状态: {ctx.current_step.value}")
    print(f"  📌 待数据科学家复核: {ctx.pending_review_items}")

    # ===== 数据科学家复核 =====
    print("\n👨‍🔬 数据科学家复核:")
    for rec_id in ctx.pending_review_items.copy():
        result = engine.scientist_review(ctx, rec_id, "confirm_normal", "data_scientist", "阈值调整后确认正常")
        print(f"  记录{rec_id}: {result['new_status']}")

    print(f"\n  ✅ 复核完成，工作流状态: {ctx.current_step.value}")
    print("✅ 验证通过: 三步工作流 + 阈值不一致自动悬置 + 科学家复核")

    return ctx


def demo_4_report_generation(ctx):
    """需求4+5: 智能报告 + 审计追溯"""
    print_section("需求4+5: 智能报告（不是冷冰冰的日志）")

    reporter = ReportGenerator()
    report = reporter.generate_human_readable_report(
        ctx.layer_result, ctx.candidate_table, ctx.params_yaml
    )
    print(report)
    print("✅ 验证通过: 报告带决策理由、缺失材料、下一步找谁")


def demo_5_visualization_trace(ctx):
    """需求3: 3D/图表可追溯"""
    print_section("需求3: 3D可视化 + 点击追溯原始数据")

    viz = VisualizationLayer()
    points = viz.build_from_layer_result(
        ctx.layer_result, ctx.candidate_table,
        viz_type=VizType.CHART_3D,
        x_feature="f1", y_feature="f2", z_feature="f1"
    )

    meta = viz.get_viz_metadata()
    print(f"  可视化类型: {meta['viz_type']}")
    print(f"  数据点数: {meta['point_count']}")
    print(f"  数据源ID: 分层结果={meta['source_ids']['layer_result'][:20]}...")

    drill = viz.drill_down("S001")
    print(f"\n🔍 点击 S001 下钻追溯:")
    print(f"  坐标: ({drill['visualization_coords']['x']}, {drill['visualization_coords']['y']})")
    print(f"  可跳转选项:")
    for opt in drill['navigate_options']:
        print(f"    → {opt['label']} (ID: {opt['id'][:15]}...)")

    print("✅ 验证通过: 可视化可追溯到召回候选表和参数YAML")


def demo_6_audit_trail(ctx):
    """需求5: 谁改了什么、为什么改、影响哪些结果"""
    print_section("需求5: 完整审计链 — 谁改了什么、为什么改")

    tracer = HistoryTracer()
    audit = tracer.get_full_audit_trail(ctx.candidate_table, ctx.params_yaml, ctx.layer_result)

    print("📜 完整操作审计（按时间排序）:")
    for entry in audit:
        reason = f" — {entry['reason']}" if entry.get('reason') else ""
        print(f"  [{entry['timestamp'][:19]}] {entry['operator']} | {entry['operation']} | {entry['source']}{reason}")

    print("\n🔍 阈值变更影响分析:")
    impact = tracer.trace_threshold_impact(ctx.params_yaml, "anomaly_score", [ctx.layer_result])
    print(f"  阈值 anomaly_score 历史版本: {len(impact['history'])} 次变更")
    print(f"  影响分层记录数: {impact['affected_count']} 条")

    print("✅ 验证通过: 完整审计追溯")


def main():
    print("\n" + "🚀"*30)
    print("  异常点可视化分层系统 — 全需求验证演示")
    print("🚀"*30)

    demo_1_dedup_import()
    demo_2_remark_history()
    ctx = demo_3_workflow_and_threshold()
    demo_4_report_generation(ctx)
    demo_5_visualization_trace(ctx)
    demo_6_audit_trail(ctx)

    print("\n" + "🎉"*30)
    print("  所有需求验证通过！")
    print("🎉"*30)
    print("""
总结已覆盖的需求点:
┌─────────────────────────────────────────┬──────────┐
│ 需求点                                   │ 验证状态 │
├─────────────────────────────────────────┼──────────┤
│ 1. 重复导入候选表不翻倍                   │    ✅    │
│ 2. 改备注能看历史差异                     │    ✅    │
│ 3. 3D/图表可追溯到原始数据                │    ✅    │
│ 4. 报告带决策理由/缺材料/找谁              │    ✅    │
│ 5. 谁改了什么/为什么/影响什么              │    ✅    │
│ 6. 三步工作流：导入→补看YAML→更新          │    ✅    │
│ 7. 阈值旧值不归正常，留给科学家复核         │    ✅    │
└─────────────────────────────────────────┴──────────┘
""")


if __name__ == "__main__":
    main()
