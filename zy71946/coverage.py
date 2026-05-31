#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

from constellation_coverage import BatchEngine, RecordStatus
from constellation_coverage.models import Record


def cmd_run(args):
    engine = BatchEngine(data_dir=args.data_dir)
    print(f"开始处理目录: {args.input_dir}")
    
    if args.safe:
        results = engine.safe_re_run(args.input_dir)
    else:
        results = engine.run_pipeline(args.input_dir)
    
    print("\n=== 处理结果 ===")
    print(f"处理文件: {results['processed_files']} 个")
    print(f"跳过文件: {results['skipped_files']} 个")
    print(f"新增记录: {results['new_records']} 条")
    print(f"更新记录: {results['updated_records']} 条")
    print(f"总记录数: {results['total_records']} 条")
    
    if results.get('idempotent_verified'):
        print(f"幂等验证: {'✓ 通过' if results['idempotent_verified'] else '✗ 未通过'}")
    
    if results['errors']:
        print(f"\n错误 ({len(results['errors'])}):")
        for err in results['errors']:
            print(f"  - {err['file']}: {err['error']}")
    
    return 0


def cmd_status(args):
    engine = BatchEngine(data_dir=args.data_dir)
    stats = engine.get_statistics()
    
    print("\n=== 当前状态 ===")
    print(f"总记录数: {stats['total']}")
    
    print("\n按状态分布:")
    for status, count in sorted(stats['by_status'].items()):
        print(f"  {status}: {count}")
    
    print("\n按来源分布:")
    for source, count in sorted(stats['by_source'].items()):
        print(f"  {source}: {count}")
    
    print("\n按卫星分布:")
    for sat, count in sorted(stats['by_satellite'].items()):
        print(f"  {sat}: {count}")
    
    if stats['pending_reasons']:
        print("\n待处理原因:")
        for reason, count in stats['pending_reasons'].items():
            print(f"  - {reason}: {count} 条")
    
    return 0


def cmd_list(args):
    engine = BatchEngine(data_dir=args.data_dir)
    
    if args.status:
        status = RecordStatus(args.status)
        records = engine.processor.get_records_by_status(status)
    else:
        records = engine.processor.get_all_records()
    
    print(f"\n=== 记录列表 ({len(records)} 条) ===")
    for r in records:
        source_info = f"{r.source.type.value}:{r.source.system}"
        print(f"\nID: {r.id}")
        print(f"  卫星: {r.satellite}")
        print(f"  时间: {r.start_time.strftime('%m-%d %H:%M')} ~ {r.end_time.strftime('%m-%d %H:%M')}")
        print(f"  状态: {r.status.value}")
        print(f"  来源: {source_info} (文件: {r.source.file})")
        if r.pending_reason:
            print(f"  待处理原因: {r.pending_reason}")
    
    return 0


def cmd_show(args):
    engine = BatchEngine(data_dir=args.data_dir)
    record = engine.processor.get_record_by_id(args.id)
    
    if not record:
        print(f"错误: 找不到记录 ID {args.id}")
        return 1
    
    print(f"\n=== 记录详情: {args.id} ===")
    print(f"卫星: {record.satellite}")
    print(f"开始时间: {record.start_time.isoformat()}")
    print(f"结束时间: {record.end_time.isoformat()}")
    print(f"状态: {record.status.value}")
    print(f"创建时间: {record.created_at.isoformat()}")
    print(f"更新时间: {record.updated_at.isoformat()}")
    
    print("\n来源信息:")
    print(f"  类型: {record.source.type.value}")
    print(f"  系统: {record.source.system}")
    print(f"  文件: {record.source.file}")
    print(f"  导入时间: {record.source.import_time.isoformat()}")
    
    if record.pending_reason:
        print(f"\n待处理原因: {record.pending_reason}")
    
    if record.duplicate_of:
        print(f"\n重复记录, 主记录: {record.duplicate_of}")
    
    print("\n内容:")
    print(json.dumps(record.content, indent=2, ensure_ascii=False))
    
    print(f"\n审计日志 ({len(record.audit_log)} 条):")
    for log in record.audit_log:
        status_change = f"{log.from_status.value} → {log.to_status.value}" if log.from_status and log.to_status else log.action
        print(f"  [{log.timestamp.strftime('%m-%d %H:%M:%S')}] {log.actor}: {status_change}")
        if log.reason:
            print(f"    原因: {log.reason}")
    
    return 0


def cmd_overlaps(args):
    engine = BatchEngine(data_dir=args.data_dir)
    overlaps = engine.processor.find_window_overlaps()
    
    if not overlaps:
        print("未发现时间窗口重叠")
        return 0
    
    total = sum(len(pairs) for pairs in overlaps.values())
    print(f"\n=== 窗口重叠 ({total} 组) ===")
    
    for sat, pairs in overlaps.items():
        print(f"\n卫星 {sat}:")
        for i, (r1, r2) in enumerate(pairs, 1):
            print(f"\n  重叠组 {i}:")
            print(f"    记录1: {r1.id} [{r1.source.system}]")
            print(f"           {r1.start_time.strftime('%H:%M')} ~ {r1.end_time.strftime('%H:%M')}")
            print(f"    记录2: {r2.id} [{r2.source.system}]")
            print(f"           {r2.start_time.strftime('%H:%M')} ~ {r2.end_time.strftime('%H:%M')}")
    
    return 0


