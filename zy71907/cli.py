#!/usr/bin/env python3
import argparse
import sys
from datetime import datetime
from service import MusicReviewService
from database import SourceType, RecordStatus


def format_time(iso_str: str) -> str:
    try:
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime('%m-%d %H:%M')
    except:
        return iso_str[:16]


def print_table(headers, rows, widths=None):
    if widths is None:
        widths = [len(h) for h in headers]
        for row in rows:
            for i, cell in enumerate(row):
                widths[i] = max(widths[i], len(str(cell)))

    header_line = ' | '.join(f"{h:<{w}}" for h, w in zip(headers, widths))
    print(header_line)
    print('-' * len(header_line))

    for row in rows:
        print(' | '.join(f"{str(c):<{w}}" for c, w in zip(row, widths)))


def cmd_import(args):
    service = MusicReviewService(args.db)
    source_map = {
        'voice': SourceType.VOICE_LEADER,
        'metronome': SourceType.METRONOME,
        'manual': SourceType.MANUAL
    }

    count, warnings = service.import_records(
        file_path=args.file,
        source=source_map[args.source],
        operator=args.operator,
        source_note=args.note
    )

    print(f"成功导入 {count} 条记录")
    if warnings:
        print(f"\n警告 ({len(warnings)} 条):")
        for w in warnings:
            print(f"  - {w}")


def cmd_list(args):
    service = MusicReviewService(args.db)

    status_map = {'pending': '待处理', 'confirmed': '已确认', 'withdrawn': '已撤回'}
    status_filter = status_map.get(args.status) if args.status != 'all' else None

    source_map = {'voice': '声部长', 'metronome': '节拍器', 'manual': '手动录入'}
    source_filter = source_map.get(args.source) if args.source != 'all' else None

    records = service.db.list_records(
        status=status_filter,
        student_name=args.student,
        source=source_filter
    )

    if not records:
        print("没有找到记录")
        return

    headers = ['ID', '学生', '曲目', '声部', '状态', '来源', '创建人', '创建时间']
    widths = [4, 10, 16, 6, 6, 6, 8, 14]
    rows = []

    for r in records:
        rows.append([
            r.id,
            r.student_name[:8],
            r.song_title[:14],
            r.voice_part,
            r.status.value,
            r.source.value,
            r.created_by[:6],
            format_time(r.created_at)
        ])

    print_table(headers, rows, widths)
    print(f"\n共 {len(records)} 条记录")


def cmd_detail(args):
    service = MusicReviewService(args.db)
    detail = service.get_record_detail(args.id)

    if not detail:
        print(f"记录 {args.id} 不存在")
        return

    r = detail['record']
    print("=" * 50)
    print(f"记录 ID: {r.id}")
    print("=" * 50)
    print(f"学生姓名: {r.student_name}")
    print(f"曲目: {r.song_title}")
    print(f"声部: {r.voice_part}")
    print(f"状态: {r.status.value}")
    print(f"来源: {r.source.value}")
    if r.source_note:
        print(f"来源备注: {r.source_note}")
    if r.pending_reason:
        print(f"待处理原因: {r.pending_reason}")
    print(f"创建人: {r.created_by} @ {format_time(r.created_at)}")
    print(f"更新人: {r.updated_by} @ {format_time(r.updated_at)}")

    print("\n" + "=" * 50)
    print("修改历史")
    print("=" * 50)

    for h in detail['history']:
        if h.action == "创建":
            print(f"[{format_time(h.changed_at)}] {h.changed_by} 创建记录")
        elif h.action == "修改":
            print(f"[{format_time(h.changed_at)}] {h.changed_by} 修改 {h.field_name}: {h.old_value} → {h.new_value}")
            if h.note:
                print(f"  备注: {h.note}")


def cmd_withdraw(args):
    service = MusicReviewService(args.db)
    success = service.withdraw_record(args.id, args.operator, args.reason)

    if success:
        print(f"记录 {args.id} 已撤回")
    else:
        print(f"撤回失败：记录不存在或已撤回")


def cmd_confirm(args):
    service = MusicReviewService(args.db)
    success = service.confirm_record(args.id, args.operator, args.note)

    if success:
        print(f"记录 {args.id} 已确认")
    else:
        print(f"确认失败：记录不存在或已撤回")


def cmd_update(args):
    service = MusicReviewService(args.db)
    success = service.update_song_info(
        record_id=args.id,
        song_title=args.song,
        voice_part=args.voice,
        operator=args.operator,
        reason=args.reason
    )

    if success:
        print(f"记录 {args.id} 已更新")
    else:
        print(f"更新失败")


def cmd_export(args):
    service = MusicReviewService(args.db)

    status_map = {'pending': '待处理', 'confirmed': '已确认', 'all': None}
    status_filter = status_map[args.status]

    count = service.export_records(
        file_path=args.output,
        status=status_filter,
        include_withdrawn=args.include_withdrawn
    )

    print(f"已导出 {count} 条记录到 {args.output}")


