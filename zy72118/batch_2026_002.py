import pandas as pd
import numpy as np
from pathlib import Path


def generate_batch_2026_002():
    """
    BATCH-2026-002 返工样例:
    - 3 条预置冲突（其中 1 条方向冲突 DIR=CCW vs 正向）
    - 完整数据可触发数值差异 + 方向冲突
    - 数据中包含 CW / CCW 标准方向，与微信群正向/反向记录对比时必然冲突
    """
    np.random.seed(1002)
    n_points = 31
    ref_values = np.linspace(50, 450, n_points)
    
    bias = 3.2
    scale = 0.997
    raw_values = (ref_values - bias) / scale + np.random.normal(0, 0.9, n_points)
    
    directions = ['CW', 'CCW'] * (n_points // 2)
    if n_points % 2:
        directions.append('CW')
    
    timestamps = pd.to_datetime([
        '2024-01-15 10:00:00',  # 0
        '2024-01-15 10:05:00',  # 1
        '2024-01-15 10:10:00',  # 2 ← 何工 DIR=CW 120mm（精确匹配）
        '2024-01-15 10:15:00',  # 3
        '2024-01-15 10:20:00',  # 4 ← 李工 DIR=正向 180mm（精确匹配，数据=CCW → 方向冲突）
        '2024-01-15 10:25:00',  # 5
        '2024-01-15 10:30:00',  # 6 ← 何工 DIR=CCW 260mm（精确匹配，数据=CW → 方向冲突）
        '2024-01-15 10:35:00',  # 7
        '2024-01-15 10:40:00',  # 8 ← 张工 310mm（无方向）
        '2024-01-15 10:45:00',  # 9
        '2024-01-15 10:50:00',  # 10 ← 王工 DIR=反向 380mm（精确匹配，数据=CW → 方向冲突）
        '2024-01-15 10:55:00',  # 11
        '2024-01-15 11:00:00',  # 12
    ] + pd.date_range('2024-01-15 11:05:00', periods=n_points - 13, freq='5min').tolist())
    
    df = pd.DataFrame({
        '时间': timestamps,
        '原始值': np.round(raw_values, 3),
        '标准值': np.round(ref_values, 3),
        '方向': directions,
        '批次号': 'BATCH-2026-002'
    })
    
    # 预置问题行
    df.loc[5, '原始值'] = np.nan           # 空值
    df.loc[10, '原始值'] = 9999.0         # 明显异常值
    df.loc[20, '方向'] = 'UNKNOWN'         # 未知方向
    
    output = Path('data') / 'BATCH-2026-002_experiment.xlsx'
    df.to_excel(output, index=False)
    print(f"✅ BATCH-2026-002 实验数据: {output}")
    print(f"   形状 {df.shape} | 方向值 {df['方向'].unique().tolist()}")
    return df


def generate_batch_2026_002_wechat():
    """
    BATCH-2026-002 微信群记录:
    1. 10:10:00 何工 第5点 DIR=CW 120mm —— 数据中 10:10 是 CW 120mm（数值约 118，会产生数值差异）
    2. 10:20:00 李工 第10点 DIR=正向 180mm —— 数据中 10:20 是 CCW（方向冲突）
    3. 10:30:00 何工 第15点 DIR=CCW 260mm —— 数据中 10:30 是 CW（方向冲突）
    4. 10:40:00 张工 第20点 距离310mm —— 数据中是 UNKNOWN 方向 + 数值异常
    5. 10:50:00 王工 第25点 距离380mm DIR=反向 —— 数据中是 CW（方向冲突）
    """
    wechat_text = """何工 10:10:00
第5点测好了，DIR=CW 距离120mm

李工 10:20:00
第10点我这边DIR=正向，数值180mm，大家核对下

何工 10:30:00
第15点，DIR=CCW 260mm，跟上午有点偏差

张工 10:40:00
第20点，距离310mm，方向还没标

王工 10:50:00
第25点 DIR=反向 380mm，跟系统差有点大，谁再确认一下
"""
    output = Path('data') / 'BATCH-2026-002_wechat.txt'
    with open(output, 'w', encoding='utf-8') as f:
        f.write(wechat_text)
    print(f"✅ BATCH-2026-002 微信群记录: {output}")
    return wechat_text


if __name__ == '__main__':
    Path('data').mkdir(exist_ok=True)
    generate_batch_2026_002()
    generate_batch_2026_002_wechat()
