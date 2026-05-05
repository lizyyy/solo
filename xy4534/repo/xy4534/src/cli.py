#!/usr/bin/env python3
import argparse
import json
import os
import sys
from datetime import datetime

# 添加 src 目录到 Python 路径
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))

from backup_checker.models import Database
from backup_checker.checker import BackupChecker
from backup_checker.exporter import Exporter


def create_task(args):
    """创建新的备份演练任务"""
    db = Database(args.db)
    task_id = db.create_task(args.name)
    print(f"创建任务成功: ID = {task_id}, 名称 = '{args.name}'")
    return task_id


def list_tasks(args):
    """列出所有任务"""
    db = Database(args.db)
    tasks = db.get_all_tasks()
    
    if not tasks:
        print("暂无任务")
        return
    
    print(f"{'ID':<6} {'名称':<30} {'状态':<10} {'创建时间':<25}")
    print("-" * 75)
    for task in tasks:
        print(f"{task['id']:<6} {task['task_name']:<30} {task['status']:<10} {task['created_at']:<25}")


def import_data(args):
    """导入数据"""
    db = Database(args.db)
    checker = BackupChecker(db)
    
    task_id = args.task_id
    
    # 验证任务是否存在
    task = db.get_task(task_id)
    if not task:
        print(f"错误: 任务 ID {task_id} 不存在")
        return
    
    # 导入 pg_dump 日志
    if args.pg_dump_log:
        for file_path in args.pg_dump_log:
            if not os.path.exists(file_path):
                print(f"警告: 文件不存在 - {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            parsed = checker.parse_pg_dump_log(content)
            parsed['file_path'] = file_path
            
            log_id = db.add_pg_dump_log(task_id, parsed)
            print(f"导入 pg_dump 日志: {file_path} -> 日志 ID {log_id}")
    
    # 导入对象存储 manifest
    if args.manifest:
        for file_path in args.manifest:
            if not os.path.exists(file_path):
                print(f"警告: 文件不存在 - {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            parsed = checker.parse_object_storage_manifest(content)
            parsed['file_path'] = file_path
            
            shards = parsed.pop('shards', [])
            
            manifest_id = db.add_object_storage_manifest(task_id, parsed)
            print(f"导入对象存储 manifest: {file_path} -> Manifest ID {manifest_id}")
            
            # 导入分片
            for shard in shards:
                shard_id = db.add_object_storage_shard(manifest_id, shard)
                print(f"  - 导入分片: {shard.get('shard_name', 'unknown')} -> 分片 ID {shard_id}")
    
    # 导入还原演练结果
    if args.restore_result:
        for file_path in args.restore_result:
            if not os.path.exists(file_path):
                print(f"警告: 文件不存在 - {file_path}")
                continue
            
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
            
            parsed = checker.parse_restore_result(content)
            parsed['file_path'] = file_path
            
            spot_tables = parsed.pop('spot_checked_tables', [])
            
            result_id = db.add_restore_result(task_id, parsed)
            print(f"导入还原演练结果: {file_path} -> 结果 ID {result_id}")
            
            # 导入抽查的表
            for table in spot_tables:
                table_id = db.add_spot_checked_table(result_id, table)
                status = "匹配" if table.get('checksum_match') else "不匹配"
                print(f"  - 导入抽查表: {table.get('table_name', 'unknown')} -> 表 ID {table_id} ({status})")
    
    # 导入值班备注
    if args.duty_note:
        for note_text in args.duty_note:
            note_id = db.add_duty_note(task_id, note_text, args.created_by or 'cli')
            print(f"添加值班备注: ID {note_id}")


def run_check(args):
    """执行检查"""
    db = Database(args.db)
    checker = BackupChecker(db)
    
    task_id = args.task_id
    
    # 验证任务是否存在
    task = db.get_task(task_id)
    if not task:
        print(f"错误: 任务 ID {task_id} 不存在")
        return
    
    print(f"开始执行检查: 任务 ID {task_id} ({task['task_name']})")
    print("-" * 60)
    
    results = checker.run_all_checks(task_id)
    
    print("")
    print("检查结果:")
    print("-" * 60)
    
    passed = sum(1 for r in results if r['status'] == 'pass')
    failed = sum(1 for r in results if r['status'] == 'fail')
    warnings = sum(1 for r in results if r['status'] == 'warn')
    
    print(f"总计: {len(results)} 项检查")
    print(f"  - 通过: {passed} 项")
    print(f"  - 警告: {warnings} 项")
    print(f"  - 失败: {failed} 项")
    print("")
    
    # 显示详细结果
    for result in results:
        icon = '✓' if result['status'] == 'pass' else ('⚠' if result['status'] == 'warn' else '✗')
        risk = f"[{result['risk_level'].upper()}]"
        print(f"{icon} {risk:<8} {result['check_name']}")
        print(f"    {result['message']}")
        print("")
    
    # 更新任务摘要
    summary = f"通过: {passed}, 警告: {warnings}, 失败: {failed}"
    db.update_task(task_id, summary=summary)
    
    return results


def export_results(args):
    """导出结果"""
    db = Database(args.db)
    exporter = Exporter(db)
    
    task_id = args.task_id
    
    # 验证任务是否存在
    task = db.get_task(task_id)
    if not task:
        print(f"错误: 任务 ID {task_id} 不存在")
        return
    
    # 导出 Markdown
    if args.format == 'markdown' or args.format == 'all':
        md_content = exporter.export_to_markdown(task_id)
        output_file = args.output or f"backup_check_{task_id}.md"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(md_content)
        
        print(f"Markdown 报告已导出: {output_file}")
    
    # 导出 JSON
    if args.format == 'json' or args.format == 'all':
        json_content = exporter.export_to_json(task_id)
        output_file = args.output or f"backup_check_{task_id}.json"
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(json_content)
        
        print(f"JSON 审计包已导出: {output_file}")


def show_task(args):
    """显示任务详情"""
    db = Database(args.db)
    
    task_id = args.task_id
    task_data = db.get_full_task_data(task_id)
    
    if not task_data:
        print(f"错误: 任务 ID {task_id} 不存在")
        return
    
    task = task_data['task']
    
    print("=" * 60)
    print(f"任务详情: {task['task_name']} (ID: {task['id']})")
    print("=" * 60)
    print(f"状态: {task['status']}")
    print(f"创建时间: {task['created_at']}")
    print(f"摘要: {task['summary'] or '暂无'}")
    print("")
    
    # 显示 pg_dump 日志
    pg_logs = task_data.get('pg_dump_logs', [])
    if pg_logs:
        print(f"pg_dump 日志 ({len(pg_logs)} 个):")
        for log in pg_logs:
            print(f"  - ID: {log['id']}, 数据库: {log.get('database_name', 'unknown')}")
            print(f"    表数量: {log.get('table_count', 0)}, 大小: {log.get('total_size_bytes', 0)} 字节")
        print("")
    
    # 显示 manifest
    manifests = task_data.get('object_storage_manifests', [])
    if manifests:
        print(f"对象存储 Manifest ({len(manifests)} 个):")
        for manifest in manifests:
            shards = manifest.get('shards', [])
            print(f"  - ID: {manifest['id']}, Bucket: {manifest.get('bucket_name', 'unknown')}")
            print(f"    分片数: {manifest.get('total_shards', 0)}, 实际分片: {len(shards)}")
            print(f"    总大小: {manifest.get('total_size_bytes', 0)} 字节")
        print("")
    
    # 显示还原结果
    restore_results = task_data.get('restore_results', [])
    if restore_results:
        print(f"还原演练结果 ({len(restore_results)} 个):")
        for result in restore_results:
            spot_tables = result.get('spot_checked_tables', [])
            print(f"  - ID: {result['id']}, 数据库: {result.get('restored_database_name', 'unknown')}")
            print(f"    版本: {result.get('restored_version', 'unknown')}")
            print(f"    表数: {result.get('table_count_restored', 0)}, 行数: {result.get('row_count_restored', 0)}")
            if spot_tables:
                print(f"    抽查表: {len(spot_tables)} 个")
        print("")
    
    # 显示检查结果
    check_results = task_data.get('check_results', [])
    if check_results:
        print(f"检查结果 ({len(check_results)} 项):")
        for result in check_results:
            icon = '✓' if result['status'] == 'pass' else ('⚠' if result['status'] == 'warn' else '✗')
            reviewed = "已复核" if result['reviewed'] else "待复核"
            print(f"  {icon} [{result['risk_level'].upper()}] {result['check_name']} ({reviewed})")
            print(f"      {result['message']}")
        print("")
    
    # 显示值班备注
    duty_notes = task_data.get('duty_notes', [])
    if duty_notes:
        print(f"值班备注 ({len(duty_notes)} 条):")
        for note in duty_notes:
            print(f"  - {note['created_at']} (by {note['created_by']}):")
            print(f"    {note['note_text']}")
        print("")


def main():
    parser = argparse.ArgumentParser(
        description='备份演练核对工具 - 用于验证 PostgreSQL 备份和还原演练'
    )
    
    # 通用参数
    parser.add_argument('--db', default='backup_check.db', help='SQLite 数据库文件路径 (默认: backup_check.db)')
    
    # 子命令
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    # 创建任务
    create_parser = subparsers.add_parser('create', help='创建新的备份演练任务')
    create_parser.add_argument('name', help='任务名称')
    create_parser.set_defaults(func=create_task)
    
    # 列出任务
    list_parser = subparsers.add_parser('list', help='列出所有任务')
    list_parser.set_defaults(func=list_tasks)
    
    # 显示任务详情
    show_parser = subparsers.add_parser('show', help='显示任务详情')
    show_parser.add_argument('task_id', type=int, help='任务 ID')
    show_parser.set_defaults(func=show_task)
    
    # 导入数据
    import_parser = subparsers.add_parser('import', help='导入数据')
    import_parser.add_argument('task_id', type=int, help='任务 ID')
    import_parser.add_argument('--pg-dump-log', action='append', help='pg_dump 日志文件路径 (可多个)')
    import_parser.add_argument('--manifest', action='append', help='对象存储 manifest JSON 文件路径 (可多个)')
    import_parser.add_argument('--restore-result', action='append', help='还原演练结果 JSON 文件路径 (可多个)')
    import_parser.add_argument('--duty-note', action='append', help='值班备注文本 (可多个)')
    import_parser.add_argument('--created-by', default='cli', help='备注创建者标识')
    import_parser.set_defaults(func=import_data)
    
    # 执行检查
    check_parser = subparsers.add_parser('check', help='执行备份验证检查')
    check_parser.add_argument('task_id', type=int, help='任务 ID')
    check_parser.set_defaults(func=run_check)
    
    # 导出结果
    export_parser = subparsers.add_parser('export', help='导出检查结果')
    export_parser.add_argument('task_id', type=int, help='任务 ID')
    export_parser.add_argument('--format', choices=['markdown', 'json', 'all'], default='all', help='导出格式 (默认: all)')
    export_parser.add_argument('--output', '-o', help='输出文件路径')
    export_parser.set_defaults(func=export_results)
    
    # 解析参数
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    # 执行命令
    args.func(args)


if __name__ == '__main__':
    main()
