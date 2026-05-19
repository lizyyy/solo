import pandas as pd
from datetime import datetime, timedelta

data = [
    {"菜品名称": "宫保鸡丁", "菜品编码": "KC001", "留样时间": (datetime.now() - timedelta(hours=10)).strftime("%Y-%m-%d %H:%M:%S"), "留样数量": "200g", "留样人": "张三", "存放位置": "A柜01层", "保留时长(小时)": 48},
    {"菜品名称": "鱼香肉丝", "菜品编码": "KC002", "留样时间": (datetime.now() - timedelta(hours=8)).strftime("%Y-%m-%d %H:%M:%S"), "留样数量": "150g", "留样人": "张三", "存放位置": "A柜01层", "保留时长(小时)": 48},
    {"菜品名称": "麻婆豆腐", "菜品编码": "KC003", "留样时间": (datetime.now() - timedelta(hours=50)).strftime("%Y-%m-%d %H:%M:%S"), "留样数量": "180g", "留样人": "李四", "存放位置": "A柜02层", "保留时长(小时)": 48},
    {"菜品名称": "", "菜品编码": "KC004", "留样时间": "2024/13/01", "留样数量": "100g", "留样人": "王五", "存放位置": "B柜01层", "保留时长(小时)": 48},
]

df = pd.DataFrame(data)
df.to_excel("sample_data.xlsx", index=False)
print("sample_data.xlsx 已创建")
