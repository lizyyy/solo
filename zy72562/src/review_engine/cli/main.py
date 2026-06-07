#!/usr/bin/env python3
import argparse
import sys
import os
import json
from datetime import datetime
from typing import List

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", ".."))

from review_engine import ReviewEngine, NegativeSample, RecallCandidate, ReviewStatus


def parse_negative_samples(file_path: str) -> List[NegativeSample]:
    with open(file_path) as f:
        data = json.load(f)
    samples = []
    for item in data:
        item["timestamp"] = datetime.fromisoformat(item["timestamp"])
        if "imported_at" in item:
            item["imported_at"] = datetime.fromisoformat(item["imported_at"])
        samples.append(NegativeSample(**item))
    return samples


def parse_recall_candidates(file_path: str) -> List[RecallCandidate]:
    with open(file_path) as f:
        data = json.load(f)
    candidates = []
    for item in data:
        item["timestamp"] = datetime.fromisoformat(item["timestamp"])
        if "added_at" in item:
            item["added_at"] = datetime.fromisoformat(item["added_at"])
        candidates.append(RecallCandidate(**item))
    return candidates


def print_anomaly_list(anomalies, show_details=False):
    if not anomalies:
        print("（无异常样本）")
        return
    print(f"\n共 {len(anomalies)} 条异常样本：")
    print("-" * 100)
    for idx, anomaly in enumerate(anomalies, 1):
        status_emoji = {
            "imported": "📥",
            "recall_added": "🔗",
            "anomaly_detected": "⚠️",
            "pending_expert_review": "🔍",
            "expert_approved": "✅",
            "expert_rejected": "❌",
            "archived": "📦",
        }.get(anomaly.status.value, "❓")

        tw_flag = "🕐 有时间窗问题" if anomaly.has_time_window_inflation() else "  无时间窗问题"
        recall_count = len(anomaly.recall_candidates)

        print(f"{idx}. [{status_emoji}] {anomaly.anomaly_id}")
        print(f"   样本ID: {anomaly.sample_id}")
        print(f"   主流程: {anomaly.negative_sample.main_process_name}")
        print(f"   状态: {anomaly.status.value} | {tw_flag} | 召回候选: {recall_count}条")
        print(f"   标签: {', '.join(anomaly.tags) if anomaly.tags else '无'}")
        if show_details:
            print(f"   为何留下: {anomaly.why_kept}")
            print(f"   缺材料: {', '.join(anomaly.missing_materials) if anomaly.missing_materials else '无'}")
            if anomaly.next_action:
                print(f"   下一步: {anomaly.get_owner_display()} - {anomaly.next_action.action_description}")
        print("-" * 100)


