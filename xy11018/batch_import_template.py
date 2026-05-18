import pandas as pd
from datetime import datetime, timedelta

data = [
    {
        "员工工号": "E001",
        "门店编号": "S001",
        "交易时间": datetime.now() - timedelta(days=1),
        "交易总金额": 25.5,
        "餐补核销金额": 20.0,
        "个人支付金额": 5.5,
        "餐别": "午餐",
        "消费明细": "一荤两素套餐",
        "备注": "正常就餐"
    },
    {
        "员工工号": "E002",
        "门店编号": "S003",
        "交易时间": datetime.now() - timedelta(days=2),
        "交易总金额": 30.0,
        "餐补核销金额": 25.0,
        "个人支付金额": 5.0,
        "餐别": "晚餐",
        "消费明细": "两荤一素套餐",
        "备注": "跨园区就餐，需审批"
    },
    {
        "员工工号": "E003",
        "门店编号": "S004",
        "交易时间": datetime.now() - timedelta(days=3),
        "交易总金额": 18.0,
        "餐补核销金额": 15.0,
        "个人支付金额": 3.0,
        "餐别": "早餐",
        "消费明细": "包子豆浆",
        "备注": "已离职员工，需核实"
    },
    {
        "员工工号": "E004",
        "门店编号": "S002",
        "交易时间": datetime.now() - timedelta(days=4),
        "交易总金额": 28.0,
        "餐补核销金额": 22.0,
        "个人支付金额": 6.0,
        "餐别": "午餐",
        "消费明细": "特色面食",
        "备注": ""
    }
]

df = pd.DataFrame(data)
df.to_excel("批量导入模板.xlsx", index=False, sheet_name="餐补核销明细")
print("批量导入模板已生成：批量导入模板.xlsx")
print("\n模板包含以下列：")
for col in df.columns:
    print(f"  - {col}")