def cmd_summary(args):
    service = MusicReviewService(args.db)
    summary = service.export_summary(args.output)

    print("排练小结统计:")
    for k, v in summary.items():
        if isinstance(v, dict):
            print(f"\n{k}:")
            for sub_k, sub_v in v.items():
                print(f"  {sub_k}: {sub_v}")
        else:
            print(f"{k}: {v}")

    print(f"\n详细统计已导出到 {args.output}")


def cmd_duplicates(args):
    service = MusicReviewService(args.db)
    duplicates = service.get_duplicate_summary()

    if not duplicates:
        print("没有发现重复记录")
        return

    print(f"发现 {len(duplicates)} 组重复记录:\n")
    for i, d in enumerate(duplicates, 1):
        print(f"{i}. {d['student_name']} - {d['song_title']}")
        print(f"   重复 {d['count']} 次，来源: {', '.join(d['sources'])}")
        print(f"   记录ID: {', '.join(d['record_ids'])}")
        print()


def cmd_add(args):
    service = MusicReviewService(args.db)
    record_id = service.add_manual_record(
        student_name=args.student,
        song_title=args.song,
        voice_part=args.voice,
        operator=args.operator,
        source_note=args.note
    )

    print(f"已添加记录，ID: {record_id}")

    record = service.db.get_record(record_id)
    if record and record.status == RecordStatus.PENDING:
        print(f"状态: 待处理")
        print(f"原因: {record.pending_reason}")


def cmd_pending(args):
    service = MusicReviewService(args.db)
    records = service.get_pending_records()

    if not records:
        print("没有待处理记录")
        return

    print(f"待处理记录 ({len(records)} 条):\n")
    for r in records:
        print(f"ID: {r.id}")
        print(f"  {r.student_name} - {r.song_title} ({r.voice_part})")
        print(f"  来源: {r.source.value}")
        print(f"  原因: {r.pending_reason}")
        print()


def main():
    parser = argparse.ArgumentParser(description='音乐课作业讲评系统')
    parser.add_argument('--db', default='music_review.db', help='数据库文件路径')

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    import_parser = subparsers.add_parser('import', help='导入记录')
    import_parser.add_argument('file', help='CSV文件路径')
    import_parser.add_argument('--source', required=True, choices=['voice', 'metronome', 'manual'], help='数据来源')
    import_parser.add_argument('--operator', required=True, help='操作人')
    import_parser.add_argument('--note', default='', help='来源备注')

    list_parser = subparsers.add_parser('list', help='列出记录')
    list_parser.add_argument('--status', default='all', choices=['all', 'pending', 'confirmed', 'withdrawn'], help='状态筛选')
    list_parser.add_argument('--source', default='all', choices=['all', 'voice', 'metronome', 'manual'], help='来源筛选')
    list_parser.add_argument('--student', help='学生姓名模糊搜索')

    detail_parser = subparsers.add_parser('detail', help='查看记录详情')
    detail_parser.add_argument('id', type=int, help='记录ID')

    withdraw_parser = subparsers.add_parser('withdraw', help='撤回记录')
    withdraw_parser.add_argument('id', type=int, help='记录ID')
    withdraw_parser.add_argument('--operator', required=True, help='操作人')
    withdraw_parser.add_argument('--reason', required=True, help='撤回原因')

    confirm_parser = subparsers.add_parser('confirm', help='确认记录')
    confirm_parser.add_argument('id', type=int, help='记录ID')
    confirm_parser.add_argument('--operator', required=True, help='操作人')
    confirm_parser.add_argument('--note', default='', help='备注')

    update_parser = subparsers.add_parser('update', help='修改选曲信息')
    update_parser.add_argument('id', type=int, help='记录ID')
    update_parser.add_argument('--song', help='新曲目名')
    update_parser.add_argument('--voice', help='新声部')
    update_parser.add_argument('--operator', required=True, help='操作人')
    update_parser.add_argument('--reason', default='', help='修改原因')

    export_parser = subparsers.add_parser('export', help='导出记录')
    export_parser.add_argument('output', help='输出文件路径')
    export_parser.add_argument('--status', default='all', choices=['all', 'pending', 'confirmed'], help='状态筛选')
    export_parser.add_argument('--include-withdrawn', action='store_true', help='包含已撤回记录')

    summary_parser = subparsers.add_parser('summary', help='导出排练小结')
    summary_parser.add_argument('output', help='输出文件路径')

    subparsers.add_parser('duplicates', help='查看重复记录统计')
    subparsers.add_parser('pending', help='查看所有待处理记录')

    add_parser = subparsers.add_parser('add', help='手动添加记录')
    add_parser.add_argument('--student', required=True, help='学生姓名')
    add_parser.add_argument('--song', required=True, help='曲目')
    add_parser.add_argument('--voice', required=True, help='声部')
    add_parser.add_argument('--operator', required=True, help='操作人')
    add_parser.add_argument('--note', default='', help='备注')

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    cmd_funcs = {
        'import': cmd_import,
        'list': cmd_list,
        'detail': cmd_detail,
        'withdraw': cmd_withdraw,
        'confirm': cmd_confirm,
        'update': cmd_update,
        'export': cmd_export,
        'summary': cmd_summary,
        'duplicates': cmd_duplicates,
        'pending': cmd_pending,
        'add': cmd_add
    }

    cmd_funcs[args.command](args)


if __name__ == '__main__':
    main()