def print_anomaly_detail(anomaly):
    print("\n" + "=" * 100)
    print(f"异常样本详情 - {anomaly.anomaly_id}")
    print("=" * 100)

    print("\n📋 基本信息")
    print(f"  异常ID: {anomaly.anomaly_id}")
    print(f"  样本ID: {anomaly.sample_id}")
    print(f"  状态: {anomaly.status.value}")
    print(f"  检测时间: {anomaly.detected_at}")
    print(f"  更新时间: {anomaly.updated_at}")
    print(f"  标签: {', '.join(anomaly.tags) if anomaly.tags else '无'}")

    print("\n🔴 负样本信息（主流程）")
    print(f"  主流程ID: {anomaly.negative_sample.main_process_id}")
    print(f"  主流程名称: {anomaly.negative_sample.main_process_name}")
    print(f"  时间戳: {anomaly.negative_sample.timestamp}")
    print(f"  模型预测分: {anomaly.negative_sample.model_prediction_score}")
    print(f"  真实标签: {anomaly.negative_sample.ground_truth_label}")
    print(f"  时间窗标记: {anomaly.negative_sample.time_window_tag or '无'}")
    print(f"  来源: {anomaly.negative_sample.source or '未知'}")
    if anomaly.negative_sample.feature_values:
        print(f"  特征值: {json.dumps(anomaly.negative_sample.feature_values, ensure_ascii=False, indent=6)}")

    if anomaly.recall_candidates:
        print(f"\n🟢 召回候选信息（现场说法）- 共 {len(anomaly.recall_candidates)} 条")
        for idx, rc in enumerate(anomaly.recall_candidates, 1):
            print(f"  [{idx}] 候选ID: {rc.candidate_id}")
            print(f"      场景描述: {rc.scene_description}")
            print(f"      时间戳: {rc.timestamp}")
            print(f"      召回来源: {rc.recall_source}")
            print(f"      置信度: {rc.confidence_score}")
            print(f"      现场证据: {rc.field_evidence or '无'}")
            print(f"      补录人: {rc.added_by or '未知'}")
            print(f"      备注: {rc.notes or '无'}")

    if anomaly.time_window_issues:
        print(f"\n🕐 时间窗穿越问题 - 共 {len(anomaly.time_window_issues)} 个")
        for idx, issue in enumerate(anomaly.time_window_issues, 1):
            severity_emoji = {
                "low": "🟡",
                "medium": "🟠",
                "high": "🔴",
                "critical": "💥",
            }.get(issue.severity.value, "⚪")
            print(f"  [{idx}] {severity_emoji} [{issue.severity.value}] {issue.issue_id}")
            print(f"      描述: {issue.description}")
            if issue.window_start and issue.window_end:
                print(f"      时间窗: {issue.window_start} ~ {issue.window_end}")
            print(f"      影响指标: {', '.join(issue.affected_metrics)}")
            print(f"      效果虚高估计: {issue.inflated_effect_estimate:.1%}")

    if anomaly.evidence_merge:
        print("\n🔗 证据合并结果")
        print(f"  合并ID: {anomaly.evidence_merge.merged_evidence_id}")
        print(f"  摘要: {anomaly.evidence_merge.summary}")
        if anomaly.evidence_merge.supporting_points:
            print(f"  支持点:")
            for p in anomaly.evidence_merge.supporting_points:
                print(f"    ✓ {p}")
        if anomaly.evidence_merge.conflicting_points:
            print(f"  冲突点:")
            for p in anomaly.evidence_merge.conflicting_points:
                print(f"    ✗ {p}")

    print("\n❓ 为什么这条被留下")
    print(f"  {anomaly.why_kept}")

    print("\n📦 还缺什么材料")
    if anomaly.missing_materials:
        for m in anomaly.missing_materials:
            print(f"  - {m}")
    else:
        print("  材料齐全 ✓")

    print("\n👤 下一步该找谁")
    if anomaly.next_action:
        print(f"  负责人: {anomaly.get_owner_display()}")
        print(f"  行动: {anomaly.next_action.action_description}")
        print(f"  期限: {anomaly.next_action.deadline_hint}")
        print(f"  联系方式: {anomaly.next_action.contact_info}")
    else:
        print("  暂未分配")

    if anomaly.review_comments:
        print("\n💬 复核评论")
        for c in anomaly.review_comments:
            print(f"  {c}")

    print("\n" + "=" * 100)


