#!/usr/bin/env python3
import argparse
import json
import sys
from datetime import datetime
from .core import SparePartsManager
from .report import ReportExporter
from .database import get_db


def print_section(title):
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)


def print_subsection(title):
    print("\n" + "-" * 80)
    print(f"  {title}")
    print("-" * 80)


def cmd_import(args):
    manager = SparePartsManager()
    
    if args.type == 'inventory':
        result = manager.import_inventory(args.file, args.operator)
    elif args.type == 'consumption':
        result = manager.import_consumption(args.file, args.operator)
    elif args.type == 'purchase':
        result = manager.import_purchase(args.file, args.operator)
    elif args.type == 'borrow':
        result = manager.import_borrow(args.file, args.operator)
    else:
        print(f"错误: 未知的导入类型 {args.type}")
        return 1
    
    print(f"导入结果:")
    print(f"  成功: {result['success']}")
    print(f"  失败: {result['failed']}")
    if 'skipped' in result:
        print(f"  跳过(重复): {result['skipped']}")
    
    if result['errors']:
        print(f"\n错误详情:")
        for error in result['errors']:
            print(f"  - {error}")
    
    return 0


def cmd_calculate(args):
    manager = SparePartsManager()
    
    print_section("库存计算结果")
    
    stock_data = manager.calculate_available_stock()
    
    print(f"\n{'备件编号':<15} {'名称':<20} {'当前库存':>10} {'安全库存':>10} {'在途':>8} {'借出':>8} {'可用':>10}")
    print("-" * 90)
    for item in stock_data:
        unit = item.get('unit', '')
        available = item['current_stock'] + item['in_transit']
        print(f"{item['part_number']:<15} {item['name']:<20} "
              f"{item['current_stock']:>10.2f}{unit:<2} "
              f"{item['safety_stock']:>10.2f}{unit:<2} "
              f"{item['in_transit']:>8.2f}{unit:<2} "
              f"{item['borrowed_out']:>8.2f}{unit:<2} "
              f"{available:>10.2f}{unit:<2}")
    
    suggestions = manager.calculate_restock_suggestions(args.operator)
    
    print_subsection("补货建议")
    if suggestions:
        print(f"\n{'ID':>4} {'备件编号':<15} {'名称':<20} {'当前库存':>10} {'建议补货':>10}")
        print("-" * 75)
        for sugg in suggestions:
            print(f"{len(suggestions):>4} {sugg['part_number']:<15} {sugg['name']:<20} "
                  f"{sugg['current_stock']:>10.2f} {sugg['suggested_quantity']:>10.2f}")
            print(f"     原因: {sugg['reason']}")
    else:
        print("  暂无补货建议")
    
    return 0


def cmd_alerts(args):
    manager = SparePartsManager()
    alerts = manager.get_alerts()
    
    print_section("预警列表")
    
    if alerts['low_stock']:
        print_subsection("低库存预警")
        print(f"\n{'备件编号':<15} {'名称':<20} {'当前库存':>12} {'安全库存':>12} {'缺口':>8}")
        print("-" * 75)
        for alert in alerts['low_stock']:
            print(f"{alert['part_number']:<15} {alert['name']:<20} "
                  f"{alert['current_stock']:>12.2f} {alert['safety_stock']:>12.2f} "
                  f"{alert['gap']:>8.2f}")
    
    if alerts['negative_stock']:
        print_subsection("负库存预警")
        print(f"\n{'备件编号':<15} {'名称':<20} {'当前库存':>12}")
        print("-" * 50)
        for alert in alerts['negative_stock']:
            print(f"{alert['part_number']:<15} {alert['name']:<20} {alert['current_stock']:>12.2f}")
    
    if alerts['unreturned_borrows']:
        print_subsection("逾期未归还借调")
        print(f"\n{'借调编号':<15} {'备件编号':<15} {'数量':>8} {'应还日期':>12}")
        print("-" * 55)
        for borrow in alerts['unreturned_borrows']:
            qty = borrow['borrowed_quantity'] - borrow['returned_quantity']
            print(f"{borrow['borrow_number']:<15} {borrow['part_number']:<15} "
                  f"{qty:>8.2f} {borrow['expected_return']:>12}")
    
    if alerts['open_exceptions']:
        print_subsection("未解决异常")
        print(f"\n{'ID':>4} {'类型':<20} {'备件':<15} {'状态':>10}")
        print("-" * 60)
        for exc in alerts['open_exceptions']:
            print(f"{exc['id']:>4} {exc['exception_type']:<20} "
                  f"{(exc['part_number'] or '-'):<15} {exc['status']:>10}")
            print(f"     {exc['message']}")
    
    if not any(alerts.values()):
        print("\n  暂无预警")
    
    return 0


