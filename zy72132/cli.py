#!/usr/bin/env python3
import sys
import argparse
from pathlib import Path

from rhythm_book import RhythmErrorBook
from exporter import ReportExporter


def cmd_list(args):
    book = RhythmErrorBook()
    exporter = ReportExporter(book)
    exporter.print_console_report()


def cmd_pending(args):
    book = RhythmErrorBook()
    exporter = ReportExporter(book)
    print(exporter.generate_pending_actions_report())


def cmd_export(args):
    book = RhythmErrorBook()
    exporter = ReportExporter(book)

    output = args.output or "节奏错题本清单"

    txt_path = f"{output}.txt"
    csv_path = f"{output}.csv"

    exporter.export_to_txt(txt_path)
    exporter.export_to_csv(csv_path)

    print(f"已导出 TXT: {txt_path}")
    print(f"已导出 CSV: {csv_path}")


def cmd_import_dir(args):
    book = RhythmErrorBook()
    dir_path = Path(args.directory)

    if not dir_path.exists() or not dir_path.is_dir():
        print(f"错误: 目录不存在 {args.directory}")
        sys.exit(1)

    print(f"正在导入目录: {dir_path}")
    result = book.import_audio_directory(str(dir_path), args.batch)

    print(f"导入完成: {result.success_count} 条成功")
    if result.failed_count > 0:
        print(f"异常文件: {result.failed_count} 条 (已记录待确认)")
        for f in result.failed_files:
            print(f"  - {f['file_name']}: {f['reason']}")


def cmd_import_csv(args):
    book = RhythmErrorBook()
    csv_path = Path(args.csv)

    if not csv_path.exists():
        print(f"错误: 文件不存在 {args.csv}")
        sys.exit(1)

    print(f"正在导入 CSV: {csv_path}")
    result = book.import_from_excel_csv(str(csv_path), args.source)

    print(f"导入完成: {result.success_count} 条成功")
    if result.failed_count > 0:
        print(f"失败: {result.failed_count} 条")


def cmd_add(args):
    book = RhythmErrorBook()
    record = book.add_manual_record(
        file_name=args.file_name,
        track_name=args.track_name,
        source_type=args.source_type or "手动录入",
        source_detail=args.source_detail or "",
        status=args.status or "正常",
        notes=args.notes or "",
        exception_reason=args.exception or "",
        contract_deadline=args.deadline or "",
        changed_by=args.user or "system"
    )
    print(f"已添加记录 #{record.id}: {record.track_name}")


def cmd_note(args):
    book = RhythmErrorBook()
    record = book.get_record(args.id)
    if not record:
        print(f"错误: 找不到记录 #{args.id}")
        sys.exit(1)

    result = book.add_notes(
        args.id,
        args.notes,
        args.user or "system",
        append=not args.replace
    )

    if result.success:
        print(f"已更新记录 #{args.id}")
        print(book.format_changes_summary(result.changes))
    else:
        print("更新失败")


def cmd_resolve(args):
    book = RhythmErrorBook()
    record = book.get_record(args.id)
    if not record:
        print(f"错误: 找不到记录 #{args.id}")
        sys.exit(1)

    result = book.resolve_issue(
        args.id,
        args.notes or "",
        args.user or "system"
    )

    if result.success:
        print(f"已标记解决 #{args.id}")
        print(book.format_changes_summary(result.changes))
    else:
        print("更新失败")


def cmd_history(args):
    book = RhythmErrorBook()
    history = book.get_record_history(args.id)

    if not history:
        print(f"记录 #{args.id} 暂无变更历史")
        return

    print(f"记录 #{args.id} 变更历史:")
    print("-" * 60)
    for h in history:
        print(f"时间: {h['changed_at']}")
        print(f"操作人: {h['changed_by']}")
        print(f"原因: {h['change_reason']}")
        field_name = book._get_field_display_name(h['field_name'])
        old = h['old_value'] or '(空)'
        new = h['new_value'] or '(空)'
        print(f"变更: {field_name}: {old} → {new}")
        print("-" * 60)


def cmd_demo(args):
    import subprocess
    script_path = Path(__file__).parent / "demo.py"
    subprocess.run([sys.executable, str(script_path)])


def main():
    parser = argparse.ArgumentParser(
        description="音乐课节奏错题本 - Music Rhythm Error Book",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python cli.py demo                运行演示，生成示例数据
  python cli.py list                查看所有记录清单
  python cli.py pending             查看待处理记录
  python cli.py import-dir ./audio  批量导入音频目录
  python cli.py import-csv tracks.csv  从曲目CSV导入
  python cli.py note 1 "已确认"      给记录#1加备注
  python cli.py resolve 1 "没问题"   标记记录#1已解决
  python cli.py history 1           查看记录#1变更历史
  python cli.py export              导出报告到文件
        """
    )

    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    subparsers.add_parser('demo', help='运行演示')
    subparsers.add_parser('list', help='列出所有记录')
    subparsers.add_parser('pending', help='列出待处理记录')

    export_p = subparsers.add_parser('export', help='导出报告')
    export_p.add_argument('-o', '--output', help='输出文件名(不含扩展名)')

    import_dir_p = subparsers.add_parser('import-dir', help='批量导入音频目录')
    import_dir_p.add_argument('directory', help='音频目录路径')
    import_dir_p.add_argument('--batch', help='批次名称')

    import_csv_p = subparsers.add_parser('import-csv', help='从曲目CSV导入')
    import_csv_p.add_argument('csv', help='CSV文件路径')
    import_csv_p.add_argument('--source', help='来源说明')

    add_p = subparsers.add_parser('add', help='手动添加记录')
    add_p.add_argument('--file-name', required=True, help='文件名')
    add_p.add_argument('--track-name', required=True, help='曲目名称')
    add_p.add_argument('--source-type', help='来源类型')
    add_p.add_argument('--source-detail', help='来源详情')
    add_p.add_argument('--status', help='状态')
    add_p.add_argument('--notes', help='备注')
    add_p.add_argument('--exception', help='异常原因')
    add_p.add_argument('--deadline', help='授权截止日期')
    add_p.add_argument('--user', help='操作人')

    note_p = subparsers.add_parser('note', help='添加备注')
    note_p.add_argument('id', type=int, help='记录ID')
    note_p.add_argument('notes', help='备注内容')
    note_p.add_argument('--user', help='操作人')
    note_p.add_argument('--replace', action='store_true', help='替换而非追加备注')

    resolve_p = subparsers.add_parser('resolve', help='标记已解决')
    resolve_p.add_argument('id', type=int, help='记录ID')
    resolve_p.add_argument('notes', nargs='?', help='处理说明')
    resolve_p.add_argument('--user', help='操作人')

    history_p = subparsers.add_parser('history', help='查看变更历史')
    history_p.add_argument('id', type=int, help='记录ID')

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return

    commands = {
        'demo': cmd_demo,
        'list': cmd_list,
        'pending': cmd_pending,
        'export': cmd_export,
        'import-dir': cmd_import_dir,
        'import-csv': cmd_import_csv,
        'add': cmd_add,
        'note': cmd_note,
        'resolve': cmd_resolve,
        'history': cmd_history,
    }

    if args.command in commands:
        commands[args.command](args)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
