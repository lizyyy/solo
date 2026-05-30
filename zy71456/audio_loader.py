import os
import numpy as np
import soundfile as sf
from typing import Tuple, Dict, Any
from config import MIN_SAMPLE_RATE, MAX_SAMPLE_RATE


class AudioLoader:
    def __init__(self):
        self.warnings = []
        self.metadata = {}

    def load(self, file_path: str) -> Tuple[np.ndarray, int, Dict[str, Any]]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"音频文件不存在: {file_path}")

        file_ext = os.path.splitext(file_path)[1].lower()
        valid_extensions = ['.wav', '.flac', '.ogg', '.mp3', '.aiff']
        
        if file_ext not in valid_extensions:
            self.warnings.append(f"文件格式 {file_ext} 不在推荐列表 {valid_extensions} 中")

        audio_data, sample_rate = sf.read(file_path)

        self._check_sample_rate(sample_rate)
        self._check_audio_channels(audio_data)
        
        if audio_data.ndim > 1:
            audio_data = np.mean(audio_data, axis=1)
            self.warnings.append("已将立体声转换为单声道（取平均）")

        duration = len(audio_data) / sample_rate
        num_samples = len(audio_data)

        self.metadata = {
            'file_path': file_path,
            'sample_rate': sample_rate,
            'duration': duration,
            'num_samples': num_samples,
            'channels': 1 if audio_data.ndim == 1 else audio_data.shape[1],
            'peak_amplitude': np.max(np.abs(audio_data)),
            'rms_amplitude': np.sqrt(np.mean(audio_data ** 2)),
            'dc_offset': np.mean(audio_data)
        }

        return audio_data, sample_rate, self.metadata

    def _check_sample_rate(self, sample_rate: int) -> None:
        if sample_rate < MIN_SAMPLE_RATE:
            self.warnings.append(
                f"采样率 {sample_rate} Hz 低于推荐最小值 {MIN_SAMPLE_RATE} Hz，"
                f"可能影响高频分析精度"
            )
        elif sample_rate > MAX_SAMPLE_RATE:
            self.warnings.append(
                f"采样率 {sample_rate} Hz 高于推荐最大值 {MAX_SAMPLE_RATE} Hz，"
                f"可能增加计算量"
            )

        nyquist = sample_rate / 2
        self.metadata['nyquist_frequency'] = nyquist

        if nyquist < 20000:
            self.warnings.append(
                f"奈奎斯特频率 {nyquist:.1f} Hz 低于 20kHz，"
                f"无法完整分析人耳可听频率范围"
            )

    def _check_audio_channels(self, audio_data: np.ndarray) -> None:
        if audio_data.ndim == 1:
            self.metadata['original_channels'] = 1
        else:
            self.metadata['original_channels'] = audio_data.shape[1]

    def normalize_audio(self, audio_data: np.ndarray) -> np.ndarray:
        peak = np.max(np.abs(audio_data))
        if peak > 0:
            normalized = audio_data / peak
            self.metadata['normalization_factor'] = 1.0 / peak
            return normalized
        return audio_data

    def trim_silence(self, audio_data: np.ndarray, threshold: float = 0.01) -> np.ndarray:
        abs_audio = np.abs(audio_data)
        above_threshold = np.where(abs_audio > threshold)[0]
        
        if len(above_threshold) == 0:
            self.warnings.append("未检测到有效音频信号，整段音频可能为静音")
            return audio_data

        start_idx = above_threshold[0]
        end_idx = above_threshold[-1] + 1
        
        trimmed = audio_data[start_idx:end_idx]
        self.metadata['trim_start_samples'] = start_idx
        self.metadata['trim_end_samples'] = len(audio_data) - end_idx
        
        if start_idx > 0 or end_idx < len(audio_data):
            self.warnings.append(
                f"已裁剪静音: 开头 {start_idx} 采样点, 结尾 {len(audio_data) - end_idx} 采样点"
            )
        
        return trimmed

    def get_warnings(self) -> list:
        return self.warnings

    def print_info(self) -> None:
        print("=" * 60)
        print("音频文件信息")
        print("=" * 60)
        for key, value in self.metadata.items():
            if isinstance(value, float):
                print(f"  {key:25s}: {value:.6f}")
            else:
                print(f"  {key:25s}: {value}")
        
        if self.warnings:
            print("\n警告信息:")
            for i, warning in enumerate(self.warnings, 1):
                print(f"  [{i}] {warning}")
        print("=" * 60)
