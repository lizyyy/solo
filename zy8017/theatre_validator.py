#!/usr/bin/env python3
"""剧院演出换座与退票规则校验工具 - 主入口"""

import argparse
import sys
from pathlib import Path

from cli.command import CLICommand
from cli.reporter import MarkdownReporter, CSVReporter
from storage.validator import DataValidator
from storage.store import DataStore
from parsers.csv_parser import CSVParser
from parsers.json_parser import JSONParser
from parsers.yaml_parser import YAMLParser
from engine.rules_engine import RulesEngine


def main():
    """主函数"""
    parser = argparse.ArgumentParser(
        description="剧院演出换座与退票规则校验工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python theatre_validator.py validate --orders samples/orders.csv --seating samples/seating.json --rules samples/rules.yaml
  python theatre_validator.py validate --orders samples/orders.csv --seating samples/seating.json --rules samples/rules.yaml --output report.md
  python theatre_validator.py validate --orders samples/orders.csv --seating samples/seating.json --rules samples/rules.yaml --csv report.csv
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="可用命令")
    
    # validate 命令
    validate_parser = subparsers.add_parser("validate", help="验证订单并生成报告")
    validate_parser.add_argument("--orders", "-o", required=True, help="订单 CSV 文件路径")
    validate_parser.add_argument("--seating", "-s", required=True, help="座位图 JSON 文件路径")
    validate_parser.add_argument("--rules", "-r", required=True, help="票档/退改规则 YAML 文件路径")
    validate_parser.add_argument("--output", "-f", help="输出 Markdown 报告文件路径")
    validate_parser.add_argument("--csv", "-c", help="输出 CSV 报告文件路径")
    validate_parser.add_argument("--verbose", "-v", action="store_true", help="显示详细信息")
    
    # demo 命令
    demo_parser = subparsers.add_parser("demo", help="运行演示（使用样例数据）")
    demo_parser.add_argument("--output", "-f", help="输出 Markdown 报告文件路径")
    demo_parser.add_argument("--csv", "-c", help="输出 CSV 报告文件路径")
    
    args = parser.parse_args()
    
    if args.command == "validate":
        run_validate(args)
    elif args.command == "demo":
        run_demo(args)
    else:
        parser.print_help()


def run_validate(args):
    """运行验证命令"""
    try:
        # 解析数据
        orders_path = Path(args.orders)
        seating_path = Path(args.seating)
        rules_path = Path(args.rules)
        
        csv_parser = CSVParser()
        json_parser = JSONParser()
        yaml_parser = YAMLParser()
        
        orders = csv_parser.parse(orders_path)
        seating = json_parser.parse(seating_path)
        rules = yaml_parser.parse(rules_path)
        
        # 验证数据
        validator = DataValidator()
        validation_result = validator.validate_all(orders, seating, rules)
        
        if not validation_result.is_valid:
            print("数据验证失败：")
            for error in validation_result.errors:
                print(f"  - [{error.severity.upper()}] {error.message}")
            if any(e.severity == "error" for e in validation_result.errors):
                sys.exit(1)
        
        # 创建数据存储
        store = DataStore()
        store.load_data(orders, seating, rules)
        
        # 运行规则引擎
        engine = RulesEngine(store)
        results = engine.process_all_orders()
        
        # 输出结果
        cli = CLICommand()
        cli.display_results(results, verbose=args.verbose)
        
        # 生成报告
        if args.output:
            md_reporter = MarkdownReporter()
            md_report = md_reporter.generate(results, store)
            output_path = Path(args.output)
            output_path.write_text(md_report, encoding="utf-8")
            print(f"\nMarkdown 报告已保存到: {output_path}")
        
        if args.csv:
            csv_reporter = CSVReporter()
            csv_report = csv_reporter.generate(results)
            csv_path = Path(args.csv)
            csv_path.write_text(csv_report, encoding="utf-8")
            print(f"CSV 报告已保存到: {csv_path}")
            
    except Exception as e:
        print(f"错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def run_demo(args):
    """运行演示命令"""
    sample_dir = Path(__file__).parent / "samples"
    
    if not sample_dir.exists():
        print(f"样例数据目录不存在: {sample_dir}")
        print("请确保项目包含 samples 目录")
        sys.exit(1)
    
    orders_path = sample_dir / "orders.csv"
    seating_path = sample_dir / "seating.json"
    rules_path = sample_dir / "rules.yaml"
    
    # 检查样例文件
    missing_files = []
    if not orders_path.exists():
        missing_files.append("orders.csv")
    if not seating_path.exists():
        missing_files.append("seating.json")
    if not rules_path.exists():
        missing_files.append("rules.yaml")
    
    if missing_files:
        print(f"缺少样例数据文件: {', '.join(missing_files)}")
        sys.exit(1)
    
    print("=" * 60)
    print("剧院演出换座与退票规则校验工具 - 演示模式")
    print("=" * 60)
    print(f"\n使用样例数据:")
    print(f"  - 订单文件: {orders_path}")
    print(f"  - 座位图: {seating_path}")
    print(f"  - 规则文件: {rules_path}")
    print("\n" + "-" * 60 + "\n")
    
    # 使用样例数据运行
    orders_parser = CSVParser()
    json_parser = JSONParser()
    yaml_parser = YAMLParser()
    
    orders = orders_parser.parse(orders_path)
    seating = json_parser.parse(seating_path)
    rules = yaml_parser.parse(rules_path)
    
    # 验证
    validator = DataValidator()
    validation = validator.validate_all(orders, seating, rules)
    
    if not validation.is_valid:
        print("数据验证警告:")
        for error in validation.errors:
            print(f"  - {error.message}")
        print()
    
    # 存储
    store = DataStore()
    store.load_data(orders, seating, rules)
    
    # 规则引擎
    engine = RulesEngine(store)
    results = engine.process_all_orders()
    
    # 显示
    cli = CLICommand()
    cli.display_results(results, verbose=True)
    
    # 生成报告
    if args.output:
        md_reporter = MarkdownReporter()
        md_report = md_reporter.generate(results, store)
        output_path = Path(args.output)
        output_path.write_text(md_report, encoding="utf-8")
        print(f"\nMarkdown 报告已保存到: {output_path}")
    else:
        default_md = Path("demo_report.md")
        md_reporter = MarkdownReporter()
        md_report = md_reporter.generate(results, store)
        default_md.write_text(md_report, encoding="utf-8")
        print(f"\nMarkdown 报告已保存到: {default_md}")
    
    if args.csv:
        csv_reporter = CSVReporter()
        csv_report = csv_reporter.generate(results)
        csv_path = Path(args.csv)
        csv_path.write_text(csv_report, encoding="utf-8")
        print(f"CSV 报告已保存到: {csv_path}")
    else:
        default_csv = Path("demo_report.csv")
        csv_reporter = CSVReporter()
        csv_report = csv_reporter.generate(results)
        default_csv.write_text(csv_report, encoding="utf-8")
        print(f"CSV 报告已保存到: {default_csv}")
    
    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
