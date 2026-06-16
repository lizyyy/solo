import struct
import os
from pathlib import Path

def create_valid_wav(file_path, duration_seconds=2, sample_rate=44100, num_channels=1, bits_per_sample=16):
    """创建一个有合法WAV头的有效音频文件"""
    num_samples = duration_seconds * sample_rate
    byte_rate = sample_rate * num_channels * bits_per_sample // 8
    data_size = num_samples * num_channels * bits_per_sample // 8
    chunk_size = 36 + data_size

    with open(file_path, 'wb') as f:
        f.write(b'RIFF')
        f.write(struct.pack('<I', chunk_size))
        f.write(b'WAVE')
        f.write(b'fmt ')
        f.write(struct.pack('<I', 16))
        f.write(struct.pack('<H', 1))
        f.write(struct.pack('<H', num_channels))
        f.write(struct.pack('<I', sample_rate))
        f.write(struct.pack('<I', byte_rate))
        f.write(struct.pack('<H', num_channels * bits_per_sample // 8))
        f.write(struct.pack('<H', bits_per_sample))
        f.write(b'data')
        f.write(struct.pack('<I', data_size))
        silence = b'\x00' * data_size
        f.write(silence)

audio_dir = Path("/Users/lzy/pro/solo/workspaces/zy72146/sample_data/audio")

valid_files = [
    "TRK001_小星星变奏曲_小明.wav",
    "TRK002_童年记忆_小红.mp3",
    "TRK004_小星星变奏曲_小明.wav",
    "TRK006_快乐节拍_小强.wav",
    "TRK007_跳跃的音符_小强.wav",
    "TRK008_欢快的节奏_小明.wav",
]

corrupted_files = [
    "TRK003_森林鼓点_小明_old.wav",
    "TRK005_小星星变奏曲_小红.wav",
    "TRK007_快乐节拍_小华.wav",
    "corrupted_file.wav",
]

print("=== 生成可用音频文件（6条）===")
for filename in valid_files:
    filepath = audio_dir / filename
    if filepath.suffix == '.wav':
        create_valid_wav(filepath, duration_seconds=3)
        size = filepath.stat().st_size
        print(f"  ✅ {filename} ({size} bytes) - WAV格式")
    elif filepath.suffix == '.mp3':
        with open(filepath, 'wb') as f:
            f.write(b'\xff\xfb\x90\x64')
            f.write(b'\x00' * 1024)
        size = filepath.stat().st_size
        print(f"  ✅ {filename} ({size} bytes) - MP3格式")

print("\n=== 保留损坏音频文件（4条）===")
for filename in corrupted_files:
    filepath = audio_dir / filename
    if filepath.exists():
        os.remove(filepath)
    filepath.touch()
    print(f"  ❌ {filename} (0 bytes) - 已标记为损坏")

print("\n完成！")
print(f"  可用音频: {len(valid_files)} 条")
print(f"  损坏音频: {len(corrupted_files)} 条")
