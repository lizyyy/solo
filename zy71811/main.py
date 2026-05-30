#!/usr/bin/env python3
import sys
from datetime import datetime
from pathlib import Path

from config import TRANSACTION_FILE, RATE_FILE, OUTPUT_DIR
from data_io import DataIO
from settlement_engine import SettlementEngine
from rate_comparator import RateComparator
from report_generator import ReportGenerator
from models import SettlementBatch


def print_banner():
    print("")
    print("=" * 60)
    print("           会 员 卡 清 算 拆 账 系 统")
    print("=" * 60)
    print("")


def check_files():
    if not TRANSACTION_FILE.exists():
        print(f"错误: 找不到交易文件 {TRANSACTION_FILE}")
        print("请先运行: python sample_data_generator.py 生成示例数据")
        return False
    if not RATE_FILE.exists():
        print(f"错误: 找不到费率表 {RATE_FILE}")
        print("请先运行: python sample_data_generator.py 生成示例数据")
        return False
    return True


def main():
    print_banner()
    
    if not check_files():
        sys.exit(1)
    
    print(">>> 步骤 1: 读取数据")
    transactions = DataIO.read_transactions(TRANSACTION_FILE)
    rate_rules, rate_version = DataIO.read_rate_table(RATE_FILE)
    print(f"    读取交易记录: {len(transactions)} 笔")
    print(f"    费率版本: {rate_version}")
    print("")
    
    print(">>> 步骤 2: 检查费率变更")
    rate_changes, _ = RateComparator.check_and_compare(rate_rules, rate_version)
    if rate_changes:
        print("    ⚠  检测到费率变更！")
        print(RateComparator.format_changes_report(rate_changes))
    else:
        print("    费率未变更")
    print("")
    
    print(">>> 步骤 3: 执行清算拆账")
    batch_id = DataIO.generate_batch_id()
    engine = SettlementEngine(rate_rules, rate_version)
    results, stats = engine.process_transactions(transactions)
    print(f"    批次号: {batch_id}")
    print(ReportGenerator.generate_summary_text(results, stats))
    print("")
    
    print(">>> 步骤 4: 保存清算记录")
    new_records = [r for r in results if not r.is_historical]
    DataIO.save_settlement_records(new_records, batch_id)
    print(f"    已保存 {len(new_records)} 条新清算记录")
    print("")
    
    print(">>> 步骤 5: 生成对账报告")
    batch = SettlementBatch(
        batch_id=batch_id,
        process_time=datetime.now(),
        total_transactions=stats["total"],
        settled_count=stats["matched"],
        suspended_count=stats["suspended"],
        disputed_count=0,
        rate_version=rate_version,
        rate_changes=rate_changes
    )
    
    report_path = OUTPUT_DIR / f"reconciliation_{batch_id}.txt"
    ReportGenerator.generate_reconciliation_report(results, batch, rate_changes, report_path)
    print("")
    
    print("=" * 60)
    print("处理完成！")
    print(f"对账报告: {report_path}")
    print(f"清算日志: data/logs/settlement_history.json")
    print("=" * 60)
    print("")


if __name__ == "__main__":
    main()
