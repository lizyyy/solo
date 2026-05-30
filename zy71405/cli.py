import argparse
import sys
import os
from pathlib import Path

from models import RecordStatus, ErrorType
from engine import CommissionRefundEngine
from data_io import DataIO


class CommissionRefundCLI:
    def __init__(self):
        self.engine = CommissionRefundEngine()
        self.output_dir = Path("output")
        self.output_dir.mkdir(exist_ok=True)

    def cmd_import(self, args):
        print(f"=== 导入数据 ===")
        total_problems = []

        if args.trades:
            trades, problems = DataIO.read_trades(args.trades)
            for t in trades:
                self.engine.add_trade(t)
            total_problems.extend(problems)
            print(f"  成交流水: {len(trades)} 条导入成功, {len(problems)} 条导入失败")

        if args.groups:
            groups, problems = DataIO.read_customer_groups(args.groups)
            for g in groups:
                self.engine.add_customer_group(g)
            total_problems.extend(problems)
            print(f"  客户分组: {len(groups)} 条导入成功, {len(problems)} 条导入失败")

        if args.rules:
            rules, problems = DataIO.read_commission_rules(args.rules)
            for r in rules:
                self.engine.add_rule(r)
            total_problems.extend(problems)
            print(f"  佣金规则: {len(rules)} 条导入成功, {len(problems)} 条导入失败")

        if total_problems:
            problem_file = self.output_dir / "import_problems.csv"
            DataIO.export_problem_records(total_problems, str(problem_file))
            print(f"  导入问题已导出: {problem_file}")

        print(f"=== 导入完成 ===")

    def cmd_process(self, args):
        print(f"=== 开始处理佣金返还 ===")
        self.engine.process_all()

        normal_count = len(self.engine.refund_results)
        problem_count = len(self.engine.problem_records)

        print(f"  正常返还: {normal_count} 条")
        print(f"  问题记录: {problem_count} 条")

        for et in ErrorType:
            count = len([p for p in self.engine.problem_records if p.error_type == et])
            if count > 0:
                print(f"    - {et.value}: {count} 条")

        print(f"=== 处理完成 ===")

    def cmd_review(self, args):
        print(f"\n=== 处理结果回看 ===")
        print(f"\n【正常返还记录】{len(self.engine.refund_results)} 条")
        for i, r in enumerate(self.engine.refund_results[:10], 1):
            print(f"  {i}. 交易{r.trade_id} | 客户{r.customer_name} | 金额{r.trade_amount:.2f} | 返还{r.refund_amount:.2f}")
            print(f"     来源: {r.trade_source.file_name} 行{r.trade_source.line_number} | 规则版本: {r.rule_version}")
        if len(self.engine.refund_results) > 10:
            print(f"  ... 还有 {len(self.engine.refund_results) - 10} 条")

        print(f"\n【问题记录】{len(self.engine.problem_records)} 条")
        for i, p in enumerate(self.engine.problem_records[:20], 1):
            print(f"  {i}. [{p.error_type.value}] {p.description}")
            for s in p.sources:
                print(f"     来源: {s.file_name} 行{s.line_number}")
        if len(self.engine.problem_records) > 20:
            print(f"  ... 还有 {len(self.engine.problem_records) - 20} 条")

        review_file = self.output_dir / "review_summary.csv"
        DataIO.export_review(self.engine.refund_results, self.engine.problem_records, str(review_file))
        print(f"\n  回看摘要已导出: {review_file}")

    def cmd_export(self, args):
        print(f"=== 导出结果 ===")

        results_file = self.output_dir / "refund_results.csv"
        DataIO.export_refund_results(self.engine.refund_results, str(results_file))
        print(f"  正常返还记录: {results_file} ({len(self.engine.refund_results)} 条)")

        problems_file = self.output_dir / "problem_records.csv"
        DataIO.export_problem_records(self.engine.problem_records, str(problems_file))
        print(f"  问题记录: {problems_file} ({len(self.engine.problem_records)} 条)")

        print(f"=== 导出完成 ===")

    def cmd_full(self, args):
        print(f"\n{'='*50}")
        print(f"  交易佣金阶梯返还 - 完整流程")
        print(f"{'='*50}\n")

        self.cmd_import(args)
        print()
        self.cmd_process(args)
        print()
        self.cmd_review(args)
        print()
        self.cmd_export(args)

        print(f"\n{'='*50}")
        print(f"  处理完成! 结果在 {self.output_dir.absolute()}")
        print(f"{'='*50}\n")

    def run(self):
        parser = argparse.ArgumentParser(description="券商机构业务 - 交易佣金阶梯返还工具")
        subparsers = parser.add_subparsers(dest="command", help="命令")

        import_parser = subparsers.add_parser("import", help="导入数据")
        import_parser.add_argument("--trades", help="成交流水CSV文件")
        import_parser.add_argument("--groups", help="客户分组CSV文件")
        import_parser.add_argument("--rules", help="佣金规则CSV文件")
        import_parser.set_defaults(func=self.cmd_import)

        process_parser = subparsers.add_parser("process", help="处理佣金返还")
        process_parser.set_defaults(func=self.cmd_process)

        review_parser = subparsers.add_parser("review", help="回看处理结果")
        review_parser.set_defaults(func=self.cmd_review)

        export_parser = subparsers.add_parser("export", help="导出结果")
        export_parser.set_defaults(func=self.cmd_export)

        full_parser = subparsers.add_parser("full", help="完整流程: 导入->处理->回看->导出")
        full_parser.add_argument("--trades", required=True, help="成交流水CSV文件")
        full_parser.add_argument("--groups", required=True, help="客户分组CSV文件")
        full_parser.add_argument("--rules", required=True, help="佣金规则CSV文件")
        full_parser.set_defaults(func=self.cmd_full)

        args = parser.parse_args()
        if not args.command:
            parser.print_help()
            return

        args.func(args)


if __name__ == "__main__":
    cli = CommissionRefundCLI()
    cli.run()
