#!/usr/bin/env python3
"""
印刷拼版估算 CLI 工具
用于小型印刷厂在接单前估算拼版和纸张损耗
"""

import argparse
import sys
from datetime import date, datetime
from pathlib import Path
from typing import List, Optional

from imposition_cli import (
    load_orders, load_configuration,
    Validator, ImpositionPlanner, Exporter,
    format_imposition_count, ProductionPlan
)


def get_default_paths(base_dir: Optional[Path] = None) -> dict:
    if base_dir is None:
        base_dir = Path.cwd()
    
    return {
        'orders': base_dir / 'sample' / 'orders.csv',
        'presses': base_dir / 'presses.yaml',
        'paper_stock': base_dir / 'paper_stock.csv',
        'cut_rules': base_dir / 'cut_rules.yaml',
    }


def cmd_validate(args):
    """验证订单数据"""
    paths = get_default_paths(Path(args.config_dir) if args.config_dir else None)
    
    if args.orders:
        orders_path = Path(args.orders)
    else:
        orders_path = paths['orders']
    
    if not orders_path.exists():
        print(f"错误: 订单文件不存在: {orders_path}")
        sys.exit(1)
    
    config = load_configuration(
        presses_path=paths['presses'],
        paper_stock_path=paths['paper_stock'],
        cut_rules_path=paths['cut_rules']
    )
    
    try:
        orders = load_orders(orders_path)
    except Exception as e:
        print(f"错误: 读取订单文件失败: {e}")
        sys.exit(1)
    
    validator = Validator(config)
    
    print("=" * 60)
    print("订单数据验证结果")
    print("=" * 60)
    print()
    
    config_result = validator.validate_configuration()
    if config_result.errors:
        print("⚠️  配置错误:")
        for err in config_result.errors:
            print(f"  - [{err.field}] {err.message}")
        print()
    
    if config_result.warnings:
        print("⚠️  配置警告:")
        for w in config_result.warnings:
            print(f"  - [{w.field}] {w.message}")
        print()
    
    total_errors = 0
    total_warnings = 0
    
    today = date.today()
    if args.today:
        try:
            today = datetime.strptime(args.today, '%Y-%m-%d').date()
        except ValueError:
            print(f"警告: 无法解析日期 '{args.today}'，将使用当前日期")
    
    for order in orders:
        result = validator.validate_order(order, today)
        
        status = "✅ 通过" if result.valid else "❌ 失败"
        print(f"订单 {order.order_id} - {order.product_name}: {status}")
        
        if result.errors:
            total_errors += len(result.errors)
            print("  错误:")
            for err in result.errors:
                print(f"    - [{err.field}] {err.message}")
        
        if result.warnings:
            total_warnings += len(result.warnings)
            print("  警告:")
            for w in result.warnings:
                print(f"    - [{w.field}] {w.message}")
        
        if result.errors or result.warnings:
            print()
    
    print("-" * 60)
    print(f"验证完成: {len(orders)} 个订单")
    print(f"  错误: {total_errors} 个")
    print(f"  警告: {total_warnings} 个")
    
    if total_errors > 0:
        sys.exit(1)
    
    sys.exit(0)


def print_plan_summary(plans: List[ProductionPlan]):
    """打印计划摘要"""
    total_sheets = sum(p.total_sheets for p in plans)
    total_wastage = sum(p.wastage_sheets for p in plans)
    total_items = sum(p.order.quantity for p in plans)
    
    print("=" * 80)
    print("拼版计划摘要")
    print("=" * 80)
    print()
    print(f"订单总数: {len(plans)} 个")
    print(f"总印数: {total_items:,} 份")
    print(f"总用纸量: {total_sheets:,} 张")
    print(f"总损耗量: {total_wastage:,} 张")
    print()


def print_plan_details(plan: ProductionPlan):
    """打印单个计划详情"""
    order = plan.order
    imposition = plan.imposition
    layout = imposition.layout
    
    print("-" * 80)
    print(f"订单: {order.order_id} - {order.product_name}")
    print("-" * 80)
    
    print("\n【基本信息】")
    print(f"  成品尺寸: {order.finished_size.width.to_str()} × {order.finished_size.height.to_str()}")
    print(f"  出血: {order.bleed.to_str()}")
    print(f"  有效尺寸: {order.effective_size.width.to_str()} × {order.effective_size.height.to_str()}")
    print(f"  印数: {order.quantity:,} 份")
    print(f"  纸张: {order.paper_type}")
    print(f"  交期: {order.due_date}")
    
    print("\n【拼版方案】")
    print(f"  拼版方式: {format_imposition_count(layout.total_count)} ({layout.layout_string})")
    print(f"  是否旋转: {'是' if layout.rotated else '否'}")
    print(f"  每版拼数: {layout.total_count} 份")
    
    if imposition.press:
        print(f"  推荐机台: {imposition.press.name}")
    
    if imposition.paper_stock:
        print(f"  用纸规格: {imposition.paper_stock.size.width.to_str()} × {imposition.paper_stock.size.height.to_str()}")
        print(f"  库存数量: {imposition.paper_stock.stock_quantity:,} 张")
    
    print(f"  版面利用率: {(1 - plan.imposition.waste_rate) * 100:.1f}%")
    print(f"  余料率: {plan.imposition.waste_percentage:.1f}%")
    
    print("\n【用纸估算】")
    print(f"  所需印版: {plan.sheets_required:,} 版")
    print(f"  印刷损耗: {plan.wastage_sheets:,} 张")
    print(f"  总用纸量: {plan.total_sheets:,} 张")
    print(f"  损耗占比: {plan.total_waste_percentage:.1f}%")
    
    risks = []
    if plan.cross_day_risk:
        risks.append("交期紧张")
    if plan.oversized_risk:
        risks.append("超规印刷")
    if plan.stock_risk:
        risks.append("库存不足")
    
    if risks:
        print("\n【⚠️ 风险提示】")
        for risk in risks:
            print(f"  ⚠️  {risk}")
    
    print()


