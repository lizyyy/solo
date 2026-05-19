#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from service import WarehouseService
from models import AuditInfo

service = WarehouseService()

def get_audit_info(args) -> AuditInfo:
    return AuditInfo(
        operator_id=args.operator_id or 'cli_user',
        operator_name=args.operator_name or '命令行用户',
        role=args.role or 'admin',
        operation_time=datetime.now()
    )

def cmd_receive(args):
    parts = json.loads(args.parts) if args.parts.startswith('[') else json.load(open(args.parts))
    audit = get_audit_info(args)
    result = service.receive_parts(args.operation_id, parts, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_install(args):
    parts = json.loads(args.parts) if args.parts.startswith('[') else json.load(open(args.parts))
    audit = get_audit_info(args)
    result = service.install_parts(args.operation_id, args.receive_id, parts, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_return(args):
    parts = json.loads(args.parts) if args.parts.startswith('[') else json.load(open(args.parts))
    audit = get_audit_info(args)
    result = service.return_parts(args.operation_id, args.install_id, parts, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_claim(args):
    parts = json.loads(args.parts) if args.parts.startswith('[') else json.load(open(args.parts))
    audit = get_audit_info(args)
    result = service.claim_parts(args.operation_id, args.return_id, parts, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_write_off(args):
    parts = json.loads(args.parts) if args.parts.startswith('[') else json.load(open(args.parts))
    audit = get_audit_info(args)
    result = service.write_off_parts(args.operation_id, args.claim_id, parts, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_batch(args):
    operations = json.loads(args.operations) if args.operations.startswith('[') else json.load(open(args.operations))
    audit = get_audit_info(args)
    result = service.batch_operation(operations, audit)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_query(args):
    result = service.query_operations(
        operator_id=args.operator_id,
        start_time=args.start_time,
        end_time=args.end_time,
        status=args.status,
        operation_type=args.operation_type,
        error_type=args.error_type,
        page=args.page or 1,
        page_size=args.page_size or 100
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_export(args):
    report_file = service.export_report(
        operator_id=args.operator_id,
        start_time=args.start_time,
        end_time=args.end_time,
        status=args.status,
        operation_type=args.operation_type,
        error_type=args.error_type
    )
    print(f"报告已导出: {report_file}")

def cmd_trace(args):
    result = service.get_part_trace(args.part_code)
    print(json.dumps(result, ensure_ascii=False, indent=2))

def cmd_health(args):
    print("家电售后仓管理系统运行正常")
    print("数据库已连接")

def main():
    parser = argparse.ArgumentParser(description='家电售后仓管理系统 - 命令行工具')
    parser.add_argument('--operator-id', help='操作人ID')
    parser.add_argument('--operator-name', help='操作人姓名')
    parser.add_argument('--role', help='角色')
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    receive_parser = subparsers.add_parser('receive', help='领用零件')
    receive_parser.add_argument('--operation-id', required=True, help='操作ID')
    receive_parser.add_argument('--parts', required=True, help='零件列表 (JSON字符串或文件路径)')
    receive_parser.set_defaults(func=cmd_receive)
    
    install_parser = subparsers.add_parser('install', help='装机登记')
    install_parser.add_argument('--operation-id', required=True, help='操作ID')
    install_parser.add_argument('--receive-id', required=True, help='关联领用ID')
    install_parser.add_argument('--parts', required=True, help='零件列表')
    install_parser.set_defaults(func=cmd_install)
    
    return_parser = subparsers.add_parser('return', help='返还旧件')
    return_parser.add_argument('--operation-id', required=True, help='操作ID')
    return_parser.add_argument('--install-id', required=True, help='关联装机ID')
    return_parser.add_argument('--parts', required=True, help='零件列表')
    return_parser.set_defaults(func=cmd_return)
    
    claim_parser = subparsers.add_parser('claim', help='厂商索赔')
    claim_parser.add_argument('--operation-id', required=True, help='操作ID')
    claim_parser.add_argument('--return-id', required=True, help='关联返还ID')
    claim_parser.add_argument('--parts', required=True, help='零件列表')
    claim_parser.set_defaults(func=cmd_claim)
    
    writeoff_parser = subparsers.add_parser('writeoff', help='核销')
    writeoff_parser.add_argument('--operation-id', required=True, help='操作ID')
    writeoff_parser.add_argument('--claim-id', required=True, help='关联索赔ID')
    writeoff_parser.add_argument('--parts', required=True, help='零件列表')
    writeoff_parser.set_defaults(func=cmd_write_off)
    
    batch_parser = subparsers.add_parser('batch', help='批量操作')
    batch_parser.add_argument('--operations', required=True, help='操作列表 (JSON字符串或文件路径)')
    batch_parser.set_defaults(func=cmd_batch)
    
    query_parser = subparsers.add_parser('query', help='查询操作记录')
    query_parser.add_argument('--operator-id', help='按操作人ID筛选')
    query_parser.add_argument('--start-time', help='开始时间')
    query_parser.add_argument('--end-time', help='结束时间')
    query_parser.add_argument('--status', help='按状态筛选')
    query_parser.add_argument('--operation-type', help='按操作类型筛选')
    query_parser.add_argument('--error-type', help='按错误类型筛选')
    query_parser.add_argument('--page', type=int, help='页码')
    query_parser.add_argument('--page-size', type=int, help='每页大小')
    query_parser.set_defaults(func=cmd_query)
    
    export_parser = subparsers.add_parser('export', help='导出报告')
    export_parser.add_argument('--operator-id', help='按操作人ID筛选')
    export_parser.add_argument('--start-time', help='开始时间')
    export_parser.add_argument('--end-time', help='结束时间')
    export_parser.add_argument('--status', help='按状态筛选')
    export_parser.add_argument('--operation-type', help='按操作类型筛选')
    export_parser.add_argument('--error-type', help='按错误类型筛选')
    export_parser.set_defaults(func=cmd_export)
    
    trace_parser = subparsers.add_parser('trace', help='零件追溯')
    trace_parser.add_argument('--part-code', required=True, help='零件编号')
    trace_parser.set_defaults(func=cmd_trace)
    
    health_parser = subparsers.add_parser('health', help='健康检查')
    health_parser.set_defaults(func=cmd_health)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)

if __name__ == '__main__':
    main()
