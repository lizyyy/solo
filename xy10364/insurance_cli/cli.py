import argparse
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from insurance_cli.importer import DataImporter
from insurance_cli.calculator import ClaimCalculator
from insurance_cli.reporter import ClaimReporter


class InsuranceCLI:
    def __init__(self, data_dir: str = 'sample_data'):
        self.data_dir = data_dir
        self.importer = DataImporter(data_dir)
        self.importer.load_all()
        self.calculator = ClaimCalculator(self.importer)
        self.reporter = ClaimReporter()

    def cmd_preview(self, args):
        order_id = args.order_id
        
        try:
            claim = self.calculator.calculate(order_id)
            claim_dict = self.calculator._claim_to_dict(claim)
            self.calculator.save_claim(claim_dict)
            print(self.reporter.format_claim_display(claim_dict))
            print(f"\n理赔单已保存为草稿: claims/{order_id}_claim.json")
        except ValueError as e:
            print(f"错误: {e}")
            sys.exit(1)

    def cmd_adjust(self, args):
        order_id = args.order_id
        equipment_id = args.equipment_id
        new_level = args.new_level
        
        try:
            claim = self.calculator.update_damage_level(order_id, equipment_id, new_level)
            print(f"已将器材 {equipment_id} 的损坏等级调整为: {new_level}")
            print(self.reporter.format_claim_display(claim))
        except ValueError as e:
            print(f"错误: {e}")
            sys.exit(1)

    def cmd_confirm(self, args):
        order_id = args.order_id
        
        try:
            claim = self.calculator.confirm_claim(order_id)
            print(f"理赔单已确认: {claim['claim_id']}")
            print(self.reporter.format_claim_display(claim))
        except ValueError as e:
            print(f"错误: {e}")
            sys.exit(1)

    def cmd_export(self, args):
        order_id = args.order_id
        format = args.format
        
        claim = self.calculator.load_claim(order_id)
        if not claim:
            print(f"错误: 未找到订单 {order_id} 的理赔单")
            sys.exit(1)
        
        filepath = self.reporter.save_report(claim, format)
        print(f"报告已导出: {filepath}")
        
        if format == 'text':
            print("\n" + "=" * 80)
            print(self.reporter.format_claim_display(claim))

    def cmd_list(self, args):
        print("\n可用的订单:")
        print("-" * 60)
        for order_id, order in self.importer.orders.items():
            print(f"  {order_id}: {order.customer_name} ({len(order.equipments)} 件器材)")
        
        print("\n保险保单:")
        print("-" * 60)
        for policy_id, policy in self.importer.insurance_terms.items():
            print(f"  {policy_id}: {policy.name}")
        
        print("\n押金记录:")
        print("-" * 60)
        for order_id, deposit in self.importer.deposit_records.items():
            print(f"  订单 {order_id}: ¥{deposit.amount:,.2f} ({deposit.status})")

    def run(self):
        parser = argparse.ArgumentParser(
            prog='insurance-cli',
            description='摄影器材保险理赔 CLI 工具'
        )
        
        subparsers = parser.add_subparsers(dest='command', help='可用命令')
        
        preview_parser = subparsers.add_parser('preview', help='试算理赔')
        preview_parser.add_argument('--order-id', required=True, help='订单编号')
        preview_parser.set_defaults(func=self.cmd_preview)
        
        adjust_parser = subparsers.add_parser('adjust', help='调整损坏等级')
        adjust_parser.add_argument('--order-id', required=True, help='订单编号')
        adjust_parser.add_argument('--equipment-id', required=True, help='器材编号')
        adjust_parser.add_argument('--new-level', required=True, 
                                   choices=['minor', 'moderate', 'severe', 'total_loss'],
                                   help='新的损坏等级: minor(轻微), moderate(中等), severe(严重), total_loss(全损)')
        adjust_parser.set_defaults(func=self.cmd_adjust)
        
        confirm_parser = subparsers.add_parser('confirm', help='确认理赔')
        confirm_parser.add_argument('--order-id', required=True, help='订单编号')
        confirm_parser.set_defaults(func=self.cmd_confirm)
        
        export_parser = subparsers.add_parser('export', help='导出报告')
        export_parser.add_argument('--order-id', required=True, help='订单编号')
        export_parser.add_argument('--format', default='text', choices=['text', 'json'],
                                   help='导出格式: text 或 json')
        export_parser.set_defaults(func=self.cmd_export)
        
        list_parser = subparsers.add_parser('list', help='列出所有数据')
        list_parser.set_defaults(func=self.cmd_list)
        
        args = parser.parse_args()
        
        if args.command is None:
            parser.print_help()
            sys.exit(0)
        
        args.func(args)


def main():
    cli = InsuranceCLI()
    cli.run()


if __name__ == '__main__':
    main()