def print_report(engine, output_file=None):
    stats = engine.get_statistics()
    anomalies = engine.get_anomaly_list()

    report_lines = []
    report_lines.append("=" * 80)
    report_lines.append("模型蒸馏质量复核报告")
    report_lines.append("=" * 80)
    report_lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    report_lines.append("")

    report_lines.append("📊 统计概览")
    report_lines.append("-" * 80)
    report_lines.append(f"  异常样本总数: {stats['total_anomalies']}")
    report_lines.append(f"  存在时间窗问题: {stats['with_time_window_issues']}")
    report_lines.append(f"  已补召回候选: {stats['with_recall_candidates']}")
    report_lines.append(f"  待专家复核: {stats['pending_expert_review']}")
    report_lines.append("")
    report_lines.append("  按状态分布:")
    for status, count in stats["by_status"].items():
        report_lines.append(f"    - {status}: {count}")
    report_lines.append("")

    pending = engine.get_anomaly_list(status=ReviewStatus.PENDING_EXPERT_REVIEW)
    if pending:
        report_lines.append("🔍 待实验平台负责人复核（时间窗穿越问题）")
        report_lines.append("-" * 80)
        for a in pending:
            report_lines.append(f"  [{a.anomaly_id}] {a.negative_sample.main_process_name}")
            report_lines.append(f"      时间窗问题数: {len(a.time_window_issues)}")
            report_lines.append(f"      最高严重程度: {max([i.severity.value for i in a.time_window_issues], default='N/A')}")
            report_lines.append("")

    need_recall = [a for a in anomalies if not a.recall_candidates and a.status == ReviewStatus.IMPORTED]
    if need_recall:
        report_lines.append("📌 待推荐策略老唐补录召回候选")
        report_lines.append("-" * 80)
        for a in need_recall:
            report_lines.append(f"  [{a.anomaly_id}] {a.negative_sample.main_process_name}")
            report_lines.append(f"      缺: {', '.join(a.missing_materials)}")
            report_lines.append("")

    report_lines.append("📋 所有异常样本摘要")
    report_lines.append("-" * 80)
    for a in anomalies:
        tw = "🕐时间窗" if a.has_time_window_inflation() else "  正常"
        rc = f"🔗{len(a.recall_candidates)}条召回" if a.recall_candidates else "  无召回"
        report_lines.append(f"  [{a.status.value}] {a.anomaly_id} | {tw} | {rc} | {a.negative_sample.main_process_name}")

    report_lines.append("")
    report_lines.append("=" * 80)
    report_lines.append("-- 报告结束 --")
    report_lines.append("=" * 80)

    report_text = "\n".join(report_lines)
    print(report_text)

    if output_file:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report_text)
        print(f"\n报告已保存到: {output_file}")


def cmd_import(args):
    engine = ReviewEngine(storage_path=args.storage)
    samples = parse_negative_samples(args.file)
    new_anomalies = engine.import_negative_samples(samples)
    print(f"成功导入 {len(samples)} 条负样本，生成 {len(new_anomalies)} 条异常记录")
    if args.verbose:
        print_anomaly_list(new_anomalies, show_details=True)


def cmd_add_recall(args):
    engine = ReviewEngine(storage_path=args.storage)
    candidates = parse_recall_candidates(args.file)
    updated = engine.add_recall_candidates(candidates)
    print(f"成功补录 {len(candidates)} 条召回候选，更新 {len(updated)} 条异常记录")
    if args.verbose:
        print_anomaly_list(updated, show_details=True)


def cmd_list(args):
    engine = ReviewEngine(storage_path=args.storage)
    status = ReviewStatus(args.status) if args.status else None
    has_tw = args.has_time_window
    anomalies = engine.get_anomaly_list(status=status, has_time_window_issue=has_tw)
    print_anomaly_list(anomalies, show_details=args.detail)


def cmd_detail(args):
    engine = ReviewEngine(storage_path=args.storage)
    anomaly = engine.get_anomaly_detail(args.anomaly_id)
    if not anomaly:
        print(f"错误: 找不到异常样本 {args.anomaly_id}")
        sys.exit(1)
    print_anomaly_detail(anomaly)


def cmd_review(args):
    engine = ReviewEngine(storage_path=args.storage)
    result = engine.submit_expert_review(
        anomaly_id=args.anomaly_id,
        reviewer=args.reviewer,
        approved=args.approve,
        comment=args.comment,
    )
    if not result:
        print(f"错误: 找不到异常样本 {args.anomaly_id}")
        sys.exit(1)
    action = "通过" if args.approve else "驳回"
    print(f"专家复核完成: {action} - {args.anomaly_id}")
    print_anomaly_detail(result)


def cmd_report(args):
    engine = ReviewEngine(storage_path=args.storage)
    print_report(engine, output_file=args.output)


def cmd_stats(args):
    engine = ReviewEngine(storage_path=args.storage)
    stats = engine.get_statistics()
    print("\n📊 复核统计")
    print("-" * 50)
    print(f"  异常样本总数: {stats['total_anomalies']}")
    print(f"  存在时间窗问题: {stats['with_time_window_issues']}")
    print(f"  已补召回候选: {stats['with_recall_candidates']}")
    print(f"  待专家复核: {stats['pending_expert_review']}")
    print("\n  按状态分布:")
    for status, count in stats["by_status"].items():
        print(f"    {status}: {count}")
    print()


