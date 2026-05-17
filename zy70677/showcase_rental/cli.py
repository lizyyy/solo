import argparse
import sys
from pathlib import Path

from .parser import DataParser
from .rules import RuleEngine
from .exceptions import ContractValidator
from .reporter import ReportGenerator
from .models import ProcessingResult


def main():
    parser = argparse.ArgumentParser(
        description="展柜租赁账期核算工具 - 支持租期拆分、加柜计费、保证金抵扣、合同异常检查",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  %(prog)s --contracts data/contracts.csv --showcases data/showcases.csv --lease data/lease.csv --add data/add_cabinet.csv --deposit data/deposit.csv
  %(prog)s --data-dir ./data --output ./output
        """,
    )

    parser.add_argument(
        "--contracts",
        type=str,
        help="合同数据CSV文件路径",
    )

    parser.add_argument(
        "--showcases",
        type=str,
        help="展柜数据CSV文件路径",
    )

    parser.add_argument(
        "--lease",
        type=str,
        help="租期数据CSV文件路径",
    )

    parser.add_argument(
        "--add-cabinet",
        type=str,
        help="加柜记录CSV文件路径",
    )

    parser.add_argument(
        "--deposit",
        type=str,
        help="保证金记录CSV文件路径",
    )

    parser.add_argument(
        "--data-dir",
        type=str,
        help="数据目录，自动查找 contracts.csv, showcases.csv, lease.csv, add_cabinet.csv, deposit.csv",
    )

    parser.add_argument(
        "--output",
        type=str,
        default="output",
        help="输出目录 (默认: output)",
    )

    parser.add_argument(
        "--prefix",
        type=str,
        default="",
        help="输出文件名前缀",
    )

    parser.add_argument(
        "--quiet",
        action="store_true",
        help="静默模式，不输出控制台摘要",
    )

    args = parser.parse_args()

    if args.data_dir:
        data_dir = Path(args.data_dir)
        contracts_file = str(data_dir / "contracts.csv") if (data_dir / "contracts.csv").exists() else None
        showcases_file = str(data_dir / "showcases.csv") if (data_dir / "showcases.csv").exists() else None
        lease_file = str(data_dir / "lease.csv") if (data_dir / "lease.csv").exists() else None
        add_cabinet_file = str(data_dir / "add_cabinet.csv") if (data_dir / "add_cabinet.csv").exists() else None
        deposit_file = str(data_dir / "deposit.csv") if (data_dir / "deposit.csv").exists() else None
    else:
        contracts_file = args.contracts
        showcases_file = args.showcases
        lease_file = args.lease
        add_cabinet_file = args.add_cabinet
        deposit_file = args.deposit

    if not any([contracts_file, showcases_file, lease_file, add_cabinet_file, deposit_file]):
        print("错误: 未指定任何数据文件", file=sys.stderr)
        print("请使用 --contracts, --showcases, --lease, --add-cabinet, --deposit 指定数据文件", file=sys.stderr)
        print("或使用 --data-dir 指定数据目录", file=sys.stderr)
        sys.exit(1)

    data_parser = DataParser()
    parsed_data = data_parser.parse_all(
        contracts_file=contracts_file,
        showcases_file=showcases_file,
        lease_periods_file=lease_file,
        add_cabinet_file=add_cabinet_file,
        deposit_file=deposit_file,
    )

    validator = ContractValidator()
    validation_errors = validator.validate_all(
        contracts=parsed_data["contracts"],
        showcases=parsed_data["showcases"],
        lease_periods=parsed_data["lease_periods"],
        add_cabinet_records=parsed_data["add_cabinet_records"],
        deposit_records=parsed_data["deposit_records"],
    )

    rule_engine = RuleEngine()
    billing_periods = rule_engine.process_all_billing(
        contracts=parsed_data["contracts"],
        lease_periods=parsed_data["lease_periods"],
        add_cabinet_records=parsed_data["add_cabinet_records"],
        deposit_records=parsed_data["deposit_records"],
    )

    summary = rule_engine.generate_summary(
        contracts=parsed_data["contracts"],
        showcases=parsed_data["showcases"],
        lease_periods=parsed_data["lease_periods"],
        add_cabinet_records=parsed_data["add_cabinet_records"],
        deposit_records=parsed_data["deposit_records"],
        billing_periods=billing_periods,
    )

    result = ProcessingResult(
        contracts=parsed_data["contracts"],
        showcases=parsed_data["showcases"],
        lease_periods=parsed_data["lease_periods"],
        add_cabinet_records=parsed_data["add_cabinet_records"],
        deposit_records=parsed_data["deposit_records"],
        billing_periods=billing_periods,
        validation_errors=validation_errors,
        bad_rows=parsed_data["bad_rows"],
        summary=summary,
    )

    reporter = ReportGenerator(output_dir=args.output)
    reporter.generate_all_reports(result, prefix=args.prefix)

    if not args.quiet:
        reporter.print_console_summary(result)

    has_errors = any(e.severity.value == "ERROR" for e in validation_errors)
    if has_errors:
        print("\n警告: 数据中存在ERROR级别的验证错误，请检查报告", file=sys.stderr)

    return 0


if __name__ == "__main__":
    sys.exit(main())
