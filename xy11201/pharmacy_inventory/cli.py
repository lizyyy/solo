import argparse
import json
import sys
from datetime import datetime

from .service import InventoryService
from .report import ReportGenerator
from .models import RecordStatus, ProductType, AbnormalType


def print_operation_result(result):
    print(f"成功: {result.success}")
    print(f"消息: {result.message}")
    if result.record:
        print(f"批次号: {result.record.batch_no}")
        print(f"产品类型: {result.record.product_type}")
        print(f"状态: {result.record.status}")
    print()


def print_batch_result(result):
    print(f"总计: {result.total_count}")
    print(f"成功: {result.success_count}")
    print(f"失败: {result.failed_count}")
    print()

    for idx, success, message, record in result.results:
        status = "✓" if success else "✗"
        batch_info = f" - 批次: {record.batch_no}" if record else ""
        print(f"{status} 第{idx+1}项: {message}{batch_info}")
    print()


def cmd_receive(args):
    service = InventoryService()
    result = service.receive_product(
        batch_no=args.batch_no,
        product_type=args.product_type,
        product_name=args.product_name,
        quantity=args.quantity,
        temperature=args.temperature,
        receiver=args.receiver,
        is_damaged=args.is_damaged,
        damage_description=args.damage_description or ""
    )
    print_operation_result(result)
    return 0 if result.success else 1


def cmd_isolate(args):
    service = InventoryService()
    result = service.isolate_product(
        batch_no=args.batch_no,
        product_type=args.product_type,
        handler=args.handler,
        notes=args.notes or ""
    )
    print_operation_result(result)
    return 0 if result.success else 1


def cmd_review(args):
    service = InventoryService()
    result = service.review_product(
        batch_no=args.batch_no,
        product_type=args.product_type,
        handler=args.handler,
        notes=args.notes or ""
    )
    print_operation_result(result)
    return 0 if result.success else 1


def cmd_release(args):
    service = InventoryService()
    result = service.release_product(
        batch_no=args.batch_no,
        product_type=args.product_type,
        handler=args.handler,
        notes=args.notes or ""
    )
    print_operation_result(result)
    return 0 if result.success else 1


def cmd_return(args):
    service = InventoryService()
    result = service.return_product(
        batch_no=args.batch_no,
        product_type=args.product_type,
        handler=args.handler,
        notes=args.notes or ""
    )
    print_operation_result(result)
    return 0 if result.success else 1


def cmd_batch_receive(args):
    with open(args.file, 'r', encoding='utf-8') as f:
        items = json.load(f)

    service = InventoryService()
    result = service.batch_receive(items)
    print_batch_result(result)
    return 0 if result.failed_count == 0 else 1


def cmd_batch_operation(args):
    with open(args.file, 'r', encoding='utf-8') as f:
        items = json.load(f)

    service = InventoryService()
    result = service.batch_operation(
        operation=args.operation,
        items=items,
        handler=args.handler
    )
    print_batch_result(result)
    return 0 if result.failed_count == 0 else 1


def cmd_query(args):
    report_gen = ReportGenerator()

    start_time = None
    end_time = None
    if args.start_time:
        start_time = datetime.fromisoformat(args.start_time)
    if args.end_time:
        end_time = datetime.fromisoformat(args.end_time)

    records = report_gen.query_records(
        receiver=args.receiver,
        status=args.status,
        start_time=start_time,
        end_time=end_time,
        abnormal_type=args.abnormal_type,
        product_type=args.product_type
    )

    if args.format == 'json':
        print(report_gen.export_to_json(records))
    elif args.format == 'csv':
        content = report_gen.export_to_csv(records)
        if content:
            print(content)
    else:
        summary = report_gen.generate_summary(records)
        print("=== 汇总信息 ===")
        print(f"总记录数: {summary['total_count']}")
        print(f"总数量: {summary['total_quantity']}")
        print(f"按状态分布: {summary['by_status']}")
        print(f"按产品类型分布: {summary['by_product_type']}")
        print(f"按异常类型分布: {summary['by_abnormal_type']}")
        print(f"按签收人分布: {summary['by_receiver']}")
        print()

        print("=== 记录列表 ===")
        for i, record in enumerate(records, 1):
            print(f"{i}. 批次: {record.batch_no}, 产品: {record.product_type}, "
                  f"状态: {record.status}, 签收人: {record.receiver}")
    return 0


def cmd_export(args):
    report_gen = ReportGenerator()

    start_time = None
    end_time = None
    if args.start_time:
        start_time = datetime.fromisoformat(args.start_time)
    if args.end_time:
        end_time = datetime.fromisoformat(args.end_time)

    records = report_gen.query_records(
        receiver=args.receiver,
        status=args.status,
        start_time=start_time,
        end_time=end_time,
        abnormal_type=args.abnormal_type,
        product_type=args.product_type
    )

    if args.format == 'json':
        filepath = report_gen.export_to_json(records, args.output)
        print(f"已导出到: {filepath}")
    elif args.format == 'csv':
        filepath = report_gen.export_to_csv(records, args.output)
        print(f"已导出到: {filepath}")
    return 0


def cmd_list_statuses(args):
    print("可用状态:")
    for status in RecordStatus:
        print(f"  - {status.value}")
    return 0


def cmd_list_product_types(args):
    print("可用产品类型:")
    for pt in ProductType:
        print(f"  - {pt.value}")
    return 0


