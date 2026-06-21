import pandas as pd
import numpy as np
from pathlib import Path


def generate_batch_2026_002():
    """
    BATCH-2026-002 返工样例:
    数据方向序列 (CW=正向, CCW=反向) 与微信群记录的对比如下:

    时间戳        索引  数据方向   微信群记录方向        结果
    10:10:00      2     CW        CW (何工)            ✅ 一致
    10:20:00      4     CCW       正向 (李工)          ❌ 冲突 (反向 vs 正向)
    10:30:00      6     CW        CCW (何工)           ❌ 冲突 (正向 vs 反向)
    10:40:00      8     CW        None (张工)          ⚠️ 微信方向缺失(low)
    10:50:00      10    CW        反向 (王工)          ❌ 冲突 (正向 vs 反向)

    预置:
    - 1 条空值 (索引 5)
    - 1 条异常值 (索引 10)
    - 1 条未知方向 UNKNOWN (索引 20)
    """
    np.random.seed(1002)
    n_points = 31
    ref_values = np.linspace(50, 450, n_points)

    bias = 3.2
    scale = 0.997
    raw_values = (ref_values - bias) / scale + np.random.normal(0, 0.9, n_points)

    #       0:00, 0:05, 0:10(CW), 0:15, 0:20(CCW-conflict),
    #       0:25, 0:30(CW-conflict), 0:35, 0:40(CW-no-wechat-dir),
    #       0:45, 0:50(CW-conflict), 0:55, 11:00
    directions_prefix = [
        'CW',   # 0  10:00
        'CCW',  # 1  10:05
        'CW',   # 2  10:10  ← 微信 CW，一致
        'CCW',  # 3  10:15
        'CCW',  # 4  10:20  ← 微信 正向 (反向 vs 正向，冲突！)
        'CW',   # 5  10:25
        'CW',   # 6  10:30  ← 微信 CCW (正向 vs 反向，冲突！)
        'CCW',  # 7  10:35
        'CW',   # 8  10:40  ← 微信 None (微信方向缺失，low)
        'CCW',  # 9  10:45
        'CW',   # 10 10:50  ← 微信 反向 (正向 vs 反向，冲突！)
        'CCW',  # 11 10:55
        'CW',   # 12 11:00
    ]
    remaining_len = n_points - len(directions_prefix)
    tail = ['CW', 'CCW'] * ((remaining_len // 2) + 1)
    directions = directions_prefix + tail[:remaining_len]
    # 把 20 号位置改成未知方向
    if len(directions) > 20:
        directions[20] = 'UNKNOWN'

    timestamps = pd.to_datetime([
        '2024-01-15 10:00:00',  # 0
        '2024-01-15 10:05:00',  # 1
        '2024-01-15 10:10:00',  # 2
        '2024-01-15 10:15:00',  # 3
        '2024-01-15 10:20:00',  # 4 ← 李工 正向 vs 数据 CCW
        '2024-01-15 10:25:00',  # 5
        '2024-01-15 10:30:00',  # 6 ← 何工 CCW vs 数据 CW
        '2024-01-15 10:35:00',  # 7
        '2024-01-15 10:40:00',  # 8 ← 张工 None vs 数据 CW (微信方向缺失)
        '2024-01-15 10:45:00',  # 9
        '2024-01-15 10:50:00',  # 10 ← 王工 反向 vs 数据 CW
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

    output = Path('data') / 'BATCH-2026-002_experiment.xlsx'
    df.to_excel(output, index=False)
    print(f"✅ BATCH-2026-002 实验数据: {output}")
    print(f"   形状 {df.shape}")
    print(f"   关键时间-方向:")
    for t in ['2024-01-15 10:10:00', '2024-01-15 10:20:00',
              '2024-01-15 10:30:00', '2024-01-15 10:40:00',
              '2024-01-15 10:50:00']:
        row = df[df['时间'] == t].iloc[0]
        print(f"     {t[11:]}  方向={row['方向']}  原始值={row['原始值']}")
    return df


def generate_batch_2026_002_wechat():
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


def print_expected_conflicts():
    print("\n📋 预置方向冲突证据（检测结果必须与此匹配）:")
    print("  1. 10:20 李工 正向(微信) vs CCW(数据)  → 方向冲突 (high)")
    print("  2. 10:30 何工 CCW(微信)  vs CW(数据)   → 方向冲突 (high)")
    print("  3. 10:50 王工 反向(微信) vs CW(数据)   → 方向冲突 (high)")
    print("  4. 10:40 张工 None(微信) vs CW(数据)   → 微信方向缺失 (low) ✖ 绝不能算方向冲突")
    print("  5. 10:10 何工 CW(微信)   vs CW(数据)   → 一致，无冲突")


if __name__ == '__main__':
    Path('data').mkdir(exist_ok=True)
    generate_batch_2026_002()
    generate_batch_2026_002_wechat()
    print_expected_conflicts()