def cmd_history(args):
    manager = SparePartsManager()
    history = manager.get_history(args.part, args.limit)
    
    print_section("历史变动记录")
    
    if history:
        print(f"\n{'时间':<20} {'备件编号':<15} {'变动类型':<15} {'数量':>10} "
              f"{'库存变化':>20}")
        print("-" * 85)
        for h in history:
            change = f"{h['previous_stock']} -> {h['new_stock']}"
            print(f"{h['timestamp'][:19]:<20} {h['part_number']:<15} "
                  f"{h['change_type']:<15} {h['quantity']:+10.2f} {change:>20}")
            if h['remarks']:
                print(f"  {' ' * 20} 备注: {h['remarks']}")
    else:
        print("\n  暂无历史记录")
    
    return 0


def cmd_approve(args):
    manager = SparePartsManager()
    
    if args.type == 'restock':
        success = manager.approve_restock(
            args.id, args.decision, args.reasons, args.operator
        )
    else:
        print(f"错误: 未知的审批类型 {args.type}")
        return 1
    
    if success:
        print(f"审批完成: ID={args.id}, 决策={args.decision}")
        if args.reasons:
            print(f"  意见: {args.reasons}")
    else:
        print(f"错误: 找不到审批记录 ID={args.id}")
        return 1
    
    return 0


def cmd_resolve(args):
    manager = SparePartsManager()
    
    success = manager.resolve_exception(args.id, args.operator)
    
    if success:
        print(f"异常已解决: ID={args.id}")
    else:
        print(f"错误: 找不到异常记录 ID={args.id}")
        return 1
    
    return 0


def cmd_report(args):
    manager = SparePartsManager()
    exporter = ReportExporter(manager)
    
    output_path = exporter.generate_report(args.format, args.output)
    
    print(f"报告已生成: {output_path}")
    
    if args.format == 'txt':
        print("\n" + "=" * 80)
        with open(output_path, 'r', encoding='utf-8') as f:
            print(f.read())
    
    return 0


def main():
    parser = argparse.ArgumentParser(
        description='维修备件安全库存 CLI 工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例命令:
  1. 导入备件台账
     spareparts import --type inventory data/inventory.csv

  2. 导入故障消耗记录
     spareparts import --type consumption data/consumption.csv

  3. 导入采购在途
     spareparts import --type purchase data/purchase.csv

  4. 导入跨仓借调
     spareparts import --type borrow data/borrow.csv

  5. 计算库存和补货建议
     spareparts calculate

  6. 查看预警
     spareparts alerts

  7. 查看历史变动
     spareparts history --part SENSOR-001

  8. 审批补货建议
     spareparts approve --type restock --id 1 --decision approved --reasons "库存紧张急需补货"

  9. 导出报告
     spareparts report --format txt --output report.txt
        '''
    )
    
    subparsers = parser.add_subparsers(dest='command', help='可用命令')
    
    import_parser = subparsers.add_parser('import', help='导入数据')
    import_parser.add_argument('--type', required=True,
                              choices=['inventory', 'consumption', 'purchase', 'borrow'],
                              help='导入类型')
    import_parser.add_argument('--file', required=True, help='数据文件路径 (CSV或JSON)')
    import_parser.add_argument('--operator', default='system', help='操作人')
    import_parser.set_defaults(func=cmd_import)
    
    calc_parser = subparsers.add_parser('calculate', help='计算库存和补货建议')
    calc_parser.add_argument('--operator', default='system', help='操作人')
    calc_parser.set_defaults(func=cmd_calculate)
    
    alerts_parser = subparsers.add_parser('alerts', help='查看预警列表')
    alerts_parser.set_defaults(func=cmd_alerts)
    
    history_parser = subparsers.add_parser('history', help='查看历史变动')
    history_parser.add_argument('--part', help='备件编号(可选)')
    history_parser.add_argument('--limit', type=int, default=100, help='显示条数')
    history_parser.set_defaults(func=cmd_history)
    
    approve_parser = subparsers.add_parser('approve', help='审批动作')
    approve_parser.add_argument('--type', required=True,
                               choices=['restock'],
                               help='审批类型')
    approve_parser.add_argument('--id', required=True, type=int, help='记录ID')
    approve_parser.add_argument('--decision', required=True,
                               choices=['approved', 'rejected'],
                               help='决策结果')
    approve_parser.add_argument('--reasons', help='审批意见')
    approve_parser.add_argument('--operator', default='system', help='操作人')
    approve_parser.set_defaults(func=cmd_approve)
    
    resolve_parser = subparsers.add_parser('resolve', help='标记异常为已解决')
    resolve_parser.add_argument('--id', required=True, type=int, help='异常ID')
    resolve_parser.add_argument('--operator', default='system', help='操作人')
    resolve_parser.set_defaults(func=cmd_resolve)
    
    report_parser = subparsers.add_parser('report', help='导出报告')
    report_parser.add_argument('--format', choices=['json', 'csv', 'txt'],
                              default='json', help='报告格式')
    report_parser.add_argument('--output', help='输出文件路径')
    report_parser.set_defaults(func=cmd_report)
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return 0
    
    return args.func(args)


if __name__ == '__main__':
    sys.exit(main())
