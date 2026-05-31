#!/usr/bin/env python3
import argparse
import sys
import os
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from api_usage_alerts.database import init_db
from api_usage_alerts.importer import import_file
from api_usage_alerts.revisor import (
    list_sessions, get_session_info, rollback_session,
    add_manual_confirmation, get_audit_logs, get_record_history
)
from api_usage_alerts.exporter import (
    export_table, export_alert_report, get_data_summary, detect_anomalies
)

def print_separator():
    print("=" * 60)

def print_title(title: str):
    print_separator()
    print(f"  {title}")
    print_separator()

def cmd_init(args):
    init_db()
    print("数据库初始化完成")

def cmd_import(args):
    print_title(f"导入数据: {args.file}")
    result = import_file(args.file, args.type, args.operator)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    
    if result['duplicate'] > 0:
        print(f"\n⚠️  检测到 {result['duplicate']} 条重复记录，已自动跳过")
    if result['error'] > 0:
        print(f"\n❌ {result['error']} 条记录导入失败，请查看审计日志")

def cmd_sessions(args):
    print_title("导入会话列表")
    sessions = list_sessions(args.limit, args.type)
    
    print(f"{'ID':<5} {'类型':<12} {'文件名':<25} {'状态':<12} {'记录数':<8}")
    print("-" * 60)
    for s in sessions:
        print(f"{s['id']:<5} {s['session_type']:<12} {s['filename'][:24]:<25} "
              f"{s['status']:<12} {s['total_records'] or 0:<8}")

def cmd_session_info(args):
    info = get_session_info(args.session_id)
    if not info:
        print(f"会话 {args.session_id} 不存在")
        return
    
    print_title(f"会话详情: {args.session_id}")
    for key, value in info.items():
        print(f"  {key}: {value}")

