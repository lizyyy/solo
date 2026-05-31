import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd
from datetime import datetime, timedelta
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
SAMPLE_DIR = BASE_DIR / "data" / "sample_data"
SAMPLE_DIR.mkdir(exist_ok=True)

today = datetime.now().date()

invoice_data = []
for i in range(1, 16):
    days_offset = i * 15
    bill_date = today - timedelta(days=days_offset)
    due_date = today + timedelta(days=60 + i * 10)
    serial = f"TRX{2024000 + i}"

    if i == 3:
        payer = "退款挂账处理中"
    elif i == 7:
        payer = "XX公司（暂收待确认）"
    elif i == 10:
        due_date = today + timedelta(days=200)
        payer = "YY公司"
    else:
        payer = f"付款方公司{i}"

    if i == 5:
        serial = f"TRX{2024000 + 2}"
        amount = 50000.00
    else:
        amount = round(30000 + i * 15000.50, 2)

    invoice_data.append({
        "票据号": f"INV{2024000 + i}",
        "票据日期": bill_date.strftime("%Y-%m-%d"),
        "到期日期": due_date.strftime("%Y-%m-%d"),
        "金额": amount,
        "手续费": round(amount * 0.006, 2) if i != 10 else round(amount * 0.02, 2),
        "付款方": payer,
        "收款方": "本公司",
        "流水号": serial,
        "银行账号": f"622202123456789{i:03d}",
        "备注": f"第{i}笔贸易结算款" if i not in [3, 7] else ""
    })

statement_data = []
for i in range(1, 12):
    bill_date = today - timedelta(days=i * 12)
    due_date = today + timedelta(days=50 + i * 8)

    if i <= 8:
        serial = f"TRX{2024000 + i}"
        amount = round(30000 + i * 15000.50, 2)
        if i == 5:
            amount = 50000.00
    else:
        serial = f"TRX{2024050 + i}"
        amount = round(25000 + i * 8000, 2)

    statement_data.append({
        "单据号": f"STMT{2024000 + i}",
        "日期": bill_date.strftime("%Y-%m-%d"),
        "兑付日期": due_date.strftime("%Y-%m-%d"),
        "票面金额": amount,
        "费用": round(amount * 0.006, 2),
        "出票人": f"付款方公司{i}" if i <= 8 else f"其他公司{i}",
        "收款人": "本公司",
        "交易流水号": serial,
        "开户行": f"工商银行上海市分行",
        "说明": f"银行对账单第{i}笔"
    })

invoice_df = pd.DataFrame(invoice_data)
invoice_df.to_excel(SAMPLE_DIR / "示例票据数据.xlsx", index=False)

statement_df = pd.DataFrame(statement_data)
statement_df.to_excel(SAMPLE_DIR / "示例对账单数据.xlsx", index=False)

print(f"示例数据已生成到: {SAMPLE_DIR}")
print(f"  - 示例票据数据.xlsx ({len(invoice_data)} 条记录)")
print(f"  - 示例对账单数据.xlsx ({len(statement_data)} 条记录)")
print()
print("说明：")
print("  • 第5条票据：流水号与第2条重复（模拟重复入账）")
print("  • 第3条票据：付款方包含'退款挂账'（模拟退款挂账）")
print("  • 第7条票据：付款方包含'待确认'（模拟挂账待确认）")
print("  • 第10条票据：票据日期间隔日数>90天且手续费比例>10%（模拟手续费跨期）")
print("  • 第1-8条票据与对账单流水号一致，可通过智能匹配自动关联")
