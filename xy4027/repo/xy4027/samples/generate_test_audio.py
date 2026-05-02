#!/usr/bin/env python3
"""
生成测试用音频文件
用于验证"口播脱敏剪刀"的核心功能
"""

import wave
import struct
import math
import os


def generate_beep(duration_ms: int, frequency: int = 800, sample_rate: int = 44100) -> bytes:
    """生成单音信号"""
    num_samples = int(duration_ms / 1000.0 * sample_rate)
    amplitude = 32767
    
    samples = []
    for i in range(num_samples):
        t = i / sample_rate
        value = int(amplitude * math.sin(2 * math.pi * frequency * t))
        samples.append(value)
    
    raw_data = b''.join(struct.pack('<h', s) for s in samples)
    return raw_data


def generate_silence(duration_ms: int, sample_rate: int = 44100) -> bytes:
    """生成静音"""
    num_samples = int(duration_ms / 1000.0 * sample_rate)
    raw_data = b'\x00\x00' * num_samples
    return raw_data


def create_test_audio(output_path: str, sample_rate: int = 44100, channels: int = 2):
    """
    创建测试音频文件（约65秒）
    
    音频结构：
    - 0-5秒: 提示音（低频率）
    - 5-12秒: 静音
    - 12-18秒: 敏感内容提示音（中频率）- 手机号
    - 18-24秒: 敏感内容提示音（中频率）- 邮箱
    - 24-30秒: 敏感内容提示音（高频率）- 身份证号
    - 30-36秒: 敏感内容提示音（高频率）- 银行卡号
    - 36-42秒: 敏感内容提示音（中频率）- 地址
    - 42-48秒: 敏感内容提示音（中频率）- 地址
    - 48-54秒: 敏感内容提示音（高频率）- 客户信息
    - 54-60秒: 敏感内容提示音（中频率）- 合同编号
    - 60-65秒: 结束提示音
    """
    
    segments = [
        (0, 5000, 400),
        (5000, 12000, 0),
        (12000, 18000, 600),
        (18000, 24000, 650),
        (24000, 30000, 800),
        (30000, 36000, 850),
        (36000, 42000, 700),
        (42000, 48000, 700),
        (48000, 54000, 900),
        (54000, 60000, 750),
        (60000, 65000, 450),
    ]
    
    total_duration = 65000
    
    all_data = generate_silence(total_duration, sample_rate)
    samples_per_ms = sample_rate // 1000
    
    data_list = list(struct.unpack(f'<{len(all_data)//2}h', all_data))
    
    for start_ms, end_ms, freq in segments:
        if freq == 0:
            continue
        
        start_sample = start_ms * samples_per_ms * channels
        duration_ms = end_ms - start_ms
        
        beep_data = generate_beep(duration_ms, freq, sample_rate)
        beep_samples = list(struct.unpack(f'<{len(beep_data)//2}h', beep_data))
        
        for i in range(len(beep_samples) // channels):
            for ch in range(channels):
                if start_sample + i * channels + ch < len(data_list):
                    data_list[start_sample + i * channels + ch] = beep_samples[i]
    
    final_data = b''.join(struct.pack('<h', s) for s in data_list)
    
    with wave.open(output_path, 'w') as wav_file:
        wav_file.setnchannels(channels)
        wav_file.setsampwidth(2)
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(final_data)
    
    return output_path


if __name__ == "__main__":
    script_dir = os.path.dirname(os.path.abspath(__file__))
    
    wav_path = os.path.join(script_dir, "test_audio.wav")
    create_test_audio(wav_path)
    
    print(f"测试音频已生成: {wav_path}")
    print(f"时长: 约 65 秒")
    print("")
    print("使用说明：")
    print("1. 此音频包含多个频率不同的提示音段")
    print("2. 配合 samples/test_sample.srt 使用时")
    print("3. 每个提示音段对应 SRT 文件中的一个敏感内容片段")
    print("")
    print("时间轴对应关系：")
    print("  12.5-18s  → 手机号: 13812345678")
    print("  18.5-24s  → 邮箱: zhangsan@example.com")
    print("  24.5-30s  → 身份证号: 110101199001011234")
    print("  30.5-36s  → 银行卡号: 6222021234567890123")
    print("  36.5-42s  → 地址: 北京市朝阳区建国路88号SOHO现代城")
    print("  42.5-48s  → 地址: 上海市浦东新区张江高科技园区博云路2号")
    print("  48.5-54s  → 客户信息: 李四 15987654321 lisi@company.org")
    print("  54.5-60s  → 合同编号: HT2024001")