def cmd_rollback(args):
    print_title(f"撤回会话: {args.session_id}")
    result = rollback_session(args.session_id, args.operator, args.reason)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_confirm(args):
    print_title("人工确认")
    result = add_manual_confirmation(
        args.session_id,
        args.ref_type,
        args.ref_id,
        args.conf_type,
        args.operator,
        args.result,
        args.comments
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_audit(args):
    print_title("审计日志")
    logs = get_audit_logs(args.session_id, args.entity_type, args.limit)
    
    print(f"{'时间':<20} {'操作':<15} {'实体类型':<20} {'原因'}")
    print("-" * 80)
    for log in logs:
        print(f"{log['operation_time'][:19]:<20} {log['action_type']:<15} "
              f"{log['entity_type']:<20} {log['reason'] or '-'}")

def cmd_history(args):
    print_title(f"记录历史: {args.type} #{args.id}")
    history = get_record_history(args.type, args.id)
    
    if history.get('error'):
        print(history['error'])
        return
    
    if history['current']:
        print("\n【当前状态】")
        print(json.dumps(history['current'], ensure_ascii=False, indent=2))
    
    if history['audit_logs']:
        print("\n【审计日志】")
        for log in history['audit_logs']:
            print(f"  {log['operation_time']} - {log['action_type']} - {log['operator']}")
    
    if history['confirmations']:
        print("\n【人工确认】")
        for conf in history['confirmations']:
            print(f"  {conf['confirmed_time']} - {conf['confirmation_type']} - "
                  f"{conf['confirmation_result']} - {conf['confirmed_by']}")

def cmd_export(args):
    print_title(f"导出数据: {args.type}")
    
    filters = {}
    if args.filter:
        for f in args.filter:
            key, value = f.split('=', 1)
            filters[key] = value
    
    if args.type == 'alert_report':
        result = export_alert_report(filters, args.output)
    else:
        result = export_table(args.type, filters, args.output)
    
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_summary(args):
    print_title("数据概览")
    summary = get_data_summary()
    for key, value in summary.items():
        if isinstance(value, dict):
            print(f"\n{key}:")
            for k, v in value.items():
                print(f"  {k}: {v}")
        else:
            print(f"{key}: {value}")

def cmd_anomalies(args):
    print_title("异常检测")
    anomalies = detect_anomalies()
    
    if not anomalies:
        print("未检测到异常")
        return
    
    for anomaly_type, items in anomalies.items():
        print(f"\n【{anomaly_type}】({len(items)} 条)")
        for item in items[:5]:
            if anomaly_type == 'pending_alerts':
                print(f"  - {item['alert_id']}: {item['api_name']} "
                      f"({item['alert_level']}) - {item['alert_time']}")
            elif anomaly_type == 'alerts_without_permission':
                print(f"  - {item['alert_id']}: app={item['app_key']}, "
                      f"api={item['api_name']}")
            else:
                print(f"  - {json.dumps(item, ensure_ascii=False)[:60]}...")

def main():
    parser = argparse.ArgumentParser(description="API用量预警管理工具")
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    init_parser = subparsers.add_parser('init', help='初始化数据库')
    init_parser.set_defaults(func=cmd_init)
    
    import_parser = subparsers.add_parser('import', help='导入CSV数据')
    import_parser.add_argument('file', help='CSV文件路径')
    import_parser.add_argument('--type', required=True, 
                              choices=['permission', 'migration', 'alert'],
                              help='导入类型')
    import_parser.add_argument('--operator', default='system', help='操作人')
    import_parser.set_defaults(func=cmd_import)
    
    sessions_parser = subparsers.add_parser('sessions', help='列出导入会话')
    sessions_parser.add_argument('--limit', type=int, default=20, help='显示数量')
    sessions_parser.add_argument('--type', help='筛选类型')
    sessions_parser.set_defaults(func=cmd_sessions)
    
    session_info_parser = subparsers.add_parser('session', help='查看会话详情')
    session_info_parser.add_argument('session_id', type=int, help='会话ID')
    session_info_parser.set_defaults(func=cmd_session_info)
    
    rollback_parser = subparsers.add_parser('rollback', help='撤回整个导入会话')
    rollback_parser.add_argument('session_id', type=int, help='会话ID')
    rollback_parser.add_argument('--operator', required=True, help='操作人')
    rollback_parser.add_argument('--reason', help='撤回原因')
    rollback_parser.set_defaults(func=cmd_rollback)
    
    confirm_parser = subparsers.add_parser('confirm', help='添加人工确认')
    confirm_parser.add_argument('--session-id', type=int, required=True, help='会话ID')
    confirm_parser.add_argument('--ref-type', required=True, help='关联类型')
    confirm_parser.add_argument('--ref-id', type=int, required=True, help='关联ID')
    confirm_parser.add_argument('--conf-type', required=True, help='确认类型')
    confirm_parser.add_argument('--operator', required=True, help='操作人')
    confirm_parser.add_argument('--result', required=True, help='确认结果')
    confirm_parser.add_argument('--comments', help='备注')
    confirm_parser.set_defaults(func=cmd_confirm)
    
    audit_parser = subparsers.add_parser('audit', help='查看审计日志')
    audit_parser.add_argument('--session-id', type=int, help='会话ID')
    audit_parser.add_argument('--entity-type', help='实体类型')
    audit_parser.add_argument('--limit', type=int, default=100, help='显示数量')
    audit_parser.set_defaults(func=cmd_audit)
    
    history_parser = subparsers.add_parser('history', help='查看单条记录历史')
    history_parser.add_argument('type', choices=['permission', 'migration', 'alert'])
    history_parser.add_argument('id', type=int, help='记录ID')
    history_parser.set_defaults(func=cmd_history)
    
    export_parser = subparsers.add_parser('export', help='导出数据')
    export_parser.add_argument('--type', required=True,
                               choices=['permission', 'migration', 'alert', 'alert_report'],
                               help='导出类型')
    export_parser.add_argument('--output', required=True, help='输出文件路径')
    export_parser.add_argument('--filter', action='append', 
                               help='筛选条件，格式: key=value')
    export_parser.set_defaults(func=cmd_export)
    
    summary_parser = subparsers.add_parser('summary', help='数据概览')
    summary_parser.set_defaults(func=cmd_summary)
    
    anomalies_parser = subparsers.add_parser('anomalies', help='异常检测')
    anomalies_parser.set_defaults(func=cmd_anomalies)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        return
    
    args.func(args)

if __name__ == '__main__':
    main()
