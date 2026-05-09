"""生成示例测试数据。"""

import pandas as pd
import numpy as np
from pathlib import Path


def generate_sample_data(output_dir: str = "sample_data") -> None:
    """生成示例测试数据。"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    np.random.seed(42)
    
    n_batteries = 8
    n_cycles = 300
    
    all_data = []
    
    base_capacities = [2050, 2020, 1980, 2010, 2030, 1990, 2040, 2000]
    fade_rates = [0.08, 0.06, 0.10, 0.05, 0.07, 0.09, 0.06, 0.08]
    
    for i, (base_cap, fade_rate) in enumerate(zip(base_capacities, fade_rates)):
        battery_id = f"CELL_{i+1:03d}"
        
        for cycle in range(1, n_cycles + 1):
            capacity = base_cap * (1 - (fade_rate / 100) * (cycle ** 0.5))
            noise = np.random.normal(0, base_cap * 0.002)
            capacity += noise
            
            capacity = max(capacity, base_cap * 0.6)
            
            all_data.append({
                "电池编号": battery_id,
                "循环次数": cycle,
                "容量": round(capacity, 2),
                "批次": "BATCH_001"
            })
    
    df1 = pd.DataFrame(all_data)
    
    bad_cycle_mask = (df1['电池编号'] == 'CELL_005') & (df1['循环次数'] == 150)
    if bad_cycle_mask.any():
        df1.loc[bad_cycle_mask, '容量'] = 500
    
    duplicate_mask = (df1['电池编号'] == 'CELL_003') & (df1['循环次数'] == 100)
    if duplicate_mask.any():
        duplicate_row = df1[duplicate_mask].iloc[0]
        df1 = pd.concat([df1, pd.DataFrame([duplicate_row])], ignore_index=True)
    
    missing_mask = (df1['电池编号'] == 'CELL_004') & (df1['循环次数'] >= 250)
    if missing_mask.any():
        df1.loc[missing_mask, '容量'] = np.nan
    
    outlier_mask = (df1['电池编号'] == 'CELL_006') & (df1['循环次数'] == 200)
    if outlier_mask.any():
        df1.loc[outlier_mask, '容量'] = 2500
    
    csv_path = output_path / "battery_data_1.csv"
    df1.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"生成文件: {csv_path}")
    
    df2_data = []
    for i, (base_cap, fade_rate) in enumerate(zip(base_capacities[:4], fade_rates[:4])):
        battery_id = f"CELL_{i+5:03d}"
        for cycle in range(1, 200):
            capacity = base_cap * (1 - (fade_rate / 100) * (cycle ** 0.5))
            capacity += np.random.normal(0, base_cap * 0.002)
            capacity = max(capacity, base_cap * 0.6)
            df2_data.append({
                "电池编号": battery_id,
                "循环次数": cycle,
                "容量": round(capacity, 2),
                "批次": "BATCH_001"
            })
    
    df2 = pd.DataFrame(df2_data)
    
    excel_path = output_path / "battery_data_2.xlsx"
    df2.to_excel(excel_path, index=False)
    print(f"生成文件: {excel_path}")
    
    df3_data = []
    for cycle in range(1, 101):
        df3_data.append({
            "循环": cycle,
            "capacity": round(2.05 * (0.998 ** (cycle ** 0.5)), 4),
            "battery_id": "TEST_01",
        })
    
    df3 = pd.DataFrame(df3_data)
    
    json_path = output_path / "battery_data_3.json"
    df3.to_json(json_path, orient='records', force_ascii=False)
    print(f"生成文件: {json_path}")
    
    print(f"\n示例数据已生成到: {output_path}/")
    print(f"共生成 {len(list(output_path.iterdir()))} 个文件")
    print("包含问题类型:")
    print("  - 格式不一致 (CSV, Excel, JSON)")
    print("  - 单位不一致 (mAh, Ah)")
    print("  - 重复数据")
    print("  - 缺失数据")
    print("  - 异常值")
    print("  - 容量骤降")


if __name__ == "__main__":
    generate_sample_data()
