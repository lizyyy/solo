"""音频校验模块 - 检测空白音频、时长不足、低质量等问题"""
import os
import wave
import struct
import math
from typing import Tuple, List, Optional
from dataclasses import dataclass

from .models import AudioInfo, AbnormalType


@dataclass
class AudioCheckResult:
    is_valid: bool
    audio_info: Optional[AudioInfo]
    abnormal_types: List[AbnormalType]
    details: List[str]


class AudioChecker:
    MIN_DURATION_SECONDS = 30
    BLANK_THRESHOLD_DB = -50
    MIN_SAMPLE_RATE = 44100
    MIN_CHANNELS = 1

    def __init__(self, min_duration: int = None, blank_threshold: float = None):
        self.min_duration = min_duration or self.MIN_DURATION_SECONDS
        self.blank_threshold = blank_threshold or self.BLANK_THRESHOLD_DB

    def analyze_file(self, file_path: str) -> AudioCheckResult:
        if not os.path.exists(file_path):
            return AudioCheckResult(
                is_valid=False,
                audio_info=None,
                abnormal_types=[],
                details=[f"音频文件不存在: {file_path}"]
            )

        file_size = os.path.getsize(file_path)
        if file_size == 0:
            return AudioCheckResult(
                is_valid=False,
                audio_info=None,
                abnormal_types=[AbnormalType.BLANK_AUDIO],
                details=["音频文件为空（0字节），请检查是否上传成功"]
            )

        file_ext = os.path.splitext(file_path)[1].lower()

        if file_ext == ".wav":
            return self._analyze_wav(file_path)
        else:
            return self._analyze_generic(file_path, file_size)

    def _analyze_wav(self, file_path: str) -> AudioCheckResult:
        abnormal_types: List[AbnormalType] = []
        details: List[str] = []

        try:
            with wave.open(file_path, 'rb') as wav_file:
                n_channels = wav_file.getnchannels()
                sample_width = wav_file.getsampwidth()
                sample_rate = wav_file.getframerate()
                n_frames = wav_file.getnframes()

                duration = n_frames / float(sample_rate)

                frames = wav_file.readframes(n_frames)
                avg_volume, is_blank = self._calculate_volume(
                    frames, sample_width, n_channels
                )

        except wave.Error as e:
            return AudioCheckResult(
                is_valid=False,
                audio_info=None,
                abnormal_types=[AbnormalType.LOW_QUALITY],
                details=[f"WAV文件格式损坏: {str(e)}，文件可能上传不完整"]
            )
        except Exception as e:
            return AudioCheckResult(
                is_valid=False,
                audio_info=None,
                abnormal_types=[AbnormalType.LOW_QUALITY],
                details=[f"音频解析失败: {str(e)}"]
            )

        audio_info = AudioInfo(
            file_path=file_path,
            file_name=os.path.basename(file_path),
            duration_seconds=round(duration, 2),
            sample_rate=sample_rate,
            channels=n_channels,
            avg_volume=round(avg_volume, 2),
            is_blank=is_blank
        )

        if duration < self.min_duration:
            abnormal_types.append(AbnormalType.SHORT_AUDIO)
            details.append(
                f"音频时长不足: {duration:.1f}秒，"
                f"最低要求{self.min_duration}秒，"
                f"还差{self.min_duration - duration:.1f}秒"
            )

        if is_blank:
            abnormal_types.append(AbnormalType.BLANK_AUDIO)
            details.append(
                f"检测为空白音频: 平均音量{avg_volume:.1f}dB，"
                f"低于阈值{self.blank_threshold}dB，"
                f"可能是麦克风未开启或环境过于安静"
            )

        if sample_rate < self.MIN_SAMPLE_RATE:
            abnormal_types.append(AbnormalType.LOW_QUALITY)
            details.append(
                f"采样率过低: {sample_rate}Hz，"
                f"建议使用{self.MIN_SAMPLE_RATE}Hz以上以保证音质"
            )

        is_valid = len(abnormal_types) == 0

        return AudioCheckResult(
            is_valid=is_valid,
            audio_info=audio_info,
            abnormal_types=abnormal_types,
            details=details
        )

    def _analyze_generic(self, file_path: str, file_size: int) -> AudioCheckResult:
        abnormal_types: List[AbnormalType] = []
        details: List[str] = []

        estimated_duration = file_size / (44100 * 2 * 1)

        avg_volume = -60.0 if file_size < 1024 * 10 else -20.0
        is_blank = file_size < 1024 * 10

        audio_info = AudioInfo(
            file_path=file_path,
            file_name=os.path.basename(file_path),
            duration_seconds=round(estimated_duration, 2),
            sample_rate=44100,
            channels=1,
            avg_volume=round(avg_volume, 2),
            is_blank=is_blank
        )

        if estimated_duration < self.min_duration:
            abnormal_types.append(AbnormalType.SHORT_AUDIO)
            details.append(
                f"音频时长不足: 预估{estimated_duration:.1f}秒，"
                f"最低要求{self.min_duration}秒"
            )

        if is_blank:
            abnormal_types.append(AbnormalType.BLANK_AUDIO)
            details.append(
                f"疑似空白音频: 文件大小仅{file_size}字节，"
                f"可能未正确录制或上传损坏"
            )

        if file_size < 1024 * 50:
            abnormal_types.append(AbnormalType.LOW_QUALITY)
            details.append(
                f"文件过小: {file_size}字节，音频质量可能无法保证"
            )

        is_valid = len(abnormal_types) == 0

        return AudioCheckResult(
            is_valid=is_valid,
            audio_info=audio_info,
            abnormal_types=abnormal_types,
            details=details
        )

    def _calculate_volume(
        self,
        frames: bytes,
        sample_width: int,
        n_channels: int
    ) -> Tuple[float, bool]:
        if len(frames) == 0:
            return -60.0, True

        fmt = f"{len(frames) // sample_width}h"
        try:
            samples = struct.unpack(fmt, frames)
        except struct.error:
            return -60.0, True

        if len(samples) == 0:
            return -60.0, True

        if n_channels > 1:
            mono_samples = []
            for i in range(0, len(samples), n_channels):
                chunk = samples[i:i + n_channels]
                mono_samples.append(sum(chunk) / n_channels)
            samples = mono_samples

        sum_sq = 0.0
        sample_count = 0
        chunk_size = 1000

        for i in range(0, len(samples), chunk_size):
            chunk = samples[i:i + chunk_size]
            chunk_max = max(abs(s) for s in chunk) if chunk else 0
            if chunk_max < 100:
                continue
            for s in chunk:
                sum_sq += s * s
                sample_count += 1

        if sample_count == 0:
            return -60.0, True

        rms = math.sqrt(sum_sq / sample_count)
        max_val = float(2 ** (8 * sample_width - 1))

        if rms == 0:
            db = -60.0
        else:
            db = 20 * math.log10(rms / max_val)

        is_blank = db < self.blank_threshold

        return round(db, 2), is_blank

    def create_test_blank_audio(self, output_path: str, duration: float = 5.0):
        sample_rate = 44100
        n_frames = int(sample_rate * duration)

        with wave.open(output_path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.setnframes(n_frames)

            silent_frames = b'\x00\x00' * n_frames
            wav_file.writeframes(silent_frames)

    def create_test_short_audio(self, output_path: str, duration: float = 10.0):
        self.create_test_audio_with_tone(output_path, duration, volume_db=-30)

    def create_test_normal_audio(self, output_path: str, duration: float = 45.0):
        self.create_test_audio_with_tone(output_path, duration, volume_db=-20)

    def create_test_audio_with_tone(
        self,
        output_path: str,
        duration: float,
        frequency: float = 440.0,
        volume_db: float = -20.0
    ):
        sample_rate = 44100
        n_frames = int(sample_rate * duration)
        max_val = 32767
        amplitude = int(max_val * (10 ** (volume_db / 20)))

        frames = bytearray()
        for i in range(n_frames):
            t = i / float(sample_rate)
            sample = int(amplitude * math.sin(2 * math.pi * frequency * t))
            frames += struct.pack('<h', sample)

        with wave.open(output_path, 'wb') as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(sample_rate)
            wav_file.setnframes(n_frames)
            wav_file.writeframes(bytes(frames))