def cmd_list_abnormal_types(args):
    print("可用异常类型:")
    for at in AbnormalType:
        print(f"  - {at.value}")
    return 0


def main():
    parser = argparse.ArgumentParser(
        description='药房库存管理系统 - 疫苗和胰岛素台账管理工具'
    )
    subparsers = parser.add_subparsers(dest='command', help='可用命令')

    receive_parser = subparsers.add_parser('receive', help='签收产品')
    receive_parser.add_argument('--batch-no', required=True, help='批次号')
    receive_parser.add_argument('--product-type', required=True, choices=['vaccine', 'insulin'], help='产品类型')
    receive_parser.add_argument('--product-name', required=True, help='产品名称')
    receive_parser.add_argument('--quantity', type=int, required=True, help='数量')
    receive_parser.add_argument('--temperature', type=float, required=True, help='温度(℃)')
    receive_parser.add_argument('--receiver', required=True, help='签收人')
    receive_parser.add_argument('--is-damaged', action='store_true', help='是否破损')
    receive_parser.add_argument('--damage-description', help='破损描述')
    receive_parser.set_defaults(func=cmd_receive)

    isolate_parser = subparsers.add_parser('isolate', help='隔离产品')
    isolate_parser.add_argument('--batch-no', required=True, help='批次号')
    isolate_parser.add_argument('--product-type', required=True, help='产品类型')
    isolate_parser.add_argument('--handler', required=True, help='处理人')
    isolate_parser.add_argument('--notes', help='备注')
    isolate_parser.set_defaults(func=cmd_isolate)

    review_parser = subparsers.add_parser('review', help='复核产品')
    review_parser.add_argument('--batch-no', required=True, help='批次号')
    review_parser.add_argument('--product-type', required=True, help='产品类型')
    review_parser.add_argument('--handler', required=True, help='处理人')
    review_parser.add_argument('--notes', help='备注')
    review_parser.set_defaults(func=cmd_review)

    release_parser = subparsers.add_parser('release', help='放行产品')
    release_parser.add_argument('--batch-no', required=True, help='批次号')
    release_parser.add_argument('--product-type', required=True, help='产品类型')
    release_parser.add_argument('--handler', required=True, help='处理人')
    release_parser.add_argument('--notes', help='备注')
    release_parser.set_defaults(func=cmd_release)

    return_parser = subparsers.add_parser('return', help='退回产品')
    return_parser.add_argument('--batch-no', required=True, help='批次号')
    return_parser.add_argument('--product-type', required=True, help='产品类型')
    return_parser.add_argument('--handler', required=True, help='处理人')
    return_parser.add_argument('--notes', help='备注')
    return_parser.set_defaults(func=cmd_return)

    batch_receive_parser = subparsers.add_parser('batch-receive', help='批量签收')
    batch_receive_parser.add_argument('--file', required=True, help='JSON文件路径')
    batch_receive_parser.set_defaults(func=cmd_batch_receive)

    batch_op_parser = subparsers.add_parser('batch-operation', help='批量操作')
    batch_op_parser.add_argument('--operation', required=True, choices=['isolate', 'review', 'release', 'return'], help='操作类型')
    batch_op_parser.add_argument('--file', required=True, help='JSON文件路径')
    batch_op_parser.add_argument('--handler', required=True, help='处理人')
    batch_op_parser.set_defaults(func=cmd_batch_operation)

    query_parser = subparsers.add_parser('query', help='查询记录')
    query_parser.add_argument('--receiver', help='按签收人筛选')
    query_parser.add_argument('--status', help='按状态筛选')
    query_parser.add_argument('--start-time', help='开始时间 (ISO格式)')
    query_parser.add_argument('--end-time', help='结束时间 (ISO格式)')
    query_parser.add_argument('--abnormal-type', help='按异常类型筛选')
    query_parser.add_argument('--product-type', help='按产品类型筛选')
    query_parser.add_argument('--format', choices=['table', 'json', 'csv'], default='table', help='输出格式')
    query_parser.set_defaults(func=cmd_query)

    export_parser = subparsers.add_parser('export', help='导出报告')
    export_parser.add_argument('--receiver', help='按签收人筛选')
    export_parser.add_argument('--status', help='按状态筛选')
    export_parser.add_argument('--start-time', help='开始时间 (ISO格式)')
    export_parser.add_argument('--end-time', help='结束时间 (ISO格式)')
    export_parser.add_argument('--abnormal-type', help='按异常类型筛选')
    export_parser.add_argument('--product-type', help='按产品类型筛选')
    export_parser.add_argument('--format', choices=['json', 'csv'], default='csv', help='导出格式')
    export_parser.add_argument('--output', required=True, help='输出文件路径')
    export_parser.set_defaults(func=cmd_export)

    list_parser = subparsers.add_parser('list-statuses', help='列出所有状态')
    list_parser.set_defaults(func=cmd_list_statuses)

    list_product_parser = subparsers.add_parser('list-product-types', help='列出所有产品类型')
    list_product_parser.set_defaults(func=cmd_list_product_types)

    list_abnormal_parser = subparsers.add_parser('list-abnormal-types', help='列出所有异常类型')
    list_abnormal_parser.set_defaults(func=cmd_list_abnormal_types)

    args = parser.parse_args()

    if args.command is None:
        parser.print_help()
        return 1

    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
