import pandas as pd
from pathlib import Path
import uuid
from datetime import datetime, timedelta

from src.config import INPUT_DIR


def generate_sample_data():
    counterparties = [
        "华泰证券股份有限公司",
        "中信证券股份有限公司",
        "国泰君安证券股份有限公司",
        "广发证券股份有限公司",
        "招商证券股份有限公司"
    ]

    ledgers = []
    for i, cp in enumerate(counterparties):
        credit_limit = 50000000 + i * 10000000
        used = credit_limit * (0.3 + i * 0.1)
        ledgers.append({
            "ledger_id": str(uuid.uuid4()),
            "counterparty": cp,
            "credit_limit": credit_limit,
            "used_credit": used,
            "available_credit": credit_limit - used,
            "effective_date": "2024-01-01",
            "expiry_date": "2024-12-31",
            "status": "active",
            "updated_by": ["张三", "李四", "王五", "赵六", "钱七"][i],
            "updated_at": (datetime.now() - timedelta(days=i)).isoformat(),
            "remarks": f"{cp}年度授信"
        })

    df_ledger = pd.DataFrame(ledgers)
    df_ledger.to_excel(INPUT_DIR / "credit_ledger.xlsx", index=False)

    trades = []
    underlyings = ["50ETF", "300ETF", "500ETF", "创业板ETF"]
    option_types = ["Call", "Put"]

    trade_date = datetime.now().strftime("%Y-%m-%d")
    for i in range(15):
        cp_idx = i % len(counterparties)
        trades.append({
            "trade_id": str(uuid.uuid4()),
            "counterparty": counterparties[cp_idx],
            "trade_date": trade_date,
            "product_type": "OTC_Option",
            "notional_amount": 5000000 + (i * 1000000),
            "underlying": underlyings[i % len(underlyings)],
            "option_type": option_types[i % len(option_types)],
            "strike_price": 2.5 + (i * 0.1),
            "trade_status": "confirmed",
            "trader": ["交易员A", "交易员B", "交易员C"][i % 3],
            "created_at": datetime.now().isoformat(),
            "remarks": f"交易{i+1}号"
        })

    df_trades = pd.DataFrame(trades)
    df_trades.to_excel(INPUT_DIR / "trade_flows.xlsx", index=False)

    actual_margins = []
    for i, cp in enumerate(counterparties):
        actual_margins.append({
            "counterparty": cp,
            "actual_margin": 2000000 + i * 500000
        })

    df_margin = pd.DataFrame(actual_margins)
    df_margin.to_excel(INPUT_DIR / "actual_margin.xlsx", index=False)

    print("示例数据生成完成！")
    print(f"授信台账: {len(ledgers)} 条")
    print(f"交易流水: {len(trades)} 条")
    print(f"实际保证金: {len(actual_margins)} 条")


if __name__ == "__main__":
    generate_sample_data()
