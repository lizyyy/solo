import argparse
import sys
import os
from datetime import datetime
from typing import List, Tuple, Optional
from .file_reader import FileReader
from .diff_engine import CashDiffEngine
from .reporter import Reporter
from .models import Attachment


def parse_args():
    parser = argparse.ArgumentParser(
        description="门店日结现金差异分析工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 基础用法 - 分析月底对账表
  python -m store_cash_diff --data samples/monthly_statement.csv
  
  # 多文件分析 + 附件索引
  python -m store_cash_diff \\
    --data samples/bank_receipts.csv:银行回单 \\
    --data samples/business_ledger.csv:业务台账 \\
    --data samples/monthly_statement.csv:月底对账表 \\
    --attachment samples/attachment_index.csv \\
    --output output/
  
  # 补录备注
  python -m store_cash_diff --remark "REC001:已确认是收银员误操作"
  
  # 处理晚到附件
  python -m store_cash_diff --late-attach "REC002:银行回单:scan_003.pdf:2026-05-30 补送的回单"
        """
    )
    
    parser.add_argument(
        "--data", "-d",
        action="append",
        default=[],
        help="数据文件路径，格式: 路径[:来源提示]，可多次指定",
    )
    
    parser.add_argument(
        "--attachment", "-a",
        help="附件索引文件路径(CSV/Excel)",
    )
    
    parser.add_argument(
        "--output", "-o",
        default="output",
        help="报告输出目录 (默认: output)",
    )
    
    parser.add_argument(
        "--remark", "-r",
        action="append",
        default=[],
        help="补录备注，格式: 记录ID:备注内容，可多次指定",
    )
    
    parser.add_argument(
        "--late-attach", "-l",
        action="append",
        default=[],
        help="处理晚到附件，格式: 记录ID:类型:路径[:描述]",
    )
    
    parser.add_argument(
        "--sample", "-s",
        action="store_true",
        help="使用内置样例数据运行测试",
    )
    
    parser.add_argument(
        "--no-export",
        action="store_true",
        help="只在终端显示，不导出文件",
    )
    
    parser.add_argument(
        "--tolerance",
        type=float,
        default=0.01,
        help="金额比较容差 (默认: 0.01元)",
    )
    
    return parser.parse_args()


def parse_data_arg(arg: str) -> Tuple[str, Optional[str]]:
    if ":" in arg:
        parts = arg.rsplit(":", 1)
        return parts[0], parts[1]
    return arg, None


def parse_remark_arg(arg: str) -> Tuple[str, str]:
    if ":" in arg:
        parts = arg.split(":", 1)
        return parts[0], parts[1]
    return arg, ""


def parse_late_attach_arg(arg: str) -> Tuple[str, Attachment]:
    parts = arg.split(":", 3)
    if len(parts) < 3:
        raise ValueError(f"晚到附件格式错误: {arg}，应为 记录ID:类型:路径[:描述]")
    
    record_id = parts[0]
    attach = Attachment(
        id=f"LATE_{datetime.now().strftime('%H%M%S')}",
        type=parts[1],
        path=parts[2],
        description=parts[3] if len(parts) > 3 else None,
        received_at=datetime.now(),
        is_late=True,
    )
    return record_id, attach


def generate_sample_data(output_dir: str) -> List[Tuple[str, Optional[str]]]:
    import csv
    
    os.makedirs(output_dir, exist_ok=True)
    
    monthly_statement = os.path.join(output_dir, "monthly_statement.csv")
    with open(monthly_statement, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "记录ID", "门店编号", "门店名称", "交易日期", 
            "金额", "批次号", "数据来源", "门店日结现金差异"
        ])
        writer.writerows([
            ["REC001", "S001", "朝阳路店", "2026-05-20", "2350.50", "BATCH001", "月底对账表", "待核对"],
            ["REC002", "S001", "朝阳路店", "2026-05-20", "2350.50", "BATCH002", "月底对账表", "待核对"],
            ["REC003", "S002", "海淀店", "2026-05-21", "1800.00", "BATCH003", "月底对账表", ""],
            ["REC004", "S002", "海淀店", "2026-05-21", "", "BATCH004", "月底对账表", "金额缺失"],
            ["REC005", "S003", "西城店", "2026-05-22", "0.00", "BATCH005", "月底对账表", "零金额"],
            ["REC006", "S003", "西城店", "2026-05-22", "5600.00", "BATCH999", "月底对账表", "测试批次"],
            ["REC007", "S004", "东城店", "2026-05-23", "3200.00", "BATCH007", "月底对账表", ""],
            ["REC008", "S005", "", "2026-05-24", "1500.00", "BATCH008", "月底对账表", "门店名称缺失"],
            ["REC009", "S005", "丰台店", "", "2100.00", "BATCH009", "月底对账表", "日期缺失"],
            ["REC010", "S006", "通州店", "2026-05-25", "-500.00", "BATCH010", "月底对账表", "负数金额"],
        ])
    
    bank_receipts = os.path.join(output_dir, "bank_receipts.csv")
    with open(bank_receipts, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "记录ID", "门店编号", "门店名称", "交易日期", 
            "金额", "批次号", "数据来源", "备注"
        ])
        writer.writerows([
            ["BANK001", "S001", "朝阳路店", "2026-05-20", "2350.50", "BATCH001", "银行回单", ""],
            ["BANK002", "S002", "海淀店", "2026-05-21", "1850.00", "BATCH003", "银行回单", "与台账差50元"],
            ["BANK003", "S004", "东城店", "2026-05-23", "3200.00", "BATCH007", "银行回单", ""],
        ])
    
    business_ledger = os.path.join(output_dir, "business_ledger.csv")
    with open(business_ledger, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "记录ID", "门店编号", "门店名称", "交易日期", 
            "金额", "批次号", "数据来源", "备注"
        ])
        writer.writerows([
            ["LED001", "S001", "朝阳路店", "2026-05-20", "2350.50", "BATCH001", "业务台账", ""],
            ["LED002", "S002", "海淀店", "2026-05-21", "1800.00", "BATCH003", "业务台账", ""],
            ["LED003", "S004", "东城店", "2026-05-23", "3200.00", "BATCH007", "业务台账", ""],
        ])
    
    attachment_index = os.path.join(output_dir, "attachment_index.csv")
    with open(attachment_index, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "关联记录ID", "附件ID", "附件类型", "附件路径", "描述", "收到时间"
        ])
        writer.writerows([
            ["REC001", "ATT001", "群截图", "screenshots/wechat_001.png", "5月20日交班群聊确认", "2026-05-25 10:30:00"],
            ["REC002", "ATT002", "补录说明", "notes/supplement_001.pdf", "店长确认BATCH002是重复录入", "2026-05-26 14:20:00"],
            ["REC003", "ATT003", "银行回单", "receipts/bank_003.pdf", "", "2026-05-24 09:15:00"],
            ["REC007", "ATT004", "业务台账", "ledger/20260523.xlsx", "", "2026-05-25 16:00:00"],
        ])
    
    return [
        (monthly_statement, "月底对账表"),
        (bank_receipts, "银行回单"),
        (business_ledger, "业务台账"),
    ], attachment_index


def main():
    args = parse_args()
    
    reader = FileReader()
    engine = CashDiffEngine(tolerance=args.tolerance)
    
    data_files = []
    attachment_file = None
    
    if args.sample:
        print("使用内置样例数据运行测试...")
        sample_dir = os.path.join(os.getcwd(), "samples")
        data_files, attachment_file = generate_sample_data(sample_dir)
        print(f"样例数据已生成到: {sample_dir}")
        print()
    else:
        for data_arg in args.data:
            data_files.append(parse_data_arg(data_arg))
        attachment_file = args.attachment
    
    if not data_files and not args.sample:
        print("错误: 未指定数据文件，请使用 --data 或 --sample 参数")
        sys.exit(1)
    
    records, attachments = reader.read_all(data_files, attachment_file)
    
    if not records:
        print("错误: 未读取到任何记录")
        sys.exit(1)
    
    engine.add_records(records)
    
    if args.remark:
        for remark_arg in args.remark:
            rec_id, remark = parse_remark_arg(remark_arg)
            for rec in engine.records:
                if rec.id == rec_id:
                    rec.update_remark(remark, operator="资金组小周", reason="交接前补录备注")
                    print(f"已补录备注: 记录 {rec_id} -> {remark}")
                    break
    
    engine.run_all_checks()
    
    if args.late_attach:
        for late_arg in args.late_attach:
            rec_id, attach = parse_late_attach_arg(late_arg)
            new_remark = f"晚到附件[{attach.type}]补充说明"
            engine.process_late_attachment(rec_id, attach, new_remark)
    
    reporter = Reporter(engine)
    reporter.print_terminal_summary()
    
    if not args.no_export:
        results = reporter.export_all(args.output)
        print()
        print("=" * 80)
        print("  报告已导出:")
        print("=" * 80)
        for name, path in results.items():
            if path:
                print(f"  {name}: {os.path.abspath(path)}")
        print("=" * 80)
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
