import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os


def create_sample_data(output_dir: str = "./output") -> str:
    os.makedirs(output_dir, exist_ok=True)
    
    np.random.seed(42)
    
    angles = np.linspace(-10, 25, 30)
    base_lift = 0.1 * np.sin(np.radians(angles * 2.5)) + 0.02 * angles / 10
    lift_coeffs = base_lift + np.random.normal(0, 0.005, size=len(angles))
    
    outlier_idx = [7, 15, 23]
    for idx in outlier_idx:
        lift_coeffs[idx] += 0.08
    
    wind_speeds = np.random.uniform(5, 15, size=len(angles))
    
    start_time = datetime(2024, 6, 15, 8, 0, 0)
    times = [start_time + timedelta(minutes=5 * i) for i in range(len(angles))]
    
    equipment_ids = [f"EQ-{1001 + (i % 5)}" for i in range(len(angles))]
    equipment_names = [f"风帆实验组-{1 + (i % 5)}号" for i in range(len(angles))]
    
    nameplate_fields = {
        "铭牌_额定功率": "15kW",
        "铭牌_额定风速": "12m/s",
        "铭牌_叶片数量": "3",
        "铭牌_厂家": "风帆科技有限公司",
        "铭牌_出厂日期": "2023-11-20",
    }
    
    data = []
    for i in range(len(angles)):
        row = {
            "设备ID": equipment_ids[i],
            "设备名称": equipment_names[i],
            "攻角": round(angles[i], 2),
            "升力系数": round(lift_coeffs[i], 4),
            "风速": round(wind_speeds[i], 2),
            "原始值": round(lift_coeffs[i], 4),
            "测量时间": times[i].strftime("%Y-%m-%d %H:%M:%S"),
            "备注": "例行检测" if i not in outlier_idx else "数据异常待确认",
        }
        for k, v in nameplate_fields.items():
            row[k] = v
        data.append(row)
    
    df = pd.DataFrame(data)
    
    output_path = os.path.join(output_dir, "sample_equipment_data.csv")
    df.to_csv(output_path, index=False, encoding="utf-8-sig")
    
    return output_path
