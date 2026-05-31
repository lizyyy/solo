import sys
import argparse
import json
import csv
from datetime import datetime
from pathlib import Path
from typing import List

from models import PlayerRecord, RecordStatus
from dispatcher import UndergroundDispatcher
from state_viewer import StateViewer, AnomalyExplainer
from exporter import DataExporter


def parse_player_records_from_csv(filepath: str) -> List[PlayerRecord]:
    records = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                completion_time = datetime.fromisoformat(row['completion_time'])
            except (KeyError, ValueError):
                completion_time = datetime.now()

            try:
                reward_amount = float(row.get('reward_amount', 0))
            except (ValueError, TypeError):
                reward_amount = 0.0

            raw_data = dict(row)
            pr = PlayerRecord(
                player_id=row.get('player_id', ''),
                activity_id=row.get('activity_id', ''),
                task_id=row.get('task_id', ''),
                completion_time=completion_time,
                reward_amount=reward_amount,
                source=row.get('source', 'unknown'),
                raw_data=raw_data,
                attachment_path=row.get('attachment_path') or None
            )
            records.append(pr)
    return records


def cmd_batch(args):
    dispatcher = UndergroundDispatcher(args.data_path)

    records = parse_player_records_from_csv(args.input)
    print(f"读取到 {len(records)} 条记录")

    activity_deadline = None
    if args.deadline:
        activity_deadline = datetime.fromisoformat(args.deadline)

    result = dispatcher.batch_process(records, activity_deadline, args.operator)

    print(f"\n══════════════ 批量处理结果 ══════════════")
    print(f"批次ID: {result.batch_id}")
    print(f"总记录数: {result.total_records}")
    print(f"新增记录: {result.new_records}")
    print(f"重复记录: {result.duplicate_records}")
    print(f"晚到记录: {result.late_records}")
    print(f"异常数量: {result.anomaly_count}")
    print(f"处理耗时: {result.duration_seconds:.2f}秒")
    print(f"处理时间: {result.processed_at.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"═══════════════════════════════════════════")

    stats = dispatcher.get_statistics()
    print(f"\n当前系统统计:")
    for k, v in stats.items():
        print(f"  {k}: {v}")


def cmd_timeline(args):
    dispatcher = UndergroundDispatcher(args.data_path)
    viewer = StateViewer(dispatcher)
    print(viewer.format_timeline(args.record_id))


def cmd_anomaly(args):
    dispatcher = UndergroundDispatcher(args.data_path)
    explainer = AnomalyExplainer(dispatcher)

    if args.list:
        print(explainer.format_anomalies_report(unresolved_only=not args.all))
    elif args.anomaly_id:
        for record in dispatcher.records.values():
            for anomaly in record.anomalies:
                if anomaly.anomaly_id == args.anomaly_id:
                    print(explainer.format_explanation(anomaly))
                    return
        print(f"未找到异常 {args.anomaly_id}")
    elif args.resolve:
        success = dispatcher.resolve_anomaly(args.resolve, args.reason, args.operator)
        if success:
            print(f"异常 {args.resolve} 已标记为已解决")
        else:
            print(f"未找到异常 {args.resolve}")


def cmd_export(args):
    dispatcher = UndergroundDispatcher(args.data_path)
    exporter = DataExporter(dispatcher, args.export_path)

    if args.review:
        result = exporter.review_before_export(args.activity_id)
        print(f"\n══════════════ 导出前复核 ══════════════")
        print(f"待导出记录数: {result['preview_count']}")
        print(f"问题记录数: {result['issue_count']}")
        print(f"建议: {result['recommendation']}")
        if result['issues']:
            print(f"\n问题详情:")
            for issue in result['issues']:
                print(f"  - {issue['record_id']} (玩家 {issue['player_id']}): {issue['issue']}")
        print(f"\n导出摘要:")
        for k, v in result['preview_summary'].items():
            print(f"  {k}: {v}")
        print(f"═══════════════════════════════════════════")
        return

    if args.verify:
        result = exporter.verify_export_consistency(args.verify)
        print(f"\n══════════════ 导出一致性校验 ══════════════")
        print(f"批次ID: {args.verify}")
        print(f"校验结果: {'通过 ✓' if result['consistent'] else '不通过 ✗'}")
        print(f"校验和匹配: {result['checksum_match']}")
        print(f"摘要匹配: {result['summary_match']}")
        if result['missing_records']:
            print(f"缺失记录: {result['missing_records']}")
        if result['modified_records']:
            print(f"被修改记录: {result['modified_records']}")
        print(f"═══════════════════════════════════════════")
        return

    if args.summary:
        result = exporter.export_summary_to_csv(args.activity_id)
        print(f"统计摘要已导出: {result['filepath']}")
        return

    if args.history:
        history = exporter.get_export_history(args.activity_id)
        print(f"\n══════════════ 导出历史 ══════════════")
        for entry in history:
            print(f"批次: {entry['export_batch_id']}")
            print(f"  文件: {entry['filename']}")
            print(f"  时间: {entry['exported_at']}")
            print(f"  数量: {entry['record_count']} 条")
            print(f"  操作人: {entry['operator']}")
            print()
        print(f"═══════════════════════════════════════")
        return

    status_filter = None
    if args.status:
        status_filter = [RecordStatus(s) for s in args.status]

    result = exporter.export_to_csv(
        activity_id=args.activity_id,
        status_filter=status_filter,
        include_duplicates=args.include_duplicates,
        operator=args.operator,
        force=args.force
    )

    print(f"\n══════════════ 导出结果 ══════════════")
    print(result['message'])
    if result.get('duplicate'):
        existing = result.get('existing_export', {})
        print(f"已有导出批次: {existing.get('export_batch_id')}")
        print(f"文件: {existing.get('filename')}")
    elif result.get('success'):
        print(f"导出批次: {result['export_batch_id']}")
        print(f"文件路径: {result['filepath']}")
        print(f"导出数量: {result['exported_count']} 条")
        if result.get('summary'):
            print(f"导出摘要:")
            for k, v in result['summary'].items():
                print(f"  {k}: {v}")
    print(f"═══════════════════════════════════════")


def cmd_correct(args):
    dispatcher = UndergroundDispatcher(args.data_path)

    corrected_fields = {}
    if args.reward_amount is not None:
        corrected_fields['reward_amount'] = args.reward_amount
    if args.completion_time:
        corrected_fields['completion_time'] = datetime.fromisoformat(args.completion_time)
    if args.source:
        corrected_fields['source'] = args.source

    if not corrected_fields:
        print("请指定要更正的字段")
        return

    try:
        record = dispatcher.apply_manual_correction(
            args.record_id,
            corrected_fields,
            args.operator,
            args.reason
        )
        print(f"更正成功，记录 {args.record_id} 当前状态: {record.current_status.value}")
    except ValueError as e:
        print(f"更正失败: {e}")


def cmd_missed(args):
    dispatcher = UndergroundDispatcher(args.data_path)

    if args.mark:
        try:
            record = dispatcher.mark_reward_missed(args.mark, args.reason, args.operator)
            print(f"记录 {args.mark} 已标记为漏发")
        except ValueError as e:
            print(f"操作失败: {e}")
        return

    if args.mark_sent:
        try:
            record = dispatcher.mark_reward_sent(args.mark_sent, args.operator)
            print(f"记录 {args.mark_sent} 已标记为已发奖")
        except ValueError as e:
            print(f"操作失败: {e}")
        return

    missed = dispatcher.get_missed_rewards()
    print(f"\n══════════════ 漏发奖励列表 ══════════════")
    if not missed:
        print("没有漏发记录")
    else:
        for record in missed:
            pr = record.player_record
            print(f"记录ID: {record.record_id}")
            print(f"  玩家: {pr.player_id}")
            print(f"  活动: {pr.activity_id} / 任务: {pr.task_id}")
            print(f"  应发奖励: {pr.reward_amount}")
            print(f"  完成时间: {pr.completion_time.strftime('%Y-%m-%d %H:%M:%S')}")
            anomalies = [a for a in record.anomalies if a.anomaly_type.value == "奖励金额不符"]
            if anomalies:
                print(f"  异常描述: {anomalies[-1].description}")
            print()
    print(f"═══════════════════════════════════════════")


def cmd_stats(args):
    dispatcher = UndergroundDispatcher(args.data_path)
    stats = dispatcher.get_statistics()

    print(f"\n══════════════ 系统统计 ══════════════")
    print(f"统计时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    for k, v in sorted(stats.items()):
        print(f"{k}: {v}")
    print(f"═══════════════════════════════════════")


def main():
    parser = argparse.ArgumentParser(description="地下车站调度系统 - 活动奖励处理工具")
    parser.add_argument("--data-path", default="./data", help="数据存储路径")
    subparsers = parser.add_subparsers(dest="command", required=True)

    batch_parser = subparsers.add_parser("batch", help="批量处理玩家记录")
    batch_parser.add_argument("--input", required=True, help="输入CSV文件路径")
    batch_parser.add_argument("--deadline", help="活动截止时间 (ISO格式)")
    batch_parser.add_argument("--operator", default="system", help="操作人")

    timeline_parser = subparsers.add_parser("timeline", help="查看记录状态时间线")
    timeline_parser.add_argument("--record-id", required=True, help="记录ID")

    anomaly_parser = subparsers.add_parser("anomaly", help="异常管理")
    anomaly_parser.add_argument("--list", action="store_true", help="列出所有异常")
    anomaly_parser.add_argument("--all", action="store_true", help="包含已解决的异常")
    anomaly_parser.add_argument("--anomaly-id", help="查看特定异常详情")
    anomaly_parser.add_argument("--resolve", help="标记异常为已解决")
    anomaly_parser.add_argument("--reason", default="人工处理", help="处理原因")
    anomaly_parser.add_argument("--operator", default="operator", help="操作人")

    export_parser = subparsers.add_parser("export", help="导出奖励数据")
    export_parser.add_argument("--activity-id", help="活动ID，不指定则导出全部")
    export_parser.add_argument("--status", nargs="*", help="按状态筛选")
    export_parser.add_argument("--include-duplicates", action="store_true", help="包含重复记录")
    export_parser.add_argument("--export-path", default="./exports", help="导出路径")
    export_parser.add_argument("--operator", default="system", help="操作人")
    export_parser.add_argument("--force", action="store_true", help="强制导出（忽略重复检测）")
    export_parser.add_argument("--review", action="store_true", help="导出前复核")
    export_parser.add_argument("--verify", help="校验指定导出批次的一致性")
    export_parser.add_argument("--summary", action="store_true", help="导出统计摘要")
    export_parser.add_argument("--history", action="store_true", help="查看导出历史")

    correct_parser = subparsers.add_parser("correct", help="人工更正记录")
    correct_parser.add_argument("--record-id", required=True, help="记录ID")
    correct_parser.add_argument("--reward-amount", type=float, help="更正奖励金额")
    correct_parser.add_argument("--completion-time", help="更正完成时间 (ISO格式)")
    correct_parser.add_argument("--source", help="更正数据来源")
    correct_parser.add_argument("--reason", required=True, help="更正原因")
    correct_parser.add_argument("--operator", default="operator", help="操作人")

    missed_parser = subparsers.add_parser("missed", help="漏发奖励管理")
    missed_parser.add_argument("--mark", help="标记指定记录为漏发")
    missed_parser.add_argument("--mark-sent", help="标记指定记录为已发奖")
    missed_parser.add_argument("--reason", default="玩家反馈漏发", help="漏发原因")
    missed_parser.add_argument("--operator", default="operator", help="操作人")

    subparsers.add_parser("stats", help="查看系统统计")

    args = parser.parse_args()

    if args.command == "batch":
        cmd_batch(args)
    elif args.command == "timeline":
        cmd_timeline(args)
    elif args.command == "anomaly":
        cmd_anomaly(args)
    elif args.command == "export":
        cmd_export(args)
    elif args.command == "correct":
        cmd_correct(args)
    elif args.command == "missed":
        cmd_missed(args)
    elif args.command == "stats":
        cmd_stats(args)


if __name__ == "__main__":
    main()
