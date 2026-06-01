import pandas as pd
import numpy as np
from pathlib import Path


def generate_sample_data():
    np.random.seed(42)
    
    n_points = 30
    
    reference_values = np.linspace(10, 500, n_points)
    
    bias = 2.5
    scale_error = 1.003
    noise_std = 0.8
    
    raw_values = (reference_values - bias) / scale_error + np.random.normal(0, noise_std, n_points)
    
    directions = ['正向', '反向'] * (n_points // 2)
    if n_points % 2:
        directions.append('正向')
    
    timestamps = pd.date_range('2024-01-15 10:00:00', periods=n_points, freq='2min')
    
    temperatures = np.random.normal(25, 2, n_points)
    humidity = np.random.normal(60, 5, n_points)
    
    df = pd.DataFrame({
        '时间': timestamps,
        '原始值': np.round(raw_values, 3),
        '标准值': np.round(reference_values, 3),
        '方向': directions,
        '温度': np.round(temperatures, 1),
        '湿度': np.round(humidity, 1),
        '设备号': 'LASER-001',
        '操作人员': '何工'
    })
    
    df.loc[5, '原始值'] = np.nan
    df.loc[12, '温度'] = np.nan
    
    df = pd.concat([df, df.iloc[[20]]], ignore_index=True)
    
    df.loc[25, '原始值'] = 495.0
    df.loc[26, '原始值'] = 12.0
    
    df.loc[15, '方向'] = '未知'
    
    output_path = Path('data') / 'laser_calibration_sample.xlsx'
    df.to_excel(output_path, index=False)
    
    print(f"示例数据已生成: {output_path}")
    print(f"数据形状: {df.shape}")
    print(f"\n数据预览:")
    print(df.head(10))
    print(f"\n空值统计:")
    print(df.isnull().sum())
    print(f"\n重复行数: {df.duplicated().sum()}")
    
    return df


def generate_wechat_sample():
    wechat_text = """何工 10:10:15
刚才测的第5点距离是105mm，正向

张工 10:12:20
收到，我这边记录是100mm，是不是单位错了？

何工 10:15:00
哦不对，应该是10.5cm！

何工 10:30:30
第10点距离200.5mm，正向，温度有点高

李工 10:35:00
@何工 第15点我测的反向是300mm，你那边多少？

何工 10:40:00
第15点反向310mm，差了10mm啊
"""
    
    output_path = Path('data') / 'wechat_sample.txt'
    with open(output_path, 'w', encoding='utf-8') as f:
        f.write(wechat_text)
    
    print(f"\n微信群示例已生成: {output_path}")
    return wechat_text


if __name__ == '__main__':
    Path('data').mkdir(exist_ok=True)
    generate_sample_data()
    generate_wechat_sample()
