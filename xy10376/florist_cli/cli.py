import argparse
import json
import sys
from datetime import datetime

from .data_manager import DataManager
from .scheduler import Scheduler


class FloristCLI:
    def __init__(self, state_file: str = "florist_state.json"):
        self.data_manager = DataManager(state_file)
        self.scheduler = Scheduler(self.data_manager)
    
    def cmd_import(self, args):
        if args.inventory:
            with open(args.inventory, 'r', encoding='utf-8') as f:
                data = json.load(f)
            count = self.data_manager.import_inventory(data)
            print(f"✓ 已导入 {count} 种花材库存")
        
        if args.workstations:
            with open(args.workstations, 'r', encoding='utf-8') as f:
                data = json.load(f)
            count = self.data_manager.import_workstations(data)
            print(f"✓ 已导入 {count} 个包装工位")
        
        if args.slots:
            with open(args.slots, 'r', encoding='utf-8') as f:
                data = json.load(f)
            count = self.data_manager.import_delivery_slots(data)
            print(f"✓ 已导入 {count} 个配送时段")
        
        if args.rules:
            with open(args.rules, 'r', encoding='utf-8') as f:
                data = json.load(f)
            count = self.data_manager.import_replacement_rules(data)
            print(f"✓ 已导入 {count} 条替换规则")
        
        if args.orders:
            with open(args.orders, 'r', encoding='utf-8') as f:
                data = json.load(f)
            result = self.data_manager.import_orders(data, args.orders)
            
            print(f"\n=== 订单导入结果 ===")
            print(f"新导入: {len(result['imported'])}")
            
            if result['duplicates']:
                print(f"重复订单（已跳过）: {len(result['duplicates'])}")
                for oid in result['duplicates']:
                    print(f"  - {oid}")
            
            if result['conflicts']:
                print(f"\n⚠️  冲突检测（已导入但需人工确认）:")
                for conflict in result['conflicts']:
                    conflict_type = {
                        'same_phone_different_name': '同手机号不同姓名',
                        'same_name_different_phone': '同姓名不同手机号',
                        'same_batch_different_order': '同批次不同订单'
                    }.get(conflict['conflict_type'], conflict['conflict_type'])
                    print(f"  - 订单 {conflict['order_id']}: {conflict_type}（与 {conflict['conflict_with']} 冲突）")
        
        print("\n导入完成！")
    
    def cmd_preview(self, args):
        result = self.scheduler.generate_schedule()
        
        print("\n" + "="*80)
        print("📋 制作排程预览")
        print("="*80)
        
        for schedule in result['schedules']:
            order = self.data_manager.get_order(schedule.order_id)
            print(f"\n--- 订单 {schedule.order_id} ---")
            print(f"客户: {order.customer_name} ({order.phone})")
            print(f"类型: {'【加急】' if order.is_urgent else ''}{order.order_type}")
            print(f"工位: {schedule.workstation_name} (ID: {schedule.workstation_id})")
            print(f"配送: {schedule.delivery_slot}")
            print(f"状态: {'已排程' if schedule.status == 'scheduled' else '待处理'}")
            
            print(f"\n所需花材:")
            for flower, qty in schedule.flowers_required.items():
                reserved = schedule.flowers_reserved.get(flower, 0)
                replaced = schedule.flowers_replaced.get(flower)
                if replaced:
                    print(f"  ✗ {flower}: {qty}束 → 已替换为 {replaced}")
                elif reserved >= qty:
                    print(f"  ✓ {flower}: {qty}束")
                else:
                    print(f"  ⚠ {flower}: 需要{qty}束，仅预留{reserved}束")
        
        if result['waitlist_orders']:
            print("\n" + "="*80)
            print("🕒 候补订单（配送时段已满）")
            print("="*80)
            for wait in result['waitlist_orders']:
                print(f"\n订单 {wait['order_id']} - {wait['customer']}")
                print(f"原因: {wait['reason']}")
        
        if result['orders_needing_attention']:
            print("\n" + "="*80)
            print("📞 待人工联系订单")
            print("="*80)
            for attention in result['orders_needing_attention']:
                print(f"\n订单 {attention['order_id']} - {attention['customer']} ({attention['phone']})")
                for issue in attention['issues']:
                    print(f"  ⚠ {issue['message']}")
        
        if result['procurement_gaps']:
            print("\n" + "="*80)
            print("📦 采购缺口")
            print("="*80)
            for gap in result['procurement_gaps']:
                print(f"\n花材: {gap.flower_name}")
                print(f"需求: {gap.required}束, 库存: {gap.available}束, 缺口: {gap.gap}束")
                print(f"影响订单: {', '.join(gap.affected_orders)}")
        
        print("\n" + "="*80)
        print("📊 统计")
        print("="*80)
        print(f"已排程订单: {len(result['schedules'])}")
        print(f"候补订单: {len(result['waitlist_orders'])}")
        print(f"待人工联系: {len(result['orders_needing_attention'])}")
        print(f"采购缺口花材: {len(result['procurement_gaps'])}种")
    
    def cmd_replace(self, args):
        result = self.scheduler.process_replacement(
            args.order_id,
            args.original,
            args.new,
            args.quantity
        )
        
        if result['success']:
            print(f"✓ {result['message']}")
        else:
            print(f"✗ {result['message']}")
    
    def cmd_confirm(self, args):
        if args.order_id == 'all':
            orders = self.data_manager.get_all_orders()
            confirmed = 0
            failed = 0
            
            for order in orders:
                result = self.scheduler.confirm_production(order.order_id)
                if result['success']:
                    confirmed += 1
                    print(f"✓ 订单 {order.order_id}: 已确认")
                else:
                    failed += 1
                    print(f"✗ 订单 {order.order_id}: {result['message']}")
            
            print(f"\n统计: 确认 {confirmed} 个，失败 {failed} 个")
        else:
            result = self.scheduler.confirm_production(args.order_id)
            if result['success']:
                print(f"✓ {result['message']}")
                print(f"  工位: {result['workstation']}")
                print(f"  配送: {result['delivery_slot']}")
            else:
                print(f"✗ {result['message']}")
    
    def cmd_export(self, args):
        result = self.scheduler.generate_schedule()
        
        export_data = {
            "export_time": datetime.now().isoformat(),
            "schedules": [],
            "waitlist_orders": result['waitlist_orders'],
            "orders_needing_attention": result['orders_needing_attention'],
            "procurement_gaps": []
        }
        
        for s in result['schedules']:
            export_data["schedules"].append({
                "order_id": s.order_id,
                "workstation_id": s.workstation_id,
                "workstation_name": s.workstation_name,
                "flowers_required": s.flowers_required,
                "flowers_reserved": s.flowers_reserved,
                "flowers_replaced": s.flowers_replaced,
                "delivery_slot": s.delivery_slot,
                "status": s.status
            })
        
        for gap in result['procurement_gaps']:
            export_data["procurement_gaps"].append({
                "flower_name": gap.flower_name,
                "required": gap.required,
                "available": gap.available,
                "gap": gap.gap,
                "affected_orders": gap.affected_orders
            })
        
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)
        
        print(f"✓ 已导出到: {args.output}")
        print(f"  排程: {len(result['schedules'])} 个")
        print(f"  候补: {len(result['waitlist_orders'])} 个")
        print(f"  待处理: {len(result['orders_needing_attention'])} 个")
    
    def cmd_status(self, args):
        orders = self.data_manager.get_all_orders()
        inventory = self.data_manager.get_all_inventory()
        workstations = self.data_manager.get_all_workstations()
        slots = self.data_manager.get_all_delivery_slots()
        
        print("\n" + "="*80)
        print("📊 系统状态")
        print("="*80)
        
        print(f"\n订单统计:")
        print(f"  总数: {len(orders)}")
        status_count = {}
        for o in orders:
            status_count[o.status] = status_count.get(o.status, 0) + 1
        for status, count in status_count.items():
            print(f"    {status}: {count}")
        
        print(f"\n花材库存:")
        for f in inventory:
            print(f"  {f.name}: {f.quantity}{f.unit}")
        
        print(f"\n包装工位:")
        for ws in workstations:
            load = len(ws.current_orders)
            print(f"  {ws.name} (ID: {ws.workstation_id}): {load}/{ws.capacity} 个订单")
        
        print(f"\n配送时段:")
        for slot in sorted(slots, key=lambda s: s.time):
            load = len(slot.current_orders)
            print(f"  {slot.time.strftime('%Y-%m-%d %H:%M')}: {load}/{slot.capacity} 单")
    
    def cmd_reset(self, args):
        if args.force:
            self.data_manager.reset_state()
            print("✓ 已重置所有数据")
        else:
            confirm = input("确定要重置所有数据吗？(yes/no): ")
            if confirm.lower() == 'yes':
                self.data_manager.reset_state()
                print("✓ 已重置所有数据")
            else:
                print("已取消")
    
    def run(self):
        parser = argparse.ArgumentParser(description='花店节日预订单管理系统')
        subparsers = parser.add_subparsers(dest='command', help='可用命令')
        
        import_parser = subparsers.add_parser('import', help='导入数据')
        import_parser.add_argument('--inventory', type=str, help='花材库存JSON文件')
        import_parser.add_argument('--workstations', type=str, help='包装工位JSON文件')
        import_parser.add_argument('--slots', type=str, help='配送时段JSON文件')
        import_parser.add_argument('--rules', type=str, help='替换规则JSON文件')
        import_parser.add_argument('--orders', type=str, help='订单JSON文件')
        
        subparsers.add_parser('preview', help='预览排程结果')
        
        replace_parser = subparsers.add_parser('replace', help='处理花材替换')
        replace_parser.add_argument('order_id', type=str, help='订单ID')
        replace_parser.add_argument('original', type=str, help='原花材名称')
        replace_parser.add_argument('new', type=str, help='新花材名称')
        replace_parser.add_argument('quantity', type=int, help='替换数量')
        
        confirm_parser = subparsers.add_parser('confirm', help='确认生产单')
        confirm_parser.add_argument('order_id', type=str, help='订单ID 或 "all" 确认全部')
        
        export_parser = subparsers.add_parser('export', help='导出排程结果')
        export_parser.add_argument('--output', type=str, default='schedule_export.json', help='输出文件')
        
        subparsers.add_parser('status', help='查看系统状态')
        
        reset_parser = subparsers.add_parser('reset', help='重置所有数据')
        reset_parser.add_argument('--force', action='store_true', help='强制重置，无需确认')
        
        args = parser.parse_args()
        
        if not args.command:
            parser.print_help()
            return
        
        commands = {
            'import': self.cmd_import,
            'preview': self.cmd_preview,
            'replace': self.cmd_replace,
            'confirm': self.cmd_confirm,
            'export': self.cmd_export,
            'status': self.cmd_status,
            'reset': self.cmd_reset
        }
        
        if args.command in commands:
            commands[args.command](args)


def main():
    cli = FloristCLI()
    cli.run()


if __name__ == '__main__':
    main()
