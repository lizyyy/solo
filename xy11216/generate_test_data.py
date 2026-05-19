import pandas as pd
from datetime import datetime, timedelta
import random

stores = ["朝阳门店", "海淀门店", "西城门店", "东城门店"]
persons = ["张三", "李四", "王五", "赵六"]
dishes = ["宫保鸡丁", "鱼香肉丝", "红烧肉", "清蒸鱼", "麻婆豆腐", "糖醋排骨"]
fridges = ["冷藏1号", "冷藏2号", "冷冻1号", "冷冻2号"]

sample_data = []
for i in range(15):
    date = datetime.now() - timedelta(days=random.randint(1, 7))
    sample_time = date.replace(hour=random.randint(9, 14), minute=random.randint(0, 59))
    discard_time = sample_time + timedelta(hours=random.randint(4, 48))
    
    sample_data.append({
        "门店名称": random.choice(stores),
        "负责人": random.choice(persons),
        "日期": date.strftime("%Y-%m-%d"),
        "菜品名称": random.choice(dishes),
        "留样时间": sample_time.strftime("%Y-%m-%d %H:%M:%S"),
        "废弃时间": discard_time.strftime("%Y-%m-%d %H:%M:%S"),
        "备注": ""
    })

sample_data.append({
    "门店名称": "",
    "负责人": "李四",
    "日期": "2024-13-01",
    "菜品名称": "错误菜品",
    "留样时间": "2024-01-15 10:00:00",
    "废弃时间": "2024-01-15 09:00:00",
    "备注": "故意错误数据"
})

df_sample = pd.DataFrame(sample_data)
df_sample.to_excel("留样台账.xlsx", index=False, engine="openpyxl")
print("留样台账.xlsx 已生成")

temp_data = []
for i in range(20):
    date = datetime.now() - timedelta(days=random.randint(1, 7))
    
    is_abnormal = random.random() < 0.2
    if is_abnormal:
        temp = random.uniform(9, 15)
    else:
        temp = random.uniform(2, 7)
    
    temp_data.append({
        "门店名称": random.choice(stores),
        "负责人": random.choice(persons),
        "日期": date.strftime("%Y-%m-%d"),
        "冰箱编号": random.choice(fridges),
        "温度": round(temp, 1),
        "备注": "温度异常" if is_abnormal else ""
    })

temp_data.append({
    "门店名称": "测试门店",
    "负责人": "",
    "日期": "2024/01/15",
    "冰箱编号": "冰箱A",
    "温度": "不是数字",
    "备注": "故意错误数据"
})

df_temp = pd.DataFrame(temp_data)
df_temp.to_csv("温度日志.csv", index=False, encoding="utf-8-sig")
print("温度日志.csv 已生成")
