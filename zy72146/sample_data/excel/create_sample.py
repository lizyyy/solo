import pandas as pd
from datetime import datetime, timedelta
import random

random.seed(42)

students = ["小明", "小红", "小华", "小丽", "小强"]
track_names = [
    "小星星变奏曲", "森林鼓点", "欢快的节奏", "童年记忆", 
    "跳跃的音符", "雨后彩虹", "快乐节拍", "梦想启航"
]

data = []
base_date = datetime(2024, 3, 1)

for i in range(1, 11):
    date = base_date + timedelta(days=random.randint(0, 30))
    student = random.choice(students)
    track_name = random.choice(track_names)
    
    if i == 3:
        version = "v1.0_旧版母带"
        authorized = True
    elif i == 5:
        version = "v2.0"
        authorized = False
    elif i == 7:
        version = "v2.0"
        authorized = True
    else:
        version = "v2.0"
        authorized = True
    
    data.append({
        "曲目编号": f"TRK{i:03d}",
        "曲目名称": track_name,
        "学生姓名": student,
        "上课日期": date.strftime("%Y-%m-%d"),
        "时长(秒)": random.randint(60, 180),
        "已授权": "是" if authorized else "否",
        "版本": version,
        "备注": f"{student}的{track_name}课堂练习" if i != 8 else "人工改名-原曲目编号TRK006"
    })

data.append({
    "曲目编号": "TRK007",
    "曲目名称": "快乐节拍",
    "学生姓名": "小华",
    "上课日期": "2024-03-15",
    "时长(秒)": 120,
    "已授权": "是",
    "版本": "v2.0",
    "备注": "重复曲目-课堂二次录制"
})

df = pd.DataFrame(data)
output_path = "/Users/lzy/pro/solo/workspaces/zy72146/sample_data/excel/曲目清单.xlsx"
df.to_excel(output_path, index=False, sheet_name="曲目清单")

print(f"样例Excel已创建: {output_path}")
print(f"共 {len(df)} 条记录")
print("\n数据预览:")
print(df.to_string())
