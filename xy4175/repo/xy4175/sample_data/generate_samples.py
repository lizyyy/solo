"""
示例数据生成器
生成各种故障场景的模拟振动数据
"""

import os
from typing import Optional, Tuple
import numpy as np
import pandas as pd
from scipy import signal
from datetime import datetime


def generate_normal_vibration(sampling_rate: int = 25600,
                               duration: float = 10.0,
                               rpm: float = 600.0) -> np.ndarray:
    """
    生成正常振动信号
    
    参数:
        sampling_rate: 采样率
        duration: 持续时间
        rpm: 转速
    
    返回:
        振动信号数组
    """
    n_samples = int(sampling_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    rot_freq = rpm / 60.0
    
    signal_data = np.zeros(n_samples)
    
    for n in range(1, 5):
        signal_data += 0.1 * np.sin(2 * np.pi * n * rot_freq * t)
    
    signal_data += 0.05 * np.random.randn(n_samples)
    
    bearing_noise = 0.02 * np.random.randn(n_samples)
    signal_data += bearing_noise
    
    return signal_data


def generate_spalling_vibration(sampling_rate: int = 25600,
                                 duration: float = 10.0,
                                 rpm: float = 600.0,
                                 spall_severity: float = 0.5) -> np.ndarray:
    """
    生成轻微剥落故障信号（周期性冲击）
    
    参数:
        sampling_rate: 采样率
        duration: 持续时间
        rpm: 转速
        spall_severity: 剥落严重程度 (0-1)
    
    返回:
        振动信号数组
    """
    n_samples = int(sampling_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    rot_freq = rpm / 60.0
    
    bpfo = rot_freq * 8.0
    bpfi = rot_freq * 10.0
    
    signal_data = generate_normal_vibration(sampling_rate, duration, rpm)
    
    impulse_amplitude = 0.5 * spall_severity
    impulse_width = int(0.002 * sampling_rate)
    
    for i in range(int(duration * bpfo)):
        imp_time = i / bpfo
        imp_idx = int(imp_time * sampling_rate)
        
        if 0 <= imp_idx < n_samples - impulse_width:
            decay = np.exp(-np.linspace(0, 0.01, impulse_width) * 500)
            impulse = impulse_amplitude * decay * np.sin(2 * np.pi * 3000 * np.linspace(0, 0.01, impulse_width))
            
            signal_data[imp_idx:imp_idx + impulse_width] += impulse
    
    return signal_data


def generate_sensor_loose_vibration(sampling_rate: int = 25600,
                                     duration: float = 10.0,
                                     rpm: float = 600.0,
                                     looseness_severity: float = 0.6) -> np.ndarray:
    """
    生成传感器松动信号（强谐波成分）
    
    参数:
        sampling_rate: 采样率
        duration: 持续时间
        rpm: 转速
        looseness_severity: 松动严重程度 (0-1)
    
    返回:
        振动信号数组
    """
    n_samples = int(sampling_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    rot_freq = rpm / 60.0
    
    signal_data = generate_normal_vibration(sampling_rate, duration, rpm)
    
    harmonic_amplitude = 0.4 * looseness_severity
    for n in range(1, 6):
        signal_data += harmonic_amplitude / n * np.sin(2 * np.pi * n * rot_freq * t)
    
    modulation = 1 + 0.1 * np.sin(2 * np.pi * 0.5 * t)
    signal_data *= modulation
    
    return signal_data


def generate_mixed_condition_vibration(sampling_rate: int = 25600,
                                        duration: float = 10.0,
                                        base_rpm: float = 600.0) -> Tuple[np.ndarray, np.ndarray]:
    """
    生成工况混杂数据（转速变化）
    
    参数:
        sampling_rate: 采样率
        duration: 持续时间
        base_rpm: 基础转速
    
    返回:
        振动信号数组
    """
    n_samples = int(sampling_rate * duration)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    rpm_profile = base_rpm + 200 * np.sin(2 * np.pi * 0.2 * t)
    
    signal_data = np.zeros(n_samples)
    
    segment_size = int(sampling_rate * 1.0)
    for i in range(0, n_samples, segment_size):
        segment_end = min(i + segment_size, n_samples)
        segment_t = t[i:segment_end]
        
        segment_rpm = np.mean(rpm_profile[i:segment_end])
        rot_freq = segment_rpm / 60.0
        
        for n in range(1, 5):
            signal_data[i:segment_end] += 0.1 * np.sin(2 * np.pi * n * rot_freq * segment_t)
        
        signal_data[i:segment_end] += 0.05 * np.random.randn(segment_end - i)
    
    return signal_data, rpm_profile


def save_to_csv(signal_data: np.ndarray,
                sampling_rate: int,
                filepath: str,
                include_speed: bool = False,
                speed_profile: Optional[np.ndarray] = None):
    """
    保存振动数据到CSV
    
    参数:
        signal_data: 振动信号
        sampling_rate: 采样率
        filepath: 输出文件路径
        include_speed: 是否包含转速
        speed_profile: 转速配置文件
    """
    n_samples = len(signal_data)
    t = np.linspace(0, n_samples / sampling_rate, n_samples, endpoint=False)
    
    df = pd.DataFrame({
        "timestamp": t,
        "vibration": signal_data
    })
    
    if include_speed and speed_profile is not None:
        df["speed"] = speed_profile[:len(df)]
    
    df.to_csv(filepath, index=False)
    print(f"已保存: {filepath}")


def generate_speed_profile(sampling_rate: int = 25600,
                            duration: float = 10.0,
                            base_rpm: float = 600.0,
                            variable: bool = False) -> pd.DataFrame:
    """
    生成转速工况表
    
    参数:
        sampling_rate: 采样率
        duration: 持续时间
        base_rpm: 基础转速
        variable: 是否变速
    
    返回:
        转速DataFrame
    """
    n_samples = int(sampling_rate * duration / 100)
    t = np.linspace(0, duration, n_samples, endpoint=False)
    
    if variable:
        speed = base_rpm + 100 * np.sin(2 * np.pi * 0.1 * t)
    else:
        speed = np.full(n_samples, base_rpm)
    
    df = pd.DataFrame({
        "time": t,
        "speed": speed
    })
    
    return df


def generate_inspection_result(result_type: str, filepath: str):
    """
    生成人工检修结论
    
    参数:
        result_type: 结果类型
        filepath: 输出文件路径
    """
    results = {
        "normal": "正常 - 无明显异常",
        "spalling": "异常 - 检测到轻微剥落特征，建议进一步检查",
        "loose": "异常 - 检测到传感器松动信号，建议检查安装",
        "uncertain": "不确定 - 数据存在工况混杂，建议增加采样"
    }
    
    df = pd.DataFrame({
        "inspection_time": [datetime.now().isoformat()],
        "result": [results.get(result_type, "正常")],
        "comments": [""]
    })
    
    df.to_csv(filepath, index=False)
    print(f"已保存: {filepath}")


def main():
    """
    生成所有示例数据
    """
    sample_dir = os.path.dirname(os.path.abspath(__file__))
    
    sampling_rate = 25600
    duration = 10.0
    
    print("=" * 50)
    print("生成示例数据...")
    print("=" * 50)
    
    print("\n1. 生成正常振动数据 (trip_001)...")
    normal_signal = generate_normal_vibration(sampling_rate, duration, rpm=600.0)
    save_to_csv(normal_signal, sampling_rate, 
                os.path.join(sample_dir, "trip_001_vibration.csv"))
    
    normal_speed = generate_speed_profile(sampling_rate, duration, base_rpm=600.0, variable=False)
    normal_speed.to_csv(os.path.join(sample_dir, "trip_001_speed.csv"), index=False)
    print(f"已保存: {os.path.join(sample_dir, 'trip_001_speed.csv')}")
    
    generate_inspection_result("normal", os.path.join(sample_dir, "trip_001_inspection.csv"))
    
    print("\n2. 生成轻微剥落数据 (trip_002)...")
    spalling_signal = generate_spalling_vibration(sampling_rate, duration, rpm=600.0, spall_severity=0.5)
    save_to_csv(spalling_signal, sampling_rate,
                os.path.join(sample_dir, "trip_002_vibration.csv"))
    
    spalling_speed = generate_speed_profile(sampling_rate, duration, base_rpm=600.0, variable=False)
    spalling_speed.to_csv(os.path.join(sample_dir, "trip_002_speed.csv"), index=False)
    print(f"已保存: {os.path.join(sample_dir, 'trip_002_speed.csv')}")
    
    generate_inspection_result("spalling", os.path.join(sample_dir, "trip_002_inspection.csv"))
    
    print("\n3. 生成传感器松动数据 (trip_003)...")
    loose_signal = generate_sensor_loose_vibration(sampling_rate, duration, rpm=600.0, looseness_severity=0.6)
    save_to_csv(loose_signal, sampling_rate,
                os.path.join(sample_dir, "trip_003_vibration.csv"))
    
    loose_speed = generate_speed_profile(sampling_rate, duration, base_rpm=600.0, variable=False)
    loose_speed.to_csv(os.path.join(sample_dir, "trip_003_speed.csv"), index=False)
    print(f"已保存: {os.path.join(sample_dir, 'trip_003_speed.csv')}")
    
    generate_inspection_result("loose", os.path.join(sample_dir, "trip_003_inspection.csv"))
    
    print("\n4. 生成工况混杂数据 (trip_004)...")
    mixed_signal, speed_profile = generate_mixed_condition_vibration(sampling_rate, duration, base_rpm=600.0)
    save_to_csv(mixed_signal, sampling_rate,
                os.path.join(sample_dir, "trip_004_vibration.csv"),
                include_speed=True, speed_profile=speed_profile)
    
    mixed_speed = generate_speed_profile(sampling_rate, duration, base_rpm=600.0, variable=True)
    mixed_speed.to_csv(os.path.join(sample_dir, "trip_004_speed.csv"), index=False)
    print(f"已保存: {os.path.join(sample_dir, 'trip_004_speed.csv')}")
    
    generate_inspection_result("uncertain", os.path.join(sample_dir, "trip_004_inspection.csv"))
    
    print("\n" + "=" * 50)
    print("示例数据生成完成！")
    print("=" * 50)
    print("\n生成的文件:")
    for f in os.listdir(sample_dir):
        if f.endswith(".csv"):
            print(f"  - {f}")


if __name__ == "__main__":
    main()
