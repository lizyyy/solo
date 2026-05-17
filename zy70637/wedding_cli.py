#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import os
import sys
from pathlib import Path

from parser import DataParser
from rules import RuleEngine
from tracker import SourceTracker, DataDiffer, CrossReferenceValidator
from reporter import ReportGenerator


def print_banner():
    banner = """
╔══════════════════════════════════════════════════════════════╗
║           婚礼物料归还丢损赔付结案排查 CLI v1.0                ║
║           Wedding Material Settlement System                  ║
╚══════════════════════════════════════════════════════════════╝
    """
    print(banner)


def print_section(title: str):
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def check_file_exists(file_path: str, file_type: str) -> bool:
    if not file_path:
        return False
    path = Path(file_path)
    if not path.exists():
        print(f"⚠️  {file_type}文件不存在: {file_path}")
        return False
    return True


def main():
    parser = argparse.ArgumentParser(
        description='婚礼物料归还丢损赔付结案排查工具',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python wedding_cli.py --orders data/orders.csv --materials data/materials.csv 
                       --outbounds data/outbounds.csv --returns data/returns.csv 
                       --compensations data/compensations.csv
        """
    )

    parser.add_argument('--orders', required=True, help='订单数据文件路径 (CSV/Excel)')
    parser.add_argument('--materials', required=True, help='物料数据文件路径 (CSV/Excel)')
    parser.add_argument('--outbounds', required=True, help='出库记录文件路径 (CSV/Excel)')
    parser.add_argument('--returns', required=True, help='归还记录文件路径 (CSV/Excel)')
    parser.add_argument('--compensations', required=True, help='赔付记录文件路径 (CSV/Excel)')
    parser.add_argument('--output-dir', default='reports', help='报告输出目录')
    parser.add_argument('--no-report', action='store_true', help='不生成报告文件，仅在控制台输出')

    args = parser.parse_args()

    print_banner()

    for file_path, file_type in [
        (args.orders, '订单'),
        (args.materials, '物料'),
        (args.outbounds, '出库记录'),
        (args.returns, '归还记录'),
        (args.compensations, '赔付记录')
    ]:
        if not check_file_exists(file_path, file_type):
            sys.exit(1)

    print_section("1. 数据解析")
    data_parser = DataParser()

    orders, orders_bad = data_parser.parse_orders(args.orders)
    materials, materials_bad = data_parser.parse_materials(args.materials)
    outbounds, outbounds_bad = data_parser.parse_outbound_records(args.outbounds)
    returns, returns_bad = data_parser.parse_return_records(args.returns)
    compensations, comps_bad = data_parser.parse_compensation_records(args.compensations)

    all_bad = orders_bad + materials_bad + outbounds_bad + returns_bad + comps_bad

    print(f"  ✓ 订单解析完成: {len(orders)} 条记录")
    print(f"  ✓ 物料解析完成: {len(materials)} 条记录")
    print(f"  ✓ 出库记录解析完成: {len(outbounds)} 条记录")
    print(f"  ✓ 归还记录解析完成: {len(returns)} 条记录")
    print(f"  ✓ 赔付记录解析完成: {len(compensations)} 条记录")
    if all_bad:
        print(f"  ⚠️  发现 {len(all_bad)} 条异常记录")

    print_section("2. 来源追踪")
    source_tracker = SourceTracker()
    for order in orders:
        source_tracker.track_order(order)
    for material in materials:
        source_tracker.track_material(material)
    for outbound in outbounds:
        source_tracker.track_outbound(outbound)
    for ret in returns:
        source_tracker.track_return(ret)
    for comp in compensations:
        source_tracker.track_compensation(comp)
    print("  ✓ 来源追踪完成")

    print_section("3. 数据一致性校验")
    cross_validator = CrossReferenceValidator()
    cross_validator.validate_references(orders, materials, outbounds, returns, compensations)
    if cross_validator.get_warnings():
        print(f"  ⚠️  跨表引用警告: {len(cross_validator.get_warnings())} 条")
        for w in cross_validator.get_warnings():
            print(f"     - {w}")
    data_differ = DataDiffer()
    checksum = data_differ.calculate_dataset_checksum(orders, materials, outbounds, returns, compensations)
    print(f"  ✓ 数据集校验和: {checksum}")

    print_section("4. 业务规则处理")
    rule_engine = RuleEngine()
    rule_engine.process_outbounds(outbounds)
    print("  ✓ 出库记录处理完成")

    valid_returns = rule_engine.process_returns(returns)
    print(f"  ✓ 归还记录处理完成: {len(valid_returns)}/{len(returns)} 条有效")

    materials_dict = {m.material_id: m for m in materials}
    valid_compensations = rule_engine.process_compensations(compensations, materials_dict)
    print(f"  ✓ 赔付记录处理完成")

    rule_engine.finalize()
    print("  ✓ 最终结算完成")

    loss_summary = rule_engine.get_loss_summary()
    print(f"\n  库存汇总:")
    print(f"    - 出库总数: {loss_summary.get('total_outbound', 0)}")
    print(f"    - 已归还: {loss_summary.get('total_returned', 0)}")
    print(f"    - 丢失: {loss_summary.get('total_lost', 0)}")
    print(f"    - 损坏: {loss_summary.get('total_damaged', 0)}")

    pending = rule_engine.get_pending_returns()
    if pending:
        print(f"\n  ⚠️  待归还物料 ({len(pending)} 项):")
        for p in pending[:5]:
            print(f"    - 订单{p.order_id}-物料{p.material_id}: {p.pending_quantity} 件")
        if len(pending) > 5:
            print(f"    ... 还有 {len(pending) - 5} 项")

    if rule_engine.warnings:
        print(f"\n  ⚠️  警告 ({len(rule_engine.warnings)} 条):")
        for w in rule_engine.warnings[:5]:
            print(f"    - {w}")
        if len(rule_engine.warnings) > 5:
            print(f"    ... 还有 {len(rule_engine.warnings) - 5} 条")

    if rule_engine.errors:
        print(f"\n  ❌ 错误 ({len(rule_engine.errors)} 条):")
        for e in rule_engine.errors[:5]:
            print(f"    - {e}")
        if len(rule_engine.errors) > 5:
            print(f"    ... 还有 {len(rule_engine.errors) - 5} 条")

    if not args.no_report:
        print_section("5. 生成报告")
        reporter = ReportGenerator(output_dir=args.output_dir)
        reports = reporter.generate_all_reports(
            bad_records=all_bad,
            inventories=rule_engine.inventory_manager.get_all_inventories(),
            pending_returns=pending,
            compensations=valid_compensations,
            valid_returns=valid_returns,
            orders=orders,
            materials=materials,
            rule_engine=rule_engine
        )

        print(f"  ✓ 报告已生成到目录: {args.output_dir}")
        for name, path in reports.items():
            print(f"    - {name}: {os.path.basename(path)}")

    print_section("处理完成")
    print("  ✓ 所有处理步骤已完成!")
    if rule_engine.errors:
        print(f"  ⚠️  存在 {len(rule_engine.errors)} 个错误需要处理")
    if rule_engine.warnings:
        print(f"  ⚠️  存在 {len(rule_engine.warnings)} 个警告需要关注")


if __name__ == '__main__':
    main()