def cmd_demo(args):
    print("🧪 运行端到端演示...")
    engine = ReviewEngine(storage_path=args.storage)

    sample_data_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "data")
    neg_file = os.path.join(sample_data_dir, "sample_negative_samples.json")
    recall_file = os.path.join(sample_data_dir, "sample_recall_candidates.json")

    if not os.path.exists(neg_file):
        print(f"错误: 找不到样例数据 {neg_file}")
        sys.exit(1)

    print("\n[第一步] 导入负样本列表")
    print("-" * 60)
    samples = parse_negative_samples(neg_file)
    anomalies = engine.import_negative_samples(samples)
    print(f"✓ 导入了 {len(samples)} 条负样本")
    has_tw = sum(1 for a in anomalies if a.has_time_window_inflation())
    print(f"✓ 检测到 {has_tw} 条存在时间窗穿越问题，已标记待实验平台复核")
    print_anomaly_list(anomalies)

    if os.path.exists(recall_file):
        print("\n[第二步] 推荐策略老唐补录召回候选表")
        print("-" * 60)
        candidates = parse_recall_candidates(recall_file)
        updated = engine.add_recall_candidates(candidates)
        print(f"✓ 补录了 {len(candidates)} 条召回候选")
        print(f"✓ 影响了 {len(updated)} 条异常记录")

        print("\n[第三步] 异常样本页自动更新")
        print("-" * 60)
        print_anomaly_list(updated, show_details=True)

    print("\n[第四步] 生成复核报告")
    print("-" * 60)
    print_report(engine)

    print("\n🎉 演示完成！你可以用 review list / review detail 继续探索")


def main():
    parser = argparse.ArgumentParser(
        prog="review",
        description="模型蒸馏质量复核工具 - 整合负样本与召回候选，检测时间窗穿越问题",
    )
    parser.add_argument("--storage", default="./review_data", help="数据存储目录")
    subparsers = parser.add_subparsers(dest="command", required=True)

    p_import = subparsers.add_parser("import", help="导入负样本列表")
    p_import.add_argument("file", help="负样本JSON文件路径")
    p_import.add_argument("-v", "--verbose", action="store_true", help="显示详情")
    p_import.set_defaults(func=cmd_import)

    p_add_recall = subparsers.add_parser("add-recall", help="补录召回候选表")
    p_add_recall.add_argument("file", help="召回候选JSON文件路径")
    p_add_recall.add_argument("-v", "--verbose", action="store_true", help="显示详情")
    p_add_recall.set_defaults(func=cmd_add_recall)

    p_list = subparsers.add_parser("list", help="列出异常样本")
    p_list.add_argument("--status", choices=[s.value for s in ReviewStatus], help="按状态过滤")
    p_list.add_argument("--has-time-window", action="store_true", default=None, help="只看有时间窗问题的")
    p_list.add_argument("-d", "--detail", action="store_true", help="显示详细信息")
    p_list.set_defaults(func=cmd_list)

    p_detail = subparsers.add_parser("detail", help="查看异常样本详情")
    p_detail.add_argument("anomaly_id", help="异常样本ID")
    p_detail.set_defaults(func=cmd_detail)

    p_review = subparsers.add_parser("review", help="专家复核")
    p_review.add_argument("anomaly_id", help="异常样本ID")
    p_review.add_argument("--reviewer", required=True, help="复核人")
    p_review.add_argument("--approve", action="store_true", help="通过复核")
    p_review.add_argument("--reject", action="store_true", help="驳回")
    p_review.add_argument("--comment", default="", help="复核意见")
    p_review.set_defaults(func=cmd_review)

    p_report = subparsers.add_parser("report", help="生成复核报告")
    p_report.add_argument("-o", "--output", help="输出报告文件")
    p_report.set_defaults(func=cmd_report)

    p_stats = subparsers.add_parser("stats", help="查看统计信息")
    p_stats.set_defaults(func=cmd_stats)

    p_demo = subparsers.add_parser("demo", help="运行端到端演示（三步流程）")
    p_demo.set_defaults(func=cmd_demo)

    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
