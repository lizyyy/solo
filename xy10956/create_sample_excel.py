#!/usr/bin/env python3
import pandas as pd

data = {
    "报销单号": ["BX20240001", "BX20240002", "BX20240003"],
    "发票代码": ["0123456789", "9876543210", "1122334455"],
    "金额": [1234.56, 888.00, 500.50]
}

df = pd.DataFrame(data)
df.to_excel("报销单示例.xlsx", index=False)
print("示例Excel已创建: 报销单示例.xlsx")
