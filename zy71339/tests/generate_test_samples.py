#!/usr/bin/env python3
"""生成测试音频样本"""

import numpy as np
from pathlib import Path
import soundfile as sf


def generate_sine_wave(freq: float, duration: float, sr: int = 22050, amplitude: float = 0.5) -> np.ndarray:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return amplitude * np.sin(2 * np.pi * freq * t)


def generate_drum_like(duration: float = 0.5, sr: int = 22050) -> np.ndarray:
    """生成类似鼓的短促、高频冲击声"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    envelope = np.exp(-8 * t)
    noise = np.random.randn(len(t)) * 0.3
    sine = 0.5 * np.sin(2 * np.pi * 150 * t)
    return envelope * (sine + noise)


def generate_bass_like(duration: float = 1.0, sr: int = 22050) -> np.ndarray:
    """生成类似贝斯的低频持续声"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    envelope = np.minimum(1.0, np.exp(-2 * t) + 0.3)
    bass = 0.6 * np.sin(2 * np.pi * 80 * t)
    return envelope * bass


def generate_ambient_like(duration: float = 3.0, sr: int = 22050) -> np.ndarray:
    """生成类似环境声的平缓声音"""
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    filtered_noise = np.convolve(np.random.randn(len(t) + 1000), np.hanning(1000), mode='valid')
    filtered_noise = filtered_noise[:len(t)] / np.max(np.abs(filtered_noise)) * 0.3
    pad_sine = 0.2 * np.sin(2 * np.pi * 440 * t) + 0.15 * np.sin(2 * np.pi * 660 * t)
    return filtered_noise + pad_sine


def generate_silence(duration: float = 1.0, sr: int = 22050) -> np.ndarray:
    """生成静音"""
    return np.zeros(int(sr * duration)) + 0.001 * np.random.randn(int(sr * duration))


def generate_noise_like(duration: float = 1.0, sr: int = 22050) -> np.ndarray:
    """生成可疑噪声（类似白噪声）"""
    return 0.3 * np.random.randn(int(sr * duration))


def save_sample(audio: np.ndarray, path: Path, sr: int = 22050):
    path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(path), audio, sr)


def generate_test_samples(output_dir: Path):
    """生成测试样本集，包含重复编号的情况"""
    output_dir = Path(output_dir)
    
    sr = 22050
    
    drum1 = generate_drum_like(0.3, sr)
    drum2 = generate_drum_like(0.4, sr)
    bass1 = generate_bass_like(1.5, sr)
    bass2 = generate_bass_like(1.2, sr)
    ambient1 = generate_ambient_like(2.0, sr)
    silence1 = generate_silence(2.0, sr)
    noise1 = generate_noise_like(1.0, sr)
    
    save_sample(drum1, output_dir / "kick_001.wav", sr)
    save_sample(drum2, output_dir / "snare_002.wav", sr)
    save_sample(bass1, output_dir / "bass_sub_003.wav", sr)
    save_sample(ambient1, output_dir / "pad_ambient_004.wav", sr)
    save_sample(silence1, output_dir / "silent_sample.wav", sr)
    save_sample(noise1, output_dir / "weird_noise.wav", sr)
    
    save_sample(bass1, output_dir / "duplicates" / "bass_sub_003_copy.wav", sr)
    save_sample(bass1, output_dir / "duplicates" / "bass_sub_003_dup.wav", sr)
    
    save_sample(drum1, output_dir / "duplicates" / "sample_001_kick.wav", sr)
    save_sample(drum1, output_dir / "other_folder" / "sample_001_kick.wav", sr)
    
    save_sample(bass2, output_dir / "808_bass.wav", sr)
    save_sample(generate_drum_like(0.35, sr), output_dir / "hihat_closed.wav", sr)
    
    print(f"测试样本已生成到: {output_dir}")
    print(f"共生成 10 个文件，其中包含:")
    print(f"  - 鼓样本: 4 个")
    print(f"  - 贝斯样本: 2 个")
    print(f"  - 环境声: 1 个")
    print(f"  - 静音: 1 个")
    print(f"  - 可疑噪声: 1 个")
    print(f"  - 重复编号样本组 (001, 003): 用于验证重复检测")


if __name__ == "__main__":
    output_path = Path(__file__).parent.parent / "test_data" / "samples"
    generate_test_samples(output_path)