def cmd_resolve(args):
    engine = BatchEngine(data_dir=args.data_dir)
    record = engine.processor.get_record_by_id(args.id)
    
    if not record:
        print(f"错误: 找不到记录 ID {args.id}")
        return 1
    
    engine.processor.resolve_pending(args.id, args.actor or "user", args.reason)
    engine._save_records()
    print(f"记录 {args.id} 已标记为已解决")
    return 0


def cmd_discard(args):
    engine = BatchEngine(data_dir=args.data_dir)
    record = engine.processor.get_record_by_id(args.id)
    
    if not record:
        print(f"错误: 找不到记录 ID {args.id}")
        return 1
    
    engine.processor.discard_record(args.id, args.actor or "user", args.reason)
    engine._save_records()
    print(f"记录 {args.id} 已标记为废弃")
    return 0


def cmd_briefing(args):
    engine = BatchEngine(data_dir=args.data_dir)
    
    output_file = args.output or f"briefing_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    briefing = engine.export_briefing(output_file)
    
    print(f"\n=== 任务简报 ===")
    print(f"导出时间: {briefing['export_time']}")
    print(f"总记录数: {briefing['statistics']['total']}")
    
    pending_count = len(briefing['pending_records'])
    overlap_count = sum(len(v) for v in briefing['window_overlaps'].values())
    
    print(f"待处理记录: {pending_count} 条")
    print(f"窗口重叠: {overlap_count} 组")
    
    print(f"\n简报已导出: {output_file}")
    
    print("\n=== 复核清单 ===")
    print("  [ ] 1. 检查所有 pending 记录的待处理原因")
    print("  [ ] 2. 确认窗口重叠是否为正常现象")
    print("  [ ] 3. 核对来源系统数据一致性")
    print("  [ ] 4. 确认 late_arrival 记录是否需要补采")
    print("  [ ] 5. 检查 duplicate 记录是否已正确标记")
    
    return 0


def cmd_reset(args):
    engine = BatchEngine(data_dir=args.data_dir)
    
    if not args.force:
        confirm = input("确定要重置所有数据吗? 此操作不可恢复 (yes/no): ")
        if confirm.lower() != 'yes':
            print("已取消")
            return 1
    
    engine.reset()
    print("数据已重置")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description="星座覆盖缺口 - 卫星任务数据处理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
使用示例:
  1. 处理遥测数据:   coverage run ./telemetry_samples
  2. 查看统计状态:   coverage status
  3. 查看重叠窗口:   coverage overlaps
  4. 导出任务简报:   coverage briefing
  5. 复核后导出:     coverage briefing --output final_briefing.json
        """
    )
    parser.add_argument("--data-dir", default="./data", help="数据存储目录 (默认: ./data)")
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    run_parser = subparsers.add_parser("run", help="运行批量处理")
    run_parser.add_argument("input_dir", help="输入目录")
    run_parser.add_argument("--safe", action="store_true", help="安全模式，验证幂等性")
    
    subparsers.add_parser("status", help="查看当前状态统计")
    
    list_parser = subparsers.add_parser("list", help="列出记录")
    list_parser.add_argument("--status", help="按状态过滤")
    
    show_parser = subparsers.add_parser("show", help="显示记录详情")
    show_parser.add_argument("id", help="记录ID")
    
    subparsers.add_parser("overlaps", help="查看时间窗口重叠")
    
    resolve_parser = subparsers.add_parser("resolve", help="标记待处理记录为已解决")
    resolve_parser.add_argument("id", help="记录ID")
    resolve_parser.add_argument("--reason", required=True, help="解决原因")
    resolve_parser.add_argument("--actor", help="操作人")
    
    discard_parser = subparsers.add_parser("discard", help="标记记录为废弃")
    discard_parser.add_argument("id", help="记录ID")
    discard_parser.add_argument("--reason", required=True, help="废弃原因")
    discard_parser.add_argument("--actor", help="操作人")
    
    briefing_parser = subparsers.add_parser("briefing", help="导出任务简报")
    briefing_parser.add_argument("--output", help="输出文件路径")
    
    reset_parser = subparsers.add_parser("reset", help="重置所有数据")
    reset_parser.add_argument("--force", action="store_true", help="强制重置，不提示确认")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 1
    
    commands = {
        "run": cmd_run,
        "status": cmd_status,
        "list": cmd_list,
        "show": cmd_show,
        "overlaps": cmd_overlaps,
        "resolve": cmd_resolve,
        "discard": cmd_discard,
        "briefing": cmd_briefing,
        "reset": cmd_reset,
    }
    
    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
