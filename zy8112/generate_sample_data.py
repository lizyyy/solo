"""生成示例波形数据脚本"""

import os
import numpy as np
import pandas as pd
from datetime import datetime, timedelta


def generate_ricker_wavelet(f0: float, t: np.ndarray, t0: float = 0.0) -> np.ndarray:
    """
    生成Ricker小波（墨西哥帽小波）
    
    Args:
        f0: 主频 (Hz)
        t: 时间轴
        t0: 峰值时间
        
    Returns:
        Ricker小波数组
    """
    a = (np.pi * f0 * (t - t0))**2
    return (1 - 2 * a) * np.exp(-a)


def generate_waveform_data(output_dir: str):
    """生成示例波形数据"""
    
    # 台站信息 (对应 stations.csv)
    stations = {
        'STA001': (0, 0, 0),
        'STA002': (500, 0, 0),
        'STA003': (0, 500, 0),
        'STA004': (500, 500, 0),
        'STA005': (250, 250, -200),
        'STA006': (1000, 500, -100)  # 有波形但无台站配置的情况（用于测试缺台站）
    }
    
    # 假设事件位置
    event_x, event_y, event_z = 250, 250, -500
    velocity = 5000.0  # m/s
    
    # 采样参数
    sampling_rate = 1000.0
    dt = 1.0 / sampling_rate
    duration = 2.0  # 秒
    n_samples = int(duration * sampling_rate)
    
    # 时间轴
    t = np.arange(n_samples) * dt
    
    # 为每个台站生成波形
    np.random.seed(42)  # 固定随机种子以确保可复现
    
    for station_id, (x, y, z) in stations.items():
        # 计算距离和走时
        distance = np.sqrt(
            (event_x - x)**2 + 
            (event_y - y)**2 + 
            (event_z - z)**2
        )
        travel_time = distance / velocity
        
        # 生成噪声
        noise = np.random.normal(0, 0.1, n_samples)
        
        # 生成P波信号（Ricker小波）
        f0 = 50.0  # 主频
        ricker = generate_ricker_wavelet(f0, t, t0=travel_time)
        
        # 调整振幅（距离衰减）
        amplitude = 1.0 / (distance + 1) * 10
        signal = ricker * amplitude
        
        # 组合信号和噪声
        data = noise + signal
        
        # 创建DataFrame
        df = pd.DataFrame({
            'time': t,
            'velocity': data
        })
        
        # 保存为CSV
        filename = f"{station_id}.csv"
        filepath = os.path.join(output_dir, filename)
        df.to_csv(filepath, index=False)
        
        print(f"已生成: {filename} (距离: {distance:.1f}m, 走时: {travel_time:.4f}s)")
    
    # 生成一个跨午夜的波形（用于测试边界处理）
    print("\n生成跨午夜测试波形...")
    
    # 创建一个从23:59:00开始的波形
    start_time = datetime(2024, 1, 1, 23, 59, 0)
    
    # 生成更长的波形，跨越午夜
    long_duration = 120.0  # 2分钟
    long_n_samples = int(long_duration * sampling_rate)
    long_t = np.arange(long_n_samples) * dt
    
    # 生成绝对时间列
    absolute_times = [start_time + timedelta(seconds=ts) for ts in long_t]
    
    # 生成噪声
    long_noise = np.random.normal(0, 0.1, long_n_samples)
    
    # 在午夜前后生成信号
    # 午夜在 60秒 处
    midnight_signal = generate_ricker_wavelet(30.0, long_t, t0=60.0) * 5.0
    
    long_data = long_noise + midnight_signal
    
    # 创建DataFrame
    df_midnight = pd.DataFrame({
        'timestamp': absolute_times,
        'velocity': long_data
    })
    
    midnight_filepath = os.path.join(output_dir, "STA_MIDNIGHT.csv")
    df_midnight.to_csv(midnight_filepath, index=False)
    print(f"已生成跨午夜测试波形: STA_MIDNIGHT.csv (起始时间: {start_time})")
    
    print("\n示例数据生成完成！")


if __name__ == "__main__":
    # 获取当前脚本所在目录
    script_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(script_dir, "sample_data", "waveforms")
    
    # 确保输出目录存在
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"生成示例数据到: {output_dir}")
    print("=" * 60)
    
    generate_waveform_data(output_dir)
