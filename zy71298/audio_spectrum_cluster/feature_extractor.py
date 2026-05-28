"""音频特征提取模块
提取MFCC、频谱特征、节拍、RMS能量等特征，并包含异常检测逻辑。
"""

import os
import uuid
import numpy as np
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path
from tqdm import tqdm
import warnings
import librosa
import soundfile as sf

from .models import (
    AudioSegment,
    SpectralFeatures,
    AnomalyReport,
    AnomalyType
)


class FeatureExtractor:
    """音频特征提取器
    负责加载音频文件，提取多种频谱特征和节拍特征，
    并进行采样率不一致、静音段、标签冲突等异常检测。
    """

    def __init__(
        self,
        target_sample_rate: int = 44100,
        n_mfcc: int = 20,
        silence_threshold: float = 0.01,
        min_duration: float = 0.5
    ):
        """
        Args:
            target_sample_rate: 目标采样率，不一致的音频会被重采样
            n_mfcc: MFCC系数数量
            silence_threshold: 静音检测阈值（RMS能量低于此值视为静音
            min_duration: 最小有效时长（秒）
        """
        self.target_sample_rate = target_sample_rate
        self.n_mfcc = n_mfcc
        self.silence_threshold = silence_threshold
        self.min_duration = min_duration

    def load_audio(
        self,
        file_path: str
    ) -> Tuple[np.ndarray, int, Dict[str, Any]]:
        """加载音频文件，返回音频数据和原始采样率"""
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"音频文件不存在: {file_path}")

        y, sr = librosa.load(
            file_path,
            sr=None,
            mono=True
        )

        info = {
            "original_sample_rate": sr,
            "original_duration": len(y) / sr,
            "channels": 1,
            "was_resampled": False
        }

        if sr != self.target_sample_rate:
            y = librosa.resample(
                y, orig_sr=sr, target_sr=self.target_sample_rate)
            info["was_resampled"] = True
            sr = self.target_sample_rate

        return y, sr, info

    def extract_segment(
        self,
        y: np.ndarray,
        sr: int,
        segment_id: str
    ) -> Tuple[SpectralFeatures, List[AnomalyReport]]:
        """
        提取单个音频片段的特征
        """
        anomalies: List[AnomalyReport] = []

        duration = len(y) / sr

        if duration < self.min_duration:
            anomalies.append(AnomalyReport(
                segment_id=segment_id,
                anomaly_type=AnomalyType.SILENCE_SEGMENT,
                severity="high",
                description=f"音频时长过短",
                affected_values={
                    "duration": duration,
                    "min_required": self.min_duration
                }
            ))

        rms = librosa.feature.rms(y=y)[0]
        rms_mean = float(np.mean(rms))
        rms_std = float(np.std(rms))

        silence_ratio = float(np.mean(rms < self.silence_threshold))
        if silence_ratio > 0.5:
            anomalies.append(AnomalyReport(
                segment_id=segment_id,
                anomaly_type=AnomalyType.SILENCE_SEGMENT,
                severity="medium" if silence_ratio < 0.8 else "high",
                description=f"检测到静音段占比 {silence_ratio:.1%}",
                affected_values={
                    "silence_ratio": silence_ratio,
                    "rms_mean": rms_mean,
                    "threshold": self.silence_threshold
                }
            ))

        mfcc = librosa.feature.mfcc(
            y=y, sr=sr, n_mfcc=self.n_mfcc)
        mfcc_mean = np.mean(mfcc, axis=1).tolist()
        mfcc_std = np.std(mfcc, axis=1).tolist()

        spectral_centroid = float(np.mean(
            librosa.feature.spectral_centroid(y=y, sr=sr)))
        spectral_bandwidth = float(np.mean(
            librosa.feature.spectral_bandwidth(y=y, sr=sr)))
        spectral_rolloff = float(np.mean(
            librosa.feature.spectral_rolloff(y=y, sr=sr)))

        spectral_contrast = np.mean(
            librosa.feature.spectral_contrast(y=y, sr=sr), axis=1).tolist()

        zero_crossing_rate = float(np.mean(
            librosa.feature.zero_crossing_rate(y=y)))

        tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr)
        tempo = float(tempo)
        beat_frames = beat_frames.tolist()

        chroma_stft = np.mean(
            librosa.feature.chroma_stft(y=y, sr=sr), axis=1).tolist()

        feature_vector = self._build_feature_vector(
            mfcc_mean,
            mfcc_std,
            spectral_centroid,
            spectral_bandwidth,
            spectral_rolloff,
            spectral_contrast,
            zero_crossing_rate,
            tempo,
            rms_mean
        )

        features = SpectralFeatures(
            segment_id=segment_id,
            mfcc=mfcc_mean,
            mfcc_std=mfcc_std,
            spectral_centroid=spectral_centroid,
            spectral_bandwidth=spectral_bandwidth,
            spectral_rolloff=spectral_rolloff,
            spectral_contrast=spectral_contrast,
            zero_crossing_rate=zero_crossing_rate,
            tempo=tempo,
            beat_frames=beat_frames,
            chroma_stft=chroma_stft,
            rms_energy=rms_mean,
            rms_energy_std=rms_std,
            feature_vector=feature_vector
        )

        return features, anomalies

    def _build_feature_vector(
        self,
        mfcc_mean, mfcc_std,
        centroid, bandwidth, rolloff,
        contrast, zcr, tempo, rms
    ) -> List[float]:
        """构建归一化的特征向量用于聚类"""
        raw_features = []

        raw_features.extend([float(x) / 100.0 for x in mfcc_mean])
        raw_features.extend([float(x) / 50.0 for x in mfcc_std])
        raw_features.append(float(centroid) / 5000.0)
        raw_features.append(float(bandwidth) / 3000.0)
        raw_features.append(float(rolloff) / 10000.0)
        raw_features.extend([float(x) / 30.0 for x in contrast])
        raw_features.append(float(zcr) * 10.0)
        raw_features.append(float(tempo) / 200.0)
        raw_features.append(float(rms) * 10.0)

        return raw_features

    def extract_from_file(
        self,
        file_path: str,
        instrument_tags: Optional[List[str]] = None,
        performance_version: Optional[str] = None,
        composer: Optional[str] = None,
        title: Optional[str] = None,
        notes: Optional[str] = None,
        original_segment_id: Optional[str] = None
    ) -> Tuple[AudioSegment, SpectralFeatures, List[AnomalyReport]]:
        """
        从文件提取特征，同时检测采样率异常
        """
        y, sr, load_info = self.load_audio(file_path)

        segment_id = f"seg_{uuid.uuid4().hex[:8]}"

        duration = len(y) / sr

        segment = AudioSegment(
            segment_id=segment_id,
            file_path=file_path,
            file_name=os.path.basename(file_path),
            sample_rate=sr,
            duration=duration,
            channels=load_info["channels"],
            instrument_tags=instrument_tags or [],
            performance_version=performance_version,
            composer=composer,
            title=title,
            notes=notes,
            original_segment_id=original_segment_id
        )

        features, anomalies = self.extract_segment(y, sr, segment_id)

        if load_info["was_resampled"]:
            anomalies.insert(0, AnomalyReport(
                segment_id=segment_id,
                anomaly_type=AnomalyType.SAMPLE_RATE_MISMATCH,
                severity="low",
                description=f"采样率不一致，已从 {load_info['original_sample_rate']} Hz 重采样到 {sr} Hz",
                affected_values={
                    "original_sr": load_info["original_sample_rate"],
                    "target_sr": sr,
                    "original_duration": load_info["original_duration"],
                    "resampled_duration": duration
                }
            ))

        return segment, features, anomalies

    def check_label_conflicts(
        self,
        segments: List[AudioSegment],
        features: List[SpectralFeatures]
    ) -> List[AnomalyReport]:
        """
        检查乐器标签冲突检测
        同一标签但频谱特征差异过大视为可能标错
        """
        anomalies: List[AnomalyReport] = []

        tag_groups: Dict[str, List[Tuple[AudioSegment, SpectralFeatures]]] = {}
        for seg, feat in zip(segments, features):
            for tag in seg.instrument_tags:
                if tag not in tag_groups:
                    tag_groups[tag] = []
                tag_groups[tag].append((seg, feat))

        for tag, items in tag_groups.items():
            if len(items) < 2:
                continue

            vectors = np.array([f.feature_vector for _, f in items])
            mean_vec = np.mean(vectors, axis=0)
            distances = np.linalg.norm(vectors - mean_vec, axis=1)

            for i, (seg, _) in enumerate(items):
                if distances[i] > 2.0 * np.mean(distances):
                    anomalies.append(AnomalyReport(
                        segment_id=seg.segment_id,
                        anomaly_type=AnomalyType.LABEL_CONFLICT,
                        severity="medium",
                        description=f"乐器标签 '{tag}' 可能标错，频谱特征与同组差异过大",
                        affected_values={
                            "tag": tag,
                            "distance_to_group": float(distances[i]),
                            "group_mean_distance": float(np.mean(distances)),
                            "group_size": len(items)
                        }
                    ))

        return anomalies

    def process_directory(
        self,
        directory: str,
        file_pattern: str = "*.wav,*.mp3,*.flac,*.ogg",
        show_progress: bool = True
    ) -> Tuple[
        List[AudioSegment],
        List[SpectralFeatures],
        List[AnomalyReport]
    ]:
        """
        批量处理目录下的音频文件
        """
        patterns = file_pattern.split(",")
        audio_files = []
        for pattern in patterns:
            audio_files.extend(Path(directory).glob(pattern.strip()))

        segments: List[AudioSegment] = []
        features_list: List[SpectralFeatures] = []
        all_anomalies: List[AnomalyReport] = []

        iterator = tqdm(audio_files, desc="提取特征") if show_progress else audio_files

        for file_path in iterator:
            try:
                seg, feat, anomalies = self.extract_from_file(str(file_path))
                segments.append(seg)
                features_list.append(feat)
                all_anomalies.extend(anomalies)
            except Exception as e:
                all_anomalies.append(AnomalyReport(
                    segment_id=f"seg_error_{uuid.uuid4().hex[:8]}",
                    anomaly_type=AnomalyType.SILENCE_SEGMENT,
                    severity="high",
                    description=f"处理文件 {file_path} 失败: {str(e)}",
                    affected_values={"file": str(file_path), "error": str(e)}
                ))

        label_anomalies = self.check_label_conflicts(segments, features_list)
        all_anomalies.extend(label_anomalies)

        return segments, features_list, all_anomalies

    def explain_features(self, features: SpectralFeatures) -> Dict[str, Any]:
        """
        生成特征解释，将数值转换为人类可读的解释
        """
        return {
            "segment_id": features.segment_id,
            "tempo": {
                "value": features.tempo,
                "description": f"节拍速度 {features.tempo:.1f} BPM",
                "interpretation": self._interpret_tempo(features.tempo)
            },
            "spectral_centroid": {
                "value": features.spectral_centroid,
                "description": f"频谱质心 {features.spectral_centroid:.1f} Hz",
                "interpretation": self._interpret_centroid(features.spectral_centroid)
            },
            "zero_crossing_rate": {
                "value": features.zero_crossing_rate,
                "description": f"过零率 {features.zero_crossing_rate:.4f}",
                "interpretation": self._interpret_zcr(features.zero_crossing_rate)
            },
            "rms_energy": {
                "value": features.rms_energy,
                "description": f"RMS能量 {features.rms_energy:.4f}",
                "interpretation": self._interpret_rms(features.rms_energy)
            },
            "spectral_bandwidth": {
                "value": features.spectral_bandwidth,
                "description": f"频谱带宽 {features.spectral_bandwidth:.1f} Hz"
            },
            "spectral_rolloff": {
                "value": features.spectral_rolloff,
                "description": f"频谱滚降点 {features.spectral_rolloff:.1f} Hz"
            },
            "timbre": self._interpret_timbre(features)
        }

    def _interpret_tempo(self, tempo: float) -> str:
        if tempo < 60:
            return "慢速（Lento/Adagio）"
        elif tempo < 90:
            return "中慢板（Andante）"
        elif tempo < 120:
            return "中速（Moderato）"
        elif tempo < 150:
            return "快板（Allegro）"
        else:
            return "急板（Presto）"

    def _interpret_centroid(self, centroid: float) -> str:
        if centroid < 1000:
            return "音色低沉、温暖"
        elif centroid < 3000:
            return "音色适中、明亮"
        else:
            return "音色尖锐、明亮"

    def _interpret_zcr(self, zcr: float) -> str:
        if zcr < 0.05:
            return "低频为主，音色纯净"
        elif zcr < 0.15:
            return "中频为主，音色平衡"
        else:
            return "高频丰富，可能有噪音"

    def _interpret_rms(self, rms: float) -> str:
        if rms < 0.05:
            return "音量很轻（ppp）"
        elif rms < 0.15:
            return "音量适中（mf）"
        else:
            return "音量较大（f）"

    def _interpret_timbre(self, features: SpectralFeatures) -> str:
        interpretations = []
        if features.spectral_contrast:
            contrast_mean = np.mean(features.spectral_contrast)
            if contrast_mean > 25:
                interpretations.append("频谱对比度高，音色丰富")
            elif contrast_mean > 15:
                interpretations.append("频谱对比度适中")
            else:
                interpretations.append("频谱对比度低，音色柔和")

        mfcc_range = max(features.mfcc) - min(features.mfcc)
        if mfcc_range > 50:
            interpretations.append("频谱包络变化大")
        elif mfcc_range > 30:
            interpretations.append("频谱包络有变化")
        else:
            interpretations.append("频谱包络平稳")

        return "，".join(interpretations)

