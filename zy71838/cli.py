import argparse
import json
import sys
from typing import Optional

from mine_repair_manager import MineRepairManager
from models import RecordSource, RecordStatus


def cmd_create(args):
    manager = MineRepairManager()
    
    try:
        material_data = json.loads(args.material_data)
    except json.JSONDecodeError:
        print("错误: material_data 必须是有效的JSON格式")
        sys.exit(1)
    
    source = RecordSource(args.source) if args.source else RecordSource.BALANCE_TABLE
    
    record, is_new = manager.create_record(
        material_data=material_data,
        source=source,
        created_by=args.created_by,
        pending_reason=args.pending_reason or ""
    )
    
    manager.save()
    
    if is_new:
        print(f"创建成功: 记录ID = {record.record_id}")
    else:
        print(f"材料已存在成功记录: 记录ID = {record.record_id} (复用已有记录)")
    print(f"状态: {record.status.value}")
    print(f"来源: {record.source.value}")


def cmd_list(args):
    manager = MineRepairManager()
    
    if args.status:
        records = manager.get_records_by_status(RecordStatus(args.status))
    elif args.source:
        records = manager.get_records_by_source(RecordSource(args.source))
    elif args.operator:
        records = manager.get_records_by_operator(args.operator)
    else:
        records = list(manager.records.values())
    
    if not records:
        print("没有找到记录")
        return
    
    print(f"找到 {len(records)} 条记录:")
    print("-" * 80)
    for r in records:
        disc_info = f" [不一致 -> {r.discrepancy.next_owner}]" if r.discrepancy else ""
        pending_info = f" (待处理: {r.pending_reason[:20]}...)" if r.pending_reason else ""
        print(f"{r.record_id} | {r.status.value:12} | {r.source.value:15} | {r.created_by:10} | {r.created_at.strftime('%m-%d %H:%M')}{disc_info}{pending_info}")


def cmd_show(args):
    manager = MineRepairManager()
    history = manager.get_full_history(args.record_id)
    
    if not history:
        print(f"记录 {args.record_id} 不存在")
        sys.exit(1)
    
    print("=" * 80)
    print(f"记录详情: {args.record_id}")
    print("=" * 80)
    print(f"材料ID: {history['material_id']}")
    print(f"来源: {history['source']}")
    print(f"状态: {history['status']}")
    print(f"创建人: {history['created_by']}")
    print(f"创建时间: {history['created_at']}")
    if history['pending_reason']:
        print(f"待处理原因: {history['pending_reason']}")
    
    print("\n变更历史:")
    for i, c in enumerate(history['change_history'], 1):
        print(f"  {i}. {c['timestamp']} - {c['operator']}")
        print(f"     修改 {c['field']}: {c['old_value']} -> {c['new_value']}")
        print(f"     原因: {c['reason']}")
    
    if history['unit_table_changes']:
        print("\n单位表变更:")
        for unit_id, changes in history['unit_table_changes'].items():
            print(f"  单位 {unit_id}:")
            for c in changes:
                print(f"    - {c['timestamp']} {c['operator']} 修改 {c['field']}: "
                      f"{c['old_value']} -> {c['new_value']} ({c['reason']})")
    
    if history['discrepancy']:
        d = history['discrepancy']
        print("\n不一致信息:")
        print(f"  来源类型: {d['source_type']}")
        print(f"  战报数值: {d['battle_report_value']}")
        print(f"  结算数值: {d['settlement_value']}")
        print(f"  下一步处理人: {d['next_owner']}")
        print(f"  描述: {d['description']}")


def cmd_update_status(args):
    manager = MineRepairManager()
    
    success = manager.update_status(
        record_id=args.record_id,
        new_status=RecordStatus(args.status),
        operator=args.operator,
        reason=args.reason
    )
    
    if not success:
        print(f"记录 {args.record_id} 不存在")
        sys.exit(1)
    
    manager.save()
    print(f"状态已更新为: {args.status}")


