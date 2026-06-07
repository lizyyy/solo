#!/usr/bin/env python3
import sys
import os
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.processor import DisputeFreezeAlert
from src.sample_data import get_all_samples
from src.report import ReportGenerator


def run_sample(sample_idx: int = None) -> None:
    samples = get_all_samples()
    
    if sample_idx is not None:
        if 0 <= sample_idx < len(samples):
            samples = [samples[sample_idx]]
        else:
            print(f"❌ 样例编号无效，可选范围: 0-{len(samples)-1}")
            return

    for sample in samples:
        alert = DisputeFreezeAlert()
        
        alert.load_manager_notes_from_dataframe(sample["manager_notes"])
        alert.load_counter_trans_from_dataframe(sample["counter_trans"])
        alert.load_valuation_records_from_dataframe(sample["valuation_records"])
        
        results = alert.match_and_analyze()
        
        ReportGenerator.print_console_report(results, sample["name"])
        print(f"\n  💡 说明: {sample['description']}\n")


def run_custom(notes_path: str, trans_path: str, valuation_path: str = None) -> None:
    if not os.path.exists(notes_path):
        print(f"❌ 文件不存在: {notes_path}")
        return
    if not os.path.exists(trans_path):
        print(f"❌ 文件不存在: {trans_path}")
        return

    alert = DisputeFreezeAlert()
    
    print(f"📂 加载客户经理备注: {notes_path}")
    df_notes = pd.read_excel(notes_path) if notes_path.endswith('.xlsx') else pd.read_csv(notes_path)
    alert.load_manager_notes_from_dataframe(df_notes)
    
    print(f"📂 加载柜台流水: {trans_path}")
    df_trans = pd.read_excel(trans_path) if trans_path.endswith('.xlsx') else pd.read_csv(trans_path)
    alert.load_counter_trans_from_dataframe(df_trans)
    
    if valuation_path and os.path.exists(valuation_path):
        print(f"📂 加载估值记录: {valuation_path}")
        df_val = pd.read_excel(valuation_path) if valuation_path.endswith('.xlsx') else pd.read_csv(valuation_path)
        alert.load_valuation_records_from_dataframe(df_val)
    
    print(f"\n🔍 开始比对分析...\n")
    results = alert.match_and_analyze()
    ReportGenerator.print_console_report(results, "自定义数据比对结果")


def print_help() -> None:
    print("""
信用卡争议款冻结预警
====================

使用方式:

  1. 运行内置样例 (推荐先看这个):
     python main.py sample [编号]
     
     样例列表:
       0 - 正常路径样例 - 数据完全匹配
       1 - 异常路径样例 - 多账号+金额不匹配+缺备注
       2 - 异常路径样例 - 估值冲突+流水多余
       
     示例:
       python main.py sample     # 运行全部样例
       python main.py sample 0   # 只运行第0个样例

  2. 导入自己的数据:
     python main.py run <客户经理备注文件> <柜台流水文件> [估值记录文件]
     
     支持 .xlsx 和 .csv 格式
     
     示例:
       python main.py run notes.xlsx trans.xlsx
       python main.py run notes.xlsx trans.xlsx valuation.xlsx

  3. 显示帮助:
     python main.py help

数据格式要求 (Excel/CSV 列名):
  客户经理备注: customer_id, customer_name, account_no, dispute_amount, note, manager, record_time, frozen
  柜台流水: trans_id, customer_id, customer_name, account_no, trans_amount, trans_type, trans_time, operator
  估值记录: valuation_id, customer_id, account_no, dispute_amount, valuation_amount, version, manual_note, valuator, valuation_time
""")


def main():
    if len(sys.argv) < 2:
        print_help()
        return

    cmd = sys.argv[1].lower()

    if cmd == "sample":
        sample_idx = int(sys.argv[2]) if len(sys.argv) > 2 else None
        run_sample(sample_idx)
    elif cmd == "run":
        if len(sys.argv) < 4:
            print("❌ 参数不足，用法: python main.py run <备注文件> <流水文件> [估值文件]")
            return
        notes_path = sys.argv[2]
        trans_path = sys.argv[3]
        val_path = sys.argv[4] if len(sys.argv) > 4 else None
        run_custom(notes_path, trans_path, val_path)
    elif cmd == "help":
        print_help()
    else:
        print(f"❌ 未知命令: {cmd}")
        print_help()


if __name__ == "__main__":
    main()
