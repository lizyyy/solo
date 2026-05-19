import pandas as pd

stock_data = [
    {"product_id": "PRD001", "product_name": "新鲜苹果", "stock_quantity": 3},
    {"product_id": "PRD002", "product_name": "有机白菜", "stock_quantity": 2},
    {"product_id": "PRD003", "product_name": "澳洲牛肉", "stock_quantity": 0},
    {"product_id": "", "product_name": "无效记录", "stock_quantity": -5},
]

df = pd.DataFrame(stock_data)
df.to_excel("test_stock.xlsx", index=False)
print("test_stock.xlsx 生成完成")