def cmd_record_unit_change(args):
    manager = MineRepairManager()
    
    success = manager.record_unit_table_change(
        record_id=args.record_id,
        unit_id=args.unit_id,
        field_name=args.field,
        old_value=args.old_value,
        new_value=args.new_value,
        operator=args.operator,
        reason=args.reason
    )
    
    if not success:
        print(f"记录 {args.record_id} 不存在")
        sys.exit(1)
    
    manager.save()
    print(f"单位变更已记录: {args.unit_id} {args.field}: {args.old_value} -> {args.new_value}")


def cmd_discrepancy(args):
    manager = MineRepairManager()
    
    success = manager.handle_discrepancy(
        record_id=args.record_id,
        source_type=RecordSource(args.source_type),
        battle_report_value=args.battle_value,
        settlement_value=args.settlement_value,
        next_owner=args.next_owner,
        description=args.description,
        operator=args.operator
    )
    
    if not success:
        print(f"记录 {args.record_id} 不存在")
        sys.exit(1)
    
    manager.save()
    print(f"不一致已记录，下一步找: {args.next_owner}")


def main():
    parser = argparse.ArgumentParser(description="矿洞轨道抢修 - 平衡性变更追踪系统")
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    create_parser = subparsers.add_parser("create", help="创建新记录")
    create_parser.add_argument("--material-data", required=True, help='材料数据(JSON格式), 例如: \'{"unit": "miner", "attack": 100}\'')
    create_parser.add_argument("--source", choices=[s.value for s in RecordSource], default="balance_table", help="材料来源")
    create_parser.add_argument("--created-by", required=True, help="创建人")
    create_parser.add_argument("--pending-reason", help="待处理原因")
    
    list_parser = subparsers.add_parser("list", help="列出记录")
    list_parser.add_argument("--status", choices=[s.value for s in RecordStatus], help="按状态筛选")
    list_parser.add_argument("--source", choices=[s.value for s in RecordSource], help="按来源筛选")
    list_parser.add_argument("--operator", help="按操作人筛选")
    
    show_parser = subparsers.add_parser("show", help="显示记录详情")
    show_parser.add_argument("record_id", help="记录ID")
    
    status_parser = subparsers.add_parser("update-status", help="更新记录状态")
    status_parser.add_argument("record_id", help="记录ID")
    status_parser.add_argument("--status", required=True, choices=[s.value for s in RecordStatus], help="新状态")
    status_parser.add_argument("--operator", required=True, help="操作人")
    status_parser.add_argument("--reason", required=True, help="变更原因")
    
    unit_parser = subparsers.add_parser("unit-change", help="记录单位表变更")
    unit_parser.add_argument("record_id", help="记录ID")
    unit_parser.add_argument("--unit-id", required=True, help="单位ID")
    unit_parser.add_argument("--field", required=True, help="字段名")
    unit_parser.add_argument("--old-value", required=True, help="旧值")
    unit_parser.add_argument("--new-value", required=True, help="新值")
    unit_parser.add_argument("--operator", required=True, help="操作人")
    unit_parser.add_argument("--reason", required=True, help="变更原因")
    
    disc_parser = subparsers.add_parser("discrepancy", help="记录战报结算不一致")
    disc_parser.add_argument("record_id", help="记录ID")
    disc_parser.add_argument("--source-type", required=True, choices=[s.value for s in RecordSource], help="来源类型")
    disc_parser.add_argument("--battle-value", required=True, help="战报数值")
    disc_parser.add_argument("--settlement-value", required=True, help="结算数值")
    disc_parser.add_argument("--next-owner", required=True, help="下一步处理人")
    disc_parser.add_argument("--description", required=True, help="问题描述")
    disc_parser.add_argument("--operator", required=True, help="操作人")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    commands = {
        "create": cmd_create,
        "list": cmd_list,
        "show": cmd_show,
        "update-status": cmd_update_status,
        "unit-change": cmd_record_unit_change,
        "discrepancy": cmd_discrepancy
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