def cmd_plan(args):
    """生成拼版计划"""
    paths = get_default_paths(Path(args.config_dir) if args.config_dir else None)
    
    if args.orders:
        orders_path = Path(args.orders)
    else:
        orders_path = paths['orders']
    
    if not orders_path.exists():
        print(f"错误: 订单文件不存在: {orders_path}")
        sys.exit(1)
    
    config = load_configuration(
        presses_path=paths['presses'],
        paper_stock_path=paths['paper_stock'],
        cut_rules_path=paths['cut_rules']
    )
    
    try:
        orders = load_orders(orders_path)
    except Exception as e:
        print(f"错误: 读取订单文件失败: {e}")
        sys.exit(1)
    
    today = date.today()
    if args.today:
        try:
            today = datetime.strptime(args.today, '%Y-%m-%d').date()
        except ValueError:
            print(f"警告: 无法解析日期 '{args.today}'，将使用当前日期")
    
    planner = ImpositionPlanner(config)
    plans = planner.plan_all_orders(orders, today)
    
    if not plans:
        print("错误: 无法为任何订单生成拼版计划")
        sys.exit(1)
    
    if len(plans) != len(orders):
        print(f"警告: 仅为 {len(plans)}/{len(orders)} 个订单生成了计划")
        print()
    
    if args.summary:
        print_plan_summary(plans)
    else:
        print_plan_summary(plans)
        for plan in plans:
            print_plan_details(plan)
    
    return plans


def cmd_export(args):
    """导出拼版计划"""
    paths = get_default_paths(Path(args.config_dir) if args.config_dir else None)
    
    if args.orders:
        orders_path = Path(args.orders)
    else:
        orders_path = paths['orders']
    
    if not orders_path.exists():
        print(f"错误: 订单文件不存在: {orders_path}")
        sys.exit(1)
    
    config = load_configuration(
        presses_path=paths['presses'],
        paper_stock_path=paths['paper_stock'],
        cut_rules_path=paths['cut_rules']
    )
    
    try:
        orders = load_orders(orders_path)
    except Exception as e:
        print(f"错误: 读取订单文件失败: {e}")
        sys.exit(1)
    
    today = date.today()
    if args.today:
        try:
            today = datetime.strptime(args.today, '%Y-%m-%d').date()
        except ValueError:
            print(f"警告: 无法解析日期 '{args.today}'，将使用当前日期")
    
    planner = ImpositionPlanner(config)
    plans = planner.plan_all_orders(orders, today)
    
    if not plans:
        print("错误: 无法为任何订单生成拼版计划，无法导出")
        sys.exit(1)
    
    output_dir = Path(args.output) if args.output else Path.cwd()
    
    exporter = Exporter(plans)
    result = exporter.export_all(output_dir)
    
    print("=" * 60)
    print("导出完成")
    print("=" * 60)
    print()
    print(f"拼版计划文档: {result['imposition_plan_md']}")
    print(f"损耗明细表格: {result['waste_items_csv']}")
    print()
    print(f"共导出 {len(plans)} 个订单的拼版计划")


def main():
    parser = argparse.ArgumentParser(
        description='印刷拼版估算 CLI 工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
示例:
  # 验证订单数据
  python imposition_cli.py validate
  
  # 生成拼版计划
  python imposition_cli.py plan
  
  # 只显示摘要
  python imposition_cli.py plan --summary
  
  # 导出拼版计划
  python imposition_cli.py export --output ./output
  
  # 使用自定义订单文件
  python imposition_cli.py validate --orders ./my_orders.csv
  
  # 指定当前日期（用于测试交期）
  python imposition_cli.py plan --today 2026-05-05
        '''
    )
    
    parser.add_argument(
        '--config-dir', '-c',
        help='配置文件所在目录（默认当前目录）'
    )
    
    subparsers = parser.add_subparsers(title='可用命令', dest='command')
    
    validate_parser = subparsers.add_parser('validate', help='验证订单数据')
    validate_parser.add_argument('--orders', '-o', help='订单CSV文件路径')
    validate_parser.add_argument('--today', help='指定当前日期 (YYYY-MM-DD)，用于交期验证')
    validate_parser.set_defaults(func=cmd_validate)
    
    plan_parser = subparsers.add_parser('plan', help='生成拼版计划')
    plan_parser.add_argument('--orders', '-o', help='订单CSV文件路径')
    plan_parser.add_argument('--summary', '-s', action='store_true', help='只显示摘要')
    plan_parser.add_argument('--today', help='指定当前日期 (YYYY-MM-DD)')
    plan_parser.set_defaults(func=cmd_plan)
    
    export_parser = subparsers.add_parser('export', help='导出拼版计划')
    export_parser.add_argument('--orders', '-o', help='订单CSV文件路径')
    export_parser.add_argument('--output', '-O', help='输出目录（默认当前目录）')
    export_parser.add_argument('--today', help='指定当前日期 (YYYY-MM-DD)')
    export_parser.set_defaults(func=cmd_export)
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(1)
    
    args.func(args)


if __name__ == '__main__':
    main()
