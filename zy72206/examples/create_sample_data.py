#!/usr/bin/env python3
import pandas as pd

data = [
    {
        "trade_date": "2024-01-15",
        "settlement_date": "2024-01-17",
        "currency_pair": "USD/CNY",
        "amount": 100000.00,
        "rate": 7.1850,
        "remark": "正常交割"
    },
    {
        "trade_date": "2024-01-16",
        "settlement_date": "2024-01-18",
        "currency_pair": "EUR/CNY",
        "amount": 50000.00,
        "rate": 7.8520,
        "remark": ""
    },
    {
        "trade_date": "2024-01-15",
        "settlement_date": "2024-01-17",
        "currency_pair": "USD/CNY",
        "amount": 0.00,
        "rate": 7.1850,
        "remark": "已冲正 - 客户取消交易"
    },
    {
        "trade_date": "2024-01-16",
        "settlement_date": "2024-01-18",
        "currency_pair": "JPY/CNY",
        "amount": 5000000.00,
        "rate": 0.0485,
        "remark": "日元大额交割"
    },
    {
        "trade_date": "2024-01-17",
        "settlement_date": "2024-01-19",
        "currency_pair": "USD/CNY",
        "amount": 0.00,
        "rate": 7.1900,
        "remark": "已冲正"
    },
]

df = pd.DataFrame(data)
df.to_excel("examples/sample_data.xlsx", index=False, engine="openpyxl")
print("示例数据已创建: examples/sample_data.xlsx")
print(f"共 {len(df)} 条记录，其中 {len(df[df['amount'] == 0])} 条金额为0")
