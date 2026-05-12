"""生成示例测试数据。"""

import pandas as pd
import numpy as np
from pathlib import Path


def generate_sample_data(output_dir: str = "sample_data") -> None:
    """
    生成示例测试数据。
    
    数据设计说明：
    - CSV/Excel: 使用 mAh 单位（数值约 2000 左右）
    - JSON: 使用 Ah 单位但带显式字符串（如 "2.05 Ah"），测试解析能力
    - 故意注入各种问题场景用于测试
    """
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    np.random.seed(42)
    
    n_batteries = 6
    n_cycles = 300
    
    all_data = []
    
    base_capacities = [2050, 2020, 1980, 2010, 2030, 1990]
    fade_rates = [0.08, 0.06, 0.10, 0.05, 0.07, 0.09]
    
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
        duplicate_row = df1[duplicate_mask].iloc[0].copy()
        df1 = pd.concat([df1, pd.DataFrame([duplicate_row])], ignore_index=True)
    
    missing_mask = (df1['电池编号'] == 'CELL_004') & (df1['循环次数'] >= 250)
    if missing_mask.any():
        df1.loc[missing_mask, '容量'] = np.nan
    
    outlier_mask = (df1['电池编号'] == 'CELL_006') & (df1['循环次数'] == 200)
    if outlier_mask.any():
        df1.loc[outlier_mask, '容量'] = 2500
    
    csv_path = output_path / "battery_data_1.csv"
    df1.to_csv(csv_path, index=False, encoding='utf-8-sig')
    print(f"生成文件: {csv_path} (mAh 数值)")
    
    df2_data = []
    df2_base = [2040, 2000, 2060, 2020]
    df2_fade = [0.055, 0.065, 0.075, 0.05]
    
    for i, (base_cap, fade_rate) in enumerate(zip(df2_base, df2_fade)):
        battery_id = f"CELL_{i+7:03d}"
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
    print(f"生成文件: {excel_path} (mAh 数值)")
    
    df3_data = []
    base_cap_ah = 2.05
    for cycle in range(1, 101):
        capacity_ah = base_cap_ah * (0.997 ** (cycle ** 0.5))
        df3_data.append({
            "循环": cycle,
            "capacity": f"{capacity_ah:.4f} Ah",
            "battery_id": "TEST_Ah_01",
        })
    
    df3 = pd.DataFrame(df3_data)
    
    json_path = output_path / "battery_data_3.json"
    df3.to_json(json_path, orient='records', force_ascii=False)
    print(f"生成文件: {json_path} (带显式单位 'Ah' 字符串，测试解析)")
    
    df4_data = []
    for cycle in range(1, 81):
        capacity_mah = 2200 * (0.996 ** (cycle ** 0.5))
        df4_data.append({
            "循环次数": cycle,
            "容量": f"{capacity_mah:.2f} mAh",
            "电池编号": "TEST_mAh_01",
            "批次": "BATCH_001"
        })
    
    df4 = pd.DataFrame(df4_data)
    csv2_path = output_path / "battery_data_4_with_unit.csv"
    df4.to_csv(csv2_path, index=False, encoding='utf-8-sig')
    print(f"生成文件: {csv2_path} (带显式单位 'mAh' 字符串)")
    
    print(f"\n示例数据已生成到: {output_path}/")
    print(f"共生成 {len(list(output_path.iterdir()))} 个文件")
    print("\n数据内容说明:")
    print("  - battery_data_1.csv: 6个电池，300循环，包含各种问题")
    print("    * CELL_005: 循环150有容量骤降 (500 mAh)")
    print("    * CELL_003: 循环100有重复记录")
    print("    * CELL_004: 循环250+有缺失值")
    print("    * CELL_006: 循环200有异常值 (2500 mAh)")
    print("  - battery_data_2.xlsx: 4个电池，200循环，正常数据")
    print("  - battery_data_3.json: 1个电池，带显式 'Ah' 单位字符串")
    print("  - battery_data_4_with_unit.csv: 1个电池，带显式 'mAh' 单位字符串")
    print("\n包含的测试场景:")
    print("  - 格式不一致 (CSV, Excel, JSON)")
    print("  - 数值单位和字符串单位混合")
    print("  - 重复数据检测")
    print("  - 缺失数据处理")
    print("  - 异常值检测")
    print("  - 容量骤降检测")
    print("  - Ah 到 mAh 的单位转换")


if __name__ == "__main__":
    generate_sample_data()
