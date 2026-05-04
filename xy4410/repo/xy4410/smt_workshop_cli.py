#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
SMT贴片回流生产管理工具 - 本地命令行工具
用于管理BOM、贴片坐标、炉温曲线、锡膏/钢网批次、AOI缺陷报告
"""

import argparse
import sys
from pathlib import Path

from commands.init import init_command
from commands.import_ import import_command
from commands.check import check_command
from commands.review import review_command, list_unconfirmed_command
from commands.export import export_command


def main():
    parser = argparse.ArgumentParser(
        prog='smt-workshop',
        description='SMT贴片回流生产管理工具 - 本地命令行工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  smt-workshop init                    # 初始化工作目录
  smt-workshop import bom.csv          # 导入BOM文件
  smt-workshop import pick_place.csv   # 导入贴片坐标
  smt-workshop check                    # 检查生产风险
  smt-workshop review list              # 列出未确认问题
  smt-workshop review confirm ISSUE_ID -r "人工复核通过"
  smt-workshop export --all             # 导出所有报告
        """
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    init_parser = subparsers.add_parser('init', help='初始化工作目录')
    init_parser.add_argument('--force', action='store_true', help='强制重新初始化（覆盖现有数据）')
    
    import_parser = subparsers.add_parser('import', help='导入数据文件')
    import_parser.add_argument('file_path', help='要导入的文件路径（CSV或JSON）')
    import_parser.add_argument('--type', '-t', 
                               choices=['bom', 'pick_place', 'oven_profile', 'paste_stencil', 'aoi', 'rework'],
                               help='指定文件类型（自动检测可能失败时使用）')
    import_parser.add_argument('--board', '-b', help='关联板号（用于BOM和贴片坐标）')
    import_parser.add_argument('--revision', '-r', help='关联版本号')
    
    check_parser = subparsers.add_parser('check', help='检查生产风险')
    check_parser.add_argument('--board', '-b', help='只检查指定板号')
    check_parser.add_argument('--all', '-a', action='store_true', help='显示所有检查项（包括已通过）')
    check_parser.add_argument('--no-save', action='store_true', help='不保存检查结果到问题库')
    
    review_parser = subparsers.add_parser('review', help='人工复核问题')
    review_subparsers = review_parser.add_subparsers(dest='review_action', help='复核操作')
    
    list_parser = review_subparsers.add_parser('list', help='列出未确认的问题')
    list_parser.add_argument('--all', '-a', action='store_true', help='列出所有问题（包括已确认）')
    
    confirm_parser = review_subparsers.add_parser('confirm', help='确认问题并添加备注')
    confirm_parser.add_argument('issue_id', help='问题ID')
    confirm_parser.add_argument('--remark', '-r', required=True, help='确认备注（说明如何解决或为何可接受）')
    confirm_parser.add_argument('--by', '-b', help='确认人员姓名')
    
    unconfirm_parser = review_subparsers.add_parser('unconfirm', help='取消确认（重新打开问题）')
    unconfirm_parser.add_argument('issue_id', help='问题ID')
    unconfirm_parser.add_argument('--remark', '-r', help='取消原因')
    
    export_parser = subparsers.add_parser('export', help='导出报告')
    export_parser.add_argument('--date', '-d', help='指定报告日期（YYYY-MM-DD），默认为今天')
    export_parser.add_argument('--markdown', '-m', action='store_true', help='导出Markdown放行报告')
    export_parser.add_argument('--json', '-j', action='store_true', help='导出审计JSON')
    export_parser.add_argument('--all', '-a', action='store_true', help='导出所有格式')
    export_parser.add_argument('--board', '-b', help='只导出指定板号的数据')
    export_parser.add_argument('--batch', help='只导出指定批次的数据')
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(0)
    
    work_dir = Path.cwd() / '.smt-workshop'
    
    try:
        if args.command == 'init':
            init_command(work_dir, args.force)
        elif args.command == 'import':
            import_command(
                work_dir, 
                Path(args.file_path), 
                args.type,
                args.board,
                args.revision
            )
        elif args.command == 'check':
            check_command(
                work_dir, 
                args.board,
                args.all,
                args.no_save
            )
        elif args.command == 'review':
            if args.review_action == 'list':
                list_unconfirmed_command(work_dir, args.all)
            elif args.review_action == 'confirm':
                review_command(
                    work_dir, 
                    args.issue_id, 
                    True, 
                    args.remark, 
                    args.by
                )
            elif args.review_action == 'unconfirm':
                review_command(
                    work_dir, 
                    args.issue_id, 
                    False, 
                    args.remark
                )
            else:
                review_parser.print_help()
        elif args.command == 'export':
            export_command(
                work_dir, 
                args.date,
                args.markdown,
                args.json,
                args.all,
                args.board,
                args.batch
            )
    except Exception as e:
        print(f'错误: {e}', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
